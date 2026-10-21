#!/usr/bin/env python3
"""Local face-embedding sidecar for the face-id LEGO module.

Contract (the only thing the module depends on):
    POST /embed   body: raw image bytes (JPEG/PNG/WebP), Content-Type image/*
                  200 -> {"embedding": [floats], "model_id": "<string>", "faces": <int>, "quality": <0..1>}
                  ("embedding" is empty when faces != 1)
    GET  /health  200 -> {"ok": true, "model_id": "<string>"}

Binds to loopback by default. Face images are biometric data: do not expose this port, do not log images.

The model is replaceable. Default: InsightFace "buffalo_l" (ArcFace embeddings + SCRFD detector).
STATUS: written against InsightFace's documented FaceAnalysis API but NOT executed in the environment where it was
authored (no model weights there). Run it once on the Janus host, confirm /health, and calibrate the thresholds with
real photos before trusting identification. CHECK THE LICENCE of the InsightFace code and of the pretrained weights
(the weights have non-commercial terms at the time of writing: POR CONFIRMAR) before any commercial reuse.

Install (on the host):  pip install insightface onnxruntime opencv-python-headless numpy
Run:                    python face_embed_server.py --port 8792
"""
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL_NAME = os.environ.get("FACE_MODEL_NAME", "buffalo_l")
MAX_BYTES = 4 * 1024 * 1024
_app = None


def app():
    global _app
    if _app is None:
        import numpy  # noqa: F401
        from insightface.app import FaceAnalysis
        _app = FaceAnalysis(name=MODEL_NAME, providers=["CPUExecutionProvider"])
        _app.prepare(ctx_id=-1, det_size=(640, 640))
    return _app


def embed(image_bytes):
    import cv2
    import numpy as np
    frame = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("cannot decode image")
    faces = app().get(frame)
    if len(faces) != 1:
        return {"embedding": [], "model_id": f"insightface:{MODEL_NAME}", "faces": len(faces)}
    face = faces[0]
    vector = face.normed_embedding if getattr(face, "normed_embedding", None) is not None else face.embedding
    return {
        "embedding": [float(x) for x in vector],
        "model_id": f"insightface:{MODEL_NAME}",
        "faces": 1,
        "quality": float(getattr(face, "det_score", 0.0)),
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # never log request details
        return

    def _send(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"ok": True, "model_id": f"insightface:{MODEL_NAME}"})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/embed":
            return self._send(404, {"error": "not found"})
        length = int(self.headers.get("content-length", "0"))
        if length <= 0 or length > MAX_BYTES:
            return self._send(413, {"error": "bad size"})
        try:
            self._send(200, embed(self.rfile.read(length)))
        except Exception as error:  # noqa: BLE001
            self._send(400, {"error": str(error)[:200]})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8792)
    args = parser.parse_args()
    HTTPServer((args.host, args.port), Handler).serve_forever()
