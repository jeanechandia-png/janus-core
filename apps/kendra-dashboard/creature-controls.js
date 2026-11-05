/* Dashboard 2 progressive enhancement: never invents creature models. */
(() => {
  "use strict";
  const key = "janus.dashboard-2.creature.v1";
  const translations = {
    es: { heading: "Mi criatura", choose: "Elige tu compañera", color: "Color", outfit: "Ropa", accessory: "Accesorio", feature: "Características", unavailable: "Aún no hay criaturas aprobadas disponibles.", preview: "Vista previa del personaje 3D aprobado", save: "Guardar mi criatura", saved: "Preferencias guardadas", invalid: "Selecciona una criatura y sus opciones aprobadas." },
    nl: { heading: "Mijn vriendje", choose: "Kies je vriendje", color: "Kleur", outfit: "Kleding", accessory: "Accessoire", feature: "Kenmerken", unavailable: "Er zijn nog geen goedgekeurde figuren beschikbaar.", preview: "Voorbeeld van het goedgekeurde 3D-figuur", save: "Mijn vriendje opslaan", saved: "Voorkeuren opgeslagen", invalid: "Kies een goedgekeurd figuur en opties." }
  };
  const root = document.getElementById("creature-editor");
  if (!root) return;
  // Only owner-approved entries may be passed from a trusted local asset registry.
  const registry = Array.isArray(window.JANUS_APPROVED_CREATURES) ? window.JANUS_APPROVED_CREATURES.filter(c =>
    c && typeof c.id === "string" && /^[a-z0-9_-]+$/i.test(c.id) &&
    typeof c.assetId === "string" && c.assetId.length > 0 &&
    ["colors","outfits","accessories","features"].every(k => Array.isArray(c[k]) && c[k].every(v => typeof v === "string"))
  ) : [];
  let current = null;
  try { current = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
  function locale() { return document.documentElement.lang === "es" ? "es" : "nl"; }
  function el(tag, text) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
  function select(label, values, selected) {
    const wrap = el("label", label + " ");
    const input = el("select"); input.style.cssText = "display:block;width:100%;min-height:48px;border-radius:12px;padding:8px;margin:6px 0 12px";
    values.forEach(v => { const option = el("option", v); option.value = v; input.append(option); });
    if (values.includes(selected)) input.value = selected;
    wrap.append(input); return { wrap, input };
  }
  function render() {
    const t = translations[locale()]; root.replaceChildren();
    root.append(el("h2", t.heading));
    if (!registry.length) { root.append(el("p", t.unavailable)); return; }
    const creature = select(t.choose, registry.map(c => c.id), current?.creatureId);
    root.append(creature.wrap);
    const details = el("div"); root.append(details);
    const status = el("p"); status.setAttribute("role", "status"); root.append(status);
    function renderDetails() {
      details.replaceChildren();
      const item = registry.find(c => c.id === creature.input.value);
      if (!item) return;
      const fields = [
        ["color", "colors"], ["outfit", "outfits"], ["accessory", "accessories"], ["feature", "features"]
      ].map(([field, list]) => ({ field, ...select(t[field], item[list], current?.creatureId === item.id ? current?.[field] : undefined) }));
      fields.forEach(f => details.append(f.wrap));
      const stage = el("div", t.preview + " — " + item.id);
      stage.className = "avatar"; details.append(stage);
      // A real 3D renderer must load the asset through an approved, local asset registry.
      // Never replace a missing 3D asset with a generated illustration or an image overlay.
      const save = el("button", t.save); save.type = "button";
      save.addEventListener("click", () => {
        const next = { creatureId: item.id };
        for (const f of fields) next[f.field] = f.input.value;
        if (fields.some(f => !item[({color:"colors",outfit:"outfits",accessory:"accessories",feature:"features"})[f.field]].includes(next[f.field]))) { status.textContent = t.invalid; return; }
        current = next;
        try { localStorage.setItem(key, JSON.stringify(next)); status.textContent = t.saved; }
        catch { status.textContent = t.invalid; }
      });
      details.append(save);
    }
    creature.input.addEventListener("change", () => { current = null; renderDetails(); });
    renderDetails();
  }
  document.querySelectorAll("[data-lang]").forEach(button => button.addEventListener("click", () => queueMicrotask(render)));
  render();
})();
