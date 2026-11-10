import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Browser ESM component without a declaration file.
import { summarizeTeam, teamHref } from '../apps/pwa/team-chip.js';

const text = (path: string) => readFileSync(path, 'utf8');

test('team chip summarises only the two numbers the team view already shows', () => {
  assert.deepEqual(summarizeTeam(null), { working: 0, attention: 0, blocked: 0, unread: 0 });
  const data = {
    members: [{ openSession: { state: 'running' } }, { openSession: { state: 'paused' } }, { openSession: null }],
    assignments: [{ assignment: { status: 'blocked' } }, { assignment: { status: 'active' } }, { assignment: { status: 'blocked' } }],
    messages: [
      { status: 'delivered', readAt: null },
      { status: 'delivered', readAt: '2026-11-10T10:00:00Z' },
      { status: 'rejected', readAt: null },
    ],
  };
  assert.deepEqual(summarizeTeam(data), { working: 1, attention: 3, blocked: 2, unread: 1 });
});

test('team chip only links to the team view and only lets it return to a Core dashboard', () => {
  assert.equal(teamHref('/dashboard/b'), '/work/team?back=%2Fdashboard%2Fb');
  assert.equal(teamHref('/dashboard/a'), '/work/team?back=%2Fdashboard%2Fa');
  assert.equal(teamHref('https://evil.example/'), '/work/team?back=%2Fdashboard%2Fa');
  assert.equal(teamHref('//evil.example'), '/work/team?back=%2Fdashboard%2Fa');
  assert.equal(teamHref(undefined), '/work/team?back=%2Fdashboard%2Fa');
});

test('approved dashboards stay untouched: the chip lives in the access layer and is offline-cached', () => {
  const bridge = text('apps/pwa/dashboard-access.js');
  const chip = text('apps/pwa/team-chip.js');
  const css = text('apps/pwa/dashboard-access.css');
  const sw = text('apps/pwa/sw.js');
  assert.match(bridge, /mountTeamChip\(/);
  assert.ok(bridge.includes('controls.prepend(teamChip.element)'));
  assert.ok(!chip.includes('innerHTML'), 'DOM text only, never HTML strings');
  assert.match(chip, /\/api\/work\/team/);
  assert.ok(css.includes('.janus-team-chip'));
  assert.ok(sw.includes("'/team-chip.js'"));
  for (const file of ['Janus-Core-A-public-safe.html', 'Janus-Core-B-public-safe.html']) {
    assert.ok(!text('prototypes/dashboard/dist/' + file).includes('janus-team-chip'), `${file} must not be edited`);
  }
});

test('team view keeps the brand seal and the "¿Cómo va el equipo?" title', () => {
  const team = text('prototypes/dashboard/work/work-team.js');
  const build = text('prototypes/dashboard/work/build-work.cjs');
  assert.ok(team.includes('¿Cómo va el equipo?'));
  assert.ok(team.includes("BACK_ALLOWED = ['/dashboard/a', '/dashboard/b', '/']"));
  assert.ok(build.includes('infinityseed-group-logo.webp'));
});
