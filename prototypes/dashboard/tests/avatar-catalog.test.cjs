'use strict';
/** Offline contract tests; no network, browser or third-party 3D engine required. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const BASE = path.join(__dirname, '..');

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(n) { this.x = n; this.y = n; this.z = n; return this; }
}
class Object3D {
  constructor() {
    this.name = ''; this.userData = {}; this.children = [];
    this.position = new Vec3(); this.rotation = new Vec3(); this.scale = new Vec3(1, 1, 1);
  }
  add(child) { this.children.push(child); child.parent = this; return this; }
  traverse(fn) { fn(this); for (const child of this.children) child.traverse(fn); }
}
class Mesh extends Object3D {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; this.isMesh = true; }
}
class Geometry { constructor(...args) { this.args = args; } }
class Material { constructor(opts = {}) { Object.assign(this, opts); } }
const THREE = {
  Group: Object3D, Mesh, SphereGeometry: Geometry, CapsuleGeometry: Geometry,
  CatmullRomCurve3: Geometry, TubeGeometry: Geometry, Vector3: Vec3,
  MeshPhysicalMaterial: Material, MeshBasicMaterial: Material
};
const context = vm.createContext({ window: { THREE }, console });
function load(rel) { vm.runInContext(fs.readFileSync(path.join(BASE, rel), 'utf8'), context, { filename: rel }); }
load('lego/janus-avatar-catalog/janus-avatar-catalog.js');
load('lego/janus-nexo-3d/janus-nexo-3d.js');
const catalog = context.window.JanusAvatarCatalog, nexo = context.window.JanusNexo3D;

test('reusable catalog preserves one identity per NEXO and four creatures', () => {
  assert.equal(catalog.ids.length, 9);
  assert.equal(catalog.creatureIds.join(','), 'lumi,bombo,musgo,nimbo');
  assert.equal(catalog.nexoIds.join(','), 'nexo-masculino,nexo-femenino');
  assert.match(catalog.label('nexo-masculino'), /Jean/);
  assert.match(catalog.label('nexo-femenino'), /Melanie/);
  assert.equal(catalog.get('not-an-avatar'), null);
  assert.ok(Object.isFrozen(catalog.get('nexo-masculino')));
  assert.deepEqual([...new Set(catalog.riggableIds)].sort(), [...catalog.riggableIds].sort());
});
test('aliases are installation-local labels, not permissions', () => {
  assert.equal(catalog.label('nexo-femenino', { 'nexo-femenino': 'Otro nombre' }), 'Otro nombre · NEXO femenino');
  assert.equal(catalog.casting('nexo-masculino').authority, 'none');
  assert.equal(catalog.casting('nexo-femenino').role, 'presentation-only');
  assert.equal(catalog.get('nexo-femenino').casting, 'Melanie'); // original frozen
});
test('both avatars are real volumetric rigs with independent blue-eyed expressions', () => {
  const a = nexo.build('masculino'), b = nexo.build('femenino');
  assert.notStrictEqual(a.root, b.root);
  for (const [id, rig] of [['nexo-masculino', a], ['nexo-femenino', b]]) {
    assert.equal(rig.root.userData.approvedIdentity, id);
    assert.ok(catalog.validateRig(id, rig));
    const meshNames = [];
    rig.root.traverse(x => { if (x.isMesh) meshNames.push(x.name); });
    for (const required of ['labio-superior-voluminoso', 'labio-inferior-voluminoso', 'nariz-nexo', 'iris-azul']) {
      assert.ok(meshNames.some(n => n.startsWith(required)), id + ' missing ' + required);
    }
    assert.ok(meshNames.length > 65); // geometry is volumetric, not image billboard
    for (const mood of catalog.EXPRESSIONS) {
      rig.update(3, 0.016, { pose: 'habla', mood, talk: true, listening: true });
      rig.update(4, 0.016, { pose: 'saluda', mood, talk: false });
    }
    assert.equal(rig.approved.eyes, '#2385cb');
  }
  assert.throws(() => nexo.build('una-variante-no-aprobada'), /Variante/);
});
test('dashboard loads catalog before components, with independent GLB slots', () => {
  const build = fs.readFileSync(path.join(BASE, 'build.cjs'), 'utf8');
  assert.ok(build.indexOf('lego/janus-avatar-catalog/janus-avatar-catalog.js') >= 0);
  assert.ok(build.indexOf('lego/janus-avatar-catalog/janus-avatar-catalog.js') < build.indexOf("'src/avatar.js'"));
  assert.ok(build.includes('lego/janus-nexo-3d/janus-nexo-3d.js'));
  const scene = fs.readFileSync(path.join(BASE, 'lego/janus-3d/janus-3d.js'), 'utf8');
  assert.ok(scene.includes("JanusAvatarCatalog.creatureIds"));
  assert.ok(scene.includes("JanusNexo3D.build(variant)"));
  const slots = fs.readFileSync(path.join(BASE, 'lego/janus-creature-slot/janus-creature-slot.js'), 'utf8');
  assert.ok(slots.includes("JanusAvatarCatalog.riggableIds"));
  for (const p of [
    'lego/janus-avatar-catalog/manifest.json', 'lego/janus-nexo-3d/manifest.json'
  ]) assert.ok(JSON.parse(fs.readFileSync(path.join(BASE, p), 'utf8')).piece);
});
