import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dashboardProfiles } from "../packages/core/src/dashboard-profiles.js";
import { approvedLanguageButtonAssets, dashboardLanguageButtons, dashboardLocaleStorageKey, dashboardSpeechLanguage, dashboardVisualLock, resolveDashboardLocale } from "../packages/core/src/dashboard-language.js";
test("both dashboards offer exactly the same two language choices", () => {
  assert.deepEqual(dashboardProfiles.founder.supportedLocales, ["nl","es"]);
  assert.deepEqual(dashboardProfiles.child.supportedLocales, ["nl","es"]);
  assert.deepEqual(dashboardLanguageButtons.map(b=>b.locale), ["nl","es"]);
  assert.notEqual(dashboardLocaleStorageKey("founder"),dashboardLocaleStorageKey("child"));
});
test("language choice remains role-scoped and changes speech locale", () => {
  assert.equal(resolveDashboardLocale("founder", "invalid"),"es");
  assert.equal(resolveDashboardLocale("child", "invalid"),"nl");
  assert.equal(dashboardSpeechLanguage("founder","nl"),"nl-NL");
  assert.equal(dashboardSpeechLanguage("child","es"),"es-ES");
});
test("approved original flag buttons are preserved, not regenerated", () => {
  assert.match(approvedLanguageButtonAssets.es,/E5D218D4/);
  assert.match(approvedLanguageButtonAssets.nl,/EDFDAF8B/);
  assert.equal(dashboardVisualLock.allowRegeneration,false);
  assert.equal(dashboardVisualLock.preserveCinematicLighting,true);
});
