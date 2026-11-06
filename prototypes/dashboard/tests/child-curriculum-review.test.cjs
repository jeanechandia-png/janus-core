'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const manifest = JSON.parse(read('lego/janus-family-guide/ACTIVITY_REVIEW.json'));
test('every Kendra family and etiquette activity is inventoried with source and review status', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(Object.keys(manifest.activities).length, 20);
  for (const filename of ['janus-family-guide.js', 'janus-etiquette.js']) {
    const source = read('lego/janus-family-guide/' + filename);
    const lessonIds = [...source.matchAll(/\bid\s*:\s*['"]([a-z0-9-]+)['"]/g)].map(x=>x[1]);
    assert.ok(lessonIds.length >= 9);
    const recorded = Object.values(manifest.activities).filter(a=>a.module===filename);
    assert.deepEqual(recorded.map(a=>a.id).sort(), lessonIds.sort(),filename+' full activity inventory');
    for (const item of recorded) {
      assert.ok(/^https:\/\//.test(item.primaryReference), item.id+' requires a source');
      assert.equal(item.reviewStatus,'pending','no fictional approval: '+item.id);
      assert.equal(item.clinicalGuidanceAllowed,false);
      assert.equal(item.adultReviewRequired,true);
      assert.equal(item.researchClaimApproved,false);
    }
  }
});
test('unreviewed guidance must not be bundled into child-facing A/B dashboards', () => {
  const build = read('build.cjs');
  for (const filename of ['janus-family-guide.js','janus-etiquette.js']) {
    const pending = Object.values(manifest.activities).some(a=>a.module===filename && a.reviewStatus!=='approved');
    if (pending) assert.ok(!build.includes("'lego/janus-family-guide/"+filename+"'"),
      'pending source not allowed in runtime: '+filename);
  }
  assert.ok(build.includes("'lego/janus-family-guide/janus-child-safety.js'"),
    'non-diagnostic safety guard must remain bundled');
});
test('evidence source does not convert household beliefs or etiquette preferences into clinical facts',()=>{
  assert.equal(manifest.rules.distinguishScientificEvidenceFromFamilyPractice,true);
  assert.equal(manifest.rules.optionalReligiousContent,true);
  assert.equal(manifest.rules.noCompulsoryPrayer,true);
  assert.equal(manifest.rules.noClinicalDiagnosis,true);
  assert.equal(manifest.rules.noShaming,true);
  assert.equal(manifest.rules.keepSensitiveDisclosuresLocal,true);
  assert.equal(manifest.rules.adultReviewBeforeRelease,true);
});
