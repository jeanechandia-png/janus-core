// Smoke de la plantilla laboral «JANUS Work» contra el runtime REAL (SQLite en memoria, sin red externa).
// Fase 1 (siempre): permisos y aislamiento por API con dos colaboradores (ES y NL) y el Founder.
// Fase 2 (si hay piel de IBA + Playwright): la página /work en un navegador real, con llave WebCrypto del
//         dispositivo, alta por el Founder con prueba biométrica, inicio de sesión, sesión de trabajo,
//         registro de avance y chat por proyecto. Sin piel: se comprueba que /work responde 503 (nunca otro diseño).
// Uso: node tests/work-runtime-smoke.mjs   [PLAYWRIGHT_MODULE=/ruta/playwright CHROME_PATH=/usr/bin/google-chrome]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const ecKeys = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const founderKeys = ecKeys(), faceKeys = ecKeys(), devKeys = ecKeys();
const skinPath = process.env.JANUS_WORK_SKIN_CSS || 'prototypes/dashboard/local/iba-command-center.css';
const hasSkin = existsSync(skinPath);
rmSync('prototypes/dashboard/dist/Janus-Work-core.html', { force: true }); // siempre se sirve el build de ESTE código

const child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], {
  cwd: process.cwd(),
  env: {
    ...process.env, PORT: String(port), JANUS_DB: ':memory:', JANUS_TIME_ZONE: 'Europe/Amsterdam',
    GOOGLE_ACCESS_TOKEN: '', THREADS_ACCESS_TOKEN: '', JANUS_CREDENTIAL_VAULT_KEY: randomBytes(32).toString('base64'), JANUS_CREDENTIAL_VAULT_PATH: '',
    GOOGLE_OAUTH_CLIENT_ID: '', GOOGLE_OAUTH_CLIENT_SECRET: '', THREADS_APP_SECRET: '', GITHUB_TOKEN: '', NETLIFY_AUTH_TOKEN: '',
    JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '', JANUS_WORK_OPERATOR_UPLOADS: '', JANUS_OPERATOR_DAILY_RUNS: '2', JANUS_RADAR_SOURCES: JSON.stringify([{ id: 'caida', provider: 'Proveedor', label: 'Fuente caída', url: 'https://radar-fuente.invalid/news' }]), JANUS_RADAR_INTERVAL_MIN: '', JANUS_PUSH_VAPID_PRIVATE_KEY: randomBytes(32).toString('base64url'), JANUS_INTERNAL_RECIPIENTS: 'ceo:CEO,empresa:Empresa',
    JANUS_ALLOW_PASSKEY_BOOTSTRAP: 'true',
    JANUS_FOUNDER_PUBLIC_KEY_PEM: founderKeys.publicKey, JANUS_FOUNDER_BIOMETRIC_PUBLIC_KEY_PEM: faceKeys.publicKey, JANUS_FOUNDER_BIOMETRIC_KEY_ID: 'smoke-face-key',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
let devResourceId = '';
let agendaPrivateId = '';
const checks = [];
const ok = (name) => { checks.push(name); };

try {
  await waitForJson(`${base}/health`, 15_000);
  const founder = await authenticate('founder', founderKeys.privateKey);

  // ── Preparación por el Founder ────────────────────────────────────────────────────────────────
  for (const [id, label] of [['scope-api', 'API'], ['scope-nl', 'Acquisitie NL']]) await call('POST', '/api/coordination/scopes', founder, { id, label, classification: 'project' }, 201);
  await delegate(founder, { principalId: 'colab-dev', displayName: 'Persona Dev', publicKeyPem: devKeys.publicKey, locale: 'es' });
  await call('POST', '/api/coordination/grants', founder, { principalId: 'colab-dev', scopeId: 'scope-api', permissions: ['read_context', 'write_work', 'handoff'] }, 201);
  await call('POST', '/api/projects', founder, { id: 'p-api', name: 'Proyecto API', description: 'API de prueba', instructions: 'TypeScript estricto.', coordinationScopeId: 'scope-api' }, 201);
  await call('POST', '/api/projects', founder, { id: 'p-nl', name: 'Acquisitie Nederland', coordinationScopeId: 'scope-nl' }, 201);
  await call('POST', '/api/projects', founder, { id: 'p-privado', name: 'Privado del Founder', instructions: 'SECRETO-FOUNDER' }, 201);
  await call('POST', '/api/coordination/assignments', founder, { id: 'as-dev-1', title: 'Listado con permisos', goal: 'Exponer el listado', assigneePrincipalId: 'colab-dev', scopeIds: ['scope-api'], priority: 'high', nextActions: ['Paginar'] }, 201);
  const dev = await authenticate('colab-dev', devKeys.privateKey);

  // ── Perfil laboral: solo el Founder fija identidad, funciones e instrucciones ─────────────────
  const profile = await call('PUT', '/api/coordination/operators/colab-dev/profile', founder, { roleTitle: 'Desarrollo de API', functions: ['Backend', 'Pruebas'], instructions: 'Nada crítico queda solo en tu equipo.', role: 'founder_director' }, 200);
  assert.equal(profile.profile.roleTitle, 'Desarrollo de API'); assert.equal(profile.profile.role, undefined);
  await call('PUT', '/api/coordination/operators/colab-dev/profile', dev, { instructions: 'Me autorizo a todo' }, 403);
  await call('PUT', '/api/coordination/operators/no-existe/profile', founder, { roleTitle: 'x' }, 404);
  await call('PUT', '/api/coordination/operators/colab-dev/profile', founder, { locale: 'tr' }, 400);
  ok('perfil laboral solo editable por el Founder');

  // ── Dashboard del colaborador: solo lo suyo ───────────────────────────────────────────────────
  await call('GET', '/api/dashboard/work', null, undefined, 401);
  await call('GET', '/api/dashboard/work', founder, undefined, 403); // el Founder tiene su propia dashboard
  let dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.equal(dash.templateId, 'janus-work-v1'); assert.equal(dash.skinSource, 'iba-command-center');
  assert.equal(dash.locale, 'es'); assert.equal(dash.profile.displayName, 'Persona Dev');
  assert.deepEqual(dash.profile.functions, ['Backend', 'Pruebas']);
  assert.deepEqual(dash.projects.map((p) => p.id), ['p-api']);
  assert.equal(dash.projects[0].instructions, 'TypeScript estricto.'); assert.equal(dash.projects[0].canWrite, true);
  assert.deepEqual(dash.assignments.map((a) => a.assignment.id), ['as-dev-1']);
  assert.equal(dash.capabilities.voice, false); assert.equal(dash.capabilities.uploadAttachments, true);
  assert.doesNotMatch(JSON.stringify(dash), /SECRETO-FOUNDER|p-privado|p-nl/);
  ok('dashboard acotada a proyectos y tareas propios');

  // ── Lo reservado al CEO sigue cerrado para el colaborador ─────────────────────────────────────
  await call('PUT', '/api/projects/p-api/instructions', dev, { instructions: 'cambio no autorizado' }, 403);
  await call('GET', '/api/projects/p-privado/context', dev, undefined, 403);
  await call('GET', '/api/projects/p-nl/context', dev, undefined, 403);
  await call('POST', '/api/coordination/grants', dev, { principalId: 'colab-dev', scopeId: 'scope-nl', permissions: ['read_context'] }, 403);
  await call('POST', '/api/coordination/assignments', dev, { title: 't', goal: 'g', assigneePrincipalId: 'colab-dev', scopeIds: ['scope-api'] }, 403);
  await call('POST', '/api/auth/operator/delegate', dev, { principalId: 'intruso', publicKeyPem: ecKeys().publicKey }, 403);
  const created = await call('POST', '/api/projects', dev, { id: 'p-dev-own', name: 'x', instructions: 'colada' }, null);
  if (created.ok) assert.equal(created.project.instructions, undefined, 'un colaborador no puede fijar instrucciones de proyecto');
  ok('instrucciones de proyecto, permisos, asignaciones y altas: solo CEO');

  // ── Idioma: configurable por la propia persona ────────────────────────────────────────────────
  await call('PUT', '/api/dashboard/work/locale', dev, { locale: 'xx' }, 400);
  await call('PUT', '/api/dashboard/work/locale', dev, { locale: 'en' }, 200);
  assert.equal((await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard.labels.title, 'Work dashboard');
  await call('PUT', '/api/dashboard/work/locale', dev, { locale: 'es' }, 200);
  await call('PUT', '/api/dashboard/work/locale', founder, { locale: 'nl' }, 403);
  ok('idioma configurable (es/nl/en)');

  // ── Sesiones de trabajo ───────────────────────────────────────────────────────────────────────
  const ev = (token, body, status) => call('POST', '/api/work/sessions/events', token, body, status);
  assert.equal((await ev(dev, { kind: 'pause' }, 409)).error, 'work_session_not_open');
  const started = await ev(dev, { kind: 'start', projectId: 'p-api', assignmentId: 'as-dev-1' }, 201);
  assert.equal(started.session.state, 'running'); assert.equal(started.session.projectId, 'p-api');
  assert.equal((await ev(dev, { kind: 'start' }, 409)).error, 'work_session_already_open');
  await ev(dev, { kind: 'start-ish' }, 400);
  await ev(dev, { kind: 'progress' }, 400); // sin nota
  await ev(dev, { kind: 'progress', note: 'x', projectId: 'p-privado' }, 403); // proyecto ajeno
  await ev(dev, { kind: 'progress', note: 'x', projectId: 'no-existe' }, 404);
  await ev(dev, { kind: 'progress', note: 'Filtro en verde', at: '2020-01-01T00:00:00Z' }, 201);
  await ev(dev, { kind: 'pause' }, 201);
  assert.equal((await ev(dev, { kind: 'pause' }, 409)).error, 'work_session_not_running');
  await ev(dev, { kind: 'resume' }, 201);
  const ended = await ev(dev, { kind: 'end' }, 201);
  assert.equal(ended.session.state, 'ended'); assert.equal(ended.session.pauses, 1);
  assert.ok(Date.parse(ended.session.startedAt) > Date.now() - 60_000, 'la hora la pone el servidor, no el cliente');
  assert.deepEqual(ended.session.progress.map((p) => p.note), ['Filtro en verde']);
  await ev(founder, { kind: 'start' }, 403);
  await ev(null, { kind: 'start' }, 401);
  ok('registro de sesión: transiciones, hora del servidor y acceso');

  // ── Archivos: el colaborador sube y descarga SOLO en sus proyectos (autorizado por el CEO, 10-nov) ──
  const put = (token, projectId, name, body, type = 'text/plain') => fetch(`${base}/api/work/attachments`, { method: 'POST', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': type, 'x-attachment-project-id': projectId, 'x-attachment-source': 'device-file', 'x-attachment-name': encodeURIComponent(name) }, body });
  const up = await put(dev, 'p-api', 'nota de obra.txt', 'contenido de prueba');
  assert.equal(up.status, 201);
  devResourceId = (await up.json()).projectResourceId;
  assert.equal((await put(dev, 'p-privado', 'x.txt', 'x')).status, 403, 'no sube a un proyecto ajeno');
  assert.equal((await put(dev, 'p-nl', 'x.txt', 'x')).status, 403);
  assert.equal((await put(null, 'p-api', 'x.txt', 'x')).status, 401);
  assert.equal((await put(founder, 'p-api', 'x.txt', 'x')).status, 403, 'esta puerta es de colaboradores; el Founder tiene la suya');
  assert.ok((await put(dev, 'p-api', 'virus.exe', 'MZ\u0090\u0000', 'application/x-msdownload')).status >= 400, 'tipos no permitidos se rechazan');
  assert.equal((await fetch(`${base}/api/attachments`, { method: 'POST', headers: { authorization: `Bearer ${dev}`, 'content-type': 'text/plain', 'x-attachment-source': 'device-file', 'x-attachment-name': 'nota.txt' }, body: 'hola' })).status, 403);
  dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  const listed = dash.projects.find((p) => p.id === 'p-api').resources.find((r) => r.id === devResourceId);
  assert.equal(listed?.viewable, true); assert.equal(listed?.addedBy, 'colab-dev'); assert.equal(dash.capabilities.uploadAttachments, true);
  assert.equal(dash.capabilities.downloadFiles, false); assert.equal(dash.capabilities.shareOutside, false);
  const file = (token, suffix = '') => fetch(`${base}/api/work/files/${devResourceId}${suffix}`, token ? { headers: { authorization: `Bearer ${token}` } } : {});
  // El colaborador NO descarga: solo abre dentro del panel, y cada apertura queda registrada.
  assert.equal((await file(dev)).status, 403, 'descarga reservada al CEO');
  const seen = await file(dev, '/view');
  assert.equal(seen.status, 200); assert.equal(await seen.text(), 'contenido de prueba');
  assert.match(seen.headers.get('content-disposition') || '', /^inline; /); assert.equal(seen.headers.get('x-content-type-options'), 'nosniff'); assert.equal(seen.headers.get('cache-control'), 'no-store');
  const owned = await file(founder);
  assert.equal(owned.status, 200, 'el CEO sí descarga lo que sube su equipo'); assert.match(owned.headers.get('content-disposition') || '', /^attachment; filename\*=UTF-8''nota/);
  assert.equal((await file(null, '/view')).status, 401); assert.equal((await file(null)).status, 401);
  assert.equal((await fetch(`${base}/api/work/files/resource_no_existe/view`, { headers: { authorization: `Bearer ${dev}` } })).status, 404);
  const access = await call('GET', '/api/work/file-access', founder, undefined, 200);
  assert.equal(access.entries.length, 1); assert.equal(access.entries[0].principalId, 'colab-dev'); assert.equal(access.entries[0].resourceId, devResourceId);
  await call('GET', '/api/work/file-access', dev, undefined, 403);
  ok('archivos: subir y VER solo en proyectos propios; sin descarga para colaboradores; aperturas registradas');

  // ── Agenda: lo personal es privado; el CEO solo ve lo de trabajo ──────────────────────────────
  const priv = await call('POST', '/api/work/agenda', dev, { date: '2026-12-01', time: '17:00', text: 'Recoger el coche' }, 201);
  assert.equal(priv.item.visibility, 'private');
  const avail = await call('POST', '/api/work/agenda', dev, { kind: 'availability', visibility: 'private', date: '2026-12-02', time: '09:00', endTime: '14:00' }, 201);
  assert.equal(avail.item.visibility, 'work', 'la disponibilidad siempre es de trabajo');
  const linked = await call('POST', '/api/work/agenda', dev, { date: '2026-12-03', text: 'Entregar paginación', projectId: 'p-api', visibility: 'private' }, 201);
  assert.equal(linked.item.visibility, 'work', 'lo ligado a un proyecto siempre es de trabajo');
  await call('POST', '/api/work/agenda', dev, { date: '2026-12-03', text: 'x', projectId: 'p-privado' }, 403);
  await call('POST', '/api/work/agenda', dev, { date: 'mañana', text: 'x' }, 400);
  await call('POST', '/api/work/agenda', founder, { date: '2026-12-03', text: 'x' }, 403);
  await call('POST', '/api/work/agenda', null, { date: '2026-12-03', text: 'x' }, 401);
  assert.equal((await call('GET', '/api/work/agenda', dev, undefined, 200)).items.length, 3);
  const founderAgenda = await call('GET', '/api/work/agenda', founder, undefined, 200);
  assert.equal(founderAgenda.scope, 'work-only'); assert.equal(founderAgenda.items.length, 2);
  assert.doesNotMatch(JSON.stringify(founderAgenda), /Recoger el coche/, 'el CEO no recibe lo privado');
  assert.equal((await call('PUT', `/api/work/agenda/${priv.item.id}`, dev, { done: true }, 200)).item.done, true);
  agendaPrivateId = priv.item.id;
  dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.equal(dash.agenda.length, 3);
  ok('agenda: recordatorios privados, disponibilidad y proyecto visibles para el CEO');

  // ── Mensajes internos: nada sale de la empresa ────────────────────────────────────────────────
  const sentMsg = await call('POST', '/api/work/messages', dev, { recipient: 'ceo', subject: 'Necesito acceso', body: 'Para las pruebas E2E.', projectId: 'p-api' }, 201);
  assert.equal(sentMsg.message.status, 'delivered');
  const outside = await call('POST', '/api/work/messages', dev, { recipient: 'mi.correo@gmail.com', subject: 'Reenviarme la oferta', body: 'x' }, 422);
  assert.equal(outside.code, 'recipient_outside_company'); assert.doesNotMatch(JSON.stringify(outside), /gmail/);
  await call('POST', '/api/work/messages', dev, { recipient: 'ceo', subject: 'x', body: 'x', projectId: 'p-privado' }, 403);
  await call('POST', '/api/work/messages', dev, { recipient: 'ceo', subject: '', body: 'x' }, 400);
  await call('POST', '/api/work/messages', founder, { recipient: 'ceo', subject: 'x', body: 'x' }, 403);
  assert.equal((await call('GET', '/api/work/messages', dev, undefined, 200)).messages.length, 2);
  await call('PUT', `/api/work/messages/${sentMsg.message.id}/read`, dev, {}, 404); // solo lo lee quien lo recibe
  assert.ok((await call('PUT', `/api/work/messages/${sentMsg.message.id}/read`, founder, {}, 200)).message.readAt);
  dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.deepEqual(dash.messaging.recipients.map((r) => r.id), ['ceo', 'empresa']); assert.equal(dash.messaging.sent.length, 2);
  ok('mensajes internos: entregados al CEO; destino externo rechazado sin molestar a nadie');

  // ── Proyecto propio del colaborador y «solo modelo propio» ────────────────────────────────────
  const ownProject = await call('POST', '/api/projects', dev, { name: 'Idea de mejora', description: 'Propuesta propia' }, 201);
  dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.equal(dash.projects.find((p) => p.id === ownProject.project.id)?.ownedByMe, true);
  assert.equal((await put(dev, ownProject.project.id, 'boceto.txt', 'idea')).status, 201, 'adjunta archivos a su propio proyecto');
  await call('GET', `/api/projects/${ownProject.project.id}/context`, founder, undefined, 200); // el CEO lo ve desde el primer momento
  await call('PUT', '/api/projects/p-api/model-policy', dev, { modelPolicy: 'local_only' }, 403);
  await call('PUT', '/api/projects/p-api/model-policy', founder, { modelPolicy: 'otra' }, 400);
  const policy = await call('PUT', '/api/projects/p-api/model-policy', founder, { modelPolicy: 'local_only' }, 200);
  assert.equal(policy.project.modelPolicy, 'local_only'); assert.equal(policy.localModelConfigured, false);
  dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.equal(dash.projects.find((p) => p.id === 'p-api').localOnly, true);
  ok('proyecto propio visible para el CEO; «solo modelo propio» lo fija solo el CEO');

  // ── Avisos al teléfono ────────────────────────────────────────────────────────────────────────
  const pushInfo = await call('GET', '/api/work/push', dev, undefined, 200);
  assert.equal(pushInfo.enabled, true); assert.equal(Buffer.from(pushInfo.publicKey, 'base64url').length, 65);
  const deviceKeys = { p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString('base64url'), auth: randomBytes(16).toString('base64url') };
  await call('POST', '/api/work/push/subscription', dev, { endpoint: 'https://evil.example/push', keys: deviceKeys }, 400);
  await call('POST', '/api/work/push/subscription', dev, { endpoint: 'http://127.0.0.1:1/push', keys: deviceKeys }, 400);
  await call('POST', '/api/work/push/subscription', dev, { endpoint: 'https://web.push.apple.com/dispositivo-1', keys: deviceKeys }, 201);
  assert.equal((await call('GET', '/api/work/push', dev, undefined, 200)).devices, 1);
  await call('GET', '/api/work/push', founder, undefined, 403);
  await call('DELETE', '/api/work/push/subscription', dev, { endpoint: 'https://web.push.apple.com/dispositivo-1' }, 200);
  assert.equal((await call('GET', '/api/work/push', dev, undefined, 200)).devices, 0);
  const sw = await fetch(`${base}/work-sw.js`);
  assert.equal(sw.status, 200); assert.match(sw.headers.get('content-type') || '', /javascript/); assert.match(await sw.text(), /addEventListener\('push'/);
  ok('avisos: suscripción solo a servicios conocidos, alta y baja del propio dispositivo');

  // ── Vista de equipo del CEO ───────────────────────────────────────────────────────────────────
  await call('GET', '/api/work/team', dev, undefined, 403); await call('GET', '/api/work/team', null, undefined, 401);
  const team = await call('GET', '/api/work/team', founder, undefined, 200);
  assert.ok(team.members.some((m) => m.principalId === 'colab-dev' && m.roleTitle === 'Desarrollo de API'));
  assert.ok(team.assignments.some((a) => a.assignment.id === 'as-dev-1'));
  assert.equal(team.messages.length, 2); assert.ok(team.fileAccess.length >= 1); assert.ok(team.projects.some((p) => p.id === ownProject.project.id && p.createdBy === 'colab-dev'));
  assert.ok(team.agenda.length >= 2); assert.ok(team.agenda.every((item) => item.visibility === 'work'));
  assert.doesNotMatch(JSON.stringify(team), /Recoger el coche/, 'la agenda privada nunca llega a la vista de equipo');
  ok('vista de equipo: solo CEO y solo asuntos de empresa');

  // ── Lucecitas «Mi equipo» (presencia) ─────────────────────────────────────────────────────────
  await call('GET', '/api/work/team/presence', dev, undefined, 403); await call('GET', '/api/work/team/presence', null, undefined, 401);
  await call('POST', '/api/work/presence', founder, {}, 403); await call('POST', '/api/work/presence', null, {}, 401);
  assert.equal((await call('POST', '/api/work/presence', dev, {}, 200)).intervalSeconds, 30);
  const lights = await call('GET', '/api/work/team/presence', founder, undefined, 200);
  const devLight = lights.members.find((m) => m.principalId === 'colab-dev');
  assert.ok(devLight && ['online', 'working', 'paused'].includes(devLight.state), 'quien acaba de usar su panel aparece encendido: ' + devLight?.state);
  assert.ok(devLight.seenSecondsAgo !== null && devLight.seenSecondsAgo <= 5);
  for (const m of lights.members) assert.deepEqual(Object.keys(m).sort(), ['displayName', 'principalId', 'roleTitle', 'seenSecondsAgo', 'sessionSince', 'state']);
  assert.equal(typeof lights.attention.blocked, 'number'); assert.equal(typeof lights.attention.unread, 'number');
  assert.doesNotMatch(JSON.stringify(lights), /Recoger el coche|agenda|messages/, 'solo nombres, estado y contadores');
  assert.equal(team.members.find((m) => m.principalId === 'colab-dev').presence !== undefined, true);
  ok('lucecitas Mi equipo: solo CEO, presencia real del panel y nada más que nombre y estado');

  // ── Avance/entrega (handoff) y chat por proyecto ──────────────────────────────────────────────
  await call('POST', '/api/coordination/assignments/as-dev-1/handoffs', dev, { executiveSummary: 'Listado listo', completed: ['Filtro'], pending: ['Paginación'], evidenceRefs: ['commit abc'] }, 201);
  dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.equal(dash.deliveries.length, 1); assert.equal(dash.deliveries[0].executiveSummary, 'Listado listo');
  assert.equal(dash.sessions.recent.length, 1); assert.equal(dash.sessions.open, null);
  const thread = await call('POST', '/api/projects/p-api/threads', dev, { title: 'Chat de trabajo' }, 201);
  const command = await call('POST', '/api/command', dev, { text: 'resume el estado del proyecto', projectId: 'p-api', threadId: thread.thread.id, assignmentId: 'as-dev-1' }, 202);
  assert.equal(command.authenticatedPrincipal, 'colab-dev'); assert.equal(command.projectId, 'p-api');
  await call('POST', '/api/command', dev, { text: 'hola', projectId: 'p-privado', threadId: thread.thread.id }, 404);
  await call('POST', '/api/projects/p-nl/threads', dev, { title: 'intruso' }, 403);
  ok('avances/entregas y chat con contexto de proyecto');

  // ── Delegación por tarea (agente) y límite diario de consultas ────────────────────────────────
  await call('PUT', '/api/coordination/assignments/as-dev-1/provider', dev, { preferredProvider: 'anthropic' }, 403);
  await call('PUT', '/api/coordination/assignments/as-dev-1/provider', founder, { preferredProvider: 'skynet' }, 400);
  await call('PUT', '/api/coordination/assignments/no-existe/provider', founder, { preferredProvider: 'gemini' }, 404);
  const routed = await call('PUT', '/api/coordination/assignments/as-dev-1/provider', founder, { preferredProvider: 'anthropic' }, 200);
  assert.equal(routed.assignment.preferredProvider, 'anthropic');
  assert.equal(routed.configured, false, 'sin credencial configurada se dice la verdad: preferencia guardada pero inactiva');
  dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.equal(dash.assignments[0].assignment.preferredProvider, 'anthropic');
  assert.deepEqual(dash.usage, { used: 1, limit: 2, remaining: 1 });
  await call('POST', '/api/command', dev, { text: 'siguiente paso', projectId: 'p-api', threadId: thread.thread.id, assignmentId: 'as-dev-1' }, 202);
  const limited = await call('POST', '/api/command', dev, { text: 'otra más', projectId: 'p-api', threadId: thread.thread.id }, 429);
  assert.equal(limited.code, 'operator_daily_limit'); assert.equal(limited.usage.remaining, 0);
  await call('POST', '/api/command', founder, { text: 'estado' }, 202); // el Founder no tiene este límite
  const cleared = await call('PUT', '/api/coordination/assignments/as-dev-1/provider', founder, { preferredProvider: null }, 200);
  assert.equal(cleared.assignment.preferredProvider, undefined);
  ok('agente por tarea (solo CEO) y límite diario de consultas por colaborador');

  // ── El CEO se comunica con su equipo: mensajes, respuestas, archivos y tareas ─────────────────
  const peerKeys = ecKeys();
  await delegate(founder, { principalId: 'colab-peer', displayName: 'Persona Par', publicKeyPem: peerKeys.publicKey, locale: 'es' });
  const peer = await authenticate('colab-peer', peerKeys.privateKey);
  await call('POST', '/api/work/team/messages', dev, { toPrincipalId: 'colab-peer', subject: 'x', body: 'x' }, 403);
  await call('POST', '/api/work/team/messages', null, { toPrincipalId: 'colab-dev', subject: 'x', body: 'x' }, 401);
  await call('POST', '/api/work/team/messages', founder, { toPrincipalId: 'no-existe', subject: 'x', body: 'x' }, 404);
  await call('POST', '/api/work/team/messages', founder, { toPrincipalId: 'colab-dev', subject: '', body: 'x' }, 400);
  const sent = (await call('POST', '/api/work/team/messages', founder, { toPrincipalId: 'colab-dev', subject: 'Prioridad', body: 'Primero la paginación.' }, 201)).message;
  assert.equal(sent.toPrincipalId, 'colab-dev'); assert.equal(sent.status, 'delivered');
  let devBox = await call('GET', '/api/work/messages', dev, undefined, 200);
  assert.equal(devBox.inbox.length, 1); assert.equal(devBox.inbox[0].body, 'Primero la paginación.');
  assert.equal((await call('GET', '/api/work/messages', peer, undefined, 200)).inbox.length, 0, 'otra persona no ve ese mensaje');
  assert.equal((await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard.messaging.inbox.length, 1);
  assert.equal((await call('GET', '/api/dashboard/work', peer, undefined, 200)).dashboard.messaging.inbox.length, 0);
  await call('PUT', `/api/work/messages/${sent.id}/read`, peer, undefined, 404);
  await call('PUT', `/api/work/messages/${sent.id}/read`, founder, undefined, 404);
  assert.ok((await call('PUT', `/api/work/messages/${sent.id}/read`, dev, undefined, 200)).message.readAt);
  // Lo enviado por el CEO no cuenta como «nuevo» para él.
  const before = (await call('GET', '/api/work/team/presence', founder, undefined, 200)).attention.unread;
  const fromDev = (await call('POST', '/api/work/messages', dev, { recipient: 'ceo', subject: 'Duda', body: '¿Paginamos de 20 en 20?' }, 201)).message;
  assert.equal((await call('GET', '/api/work/team/presence', founder, undefined, 200)).attention.unread, before + 1);
  await call('POST', '/api/work/team/messages', founder, { toPrincipalId: 'colab-peer', subject: 'Re', body: 'x', replyToId: fromDev.id }, 404);
  const reply = (await call('POST', '/api/work/team/messages', founder, { toPrincipalId: 'colab-dev', subject: 'Re: Duda', body: 'Sí, de 20.', replyToId: fromDev.id }, 201)).message;
  assert.equal(reply.replyToId, fromDev.id);
  assert.equal((await call('GET', '/api/work/team/presence', founder, undefined, 200)).attention.unread, before, 'responder marca el original como leído');
  // Archivos: el CEO sube al proyecto y los adjunta; la persona los ve dentro de su panel.
  const upCeo = (token, projectId, name, body) => fetch(`${base}/api/work/team/attachments`, { method: 'POST', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'text/plain', 'x-attachment-project-id': projectId, 'x-attachment-source': 'device-file', 'x-attachment-name': encodeURIComponent(name) }, body });
  assert.equal((await upCeo(dev, 'p-api', 'x.txt', 'x')).status, 403); assert.equal((await upCeo(founder, 'no-existe', 'x.txt', 'x')).status, 404);
  const upRes = await upCeo(founder, 'p-api', 'instrucciones.txt', 'Paso 1. Paso 2.'); assert.equal(upRes.status, 201);
  const upBody = await upRes.json();
  const withFile = (await call('POST', '/api/work/team/messages', founder, { toPrincipalId: 'colab-dev', subject: 'Instrucciones', body: '', projectId: 'p-api', resourceIds: [upBody.projectResourceId] }, 201)).message;
  assert.deepEqual(withFile.attachments, [{ resourceId: upBody.projectResourceId, name: 'instrucciones.txt' }]);
  const ceoFile = await fetch(`${base}/api/work/files/${upBody.projectResourceId}/view`, { headers: { authorization: `Bearer ${dev}` } });
  assert.equal(ceoFile.status, 200); assert.equal(await ceoFile.text(), 'Paso 1. Paso 2.');
  await call('POST', '/api/work/team/messages', founder, { toPrincipalId: 'colab-peer', subject: 'x', body: 'x', projectId: 'p-api', resourceIds: [upBody.projectResourceId] }, 409); // no tiene ese proyecto
  await call('POST', '/api/work/team/messages', founder, { toPrincipalId: 'colab-dev', subject: 'x', body: 'x', resourceIds: [upBody.projectResourceId] }, 400);
  // Tareas: al darla en un proyecto, la persona recibe acceso SOLO a ese proyecto.
  await call('POST', '/api/work/team/tasks', dev, { assigneePrincipalId: 'colab-peer', projectId: 'p-api', title: 'x', goal: 'x' }, 403);
  await call('POST', '/api/work/team/tasks', founder, { assigneePrincipalId: 'colab-peer', projectId: 'p-api', title: '', goal: 'x' }, 400);
  await call('POST', '/api/projects', founder, { id: 'p-fotos', name: 'Fotos de obra' }, 201);
  assert.deepEqual((await call('GET', '/api/dashboard/work', peer, undefined, 200)).dashboard.projects, []);
  const task = await call('POST', '/api/work/team/tasks', founder, { assigneePrincipalId: 'colab-peer', projectId: 'p-fotos', title: 'Fotos de la fachada', goal: 'Diez fotos, horizontales, antes del viernes.', priority: 'high' }, 201);
  assert.equal(task.accessGranted, true); assert.equal(task.assignment.status, 'queued');
  const peerDash = (await call('GET', '/api/dashboard/work', peer, undefined, 200)).dashboard;
  assert.deepEqual(peerDash.projects.map((p) => p.id), ['p-fotos'], 'acceso solo al proyecto de la tarea');
  assert.deepEqual(peerDash.assignments.map((a) => a.assignment.title), ['Fotos de la fachada']);
  assert.doesNotMatch(JSON.stringify(peerDash), /SECRETO-FOUNDER|p-privado|Proyecto API/);
  assert.equal((await call('POST', '/api/work/team/tasks', founder, { assigneePrincipalId: 'colab-peer', projectId: 'p-fotos', title: 'Retoque', goal: 'Ajustar luz.' }, 201)).accessGranted, false);
  const teamNow = await call('GET', '/api/work/team', founder, undefined, 200);
  assert.deepEqual(teamNow.members.find((m) => m.principalId === 'colab-peer').projects, [{ id: 'p-fotos', name: 'Fotos de obra' }]);
  ok('el CEO escribe, responde, envía archivos y da tareas; cada persona ve solo lo suyo');

  // ── Opportunity Radar (incidencia JANUS-OPPORTUNITY-20261110) ─────────────────────────────────
  await call('GET', '/api/radar', dev, undefined, 403); await call('GET', '/api/radar', null, undefined, 401);
  let radar = await call('GET', '/api/radar', founder, undefined, 200);
  const seeded = radar.opportunities.find((o) => o.id === 'opp_fable52_pro_launch');
  assert.ok(seeded, 'la oportunidad de referencia queda registrada');
  assert.equal(seeded.verification, 'pending', 'no se da por verificada sin leer la fuente oficial'); assert.equal(seeded.stage, 'used');
  assert.equal(seeded.late.late, true);
  assert.deepEqual(radar.incidents.map((i) => i.id), ['JANUS-OPPORTUNITY-20261110']); assert.match(radar.incidents[0].cause, /POR CONFIRMAR/);
  assert.equal(radar.quotas.length, 2); assert.ok(radar.quotas.every((q) => q.verified === false), 'los cupos son datos declarados');
  assert.equal(radar.monitor.enabled, false, 'el monitor no se declara operativo sin intervalo configurado'); assert.match(radar.monitor.reason, /desactivado/);
  const far = new Date(Date.now() + 20 * 86400000).toISOString(), soon = new Date(Date.now() + 30 * 3600000).toISOString();
  await call('POST', '/api/radar/opportunities', dev, { provider: 'OpenAI', title: 'Créditos de lanzamiento' }, 403);
  await call('POST', '/api/radar/opportunities', founder, { provider: '', title: 'x' }, 400);
  await call('POST', '/api/radar/opportunities', founder, { provider: 'OpenAI', title: 'Créditos', verification: 'verified' }, 400);
  const made = await call('POST', '/api/radar/opportunities', founder, { provider: 'OpenAI', title: 'Créditos de lanzamiento para la API', kind: 'credits', expiresAt: far, projects: ['IBA'], benefit: 4 }, 201);
  assert.equal(made.duplicate, false); assert.equal(made.opportunity.verification, 'pending');
  const dup = await call('POST', '/api/radar/opportunities', founder, { provider: 'openai', title: 'Créditos de LANZAMIENTO — para la API', expiresAt: far }, 200);
  assert.equal(dup.duplicate, true); assert.deepEqual(dup.changed, []); assert.equal(dup.opportunity.id, made.opportunity.id);
  const moved = await call('POST', '/api/radar/opportunities', founder, { provider: 'OpenAI', title: 'Créditos de lanzamiento para la API', expiresAt: soon, conditions: 'Solo cuentas nuevas' }, 200);
  assert.deepEqual(moved.changed.sort(), ['conditions', 'expiresAt']);
  radar = await call('GET', '/api/radar', founder, undefined, 200);
  assert.equal(radar.opportunities.filter((o) => o.provider === 'OpenAI').length, 1, 'sin duplicados');
  assert.ok(radar.alerts.some((a) => a.opportunityId === made.opportunity.id && a.key === 'expires-72h'), 'alerta por vencimiento próximo');
  const oid = made.opportunity.id;
  await call('PUT', `/api/radar/opportunities/${oid}/verify`, founder, {}, 400);
  assert.equal((await call('PUT', `/api/radar/opportunities/${oid}/verify`, founder, { sourceUrl: 'https://openai.com/news/' }, 200)).opportunity.verification, 'verified');
  await call('PUT', `/api/radar/opportunities/${oid}/stage`, founder, { stage: 'dismissed' }, 400);
  await call('PUT', `/api/radar/opportunities/${oid}/stage`, founder, { stage: 'activated' }, 200);
  await call('PUT', `/api/radar/opportunities/${oid}/stage`, founder, { stage: 'detected' }, 400);
  await call('PUT', `/api/radar/opportunities/no-existe/stage`, founder, { stage: 'used' }, 404);
  assert.equal((await call('PUT', `/api/radar/opportunities/${oid}/stage`, founder, { stage: 'finished' }, 200)).opportunity.stage, 'finished');
  await call('POST', '/api/radar/quotas', founder, { account: 'Cuenta', label: 'Semanal', usedPercent: 130 }, 400);
  const quota = (await call('POST', '/api/radar/quotas', founder, { account: 'Cuenta de prueba', label: 'Cupo semanal', kind: 'weekly', usedPercent: 40, resetsAt: far, verified: true }, 200)).quota;
  assert.equal(quota.usedPercent, 40); await call('DELETE', `/api/radar/quotas/${quota.id}`, founder, undefined, 200); await call('DELETE', `/api/radar/quotas/${quota.id}`, founder, undefined, 404);
  await call('POST', '/api/radar/run', dev, {}, 403);
  const run = (await call('POST', '/api/radar/run', founder, {}, 200)).report;
  assert.deepEqual(run.summary, { sources: 1, reachable: 0, created: 0, updated: 0, read: 0, failed: 1 }, 'fuente inaccesible: se informa, no se inventa');
  radar = await call('GET', '/api/radar', founder, undefined, 200);
  assert.equal(radar.monitor.sources[0].state.ok, false); assert.equal(radar.monitor.sources[0].state.consecutiveFailures, 1);
  // Lo existente sigue igual: equipo y panel del colaborador responden como antes.
  await call('GET', '/api/work/team', founder, undefined, 200); await call('GET', '/api/dashboard/work', dev, undefined, 200);
  ok('Opportunity Radar: solo CEO, incidencia registrada, sin duplicados, cambios de condiciones, cupos, fuente caída y monitor apagado dicho con verdad');

  // ── Arquitectura anti-obsolescencia: memoria, servicios por especificación, puerta humana y sandbox ──────────
  // Pilar 3 · memoria
  await call('GET', '/api/memory/status', dev, undefined, 403); await call('POST', '/api/memory', dev, { text: 'x' }, 403);
  const memStatus = await call('GET', '/api/memory/status', founder, undefined, 200);
  assert.equal(memStatus.consultedBeforePlanning, true); assert.match(memStatus.embedder, /local/i, 'sin modelo de embeddings configurado se dice');
  await call('POST', '/api/memory', founder, { text: '   ' }, 400);
  const rule = await call('POST', '/api/memory', founder, { kind: 'rule', scope: 'work', text: 'Las facturas de proveedores se revisan los viernes antes de pagar.' }, 201);
  assert.equal((await call('POST', '/api/memory', founder, { kind: 'rule', scope: 'work', text: 'Las facturas de proveedores se revisan los viernes antes de pagar.' }, 200)).created, false, 'sin duplicados');
  await call('POST', '/api/memory', founder, { kind: 'rule', scope: 'family', text: 'Las facturas del colegio se pagan el día cinco.' }, 201);
  const hits = (await call('GET', '/api/memory/search?q=' + encodeURIComponent('cuándo reviso las facturas de proveedores'), founder, undefined, 200)).hits;
  assert.equal(hits[0].id, rule.item.id); assert.ok(hits.every((h) => h.scope === 'work'), 'lo familiar no entra en una consulta laboral');
  const sync = await call('POST', '/api/memory/sync', founder, {}, 200);
  assert.ok(sync.lessons >= 1, 'las lecciones de errores pasan a la memoria');
  assert.ok((await call('GET', '/api/memory/search?q=' + encodeURIComponent('oportunidad promoción detectada tarde'), founder, undefined, 200)).hits.some((h) => h.source === 'lesson:JANUS-OPPORTUNITY-20261110'));
  // Pilar 1 · un servicio nuevo entra por su especificación, sin código a medida
  const spec = { openapi: '3.0.3', info: { title: 'Servicio de prueba', version: '1.0' }, servers: [{ url: 'https://servicio-de-prueba.invalid/v1' }], paths: {
    '/items': { get: { operationId: 'listItems', summary: 'List items', parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }] }, post: { operationId: 'createItem', summary: 'Create an item', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } } } },
    '/items/{id}': { delete: { operationId: 'deleteItem', summary: 'Delete an item', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] } } } };
  await call('POST', '/api/integrations', dev, { service: 'prueba', document: spec }, 403);
  await call('POST', '/api/integrations', founder, { service: 'prueba', document: { openapi: '3.0.3', info: {}, servers: [{ url: 'http://inseguro.invalid' }], paths: {} } }, 422);
  const reg = await call('POST', '/api/integrations', founder, { service: 'prueba', document: spec }, 201);
  assert.equal(reg.operations, 3);
  const listedSvc = (await call('GET', '/api/integrations', founder, undefined, 200)).integrations.find((x) => x.service === 'prueba');
  assert.deepEqual(listedSvc.levels, { auto: 1, approval: 1, restricted: 1 }, 'lectura automática, escritura con aprobación, borrado restringido');
  const ops = (await call('GET', '/api/integrations/prueba/operations?q=' + encodeURIComponent('borrar item delete'), founder, undefined, 200)).operations;
  assert.equal(ops[0].id, 'deleteItem'); assert.equal(ops[0].risk, 'restricted'); assert.equal(ops[0].effectiveRisk, 'restricted');
  await call('POST', '/api/integrations/prueba/call', founder, { operation: 'noExiste' }, 404);
  const read = await call('POST', '/api/integrations/prueba/call', founder, { operation: 'listItems', args: { limit: 5 } }, 200);
  assert.equal(read.level, 'auto'); assert.equal(read.ok, false, 'el host de prueba no existe: se informa el fallo, no se inventa una respuesta');
  // Pilar 4 · una operación destructiva queda en pausa hasta la decisión del CEO
  const del = await call('POST', '/api/integrations/prueba/call', founder, { operation: 'deleteItem', args: { id: '7' } }, 202);
  assert.equal(del.status, 'pending_approval'); assert.equal(del.level, 'restricted'); assert.match(del.approvalId, /^approval_/);
  assert.equal((await call('GET', `/api/integration-calls/${del.callId}`, founder, undefined, 200)).call.status, 'pending_approval');
  const queued = (await call('GET', '/api/approvals', founder, undefined, 200)).pending.find((a) => a.id === del.approvalId);
  assert.equal(queued.risk, 'critical'); assert.equal(queued.operation, 'prueba.deleteItem');
  await call('POST', `/api/approvals/${del.approvalId}/decision`, dev, { approved: true }, 403);
  await call('POST', `/api/approvals/${del.approvalId}/decision`, founder, { approved: false, note: 'no borrar' }, 200);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal((await call('GET', `/api/integration-calls/${del.callId}`, founder, undefined, 200)).call.status, 'denied', 'denegado: no se ejecuta');
  const write = await call('POST', '/api/integrations/prueba/call', founder, { operation: 'createItem', args: { body: { name: 'a' } } }, 202);
  assert.equal(write.level, 'approval');
  await call('POST', `/api/approvals/${write.approvalId}/decision`, founder, { approved: true }, 200);
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(['failed', 'done', 'running'].includes((await call('GET', `/api/integration-calls/${write.callId}`, founder, undefined, 200)).call.status), 'aprobado: se intenta ejecutar');
  await call('DELETE', '/api/integrations/prueba', founder, undefined, 200); await call('GET', '/api/integrations/prueba/operations', founder, undefined, 404);
  // Pilar 2 · sandbox: estado veraz y cambios de código apagados por defecto
  const sandbox = await call('GET', '/api/sandbox/status', founder, undefined, 200);
  assert.equal(sandbox.selfChange.enabled, false); assert.ok(sandbox.drivers.some((d) => d.isolation === 'process' && d.available));
  await call('POST', '/api/changes', founder, { id: 'cambio-uno', summary: 'x', changes: [], checks: ['typecheck'] }, 409);
  await call('GET', '/api/sandbox/status', dev, undefined, 403);
  ok('anti-obsolescencia: memoria sin mezclar ámbitos, servicio por especificación, borrado en pausa hasta decidir, sandbox veraz');

  // ── /work: una sola página para todos; sin piel verificada no se sirve otro diseño ────────────
  const page = await fetch(`${base}/work`);
  let browserPhase = 'omitida';
  if (!hasSkin) {
    assert.equal(page.status, 503); assert.match((await page.json()).detail, /Falta la piel de IBA/);
    ok('/work responde 503 sin la piel privada (sin diseño sustituto)');
  } else {
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /janus-work-v1 · skin iba-command-center@/); assert.match(html, /rel="manifest" href="\/work\.webmanifest"/);
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.doesNotMatch(html, /Persona Dev|Proyecto API|SECRETO-FOUNDER/, 'la página no lleva datos de nadie: llegan tras iniciar sesión');
    const manifest = await (await fetch(`${base}/work.webmanifest`)).json();
    assert.equal(manifest.start_url, '/work'); assert.equal(manifest.display, 'standalone');
    const teamPage = await fetch(`${base}/work/team`);
    assert.equal(teamPage.status, 200); assert.match(await teamPage.text(), /janus-work-team-v1/);
    ok('/work servida con la piel de IBA y manifest PWA propio');
    const playwright = loadPlaywright();
    if (playwright) { await browserFlow(playwright, founder); await inviteBrowserFlow(playwright, founder); ok('navegador real: un teléfono nuevo entra con el enlace de invitación; el enlace no sirve dos veces'); await passkeyBrowserFlow(playwright, founder); ok('navegador real: el CEO activa Face ID del navegador, crea el enlace y la colaboradora entra; la llave no vale para otras acciones'); browserPhase = 'superada'; }
  }

  // ── Accesos por invitación: el CEO crea el enlace con Face ID; se canjea UNA vez en el teléfono del colaborador ──
  {
    const inviteBody = { principalId: 'bram', displayName: 'Bram', locale: 'nl' };
    await call('POST', '/api/auth/operator/invites', founder, inviteBody, 403);
    await call('POST', '/api/auth/operator/invites', dev, inviteBody, 403);
    await call('POST', '/api/auth/operator/invites', null, inviteBody, 401);
    const proofFor = () => founderBiometricProof(founder, 'security.authority.delegate_operator');
    await call('POST', '/api/auth/operator/invites', founder, { principalId: 'founder', displayName: 'X' }, 400, { 'x-janus-biometric-proof': await proofFor() });
    const old = await call('POST', '/api/auth/operator/invites', founder, inviteBody, 201, { 'x-janus-biometric-proof': await proofFor() });
    const created = await call('POST', '/api/auth/operator/invites', founder, inviteBody, 201, { 'x-janus-biometric-proof': await proofFor() });
    assert.match(created.path, /^\/work#invite=[A-Za-z0-9_-]{43}$/); assert.equal(created.invite.codeHash, undefined);
    const robinKeys = ecKeys(), intruderKeys = ecKeys();
    await call('POST', '/api/auth/operator/invites/redeem', null, { code: old.code, publicKeyPem: intruderKeys.publicKey }, 410);
    await call('POST', '/api/auth/operator/invites/redeem', null, { code: 'A'.repeat(43), publicKeyPem: intruderKeys.publicKey }, 404);
    await call('POST', '/api/auth/operator/invites/redeem', null, { code: created.code, publicKeyPem: 'llave rota' }, 400);
    const redeemed = await call('POST', '/api/auth/operator/invites/redeem', null, { code: created.code, publicKeyPem: robinKeys.publicKey }, 201);
    assert.deepEqual([redeemed.principalId, redeemed.locale], ['bram', 'nl']);
    await call('POST', '/api/auth/operator/invites/redeem', null, { code: created.code, publicKeyPem: intruderKeys.publicKey }, 410);
    const robin = await authenticate('bram', robinKeys.privateKey);
    const robinDash = (await call('GET', '/api/dashboard/work', robin, undefined, 200)).dashboard;
    assert.equal(robinDash.locale, 'nl'); assert.equal(robinDash.profile.displayName, 'Bram');
    assert.equal(robinDash.projects.length, 0, 'un acceso nuevo no ve ningún proyecto hasta que el CEO se lo asigne');
    assert.equal(robinDash.capabilities.voice, false);
    const listed = await call('GET', '/api/auth/operator/invites', founder, undefined, 200);
    assert.deepEqual(listed.invites.filter((x) => x.principalId === 'bram').map((x) => x.status).sort(), ['redeemed', 'revoked']);
    assert.ok(!JSON.stringify(listed).includes(created.code));
    await call('GET', '/api/auth/operator/invites', robin, undefined, 403);
    const pending = await call('POST', '/api/auth/operator/invites', founder, { principalId: 'carla', displayName: 'Carla', locale: 'es' }, 201, { 'x-janus-biometric-proof': await proofFor() });
    await call('DELETE', `/api/auth/operator/invites/${pending.invite.id}`, robin, undefined, 403);
    assert.equal((await call('DELETE', `/api/auth/operator/invites/${pending.invite.id}`, founder, undefined, 200)).revoked, true);
    await call('POST', '/api/auth/operator/invites/redeem', null, { code: pending.code, publicKeyPem: ecKeys().publicKey }, 410);
    assert.ok((await call('GET', '/api/work/team', founder, undefined, 200)).invites.length >= 3);
    ok('accesos por invitación: Face ID del CEO, un solo uso, anulables, sin proyectos por defecto');
  }

  // ── Aislamiento final entre colaboradores y vista del Founder ─────────────────────────────────
  const mine = await call('GET', '/api/work/sessions', dev, undefined, 200);
  assert.ok(mine.sessions.every((s) => s.principalId === 'colab-dev')); assert.equal(mine.selfReported, true);
  const all = await call('GET', '/api/work/sessions', founder, undefined, 200);
  assert.ok(all.sessions.some((s) => s.principalId === 'colab-dev'));
  await call('GET', '/api/work/sessions', null, undefined, 401);
  ok('cada persona ve solo sus sesiones; el Founder ve el conjunto');

  console.log(`work-runtime-smoke ok · ${checks.length} bloques · navegador: ${browserPhase}${hasSkin ? '' : ' (piel de IBA no instalada)'}`);
  for (const name of checks) console.log('  ✓ ' + name);
} catch (error) {
  console.error(stderr.split('\n').slice(-15).join('\n'));
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(1_000)]);
  if (!child.killed) child.kill('SIGKILL');
}

