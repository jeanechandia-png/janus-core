#!/usr/bin/env python3
"""Local speaker-embedding sidecar for the speaker-id LEGO module.

Contract (the only thing the module depends on):
    POST /embed   body: raw PCM16 mono 16 kHz (little-endian)
                  200 -> {"embedding": [floats], "model_id": "<string>"}
    GET  /health  200 -> {"ok": true, "model_id": "<string>"}

Binds to loopback by default. Voice audio is biometric data: do not expose this port.

The model is replaceable. Default: SpeechBrain ECAPA-TDNN ("speechbrain/spkrec-ecapa-voxceleb").
STATUS: written against SpeechBrain's documented EncoderClassifier API but NOT executed in the
environment where it was authored (no model weights / torch there). Run it once on the Janus host,
confirm /health, and calibrate the thresholds with real recordings before trusting identification.
Check the licence terms of the model and its training data before commercial reuse.

Install (on the host):  pip install torch torchaudio speechbrain numpy
Run:                    python speaker_embed_server.py --port 8791
"""
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL_SOURCE = os.environ.get("SPEAKER_MODEL_SOURCE", "speechbrain/spkrec-ecapa-voxceleb")
MODEL_DIR = os.environ.get("SPEAKER_MODEL_DIR", "models/speaker-ecapa")
MAX_BYTES = 16000 * 2 * 30  # 30 seconds
MODEL_ID = "speechbrain-ecapa-voxceleb"

_classifier = None


def classifier():
    global _classifier
    if _classifier is None:
        import torch  # noqa: F401  (imported for its side effects on device selection)
        from speechbrain.inference.speaker import EncoderClassifier

        _classifier = EncoderClassifier.from_hparams(source=MODEL_SOURCE, savedir=MODEL_DIR)
    return _classifier


def embed(pcm: bytes):
    import numpy as np
    import torch

    samples = np.frombuffer(pcm, dtype="<i2").astype("float32") / 32768.0
    signal = torch.from_numpy(samples).unsqueeze(0)
    with torch.no_grad():
        vector = classifier().encode_batch(signal).squeeze().cpu().numpy()
    return [float(v) for v in vector.reshape(-1)]


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "model_id": MODEL_ID})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/embed":
            return self._json(404, {"error": "not found"})
        length = int(self.headers.get("content-length", "0"))
        if length <= 0 or length > MAX_BYTES or length % 2 != 0:
            return self._json(400, {"error": "body must be PCM16 mono, 1..30 s"})
        try:
            self._json(200, {"embedding": embed(self.rfile.read(length)), "model_id": MODEL_ID})
        except Exception as error:  # report, never log audio
            self._json(500, {"error": type(error).__name__})

    def log_message(self, *args):  # silence default request logging
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8791)
    args = parser.parse_args()
    HTTPServer((args.host, args.port), Handler).serve_forever()
