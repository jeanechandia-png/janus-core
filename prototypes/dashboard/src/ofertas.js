'use strict';
/* ===== Radar de ofertas y correo multicuenta (usa las piezas LEGO DealRadar y MailHub) =====
 * Ofertas: EJEMPLO hasta conectar fuentes reales. Vacaciones escolares: REAL (rijksoverheid, región zuid).
 */
const OF = (() => {
  const R = DealRadar, today = '2026-10-22';
  const watch = [];
  R.addToBasket(watch, [
    { name: 'Tomaten frito', brand: 'Mutti', sizeText: '400 g', confidence: 0.95, priceSeen: 1.99, store: 'Albert Heijn' },
    { name: 'Volle melk', brand: 'Campina', sizeText: '1 l', confidence: 0.93, priceSeen: 1.35, store: 'Albert Heijn' },
    { name: 'Koffiebonen espresso', brand: 'Lavazza', sizeText: '1 kg', confidence: 0.9, priceSeen: 16.99, store: 'Jumbo' },
    { name: 'Olijfolie extra vierge', brand: 'Bertolli', sizeText: '750 ml', confidence: 0.91, priceSeen: 8.49, store: 'Jumbo' },
    { name: 'Volkoren brood', brand: 'AH', sizeText: '800 g', confidence: 0.62 }
  ], { scope: 'family' });
  watch.push(R.brandWatch('Calvin Klein', ['boxershorts'], { minDiscount: 0.2 }), R.brandWatch('Tommy Hilfiger', ['trui', 'sweater']), R.brandWatch('Timberland', ['boots', 'leer']),
    R.brandWatch('Nike', ['air max', 'sokken']), R.brandWatch('Apple', ['iphone', 'ipad', 'macbook'], { kind: 'electronics', minDiscount: 0.08 }),
    R.brandWatch('Nike', ['kids', 'meisjes'], { kind: 'kids', scope: 'family' }));
  const O = (id, store, title, brand, reg, price, promo, kind, until, url) => ({ id, source: 'ejemplo', store, title, brand, regularPrice: reg, price, promoText: promo, kind, observedAt: today, validUntil: until, url });
  const offers = [
    Object.assign(O('o1', 'Albert Heijn', 'Mutti tomaten frito 400 g', 'Mutti', 1.99, 0.99, null, 'grocery', '2026-10-25'), { size: { amount: 400, unit: 'g' } }),
    Object.assign(O('o2', 'Jumbo', 'Lavazza espresso bonen 1 kg', 'Lavazza', 16.99, null, '25% korting', 'grocery', '2026-10-27'), { size: { amount: 1000, unit: 'g' } }),
    Object.assign(O('o3', 'Jumbo', 'Bertolli olijfolie extra vierge 750 ml', 'Bertolli', 8.49, null, '2e halve prijs', 'grocery', '2026-10-27'), { size: { amount: 750, unit: 'ml' } }),
    O('o4', 'Zalando', 'Calvin Klein boxershorts 3-pack', 'Calvin Klein', 49.95, 29.95, null, 'fashion'),
    O('o5', 'Timberland NL', 'Timberland 6-inch premium boots leer', 'Timberland', 219, 164.25, null, 'fashion'),
    O('o6', 'Nike NL', 'Nike Air Max 90', 'Nike', 149.99, 104.99, null, 'fashion'),
    O('o7', 'Nike NL', 'Nike kids meisjes sneakers', 'Nike', 69.99, 48.99, null, 'kids'),
    O('o8', 'Apple Store NL', 'Apple iPad Air (refurbished)', 'Apple', 699, 599, null, 'electronics'),
    Object.assign(O('s1', 'Plataforma de vídeo', 'Plataforma de vídeo Premium', null, null, null, null, 'subscription'), { intro: { introPrice: 4.99, introMonths: 1, regularPrice: 13.99, minCommitmentMonths: 0 } }),
    Object.assign(O('s2', 'Herramienta de diseño', 'Herramienta de diseño Pro (InfinitySeed)', null, null, null, null, 'tool'), { intro: { introPrice: 9, introMonths: 3, regularPrice: 24, minCommitmentMonths: 0 } })
  ];
  const profile = { owner: 'jean', locale: 'es', currency: 'EUR', country: 'NL', schoolRegion: 'zuid', weeklyRun: { weekday: 1, hour: 8, timeZone: 'Europe/Amsterdam' }, watchlist: watch, defaultMinDiscount: 0.15,
    travel: { origin: '__CIUDAD__', adults: 1, childAges: [__EDAD_HIJA__], destinations: [
      { name: 'Phantasialand (Brühl)', country: 'DE', modes: ['park', 'hotel', 'train'], priority: 1 }, { name: 'Efteling', country: 'NL', modes: ['park', 'hotel'], priority: 0.95 },
      { name: 'Movie Park Germany', country: 'DE', modes: ['park'], priority: 0.8 }, { name: 'Berlín', country: 'DE', modes: ['train', 'hotel'], priority: 0.7 }, { name: 'Destino de sol (vuelo)', country: 'EU', modes: ['flight', 'hotel'], priority: 0.75 }] } };
  const now = new Date(today + 'T08:00:00Z');
  const matches = R.matchOffers(watch, offers.filter((o) => !o.intro), 0.15, now);
  const holidays = R.upcomingHolidays('zuid', now, 6);
  const travel = R.travelSearches(profile, holidays, now);
  const digest = R.buildDigest(profile, matches, offers.filter((o) => o.intro), travel, { now });
  return { R, watch, offers, matches, holidays, travel, digest, profile, nextRun: R.nextWeeklyRun(now), seasons: R.activeSeasons(new Date('2026-11-02')), review: watch.length };
})();
const PRIO = { high: ['alta', 'r'], medium: ['media', 'a'], low: ['baja', ''] };
const CAT = { grocery: ['🛒', 'Cesta'], fashion: ['👟', 'Marcas'], kids: ['🎒', '__HIJA__'], electronics: ['📱', 'Apple y electrónica'], subscription: ['🔁', 'Plataformas'], tool: ['🧰', 'Herramientas InfinitySeed'], travel: ['✈', 'Viajes'] };
const MODE = { flight: '✈ vuelo', train: '🚆 tren', bus: '🚌 bus', car: '🚗 coche', hotel: '🏨 hotel', park: '🎢 parque' };

