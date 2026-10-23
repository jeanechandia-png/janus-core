/**
 * Investigación avanzada por capas, con verificación y auditoría de fuentes.
 *
 * L0 Planificador → divide la pregunta en ángulos.
 * L1 Exploradores (researcher, en paralelo, uno por ángulo) → fuentes + afirmaciones con cita textual.
 * L2 Verificador cruzado (verifier) → cada afirmación necesita fuentes independientes; prioriza nivel A.
 * L3 Auditor independiente (verifier, sin ver el razonamiento de L1) → comprueba que la fuente existe,
 *    que la cita aparece en el texto, que no está retractada y que no hay contradicciones.
 * L4 Síntesis (synthesizer) → informe con VERIFICADO / PROBABLE / POR CONFIRMAR / DESCARTADO.
 *
 * Prioridad de fuentes (Jean, 22-10-2026): universidades de prestigio (Stanford, Harvard…) y revistas
 * arbitradas primero, pero nunca una sola fuente.
 */
import type { AgentRole } from './agent-swarm.js';

export type SourceTier = 'A' | 'A-' | 'B' | 'C';

export interface Source {
  url: string;
  title?: string;
  doi?: string;
  publishedAt?: string;
  /** Rellenado por el host al descargar la página (L3). */
  fetched?: { ok: boolean; status?: number; text?: string; retracted?: boolean };
}

const ELITE = ['stanford.edu', 'harvard.edu', 'mit.edu', 'ox.ac.uk', 'cam.ac.uk', 'berkeley.edu', 'yale.edu', 'princeton.edu', 'caltech.edu', 'columbia.edu', 'uchicago.edu', 'ethz.ch', 'uva.nl', 'tudelft.nl', 'uu.nl', 'leidenuniv.nl', 'ru.nl', 'wur.nl', 'ucl.ac.uk', 'imperial.ac.uk', 'jhu.edu', 'upenn.edu'];
const JOURNALS = ['nature.com', 'science.org', 'thelancet.com', 'nejm.org', 'bmj.com', 'cell.com', 'pnas.org', 'jamanetwork.com', 'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'apa.org', 'publications.aap.org', 'sciencedirect.com', 'springer.com', 'wiley.com', 'arxiv.org', 'acm.org', 'ieee.org', 'cochranelibrary.com'];
const OFFICIAL = ['who.int', 'oecd.org', 'europa.eu', 'un.org', 'worldbank.org', 'imf.org', 'rijksoverheid.nl', 'cbs.nl', 'rivm.nl', 'nih.gov', 'cdc.gov'];
const REFERENCE = ['reuters.com', 'apnews.com', 'bbc.co.uk', 'bbc.com', 'ft.com', 'economist.com', 'nytimes.com', 'nos.nl', 'elpais.com', 'theguardian.com', 'britannica.com'];
const LOW = ['medium.com', 'substack.com', 'reddit.com', 'quora.com', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'blogspot.com', 'wordpress.com'];

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}
const matches = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith('.' + d));

export function classifySource(s: Source): { tier: SourceTier; reason: string; elite: boolean } {
  const h = hostOf(s.url);
  if (!h) return { tier: 'C', reason: 'URL no válida', elite: false };
  if (matches(h, ELITE)) return { tier: 'A', reason: 'universidad de prestigio', elite: true };
  if (s.doi || matches(h, JOURNALS)) return { tier: 'A', reason: 'revista arbitrada / índice científico', elite: false };
  if (/\.(edu|ac\.[a-z]{2})$/.test(h)) return { tier: 'A-', reason: 'institución académica', elite: false };
  if (matches(h, OFFICIAL) || /\.(gov|gob\.[a-z]{2}|gouv\.fr)$/.test(h)) return { tier: 'A-', reason: 'organismo oficial', elite: false };
  if (matches(h, LOW)) return { tier: 'C', reason: 'blog, foro o red social', elite: false };
  if (matches(h, REFERENCE)) return { tier: 'B', reason: 'medio de referencia', elite: false };
  return { tier: 'C', reason: 'fuente no catalogada (revisar)', elite: false };
}

const RANK: Record<SourceTier, number> = { A: 3, 'A-': 2, B: 1, C: 0 };

