const { US_LETTER, THERMAL_80MM, getLetterCanvasSize, getThermal80mmCanvasWidth, mmToDots } = require('../../src/shared/paper-profiles');
const { PAGE_LAYOUT } = require('../../src/shared/escp-preview');
const { THERMAL_WIDTH_DOTS, renderEscposPreviewPng } = require('../../src/shared/escpos-preview');

describe('paper-profiles', () => {
  it('define carta US Letter para ESC/P', () => {
    expect(US_LETTER.widthIn).toBe(8.5);
    expect(US_LETTER.heightIn).toBe(11);
    const layout = getLetterCanvasSize(240, 144);
    expect(layout.width).toBe(2040);
    expect(layout.height).toBe(1584);
    expect(PAGE_LAYOUT.width).toBe(2040);
    expect(PAGE_LAYOUT.height).toBe(1584);
  });

  it('define rollo termico 80 mm para ESC/POS', () => {
    expect(THERMAL_80MM.widthMm).toBe(80);
    expect(mmToDots(80, 203)).toBe(639);
    expect(getThermal80mmCanvasWidth()).toBe(639);
    expect(THERMAL_WIDTH_DOTS).toBe(639);
  });

  it('renderiza ticket ESC/POS con ancho de papel 80 mm', () => {
    const bytes = Buffer.from('\x1b@Ticket POS 80mm\r\nTotal: 10.00\r\n', 'latin1');
    const html = renderEscposPreviewPng(bytes);
    expect(html).toContain('papel 80 mm');
    expect(html).toContain('width="639"');
  });
});
