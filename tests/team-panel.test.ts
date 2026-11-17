import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Browser ESM component without a declaration file.
import { initialOf, normalizePresence, teamHref } from '../apps/pwa/team-panel.js';

const text = (path: string) => readFileSync(path, 'utf8');

test('Mi equipo: una luz por persona, ordenadas por actividad, y estados desconocidos se apagan', () => {
  const view = normalizePresence({
    members: [
      { principalId: 'p3', displayName: 'Carla', state: 'offline', seenSecondsAgo: 600 },
      { principalId: 'p1', displayName: 'Ana', state: 'working', sessionSince: '2026-11-10T19:00:00Z' },
      { principalId: 'p2', displayName: 'Bruno', state: 'online' },
      { principalId: 'p4', displayName: 'Dora', state: 'hacking' },
    ],
    attention: { blocked: 1, unread: 2 },
  });
  assert.deepEqual(view.members.map((m: { name: string; state: string }) => `${m.name}:${m.state}`), ['Ana:working', 'Bruno:online', 'Carla:offline', 'Dora:offline']);
  assert.equal(view.working, 1); assert.equal(view.online, 2); assert.equal(view.attention, 3);
  assert.deepEqual(normalizePresence(null), { members: [], working: 0, online: 0, attention: 0 });
  assert.equal(initialOf('  élise'), 'É'); assert.equal(initialOf(''), '·');
});

test('Mi equipo solo enlaza a la vista de equipo y solo deja volver a una dashboard del Núcleo', () => {
  assert.equal(teamHref('/dashboard/b'), '/work/team?back=%2Fdashboard%2Fb');
  assert.equal(teamHref('https://evil.example/'), '/work/team?back=%2Fdashboard%2Fa');
  assert.equal(teamHref('//evil.example'), '/work/team?back=%2Fdashboard%2Fa');
  assert.equal(teamHref(undefined), '/work/team?back=%2Fdashboard%2Fa');
});

test('dashboards aprobadas intactas: la tarjeta vive en la capa de acceso y queda en caché offline', () => {
  const bridge = text('apps/pwa/dashboard-access.js');
  const panel = text('apps/pwa/team-panel.js');
  const css = text('apps/pwa/dashboard-access.css');
  assert.match(bridge, /mountTeamPanel\(/); assert.ok(bridge.includes('quick.after(team.card)'));
  assert.ok(!panel.includes('innerHTML'), 'solo texto DOM, nunca HTML');
  assert.match(panel, /\/api\/work\/team\/presence/);
  assert.ok(css.includes('.janus-team-card:active'), 'la tarjeta se hunde al tocarla');
  assert.ok(text('apps/pwa/sw.js').includes("'/team-panel.js'"));
  for (const file of ['Janus-Core-A-public-safe.html', 'Janus-Core-B-public-safe.html']) {
    assert.ok(!text('prototypes/dashboard/dist/' + file).includes('janus-team'), `${file} no se edita`);
  }
});

test('la vista de equipo conserva el sello oficial y el título «¿Cómo va el equipo?»', () => {
  const teamView = text('prototypes/dashboard/work/work-team.js');
  assert.ok(teamView.includes('¿Cómo va el equipo?'));
  assert.ok(teamView.includes("BACK_ALLOWED = ['/dashboard/a', '/dashboard/b', '/']"));
  assert.ok(text('prototypes/dashboard/work/build-work.cjs').includes('infinityseed-group-logo.webp'));
});
