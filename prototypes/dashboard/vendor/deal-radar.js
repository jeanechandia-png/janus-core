"use strict";
var DealRadar = (() => {
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

  // packages/modules/deal-radar/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    LEAD_DAYS: () => LEAD_DAYS,
    SALES_SEASONS: () => SALES_SEASONS,
    SOURCE_CATALOG: () => SOURCE_CATALOG,
    activeSeasons: () => activeSeasons,
    addHolidayWindows: () => addHolidayWindows,
    addToBasket: () => addToBasket,
    brandWatch: () => brandWatch,
    buildDigest: () => buildDigest,
    collectOffers: () => collectOffers,
    daysBetween: () => daysBetween,
    euro: () => euro,
    evaluateSubscription: () => evaluateSubscription,
    jaccard: () => jaccard,
    matchOffers: () => matchOffers,
    matchOne: () => matchOne,
    matchToAlert: () => matchToAlert,
    nextWeeklyRun: () => nextWeeklyRun,
    normalize: () => normalize,
    offerDiscount: () => offerDiscount,
    parsePromo: () => parsePromo,
    parseSize: () => parseSize,
    runWeeklyReview: () => runWeeklyReview,
    staticSource: () => staticSource,
    tokens: () => tokens,
    travelSearches: () => travelSearches,
    upcomingHolidays: () => upcomingHolidays,
    zonedTime: () => zonedTime
  });

  // packages/modules/deal-radar/src/text.ts
  var STOP = /* @__PURE__ */ new Set(["de", "het", "een", "en", "van", "met", "la", "el", "los", "las", "del", "y", "con", "the", "and", "of", "per", "stuk", "stuks", "pak"]);
  function normalize(text) {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%,.+ ]/g, " ").replace(/\s+/g, " ").trim();
  }
  function tokens(text) {
    return normalize(text).split(" ").filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+([.,]\d+)?(g|gr|kg|ml|cl|l|st)?$/.test(t));
  }
  function jaccard(a, b) {
    const A = new Set(a), B = new Set(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    return inter / (A.size + B.size - inter);
  }
  function parseSize(text) {
    const t = normalize(text).replace(/,/g, ".");
    const multi = t.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|gr|l|cl|ml)\b/);
    const one = t.match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|l|cl|ml)\b/);
    const pcs = t.match(/(\d+)\s*(st|stuks|pcs|uds|unidades)\b/);
    const conv = (n, u) => {
      if (u === "kg") return { amount: n * 1e3, unit: "g" };
      if (u === "g" || u === "gr") return { amount: n, unit: "g" };
      if (u === "l") return { amount: n * 1e3, unit: "ml" };
      if (u === "cl") return { amount: n * 10, unit: "ml" };
      return { amount: n, unit: "ml" };
    };
    if (multi && multi[1] && multi[2] && multi[3]) {
      const c = conv(Number(multi[2]), multi[3]);
      return { amount: Math.round(c.amount * Number(multi[1])), unit: c.unit };
    }
    if (one && one[1] && one[2]) {
      const c = conv(Number(one[1]), one[2]);
      return { amount: Math.round(c.amount), unit: c.unit };
    }
    if (pcs && pcs[1]) return { amount: Number(pcs[1]), unit: "pcs" };
    return void 0;
  }
  var round2 = (n) => Math.round(n * 100) / 100;
  var euro = (n) => "\u20AC" + round2(n).toFixed(2).replace(".", ",");

  // packages/modules/deal-radar/src/promo.ts
  function parsePromo(promoText, unitPrice) {
    if (!promoText) return void 0;
    const t = normalize(promoText).replace(/€/g, "");
    let m = t.match(/(\d+)\s*\+\s*(\d+)\s*gratis/);
    if (m && m[1] && m[2]) {
      const buy = Number(m[1]), free = Number(m[2]);
      return { discount: round2(free / (buy + free)), units: buy + free, label: buy + "+" + free + " gratis" };
    }
    if (/2e\s*(artikel\s*)?gratis/.test(t)) return { discount: 0.5, units: 2, label: "2.\xBA gratis" };
    if (/2e\s*(artikel\s*)?halve\s*prijs/.test(t) || /50\s*%\s*korting\s*op\s*de\s*2e/.test(t)) return { discount: 0.25, units: 2, label: "2.\xAA a mitad de precio" };
    if (/halve\s*prijs|mitad\s*de\s*precio/.test(t)) return { discount: 0.5, units: 1, label: "Mitad de precio" };
    m = t.match(/(\d+(?:[.,]\d+)?)\s*%\s*(korting|descuento|off)?/) || t.match(/-\s*(\d+(?:[.,]\d+)?)\s*%/);
    if (m && m[1]) {
      const d = Number(m[1].replace(",", ".")) / 100;
      if (d > 0 && d < 1) return { discount: round2(d), units: 1, label: Math.round(d * 100) + "% de descuento" };
    }
    m = t.match(/(\d+)\s*voor\s*(\d+(?:[.,]\d+)?)/);
    if (m && m[1] && m[2] && unitPrice && unitPrice > 0) {
      const n = Number(m[1]), total = Number(m[2].replace(",", ".")), d = 1 - total / (n * unitPrice);
      if (d > 0 && d < 1) return { discount: round2(d), units: n, label: n + " por \u20AC" + total.toFixed(2).replace(".", ",") };
    }
    return void 0;
  }
  function offerDiscount(regular, price, promoText, lastPaid) {
    const base = regular ?? lastPaid;
    if (base && price && price < base) return { discount: round2(1 - price / base) };
    const promo = parsePromo(promoText, base ?? price);
    return promo ? { discount: promo.discount, promo } : { discount: 0 };
  }

  // packages/modules/deal-radar/src/basket.ts
  var keyOf = (r) => r.ean ? "ean:" + r.ean : "n:" + normalize((r.brand || "") + " " + r.name) + (r.size ? "|" + r.size.amount + r.size.unit : "");
  function addToBasket(current, recognized, opts = {}) {
    const min = opts.minConfidence ?? 0.7;
    const list = current.slice(), byKey = new Map(list.map((w2) => [keyOf(w2), w2]));
    const added = [], merged = [], needsReview = [];
    for (const r of recognized) {
      if (!r.name || r.confidence < min) {
        needsReview.push(r);
        continue;
      }
      const size = r.sizeText ? parseSize(r.sizeText) : parseSize(r.name);
      const cand = {
        id: "w-" + (r.ean || normalize((r.brand || "") + "-" + r.name).replace(/ /g, "-")).slice(0, 60),
        kind: r.kind ?? "grocery",
        scope: opts.scope ?? "family",
        name: r.name.trim(),
        brand: r.brand?.trim(),
        keywords: tokens((r.brand || "") + " " + r.name),
        ean: r.ean,
        size,
        lastPrice: r.priceSeen,
        minDiscount: opts.minDiscount,
        stores: r.store ? [r.store] : void 0,
        addedFrom: "photo"
      };
      const k = keyOf(cand), prev = byKey.get(k);
      if (prev) {
        if (r.priceSeen && (!prev.lastPrice || r.priceSeen !== prev.lastPrice)) prev.lastPrice = r.priceSeen;
        if (r.store && !(prev.stores || []).includes(r.store)) prev.stores = (prev.stores || []).concat(r.store);
        merged.push(prev);
      } else {
        list.push(cand);
        byKey.set(k, cand);
        added.push(cand);
      }
    }
    current.splice(0, current.length, ...list);
    return { added, merged, needsReview };
  }
  function brandWatch(brand, categories, opts = {}) {
    return {
      id: "b-" + normalize(brand + "-" + categories.join("-")).replace(/ /g, "-").slice(0, 60),
      kind: opts.kind ?? "fashion",
      scope: opts.scope ?? "personal",
      name: brand + " \xB7 " + categories.join(", "),
      brand,
      keywords: tokens(categories.join(" ")),
      variants: opts.variants,
      minDiscount: opts.minDiscount ?? 0.2,
      addedFrom: "manual"
    };
  }

  // packages/modules/deal-radar/src/match.ts
  function sizeCompatible(a, b) {
    if (!a || !b) return true;
    if (a.unit !== b.unit) return false;
    const r = b.amount / a.amount;
    return r >= 0.75 && r <= 1.34;
  }
  function matchOne(item, offer) {
    if (item.stores && item.stores.length && !item.stores.map(normalize).includes(normalize(offer.store))) return void 0;
    let confidence = 0, reason = "keywords";
    if (item.ean && offer.ean && item.ean === offer.ean) {
      confidence = 1;
      reason = "ean";
    } else {
      const sameBrand = !!item.brand && (normalize(offer.brand || "") === normalize(item.brand) || normalize(offer.title).includes(normalize(item.brand)));
      const sim = jaccard(item.keywords, tokens(offer.title));
      if (item.kind === "grocery") {
        if (!sizeCompatible(item.size, offer.size)) return void 0;
        if (sameBrand && sim >= 0.34) {
          confidence = 0.6 + 0.4 * sim;
          reason = "brand+name";
        } else if (!item.brand && sim >= 0.6) {
          confidence = sim * 0.8;
          reason = "keywords";
        }
      } else if (sameBrand) {
        const catHit = !item.keywords.length || item.keywords.some((k) => tokens(offer.title).includes(k));
        if (catHit) {
          confidence = 0.7 + 0.3 * Math.min(1, sim * 2);
          reason = item.keywords.length ? "brand+name" : "brand";
        }
      }
    }
    if (confidence < 0.55) return void 0;
    const { discount, promo } = offerDiscount(offer.regularPrice, offer.price, offer.promoText, item.lastPrice);
    const unit = offer.regularPrice ?? item.lastPrice ?? offer.price ?? 0;
    const savings = round2(unit * discount * (promo ? promo.units : 1));
    return { item, offer, confidence: round2(confidence), reason, discount, savings, promo };
  }
  function matchOffers(watchlist, offers, defaultMinDiscount = 0.15, now = /* @__PURE__ */ new Date()) {
    const live = offers.filter((o) => !o.validUntil || /* @__PURE__ */ new Date(o.validUntil + "T23:59:59") >= now);
    const best = /* @__PURE__ */ new Map();
    for (const item of watchlist) {
      if (item.kind === "subscription" || item.kind === "travel") continue;
      for (const o of live) {
        const m = matchOne(item, o);
        if (!m || m.discount < (item.minDiscount ?? defaultMinDiscount)) continue;
        const prev = best.get(item.id);
        if (!prev || m.savings > prev.savings || m.savings === prev.savings && m.discount > prev.discount) best.set(item.id, m);
      }
    }
    return [...best.values()].sort((a, b) => b.savings - a.savings || b.discount - a.discount);
  }

  // packages/modules/deal-radar/src/subscriptions.ts
  var addMonths = (d, m) => {
    const x = new Date(d.getTime());
    x.setUTCMonth(x.getUTCMonth() + m);
    return x;
  };
  var iso = (d) => d.toISOString().slice(0, 10);
  function evaluateSubscription(o, horizonMonths, currentMonthly = 0, start = /* @__PURE__ */ new Date()) {
    const h = Math.max(1, horizonMonths);
    const promoMonths = Math.min(o.introMonths, h);
    const paidMonths = Math.max(h - promoMonths, o.minCommitmentMonths - promoMonths, 0);
    const costWithPromo = round2(o.introPrice * promoMonths + o.regularPrice * paidMonths);
    const costRegular = round2((currentMonthly || o.regularPrice) * h);
    const savings = round2(costRegular - costWithPromo);
    const noCommitment = o.minCommitmentMonths === 0;
    const cancel = addMonths(start, o.introMonths);
    cancel.setUTCDate(cancel.getUTCDate() - 2);
    let verdict = "revisar";
    if (savings > 0 && noCommitment) verdict = "aprovechar";
    else if (savings <= 0) verdict = "no-compensa";
    const note = noCommitment ? "Sin permanencia: si solo interesa la promoci\xF3n, cancelar antes del " + iso(cancel) + "." : "Permanencia de " + o.minCommitmentMonths + " meses: revisar la letra peque\xF1a antes de aceptar.";
    return { costWithPromo, costRegular, savings, noCommitment, cancelBefore: noCommitment ? iso(cancel) : void 0, verdict, note };
  }

  // packages/modules/deal-radar/src/holidays.ts
  var SRC = "rijksoverheid.nl \xB7 schoolvakanties 2026-2027 (consultado 2026-10-22)";
  var w = (id, name, region, start, end) => ({ id: id + "-" + region, name, region, start, end, source: SRC });
  var NL_2026_2027 = [
    w("herfst-2026", "Herfstvakantie (oto\xF1o)", "noord", "2026-10-10", "2026-10-18"),
    w("herfst-2026", "Herfstvakantie (oto\xF1o)", "midden", "2026-10-17", "2026-10-25"),
    w("herfst-2026", "Herfstvakantie (oto\xF1o)", "zuid", "2026-10-17", "2026-10-25"),
    ...["noord", "midden", "zuid"].map((r) => w("kerst-2026", "Kerstvakantie (Navidad)", r, "2026-12-19", "2027-01-03")),
    w("voorjaar-2027", "Voorjaarsvakantie (invierno)", "noord", "2027-02-20", "2027-02-28"),
    w("voorjaar-2027", "Voorjaarsvakantie (invierno)", "midden", "2027-02-20", "2027-02-28"),
    w("voorjaar-2027", "Voorjaarsvakantie (invierno)", "zuid", "2027-02-13", "2027-02-21"),
    ...["noord", "midden", "zuid"].map((r) => w("mei-2027", "Meivakantie (mayo)", r, "2027-04-24", "2027-05-02")),
    w("zomer-2027", "Zomervakantie (verano)", "noord", "2027-07-10", "2027-08-22"),
    w("zomer-2027", "Zomervakantie (verano)", "midden", "2027-07-17", "2027-08-29"),
    w("zomer-2027", "Zomervakantie (verano)", "zuid", "2027-07-24", "2027-09-05")
  ];
  var EXTRA = [];
  function addHolidayWindows(list) {
    EXTRA.push(...list);
  }
  function upcomingHolidays(region, from = /* @__PURE__ */ new Date(), limit = 6) {
    const today = from.toISOString().slice(0, 10);
    return NL_2026_2027.concat(EXTRA).filter((h) => h.region === region && h.end >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, limit);
  }
  var daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

  // packages/modules/deal-radar/src/travel.ts
  var LEAD_DAYS = { flight: 90, train: 60, bus: 45, car: 30, hotel: 75, park: 45 };
  function travelSearches(profile, windows, from = /* @__PURE__ */ new Date()) {
    const today = from.toISOString().slice(0, 10), out = [];
    for (const win of windows) {
      if (win.end < today) continue;
      const depart = win.start > today ? win.start : today;
      const nights = Math.max(1, daysBetween(depart, win.end));
      for (const d of profile.travel.destinations) {
        for (const mode of d.modes) {
          const lead = LEAD_DAYS[mode], daysToStart = daysBetween(today, depart);
          const urgency = daysToStart <= lead ? 1 : Math.max(0.3, lead / Math.max(1, daysToStart));
          out.push({
            windowId: win.id,
            windowName: win.name,
            mode,
            destination: d.name,
            country: d.country,
            depart,
            return: win.end,
            nights,
            travellers: { adults: profile.travel.adults, children: profile.travel.childAges.length, childAges: profile.travel.childAges.slice() },
            priority: Math.round(d.priority * urgency * 100) / 100
          });
        }
      }
    }
    return out.sort((a, b) => b.priority - a.priority || a.depart.localeCompare(b.depart));
  }

  // packages/modules/deal-radar/src/schedule.ts
  function nextWeeklyRun(now, weekday = 1, hour = 8, timeZone = "Europe/Amsterdam") {
    for (let add = 0; add <= 8; add++) {
      for (const probeHour of [hour]) {
        const day = new Date(now.getTime() + add * 864e5);
        const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(day);
        const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
        const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
        if (wd !== weekday) continue;
        const candidate = zonedTime(Number(get("year")), Number(get("month")), Number(get("day")), probeHour, timeZone);
        if (candidate.getTime() > now.getTime()) return candidate;
      }
    }
    return new Date(now.getTime() + 7 * 864e5);
  }
  function zonedTime(y, m, d, h, timeZone) {
    const guess = Date.UTC(y, m - 1, d, h);
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const asLocal = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
    return new Date(guess - (asLocal - guess));
  }
  var SALES_SEASONS = [
    { id: "winter-sale", name: "Rebajas de invierno (cambio de temporada)", months: [1], kinds: ["fashion", "kids"] },
    { id: "summer-sale", name: "Rebajas de verano (cambio de temporada)", months: [7], kinds: ["fashion", "kids"] },
    { id: "back-to-school", name: "Vuelta al cole", months: [8, 9], kinds: ["kids", "electronics"] },
    { id: "black-friday", name: "Black Friday / Cyber Monday", months: [11], kinds: ["fashion", "electronics", "kids", "subscription", "tool"] },
    { id: "apple-launch", name: "Presentaci\xF3n de iPhone (los modelos anteriores bajan)", months: [9], kinds: ["electronics"] }
  ];
  function activeSeasons(now) {
    const m = now.getUTCMonth() + 1;
    return SALES_SEASONS.filter((s) => s.months.includes(m));
  }

  // packages/modules/deal-radar/src/sources.ts
  var S = (id, name, kinds, country, url) => ({ id, name, kinds, country, url, access: "por-confirmar" });
  var SOURCE_CATALOG = [
    S("ah", "Albert Heijn (bonus)", ["grocery"], "NL", "https://www.ah.nl/bonus"),
    S("jumbo", "Jumbo (aanbiedingen)", ["grocery"], "NL", "https://www.jumbo.com/aanbiedingen"),
    S("lidl-nl", "Lidl NL", ["grocery"], "NL", "https://www.lidl.nl"),
    S("aldi-nl", "Aldi NL", ["grocery"], "NL", "https://www.aldi.nl"),
    S("dirk", "Dirk", ["grocery"], "NL", "https://www.dirk.nl"),
    S("plus", "PLUS", ["grocery"], "NL", "https://www.plus.nl"),
    S("kruidvat", "Kruidvat", ["grocery", "kids"], "NL", "https://www.kruidvat.nl"),
    S("zalando", "Zalando NL", ["fashion", "kids"], "NL", "https://www.zalando.nl"),
    S("nike", "Nike NL", ["fashion", "kids"], "NL", "https://www.nike.com/nl"),
    S("calvinklein", "Calvin Klein NL", ["fashion"], "NL", "https://www.calvinklein.nl"),
    S("tommy", "Tommy Hilfiger NL", ["fashion", "kids"], "NL", "https://nl.tommy.com"),
    S("timberland", "Timberland NL", ["fashion"], "NL", "https://www.timberland.nl"),
    S("apple-refurb", "Apple Store NL (refurbished)", ["electronics"], "NL", "https://www.apple.com/nl/shop/refurbished"),
    S("coolblue", "Coolblue", ["electronics"], "NL", "https://www.coolblue.nl"),
    S("ns", "NS (trenes NL)", ["travel"], "NL", "https://www.ns.nl"),
    S("db", "Deutsche Bahn (Sparpreis)", ["travel"], "DE", "https://www.bahn.de"),
    S("flixbus", "FlixBus", ["travel"], "EU", "https://www.flixbus.nl"),
    S("transavia", "Transavia", ["travel"], "NL", "https://www.transavia.com"),
    S("klm", "KLM", ["travel"], "NL", "https://www.klm.nl"),
    S("booking", "Booking.com", ["travel"], "EU", "https://www.booking.com"),
    S("efteling", "Efteling", ["travel"], "NL", "https://www.efteling.com"),
    S("phantasialand", "Phantasialand", ["travel"], "DE", "https://www.phantasialand.de"),
    S("movie-park", "Movie Park Germany", ["travel"], "DE", "https://www.movieparkgermany.de")
  ];
  function staticSource(id, offers) {
    return { id, name: id, kinds: [...new Set(offers.map((o) => o.kind ?? "grocery"))], fetchOffers: async () => offers.slice() };
  }
  async function collectOffers(adapters, q) {
    const res = await Promise.allSettled(adapters.map((a) => a.fetchOffers(q)));
    const offers = [], failed = [];
    res.forEach((r, i) => {
      const id = adapters[i]?.id ?? "?";
      if (r.status === "fulfilled") offers.push(...r.value);
      else failed.push({ id, error: String(r.reason) });
    });
    return { offers, failed };
  }

  // packages/modules/deal-radar/src/digest.ts
  var prio = (savings, discount) => savings >= 10 || discount >= 0.45 ? "high" : savings >= 3 || discount >= 0.25 ? "medium" : "low";
  function matchToAlert(m) {
    const pct = Math.round(m.discount * 100);
    const how = m.promo ? m.promo.label : pct + "% menos";
    return {
      id: "a-" + m.item.id + "-" + m.offer.id,
      category: m.item.kind,
      scope: m.item.scope,
      priority: prio(m.savings, m.discount),
      title: m.item.name + " \u2014 " + how + " en " + m.offer.store,
      detail: (m.offer.price != null ? euro(m.offer.price) + (m.offer.regularPrice ? " (antes " + euro(m.offer.regularPrice) + ")" : "") + " \xB7 " : "") + "ahorro aprox. " + euro(m.savings) + (m.offer.validUntil ? " \xB7 hasta " + m.offer.validUntil : ""),
      savings: m.savings,
      source: m.offer.source,
      url: m.offer.url,
      validUntil: m.offer.validUntil,
      observedAt: m.offer.observedAt
    };
  }
  function buildDigest(profile, matches, subscriptionOffers, travel, opts = {}) {
    const now = opts.now ?? /* @__PURE__ */ new Date();
    const alerts = matches.map(matchToAlert);
    const subs = subscriptionOffers.filter((o) => o.intro).map((o) => ({ offer: o, verdict: evaluateSubscription(o.intro, opts.horizonMonths ?? 3, 0, now) })).filter((s) => s.verdict.verdict !== "no-compensa");
    subs.forEach((s) => alerts.push({
      id: "s-" + s.offer.id,
      category: s.offer.kind ?? "subscription",
      scope: s.offer.kind === "tool" ? "business" : "personal",
      priority: s.verdict.verdict === "aprovechar" ? "medium" : "low",
      title: s.offer.title + " \u2014 " + euro(s.offer.intro.introPrice) + " los primeros " + s.offer.intro.introMonths + " mes(es)",
      detail: s.verdict.note + " Ahorro estimado " + euro(s.verdict.savings) + ".",
      savings: s.verdict.savings,
      source: s.offer.source,
      url: s.offer.url,
      validUntil: s.offer.validUntil,
      observedAt: s.offer.observedAt
    }));
    const order = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => order[a.priority] - order[b.priority] || b.savings - a.savings);
    const basketOnSale = matches.filter((m) => m.item.kind === "grocery").length;
    const totalSavings = round2(alerts.reduce((a, x) => a + Math.max(0, x.savings), 0));
    const parts = [];
    if (basketOnSale) parts.push(basketOnSale + (basketOnSale === 1 ? " producto" : " productos") + " de tu cesta en oferta");
    const others = alerts.length - basketOnSale - subs.length;
    if (others > 0) parts.push(others + " de tus marcas");
    if (subs.length) parts.push(subs.length + (subs.length === 1 ? " promoci\xF3n" : " promociones") + " de plataformas");
    const headline = parts.length ? parts.join(" \xB7 ") + " \xB7 ahorro aprox. " + euro(totalSavings) : "Sin ofertas que superen tus umbrales esta semana";
    return { generatedAt: now.toISOString(), headline, basketOnSale, totalSavings, alerts, subscriptions: subs, travel: travel.slice(0, 12), sourcesFailed: opts.sourcesFailed ?? [] };
  }

  // packages/modules/deal-radar/src/run.ts
  async function runWeeklyReview(profile, adapters, now = /* @__PURE__ */ new Date()) {
    const terms = [...new Set(profile.watchlist.flatMap((w2) => (w2.brand ? [w2.brand] : []).concat(w2.keywords.length ? w2.keywords : tokens(w2.name))))];
    const kinds = [...new Set(profile.watchlist.map((w2) => w2.kind))];
    const { offers, failed } = await collectOffers(adapters, { kinds, terms, country: profile.country });
    const matches = matchOffers(profile.watchlist, offers.filter((o) => !o.intro), profile.defaultMinDiscount, now);
    const subs = offers.filter((o) => o.intro && (o.kind === "subscription" || o.kind === "tool"));
    const travel = travelSearches(profile, upcomingHolidays(profile.schoolRegion, now), now);
    return buildDigest(profile, matches, subs, travel, { now, sourcesFailed: failed.map((f) => f.id) });
  }
  return __toCommonJS(index_exports);
})();
