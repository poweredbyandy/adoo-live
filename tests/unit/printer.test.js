const { buildPrintOptions, normalizeRawData } = require('../../src/main/ipc/printer');

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
