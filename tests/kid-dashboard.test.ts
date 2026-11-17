import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_HOME_POLICY,
  DEFAULT_LIMITS,
  DEFAULT_MEDIA_POLICY,
  applyProfileUpdate,
  clothingForFeelsLike,
  createPinRecord,
  decideFeedItem,
  dueReminders,
  dueSoonTasks,
  emptyKidState,
  evaluateAccess,
  evaluateMedia,
  extractYoutubeVideoId,
  matchInterests,
  normalizeAgendaInput,
  normalizeFeedInput,
  normalizeTaskInput,
  outfitAdvice,
  overdueTasks,
  parseAgendaUtterance,
  parseHomeCommand,
  parseMediaRequest,
  projectProgress,
  resolveHomeCommand,
  sanitizeKidState,
  screenKidText,
  summarizeActivity,
  toggleStep,
  upcomingAgenda,
  validateDisplayName,
  validateHomePolicy,
  validateLimits,
  validateMediaPolicy,
  validatePinFormat,
  verifyPin,
  visibleFeed,
  youtubeEmbedUrl,
  type AgendaItem,
  type HomeDevice,
  type HomePolicy,
  type MediaPolicy,
  DEFAULT_INTERESTS,
} from '../packages/modules/kid-dashboard/src/index.js';

const TZ = 'Europe/Amsterdam';
// Miércoles 2026-11-04, 13:00 hora de Ámsterdam (CET, UTC+1).
const NOW = new Date('2026-11-04T12:00:00Z');

test('PIN: formato, hash scrypt, bloqueo progresivo y reinicio al acertar', () => {
  assert.equal(validatePinFormat('1234').ok, false);
  assert.equal(validatePinFormat('1111').ok, false);
  assert.equal(validatePinFormat('12ab').ok, false);
  assert.equal(validatePinFormat('4827').ok, true);

  let record = createPinRecord('4827', NOW);
  assert.ok(!JSON.stringify(record).includes('4827'), 'el PIN nunca se guarda en claro');
  assert.equal(verifyPin(undefined, '4827', NOW).result, 'no-pin');

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const wrong = verifyPin(record, '0000', NOW);
    assert.equal(wrong.result, 'wrong');
    record = wrong.record!;
  }
  const locked = verifyPin(record, '0000', NOW);
  assert.equal(locked.result, 'locked');
  assert.equal(locked.result === 'locked' && locked.retryAfterSeconds, 300);
  record = locked.record!;

  // Bloqueado: ni el PIN correcto entra.
  assert.equal(verifyPin(record, '4827', new Date(NOW.getTime() + 60_000)).result, 'locked');
  // Pasado el bloqueo, el correcto entra y se reinicia el contador.
  const later = new Date(NOW.getTime() + 301_000);
  const ok = verifyPin(record, '4827', later);
  assert.equal(ok.result, 'ok');
  assert.equal(ok.record?.failedAttempts, 0);
  assert.equal(ok.record?.lockedUntil, undefined);
  // La segunda serie de fallos bloquea el doble.
  let second = ok.record!;
  for (let attempt = 1; attempt <= 4; attempt += 1) second = verifyPin(second, '9999', later).record!;
  const secondLock = verifyPin(second, '9999', later);
  assert.equal(secondLock.result === 'locked' && secondLock.retryAfterSeconds, 300);
});

test('perfil: la niña cambia nombre, icono y tema con listas cerradas', () => {
  assert.equal(validateDisplayName('Kendra').ok, true);
  assert.equal(validateDisplayName('María-José').ok, true);
  for (const bad of ['', 'a'.repeat(21), 'kendra@mail.com', 'https://x.y', '12345', '<b>hola</b>']) assert.equal(validateDisplayName(bad).ok, false, bad);

  const base = emptyKidState('kendra').profile;
  const changed = applyProfileUpdate(base, { displayName: 'Kenny', icon: '🐙', theme: 'menta', companionId: 'bombo' });
  assert.ok(changed.ok);
  assert.equal(changed.ok && changed.profile.displayName, 'Kenny');
  assert.equal(applyProfileUpdate(base, { icon: '💣' }).ok, false);
  assert.equal(applyProfileUpdate(base, { theme: 'negro-total' }).ok, false);
  assert.equal(applyProfileUpdate(base, { companionId: '../etc' }).ok, false);
});

