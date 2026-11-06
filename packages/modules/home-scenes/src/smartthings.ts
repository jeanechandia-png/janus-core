/** JANUS home control: pure SmartThings command planner. No network or credentials. */
export type HomeRole = 'founder' | 'child';
export type SmartDeviceKind = 'tv' | 'light' | 'plug' | 'speaker' | 'other';
export interface SmartDevice {
  id: string;
  label: string;
  kind: SmartDeviceKind;
  capabilities: readonly string[];
  childAllowed: boolean;
}
export type HomeCommand = 'on' | 'off' | 'mute' | 'unmute' | 'setVolume';
export interface SmartThingsRequest {
  method: 'POST';
  path: string;
  body: { commands: Array<{ component: 'main'; capability: string; command: string; arguments: number[] }> };
}
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function planSmartThingsCommand(device: SmartDevice, role: HomeRole, command: HomeCommand, value?: number): SmartThingsRequest {
  if (!UUID.test(device.id)) throw new Error('Device ID must be a SmartThings UUID');
  if (role === 'child' && !device.childAllowed) throw new Error('Device not permitted for child profile');
  const spec: Record<HomeCommand, { capability: string; command: string }> = {
    on: { capability: 'switch', command: 'on' },
    off: { capability: 'switch', command: 'off' },
    mute: { capability: 'audioMute', command: 'mute' },
    unmute: { capability: 'audioMute', command: 'unmute' },
    setVolume: { capability: 'audioVolume', command: 'setVolume' },
  };
  const selected = spec[command];
  if (!device.capabilities.includes(selected.capability)) throw new Error('Capability unavailable on device');
  if (command === 'setVolume' && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100)) {
    throw new Error('Volume must be an integer from 0 to 100');
  }
  return {
    method: 'POST',
    path: '/v1/devices/' + device.id + '/commands',
    body: { commands: [{ component: 'main', capability: selected.capability, command: selected.command, arguments: command === 'setVolume' ? [value!] : [] }] },
  };
}
/** Bluetooth list is a user-provided inventory, not a discovery or remote-control grant. */
export interface BluetoothInventoryItem {
  label: string;
  kind: 'audio' | 'wearable' | 'input' | 'computer' | 'unknown';
  connection: 'not_verified' | 'connected' | 'disconnected';
  control: 'requires_device_integration';
}
export function bluetoothInventory(labels: readonly string[]): BluetoothInventoryItem[] {
  return labels.map((label) => ({
    label,
    kind: /airpods|jbl|h[k] |samsung s/i.test(label) ? 'audio'
      : /watch/i.test(label) ? 'wearable'
      : /mouse|keyboard|keyboa|dualsense/i.test(label) ? 'input'
      : /laptop|lenovo/i.test(label) ? 'computer' : 'unknown',
    connection: 'not_verified',
    control: 'requires_device_integration',
  }));
}
