const { parseEplBuffer, renderEplPreviewPng, renderEplPreviewSvg } = require('../../src/shared/epl-preview');
const { renderLabelPreview } = require('../../src/shared/label-preview');

function buildGwBlock(x, y, width, height, pixels) {
  const bytesPerRow = Math.ceil(width / 8);
  const data = Buffer.alloc(bytesPerRow * height);
  for (const pixel of pixels) {
    data[pixel.py * bytesPerRow + (pixel.px >> 3)] |= 1 << (7 - (pixel.px & 7));
  }
  const header = Buffer.from(`GW${x},${y},${bytesPerRow},${height}\n`, 'ascii');
  return Buffer.concat([header, data]);
}

describe('epl-preview', () => {
  it('parsea EPL binario de forma secuencial sin falsos GW', () => {
    const prefix = Buffer.from('N\nq812\nQ812,24\nZB\nrN\nD15\n', 'ascii');
    const gw = buildGwBlock(20, 6, 340, 150, [{ px: 10, py: 10 }, { px: 11, py: 10 }]);
    const suffix = Buffer.from('A40,128,0,4,1,1,N,"BULTO 1/1"\nB40,300,0,3,2,4,84,B,"PKG001"\nP1\n', 'ascii');
    const bytes = Buffer.concat([prefix, gw, suffix]);

    const parsed = parseEplBuffer(bytes);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.lines.join('\n')).toContain('BULTO 1/1');
    expect(parsed.lines.join('\n')).not.toMatch(/[\x00-\x08]/);
  });

  it('renderiza EPL binario con logo GW, texto y barcode real', async () => {
    const prefix = Buffer.from('N\nq812\nQ812,24\n', 'ascii');
    const gw = buildGwBlock(20, 6, 80, 40, [{ px: 4, py: 4 }]);
    const suffix = Buffer.from('A40,128,0,4,1,1,N,"BULTO 1/1"\nB40,300,0,3,2,4,84,B,"PKG001"\nP1\n', 'ascii');
    const bytes = Buffer.concat([prefix, gw, suffix]);
    const svg = renderEplPreviewSvg(bytes);

    expect(svg).toContain('<svg');
    expect(svg).toContain('BULTO 1/1');
    expect(svg).toContain('data-barcode-width');
    expect(svg).toContain('<path');
    expect(svg).toContain('<rect');
  });

  it('renderiza EPL binario como PNG raster', async () => {
    const prefix = Buffer.from('N\nq812\nQ812,24\n', 'ascii');
    const gw = buildGwBlock(20, 6, 80, 40, [{ px: 4, py: 4 }]);
    const suffix = Buffer.from('A40,128,0,4,1,1,N,"BULTO 1/1"\nP1\n', 'ascii');
    const bytes = Buffer.concat([prefix, gw, suffix]);
    const markup = await renderEplPreviewPng(bytes);
    expect(markup).toContain('data:image/png;base64,');
    expect(markup).toContain('812×812 dots');
  });
});

describe('label-preview', () => {
  it('renderiza ZPL como PNG raster fiel a dots', async () => {
    const zpl = `^XA
^PW812
^LL812
^FO20,20^FDCliente ACME^FS
^FO20,48^FDBulto 1/2^FS
^BY2
^FO20,76^BCN,60,Y,N,N^FDPKG001^FS
^XZ`;

    const result = await renderLabelPreview({
      print_format: 'zpl',
      text: zpl,
    });

    expect(result.engine).toBe('zebrash-raster');
    expect(result.markup).toContain('data:image/png;base64,');
    expect(result.markup).toContain('812×812 dots');
  });

  it('renderiza EPL binario sin volcar bytes en la fuente', async () => {
    const prefix = Buffer.from('N\nq812\nQ812,24\n', 'ascii');
    const gw = buildGwBlock(20, 6, 80, 40, [{ px: 4, py: 4 }]);
    const suffix = Buffer.from('A40,128,0,4,1,1,N,"Etiqueta EPL"\nP1\n', 'ascii');
    const bytes = Buffer.concat([prefix, gw, suffix]);

    const result = await renderLabelPreview({
      print_format: 'epl',
      document: bytes.toString('base64'),
      encoding: 'binary',
    });

    expect(result.engine).toBe('epl-raster');
    expect(result.markup).toContain('data:image/png;base64,');
    expect(result.sourceText).toContain('Etiqueta EPL');
    expect(result.sourceText.includes('\u0000')).toBe(false);
  });
});
