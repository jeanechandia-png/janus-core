import { mountAppInstall } from './app-install.js';
import { mountGlowEmblem } from './glow-emblem.js';
import { authHeaders, createDeviceKey, devicePublicKeyPem, loadDeviceKey, sessionToken, signIn, signOut } from './founder-session.js';
import { PcmTtsPlayer } from './pcm-tts-player.js';

const activity = document.querySelector('#activity');
const template = document.querySelector('#eventTemplate');
const connection = document.querySelector('#connection');
const capabilityList = document.querySelector('#capabilityList');
const voiceButton = document.querySelector('#voiceButton');
const presenceState = document.querySelector('#presenceState');
const transcript = document.querySelector('#transcript');
const command = document.querySelector('#command');
const sendButton = document.querySelector('#sendButton');
const pauseButton = document.querySelector('#pauseButton');
const stopButton = document.querySelector('#stopButton');
const clearButton = document.querySelector('#clearButton');

const storedVoiceSessionId = localStorage.getItem('janus.voiceSessionId');
const voiceSessionId = storedVoiceSessionId || `iphone_${crypto.randomUUID()}`;
if (!storedVoiceSessionId) localStorage.setItem('janus.voiceSessionId', voiceSessionId);

const PCM_MIME_TYPE = 'audio/pcm;rate=16000;channels=1;format=s16le';
const VAD_START_RMS = 0.025;
const VAD_END_RMS = 0.012;
const VAD_START_FRAMES = 2;
const VAD_END_FRAMES = 25;
const ttsPlayer = new PcmTtsPlayer();

let currentRunId = null;
let currentRunActive = false;
let paused = false;
let listening = false;
let recognition = null;
let recognitionConfigured = false;
let events = null;
let voiceMode = 'pending';
let voiceSocket = null;
let audioContext = null;
let mediaStream = null;
let captureSource = null;
let captureNode = null;
let muteNode = null;
let pcmStarting = false;
let speechActive = false;
let speechFrames = 0;
let silenceFrames = 0;
let ttsActive = false;
let pendingTtsAudioMeta = [];

function setConnection(online) {
  connection.classList.toggle('online', online);
  connection.classList.toggle('offline', !online);
  connection.lastChild.textContent = online ? ' conectado' : ' desconectado';
}

const interpretationNotice = document.querySelector('#interpretationNotice');
const interpretationText = document.querySelector('#interpretationText');
const interpretationAccept = document.querySelector('#interpretationAccept');
let pendingSuggestedText = '';
document.querySelector('#interpretationClose')?.addEventListener('click', () => {
  interpretationNotice.hidden = true;
  pendingSuggestedText = '';
});
interpretationAccept?.addEventListener('click', () => {
  if (!pendingSuggestedText) return;
  // Human confirmation: resend the corrected wording as a new, fully governed command.
  const corrected = pendingSuggestedText;
  pendingSuggestedText = '';
  interpretationNotice.hidden = true;
  void submit(corrected);
});

/**
 * Shows what Janus understood when the dictation/transcription looked wrong.
 * It has its own persistent region so run progress never overwrites a question.
 */
function showInterpretation(interpretation) {
  if (!interpretationNotice || !interpretationText) return;
  if (!interpretation || !Array.isArray(interpretation.corrections) || interpretation.corrections.length === 0) {
    interpretationNotice.hidden = true;
    return;
  }
  const applied = interpretation.corrections
    .filter((correction) => correction.applied)
    .map((correction) => `«${correction.original}» → «${correction.canonical}»`);
  const parts = [];
  if (applied.length > 0) parts.push(`Interpreté ${applied.join(', ')}.`);
  if (interpretation.needsConfirmation && interpretation.confirmationPrompt) parts.push(interpretation.confirmationPrompt);
  if (parts.length === 0) return;
  interpretationText.textContent = parts.join(' ');
  pendingSuggestedText = interpretation.needsConfirmation && typeof interpretation.suggestedText === 'string'
    && interpretation.suggestedText !== interpretation.originalText
    ? interpretation.suggestedText
    : '';
  if (interpretationAccept) interpretationAccept.hidden = !pendingSuggestedText;
  interpretationNotice.classList.toggle('needs-confirmation', Boolean(interpretation.needsConfirmation));
  interpretationNotice.hidden = false;
}

