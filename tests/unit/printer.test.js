const { buildPrintOptions, normalizeRawData } = require('../../src/main/ipc/printer');
const {
  collectPrinterWebContents,
  listSystemPrinters,
  mapPrinter,
} = require('../../src/main/device-printers');

describe('printer helpers', () => {
  it('construye opciones de impresión', () => {
    expect(
      buildPrintOptions({
        silent: true,
        printBackground: false,
        deviceName: 'POS-80',
        copies: 2,
      }),
    ).toEqual({
      silent: true,
      printBackground: false,
      deviceName: 'POS-80',
      copies: 2,
    });
  });

  it('normaliza datos raw', () => {
    expect(normalizeRawData('ABC').toString()).toBe('ABC');
    expect(normalizeRawData([65, 66]).toString()).toBe('AB');
    expect(Buffer.isBuffer(normalizeRawData(Buffer.from('x')))).toBe(true);
  });
});

describe('device-printers', () => {
  it('prioriza el webContents del shell para listar impresoras del sistema', async () => {
    const shellWebContents = {
      id: 1,
      isDestroyed: () => false,
      getPrintersAsync: async () => ([{
        name: 'POS-80',
        displayName: 'POS-80',
        description: 'Generic driver',
        isDefault: true,
        status: 0,
      }]),
    };
    const odooWebContents = {
      id: 2,
      isDestroyed: () => false,
      getPrintersAsync: async () => {
        throw new Error('Odoo view unavailable');
      },
    };
    const manager = {
      window: { webContents: shellWebContents },
      tabs: [{ view: { webContents: odooWebContents } }],
      resolveOdooWebContents: () => odooWebContents,
    };
    const windowRegistry = {
      getFocused: () => manager,
      getAll: () => [manager],
    };

    const candidates = collectPrinterWebContents(windowRegistry);
    expect(candidates[0]).toBe(shellWebContents);

    const printers = await listSystemPrinters(windowRegistry);
    expect(printers).toHaveLength(1);
    expect(mapPrinter(printers[0]).name).toBe('POS-80');
  });

  it('lista impresoras aunque no haya pestañas Odoo abiertas', async () => {
    const shellWebContents = {
      id: 10,
      isDestroyed: () => false,
      getPrintersAsync: async () => ([{ name: 'Kitchen', displayName: 'Kitchen', isDefault: false }]),
    };
    const manager = {
      window: { webContents: shellWebContents },
      tabs: [{ type: 'home', view: null }],
      resolveOdooWebContents: () => null,
    };
    const windowRegistry = {
      getFocused: () => manager,
      getAll: () => [manager],
    };

    const printers = await listSystemPrinters(windowRegistry);
    expect(printers).toHaveLength(1);
    expect(printers[0].name).toBe('Kitchen');
  });
});
