'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'lego/janus-family-guide/janus-child-safety.js'), 'utf8');
const context = {window:{}};
vm.runInNewContext(code, context, {filename:'janus-child-safety.js'});
const policy = context.window.JanusChildSafety;
test('child safety review is based on sourced and scoped guidance', () => {
  assert.equal(policy.version, '2026-11-06');
  assert.equal(policy.reviewLesson('math', policy.sources.mathematics).status, 'reviewed-source');
  assert.equal(policy.reviewLesson('math', policy.sources.movement).status, 'unverified');
  assert.equal(policy.reviewLesson('unverified-claim', '').status, 'family-preference-or-unreviewed');
  assert.equal(policy.reviewLesson('medical', policy.sources.attention).allowedForClinicalClaims, false);
  assert.equal(policy.reviewLesson('medical', policy.sources.attention).requiresAdultOrProfessional, true);
});
test('child risk reports receive non-diagnostic, adult-oriented responses', () => {
  const urgent = policy.assess('Quiero hacerme daño');
  assert.equal(urgent.level, 'urgent');
  assert.equal(urgent.notifyAdult, true);
  assert.equal(urgent.storeRawDisclosure, false);
  assert.match(urgent.reply, /adulto de confianza/);
  const bullying = policy.assess('Están haciendo bullying en mi clase');
  assert.equal(bullying.topic, 'bullying');
  assert.equal(bullying.notifyAdult, true);
  assert.match(bullying.reply, /profesor/);
  const diagnosis = policy.assess('¿Tengo TDAH?');
  assert.equal(diagnosis.requiresProfessional, true);
  assert.equal(diagnosis.notifyAdult, false);
  assert.match(diagnosis.reply, /No puedo decir/);
  assert.equal(policy.assess('Me gusta leer y aprender matemáticas'), null);
});
test('guard rails do not depend on cloud or collect private disclosures', () => {
  for (const flag of ['noDiagnosis','noSecrecyWithRisk','noRawDisclosureInAnalytics','noAutomaticContactOrPurchase','noPressureToPrayOrExercise','noShamingOfAppearanceOrDisability','noVoiceOrFaceAsSoleAuthentication'])
    assert.equal(policy.limits[flag], true, flag);
  assert.doesNotMatch(code, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|https?:\/\/api\./);
  const build = fs.readFileSync(path.join(root, 'build.cjs'), 'utf8');
  assert.match(build, /lego\/janus-family-guide\/janus-child-safety\.js/);
});