function setPresence(state, text) {
  presenceState.textContent = state;
  if (text) transcript.textContent = text;
  voiceButton.classList.toggle('working', ['Trabajando', 'Ejecutando', 'Procesando'].includes(state));
}

function detailFrom(event) {
  const payload = event.payload ?? {};
  if (typeof payload.preview === 'string') return payload.preview;
  if (typeof payload.error === 'string') return payload.error;
  if (typeof payload.percent === 'number') return `Progreso: ${payload.percent}%`;
  if (typeof payload.tool === 'string') return `Herramienta: ${payload.tool}`;
  if (typeof payload.goal === 'string') return payload.goal;
  return '';
}

function eventState(type) {
  if (type.includes('failed')) return 'error';
  if (type.includes('blocked') || type.includes('approval')) return 'alert';
  if (type.includes('completed') || type === 'artifact.updated') return 'done';
  if (type.includes('cancelled')) return 'alert';
  return 'active';
}

function setRunControls(active) {
  currentRunActive = active;
  pauseButton.disabled = !active;
  stopButton.disabled = !active;
  if (!active) {
    paused = false;
    pauseButton.textContent = 'Pausar';
  }
}

function renderEvent(event) {
  if (currentRunId && event.runId !== currentRunId) return;
  if (activity.classList.contains('empty')) {
    activity.classList.remove('empty');
    activity.innerHTML = '';
  }

  const detail = detailFrom(event);
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.state = eventState(event.type);
  node.querySelector('.event-source').textContent = `${event.source} · ${event.type}`;
  node.querySelector('.event-time').textContent = new Date(event.at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  node.querySelector('.event-summary').textContent = event.summary;
  node.querySelector('.event-detail').textContent = detail;
  activity.append(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (event.type === 'run.heard') setPresence('Escuchado', 'Te escuché. Empiezo ahora.');
  if (event.type === 'run.started' || event.type === 'run.step.started') setPresence('Trabajando', event.summary);
  if (event.type === 'tool.progress') setPresence('Procesando', event.summary);
  if (event.type === 'run.paused') {
    paused = true;
    pauseButton.textContent = 'Continuar';
    setPresence('Pausado', 'La ejecución está detenida, pero la sesión sigue viva.');
  }
  if (event.type === 'run.resumed') {
    paused = false;
    pauseButton.textContent = 'Pausar';
    setPresence('Trabajando', 'Continuando desde el punto anterior.');
  }
  if (event.type === 'run.completed') {
    setPresence('Terminado', 'Objetivo completado.');
    setRunControls(false);
  }
  if (event.type === 'run.cancelled') {
    setPresence('Detenido', 'Ejecución detenida por tu orden.');
    setRunControls(false);
  }
  if (event.type === 'run.failed' || event.type === 'run.blocked') {
    setPresence('Necesita atención', detail || event.summary);
    setRunControls(false);
    void checkHealth();
  }
}

function connectEvents(runId) {
  events?.close();
  const query = runId ? `?runId=${encodeURIComponent(runId)}` : '';
  events = new EventSource(`/api/events${query}`);
  events.onopen = () => setConnection(true);
  events.onerror = () => setConnection(false);
  events.onmessage = (message) => {
    try {
      renderEvent(JSON.parse(message.data));
    } catch (error) {
      console.error('invalid event', error);
    }
  };
}

function renderCapabilities(capabilities) {
  capabilityList.innerHTML = '';
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    capabilityList.textContent = 'No hay herramientas registradas.';
    capabilityList.classList.add('capability-empty');
    return;
  }

  capabilityList.classList.remove('capability-empty');
  const grouped = new Map();
  for (const item of capabilities) {
    if (!item || typeof item.tool !== 'string' || typeof item.action !== 'string') continue;
    const group = grouped.get(item.tool) ?? { tool: item.tool, actions: [], states: [], reasons: [] };
    group.actions.push(item.action);
    group.states.push(item.state);
    if (typeof item.reason === 'string' && item.reason.trim()) group.reasons.push(item.reason.trim());
    grouped.set(item.tool, group);
  }

  for (const group of grouped.values()) {
    const state = aggregateCapabilityState(group.states);
    const row = document.createElement('div');
    row.className = 'capability-row';
    row.dataset.state = state;

    const copy = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'capability-name';
    name.textContent = capabilityToolName(group.tool);
    const detail = document.createElement('div');
    detail.className = 'capability-detail';
    detail.textContent = group.reasons[0] ?? `${group.actions.length} acción${group.actions.length === 1 ? '' : 'es'} registrada${group.actions.length === 1 ? '' : 's'}`;
    copy.append(name, detail);

    const badge = document.createElement('div');
    badge.className = 'capability-badge';
    badge.textContent = capabilityStateLabel(state);
    row.append(copy, badge);
    capabilityList.append(row);
  }
}

function aggregateCapabilityState(states) {
  const priority = ['disabled', 'needs_auth', 'unavailable', 'available'];
  return priority.find((state) => states.includes(state)) ?? 'unavailable';
}

function capabilityToolName(tool) {
  if (tool === 'google-workspace') return 'Google Workspace';
  if (tool === 'github') return 'GitHub';
  return tool;
}

function capabilityStateLabel(state) {
  if (state === 'available') return 'Disponible';
  if (state === 'needs_auth') return 'Autorizar';
  if (state === 'disabled') return 'Desactivado';
  return 'No disponible';
}

function supportsPcmStreaming() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return Boolean(
    window.WebSocket
    && navigator.mediaDevices?.getUserMedia
    && AudioContextClass
    && window.AudioWorkletNode,
  );
}

