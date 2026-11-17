'use strict';
/* ===== DATOS DE EJEMPLO (no reales) — se sustituirán por fuentes conectadas a JANUS Core ===== */
const DATA = (() => {
  const R = prng(777);
  const series = (n, a, b, noise) => Array.from({ length: n }, (_, i) => +(a + (b - a) * (i / (n - 1)) + (R() - .5) * noise).toFixed(1));
  const reach30 = [4.1, 4.4, 4.0, 4.8, 5.2, 5.0, 5.9, 6.4, 6.1, 6.8, 7.5, 7.2, 8.1, 8.9, 8.4, 9.2, 10.1, 9.6, 10.4, 11.3, 12.8, 12.2, 13.1, 13.9, 13.4, 14.6, 15.8, 15.1, 16.4, 17.2];
  const reach90 = series(30, 5, 9, 1.5).concat(series(30, 9, 6.4, 1.5), reach30);
  const sources = [
    { id: 'reels', n: 'Patrocinios · Reels', e: '🎬', c: '#E8C37A', w: [180, 190, 210, 200, 300, 330, 320, 330, 280, 360, 400, 410] },
    { id: 'chatbox', n: 'ChatBox SaaS', e: '🤖', c: '#86B6FF', w: [200, 210, 220, 240, 300, 320, 320, 330, 300, 330, 360, 390] },
    { id: 'gumroad', n: 'Gumroad', e: '🛍', c: '#5FD39A', w: [120, 160, 150, 170, 210, 240, 230, 250, 250, 210, 230, 230] },
    { id: 'm360', n: 'Marketing 360 · Dron', e: '🚁', c: '#FF9E7A', w: [0, 0, 150, 0, 150, 150, 210, 150, 150, 250, 250, 250] }
  ];
  const mkReel = (id, t, views, eur, seed, dur) => {
    const r = prng(seed), v7 = [], tot = views * 1000;
    let acc = 0; for (let i = 0; i < 7; i++) { const x = Math.round(tot * [.34, .22, .14, .1, .08, .07, .05][i] * (0.9 + r() * .2)); v7.push(x); acc += x; }
    const ret = [100, 82, 71, 64, 58, 53, 49, 45, 41, 38, 35].map((x) => Math.round(x * (0.9 + r() * .15)));
    return { id, t, views, vtxt: views + 'K', eur, dur, v7, ret, likes: Math.round(tot * (.045 + r() * .02)), com: Math.round(tot * (.004 + r() * .003)), sh: Math.round(tot * (.009 + r() * .006)), sv: Math.round(tot * (.012 + r() * .008)), reach: Math.round(tot * .82), src: [Math.round(48 + r() * 12), Math.round(18 + r() * 8), Math.round(10 + r() * 6)] };
  };
  return {
    agenda: [
      { id: 'a1', h: '07:30', e: '🚴', t: 'Bici → oficina', amb: 'p', dur: 30, where: 'Casa → oficina', note: 'Revisa el plan de bici: ida en verde.' },
      { id: 'a4', h: '13:00', e: '🍽', t: 'Almuerzo', amb: 'p', dur: 45, where: '—', note: '' },
      { id: 'leave', auto: 'leave', e: '⏱', amb: 'p', dur: 15, where: 'Oficina → casa', note: 'Calculado por Janus a partir del pronóstico.' },
      { id: 'a6', h: '16:15', e: '🤸', t: 'Llevar a __HIJA__', amb: 'f', dur: 15, where: 'Casa → gimnasio', note: 'Gimnasio de __HIJA__ a las 16:30.' },
      { id: 'a7', h: '20:00', e: '🛒', t: 'Compras', amb: 'p', dur: 45, where: 'Supermercado', note: '' },
      { id: 'a2', h: '09:00', e: '📞', t: 'Llamada cliente', amb: 'e', dur: 30, where: 'Videollamada', note: 'Preparar propuesta y precios.' },
      { id: 'a3', h: '11:00', e: '🎬', t: 'Producir Reel', amb: 'e', dur: 90, where: 'Estudio', note: 'Guion: dron + Marketing 360.' }
    ],
    agendaTomorrow: [
      { id: 'b1', h: '07:30', e: '🚴', t: 'Bici → oficina', amb: 'p', dur: 30 },
      { id: 'b2', h: '10:00', e: '🤝', t: 'Seguimiento 3 Kings', amb: 'e', dur: 30 },
      { id: 'b3', h: '14:00', e: '✂', t: 'Edición del Reel', amb: 'e', dur: 120 },
      { id: 'b4', h: '15:00', e: '🏫', t: 'Recoger a __HIJA__', amb: 'f', dur: 20 },
      { id: 'b5', h: '19:30', e: '🏃', t: 'Entrenamiento', amb: 'p', dur: 60 }
    ],
    familia: {
      pattern: { 1: ['🏫', '🤸'], 2: ['🏫'], 3: ['🏫', '🤸'], 4: ['🏫'], 5: ['🏫', '🤸'], 6: ['🎨'], 0: [] },
      items: { '🏫': { t: 'Escuela', h: '08:30', to: '15:00' }, '🤸': { t: 'Gimnasio', h: '16:30', to: '17:30' }, '🎨': { t: 'Clase de arte', h: '10:00', to: '11:30' }, '🩺': { t: 'Cita médica', h: '15:20', to: '16:00' }, '🦷': { t: 'Revisión dental', h: '16:00', to: '16:30' } },
      dated: [{ y: 2026, m: 10, d: 27, e: '🩺', note: 'Llevar tarjeta sanitaria' }, { y: 2026, m: 11, d: 18, e: '🦷', note: 'Revisión semestral' }],
      lleva: [{ id: 'l1', e: '🎒', t: 'Mochila' }, { id: 'l2', e: '👟', t: 'Zapatillas de gimnasio' }, { id: 'l3', e: '🧥', t: 'Chaqueta (lluvia por la tarde)' }, { id: 'l4', e: '🍎', t: 'Merienda' }],
      escuela: [{ y: 2026, m: 10, d: 23, e: '🚌', t: 'Excursión escolar' }, { y: 2026, m: 10, d: 28, e: '👨‍👩‍👧', t: 'Reunión de padres' }, { y: 2026, m: 11, d: 6, e: '📚', t: 'Entrega de proyecto' }],
      vacaciones: [{ y: 2026, m: 12, d: 19, to: '3 ene', e: '🎄', t: 'Vacaciones de invierno' }, { y: 2027, m: 2, d: 13, to: '21 feb', e: '⛷', t: 'Vacaciones de primavera' }],
      semanal: [['🤸', 'Gimnasio', 'L · X · V', '16:30'], ['🎨', 'Arte', 'S', '10:00'], ['🏊', 'Natación', 'J', '17:00 (opcional)']]
    },
    mails: [
      { id: 'm0', ini: 'P1', who: '__CONTACTO_FIRMA__', sj: 'Documento por firmar', age: '2 d', sev: 3, tag: 'Firma', sum: 'Pide firmar y devolver un documento. Plazo próximo.', act: 'Revisar y firmar hoy' },
      { id: 'm1', ini: '3K', who: '3 Kings Barbershop', sj: 'Ajustes del chatbot', age: '5 h', sev: 2, tag: 'Cliente', sum: 'Solicita cambios en respuestas y horario del chatbot.', act: 'Agendar ajuste con __CLIENTE_IBA__' },
      { id: 'm2', ini: 'C1', who: '__CLIENTE_IBA__', sj: 'IBA · actualización', age: '1 d', sev: 2, tag: 'Equipo', sum: 'Informa de 2 actualizaciones pendientes de aprobar en IBA.', act: 'Aprobar o comentar' },
      { id: 'm3', ini: 'HO', who: 'Hosting', sj: 'Renovación de dominio', age: '3 d', sev: 1, tag: 'Servicio', sum: 'Aviso de renovación de dominio.', act: 'Confirmar renovación' }
    ],
    follow: [
      { id: 'f0', x: 'Propuesta Potensic', p: 80, due: 'vie', steps: ['Borrador', 'Métricas', 'Revisión', 'Envío'] },
      { id: 'f1', x: 'Contrato 3 Kings', p: 40, due: 'lun', steps: ['Condiciones', 'Precio', 'Firma'] },
      { id: 'f2', x: 'Revisar PR de Janus', p: 0, due: 'hoy', steps: ['PR #41', 'PR #42'] },
      { id: 'f3', x: 'Fotos Marketing 360', p: 60, due: 'mar', steps: ['Sesión', 'Selección', 'Edición', 'Entrega'] }
    ],
    janus: {
      log: [['07:41', '🌦', 'Pronóstico actualizado', 1], ['07:40', '📥', 'Bandeja clasificada (12)', 1], ['07:38', '🗓', 'Agenda sincronizada', 1], ['07:35', '🔐', 'Aprobación solicitada: publicar Reel', 1], ['07:30', '🧠', 'Lecciones consolidadas', 1], ['07:20', '🧪', 'Pruebas janus-core', 1], ['07:15', '📊', 'Métricas de Meta', 0], ['07:10', '🤖', 'Estado de chatbots', 1], ['07:05', '💾', 'Respaldo SQLite → Drive', 1], ['07:00', '🔁', 'Revalidación al reconectar', 1], ['06:50', '🧩', 'PR #42 actualizado', 1], ['06:40', '🧩', 'PR #41 actualizado', 1], ['06:30', '🛡', 'Auditoría de permisos', 1], ['06:15', '⚙', 'Arranque del núcleo', 1]],
      appr: [{ id: 'p1', e: '🎬', t: 'Publicar Reel programado', d: 'Instagram · hoy 18:00' }, { id: 'p2', e: '✉', t: 'Enviar respuesta a 3 Kings', d: 'Borrador listo' }],
      prs: [{ n: 41, st: 'Borrador · espera tu revisión' }, { n: 42, st: 'Borrador · espera tu revisión' }],
      integ: [['GitHub', '🐙'], ['Vercel', '▲'], ['Supabase', '🟢'], ['Google Workspace', '📧'], ['Asana', '🔺'], ['n8n', '🔗'], ['Netlify', '🌐'], ['Hostinger', '🏠'], ['Meta', '📱']]
    },
    reach30, reach90,
    platforms: [['📱 Instagram', 61], ['📘 Facebook', 24], ['🎵 Otros', 15]],
    ages: [['18–24', 14], ['25–34', 38], ['35–44', 29], ['45–54', 12], ['55+', 7]],
    cities: [['Medellín', 31], ['__CIUDAD__', 22], ['Nueva York', 18], ['Ámsterdam', 11]],
    heat: Array.from({ length: 7 }, (_, d) => Array.from({ length: 12 }, (_, h) => Math.round(clamp(20 + 60 * Math.exp(-Math.pow(h - (d > 4 ? 6 : 8), 2) / 6) + (R() - .5) * 25, 3, 100)))),
    sources, prevTotal: 4140,
    kpis: [
      { e: '💶', k: 'Ingresos', go: 'ingresos' }, { e: '👁', k: 'Alcance', go: 'alcance' }, { e: '❤', k: 'Interacción', v: '6,8%', d: '0,9 pt', go: 'contenido', s: [5.2, 5.6, 5.4, 5.9, 6.1, 6.0, 6.3, 6.4, 6.6, 6.5, 6.7, 6.8] },
      { e: '🤝', k: 'Clientes', v: '3', d: '1', go: 'clientes', s: [0.4, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3] }, { e: '📥', k: 'Leads', v: '17', d: '5', go: 'clientes/leads', s: [4, 5, 5, 7, 8, 8, 10, 11, 12, 14, 15, 17] }
    ],
    bots: [
      { id: 'iba', n: 'IBA · __CLIENTE_IBA__', c: 128, upT: '99,6', u: '⏳ 2 act.', warn: true, days: [14, 18, 17, 22, 19, 16, 22], d30: series(30, 9, 22, 6), resp: '1,8 s', csat: '4,4', hand: '6%', intents: [['Horarios', 34], ['Precios', 27], ['Reservas', 22], ['Ubicación', 11], ['Otros', 6]], upd: [{ id: 'u1', t: 'Base de conocimiento: nuevos servicios' }, { id: 'u2', t: 'Flujo de derivación a humano' }, { id: 'u3', t: 'Tono de respuestas', done: true }] },
      { id: 'chatbox', n: 'ChatBox · 3 Kings', c: 41, upT: '100', u: '★ 4,7', warn: false, days: [4, 5, 6, 8, 5, 6, 7], d30: series(30, 2, 8, 3), resp: '1,2 s', csat: '4,7', hand: '3%', intents: [['Reservar cita', 48], ['Horario', 21], ['Precios', 18], ['Dirección', 8], ['Otros', 5]], upd: [{ id: 'u4', t: 'Ajustes solicitados por el cliente' }, { id: 'u5', t: 'Horario de festivos', done: true }] }
    ],
    reels: [mkReel('r1', 'Dron · Marketing 360', 48, 620, 11, 34), mkReel('r2', 'Chatbot barberías', 31, 410, 12, 27), mkReel('r3', 'Test Atom 2', 23, 260, 13, 41), mkReel('r4', 'Detrás de cámaras', 15, 120, 14, 22), mkReel('r5', 'Tip de IA en 30 s', 12, 90, 15, 30), mkReel('r6', 'Dron nocturno', 9, 60, 16, 25)],
    followers: { now: 8420, goal: 10000, wk: [7210, 7380, 7560, 7790, 7950, 8130, 8290, 8420] },
    mailCats: [{ id: 'leads', e: '🤝', n: 'Leads', c: '#E8C37A', items: [['Barbería en Huissen', 'Formulario web', 'Llamar hoy'], ['Clínica dental', 'Instagram', 'Enviar demo ChatBox'], ['Inmobiliaria', 'Referido', 'Propuesta dron'], ['Gimnasio local', 'WhatsApp', 'Agendar reunión']] },
      { id: 'soporte', e: '🛟', n: 'Soporte', c: '#86B6FF', items: [['3 Kings Barbershop', 'Correo', 'Ajustes del chatbot'], ['Cliente ChatBox', 'Correo', 'Cambio de horario'], ['Cliente web', 'Correo', 'Formulario no envía'], ['Cliente ChatBox', 'Correo', 'Factura'], ['Cliente IBA', 'Correo', 'Acceso']] },
      { id: 'otros', e: '📄', n: 'Otros', c: '#8a836f', items: [['Proveedor', 'Correo', 'Presupuesto'], ['Newsletter', 'Correo', 'Leer luego'], ['Banco', 'Correo', 'Aviso']] }],
    funnel: [{ e: '📥', n: 17, t: 'Leads' }, { e: '📅', n: 6, t: 'Reuniones' }, { e: '✅', n: 3, t: 'Clientes' }],
    newClients: [['3 Kings Barbershop', '🤖 ChatBox', 'piloto'], ['Cliente B', '🚁 Marketing 360', '€450'], ['Cliente C', '🌐 Web', '€900']]
  };
})();
