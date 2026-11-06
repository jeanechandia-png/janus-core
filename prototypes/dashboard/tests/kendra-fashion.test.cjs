'use strict';
/* Inventario real en estrellas, sin pagos ni gemas compradas.
 * El catalogo del prototipo debe mantenerse compatible con el Companion legacy.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(base,x),'utf8');
const context=vm.createContext({});
vm.runInContext(read('vendor/companion.js'),context,{filename:'vendor/companion.js'});
const C=context.Companion;
test('8 estilos nuevos y 4 calzados existen en la tienda y tienen precio verificable',()=>{
  for(const id of ['vestido-gala','vestido-aurora','chaqueta-bomber','chaqueta-lujo',
    'sudadera-estrella','sudadera-neon','capa-galaxia','capa-real']){
    const o=C.OUTFITS.find(x=>x.id===id);
    assert.ok(o&&o.label&&o.price>0,id);
    const item=C.kitShop.item('out:'+id);
    assert.ok(item&&item.price===o.price,'catalogo '+id);
  }
  assert.ok(C.SLOTS.includes('pies'));
  for(const id of ['zapatillas-estrella','botas-aventura','botines-glam','patines-aurora']){
    const a=C.ACCESSORIES.pies.find(x=>x.id===id);
    assert.ok(a&&a.price>0,id);
    const item=C.kitShop.item('acc:pies:'+id);
    assert.ok(item&&item.price===a.price,id);
  }
  const keys=C.kitShop.catalog.map(x=>x.key);
  assert.equal(new Set(keys).size,keys.length,'ids unicos');
});
test('un vestido y zapatos se ganan con estrellas, no se regalan ni se compran dos veces',()=>{
  const p=C.newKitProfile('kendra','Kendra','lumi');
  p.world=C.kitShop.newWorld();
  const missing=C.wear(p,{part:'outfit',value:'vestido-gala'});
  assert.equal(missing.ok,false);
  assert.equal(missing.why,'no-es-tuyo');
  let fail=C.kitShop.buy(p.world,'out:vestido-gala');
  assert.equal(fail.ok,false);
  assert.equal(fail.why,'faltan-estrellas');
  p.world.stars=60;
  const outfit=C.kitShop.buy(p.world,'out:vestido-gala');
  assert.equal(outfit.ok,true);
  assert.equal(outfit.world.stars,36);
  p.world=outfit.world;
  assert.equal(C.wear(p,{part:'outfit',value:'vestido-gala'}).ok,true);
  assert.equal(C.lookOf(p).outfit,'vestido-gala');
  const shoes=C.kitShop.buy(p.world,'acc:pies:zapatillas-estrella');
  assert.equal(shoes.ok,true);
  assert.equal(shoes.world.stars,24);
  p.world=shoes.world;
  assert.equal(C.wear(p,{part:'accessory',slot:'pies',value:'zapatillas-estrella'}).ok,true);
  assert.equal(C.lookOf(p).accessories.pies,'zapatillas-estrella');
  const second=C.kitShop.buy(p.world,'acc:pies:zapatillas-estrella');
  assert.equal(second.ok,false);
  assert.equal(second.why,'ya-lo-tienes');
  assert.equal(second.world.stars,24);
  p.creatureId='bombo';
  assert.notEqual(C.lookOf(p).outfit,'vestido-gala','apariencia por especie');
  assert.equal(C.worldOf(p).stars,24,'estrellas no se pierden al cambiar especie');
});
test('vestuario 3D tiene geometria independiente y soporte por especie de los zapatos',()=>{
  const scene=read('lego/janus-creatures-3d/janus-creatures-3d.js');
  for(const id of ['vestido-gala','vestido-aurora','chaqueta-bomber','chaqueta-lujo','sudadera-estrella','sudadera-neon','capa-galaxia','capa-real'])
    assert.ok(scene.includes("'"+id+"'"),'malla '+id);
  assert.match(scene,/slot === 'pies'/);
  assert.match(scene,/species === 'nimbo'/);
  assert.match(scene,/R\.slots\.pies/);
  assert.match(scene,/accessoryMesh\(slot, id, M\.acc, M, R\.id\)/);
  const companion=read('src/companero.js');
  assert.match(companion,/Companion\.SLOTS\.map/);
  assert.match(companion,/Companion\.OUTFITS\.map/);
  assert.match(companion,/Companion\.ACCESSORIES\[slot\]/);
});
test('casa, moto y coche siguen siendo comprables por estrellas',()=>{
  for(const key of ['home:hongo','veh:moto','veh:coche','veh:cohete']){
    assert.ok(C.kitShop.item(key));
  }
});
