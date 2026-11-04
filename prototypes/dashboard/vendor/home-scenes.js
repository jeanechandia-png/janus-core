"use strict";
var HomeScenes = (() => {
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

  // packages/modules/home-scenes/src/index.ts
  var src_exports = {};
  __export(src_exports, {
    SCENES: () => SCENES,
    applyActions: () => applyActions,
    greeting: () => greeting,
    parseIntent: () => parseIntent,
    planScene: () => planScene,
    tuyaCommand: () => tuyaCommand
  });
  var SCENES = {
    llegada: { label: "Llegada", desc: "Luces de ambiente encendidas y calefacci\xF3n a temperatura de confort" },
    salida: { label: "Salida", desc: "Todo apagado y calefacci\xF3n en modo ahorro" },
    despertar: { label: "Despertar", desc: "Luces c\xE1lidas suaves en dormitorio y cocina" },
    "buenas-noches": { label: "Buenas noches", desc: "Todo apagado salvo la luz de noche" },
    navidad: { label: "Navidad", desc: "Encender las luces de Navidad" },
    "navidad-off": { label: "Navidad off", desc: "Apagar las luces de Navidad" },
    "todo-off": { label: "Apagar todo", desc: "Apagar todas las luces y enchufes" },
    ambiente: { label: "Ambiente", desc: "Solo luces de ambiente" }
  };
  var lightsOf = (d, tag) => d.filter((x) => (x.kind === "light" || x.kind === "plug") && (!tag || x.tags.includes(tag)));
  var heatOf = (d) => d.filter((x) => x.kind === "heater" || x.kind === "thermostat");
  function planScene(scene, devices, state, ctx) {
    const want = [];
    const comfort = ctx.comfortTemp ?? 20.5, eco = 17;
    const dark = ctx.now.getHours() >= 17 || ctx.now.getHours() < 8;
    switch (scene) {
      case "llegada":
        if (dark) lightsOf(devices, "ambiente").forEach((d) => want.push({ deviceId: d.id, cmd: "on" }));
        heatOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: "setTemp", value: comfort }));
        break;
      case "salida":
        lightsOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: "off" }));
        heatOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: "setTemp", value: eco }));
        break;
      case "despertar":
        lightsOf(devices, "despertar").forEach((d) => {
          want.push({ deviceId: d.id, cmd: "on" });
          want.push({ deviceId: d.id, cmd: "brightness", value: 40 });
        });
        heatOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: "setTemp", value: comfort }));
        break;
      case "buenas-noches":
        lightsOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: d.tags.includes("noche") ? "on" : "off" }));
        heatOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: "setTemp", value: 18 }));
        break;
      case "navidad":
        lightsOf(devices, "navidad").forEach((d) => want.push({ deviceId: d.id, cmd: "on" }));
        break;
      case "navidad-off":
        lightsOf(devices, "navidad").forEach((d) => want.push({ deviceId: d.id, cmd: "off" }));
        break;
      case "todo-off":
        lightsOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: "off" }));
        break;
      case "ambiente":
        lightsOf(devices, "ambiente").forEach((d) => want.push({ deviceId: d.id, cmd: "on" }));
        break;
    }
    return want.filter((a) => {
      const s = state[a.deviceId];
      if (!s) return true;
      if (a.cmd === "on") return !s.on;
      if (a.cmd === "off") return s.on;
      if (a.cmd === "brightness") return s.brightness !== a.value;
      if (a.cmd === "setTemp") return s.temp !== a.value;
      return true;
    });
  }
  function applyActions(state, actions) {
    const next = JSON.parse(JSON.stringify(state));
    for (const a of actions) {
      const s = next[a.deviceId] ?? (next[a.deviceId] = { on: false });
      if (a.cmd === "on") s.on = true;
      else if (a.cmd === "off") s.on = false;
      else if (a.cmd === "brightness") {
        s.on = true;
        s.brightness = a.value;
      } else if (a.cmd === "setTemp") {
        s.on = true;
        s.temp = a.value;
      }
    }
    return next;
  }
  var norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function parseIntent(text) {
    const t = norm(text);
    const m = t.match(/(calefaccion|temperatura).*?(\d{2}(?:[.,]\d)?)/);
    if (m) return { temp: parseFloat(m[2].replace(",", ".")) };
    if (/(enciende|prende|pon|activa).*(navidad|navidenas|arbol)/.test(t)) return { scene: "navidad" };
    if (/(apaga|quita).*(navidad|navidenas|arbol)/.test(t)) return { scene: "navidad-off" };
    if (/(apaga|apagar) (todo|todas|las luces)/.test(t)) return { scene: "todo-off" };
    if (/(enciende|prende).*(luces|luz)/.test(t)) return { scene: "ambiente" };
    if (/buenas noches|me voy a dormir/.test(t)) return { scene: "buenas-noches" };
    if (/(ya )?llegue|estoy en casa/.test(t)) return { scene: "llegada" };
    if (/(me voy|salgo de casa)/.test(t)) return { scene: "salida" };
    return null;
  }
  function greeting(name, now, event) {
    if (event === "despertar" || event === "abrir" && now.getHours() >= 5 && now.getHours() < 11) return "Buenos d\xEDas, " + name + ".";
    return "Hola, " + name + ". \xBFQu\xE9 tal tu d\xEDa?";
  }
  function tuyaCommand(device, a) {
    if (!device.externalId) throw new Error("Dispositivo sin id de Tuya: " + device.id);
    const code = a.cmd === "on" || a.cmd === "off" ? device.kind === "light" ? "switch_led" : "switch_1" : a.cmd === "brightness" ? "bright_value_v2" : "temp_set";
    const value = a.cmd === "on" ? true : a.cmd === "off" ? false : a.cmd === "brightness" ? Math.round((a.value ?? 100) * 10) : a.value;
    return { path: "/v1.0/iot-03/devices/" + device.externalId + "/commands", body: { commands: [{ code, value }] } };
  }
  return __toCommonJS(src_exports);
})();