function configureVoiceMode(health) {
  const streamingState = health?.voice?.streaming?.state;
  if (streamingState === 'available' && supportsPcmStreaming()) {
    voiceMode = 'pcm-stream';
    voiceButton.disabled = false;
    if (!listening) {
      setPresence('Listo', 'Voz PCM streaming lista. Toca el núcleo y habla con Janus.');
    }
    return;
  }

  if (!recognitionConfigured) configureSpeechRecognition();
  if (voiceMode === 'pending') voiceMode = recognition ? 'browser-fallback' : 'text-only';
}

async function checkHealth() {
  try {
    const response = await fetch('/health', { cache: 'no-store' });
    setConnection(response.ok);
    if (!response.ok) throw new Error('Core no disponible');
    const health = await response.json();
    renderCapabilities(health.capabilities);
    configureVoiceMode(health);
    return health;
  } catch {
    setConnection(false);
    renderCapabilities([]);
    if (!recognitionConfigured) configureSpeechRecognition();
    return null;
  }
}

function activateRun(runId) {
  currentRunId = runId;
  paused = false;
  setRunControls(true);
  connectEvents(runId);
}

const effortSelect = document.querySelector('#effortSelect');
const effortHint = document.querySelector('#effortHint');
const EFFORT_LABELS = { eco: 'ECO', normal: 'NORMAL', profundo: 'PROFUNDO', maximo: 'MÁXIMO' };
const RISK_LABELS = { none: 'ninguno', low: 'bajo', medium: 'medio', high: 'alto', critical: 'crítico' };
try {
  const saved = localStorage.getItem('janus.effort');
  if (saved && [...effortSelect.options].some((option) => option.value === saved)) effortSelect.value = saved;
} catch { /* storage unavailable: AUTO */ }
effortSelect.addEventListener('change', () => {
  try { localStorage.setItem('janus.effort', effortSelect.value); } catch { /* ignore */ }
  effortHint.textContent = '';
});