/** Navegador real: segundo colaborador (NL) que se da de alta con la llave WebCrypto de su dispositivo. */
// Un teléfono nuevo abre el enlace de invitación: sin escribir nada queda vinculado y dentro de SU panel.
async function inviteBrowserFlow({ chromium }, founder) {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH || existsSync('/usr/bin/google-chrome') ? { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' } : {}), args: ['--no-sandbox'] });
  try {
    const proof = await founderBiometricProof(founder, 'security.authority.delegate_operator');
    const created = await call('POST', '/api/auth/operator/invites', founder, { principalId: 'ana', displayName: 'Ana', locale: 'es' }, 201, { 'x-janus-biometric-proof': proof });
    const context = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: 'en-US', hasTouch: true });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(String(error)));
    const seen = []; page.on('request', (request) => seen.push(request.url()));
    await page.goto(`${base}${created.path}`);
    await page.waitForSelector('.cc-shell', { timeout: 15_000 });
    assert.match(await page.locator('.cc-main').innerText(), /Ana/);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'es', 'idioma fijado por el CEO, no por el teléfono');
    assert.equal(await page.evaluate(() => location.hash), '', 'el código se borra de la barra de direcciones');
    assert.ok(seen.every((url) => !url.includes(created.code)), 'el código nunca viaja en una dirección');
    // El mismo enlace en otro teléfono ya no sirve.
    const other = await (await browser.newContext()).newPage();
    await other.goto(`${base}${created.path}`);
    await other.waitForSelector('.cc-login-card .cc-notice');
    assert.equal(await other.locator('.cc-shell').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// El CEO, sin app nativa: activa Face ID del navegador (autenticador virtual de Chrome), crea el enlace y un teléfono
// nuevo entra con él. Además: la prueba de la llave de acceso NO sirve para otras acciones reservadas.
async function passkeyBrowserFlow({ chromium }, founder) {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH || existsSync('/usr/bin/google-chrome') ? { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' } : {}), args: ['--no-sandbox', '--host-resolver-rules=MAP localhost 127.0.0.1'] });
  try {
    const local = base.replace('127.0.0.1', 'localhost');
    const context = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(String(error)));
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await page.addInitScript((token) => { try { sessionStorage.setItem('janus.founder.session', token); } catch (_) { /* otra página */ } }, founder);
    await page.goto(`${local}/work/team`);
    await page.waitForSelector('#access');
    // Sin Face ID activado no se puede crear ningún acceso.
    await page.fill('#access input[name=displayName]', 'Dana'); await page.click('#access form button[type=submit]');
    await page.waitForSelector('#access [role=alert]');
    assert.match(await page.locator('#access [role=alert]').innerText(), /todavía no lo tiene activado/);
    await page.click('[data-act=passkey-enroll]');
    await page.waitForFunction(() => !document.querySelector('[data-act=passkey-enroll]'), null, { timeout: 15_000 });
    assert.equal((await call('GET', '/api/auth/passkey/status', founder, undefined, 200)).activePasskeys, 1);
    // Con Face ID del navegador: crea el enlace.
    await page.fill('#access input[name=displayName]', 'Dana'); await page.selectOption('#access select[name=locale]', 'en'); await page.click('#access form button[type=submit]');
    await page.waitForSelector('#access .jt-link textarea', { timeout: 15_000 });
    const link = await page.locator('#access .jt-link textarea').inputValue();
    assert.match(link, /^http:\/\/localhost:\d+\/work#invite=[A-Za-z0-9_-]{43}$/);
    // El teléfono de la colaboradora entra con ese enlace.
    const phone = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();
    await phone.goto(link);
    await phone.waitForSelector('.cc-shell', { timeout: 15_000 });
    assert.match(await phone.locator('.cc-main').innerText(), /Dana/);
    assert.equal(await phone.evaluate(() => document.documentElement.lang), 'en');
    // Si el dispositivo NO verifica al usuario, no hay prueba.
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
    await page.fill('#access input[name=displayName]', 'Eloy'); await page.click('#access form button[type=submit]');
    await page.waitForSelector('#access [role=alert]', { timeout: 15_000 });
    assert.equal((await call('GET', '/api/auth/operator/invites', founder, undefined, 200)).invites.some((x) => x.principalId === 'eloy'), false, 'sin verificación del usuario no se crea el acceso');
    assert.deepEqual(errors, []);
    // La llave de acceso solo cubre «dar acceso»: no se puede pedir prueba para otra acción reservada, ni añadir otra llave sin el puente nativo.
    const headers = { origin: local };
    await call('POST', '/api/auth/passkey/assert/options', founder, { action: 'security.secrets.read' }, 403, headers);
    await call('POST', '/api/auth/passkey/assert/options', founder, { action: 'security.authority.delegate_operator' }, 403, { origin: 'https://evil.example' });
    await call('POST', '/api/auth/passkey/register/options', founder, {}, 403, headers);
    const dev = await authenticate('colab-dev', devKeys.privateKey);
    await call('GET', '/api/auth/passkey/status', dev, undefined, 403);
    await call('POST', '/api/auth/passkey/assert/options', null, { action: 'security.authority.delegate_operator' }, 401, headers);
  } finally { await browser.close(); }
}

async function browserFlow({ chromium }, founder) {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH || existsSync('/usr/bin/google-chrome') ? { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' } : {}), args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: 'nl-NL', hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('response', (response) => { if (response.status() === 404 && !response.url().includes(devResourceId) && !response.url().includes(agendaPrivateId)) errors.push('404 ' + response.url()); });
    page.on('console', (message) => { if (message.type() === 'error' && !/40[1349]|429|Failed to load resource/.test(message.text())) errors.push(message.text()); });
    await page.goto(`${base}/work`);
    await page.waitForSelector('.cc-login-card');
    assert.equal(await page.locator('.janus-language-button.is-lit').getAttribute('data-language'), 'nl', 'idioma inicial según el dispositivo');
    assert.equal(await page.locator('.janus-language-button img').evaluateAll((imgs) => imgs.filter((img) => img.complete && img.naturalWidth === 192).length), 3, 'los tres medallones cargan');
    assert.equal(await page.locator('input[type=password]').count(), 0, 'sin contraseñas');
    // Sin llave: no entra. Vincula el dispositivo y entrega la llave PÚBLICA.
    await page.fill('#jw-login-id', 'colab-nl');
    await page.click('button[type=submit]');
    await page.waitForSelector('.cc-notice');
    await page.click('[data-act=link]');
    await page.waitForSelector('.jw-pem');
    const pem = await page.locator('.jw-pem').inputValue();
    assert.match(pem, /^-----BEGIN PUBLIC KEY-----/); assert.doesNotMatch(pem, /PRIVATE/);
    // Aún no autorizado por el Founder → no hay acceso.
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.querySelectorAll('.cc-notice').length >= 1 && !document.querySelector('button[type=submit]').disabled);
    assert.equal(await page.locator('.cc-shell').count(), 0);
    // El Founder la da de alta (con prueba biométrica), le concede su ámbito y le asigna trabajo.
    await delegate(founder, { principalId: 'colab-nl', displayName: 'Persoon NL', publicKeyPem: pem, locale: 'nl' });
    await call('POST', '/api/coordination/grants', founder, { principalId: 'colab-nl', scopeId: 'scope-nl', permissions: ['read_context', 'write_work', 'handoff'] }, 201);
    await call('POST', '/api/coordination/assignments', founder, { id: 'as-nl-1', title: 'Demo’s inplannen', goal: 'Drie demo’s', assigneePrincipalId: 'colab-nl', scopeIds: ['scope-nl'], nextActions: ['Tijdsloten voorstellen'] }, 201);
    await page.click('button[type=submit]');
    await page.waitForSelector('.cc-shell', { timeout: 15_000 });
    const text = await page.locator('.cc-main').innerText();
    assert.match(text, /Wat vraagt vandaag je aandacht\?/); assert.match(text, /Persoon NL/); assert.match(text, /Demo’s inplannen/); assert.match(text, /Acquisitie Nederland/);
    assert.doesNotMatch(text, /Proyecto API|Listado con permisos|Persona Dev|Privado del Founder/, 'no ve nada del otro colaborador ni del Founder');
    assert.equal(await page.locator('select[data-act=project] option').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'nl');
    assert.equal(await page.locator('audio, video, [class*=mic], [data-act*=voice]').count(), 0, 'sin elementos de voz');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin desbordamiento horizontal en móvil');
    // Archivos: no alcanza el archivo del otro colaborador; sube los suyos y los abre DENTRO del panel (sin descarga).
    const tokenFetch = (path, init) => page.evaluate(async ([p, i]) => (await fetch(p, { ...(i || {}), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sessionStorage.getItem('janus.founder.session') } })).status, [path, init]);
    assert.equal(await tokenFetch('/api/work/files/' + devResourceId + '/view'), 404, 'archivo de proyecto ajeno: 404');
    assert.equal(await tokenFetch('/api/work/agenda/' + agendaPrivateId, { method: 'PUT', body: '{"done":false}' }), 404, 'agenda ajena: 404');
    assert.equal(await tokenFetch('/api/work/agenda/' + agendaPrivateId, { method: 'DELETE' }), 404);
    assert.equal(await page.locator('#documents [data-act=scan]').count(), 1, 'lector de códigos disponible');
    await page.setInputFiles('#jw-file', [{ name: 'offerte.txt', mimeType: 'text/plain', buffer: Buffer.from('offerte inhoud') }, { name: 'notitie.md', mimeType: 'text/markdown', buffer: Buffer.from('# notitie') }]);
    await page.waitForFunction(() => /offerte\.txt/.test(document.querySelector('#documents').innerText) && /notitie\.md/.test(document.querySelector('#documents').innerText), null, { timeout: 15_000 });
    assert.equal(await page.locator('[data-act=download], a[download]').count(), 0, 'sin botón ni enlace de descarga');
    let downloads = 0; page.on('download', () => { downloads += 1; });
    await page.locator('#documents [data-act=view]').first().click();
    await page.waitForSelector('.jw-viewer pre');
    assert.match(await page.locator('.jw-viewer pre').innerText(), /offerte inhoud|# notitie/);
    assert.match(await page.locator('.jw-viewer-mark span').first().innerText(), /Persoon NL · colab-nl/, 'marca de agua con la persona');
    await page.click('.jw-viewer-x'); await page.waitForSelector('.jw-viewer', { state: 'detached' });
    assert.equal(downloads, 0);
    // Agenda: un recordatorio personal y su disponibilidad.
    await page.fill('#agenda input[name=text]', 'Tandarts bellen'); await page.click('#agenda button[type=submit]');
    await page.waitForFunction(() => /Tandarts bellen/.test(document.querySelector('#agenda').innerText));
    await page.selectOption('#agenda select[name=kind]', 'availability'); await page.fill('#agenda input[name=time]', '09:00'); await page.fill('#agenda input[name=endTime]', '13:00'); await page.click('#agenda button[type=submit]');
    await page.waitForFunction(() => document.querySelectorAll('#agenda .cc-list article').length === 2);
    const nlAgendaSeenByCeo = await call('GET', '/api/work/agenda?principalId=colab-nl', founder, undefined, 200);
    assert.equal(nlAgendaSeenByCeo.items.length, 1); assert.equal(nlAgendaSeenByCeo.items[0].kind, 'availability');
    assert.doesNotMatch(JSON.stringify(nlAgendaSeenByCeo), /Tandarts/);
    // Sesión de trabajo real.
    await page.click('[data-act=sess][data-v=start]');
    await page.waitForSelector('[data-act=sess][data-v=pause]');
    await page.click('[data-act=sess][data-v=pause]');
    await page.waitForSelector('[data-act=sess][data-v=resume]');
    // Registrar avance: validación y guardado real (handoff + evento de sesión).
    await page.click('[data-act=progress][data-v="as-nl-1"]');
    await page.waitForSelector('#jw-form');
    await page.evaluate(() => document.querySelector('#jw-form textarea[name=summary]').removeAttribute('required'));
    await page.click('#jw-form button[type=submit]');
    await page.waitForSelector('#jw-form .cc-inline-notice');
    await page.fill('#jw-form textarea[name=summary]', 'Drie zaken gebeld <b>x</b>');
    await page.fill('#jw-form textarea[name=done]', 'Belronde\nNotities');
    await page.fill('#jw-form textarea[name=evidence]', 'notitie-1');
    await page.click('#jw-form button[type=submit]');
    await page.waitForFunction(() => !document.querySelector('#jw-form') && /Drie zaken gebeld/.test(document.querySelector('#deliveries').innerText), null, { timeout: 15_000 });
    assert.equal(await page.locator('#deliveries b:text-is("x")').count(), 0, 'el texto del usuario se muestra escapado');
    // Chat escrito con contexto de proyecto (sin modelo configurado: el Núcleo responde con su estado real).
    await page.fill('#jw-chat-input', 'Wat is mijn volgende stap?');
    await page.click('form[data-form=chat] button[type=submit]');
    await page.waitForSelector('.jw-msg.jw-janus', { timeout: 100_000 });
    assert.match(await page.locator('.jw-msg.jw-user p').innerText(), /volgende stap/);
    assert.ok((await page.locator('.jw-msg.jw-janus p').innerText()).length > 0);
    // Idioma: cambia al instante y queda guardado en su perfil.
    await page.click('.janus-language-button[data-language=es]');
    await page.waitForFunction(() => /¿Qué necesita tu atención hoy\?/.test(document.querySelector('.cc-topbar h1').innerText));
    // Recarga: la sesión del navegador sigue y el idioma elegido persiste en el servidor.
    await page.reload();
    await page.waitForSelector('.cc-shell');
    assert.match(await page.locator('.cc-topbar h1').innerText(), /¿Qué necesita tu atención hoy\?/);
    assert.match(await page.locator('#session').innerText(), /en pausa/i);
    // Cerrar sesión devuelve a la pantalla de acceso y la API deja de responderle.
    await page.click('.jw-foot [data-act=signout]'); // visible también en móvil
    await page.waitForSelector('.cc-login-card');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('janus.founder.session')), null);
    assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | '));
    ok('navegador real: alta con llave del dispositivo, NL, sesión, avance, chat, idioma persistente y cierre');
  } finally { await browser.close(); }
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(id); } catch { /* siguiente */ }
  }
  return null;
}

