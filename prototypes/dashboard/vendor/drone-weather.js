var DroneWx = (() => {
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

  // ../../../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/dw/src/index.ts
  var src_exports = {};
  __export(src_exports, {
    ATOM2: () => ATOM2,
    bestWindows: () => bestWindows,
    checkHour: () => checkHour,
    dayVerdict: () => dayVerdict,
    periods: () => periods
  });
  var ATOM2 = { name: "Potensic Atom 2", maxWindKmh: 38, windOkKmh: 25, windWarnKmh: 32, gustOkKmh: 30, gustWarnKmh: 38, minTempC: 0, waterproof: false };
  function checkHour(x, p = ATOM2) {
    const no = [], warn = [];
    if (x.storm) no.push("tormenta");
    if (!p.waterproof && (x.mm > 0.1 || x.r >= 50)) no.push("lluvia " + x.r + "%");
    else if (!p.waterproof && x.r >= 30) warn.push("posible lluvia " + x.r + "%");
    if (x.w > p.windWarnKmh || x.g > p.gustWarnKmh) no.push("viento " + x.w + " km/h, r\xE1fagas " + x.g);
    else if (x.w > p.windOkKmh || x.g > p.gustOkKmh) warn.push("viento " + x.w + " km/h, r\xE1fagas " + x.g);
    if (x.vis !== void 0 && x.vis < 1) no.push("visibilidad " + x.vis + " km");
    if (x.t < p.minTempC) warn.push("fr\xEDo " + x.t + "\xB0 (bater\xEDa)");
    if (!x.day) warn.push("de noche: luz verde intermitente obligatoria");
    return { verdict: no.length ? "no" : warn.length ? "precaucion" : "si", reasons: no.length ? no : warn };
  }
  function bestWindows(hours, p = ATOM2) {
    const out = [];
    let start = -1;
    hours.forEach((x, i) => {
      const ok = checkHour(x, p).verdict === "si";
      if (ok && start < 0) start = x.h;
      if ((!ok || i === hours.length - 1) && start >= 0) {
        out.push({ from: start, to: ok ? x.h + 1 : x.h });
        start = -1;
      }
    });
    return out;
  }
  function dayVerdict(hours, p = ATOM2) {
    const day = hours.filter((x) => x.day), windows = bestWindows(day, p);
    if (windows.length) return { verdict: "si", reasons: ["mejor franja " + windows.map((w) => w.from + ":00\u2013" + w.to + ":00").join(", ")], windows };
    const checks = day.map((x) => checkHour(x, p)), anyWarn = checks.some((c) => c.verdict === "precaucion");
    const worst = checks.find((c) => c.verdict === "no") || checks[0] || { verdict: "no", reasons: ["sin datos"] };
    return { verdict: anyWarn ? "precaucion" : "no", reasons: anyWarn ? checks.find((c) => c.verdict === "precaucion").reasons : worst.reasons, windows };
  }
  function periods(hours) {
    const def = [["manana", "Ma\xF1ana", 7, 12], ["tarde", "Tarde", 13, 18], ["noche", "Noche", 19, 23]];
    return def.map(([id, label, a, b]) => {
      const hs = hours.filter((x) => x.h >= a && x.h <= b);
      const n = hs.length || 1;
      return { id, label, t: Math.round(Math.max(...hs.map((x) => x.t))), tmin: Math.round(Math.min(...hs.map((x) => x.t))), r: Math.max(0, ...hs.map((x) => x.r)), w: Math.max(0, ...hs.map((x) => x.w)), g: Math.max(0, ...hs.map((x) => x.g)), mm: +hs.reduce((s, x) => s + x.mm, 0).toFixed(1), storm: hs.some((x) => !!x.storm) };
    });
  }
  return __toCommonJS(src_exports);
})();
