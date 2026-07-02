const {
  deviceMatchesFilter,
  filterUsbDevices,
  normalizeUsbId,
  pickUsbDevice,
} = require('../../src/shared/webusb-filters');

describe('webusb-filters', () => {
  it('normaliza ids hexadecimales y decimales', () => {
    expect(normalizeUsbId('0x0a5f')).toBe(0x0a5f);
    expect(normalizeUsbId(2655)).toBe(2655);
    expect(normalizeUsbId('04b8')).toBe(0x04b8);
    expect(normalizeUsbId('')).toBeNull();
  });

  it('filtra por vendor y product id', () => {
    const devices = [
      { vendorId: 0x0a5f, productId: 0x0081, deviceKey: 'a', interfaceClasses: [7] },
      { vendorId: 0x0519, productId: 0x0003, deviceKey: 'b', interfaceClasses: [7] },
    ];
    const filtered = filterUsbDevices(devices, [{ vendorId: 0x0a5f, productId: 0x0081 }]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].deviceKey).toBe('a');
  });

  it('exige classCode cuando el filtro lo indica', () => {
    expect(deviceMatchesFilter({ vendorId: 1, interfaceClasses: [7] }, { classCode: 7 })).toBe(true);
    expect(deviceMatchesFilter({ vendorId: 1, interfaceClasses: [3] }, { classCode: 7 })).toBe(false);
    expect(deviceMatchesFilter({ vendorId: 0x0a5f, interfaceClasses: [] }, { vendorId: 0x0a5f })).toBe(true);
  });

  it('prioriza dispositivo predeterminado aunque el filtro no coincida', () => {
    const devices = [
      { deviceKey: 'serial:/dev/tty.usbserial', vendorId: 0x0a5f, viaSerialPath: '/dev/tty.usbserial' },
    ];
    const picked = pickUsbDevice(
      devices,
      [{ vendorId: 0xffff }],
      { usbDeviceKey: 'serial:/dev/tty.usbserial' },
    );
    expect(picked?.deviceKey).toBe('serial:/dev/tty.usbserial');
  });
});
