/**
 * Comprueba si el corpus de grabaciones ORIGINALES basta para el clon local de la voz
 * (modo `voice_clone` de Qwen3-TTS) y qué falta para poder prescindir del proveedor en la nube.
 * Solo lee metadatos (JSON). No abre audio, no llama a ningún proveedor, no imprime secretos.
 *
 * Uso: npm run voice:independence   (JANUS_VOICE_CORPUS=ruta.json para otra ubicación)
 */
import { existsSync, readFileSync } from 'node:fs';
import {
  assessLocalCloneReadiness,
  type VoiceCorpusManifest,
} from '../packages/voice/src/voice-independence.js';

const corpusPath = process.env.JANUS_VOICE_CORPUS?.trim() || 'voices/private/corpus.json';
const voiceConfigPath = process.env.JANUS_QWEN_VOICE_CONFIG?.trim() || 'config/voices.local.json';

console.log('Janus — independencia de voz (clon local con grabaciones originales)');
console.log('⬜ = pendiente. No es un fallo: ElevenLabs sigue siendo opcional y temporal.\n');

if (!existsSync(corpusPath)) {
  console.log(`⬜ Corpus: no existe ${corpusPath}. Copia config/voice-corpus.example.json y rellena solo metadatos.`);
  console.log('   Qué grabar: 1–3 minutos de Jean, sala silenciosa, sin música ni eco, con su transcripción exacta.');
  process.exit(0);
}

let manifest: VoiceCorpusManifest;
try {
  manifest = JSON.parse(readFileSync(corpusPath, 'utf8')) as VoiceCorpusManifest;
} catch {
  console.log(`❌ ${corpusPath} no es JSON válido.`);
  process.exit(1);
}

const readiness = assessLocalCloneReadiness(manifest);
console.log(`${readiness.ready ? '✅' : '⬜'} Corpus de «${manifest.subject}»: ${readiness.usableSeconds}s utilizables en ${readiness.usableSampleIds.length} muestra(s).`);
for (const blocker of readiness.blockers) console.log(`   ⛔ ${blocker}`);
for (const warning of readiness.warnings) console.log(`   ⚠️  ${warning}`);

let cloneConfigured = false;
if (existsSync(voiceConfigPath)) {
  try {
    const parsed = JSON.parse(readFileSync(voiceConfigPath, 'utf8')) as { voices?: Record<string, { mode?: string }> };
    cloneConfigured = Object.values(parsed.voices ?? {}).some((voice) => voice?.mode === 'voice_clone');
  } catch {
    console.log(`❌ ${voiceConfigPath} no es JSON válido.`);
  }
}
console.log(`${cloneConfigured ? '✅' : '⬜'} Voz local en modo voice_clone declarada en ${voiceConfigPath}.`);
console.log('\nPara retirar al proveedor deben cumplirse las 5 compuertas de docs/voice-elevenlabs-provider.md (aceptación del Founder incluida).');
