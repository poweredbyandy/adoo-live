const { normalizeDefaultDevices, DEFAULT_DEVICE_DEFAULTS } = require('../../src/shared/default-devices');

describe('default-devices', () => {
  it('normaliza valores vacíos', () => {
    expect(normalizeDefaultDevices({})).toEqual(DEFAULT_DEVICE_DEFAULTS);
    expect(normalizeDefaultDevices(null)).toEqual(DEFAULT_DEVICE_DEFAULTS);
  });

  it('recorta espacios y convierte a string', () => {
    expect(normalizeDefaultDevices({
      defaultDevices: {
        printerUid: '  printer-1  ',
        usbDeviceKey: ' 2655:abcd:1:2 ',
        serialPath: ' /dev/ttyUSB0 ',
      },
    })).toEqual({
      printerUid: 'printer-1',
      usbDeviceKey: '2655:abcd:1:2',
      serialPath: '/dev/ttyUSB0',
    });
  });
});
