import type { ElevenLabsVoiceSettings } from '../../adapters/src/elevenlabs-tts-adapter.js';

export type AssistantVoiceProfileId = 'janus' | 'melanie';
export interface AssistantVoiceProfile {
  id: AssistantVoiceProfileId;
  label: string;
  voiceId: string;
  providerVoiceId?: string;
  modelId?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
}

// Los IDs del proveedor y sus parámetros viven en entorno/configuración privada, no en el cliente.
export function resolveAssistantVoiceProfiles(env: Record<string, string | undefined>, privateConfig: unknown = {}) {
  const config = privateConfig as { profiles?: Partial<Record<AssistantVoiceProfileId, { providerVoiceId?: string; modelId?: string; voiceSettings?: ElevenLabsVoiceSettings }>> };
  const profiles: AssistantVoiceProfile[] = [
    { id: 'janus', label: 'Janus · voz masculina de Jean', voiceId: env.JANUS_VOICE_ID?.trim() || 'janus-default',
      ...config.profiles?.janus, providerVoiceId: env.JANUS_ELEVENLABS_VOICE_ID?.trim() || config.profiles?.janus?.providerVoiceId },
    { id: 'melanie', label: 'Melanie · voz femenina', voiceId: env.JANUS_MELANIE_VOICE_ID?.trim() || 'melanie-default',
      ...config.profiles?.melanie, providerVoiceId: env.JANUS_MELANIE_ELEVENLABS_VOICE_ID?.trim() || config.profiles?.melanie?.providerVoiceId },
  ];
  // No permitir que un archivo de datos redefina id/voiceId/label mediante propiedades adicionales.
  profiles[0]!.id = 'janus'; profiles[0]!.voiceId = env.JANUS_VOICE_ID?.trim() || 'janus-default'; profiles[0]!.label = 'Janus · voz masculina de Jean';
  profiles[1]!.id = 'melanie'; profiles[1]!.voiceId = env.JANUS_MELANIE_VOICE_ID?.trim() || 'melanie-default'; profiles[1]!.label = 'Melanie · voz femenina';
  if (profiles[0]!.voiceId === profiles[1]!.voiceId) throw new Error('Las voces masculina y femenina deben tener alias distintos.');
  for (const profile of profiles) {
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(profile.voiceId)) throw new Error('Alias de voz no válido.');
    if (profile.providerVoiceId && !/^[A-Za-z0-9_-]{10,100}$/.test(profile.providerVoiceId)) throw new Error('Identificador privado de voz no válido.');
  }
  return profiles;
}

export function selectAssistantVoice(profiles: readonly AssistantVoiceProfile[], input: unknown): AssistantVoiceProfile {
  const id = input === undefined || input === '' ? 'janus' : input;
  const profile = profiles.find(item => item.id === id || item.voiceId === id);
  if (!profile) throw new Error('Perfil de voz no autorizado. Seleccione Janus o Melanie.');
  return profile;
}
