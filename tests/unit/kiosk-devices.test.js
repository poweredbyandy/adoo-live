const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadOrCreateDeviceUid,
  normalizeMacAddress,
  getPrimaryNetworkInfo,
} = require('../../src/main/device-identity');
const { mapPrinter, mapPrinterStatus, buildPrinterUid } = require('../../src/main/device-printers');
const { buildPostScript } = require('../../src/shared/kiosk-page-fetch');

describe('device-identity', () => {
  it('persiste un device_uid estable en disco', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odoo-kiosk-device-'));
    const first = loadOrCreateDeviceUid(tempDir);
    const second = loadOrCreateDeviceUid(tempDir);
    expect(first).toBe(second);
  });

  it('normaliza direcciones MAC', () => {
    expect(normalizeMacAddress('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(normalizeMacAddress('00:00:00:00:00:00')).toBe('');
  });

  it('obtiene datos de red primarios', () => {
    const network = getPrimaryNetworkInfo();
    expect(network).toHaveProperty('mac_address');
    expect(network).toHaveProperty('ip_address');
  });
});

describe('device-printers', () => {
  it('mapea impresoras de Electron al payload Odoo', () => {
    const payload = mapPrinter({
      name: 'EPSON TM-T88',
      displayName: 'TM-T88VI',
      description: 'EPSON ESC/POS',
      status: 0,
      isDefault: true,
      options: { type: 'usb', location: 'Mostrador' },
    });
    expect(payload.name).toBe('EPSON TM-T88');
    expect(payload.driver).toBe('EPSON ESC/POS');
    expect(payload.is_default).toBe(true);
    expect(payload.status).toBe('ready');
    expect(payload.connection_type).toBe('usb');
    expect(payload.location).toBe('Mostrador');
    expect(payload.printer_uid).toBe(buildPrinterUid({ name: 'EPSON TM-T88' }));
  });

  it('traduce estados de impresora', () => {
    expect(mapPrinterStatus(0)).toBe('ready');
    expect(mapPrinterStatus(99)).toBe('offline');
    expect(mapPrinterStatus(undefined)).toBe('unknown');
  });
});

describe('kiosk-page-fetch', () => {
  it('genera script POST con payload JSON', () => {
    const script = buildPostScript('/pba_kiosk/device/heartbeat', {
      device_uid: 'abc-123',
      hostname: 'CAJA-01',
    });
    expect(script).toContain('/pba_kiosk/device/heartbeat');
    expect(script).toContain('device_uid');
    expect(script).toContain('CAJA-01');
  });
});