test('seguridad: bloquea lo adulto, avisa de riesgos y deja pasar lo normal', () => {
  for (const text of ['quiero ver porno', 'pon xxx', 'show me nudes', 'naakt filmpjes']) {
    const verdict = screenKidText(text, 'input');
    assert.equal(verdict.allowed, false, text);
    assert.equal(verdict.severity, 'block', text);
    assert.ok(verdict.parentFlag, text);
  }
  const selfHarm = screenKidText('no quiero vivir', 'input');
  assert.equal(selfHarm.severity, 'alert');
  assert.match(selfHarm.kidMessage ?? '', /papá|adulto/);
  const stranger = screenKidText('un amigo de internet me pidio una foto y dice que no se lo diga a mis padres', 'input');
  assert.equal(stranger.severity, 'alert');
  assert.ok(stranger.categories.includes('stranger-contact'));

  assert.equal(screenKidText('mi telefono es 06 12345678', 'input').categories.includes('personal-data'), true);
  assert.equal(screenKidText('escribeme a kendra@correo.com', 'input').allowed, false);
  assert.equal(screenKidText('vivo en 1234 AB', 'input').allowed, false, 'código postal neerlandés');
  assert.equal(screenKidText('hola', 'input').severity, 'none');

  for (const ok of ['quiero bailar como en la serie coreana', 'ayúdame con las tablas del 7', 'me encanta Stitch y Roblox', 'mi perro Kai es enorme']) {
    const verdict = screenKidText(ok, 'input');
    assert.equal(verdict.allowed, true, ok);
    assert.equal(verdict.severity, 'none', ok);
  }

  const withLink = screenKidText('mira https://sitio-raro.com/x o www.otro.nl', 'output');
  assert.ok(!/https?:|www\./.test(withLink.text));
  assert.equal(screenKidText('mierda', 'input').severity, 'note');
  const outputAdult = screenKidText('aquí tienes porno', 'output');
  assert.equal(outputAdult.allowed, false);
  assert.ok(!/porno/.test(outputAdult.text), 'la respuesta del modelo no se reenvía si es adulta');
  const sensitive = screenKidText('que es el sexo', 'input');
  assert.equal(sensitive.allowed, true);
  assert.equal(sensitive.severity, 'note');
});

