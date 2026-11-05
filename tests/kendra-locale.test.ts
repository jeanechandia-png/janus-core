import { test } from "node:test";
import { strict as assert } from "node:assert";
import { dashboardProfiles } from "../packages/core/src/dashboard-profiles.js";
import { KENDRA_DEFAULT_LOCALE, kendraLanguageButtons, resolveKendraLocale, translateKendra, kendraSpeechLanguage } from "../packages/core/src/kendra-locale.js";

test("Kendra has exactly two explicit language buttons", () => {
  assert.deepEqual(kendraLanguageButtons.map(x => x.label), ["Nederlands", "Español"]);
  assert.deepEqual(dashboardProfiles.child.supportedLocales, ["nl", "es"]);
  assert.equal(dashboardProfiles.child.defaultLocale, KENDRA_DEFAULT_LOCALE);
});
test("switching language updates all labels and speech language", () => {
  assert.equal(translateKendra("nl", "learn"), "Leren");
  assert.equal(translateKendra("es", "learn"), "Aprender");
  assert.equal(translateKendra("nl", "welcome"), "Hoi, Kendra!");
  assert.equal(translateKendra("es", "welcome"), "¡Hola, Kendra!");
  assert.equal(kendraSpeechLanguage("nl"), "nl-NL");
  assert.equal(kendraSpeechLanguage("es"), "es-ES");
});
test("invalid persisted locale safely falls back", () => {
  assert.equal(resolveKendraLocale("fr"), KENDRA_DEFAULT_LOCALE);
  assert.equal(resolveKendraLocale(null), KENDRA_DEFAULT_LOCALE);
  assert.equal(resolveKendraLocale("es"), "es");
});
