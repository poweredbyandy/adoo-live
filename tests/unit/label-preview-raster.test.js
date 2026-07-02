const { buildPreviewRasterMarkup, toImageBuffer } = require('../../src/shared/label-preview-raster');
const { renderLabelPreview } = require('../../src/shared/label-preview');

describe('label-preview-raster', () => {
  it('codifica Uint8Array de zebrash como base64 PNG valido', () => {
    const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const markup = buildPreviewRasterMarkup(pngHeader, { alt: 'test' });
    expect(markup).toContain('data:image/png;base64,');
    expect(markup).not.toContain('137,80,78,71');
    const match = markup.match(/data:image\/png;base64,([^"]+)"/);
    expect(match).toBeTruthy();
    const decoded = Buffer.from(match[1], 'base64');
    expect(decoded.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  it('convierte buffers de imagen soportados', () => {
    const fromUint8 = toImageBuffer(Uint8Array.from([1, 2, 3]));
    const fromArray = toImageBuffer([4, 5, 6]);
    expect(Buffer.isBuffer(fromUint8)).toBe(true);
    expect(Buffer.isBuffer(fromArray)).toBe(true);
    expect(fromUint8.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });
});

describe('label-preview raster integration', () => {
  it('genera ZPL con PNG base64 valido', async () => {
    const result = await renderLabelPreview({
      print_format: 'zpl',
      text: '^XA^PW200^LL200^FO20,20^FDCliente ACME^FS^XZ',
    });
    expect(result.engine).toBe('zebrash-raster');
    const match = result.markup.match(/data:image\/png;base64,([^"]+)"/);
    expect(match).toBeTruthy();
    expect(match[1]).not.toMatch(/,/);
    const decoded = Buffer.from(match[1], 'base64');
    expect(decoded.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
