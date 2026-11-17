/**
 * Validación de EVIDENCIA FÍSICA del corpus local: los indicadores JSON
 * storedLocally/hasTranscript por sí solos no certifican que el archivo exista.
 * No envía datos fuera de la máquina ni imprime la voz o la transcripción.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
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
