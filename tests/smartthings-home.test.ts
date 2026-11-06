import test from 'node:test';
import assert from 'node:assert/strict';
import { planSmartThingsCommand, bluetoothInventory, type SmartDevice } from '../packages/modules/home-scenes/src/smartthings.js';
const tv: SmartDevice = { id: '123e4567-e89b-12d3-a456-426614174000', label: 'Samsung TV', kind: 'tv', capabilities: ['switch','audioMute','audioVolume'], childAllowed: true };
test('SmartThings planner validates capability and payload', () => {
  const req = planSmartThingsCommand(tv, 'founder', 'setVolume', 25);
  assert.equal(req.path, '/v1/devices/' + tv.id + '/commands');
  assert.deepEqual(req.body.commands, [{ component:'main', capability:'audioVolume', command:'setVolume', arguments:[25] }]);
  assert.throws(() => planSmartThingsCommand(tv, 'founder', 'setVolume', 120), /Volume/);
  assert.throws(() => planSmartThingsCommand({ ...tv, capabilities: [] }, 'founder', 'on'), /Capability/);
  assert.throws(() => planSmartThingsCommand({ ...tv, id: '../devices' }, 'founder', 'on'), /UUID/);
});
test('Child profile cannot control non-approved devices', () => {
  assert.throws(() => planSmartThingsCommand({ ...tv, childAllowed:false }, 'child', 'on'), /not permitted/);
  assert.equal(planSmartThingsCommand(tv, 'child', 'mute').body.commands[0]?.command, 'mute');
});
test('Bluetooth inventory is not represented as paired or remotely controllable', () => {
  const items = bluetoothInventory(['AirPods Pro 3', 'Apple Watch Ultra', 'BT5.2 Mouse', 'JBL Xtreme 2']);
  assert.equal(items.length, 4);
  assert.equal(items[0]?.kind, 'audio');
  assert.equal(items[1]?.kind, 'wearable');
  assert.ok(items.every(item => item.connection === 'not_verified' && item.control === 'requires_device_integration'));
});