function showEffort(effort) {
  if (!effort) { effortHint.textContent = ''; return; }
  const parts = [`${EFFORT_LABELS[effort.level] ?? effort.level}${effort.source === 'auto' ? ' (auto)' : ''}`, `riesgo ${RISK_LABELS[effort.risk] ?? effort.risk}`];
  if (effort.raisedByRisk) parts.push('subido por riesgo');
  if (effort.requiresConfirmation) parts.push('pedirá confirmación');
  effortHint.textContent = parts.join(' · ');
  effortHint.dataset.level = effort.level;
}

async function submit(text) {
  const clean = text.trim();
  if (!clean) return;

  activity.classList.remove('empty');
  activity.innerHTML = '';
  setPresence('Enviando', clean);
  sendButton.disabled = true;

  try {
    const response = await fetch('/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text: clean, inputMode: 'text', effort: effortSelect.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'No se pudo iniciar');
    activateRun(data.runId);
    showEffort(data.effort);
    showInterpretation(data.interpretation);
    command.value = '';
  } catch (error) {
    setPresence('Error', error?.message ?? String(error));
  } finally {
    sendButton.disabled = false;
  }
}

async function submitVoice(text) {
  const clean = text.trim();
  if (!clean) return;

  try {
    const response = await fetch('/api/voice/utterance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: voiceSessionId,
        text: clean,
        final: true,
        language: 'es-ES',
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'No se pudo procesar la voz');

    if (data.result?.kind === 'task' && data.result.runId) {
      activity.classList.remove('empty');
      activity.innerHTML = '';
      activateRun(data.result.runId);
    }
  } catch (error) {
    setPresence('Voz', error?.message ?? String(error));
  }
}

async function controlRun(action) {
  if (!currentRunId || !currentRunActive) return;
  const response = await fetch(`/api/runs/${encodeURIComponent(currentRunId)}/${action}`, { method: 'POST' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    setPresence('Control', data.error ?? 'No se pudo controlar la ejecución.');
  }
}

async function syncMicrophone(state) {
  try {
    await fetch('/api/voice/microphone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: voiceSessionId, state }),
    });
  } catch {
    // El fallback puede seguir intentando recuperar la conexión de voz.
  }
}

function voiceSocketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/api/voice/stream`;
}

async function connectPcmSocket() {
  const socket = new WebSocket(voiceSocketUrl());
  socket.binaryType = 'arraybuffer';
  voiceSocket = socket;
  socket.addEventListener('message', handleVoiceStreamMessage);
  socket.addEventListener('close', () => {
    if (voiceSocket === socket) voiceSocket = null;
    ttsPlayer.interrupt();
    pendingTtsAudioMeta = [];
    if (listening && voiceMode === 'pcm-stream') {
      void stopPcmVoice({ preserveMessage: true });
      setPresence('Voz desconectada', 'El canal de voz se cerró. La tarea activa sigue en Janus Core.');
    }
  });

  await waitForSocketOpen(socket);
  socket.send(JSON.stringify({
    type: 'hello',
    version: 1,
    sessionId: voiceSessionId,
    audio: { mimeType: PCM_MIME_TYPE },
  }));
  await waitForVoiceReady(socket);
  return socket;
}

function waitForSocketOpen(socket) {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tiempo agotado al abrir el canal de voz.')), 5000);
    const onOpen = () => {
      clearTimeout(timer);
      socket.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      clearTimeout(timer);
      socket.removeEventListener('open', onOpen);
      reject(new Error('No se pudo abrir el canal de voz.'));
    };
    socket.addEventListener('open', onOpen, { once: true });
    socket.addEventListener('error', onError, { once: true });
  });
}

function waitForVoiceReady(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener('message', onMessage);
      reject(new Error('Voice Gateway no confirmó disponibilidad.'));
    }, 5000);
    const onMessage = (event) => {
      if (typeof event.data !== 'string') return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'ready') {
        clearTimeout(timer);
        socket.removeEventListener('message', onMessage);
        resolve(message);
      } else if (message.type === 'error') {
        clearTimeout(timer);
        socket.removeEventListener('message', onMessage);
        reject(new Error(message.message ?? 'Voice Gateway no disponible.'));
      }
    };
    socket.addEventListener('message', onMessage);
  });
}

function handleVoiceStreamMessage(event) {
  if (typeof event.data !== 'string') {
    const meta = pendingTtsAudioMeta.shift();
    if (!meta || !(event.data instanceof ArrayBuffer)) return;
    void ttsPlayer.enqueue(event.data, meta.mimeType).catch((error) => {
      setPresence('Audio', error?.message ?? String(error));
    });
    return;
  }

  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }

  if (message.type === 'transcript.partial' && typeof message.text === 'string') {
    transcript.textContent = message.text;
    return;
  }
  if (message.type === 'transcript.final' && typeof message.text === 'string') {
    transcript.textContent = message.text;
    return;
  }
  if (message.type === 'session.action' && message.result?.kind === 'task' && message.result.runId) {
    activity.classList.remove('empty');
    activity.innerHTML = '';
    activateRun(message.result.runId);
    return;
  }
  if (message.type === 'speech.started') {
    ttsActive = true;
    setPresence('Janus hablando', 'Puedes interrumpir hablando; la tarea no se detendrá.');
    return;
  }
  if (message.type === 'speech.audio' && typeof message.mimeType === 'string') {
    pendingTtsAudioMeta.push({
      sequence: message.sequence,
      mimeType: message.mimeType,
      byteLength: message.byteLength,
    });
    return;
  }
  if (message.type === 'speech.interrupted') {
    ttsActive = false;
    ttsPlayer.interrupt();
    pendingTtsAudioMeta = [];
    if (listening) setPresence('Escuchando', 'Interrupción aplicada. Canal de voz activo.');
    return;
  }
  if (message.type === 'speech.completed') {
    ttsActive = false;
    if (listening) setPresence('Escuchando', 'Canal de voz activo.');
    return;
  }
  if (message.type === 'voice.error' || message.type === 'error') {
    setPresence('Voz', message.message ?? 'El canal de voz informó un error.');
  }
}

async function startPcmVoice() {
  if (pcmStarting || listening) return;
  pcmStarting = true;
  voiceButton.disabled = true;
  setPresence('Conectando voz', 'Abriendo canal PCM seguro con Janus Core…');

  try {
    const socket = await connectPcmSocket();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass({ sampleRate: 16000, latencyHint: 'interactive' });
    await audioContext.audioWorklet.addModule('/pcm-capture-worklet.js');

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    captureSource = audioContext.createMediaStreamSource(mediaStream);
    captureNode = new AudioWorkletNode(audioContext, 'janus-pcm-capture', {
      processorOptions: { targetSampleRate: 16000, frameMs: 20 },
    });
    muteNode = audioContext.createGain();
    muteNode.gain.value = 0;
    captureSource.connect(captureNode).connect(muteNode).connect(audioContext.destination);
    captureNode.port.onmessage = (event) => handlePcmFrame(event, socket);
    await audioContext.resume();

    listening = true;
    speechActive = false;
    speechFrames = 0;
    silenceFrames = 0;
    voiceButton.classList.add('listening');
    setPresence('Escuchando', 'PCM16 · 16 kHz · mono. La sesión permanece en Janus Core.');
  } catch (error) {
    await stopPcmVoice({ preserveMessage: true });
    setPresence('Voz', error?.message ?? String(error));
  } finally {
    pcmStarting = false;
    voiceButton.disabled = false;
  }
}

function handlePcmFrame(event, socket) {
  const data = event.data;
  if (!data || data.type !== 'pcm' || !(data.pcm instanceof ArrayBuffer)) return;
  if (!listening || socket.readyState !== WebSocket.OPEN) return;

  updateLocalVad(Number(data.rms), socket);
  socket.send(data.pcm);
}

function updateLocalVad(rms, socket) {
  const level = Number.isFinite(rms) ? rms : 0;
  if (!speechActive) {
    speechFrames = level >= VAD_START_RMS ? speechFrames + 1 : 0;
    if (speechFrames >= VAD_START_FRAMES) {
      speechActive = true;
      silenceFrames = 0;
      if (ttsActive) {
        ttsPlayer.interrupt();
        pendingTtsAudioMeta = [];
        setPresence('Interrumpiendo', 'Te escucho; corto la salida de voz y mantengo la tarea activa.');
      }
      socket.send(JSON.stringify({ type: 'speech.start' }));
    }
    return;
  }

  if (level <= VAD_END_RMS) {
    silenceFrames += 1;
  } else {
    silenceFrames = 0;
  }

  if (silenceFrames >= VAD_END_FRAMES) {
    speechActive = false;
    speechFrames = 0;
    silenceFrames = 0;
    socket.send(JSON.stringify({ type: 'speech.end' }));
  }
}

async function stopPcmVoice(options = {}) {
  listening = false;
  voiceButton.classList.remove('listening');

  const socket = voiceSocket;
  if (socket?.readyState === WebSocket.OPEN && speechActive) {
    socket.send(JSON.stringify({ type: 'speech.end' }));
  }
  speechActive = false;
  speechFrames = 0;
  silenceFrames = 0;
  ttsActive = false;
  ttsPlayer.interrupt();
  pendingTtsAudioMeta = [];

  captureNode?.disconnect();
  captureSource?.disconnect();
  muteNode?.disconnect();
  captureNode = null;
  captureSource = null;
  muteNode = null;

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) track.stop();
    mediaStream = null;
  }

  if (audioContext) {
    await audioContext.close().catch(() => undefined);
    audioContext = null;
  }

  if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'microphone paused');
  if (voiceSocket === socket) voiceSocket = null;

  if (!options.preserveMessage) {
    setPresence('Listo', 'Micrófono en pausa. La tarea activa puede seguir trabajando.');
  }
}

sendButton.addEventListener('click', () => submit(command.value));
command.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submit(command.value);
});

pauseButton.addEventListener('click', () => controlRun(paused ? 'resume' : 'pause'));
stopButton.addEventListener('click', () => controlRun('cancel'));

clearButton.addEventListener('click', () => {
  activity.classList.add('empty');
  activity.innerHTML = '<div class="empty-state">Vista limpia. El historial de ejecución sigue guardado en Janus Core.</div>';
});

function configureSpeechRecognition() {
  if (recognitionConfigured) return;
  recognitionConfigured = true;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceMode = 'text-only';
    transcript.textContent = 'El Voice Gateway local aún no está disponible y este navegador no ofrece fallback de reconocimiento. Puedes usar texto.';
    voiceButton.disabled = true;
    return;
  }

  voiceMode = 'browser-fallback';
  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    listening = true;
    void syncMicrophone('connected');
    voiceButton.classList.add('listening');
    setPresence('Escuchando', 'Fallback del navegador activo; Janus migrará a PCM local cuando el Voice Gateway esté disponible.');
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result[0].transcript.trim();
      if (result.isFinal) {
        transcript.textContent = text;
        void submitVoice(text);
      } else {
        interim += `${text} `;
      }
    }
    if (interim.trim()) transcript.textContent = interim.trim();
  };

  recognition.onerror = (event) => {
    if (event.error !== 'no-speech') {
      setPresence('Reconectando voz', `Micrófono: ${event.error}. Janus mantiene la ejecución activa.`);
    }
  };

  recognition.onend = () => {
    voiceButton.classList.remove('listening');
    if (listening) {
      try {
        recognition.start();
      } catch {
        listening = false;
        void syncMicrophone('disconnected');
      }
    } else {
      void syncMicrophone('disconnected');
    }
  };
}

voiceButton.addEventListener('click', () => {
  if (voiceMode === 'pcm-stream') {
    if (listening) {
      void stopPcmVoice();
    } else {
      void startPcmVoice();
    }
    return;
  }

  if (!recognition) return;
  if (listening) {
    listening = false;
    recognition.stop();
    voiceButton.classList.remove('listening');
    void syncMicrophone('disconnected');
    setPresence('Listo', 'Micrófono en pausa. La tarea activa puede seguir trabajando.');
  } else {
    listening = true;
    try {
      recognition.start();
    } catch {
      listening = false;
      setPresence('Voz', 'No se pudo abrir el micrófono. La ejecución de Janus sigue disponible por texto.');
    }
  }
});

void checkHealth();

// ---- Founder approvals (sensitive actions wait here for an explicit decision) ----
const approvalsList = document.querySelector('#approvalsList');
const approvalsStatus = document.querySelector('#approvalsStatus');
const approvalsBadge = document.querySelector('#approvalsBadge');
const founderLinkButton = document.querySelector('#founderLinkButton');
const founderSignInButton = document.querySelector('#founderSignInButton');
const founderSignOutButton = document.querySelector('#founderSignOutButton');
const founderKeyBox = document.querySelector('#founderKeyBox');
const founderKeyText = document.querySelector('#founderKeyText');
const founderKeyCopy = document.querySelector('#founderKeyCopy');
let deviceKey = null;
let approvalsTimer = 0;

function setApprovalsStatus(text) { approvalsStatus.textContent = text; }

async function refreshFounderControls() {
  deviceKey = await loadDeviceKey();
  const signedIn = Boolean(sessionToken());
  founderLinkButton.hidden = Boolean(deviceKey);
  founderSignInButton.hidden = !deviceKey || signedIn;
  founderSignOutButton.hidden = !signedIn;
  if (signedIn) { pollApprovals(); refreshToolSync(); }
  else { approvalsList.replaceChildren(); approvalsBadge.hidden = true; toolSyncBox.hidden = true; }
}

const toolSyncBox = document.querySelector('#toolSyncBox');
const toolSyncList = document.querySelector('#toolSyncList');
const toolSyncButton = document.querySelector('#toolSyncButton');
const toolSyncTitle = document.querySelector('#toolSyncTitle');
let toolSyncState = null;
let toolSyncArmed = false;

async function refreshToolSync() {
  if (!sessionToken()) { toolSyncBox.hidden = true; return; }
  try {
    const response = await fetch('/api/learning/blueprints/tool-sync', { cache: 'no-store' });
    const data = await response.json();
    toolSyncState = response.ok ? data : null;
  } catch { toolSyncState = null; }
  const additions = toolSyncState?.additions ?? [];
  toolSyncBox.hidden = additions.length === 0;
  if (additions.length === 0) return;
  const count = additions.reduce((total, item) => total + item.actions.length, 0);
  toolSyncTitle.textContent = `${count} acciones nuevas por permitir (revisión ${toolSyncState.activeRevision} → ${toolSyncState.activeRevision + 1})`;
  toolSyncList.replaceChildren(...additions.map((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.tool}: ${item.actions.join(', ')}`;
    return li;
  }));
  if (!toolSyncArmed) toolSyncButton.textContent = 'Permitir herramientas nuevas';
}

