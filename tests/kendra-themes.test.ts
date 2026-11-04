import { strict as assert } from "node:assert";
import { test } from "node:test";
import { KENDRA_DEFAULT_THEME, getKendraTheme, kendraThemes, resolveKendraTheme } from "../packages/core/src/kendra-themes.js";

test("six safe child themes with hearts flowers and teddy bears", () => {
  assert.equal(kendraThemes.length, 6);
  assert.deepEqual(kendraThemes.slice(0,3).map(x => x.pattern), ["hearts","flowers","teddies"]);
  assert.ok(kendraThemes.every(t => t.label.es && t.label.nl && /^#[0-9a-f]{6}$/i.test(t.background)));
});
test("unrecognized persisted theme falls back safely", () => {
  assert.equal(resolveKendraTheme("unknown"), KENDRA_DEFAULT_THEME);
  assert.equal(resolveKendraTheme(null), KENDRA_DEFAULT_THEME);
  assert.equal(getKendraTheme("flowers").pattern, "flowers");
});
