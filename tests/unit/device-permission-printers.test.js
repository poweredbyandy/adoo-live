const fs = require('fs');
const path = require('path');
const { buildPrinterUid, mapPrinter } = require('../../src/main/device-printers');
const {
  buildPrinterDeviceKey,
  filterAllowedPrinters,
} = require('../../src/main/device-permission-service');

describe('device-permission printers', () => {
  it('excluye impresoras en la denylist del payload permitido', () => {
    const allowedPrinter = mapPrinter({ name: 'POS-80', displayName: 'POS-80', status: 0 });
    const deniedPrinter = mapPrinter({ name: 'Kitchen', displayName: 'Kitchen', status: 0 });
    const config = {
      permissions: { printers: true },
      permissionDeviceDenylist: {
        printers: [deniedPrinter.printer_uid],
        serial: [],
        usb: [],
      },
    };

    const filtered = filterAllowedPrinters(config, [allowedPrinter, deniedPrinter]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].printer_uid).toBe(allowedPrinter.printer_uid);
  });

  it('usa el mismo identificador en permisos y en heartbeat', () => {
    const rawPrinter = {
      name: ' EPSON TM-T88 ',
      displayName: 'TM-T88VI',
      description: 'EPSON ESC/POS',
      status: 0,
    };
    const mapped = mapPrinter(rawPrinter);
    expect(buildPrinterDeviceKey(rawPrinter)).toBe(mapped.printer_uid);
    expect(mapped.printer_uid).toBe(buildPrinterUid({ name: 'EPSON TM-T88' }));
  });

  it('devuelve lista vacía cuando el permiso global de impresoras está desactivado', () => {
    const printer = mapPrinter({ name: 'POS-80', status: 0 });
    const config = {
      permissions: { printers: false },
      permissionDeviceDenylist: { printers: [], serial: [], usb: [] },
    };
    expect(filterAllowedPrinters(config, [printer])).toEqual([]);
  });

  it('importa mapPrinter para construir la lista de permisos', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/main/device-permission-service.js'),
      'utf8',
    );
    expect(source).toContain('mapPrinter');
    expect(source).toMatch(/mapPrinter,\s*\n\s*mapPrinterStatus/);
  });
});
