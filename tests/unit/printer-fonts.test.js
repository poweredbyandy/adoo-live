const {
  getEplFontSpec,
  getEscpTypography,
  getEscposFontSpec,
  normalizeEscpFontFace,
} = require('../../src/shared/printer-fonts');
const { parseEscpDocument } = require('../../src/shared/escp-preview');
const { parseEscposDocument } = require('../../src/shared/escpos-preview');

describe('printer-fonts', () => {
  it('expone metricas EPL por fuente residente 1-5', () => {
    expect(getEplFontSpec(1, 1, 1).cellWidth).toBe(8);
    expect(getEplFontSpec(5, 1, 1).cellWidth).toBe(32);
    expect(getEplFontSpec(5, 1, 1).uppercaseOnly).toBe(true);
    expect(getEplFontSpec(3, 2, 2).cellWidth).toBe(24);
    expect(getEplFontSpec(3, 2, 2).cellHeight).toBe(40);
  });

  it('resuelve tipografias ESC/P por ESC k y CPI (Epson LX-300+II)', () => {
    const bytes = Buffer.from(
      '\x1b\x6b\x02Courier\r\n\x1b\x4dElite\r\n\x1b\x6b\x00Roman\r\n',
      'latin1',
    );
    const pages = parseEscpDocument(bytes);
    const line = pages[0];
    expect(line[0][0].fontFace).toBe('courier');
    expect(line[1][0].cpi).toBe(12);
    expect(normalizeEscpFontFace(line[2][0].fontFace)).toBe('roman');
    expect(getEscpTypography(line[0][0]).family).toContain('Courier');
    expect(getEscpTypography(line[2][0]).family).toContain('Times');
    expect(getEscpTypography({ cpi: 10 }).charWidth).toBe(24);
    expect(getEscpTypography({ cpi: 12 }).charWidth).toBe(20);
  });

  it('resuelve fuentes ESC/POS A y B', () => {
    const bytes = Buffer.from('\x1b@Normal\r\n\x1bMPequena\r\n', 'latin1');
    const lines = parseEscposDocument(bytes);
    expect(getEscposFontSpec(lines[0][0]).fontKey).toBe('A');
    expect(getEscposFontSpec(lines[1][0]).fontKey).toBe('B');
    expect(getEscposFontSpec(lines[1][0]).charWidth).toBeLessThan(
      getEscposFontSpec(lines[0][0]).charWidth,
    );
  });
});