async function delegate(founderToken, body) {
  const proof = await founderBiometricProof(founderToken, 'security.authority.delegate_operator');
  const result = await call('POST', '/api/auth/operator/delegate', founderToken, body, 201, { 'x-janus-biometric-proof': proof });
  assert.equal(result.operator?.principal?.role, 'operator');
}

async function call(method, path, token, body, expectedStatus, extraHeaders = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  if (expectedStatus !== null) assert.equal(response.status, expectedStatus, `${method} ${path} → ${response.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

async function authenticate(principalId, privateKey) {
  const challenge = (await call('POST', '/api/auth/challenge', null, { principalId }, 200)).challenge;
  const signature = sign('sha256', Buffer.from(challenge.signingPayload, 'utf8'), privateKey).toString('base64url');
  return (await call('POST', '/api/auth/verify', null, { challengeId: challenge.id, principalId, signature }, 200)).session.token;
}

async function founderBiometricProof(founderToken, action) {
  const challenge = (await call('POST', '/api/auth/biometric/challenge', founderToken, { action }, 200)).challenge;
  const signature = sign('sha256', Buffer.from(challenge.signingPayload, 'utf8'), faceKeys.privateKey).toString('base64url');
  return (await call('POST', '/api/auth/biometric/verify', founderToken, { challengeId: challenge.id, keyId: 'smoke-face-key', signature }, 200)).proof.proofId;
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return await response.json(); lastError = new Error(`HTTP ${response.status}`); } catch (error) { lastError = error; }
    await delay(100);
  }
  throw lastError ?? new Error(`timeout waiting for ${url}`);
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const selected = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return selected;
}
