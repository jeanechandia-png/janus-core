/** PCM helpers for 16-bit little-endian mono audio (default 16 kHz). */
export const PCM_SAMPLE_RATE = 16_000;
export const PCM_BYTES_PER_SAMPLE = 2;
const FRAME_MS = 20;

export function assertPcm16(bytes: Uint8Array): void {
  if (bytes.byteLength % PCM_BYTES_PER_SAMPLE !== 0) throw new Error('PCM16 audio must contain whole 16-bit samples');
}

export function pcmDurationMs(byteLength: number, sampleRate = PCM_SAMPLE_RATE): number {
  return (byteLength / PCM_BYTES_PER_SAMPLE / sampleRate) * 1000;
}

function sampleAt(view: DataView, index: number): number {
  return view.getInt16(index * PCM_BYTES_PER_SAMPLE, true) / 32768;
}

function frameRms(view: DataView, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i += 1) {
    const value = sampleAt(view, i);
    sum += value * value;
  }
  return Math.sqrt(sum / Math.max(1, end - start));
}

export interface SpeechOptions {
  sampleRate?: number;
  /** RMS (0..1) above which a 20 ms frame counts as speech. */
  rmsThreshold?: number;
  /** Keep this much audio around each speech frame. */
  paddingMs?: number;
}

/** Concatenates the frames that contain speech (plus padding). Returns an empty array when there is none. */
export function trimToSpeech(bytes: Uint8Array, options: SpeechOptions = {}): Uint8Array {
  assertPcm16(bytes);
  const rate = options.sampleRate ?? PCM_SAMPLE_RATE;
  const threshold = options.rmsThreshold ?? 0.01;
  const frame = Math.max(1, Math.round((rate * FRAME_MS) / 1000));
  const pad = Math.round((options.paddingMs ?? 100) / FRAME_MS);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const total = bytes.byteLength / PCM_BYTES_PER_SAMPLE;
  const frames = Math.ceil(total / frame);
  const voiced = new Array<boolean>(frames).fill(false);
  for (let f = 0; f < frames; f += 1) {
    voiced[f] = frameRms(view, f * frame, Math.min(total, (f + 1) * frame)) >= threshold;
  }
  const keep = new Array<boolean>(frames).fill(false);
  for (let f = 0; f < frames; f += 1) {
    if (!voiced[f]) continue;
    for (let k = Math.max(0, f - pad); k <= Math.min(frames - 1, f + pad); k += 1) keep[k] = true;
  }
  const out: Uint8Array[] = [];
  let length = 0;
  for (let f = 0; f < frames; f += 1) {
    if (!keep[f]) continue;
    const slice = bytes.subarray(f * frame * PCM_BYTES_PER_SAMPLE, Math.min(total, (f + 1) * frame) * PCM_BYTES_PER_SAMPLE);
    out.push(slice);
    length += slice.byteLength;
  }
  const merged = new Uint8Array(length);
  let offset = 0;
  for (const part of out) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return merged;
}

/** Rolling buffer of the most recent audio, drained once per utterance. */
export class UtteranceAudioBuffer {
  private chunks: Uint8Array[] = [];
  private bytes = 0;

  constructor(private readonly maxMs = 15_000, private readonly sampleRate = PCM_SAMPLE_RATE) {}

  push(chunk: Uint8Array): void {
    assertPcm16(chunk);
    this.chunks.push(chunk);
    this.bytes += chunk.byteLength;
    const limit = Math.round((this.maxMs / 1000) * this.sampleRate) * PCM_BYTES_PER_SAMPLE;
    while (this.bytes > limit && this.chunks.length > 1) {
      this.bytes -= this.chunks.shift()!.byteLength;
    }
  }

  get durationMs(): number {
    return pcmDurationMs(this.bytes, this.sampleRate);
  }

  drain(): Uint8Array {
    const merged = new Uint8Array(this.bytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.chunks = [];
    this.bytes = 0;
    return merged;
  }
}
