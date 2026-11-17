"use strict";
var CitedAnswer = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // .cited-entry.ts
  var cited_entry_exports = {};
  __export(cited_entry_exports, {
    canonicalUrl: () => canonicalUrl,
    factualSentences: () => factualSentences,
    numberSources: () => numberSources,
    parseMarkers: () => parseMarkers,
    verifyCitedAnswer: () => verifyCitedAnswer
  });

  // packages/core/src/citation-ledger.ts
  function validateCitationLedger(ledger) {
    const errors = [];
    const sourceIds = /* @__PURE__ */ new Set();
    for (const source of ledger.sources) {
      if (!source.id.trim()) errors.push("citation source id is required");
      if (sourceIds.has(source.id)) errors.push(`duplicate citation source id: ${source.id}`);
      sourceIds.add(source.id);
    }
    for (const item of ledger.claims) {
      if (!item.claim.trim()) errors.push("supported claim cannot be empty");
      if (item.citations.length === 0) errors.push(`claim has no citations: ${item.claim.slice(0, 80)}`);
      for (const citation of item.citations) {
        if (!sourceIds.has(citation.sourceId)) {
          errors.push(`claim references unknown citation source: ${citation.sourceId}`);
        }
      }
    }
    return { ok: errors.length === 0, errors };
  }

  // packages/orchestrator/src/research-verification.ts
  var ELITE = ["stanford.edu", "harvard.edu", "mit.edu", "ox.ac.uk", "cam.ac.uk", "berkeley.edu", "yale.edu", "princeton.edu", "caltech.edu", "columbia.edu", "uchicago.edu", "ethz.ch", "uva.nl", "tudelft.nl", "uu.nl", "leidenuniv.nl", "ru.nl", "wur.nl", "ucl.ac.uk", "imperial.ac.uk", "jhu.edu", "upenn.edu"];
  var JOURNALS = ["nature.com", "science.org", "thelancet.com", "nejm.org", "bmj.com", "cell.com", "pnas.org", "jamanetwork.com", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "apa.org", "publications.aap.org", "sciencedirect.com", "springer.com", "wiley.com", "arxiv.org", "acm.org", "ieee.org", "cochranelibrary.com"];
  var OFFICIAL = ["who.int", "oecd.org", "europa.eu", "un.org", "worldbank.org", "imf.org", "rijksoverheid.nl", "cbs.nl", "rivm.nl", "nih.gov", "cdc.gov"];
  var REFERENCE = ["reuters.com", "apnews.com", "bbc.co.uk", "bbc.com", "ft.com", "economist.com", "nytimes.com", "nos.nl", "elpais.com", "theguardian.com", "britannica.com"];
  var LOW = ["medium.com", "substack.com", "reddit.com", "quora.com", "x.com", "twitter.com", "facebook.com", "instagram.com", "tiktok.com", "youtube.com", "blogspot.com", "wordpress.com"];
  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }
  var matches = (host, list) => list.some((d) => host === d || host.endsWith("." + d));
  function classifySource(s) {
    const h = hostOf(s.url);
    if (!h) return { tier: "C", reason: "URL no v\xE1lida", elite: false };
    if (matches(h, ELITE)) return { tier: "A", reason: "universidad de prestigio", elite: true };
    if (s.doi || matches(h, JOURNALS)) return { tier: "A", reason: "revista arbitrada / \xEDndice cient\xEDfico", elite: false };
    if (/\.(edu|ac\.[a-z]{2})$/.test(h)) return { tier: "A-", reason: "instituci\xF3n acad\xE9mica", elite: false };
    if (matches(h, OFFICIAL) || /\.(gov|gob\.[a-z]{2}|gouv\.fr)$/.test(h)) return { tier: "A-", reason: "organismo oficial", elite: false };
    if (matches(h, LOW)) return { tier: "C", reason: "blog, foro o red social", elite: false };
    if (matches(h, REFERENCE)) return { tier: "B", reason: "medio de referencia", elite: false };
    return { tier: "C", reason: "fuente no catalogada (revisar)", elite: false };
  }
  var RANK = { A: 3, "A-": 2, B: 1, C: 0 };
  function rankSources(sources) {
    return sources.map((s) => ({ ...s, ...classifySource(s) })).sort((a, b) => Number(b.elite) - Number(a.elite) || RANK[b.tier] - RANK[a.tier] || (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0));
  }
  var norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  function auditClaim(claim, sources, opts = {}) {
    const minIndependent = opts.minIndependent ?? 2, requireTierA = opts.requireTierA ?? true;
    const byUrl = new Map(sources.map((s) => [s.url, s]));
    const flags = [];
    const domains = /* @__PURE__ */ new Set();
    let best = null;
    let refuted = false;
    for (const ev of claim.evidence) {
      const s = byUrl.get(ev.url);
      if (!s) {
        flags.push("fuente no registrada: " + ev.url);
        continue;
      }
      if (s.fetched && !s.fetched.ok) {
        flags.push("enlace ca\xEDdo: " + ev.url);
        continue;
      }
      if (s.fetched?.retracted) {
        flags.push("retractada: " + ev.url);
        refuted = true;
        continue;
      }
      if (s.fetched?.text !== void 0 && !norm(s.fetched.text).includes(norm(ev.quote))) {
        flags.push("cita no encontrada en " + hostOf(ev.url));
        continue;
      }
      if (!s.fetched) flags.push("sin comprobar (no descargada): " + hostOf(ev.url));
      const { tier } = classifySource(s);
      if (best === null || RANK[tier] > RANK[best]) best = tier;
      if (s.fetched?.ok) domains.add(hostOf(ev.url).split(".").slice(-2).join("."));
    }
    const n = domains.size;
    const tierOk = !requireTierA || best !== null && RANK[best] >= RANK["A-"];
    let verdict;
    if (refuted || claim.evidence.length > 0 && n === 0 && flags.every((f) => !f.startsWith("sin comprobar"))) verdict = "DESCARTADO";
    else if (n >= minIndependent && tierOk) verdict = "VERIFICADO";
    else if (n >= 1 && best !== null && RANK[best] >= RANK["B"]) verdict = "PROBABLE";
    else verdict = "POR CONFIRMAR";
    if (n < minIndependent) flags.push("fuentes independientes: " + n + "/" + minIndependent);
    if (!tierOk) flags.push("sin fuente de nivel A");
    return { claimId: claim.id, verdict, independentDomains: n, bestTier: best, flags };
  }

  // packages/orchestrator/src/cited-answer.ts
  var TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$)/i;
  function canonicalUrl(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") return "";
      u.hash = "";
      u.hostname = u.hostname.replace(/^www\./i, "").toLowerCase();
      for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
      let out = u.toString();
      if (out.endsWith("/") && u.pathname === "/" && !u.search) out = out.slice(0, -1);
      return out;
    } catch {
      return "";
    }
  }
  function numberSources(hits, opts = {}) {
    const seen = /* @__PURE__ */ new Map();
    for (const hit of hits) {
      const key = canonicalUrl(hit.url);
      if (!key) continue;
      const prev = seen.get(key);
      seen.set(key, prev ? { ...prev, ...hit, url: key, snippet: hit.snippet ?? prev.snippet, text: hit.text ?? prev.text } : { ...hit, url: key });
    }
    const ranked = rankSources([...seen.values()].map((h) => ({ url: h.url, ...h.title ? { title: h.title } : {}, ...h.publishedAt ? { publishedAt: h.publishedAt } : {} })));
    const byUrl = new Map([...seen.values()].map((h) => [h.url, h]));
    return ranked.slice(0, opts.max ?? 8).map((s, i) => {
      const hit = byUrl.get(s.url);
      const tierInfo = classifySource(s);
      return {
        n: i + 1,
        url: s.url,
        title: (hit.title ?? hostOf(s.url)).slice(0, 200),
        domain: hostOf(s.url),
        tier: s.tier,
        tierReason: tierInfo.reason,
        elite: s.elite,
        ...hit.publishedAt ? { publishedAt: hit.publishedAt } : {},
        ...hit.text ?? hit.snippet ? { snippet: (hit.text ?? hit.snippet).slice(0, 2e3) } : {},
        basis: hit.text ? "pagina" : "fragmento"
      };
    });
  }
  var MARKER = /\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]/g;
  function parseMarkers(sentence) {
    const out = /* @__PURE__ */ new Set();
    for (const m of sentence.matchAll(MARKER)) {
      for (const part of m[1].split(",")) {
        const range = part.trim().split(/[–-]/);
        if (range.length === 2) {
          const a = Number(range[0]), b = Number(range[1]);
          if (a <= b && b - a < 20) for (let k = a; k <= b; k++) out.add(k);
        } else out.add(Number(range[0]));
      }
    }
    return [...out];
  }
  function factualSentences(text) {
    const body = text.split(/\n\s*(?:\*\*)?Fuentes(?:\*\*)?\s*:?\s*\n/i)[0] ?? text;
    return body.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.replace(/^[\s>*\-•#\d.)]+/, "").trim()).filter((s) => s.replace(MARKER, "").trim().split(/\s+/).length >= 5 && !s.endsWith("?"));
  }
  function verifyCitedAnswer(input) {
    const { question, text, sources } = input;
    const max = sources.length;
    const warnings = [];
    const sentences = factualSentences(text);
    const invalid = /* @__PURE__ */ new Set();
    const usedSet = /* @__PURE__ */ new Set();
    const uncited = [];
    let supported = 0;
    for (const s of sentences) {
      const marks = parseMarkers(s);
      const valid = marks.filter((n) => n >= 1 && n <= max);
      for (const n of marks) {
        if (n < 1 || n > max) invalid.add(n);
        else usedSet.add(n);
      }
      if (valid.length > 0) supported += 1;
      else uncited.push(s.slice(0, 160));
    }
    for (const n of parseMarkers(text)) {
      if (n < 1 || n > max) invalid.add(n);
      else usedSet.add(n);
    }
    const coverage = sentences.length === 0 ? 0 : supported / sentences.length;
    const sourceObjs = sources.map((s) => ({ url: s.url, title: s.title, ...s.publishedAt ? { publishedAt: s.publishedAt } : {}, ...s.snippet !== void 0 ? { fetched: { ok: true, text: s.snippet } } : {} }));
    const claims = (input.claims ?? []).map((c) => {
      const flags = [];
      const quotes = c.quotes ?? (c.quote ? [c.quote] : []);
      const pairs = c.sources.map((n, i) => ({ n, quote: (quotes[i] ?? "").trim() }));
      const nums = pairs.filter((p) => p.n >= 1 && p.n <= max);
      if (nums.length !== pairs.length) flags.push("cita a una fuente inexistente");
      const withQuote = nums.filter((p) => p.quote);
      if (withQuote.length < nums.length) flags.push("fuente sin cita literal declarada");
      const claim = { id: c.text.slice(0, 40), text: c.text, evidence: withQuote.map((p) => ({ url: sources[p.n - 1].url, quote: p.quote })) };
      const audit = withQuote.length > 0 ? auditClaim(claim, sourceObjs) : { verdict: "POR CONFIRMAR", flags: ["sin cita literal declarada"] };
      let verdict2 = audit.verdict;
      const onlySnippets = withQuote.length > 0 && withQuote.every((p) => sources[p.n - 1].basis === "fragmento");
      if (onlySnippets && verdict2 === "VERIFICADO") {
        verdict2 = "PROBABLE";
        flags.push("solo fragmentos del buscador (no p\xE1gina completa)");
      }
      return { text: c.text, sources: nums.map((p) => p.n), ...withQuote.length ? { quotes: withQuote.map((p) => p.quote) } : {}, verdict: verdict2, flags: [...flags, ...audit.flags] };
    });
    if (invalid.size > 0) warnings.push("Citas a fuentes inexistentes: " + [...invalid].sort((a, b) => a - b).map((n) => "[" + n + "]").join(" "));
    if (uncited.length > 0) warnings.push(uncited.length + " frase(s) sin cita");
    if (max === 0) warnings.push("Sin fuentes: no hay evidencia para responder");
    const unused = sources.map((s) => s.n).filter((n) => !usedSet.has(n));
    const ledger = {
      sources: sources.map((s) => ({ id: String(s.n), title: s.title, uri: s.url, sourceType: "web" })),
      claims: claims.filter((c) => c.sources.length > 0).map((c) => ({ claim: c.text, citations: c.sources.map((n) => ({ sourceId: String(n) })) }))
    };
    const ledgerCheck = validateCitationLedger(ledger);
    if (!ledgerCheck.ok) warnings.push(...ledgerCheck.errors.slice(0, 3));
    let verdict;
    const verdicts = claims.map((c) => c.verdict);
    if (max === 0 || invalid.size > 0 || coverage < 0.5) verdict = max === 0 ? "POR CONFIRMAR" : "RECHAZADO";
    else if (coverage < 1 || verdicts.length === 0 || verdicts.some((v) => v === "POR CONFIRMAR" || v === "DESCARTADO")) verdict = "POR CONFIRMAR";
    else if (verdicts.every((v) => v === "VERIFICADO")) verdict = "VERIFICADO";
    else verdict = "PROBABLE";
    return {
      question,
      text,
      sources,
      used: [...usedSet].sort((a, b) => a - b),
      unused,
      claims,
      invalidMarkers: [...invalid].sort((a, b) => a - b),
      uncited,
      coverage: Math.round(coverage * 100) / 100,
      verdict,
      warnings,
      retrievedAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString(),
      ...input.model ? { model: input.model } : {}
    };
  }
  return __toCommonJS(cited_entry_exports);
})();
