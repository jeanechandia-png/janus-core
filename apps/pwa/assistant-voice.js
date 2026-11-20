import { authHeaders, sessionToken } from './founder-session.js';
import { PcmTtsPlayer } from './pcm-tts-player.js';

const STORAGE = 'janus.assistant.voice';
const player = new PcmTtsPlayer();
let pending;
export function selectedAssistantVoice() {
  try { return localStorage.getItem(STORAGE) === 'melanie' ? 'melanie' : 'janus'; } catch { return 'janus'; }
}
export function selectAssistantVoice(profile) {
  if (profile !== 'janus' && profile !== 'melanie') throw new Error('Perfil de voz no válido.');
  stopAssistantVoice();
  try { localStorage.setItem(STORAGE, profile); } catch { /* sin persistencia */ }
  dispatchEvent(new CustomEvent('janus:voice-profile', { detail: { profile } }));
}
export function stopAssistantVoice() { pending?.abort(); pending = null; player.interrupt(); }
export async function speakAssistant(text) {
  if (!sessionToken()) throw new Error('Entre como Founder antes de usar su voz.');
  stopAssistantVoice();
  await player.ensureContext();
  const controller = new AbortController(); pending = controller;
  try {
    const response = await fetch('/api/voice/speak', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text: String(text).slice(0, 2000), profile: selectedAssistantVoice() }), signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'La voz está pendiente de configuración.');
    }
    const audio = await response.arrayBuffer();
    if (!controller.signal.aborted) await player.enqueue(audio, response.headers.get('content-type'));
    return true;
  } finally { if (pending === controller) pending = null; }
}

// Mismo control en Controles y en el menú del dashboard. Ninguna generación al montar/cambiar perfil.
export function mountAssistantVoiceControls(host) {
  const box = document.createElement('div'); box.className = 'approvals-actions';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Voz de Janus');
  for (const [id, label] of [['janus', 'Janus · voz de Jean'], ['melanie', 'Melanie · voz femenina']]) {
    const option = document.createElement('option'); option.value = id; option.textContent = label; select.append(option);
  }
  const test = document.createElement('button'); test.type = 'button'; test.className = 'secondary'; test.textContent = 'Probar voz';
  const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'secondary'; stop.textContent = 'Detener voz';
  const status = document.createElement('span'); status.setAttribute('role', 'status');
  const refresh = () => { select.value = selectedAssistantVoice(); box.hidden = !sessionToken(); };
  select.addEventListener('change', () => selectAssistantVoice(select.value));
  test.addEventListener('click', async () => {
    test.disabled = true; status.textContent = 'Preparando voz…';
    try {
      await speakAssistant(selectedAssistantVoice() === 'janus' ? 'Hola, soy Janus, con la voz de Jean. ¿En qué puedo ayudarle?' : 'Hola, soy Melanie, la voz femenina de Janus. ¿En qué puedo ayudarle?');
      status.textContent = 'Audio recibido de la voz configurada.';
    } catch (error) { status.textContent = error.name === 'AbortError' ? 'Voz detenida.' : error.message; }
    finally { test.disabled = false; }
  });
  stop.addEventListener('click', () => { stopAssistantVoice(); status.textContent = 'Voz detenida.'; });
  box.append(select, test, stop, status); host.append(box);
  addEventListener('janus:voice-profile', refresh);
  addEventListener('janus:avatar-form', event => {
    if (event.detail?.form === 'nexo-masculino') selectAssistantVoice('janus');
    if (event.detail?.form === 'nexo-femenino') selectAssistantVoice('melanie');
  });
  addEventListener('pagehide', stopAssistantVoice);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAssistantVoice(); });
  window.JanusAssistantVoice = { speak: speakAssistant, stop: stopAssistantVoice, selected: selectedAssistantVoice };
  refresh();
  return { refresh };
}