test('tiempos: horario, tope diario y por actividad, aviso previo y bonus del tutor', () => {
  const limits = { ...DEFAULT_LIMITS };
  const at = (iso: string) => new Date(iso);
  const call = (iso: string, category: 'youtube' | 'chat' | 'agenda' | 'home' | 'school', used = {}, bonus = 0) =>
    evaluateAccess({ now: at(iso), timeZone: TZ, category, usedTodayMinutes: used, limits, bonusMinutes: bonus });

  assert.equal(call('2026-11-04T12:00:00Z', 'youtube').allowed, true);
  // 22:00 local: fuera de horario. El ocio se corta, pero apagar una luz o ver la agenda sigue disponible.
  const night = call('2026-11-04T21:00:00Z', 'youtube');
  assert.equal(night.allowed, false);
  assert.equal(night.reason, 'outside-hours');
  assert.equal(call('2026-11-04T21:00:00Z', 'home').allowed, true);
  assert.equal(call('2026-11-04T21:00:00Z', 'agenda').allowed, true);
  // El cole no cuenta para el tope diario.
  assert.equal(call('2026-11-04T12:00:00Z', 'school', { youtube: 30, tv: 45, chat: 45 }).allowed, true);

  assert.equal(call('2026-11-04T12:00:00Z', 'youtube', { youtube: 30 }).reason, 'category-limit');
  assert.equal(call('2026-11-04T12:00:00Z', 'chat', { youtube: 30, tv: 45, chat: 45 }).reason, 'daily-limit');
  const warn = call('2026-11-04T12:00:00Z', 'youtube', { youtube: 26 });
  assert.equal(warn.allowed, true);
  assert.equal(warn.warn?.minutesLeft, 4);
  assert.equal(call('2026-11-04T12:00:00Z', 'youtube', { youtube: 30 }, 15).allowed, true, 'el tutor puede dar minutos extra');

  const wrap = evaluateAccess({ now: at('2026-11-04T23:30:00Z'), timeZone: TZ, category: 'chat', usedTodayMinutes: {}, limits: { ...limits, allowedFrom: '22:00', allowedUntil: '06:00' } });
  assert.equal(wrap.allowed, true, 'un horario que cruza la medianoche también funciona');

  assert.equal(validateLimits({ allowedFrom: '25:00' }).ok, false);
  assert.equal(validateLimits({ totalDailyMinutes: 9999 }).ok, false);
  assert.equal(validateLimits({ perCategoryMinutes: { youtubee: 5 } }).ok, false);
  assert.equal(validateLimits({ totalDailyMinutes: 90, perCategoryMinutes: { tv: 30 } }).ok, true);

  const summary = summarizeActivity(
    [
      { at: '2026-11-04T10:00:00Z', category: 'youtube', seconds: 600 },
      { at: '2026-11-04T11:00:00Z', category: 'school', seconds: 1200 },
      { at: '2026-11-03T11:00:00Z', category: 'youtube', seconds: 999 },
    ],
    '2026-11-04T00:00:00Z',
    '2026-11-05T00:00:00Z',
  );
  assert.deepEqual(summary.byCategory, { youtube: 10, school: 20 });
  assert.equal(summary.limitedMinutes, 10);
});

