const { parseEscpDocument, renderEscpPreviewPng } = require('../../src/shared/escp-preview');
const { parseEscposDocument, renderEscposPreviewPng } = require('../../src/shared/escpos-preview');
const { renderLabelPreview } = require('../../src/shared/label-preview');

describe('escp-preview', () => {
  it('parsea paginas ESC/P con form feed y mantiene 80 columnas', () => {
    const bytes = Buffer.from(
      '\x1b@Pagina 1 linea\r\n' + 'A'.repeat(80) + '\r\n\f\x1b@Pagina 2\r\n',
      'latin1'
    );
    const pages = parseEscpDocument(bytes);
    expect(pages).toHaveLength(2);
    expect(pages[0][0].map((segment) => segment.text).join('')).toBe('Pagina 1 linea');
    expect(pages[0][1].map((segment) => segment.text).join('')).toBe('A'.repeat(80));
    expect(pages[1][0].map((segment) => segment.text).join('')).toBe('Pagina 2');
  });

  it('aplica negrita y ancho doble ESC/P', () => {
    const bytes = Buffer.from('\x1bE\x01Negrita\x1bF \x1bW\x01ANCHO\x1bW\x00', 'latin1');
    const lines = parseEscpDocument(bytes);
    expect(lines).toHaveLength(1);
    const segments = lines[0][0];
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ text: 'Negrita', bold: true });
    expect(segments[1]).toMatchObject({ text: ' ', bold: false });
    expect(segments[2]).toMatchObject({ text: 'ANCHO', wide: true });
  });

  it('renderiza documento ESC/P como PNG raster', () => {
    const bytes = Buffer.from('\x1b@Nota de despacho\r\n\f', 'latin1');
    const html = renderEscpPreviewPng(bytes);
    expect(html).toContain('print-preview-raster-document');
    expect(html).toContain('print-preview-escp-page');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('print-preview-receipt');
  });

  it('interpreta ESC d como avance de linea', () => {
    const bytes = Buffer.from('Linea 1\x1bd\x01Linea 2', 'latin1');
    const pages = parseEscpDocument(bytes);
    expect(pages[0]).toHaveLength(2);
    expect(pages[0][0].map((segment) => segment.text).join('')).toBe('Linea 1');
    expect(pages[0][1].map((segment) => segment.text).join('')).toBe('Linea 2');
  });
});

describe('escpos-preview', () => {
  it('parsea tamano GS ! en ticket ESC/POS', () => {
    const bytes = Buffer.from('\x1d!\x11DOBLE\x1d!\x00 normal', 'latin1');
    const lines = parseEscposDocument(bytes);
    expect(lines).toHaveLength(1);
    const segments = lines[0];
    expect(segments[0]).toMatchObject({ text: 'DOBLE', doubleWidth: true, doubleHeight: true });
    expect(segments[1]).toMatchObject({ text: ' normal', doubleWidth: false, doubleHeight: false });
  });

  it('renderiza ticket ESC/POS como PNG raster', () => {
    const bytes = Buffer.from('\x1b@Ticket POS\r\nTotal: 10.00\r\n', 'latin1');
    const html = renderEscposPreviewPng(bytes);
    expect(html).toContain('print-preview-receipt');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('ESC/POS');
    expect(html).not.toContain('print-preview-escp-page');
  });
});

describe('label-preview esc formats', () => {
  it('usa motor ESC/P raster para esc_p', async () => {
    const bytes = Buffer.from('\x1b@PBA Kiosk ESC/P Test\r\n\r\nProducto: ADOO-IOT\r\n\f', 'latin1');
    const result = await renderLabelPreview({
      print_format: 'esc_p',
      document: bytes.toString('base64'),
      encoding: 'cp437',
    });
    expect(result.engine).toBe('escp-raster');
    expect(result.markup).toContain('data:image/png;base64,');
    expect(result.sourceText).toContain('Producto: ADOO-IOT');
    expect(result.sourceText).not.toMatch(/[\x00-\x08]/);
  });

  it('usa motor ESC/POS raster para escpos', async () => {
    const bytes = Buffer.from('\x1b@Ticket\r\n\x1d!\x11GRANDE\x1d!\x00\r\n', 'latin1');
    const result = await renderLabelPreview({
      print_format: 'escpos',
      document: bytes.toString('base64'),
      encoding: 'cp437',
    });
    expect(result.engine).toBe('escpos-raster');
    expect(result.markup).toContain('data:image/png;base64,');
    expect(result.markup).not.toContain('print-preview-escp-page');
    expect(result.markup).not.toContain('<svg');
  });
});
