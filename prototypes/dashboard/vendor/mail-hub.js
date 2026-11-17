"use strict";
var MailHub = (() => {
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

  // packages/modules/mail-hub/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    PROVIDERS: () => PROVIDERS,
    accountId: () => accountId,
    addAccount: () => addAccount,
    connectionConfig: () => connectionConfig,
    pickerGroups: () => pickerGroups,
    priorityOf: () => priorityOf,
    removeAccount: () => removeAccount,
    secretRefFor: () => secretRefFor,
    unifiedInbox: () => unifiedInbox
  });
  var PROVIDERS = {
    icloud: { id: "icloud", name: "iCloud Mail", icon: "", auth: "app-password", imap: { host: "imap.mail.me.com", port: 993, tls: true }, smtp: { host: "smtp.mail.me.com", port: 587, security: "starttls" }, username: "local-part", howTo: "appleid.apple.com \u2192 Inicio de sesi\xF3n y seguridad \u2192 Contrase\xF1as de apps \u2192 generar una para \xABJanus\xBB.", verified: "support.apple.com/en-ie/HT202304 \xB7 2026-10-22" },
    gmail: { id: "gmail", name: "Gmail", icon: "G", auth: "oauth", username: "full-address", howTo: "Conectar con Google (OAuth) desde Janus; cada cuenta se autoriza por separado.", verified: "Adaptador Google Workspace de Janus" },
    yahoo: { id: "yahoo", name: "Yahoo Mail", icon: "Y", auth: "app-password", imap: { host: "imap.mail.yahoo.com", port: 993, tls: true }, smtp: { host: "smtp.mail.yahoo.com", port: 465, security: "ssl" }, username: "full-address", howTo: "Seguridad de la cuenta Yahoo \u2192 Generar contrase\xF1a de app.", verified: "help.yahoo.com/kb/SLN4075.html \xB7 2026-10-22" },
    outlook: { id: "outlook", name: "Outlook / Hotmail", icon: "O", auth: "oauth", username: "full-address", howTo: "OAuth de Microsoft (por confirmar).", verified: "por-confirmar" },
    imap: { id: "imap", name: "Otro (IMAP)", icon: "@", auth: "password", username: "full-address", howTo: "Servidor, puerto y contrase\xF1a que indique el proveedor.", verified: "por-confirmar" }
  };
  var norm = (s) => s.trim().toLowerCase();
  var isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  var accountId = (provider, address) => provider + ":" + norm(address);
  var secretRefFor = (provider, address) => "MAIL_" + (provider + "_" + norm(address)).replace(/[^a-z0-9]/g, "_").toUpperCase() + "_APP_PASSWORD";
  function addAccount(list, input, now = /* @__PURE__ */ new Date()) {
    const address = norm(input.address);
    if (!isEmail(address)) throw new Error("Direcci\xF3n de correo no v\xE1lida");
    const id = accountId(input.provider, address);
    if (list.some((a) => a.id === id)) throw new Error("Esa cuenta ya est\xE1 a\xF1adida");
    const preset = PROVIDERS[input.provider];
    if (input.provider === "imap" && !input.imap) throw new Error("Falta el servidor IMAP");
    const same = list.filter((a) => a.provider === input.provider).length;
    const acc = {
      id,
      provider: input.provider,
      address,
      label: input.label?.trim() || preset.name + (same ? " " + (same + 1) : ""),
      scope: input.scope ?? "personal",
      secretRef: preset.auth === "oauth" ? void 0 : secretRefFor(input.provider, address),
      imap: input.imap ?? (preset.imap ? { ...preset.imap } : void 0),
      status: "pendiente",
      addedAt: now.toISOString()
    };
    list.push(acc);
    return acc;
  }
  function removeAccount(list, id) {
    const i = list.findIndex((a) => a.id === id);
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  }
  function connectionConfig(acc, readSecret) {
    const preset = PROVIDERS[acc.provider];
    if (preset.auth === "oauth") return { oauth: true, provider: acc.provider, address: acc.address };
    const pass = acc.secretRef ? readSecret(acc.secretRef) : void 0;
    if (!pass) return { missing: acc.secretRef ?? "secreto" };
    if (!acc.imap) return { missing: "imap" };
    const user = preset.username === "local-part" ? acc.address.split("@")[0] ?? acc.address : acc.address;
    return { host: acc.imap.host, port: acc.imap.port, tls: acc.imap.tls, user, pass };
  }
  function pickerGroups(list, unread = {}) {
    const order = ["icloud", "gmail", "yahoo", "outlook", "imap"];
    return order.map((p) => ({ provider: p, name: PROVIDERS[p].name, accounts: list.filter((a) => a.provider === p).map((a) => ({ ...a, unread: unread[a.id] ?? 0 })), canAdd: true })).filter((g) => g.accounts.length || g.provider === "icloud" || g.provider === "gmail");
  }
  function unifiedInbox(list, messages, filter = {}) {
    const ids = new Set(list.filter((a) => (!filter.accountId || a.id === filter.accountId) && (!filter.provider || a.provider === filter.provider)).map((a) => a.id));
    return messages.filter((m) => ids.has(m.accountId)).sort((a, b) => b.date.localeCompare(a.date));
  }
  var URGENT = /(urgente|urgent|factura|invoice|firma|sign|contrato|contract|vence|deadline|pago|payment|aanmaning|herinnering)/i;
  function priorityOf(m, vip = []) {
    const why = [];
    if (vip.some((v) => norm(m.from).includes(norm(v)))) why.push("remitente importante");
    if (URGENT.test(m.subject)) why.push("palabra de urgencia");
    if (m.hasAttachments) why.push("adjunto");
    return { level: why.length >= 2 ? 3 : why.length === 1 ? 2 : 1, why };
  }
  return __toCommonJS(index_exports);
})();