function vOfertas(M, X, sub) {
  const D = OF.digest, A = D.alerts;
  const grp = (cats) => A.filter((a) => cats.includes(a.category));
  const alertRow = (a) => '<div class="li2 ofr">' + pill(PRIO[a.priority][0], PRIO[a.priority][1]) + '<span class="ofx"><b>' + esc(a.title) + '</b><small>' + esc(a.detail) + '</small></span><span class="mono dim">' + esc(a.source) + '</span></div>';
  const head = panel('ofh', '🏷', 'Resumen semanal', 'próxima revisión: lunes ' + OF.nextRun.toISOString().slice(5, 10).split('-').reverse().join('/') + ' · 08:00',
    '<div class="ofk"><div><b class="serif gld">' + D.basketOnSale + '</b><span>de tu cesta en oferta</span></div><div><b class="serif gld">' + A.filter((a) => ['fashion', 'kids', 'electronics'].includes(a.category)).length + '</b><span>de tus marcas</span></div><div><b class="serif gld">' + D.subscriptions.length + '</b><span>promos de plataformas</span></div><div><b class="serif gld">€' + D.totalSavings.toFixed(0) + '</b><span>ahorro aprox.</span></div></div>' +
    '<div class="sumb"><span class="bb s">💡</span><div><b>' + esc(D.headline) + '</b><div class="dim">Ofertas de EJEMPLO: se activan con fuentes reales (folletos/feeds) tras revisar sus condiciones. Cada aviso muestra su fuente y su fecha.</div></div></div>' +
    '<label class="btn2 mono ofup">📷 Añadir productos por foto<input type="file" accept="image/*" capture="environment" multiple data-f="ofPhoto" hidden></label>' + (UI.ofPhotos ? '<div class="note mono">' + UI.ofPhotos + ' foto(s) en cola: Janus identificará marca, tamaño y código de barras (visión del núcleo) y las añadirá a tu cesta; las dudosas te las pedirá confirmar.</div>' : ''));
  const cesta = panel('', '🛒', 'Tu cesta', OF.watch.filter((w) => w.kind === 'grocery').length + ' productos vigilados', grp(['grocery']).map(alertRow).join('') || '<div class="dim">Sin ofertas esta semana</div>');
  const marcas = panel('', '👟', 'Marcas, Apple y niños', 'umbral 20 %', grp(['fashion', 'electronics', 'kids']).map(alertRow).join(''));
  const plat = panel('', '🔁', 'Plataformas y herramientas', 'sin permanencia', D.subscriptions.map((s) => '<div class="li2 ofr">' + pill(s.verdict.verdict, s.verdict.verdict === 'aprovechar' ? 'g' : '') + '<span class="ofx"><b>' + esc(s.offer.title) + '</b><small>€' + s.offer.intro.introPrice + ' × ' + s.offer.intro.introMonths + ' mes(es), luego €' + s.offer.intro.regularPrice + ' · ' + esc(s.verdict.note) + '</small></span></div>').join(''));
  const hol = OF.holidays.map((h) => '<div class="li2"><span class="bb s">🏖</span><span>' + esc(h.name) + '</span><b class="mono">' + h.start.slice(8) + '/' + h.start.slice(5, 7) + ' → ' + h.end.slice(8) + '/' + h.end.slice(5, 7) + '</b></div>').join('');
  const trips = OF.travel.slice(0, 6).map((t) => '<div class="li2"><span class="mono tm">' + MODE[t.mode] + '</span><span>' + esc(t.destination) + ' · ' + esc(t.windowName.split(' (')[0]) + '</span><b class="mono">' + t.nights + ' n</b></div>').join('');
  const viajes = panel('ofv', '✈', 'Vacaciones de __HIJA__ y viajes', 'región zuid · real', '<div class="sb mono">Vacaciones escolares · rijksoverheid.nl</div>' + hol + '<div class="sb mono">Qué vigilar (NL y Alemania)</div>' + trips);
  const fuentes = panel('', '🔌', 'Fuentes', 'por confirmar', '<div class="ofs">' + OF.R.SOURCE_CATALOG.map((s) => '<span class="pill2 mono">' + esc(s.name) + '</span>').join('') + '</div><div class="note mono">Ninguna fuente está conectada todavía: cada una se activa tras revisar sus condiciones de uso.</div>');
  return frame('ofertas', sub, M, head + cesta + marcas + plat + viajes + fuentes);
}

