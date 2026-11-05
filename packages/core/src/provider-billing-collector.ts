import type { ProductHealthSnapshot } from './business-operations.js';

export interface BillingPollResult {
  providerId: string;
  providerName: string;
  source: string;
  observedAt: string;
  readings: ProductHealthSnapshot[];
}
export interface BillingPollFailure {
  providerId: string;
  status: 'not_configured' | 'unavailable';
  reason: string;
}
export interface BillingPollReport {
  results: BillingPollResult[];
  missing: BillingPollFailure[];
}
type JsonObject = Record<string, unknown>;
type Fetcher = typeof fetch;
function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 150) : null;
}
function euro(value: number): number { return Math.round(value * 100) / 100; }
async function jsonRequest(fetcher: Fetcher, url: string, headers: Record<string, string>, body?: unknown): Promise<JsonObject> {
  const res = await fetcher(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('provider HTTP ' + res.status);
  return object(await res.json());
}
const firstDayMs = (now: Date) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
function dayLabel(ts: number): string { return new Date(ts).toISOString().slice(0, 10); }
function reading(providerId: string, when: string, source: string,
  metrics: NonNullable<ProductHealthSnapshot['metrics']>,
  state: ProductHealthSnapshot['state'] = 'unknown'): ProductHealthSnapshot {
  return { productId: providerId, observedAt: when, source, state, metrics };
}
function dateFromUnix(value: unknown): string | null {
  return finite(value) !== null ? new Date(Number(value) * 1000).toISOString() : null;
}
function budget(env: NodeJS.ProcessEnv, key: string): number | null {
  if (!env[key]) return null;
  const raw = Number(env[key]);
  return Number.isFinite(raw) && raw > 0 && raw < 10_000_000 ? euro(raw) : null;
}
function metricIndex(columns: unknown, units: unknown, names: RegExp): number {
  if (!Array.isArray(columns)) return -1;
  const c = columns.map(String);
  const byName = c.findIndex(v => names.test(v));
  if (byName >= 0) return byName;
  return Array.isArray(units) ? units.findIndex(v => typeof v === 'string' && names.test(v)) : -1;
}
function extractElevenCredits(raw: JsonObject): Array<{date: string; credits: number}> {
  const columns = Array.isArray(raw.columns) ? raw.columns.map(String) : [];
  const units = Array.isArray(raw.column_units) ? raw.column_units : [];
  const timeIdx = columns.findIndex(x => /^(time|timestamp|start_time|bucket_start|bucket_start_time|date)$/i.test(x));
  const usageIdx = metricIndex(columns, units, /credit/i);
  if (timeIdx < 0 || usageIdx < 0 || !Array.isArray(raw.rows)) return [];
  const sums = new Map<string, number>();
  for (const row of raw.rows) {
    if (!Array.isArray(row)) continue;
    const time = row[timeIdx];
    const ms = typeof time === 'number' ? (time < 100_000_000_000 ? time * 1000 : time) :
      typeof time === 'string' ? Date.parse(time) : NaN;
    const credit = typeof row[usageIdx] === 'number' ? finite(row[usageIdx]) : null;
    if (!Number.isFinite(ms) || credit === null) continue;
    const day = dayLabel(ms);
    sums.set(day, (sums.get(day) ?? 0) + credit);
  }
  return [...sums.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, credits]) => ({date, credits}));
}
export async function pollElevenLabs(env: NodeJS.ProcessEnv, fetcher: Fetcher, now: Date): Promise<BillingPollResult> {
  const key = env.ELEVENLABS_FINOPS_API_KEY;
  if (!key) throw new Error('not_configured');
  const headers = {'xi-api-key': key, Accept: 'application/json'};
  const sub = await jsonRequest(fetcher, 'https://api.elevenlabs.io/v1/user/subscription', headers);
  const observedAt = now.toISOString();
  const usage = await jsonRequest(fetcher,
    'https://api.elevenlabs.io/v1/workspace/analytics/query/usage-by-product-over-time',
    {...headers, 'Content-Type':'application/json'},
    { start_time: firstDayMs(now), end_time: now.getTime(), interval_seconds: 86400, time_zone: 'UTC' });
  const daily = extractElevenCredits(usage);
  const usageRatio = finite(sub.character_count) !== null && finite(sub.character_limit) !== null && Number(sub.character_limit) > 0
    ? Number(sub.character_count) / Number(sub.character_limit) * 100 : null;
  const status = typeof sub.status === 'string' && ['cancelled','expired','failed','unpaid'].includes(sub.status.toLowerCase()) ? 'down'
    : usageRatio !== null && usageRatio >= 85 ? 'degraded' : 'unknown';
  const overage = object(sub.current_overage);
  const overageCurrency = asString(overage.currency)?.toUpperCase();
  const overageValue = overageCurrency === 'EUR' && typeof overage.amount === 'string' ? Number(overage.amount) : null;
  const last = daily.at(-1);
  const metrics: NonNullable<ProductHealthSnapshot['metrics']> = {
    plan: asString(sub.tier), usageUnit: 'characters',
    charactersUsed: finite(sub.character_count), charactersLimit: finite(sub.character_limit),
    creditsUsed: null, creditsLimit: null,
    // Son unidades diferentes: no inferir que character_count representa créditos.
    creditsToday: last && last.date === dayLabel(now.getTime()) ? last.credits : null,
    creditsThisMonth: daily.length ? daily.reduce((a, b) => a + b.credits, 0) : null,
    renewalDate: dateFromUnix(sub.next_character_count_reset_unix),
    openInvoices: sub.has_open_invoices === true,
    paymentFailed: status === 'down',
    currentOverageEur: overageValue !== null && Number.isFinite(overageValue) ? euro(overageValue) : null,
    // El consumo de créditos NO se convierte a euros sin factura o tarifa verificable.
    spentEur: null,
    budgetEur: budget(env, 'FINOPS_ELEVENLABS_BUDGET_EUR'),
  };
  const readings = daily.map(({date,credits}) => reading('elevenlabs', date+'T12:00:00.000Z',
    'ElevenLabs Workspace Analytics', { creditsToday: credits }, 'unknown'));
  readings.push(reading('elevenlabs', observedAt, 'ElevenLabs Subscription + Workspace Analytics', metrics, status));
  return {providerId:'elevenlabs',providerName:'ElevenLabs',source:'ElevenLabs Subscription + Workspace Analytics',observedAt,readings};
}
async function ecbUsdPerEur(fetcher: Fetcher): Promise<{value: number; date: string}> {
  const res = await fetcher('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
    {signal: AbortSignal.timeout(10_000), cache:'no-store'});
  if (!res.ok) throw new Error('ECB HTTP ' + res.status);
  const xml = await res.text();
  const time = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/i);
  const usd = xml.match(/<Cube\s+currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/i);
  const rate = usd ? Number(usd[1]) : NaN;
  if (!time || !Number.isFinite(rate) || rate <= 0) throw new Error('ECB exchange rate not verified');
  return {value: rate,date:time[1]!};
}
export async function pollOpenAi(env: NodeJS.ProcessEnv, fetcher: Fetcher, now: Date): Promise<BillingPollResult> {
  const key = env.OPENAI_FINOPS_ADMIN_KEY;
  if (!key) throw new Error('not_configured');
  const observedAt = now.toISOString();
  const rate = await ecbUsdPerEur(fetcher);
  // No presentar un tipo de cambio vencido como cotización actual.
  if (now.getTime() - Date.parse(rate.date+'T00:00:00Z') > 5 * 86400_000) throw new Error('ECB exchange rate stale');
  const start = Math.floor(firstDayMs(now)/1000);
  const end = Math.floor(now.getTime()/1000);
  const days = new Map<string, number>();
  let page: string | null = null;
  for (let i=0; i<10; i++) {
    const url = new URL('https://api.openai.com/v1/organization/costs');
    url.searchParams.set('start_time',String(start));
    url.searchParams.set('end_time',String(end));
    url.searchParams.set('bucket_width','1d');
    url.searchParams.set('limit','31');
    if (page) url.searchParams.set('page',page);
    const data = await jsonRequest(fetcher,url.toString(),
      {Authorization:'Bearer '+key,Accept:'application/json'});
    if (!Array.isArray(data.data)) throw new Error('OpenAI costs payload invalid');
    for (const b of data.data) {
      const bucket = object(b);
      if (typeof bucket.start_time !== 'number'||!Array.isArray(bucket.results)) continue;
      const date=dayLabel(bucket.start_time*1000);
      let totalUsd=0;
      for (const raw of bucket.results) {
        const a=object(object(raw).amount);
        if (a.currency !== 'usd'||finite(a.value) === null) throw new Error('OpenAI unexpected cost currency/amount');
        totalUsd += Number(a.value);
      }
      days.set(date,(days.get(date) ?? 0) + totalUsd);
    }
    if (data.has_more !== true) {page=null;break;}
    if(typeof data.next_page!=='string'||!data.next_page)throw new Error('OpenAI cost pagination invalid');
    page=data.next_page;
    if(i===9)throw new Error('OpenAI cost pagination limit exceeded');
  }
  const daily=[...days.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([date,usd])=>({date,eur:euro(usd/rate.value)}));
  const monthCost=euro([...days.values()].reduce((a,b)=>a+b,0)/rate.value);
  const b=budget(env,'FINOPS_OPENAI_BUDGET_EUR');
  const readings = daily.map(({date,eur})=>reading('openai',date+'T12:00:00.000Z',
    'OpenAI Costs API + ECB '+rate.date,{dailySpendEur:eur},'unknown'));
  readings.push(reading('openai',observedAt,'OpenAI Costs API + ECB '+rate.date,{
    spentEur:monthCost,budgetEur:b,
    exchangeUsdPerEur:rate.value, exchangeDate:rate.date,exchangeMethod:'Indicativo BCE, no importe facturado',
    dailySpendEur: daily.find(x=>x.date===dayLabel(now.getTime()))?.eur ?? null,
  }, b && monthCost >= b*0.85 ? 'degraded' : 'unknown'));
  return {providerId:'openai',providerName:'OpenAI API',source:'OpenAI Costs API + ECB',observedAt,readings};
}
export async function pollBillingSources(env: NodeJS.ProcessEnv, fetcher: Fetcher = fetch,
  now: Date = new Date()): Promise<BillingPollReport> {
  const configured = [
    {id:'elevenlabs',key:'ELEVENLABS_FINOPS_API_KEY',poll:pollElevenLabs},
    {id:'openai',key:'OPENAI_FINOPS_ADMIN_KEY',poll:pollOpenAi},
  ];
  const results: BillingPollResult[] = [], missing: BillingPollFailure[] = [];
  for (const p of configured) {
    if (!env[p.key]) {missing.push({providerId:p.id,status:'not_configured',reason:'Falta credencial de solo lectura en servidor'});continue;}
    try {results.push(await p.poll(env,fetcher,now));}
    catch (e) {
      const message = e instanceof Error && /^provider HTTP \d{3}$/.test(e.message) ? e.message
        : 'error de integración o validación de fuente';
      missing.push({providerId:p.id,status:'unavailable',reason:message});
    }
  }
  return {results,missing};
}