test('vídeo y tele: solo lo aprobado; lo demás se convierte en petición al tutor', () => {
  assert.deepEqual(parseMediaRequest('ponme youtube'), { kind: 'youtube.open' });
  assert.deepEqual(parseMediaRequest('ponme videos de baile coreano en youtube'), { kind: 'youtube.open', query: 'baile coreano' });
  assert.deepEqual(parseMediaRequest('enciende la tele'), { kind: 'tv.power', on: true });
  assert.deepEqual(parseMediaRequest('apaga la tele'), { kind: 'tv.power', on: false });
  assert.deepEqual(parseMediaRequest('ponme netflix'), { kind: 'netflix.open' });
  assert.equal(parseMediaRequest('qué hora es'), null);

  const empty = evaluateMedia({ kind: 'youtube.open' }, DEFAULT_MEDIA_POLICY);
  assert.equal(empty.decision, 'needs-parent');
  assert.equal(evaluateMedia({ kind: 'tv.power', on: true }, DEFAULT_MEDIA_POLICY).decision, 'deny');
  assert.equal(evaluateMedia({ kind: 'netflix.open' }, DEFAULT_MEDIA_POLICY).decision, 'deny');

  const policy: MediaPolicy = {
    youtube: { mode: 'allowlist', channels: [{ id: 'UC' + 'a'.repeat(22), label: 'Baile infantil' }], videos: [{ id: 'dQw4w9WgXcQ', label: 'Baile coreano para niñas' }] },
    netflix: { mode: 'kids-profile-only', kidsProfileName: 'Kendra' },
    tv: { allowPower: true },
  };
  const allowed = evaluateMedia({ kind: 'youtube.open', query: 'baile coreano' }, policy);
  assert.equal(allowed.decision, 'allow');
  assert.equal(allowed.decision === 'allow' && allowed.videos?.length, 1);
  const unknown = evaluateMedia({ kind: 'youtube.open', query: 'minecraft terror' }, policy);
  assert.equal(unknown.decision, 'needs-parent');
  assert.match(unknown.decision === 'needs-parent' ? unknown.requestText : '', /minecraft terror/);
  assert.equal(evaluateMedia({ kind: 'tv.power', on: true }, policy).decision, 'allow');
  assert.equal(evaluateMedia({ kind: 'netflix.open' }, policy).decision, 'allow');
  assert.equal(evaluateMedia({ kind: 'youtube.open' }, { ...policy, youtube: { ...policy.youtube, mode: 'off' } }).decision, 'deny');

  assert.equal(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeVideoId('https://evil.example/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(extractYoutubeVideoId('javascript:alert(1)'), null);
  assert.match(youtubeEmbedUrl('dQw4w9WgXcQ'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0/);
  assert.throws(() => youtubeEmbedUrl('x"><script>'));

  assert.equal(validateMediaPolicy({ youtube: { mode: 'allowlist', channels: [{ id: 'nope', label: 'x' }] } }).ok, false);
  const cleaned = validateMediaPolicy({ youtube: { mode: 'allowlist', videos: [{ id: 'https://youtu.be/dQw4w9WgXcQ', label: 'Mi baile' }] } });
  assert.ok(cleaned.ok);
  assert.equal(cleaned.ok && cleaned.policy.youtube.videos[0]?.id, 'dQw4w9WgXcQ');
});

const INVENTORY: HomeDevice[] = [
  { id: 'l1', name: 'Luz de la cama', room: 'Habitación de Kendra', kind: 'light', tags: ['kendra'] },
  { id: 'l2', name: 'Luz del techo', room: 'Habitación de Kendra', kind: 'light', tags: ['kendra'] },
  { id: 'l3', name: 'Luz de la sala', room: 'Salón', kind: 'light' },
  { id: 'l4', name: 'Luz de la cocina', room: 'Cocina', kind: 'light' },
  { id: 'l5', name: 'Luz del despacho', room: 'Despacho', kind: 'light' },
  { id: 'f1', name: 'Ventilador', room: 'Habitación de Kendra', kind: 'plug', tags: ['ventilador', 'kendra'] },
  { id: 'p1', name: 'Plancha', room: 'Cocina', kind: 'plug' },
  { id: 'h1', name: 'Calefacción del salón', room: 'Salón', kind: 'thermostat' },
];
const HOME: HomePolicy = { ...DEFAULT_HOME_POLICY, enabled: true, allowedRooms: ['Habitación de Kendra', 'Salón', 'Cocina'], defaultRoom: 'Habitación de Kendra' };

test('casa: interpreta frases en español y aplica la política del tutor', () => {
  assert.deepEqual(parseHomeCommand('apaga la luz de la sala'), { verb: 'off', target: 'light', qualifier: 'sala' });
  assert.equal(parseHomeCommand('enciende el ventilador')?.target, 'fan');
  assert.equal(parseHomeCommand('hace calor apaga la calefacción')?.verb, 'off');
  assert.equal(parseHomeCommand('pon la calefacción a 19')?.verb, 'setTemp');
  assert.equal(parseHomeCommand('cuéntame un chiste'), null);

  const cmd = (text: string) => parseHomeCommand(text)!;
  const bed = resolveHomeCommand(cmd('apaga la luz de la cama'), INVENTORY, HOME);
  assert.equal(bed.status, 'ok');
  assert.deepEqual(bed.status === 'ok' && bed.actions, [{ deviceId: 'l1', cmd: 'off' }]);
  const living = resolveHomeCommand(cmd('apaga la luz de la sala'), INVENTORY, HOME);
  assert.deepEqual(living.status === 'ok' && living.actions, [{ deviceId: 'l3', cmd: 'off' }]);
  const kitchen = resolveHomeCommand(cmd('enciende la luz de la cocina'), INVENTORY, HOME);
  assert.deepEqual(kitchen.status === 'ok' && kitchen.actions, [{ deviceId: 'l4', cmd: 'on' }]);

  // Sin decir dónde: usa su habitación; si hay dos luces pregunta cuál.
  const ambiguous = resolveHomeCommand(cmd('enciende la luz'), INVENTORY, HOME);
  assert.equal(ambiguous.status, 'needs-clarification');
  assert.deepEqual(ambiguous.status === 'needs-clarification' && ambiguous.options, ['Luz de la cama', 'Luz del techo']);
  const all = resolveHomeCommand(cmd('prende todas las luces'), INVENTORY, HOME);
  assert.equal(all.status === 'ok' && all.actions.length, 4, 'todas las luces de sus habitaciones permitidas; el despacho no');

  const fan = resolveHomeCommand(cmd('enciende el ventilador'), INVENTORY, HOME);
  assert.deepEqual(fan.status === 'ok' && fan.actions, [{ deviceId: 'f1', cmd: 'on' }]);
  assert.equal(parseHomeCommand('apaga la plancha de la cocina'), null, 'una plancha ni se interpreta como aparato controlable');
  const plugOnly: HomeDevice[] = [{ id: 'p1', name: 'Plancha', room: 'Cocina', kind: 'plug' }];
  assert.equal(resolveHomeCommand(cmd('enciende el ventilador'), plugOnly, HOME).status, 'no-device', 'un enchufe cualquiera nunca pasa por ventilador');

  // Calefacción: apagar sí; encender no; temperatura solo dentro del rango.
  assert.equal(resolveHomeCommand(cmd('hace calor apaga la calefacción'), INVENTORY, HOME).status, 'ok');
  assert.equal(resolveHomeCommand(cmd('enciende la calefacción'), INVENTORY, HOME).status, 'denied');
  assert.equal(resolveHomeCommand(cmd('pon la calefacción a 19'), INVENTORY, { ...HOME, heating: { ...HOME.heating, allowOn: true } }).status, 'ok');
  assert.equal(resolveHomeCommand(cmd('pon la calefacción a 24'), INVENTORY, { ...HOME, heating: { ...HOME.heating, allowOn: true } }).status, 'denied');

  // Habitación no permitida, interruptor general apagado, tipo de aparato no permitido y aparato inexistente.
  assert.equal(resolveHomeCommand(cmd('apaga la luz del despacho'), INVENTORY, HOME).status, 'denied');
  assert.equal(resolveHomeCommand(cmd('apaga la luz de la cama'), INVENTORY, { ...HOME, enabled: false }).status, 'disabled');
  assert.equal(resolveHomeCommand(cmd('enciende el ventilador'), INVENTORY, { ...HOME, allowedKinds: ['light'] }).status, 'denied');
  assert.equal(resolveHomeCommand(cmd('apaga la luz del jardin'), INVENTORY, HOME).status, 'no-device');
  assert.equal(validateHomePolicy({ allowedKinds: ['lock'] }).ok, false, 'las cerraduras no existen para ella');
  assert.equal(validateHomePolicy({ heating: { minTemp: 5, maxTemp: 20 } }).ok, false);
});

test('agenda: recordatorios, fechas dichas en voz y validación', () => {
  const draft = (text: string) => parseAgendaUtterance(text, NOW, TZ);
  assert.deepEqual(draft('el sábado tengo el cumpleaños de mi prima'), { title: 'Cumpleaños prima', date: '2026-11-07', kind: 'cumple' });
  assert.deepEqual(draft('mañana a las 5 tengo dentista'), { title: 'Dentista', date: '2026-11-05', time: '17:00', kind: 'cita' });
  assert.equal(draft('el 12 de noviembre tengo turno de natación a las 4 y media')?.date, '2026-11-12');
  assert.equal(draft('el 12 de noviembre tengo turno de natación a las 4 y media')?.time, '16:30');
  assert.equal(draft('el 2 de enero tengo cole')?.date, '2027-01-02', 'una fecha pasada salta al año siguiente');
  assert.equal(draft('el próximo fin de semana tengo la fiesta')?.date, '2026-11-07');
  assert.equal(draft('cuéntame un chiste'), null);

  assert.equal(normalizeAgendaInput({ title: 'Dentista', date: '2026-13-40' }, 'parent').ok, false);
  assert.equal(normalizeAgendaInput({ title: '', date: '2026-11-10' }, 'kid').ok, false);
  const ok = normalizeAgendaInput({ title: 'Dentista https://malo.example', date: '2026-11-10', time: '15:00', kind: 'cita' }, 'parent');
  assert.ok(ok.ok);
  assert.ok(ok.ok && !/https?:/.test(ok.item.title));

  const items: AgendaItem[] = [
    { id: 'a1', title: 'Dentista', date: '2026-11-04', time: '15:00', kind: 'cita', remindMinutesBefore: [120, 30], createdBy: 'parent' },
    { id: 'a2', title: 'Natación', date: '2026-11-06', time: '16:30', kind: 'turno', remindMinutesBefore: [60], createdBy: 'parent' },
    { id: 'a3', title: 'Cumple prima', date: '2026-11-07', kind: 'cumple', remindMinutesBefore: [0], createdBy: 'parent' },
    { id: 'a4', title: 'Pasado', date: '2026-10-01', kind: 'cita', remindMinutesBefore: [0], createdBy: 'parent' },
  ];
  assert.deepEqual(upcomingAgenda(items, NOW, TZ, 7).map((item) => item.id), ['a1', 'a2', 'a3']);
  // Son las 13:00: el aviso de 120 min antes (13:00) ya toca; el de 30 min (14:30) todavía no.
  const due = dueReminders(items, NOW, TZ, new Set());
  assert.deepEqual(due.map((item) => item.key), ['a1:120']);
  assert.equal(dueReminders(items, NOW, TZ, new Set(['a1:120'])).length, 0, 'un aviso entregado no se repite');
});

test('cole: tareas, entregas atrasadas, pasos y progreso de proyecto', () => {
  assert.equal(normalizeTaskInput({ title: '' }, 'kid').ok, false);
  assert.equal(normalizeTaskInput({ title: 'Deberes', projectId: 'nope' }, 'kid', []).ok, false);
  const made = normalizeTaskInput({ title: 'Maqueta del volcán', due: '2026-11-10', projectId: 'p1', steps: [{ text: 'Comprar arcilla' }, { text: 'Pintar' }] }, 'parent', ['p1']);
  assert.ok(made.ok);
  const tasks = [
    { id: 't1', ...(made.ok ? made.task : ({} as never)) },
    { id: 't2', title: 'Lectura', due: '2026-11-01', status: 'pendiente' as const, createdBy: 'kid' as const },
    { id: 't3', title: 'Mates', due: '2026-11-05', status: 'hecha' as const, projectId: 'p1', createdBy: 'kid' as const },
  ];
  assert.deepEqual(overdueTasks(tasks, '2026-11-04').map((task) => task.id), ['t2']);
  assert.deepEqual(dueSoonTasks(tasks, '2026-11-04', 7).map((task) => task.id), ['t1']);
  assert.deepEqual(projectProgress('p1', tasks), { done: 1, total: 2, percent: 50 });
  let toggled = toggleStep(tasks, 't1', 0);
  toggled = toggleStep(toggled, 't1', 1);
  assert.equal(toggled.find((task) => task.id === 't1')?.status, 'hecha', 'al marcar todos los pasos la tarea queda hecha');
});

test('intereses y planes: nada llega a la niña sin aprobación y lo vencido desaparece', () => {
  const bad = normalizeFeedInput({ kind: 'oferta', title: 'Entrada 2x1', url: 'http://inseguro.example' }, 'tutor', DEFAULT_INTERESTS);
  assert.equal(bad.ok, false);
  assert.equal(normalizeFeedInput({ kind: 'oferta', title: 'x', url: 'https://user:pw@sitio.example' }, 'tutor', DEFAULT_INTERESTS).ok, false);
  const good = normalizeFeedInput({ kind: 'oferta', title: 'Entrada infantil 2x1', place: 'Monkey Town', from: '2026-11-01', until: '2026-11-08', priceCents: 1200, url: 'https://sitio.example/oferta', interestId: 'baile' }, 'janus-investigacion', DEFAULT_INTERESTS);
  assert.ok(good.ok);

  const base = { id: 'f1', status: 'pending' as const, proposedAt: NOW.toISOString(), ...(good.ok ? good.item : ({} as never)) };
  const expired = { ...base, id: 'f2', status: 'approved' as const, until: '2026-11-01' };
  assert.deepEqual(visibleFeed([base], '2026-11-04'), [], 'pendiente: invisible');
  const approved = decideFeedItem([base], 'f1', 'approved', NOW.toISOString());
  assert.deepEqual(visibleFeed([...approved, expired], '2026-11-04').map((item) => item.id), ['f1']);
  assert.deepEqual(visibleFeed(decideFeedItem([base], 'f1', 'rejected', NOW.toISOString()), '2026-11-04'), []);
  assert.deepEqual(visibleFeed(approved, '2026-11-09'), [], 'al vencer, deja de verse');
  assert.deepEqual(matchInterests('hay película nueva de Stitch y baile coreano', DEFAULT_INTERESTS), ['stitch', 'baile']);
});

test('ropa y plan: abrigo, lluvia, viento y mejor franja para salir', () => {
  assert.deepEqual(clothingForFeelsLike(-3).layers.slice(0, 2), ['abrigo grueso', 'gorro']);
  assert.ok(clothingForFeelsLike(27).layers.includes('gorra'));

  const hours = (fn: (hour: number) => Partial<{ tempC: number; feelsLikeC: number; precipProb: number; precipMm: number; windKmh: number; uv: number }>) =>
    Array.from({ length: 24 }, (_, hour) => ({ hour, tempC: 10, ...fn(hour) }));

  const rainy = outfitAdvice(hours((hour) => ({ tempC: 10, feelsLikeC: 9, precipProb: hour < 12 ? 80 : 10, precipMm: hour < 12 ? 1.5 : 0 })))!;
  assert.ok(rainy.wear.includes('chaqueta'));
  assert.ok(rainy.wear.includes('chubasquero o impermeable'));
  assert.deepEqual(rainy.bestOutdoorWindow, { fromHour: 12, toHour: 18 });
  assert.equal(rainy.outdoorOk, true);

  const windy = outfitAdvice(hours(() => ({ tempC: 12, precipProb: 60, windKmh: 50 })))!;
  assert.match(windy.bring.join(' '), /paraguas se vuela/);
  assert.equal(windy.outdoorOk, false);
  assert.match(windy.lines.join(' '), /interior/);

  const sunny = outfitAdvice(hours(() => ({ tempC: 22, precipProb: 0, uv: 5 })))!;
  assert.match(sunny.bring.join(' '), /protector solar/);
  assert.equal(outfitAdvice([]), null);
});

test('estado: carga defensiva con topes y valores por defecto', () => {
  const state = sanitizeKidState({ revision: 3, agenda: Array.from({ length: 500 }, (_, i) => ({ id: `a${i}` })), profile: { displayName: 'Kenny' } }, 'kendra');
  assert.equal(state.revision, 3);
  assert.equal(state.agenda.length, 300);
  assert.equal(state.profile.displayName, 'Kenny');
  assert.equal(state.profile.theme, 'lila');
  assert.equal(state.settings.transcriptVisibility, 'flags', 'por defecto el tutor ve avisos y tiempos, no las charlas');
  assert.equal(sanitizeKidState('basura', 'kendra').revision, 0);
});