/* ---------- Correo: varias cuentas por proveedor ---------- */
const mailAccounts = () => { ST.mailAccounts = ST.mailAccounts || []; return ST.mailAccounts; };
function vCorreo(M, X, sub) {
  const H = MailHub, list = mailAccounts(), P = H.PROVIDERS;
  const groups = H.pickerGroups(list).concat(['yahoo', 'outlook', 'imap'].filter((p) => !list.some((a) => a.provider === p)).map((p) => ({ provider: p, name: P[p].name, accounts: [], canAdd: true })));
  const ICON = { icloud: '☁', gmail: '✉', yahoo: '📧', outlook: '📧', imap: '🌐' };
  const cards = groups.map((g) => panel('mlg', ICON[g.provider], g.name, g.accounts.length + (g.accounts.length === 1 ? ' cuenta' : ' cuentas'),
    g.accounts.map((a) => '<div class="li2"><span class="bb s">' + ICON[a.provider] + '</span><span class="ofx"><b>' + esc(a.label) + '</b><small>' + esc(a.address) + ' · ' + (a.scope === 'business' ? 'empresa' : a.scope === 'family' ? 'familia' : 'personal') + '</small></span>' + pill(a.status === 'conectada' ? 'conectada' : 'por conectar', a.status === 'conectada' ? 'g' : '') + '<span class="mini mono"' + act('mailDel', a.id, 'Quitar cuenta') + '>✕</span></div>').join('') +
    '<div class="btn2 mono"' + act('mailNew', g.provider, 'Añadir cuenta') + '>＋ Añadir cuenta de ' + esc(P[g.provider].name) + '</div><div class="note mono">' + esc(P[g.provider].howTo) + '</div>')).join('');
  const form = UI.mailNew ? panel('mlf', '＋', 'Nueva cuenta · ' + P[UI.mailNew].name, '', '<div class="tms"><label>Correo <input type="email" data-f="mlAddr" placeholder="nombre@' + (UI.mailNew === 'icloud' ? 'icloud.com' : UI.mailNew === 'gmail' ? 'gmail.com' : 'dominio.com') + '"></label></div><div class="tms"><label>Nombre <input type="text" data-f="mlLabel" placeholder="p. ej. Personal, InfinitySeed"></label><label>Ámbito <select data-f="mlScope"><option value="personal">personal</option><option value="business">empresa</option><option value="family">familia</option></select></label></div>' +
    '<div class="btns"><span class="btn"' + act('mailAdd', UI.mailNew) + '>Guardar cuenta</span><span class="btn ghost"' + act('mailNew', '') + '>Cancelar</span></div>' + (UI.mailMsg ? '<div class="note mono">' + esc(UI.mailMsg) + '</div>' : '') +
    '<div class="note mono">Aquí no se guarda ninguna contraseña. ' + (P[UI.mailNew].auth === 'oauth' ? 'Se autoriza con la cuenta de ' + P[UI.mailNew].name + ' desde Janus.' : 'Se usa una contraseña específica de app que se guarda en el llavero/entorno de Janus Core.') + '</div>') : '';
  const info = panel('mli', '🍎', 'iPhone y Apple', 'integración', [['📲', 'App en el iPhone', 'Safari → Compartir → Añadir a pantalla de inicio'], ['☁', 'iCloud Mail', 'IMAP imap.mail.me.com:993 + contraseña específica de app'], ['📷', 'Fotos y archivos', 'Atajo «Enviar a Janus» desde la hoja Compartir (por implementar en el núcleo)'], ['💻', 'MacBook', 'Janus Core corre en macOS (Node); secretos en el Llavero (por implementar)']].map((r) => '<div class="li2"><span class="bb s">' + r[0] + '</span><span class="ofx"><b>' + r[1] + '</b><small>' + r[2] + '</small></span></div>').join(''));
  return frame('correo', sub, M, form + cards + info);
}
VIEWS.ofertas = vOfertas; VIEWS.correo = vCorreo;
TABS.push(['ofertas', '🏷', 'Ofertas'], ['correo', '✉', 'Correo']);
Object.assign(UI, { mailNew: '', mailMsg: '', ofPhotos: 0 });
const OF_ACTS = {
  mailNew: (p) => { UI.mailNew = p || ''; UI.mailMsg = ''; },
  mailAdd: (p) => { try { MailHub.addAccount(mailAccounts(), { provider: p, address: field('mlAddr'), label: field('mlLabel'), scope: field('mlScope') || 'personal' }); UI.mailNew = ''; UI.mailMsg = ''; saveState(); } catch (e) { UI.mailMsg = e.message; } },
  mailDel: (id) => { MailHub.removeAccount(mailAccounts(), id); saveState(); }
};
document.addEventListener('change', (ev) => { if (ev.target.matches && ev.target.matches('[data-f="ofPhoto"]')) { UI.ofPhotos += ev.target.files ? ev.target.files.length : 0; rerender(); } });