/** Ordena fuentes: universidades élite primero, luego por nivel y por fecha más reciente. */
export function rankSources(sources: Source[]): Array<Source & { tier: SourceTier; elite: boolean }> {
  return sources.map((s) => ({ ...s, ...classifySource(s) }))
    .sort((a, b) => Number(b.elite) - Number(a.elite) || RANK[b.tier] - RANK[a.tier] || (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0));
}

export interface Claim { id: string; text: string; evidence: Array<{ url: string; quote: string }> }

export type Verdict = 'VERIFICADO' | 'PROBABLE' | 'POR CONFIRMAR' | 'DESCARTADO';
export interface ClaimAudit { claimId: string; verdict: Verdict; independentDomains: number; bestTier: SourceTier | null; flags: string[] }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** L2 + L3: verificación cruzada y auditoría. `sources` debe traer `fetched` rellenado por el host. */
export function auditClaim(claim: Claim, sources: Source[], opts: { minIndependent?: number; requireTierA?: boolean } = {}): ClaimAudit {
  const minIndependent = opts.minIndependent ?? 2, requireTierA = opts.requireTierA ?? true;
  const byUrl = new Map(sources.map((s) => [s.url, s]));
  const flags: string[] = []; const domains = new Set<string>(); let best: SourceTier | null = null; let refuted = false;
  for (const ev of claim.evidence) {
    const s = byUrl.get(ev.url);
    if (!s) { flags.push('fuente no registrada: ' + ev.url); continue; }
    if (s.fetched && !s.fetched.ok) { flags.push('enlace caído: ' + ev.url); continue; }
    if (s.fetched?.retracted) { flags.push('retractada: ' + ev.url); refuted = true; continue; }
    if (s.fetched?.text !== undefined && !norm(s.fetched.text).includes(norm(ev.quote))) { flags.push('cita no encontrada en ' + hostOf(ev.url)); continue; }
    if (!s.fetched) flags.push('sin comprobar (no descargada): ' + hostOf(ev.url));
    const { tier } = classifySource(s);
    if (best === null || RANK[tier] > RANK[best]) best = tier;
    if (s.fetched?.ok) domains.add(hostOf(ev.url).split('.').slice(-2).join('.'));
  }
  const n = domains.size; const tierOk = !requireTierA || (best !== null && RANK[best] >= RANK['A-']);
  let verdict: Verdict;
  if (refuted || (claim.evidence.length > 0 && n === 0 && flags.every((f) => !f.startsWith('sin comprobar')))) verdict = 'DESCARTADO';
  else if (n >= minIndependent && tierOk) verdict = 'VERIFICADO';
  else if (n >= 1 && best !== null && RANK[best] >= RANK['B']) verdict = 'PROBABLE';
  else verdict = 'POR CONFIRMAR';
  if (n < minIndependent) flags.push('fuentes independientes: ' + n + '/' + minIndependent);
  if (!tierOk) flags.push('sin fuente de nivel A');
  return { claimId: claim.id, verdict, independentDomains: n, bestTier: best, flags };
}

export interface ResearchLayer { layer: 0 | 1 | 2 | 3 | 4; role: AgentRole; task: string; parallel: boolean; isolatedFrom?: number[] }

/** Plan por capas para el enjambre (encaja con buildAgentSwarm vía roles). */
export function planLayeredResearch(question: string, angles: string[]): ResearchLayer[] {
  const a = angles.length ? angles : ['evidencia científica', 'datos oficiales', 'casos prácticos', 'críticas y contraevidencia'];
  return [
    { layer: 0, role: 'analyst', task: 'Descomponer: ' + question, parallel: false },
    ...a.map((x) => ({ layer: 1 as const, role: 'researcher' as AgentRole, task: x + ' — priorizar universidades de prestigio y revistas arbitradas; múltiples fuentes; cita textual por afirmación', parallel: true })),
    { layer: 2, role: 'verifier', task: 'Verificación cruzada: ≥2 dominios independientes por afirmación, al menos uno de nivel A', parallel: true },
    { layer: 3, role: 'verifier', task: 'Auditoría independiente: existencia, cita literal, retractaciones, fechas, contradicciones', parallel: true, isolatedFrom: [1] },
    { layer: 4, role: 'synthesizer', task: 'Informe con veredictos (VERIFICADO / PROBABLE / POR CONFIRMAR / DESCARTADO) y bibliografía', parallel: false }
  ];
}
