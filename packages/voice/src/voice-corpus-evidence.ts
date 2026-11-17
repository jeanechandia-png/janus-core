/**
 * Validación de EVIDENCIA FÍSICA del corpus local: los indicadores JSON
 * storedLocally/hasTranscript por sí solos no certifican que el archivo exista.
 * No envía datos fuera de la máquina ni imprime la voz o la transcripción.
 */
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, existsSync, fstatSync, openSync, readSync, realpathSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { VoiceCorpusManifest, VoiceCorpusSample } from './voice-independence.js';

export interface LocalVoiceSample extends VoiceCorpusSample {
  /** Ruta relativa a voices/private/; absoluta, URL y rutas fuera del directorio están prohibidas. */
  localAudioFile?: string;
  localTranscriptFile?: string;
}
export interface SampleEvidence {
  id: string;
  audioVerified: boolean;
  transcriptPresent: boolean;
  failures: string[];
}
export interface CorpusFileEvidence {
  verifiedManifest: VoiceCorpusManifest;
  samples: SampleEvidence[];
}

function privatePath(root: string, candidate: string): string {
  if (!candidate || isAbsolute(candidate) || /^(?:https?:|data:|file:)/i.test(candidate)) {
    throw new Error('Se requiere ruta local relativa al directorio privado.');
  }
  const path = realpathSync(resolve(root, candidate));
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error('El archivo debe permanecer dentro de voices/private, sin enlaces externos.');
  }
  if (!statSync(path).isFile()) throw new Error('No es un archivo privado regular.');
  return path;
}

/** Solo admite audio PCM WAV local, mono 24 kHz / 16 bits, que consume Janus-Qwen. */
function inspectPcmWav(path: string): { seconds: number } {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const prefix = Buffer.alloc(12);
    if (readSync(fd, prefix, 0, 12, 0) !== 12 || prefix.toString('ascii', 0, 4) !== 'RIFF' || prefix.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('El archivo no es WAV RIFF válido.');
    }
    let offset = 12;
    let fmt: { format: number; channels: number; sampleRate: number; blockAlign: number; bits: number } | null = null;
    let dataBytes = -1;
    while (offset + 8 <= size) {
      const hdr = Buffer.alloc(8);
      if (readSync(fd, hdr, 0, 8, offset) !== 8) break;
      const chunkSize = hdr.readUInt32LE(4);
      const next = offset + 8 + chunkSize + (chunkSize % 2);
      if (next > size || next <= offset) throw new Error('WAV contiene fragmentos inválidos.');
      const kind = hdr.toString('ascii', 0, 4);
      if (kind === 'fmt ' && chunkSize >= 16) {
        const body = Buffer.alloc(16);
        if (readSync(fd, body, 0, 16, offset + 8) !== 16) throw new Error('WAV incompleto.');
        fmt = { format: body.readUInt16LE(0), channels: body.readUInt16LE(2), sampleRate: body.readUInt32LE(4), blockAlign: body.readUInt16LE(12), bits: body.readUInt16LE(14) };
      }
      if (kind === 'data') dataBytes = chunkSize;
      if (fmt && dataBytes >= 0) break;
      offset = next;
    }
    if (!fmt || dataBytes <= 0 || fmt.format !== 1 || fmt.channels !== 1 || fmt.sampleRate !== 24000 || fmt.bits !== 16 || fmt.blockAlign !== 2) {
      throw new Error('La referencia requiere WAV PCM16 mono a 24 kHz.');
    }
    return { seconds: dataBytes / (fmt.sampleRate * fmt.blockAlign) };
  } finally {
    closeSync(fd);
  }
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Comprueba procedencia declarada, fichero real, SHA-256, transcripción presente.
 * La coincidencia semántica audio/transcripción y la limpieza requieren revisión humana.
 */
export async function verifyLocalVoiceCorpusEvidence(
  manifest: VoiceCorpusManifest,
  privateDir: string,
): Promise<CorpusFileEvidence> {
  const root = existsSync(privateDir) ? realpathSync(privateDir) : '';
  const checked: LocalVoiceSample[] = [];
  const evidence: SampleEvidence[] = [];

  for (const item of manifest.samples as LocalVoiceSample[]) {
    const failures: string[] = [];
    let audioVerified = false;
    let transcriptPresent = false;

    if (!root) {
      failures.push('No existe el directorio privado de voz.');
    } else if (item.provenance !== 'original-recording') {
      failures.push('La procedencia no es grabación original: no se verifica para clonación.');
    } else {
      try {
        if (!item.localAudioFile) throw new Error('Falta localAudioFile en el manifiesto.');
        const audio = privatePath(root, item.localAudioFile);
        const wav = inspectPcmWav(audio);
        if (!Number.isFinite(item.durationSeconds) || Math.abs(wav.seconds - item.durationSeconds) > 0.15) {
          throw new Error('La duración del audio no coincide con la duración declarada.');
        }
        const actualHash = await sha256(audio);
        if (actualHash.toLowerCase() !== item.sha256.toLowerCase()) {
          throw new Error('SHA-256 del audio no coincide con el archivo físico.');
        }
        audioVerified = true;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'Error al verificar el audio privado.');
      }

      try {
        if (!item.localTranscriptFile) throw new Error('Falta localTranscriptFile; requiere transcripción literal revisada.');
        const transcript = privatePath(root, item.localTranscriptFile);
        const text = await readFile(transcript, 'utf8');
        if (!text.trim()) throw new Error('La transcripción está vacía.');
        transcriptPresent = true;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'Error al verificar la transcripción privada.');
      }
    }

    // La revisión auditiva humana NO se deduce del SHA ni de la existencia del archivo.
    checked.push({
      ...item,
      storedLocally: audioVerified,
      hasTranscript: transcriptPresent,
      cleanAudioConfirmed: item.cleanAudioConfirmed === true,
    });
    evidence.push({ id: item.id, audioVerified, transcriptPresent, failures });
  }

  return { verifiedManifest: { ...manifest, samples: checked }, samples: evidence };
}
