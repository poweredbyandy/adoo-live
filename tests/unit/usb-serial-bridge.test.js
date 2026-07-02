const {
  buildSerialBackedDeviceKey,
  isSerialBackedDeviceKey,
  parseSerialBackedDeviceKey,
} = require('../../src/main/usb-serial-bridge');

describe('usb-serial-bridge', () => {
  it('genera claves serial-backed estables', () => {
    const key = buildSerialBackedDeviceKey('/dev/tty.usbserial-1410');
    expect(key).toBe('serial:/dev/tty.usbserial-1410');
    expect(isSerialBackedDeviceKey(key)).toBe(true);
    expect(parseSerialBackedDeviceKey(key)).toBe('/dev/tty.usbserial-1410');
  });
});
