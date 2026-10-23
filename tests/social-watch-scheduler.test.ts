import assert from 'node:assert/strict';
import test from 'node:test';
import { createSocialChannelSnapshot } from '../packages/core/src/business-operations.js';
import { runSocialWatch, type SocialWatchReport, type WatchPlanItem } from '../packages/core/src/social-watch.js';
import { MIN_WATCH_INTERVAL_MS, SocialWatchScheduler, parseWatchIntervalMinutes } from '../packages/core/src/social-watch-scheduler.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

function report(overrides: Partial<SocialWatchReport['summary']> = {}): SocialWatchReport {
  return { generatedAt: '2026-10-23T10:00:00.000Z', items: [], summary: { read: 1, skipped: 0, failed: 0, alerts: 0, ...overrides } };
}

/** Temporizadores controlados a mano. */
function manualTimers() {
  const pending = new Map<number, { callback: () => void; ms: number }>();
  let next = 1;
  return {
    setTimer: (callback: () => void, ms: number) => { const id = next++; pending.set(id, { callback, ms }); return id; },
    clearTimer: (handle: unknown) => { pending.delete(handle as number); },
    pending,
    async fire() {
      const [id, timer] = [...pending.entries()][0]!;
      pending.delete(id);
      timer.callback();
      // Deja que la ejecución asíncrona termine y se reprograme.
      for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test('intervalo: vacío o 0 = desactivado; por debajo de 15 min se sube a 15; el planificador exige ≥ 15 min', () => {
  assert.equal(parseWatchIntervalMinutes(undefined), null);
  assert.equal(parseWatchIntervalMinutes(''), null);
  assert.equal(parseWatchIntervalMinutes('0'), null);
  assert.equal(parseWatchIntervalMinutes('abc'), null);
  assert.equal(parseWatchIntervalMinutes('-5'), null);
  assert.equal(parseWatchIntervalMinutes('1'), MIN_WATCH_INTERVAL_MS);
  assert.equal(parseWatchIntervalMinutes('60'), 3_600_000);
  assert.throws(() => new SocialWatchScheduler({ intervalMs: 1000, run: async () => report() }), /at least 15 minutes/);
});

test('planificador: primera ejecución tras el retraso inicial, luego cada intervalo; stop() cancela', async () => {
  const timers = manualTimers();
  let runs = 0;
  const scheduler = new SocialWatchScheduler({ intervalMs: MIN_WATCH_INTERVAL_MS, initialDelayMs: 5_000, run: async () => { runs += 1; return report(); }, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  assert.equal(scheduler.status().enabled, false);
  scheduler.start();
  scheduler.start(); // idempotente
  assert.equal(timers.pending.size, 1);
  assert.equal([...timers.pending.values()][0]!.ms, 5_000);
  assert.equal(scheduler.status().enabled, true);
  assert.ok(scheduler.status().nextRunAt);

  await timers.fire();
  assert.equal(runs, 1);
  assert.equal([...timers.pending.values()][0]!.ms, MIN_WATCH_INTERVAL_MS);
  assert.equal(scheduler.status().consecutiveFailures, 0);
  assert.deepEqual(scheduler.status().lastSummary, { read: 1, skipped: 0, failed: 0, alerts: 0 });

  scheduler.stop();
  assert.equal(timers.pending.size, 0);
  assert.equal(scheduler.status().enabled, false);
  assert.equal(scheduler.status().nextRunAt, null);
});

test('planificador: nunca dos ejecuciones a la vez (runNow comparte la que está en curso)', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let runs = 0;
  const scheduler = new SocialWatchScheduler({ intervalMs: MIN_WATCH_INTERVAL_MS, run: async () => { runs += 1; await gate; return report(); } });
  const a = scheduler.runNow();
  const b = scheduler.runNow();
  assert.equal(a, b);
  assert.equal(scheduler.status().running, true);
  release();
  await a;
  assert.equal(runs, 1);
  assert.equal(scheduler.status().running, false);
  assert.ok(scheduler.status().lastDurationMs !== null);
  await scheduler.runNow();
  assert.equal(runs, 2);
});

test('planificador: los fallos alargan la espera (retroceso exponencial con tope) y un éxito la restablece; nada listo no es un fallo', async () => {
  const timers = manualTimers();
  let mode: 'throw' | 'all-failed' | 'ok' | 'nothing-ready' = 'throw';
  const errors: unknown[] = [];
  const scheduler = new SocialWatchScheduler({
    intervalMs: MIN_WATCH_INTERVAL_MS,
    initialDelayMs: 1,
    maxBackoffMs: 4 * MIN_WATCH_INTERVAL_MS,
    run: async () => {
      if (mode === 'throw') throw new Error('red caída');
      if (mode === 'all-failed') return report({ read: 0, failed: 2 });
      if (mode === 'nothing-ready') return report({ read: 0, failed: 0, skipped: 5 });
      return report();
    },
    onError: (error) => errors.push(error),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  scheduler.start();
  await timers.fire();
  assert.equal(scheduler.status().consecutiveFailures, 1);
  assert.match(scheduler.status().lastError ?? '', /red caída/);
  assert.equal(errors.length, 1);
  assert.equal([...timers.pending.values()][0]!.ms, 2 * MIN_WATCH_INTERVAL_MS);

  mode = 'all-failed';
  await timers.fire();
  assert.equal(scheduler.status().consecutiveFailures, 2);
  assert.equal([...timers.pending.values()][0]!.ms, 4 * MIN_WATCH_INTERVAL_MS);

  await timers.fire();
  assert.equal(scheduler.status().consecutiveFailures, 3);
  assert.equal([...timers.pending.values()][0]!.ms, 4 * MIN_WATCH_INTERVAL_MS, 'respeta el tope');

  mode = 'nothing-ready';
  await timers.fire();
  assert.equal(scheduler.status().consecutiveFailures, 0, 'que nada esté listo todavía no es un fallo');
  assert.equal([...timers.pending.values()][0]!.ms, MIN_WATCH_INTERVAL_MS);
  assert.equal(scheduler.status().lastError, null);
  scheduler.stop();
});

test('persistencia: cada lectura se guarda como instantánea "social-watch" y la siguiente la compara (sube/baja se detecta)', async () => {
  const store = new SqliteStore(':memory:');
  const plan: WatchPlanItem[] = [
    { referenceId: 'th-marca', label: 'Marca en Threads', platform: 'threads', scope: 'business', readiness: 'ready', nextStep: '', tool: 'threads-insights', action: 'threads.account.insights', input: { userId: 'me' } },
    { referenceId: 'ig-pendiente', label: 'Instagram', platform: 'instagram', scope: 'business', readiness: 'needs_auth', nextStep: 'Falta token de Meta.' },
  ];
  let views = 1000;
  const tools = {
    execute: async () => ({ ok: true, output: { data: [{ name: 'views', total_value: { value: views } }, { name: 'followers_count', total_value: { value: 500 } }] } }),
  };
  const platformOf = new Map(plan.map((item) => [item.referenceId, item.platform] as const));
  const deps = (at: string) => ({
    tools,
    now: () => new Date(at),
    loadPrevious: (referenceId: string) => {
      const previous = store.latestSocialChannelSnapshot(platformOf.get(referenceId)!, referenceId, 'social-watch');
      return previous ? { referenceId, at: previous.verifiedAt, metrics: Object.fromEntries(Object.entries(previous.metrics).filter((e): e is [string, number] => typeof e[1] === 'number')) } : undefined;
    },
    save: (item: { referenceId: string; at: string; metrics: Record<string, number> }) => {
      store.upsertSocialChannelSnapshot(createSocialChannelSnapshot({
        id: `social-watch:${item.referenceId}:${item.at.replace(/[^0-9]/g, '').slice(0, 17)}`,
        platform: platformOf.get(item.referenceId)!,
        channelId: item.referenceId,
        verifiedAt: item.at,
        source: 'social-watch',
        metrics: item.metrics,
        monetizationState: 'unknown',
      }));
    },
  });

  const first = await runSocialWatch(plan, deps('2026-10-23T10:00:00.000Z'));
  assert.equal(first.summary.read, 1);
  assert.equal(first.summary.skipped, 1);
  assert.equal(first.items[0]!.firstSnapshot, true);
  assert.deepEqual(first.items[0]!.metrics, { views: 1000, followers_count: 500 });

  views = 400; // caída fuerte
  const second = await runSocialWatch(plan, deps('2026-10-23T16:00:00.000Z'));
  assert.equal(second.items[0]!.firstSnapshot, undefined);
  assert.ok(second.summary.alerts >= 1, 'la caída de visualizaciones genera una alerta');
  assert.match(second.items[0]!.alerts.join(' '), /views/);

  const all = store.listSocialChannelSnapshots();
  assert.equal(all.length, 2, 'una foto por lectura: se conserva el histórico');
  assert.ok(all.every((snapshot) => snapshot.source === 'social-watch' && snapshot.monetizationState === 'unknown' && snapshot.productId === undefined));
  const latest = store.latestSocialChannelSnapshot('threads', 'th-marca', 'social-watch');
  assert.equal(latest!.metrics.views, 400);
  assert.equal(store.latestSocialChannelSnapshot('threads', 'th-marca', 'otro-origen'), undefined, 'otro origen no se mezcla');
  assert.equal(store.latestSocialChannelSnapshot('instagram', 'ig-pendiente', 'social-watch'), undefined, 'lo omitido no guarda nada');
});