toolSyncButton.addEventListener('click', async () => {
  if (!toolSyncState) return;
  if (!toolSyncArmed) {
    toolSyncArmed = true;
    toolSyncButton.textContent = 'Confirmar: crear la nueva revisión';
    setApprovalsStatus('Revisa la lista y pulsa de nuevo para confirmar.');
    return;
  }
  toolSyncArmed = false;
  toolSyncButton.disabled = true;
  try {
    const response = await fetch('/api/learning/blueprints/tool-sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ confirmAction: 'apply_tool_catalog_revision', expectedRevision: toolSyncState.activeRevision }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    setApprovalsStatus(`Listo: revisión ${data.activeRevision} activa. Janus ya puede planificar con las herramientas nuevas.`);
  } catch (error) {
    setApprovalsStatus(`No se pudo crear la revisión: ${error?.message ?? error}`);
  } finally {
    toolSyncButton.disabled = false;
    refreshToolSync();
  }
});

function renderApprovals(pending) {
  approvalsBadge.hidden = pending.length === 0;
  approvalsBadge.textContent = String(pending.length);
  if (pending.length === 0) {
    approvalsList.replaceChildren();
    setApprovalsStatus('No hay acciones esperando tu decisión.');
    return;
  }
  setApprovalsStatus(pending.length === 1 ? '1 acción espera tu decisión.' : `${pending.length} acciones esperan tu decisión.`);
  approvalsList.replaceChildren(...pending.map((item) => {
    const li = document.createElement('li');
    li.className = 'approval-item';
    const title = document.createElement('strong');
    title.textContent = item.label;
    const meta = document.createElement('div');
    meta.className = 'approval-meta';
    const minutes = Math.max(0, Math.round((Date.parse(item.expiresAt) - Date.now()) / 60000));
    meta.textContent = [item.tool && item.operation ? `${item.tool}.${item.operation}` : null, item.reason, `riesgo ${RISK_LABELS[item.risk] ?? item.risk ?? '—'}`, item.reversible === false ? 'irreversible' : null, `caduca en ${minutes} min`].filter(Boolean).join(' · ');
    const actions = document.createElement('div');
    actions.className = 'approval-buttons';
    for (const [label, approved, kind] of [['Aprobar', true, 'primary'], ['Rechazar', false, 'secondary']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = kind;
      button.textContent = label;
      button.addEventListener('click', () => decideApproval(item.id, approved, actions));
      actions.append(button);
    }
    li.append(title, meta, actions);
    return li;
  }));
}

async function pollApprovals() {
  clearTimeout(approvalsTimer);
  if (!sessionToken()) return;
  try {
    const response = await fetch('/api/approvals', { headers: authHeaders(), cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      await signOut();
      setApprovalsStatus('Tu sesión de Founder caducó. Vuelve a entrar.');
      await refreshFounderControls();
      return;
    }
    const data = await response.json();
    if (response.ok) renderApprovals(data.pending ?? []);
  } catch {
    setApprovalsStatus('No se pudo consultar las aprobaciones; reintento en unos segundos.');
  }
  if (document.visibilityState === 'visible') approvalsTimer = setTimeout(pollApprovals, 4000);
}

async function decideApproval(id, approved, container) {
  for (const button of container.querySelectorAll('button')) button.disabled = true;
  try {
    const response = await fetch(`/api/approvals/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ approved }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    setApprovalsStatus(approved ? 'Aprobado. Janus continúa con la acción.' : 'Rechazado. Janus no ejecutará la acción.');
  } catch (error) {
    setApprovalsStatus(`No se pudo registrar la decisión: ${error?.message ?? error}`);
  }
  pollApprovals();
}

founderLinkButton.addEventListener('click', async () => {
  try {
    deviceKey = await createDeviceKey();
    founderKeyText.value = await devicePublicKeyPem(deviceKey);
    founderKeyBox.hidden = false;
    setApprovalsStatus('Llave creada en este dispositivo. Regístrala en Janus y luego entra como Founder.');
  } catch (error) {
    setApprovalsStatus(error?.message ?? String(error));
  }
  refreshFounderControls();
});
founderKeyCopy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(founderKeyText.value); setApprovalsStatus('Llave pública copiada.'); }
  catch { founderKeyText.select(); setApprovalsStatus('Selecciona y copia la llave manualmente.'); }
});
founderSignInButton.addEventListener('click', async () => {
  founderSignInButton.disabled = true;
  try {
    await signIn(deviceKey);
    setApprovalsStatus('Sesión de Founder iniciada en este dispositivo.');
  } catch (error) {
    setApprovalsStatus(error?.message ?? String(error));
    if (deviceKey) { founderKeyText.value = await devicePublicKeyPem(deviceKey); founderKeyBox.hidden = false; }
  } finally {
    founderSignInButton.disabled = false;
    refreshFounderControls();
  }
});
founderSignOutButton.addEventListener('click', async () => {
  await signOut();
  setApprovalsStatus('Sesión cerrada.');
  refreshFounderControls();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollApprovals(); });
refreshFounderControls();

mountGlowEmblem(document.querySelector('#janusEmblem'));
mountAppInstall({ appName: 'JANUS', iconSrc: '/icons/janus-icon-180.png', lang: document.documentElement.lang || 'es' });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
