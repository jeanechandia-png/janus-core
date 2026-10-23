/**
 * Pure helpers for the cross-agent continuity scan (`npm run continuity`).
 * Goal: any agent arriving at the project can see what exists, what is open and where work could collide,
 * so it continues from the previous agent instead of duplicating or restarting.
 */
export interface RefFile { ref: string; path: string }

export interface AdrCollision { number: string; files: Array<{ path: string; refs: string[] }> }

/** ADR numbers used by different files on different branches (e.g. two agents both creating ADR-009). */
export function findAdrCollisions(entries: readonly RefFile[]): AdrCollision[] {
  const byNumber = new Map<string, Map<string, Set<string>>>();
  for (const { ref, path } of entries) {
    const match = /(?:^|\/)ADR-(\d{3})[^/]*\.md$/.exec(path);
    if (!match) continue;
    const files = byNumber.get(match[1]!) ?? new Map<string, Set<string>>();
    const refs = files.get(path) ?? new Set<string>();
    refs.add(ref);
    files.set(path, refs);
    byNumber.set(match[1]!, files);
  }
  return [...byNumber.entries()]
    .filter(([, files]) => files.size > 1)
    .map(([number, files]) => ({ number, files: [...files.entries()].map(([path, refs]) => ({ path, refs: [...refs].sort() })) }))
    .sort((a, b) => a.number.localeCompare(b.number));
}

export function nextFreeAdrNumber(entries: readonly RefFile[]): string {
  let max = 0;
  for (const { path } of entries) {
    const match = /(?:^|\/)ADR-(\d{3})/.exec(path);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1).padStart(3, '0');
}

export interface OpenPr { number: number; head: string; base: string; title: string; draft?: boolean }

/** Orders PRs so that stacked PRs appear under the PR they depend on. */
export function stackOutline(prs: readonly OpenPr[]): string[] {
  const heads = new Set(prs.map((pr) => pr.head));
  const children = new Map<string, OpenPr[]>();
  for (const pr of prs) children.set(pr.base, [...(children.get(pr.base) ?? []), pr]);
  const lines: string[] = [];
  const walk = (base: string, depth: number) => {
    for (const pr of (children.get(base) ?? []).sort((a, b) => a.number - b.number)) {
      lines.push(`${'  '.repeat(depth)}#${pr.number} ${pr.head} → ${pr.base}${pr.draft ? ' (borrador)' : ''} — ${pr.title}`);
      walk(pr.head, depth + 1);
    }
  };
  const roots = [...new Set(prs.map((pr) => pr.base))].filter((base) => !heads.has(base));
  for (const root of roots) walk(root, 0);
  return lines;
}

/**
 * Returns the most recent "## Handoff YYYY-MM-DD ..." section of STATE.md (by date in the heading,
 * not by position), so an agent never resumes from a stale handoff. Undefined when none exists.
 */
export function latestHandoff(markdown: string): { heading: string; body: string[] } | undefined {
  const lines = markdown.split('\n');
  const sections: Array<{ date: string; start: number }> = [];
  lines.forEach((line, index) => {
    const date = /^## Handoff (\d{4}-\d{2}-\d{2})/.exec(line)?.[1];
    if (date) sections.push({ date, start: index });
  });
  if (sections.length === 0) return undefined;
  // Stable: among equal dates, the later one in the file wins.
  const latest = sections.reduce((best, current) => (current.date >= best.date ? current : best));
  let end = lines.length;
  for (let i = latest.start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i] ?? '')) { end = i; break; }
  }
  return { heading: lines[latest.start] ?? '', body: lines.slice(latest.start + 1, end) };
}
