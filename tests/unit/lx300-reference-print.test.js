const fs = require('fs');
const path = require('path');
const {
  buildLx300ReferenceLines,
  buildLx300ReferencePayload,
  buildLx300ReferencePreviewPayload,
} = require('../../src/shared/lx300-reference-print');
const { EPSON_LX300_PLUS_II, getLx300Typography } = require('../../src/shared/epson-lx300-profile');
const { parseEscpDocument, renderEscpPreviewPng, PAGE_LAYOUT } = require('../../src/shared/escp-preview');
const { renderLabelPreview } = require('../../src/shared/label-preview');
const { getEscpTypography } = require('../../src/shared/printer-fonts');

function extractPngBuffer(markup) {
  const match = String(markup || '').match(/data:image\/png;base64,([^"']+)/);
  return match ? Buffer.from(match[1], 'base64') : null;
}

describe('lx300-reference-print', () => {
  it('genera la misma estructura de demo que Odoo escp_demo_doc', () => {
    const lines = buildLx300ReferenceLines();
    expect(lines[0]).toContain('PAGINA PRUEBA ESC/P');
    expect(lines.some((line) => line.includes('PICA 10 CPI'))).toBe(true);
    expect(lines.some((line) => line.includes('ELITE 12 CPI'))).toBe(true);
    expect(lines.some((line) => line.includes('FUENTES ESC k'))).toBe(true);
    expect(lines.some((line) => line.includes('CONDENSADO'))).toBe(true);
    expect(lines.length).toBeGreaterThan(25);
  });

  it('usa metricas LX-300+II 240x144 dpi con celdas cuadradas a 10 CPI / 6 LPI', () => {
    const typography = getLx300Typography({ cpi: 10, lpi: 6 });
    expect(typography.charWidth).toBe(24);
    expect(typography.lineHeight).toBe(24);
    expect(getLx300Typography({ cpi: 12 }).charWidth).toBe(20);
    expect(getLx300Typography({ condensed: true }).cpi).toBe(17);
    expect(getEscpTypography({ fontFace: 'roman' }).family).toContain('Times');
    expect(getEscpTypography({ fontFace: 'draft' }).family).toContain('Courier');
  });

  it('renderiza PNG carta LX-300+II con ancho y alto del perfil', () => {
    const payload = buildLx300ReferencePayload();
    const pages = parseEscpDocument(payload);
    expect(pages).toHaveLength(2);
    expect(pages[0].length).toBeGreaterThan(25);

    const markup = renderEscpPreviewPng(payload);
    const png = extractPngBuffer(markup);
    expect(png).toBeTruthy();
    expect(png.readUInt32BE(0)).toBe(0x89504e47);
    expect(markup).toContain('Epson LX-300+II');
    expect(markup).toContain(`${PAGE_LAYOUT.width}`);
    expect(markup).toContain(`${EPSON_LX300_PLUS_II.dpiX}×${EPSON_LX300_PLUS_II.dpiY}`);
  });

  it('pasa por renderLabelPreview como esc_p fiel al kiosk', async () => {
    const previewPayload = buildLx300ReferencePreviewPayload();
    const result = await renderLabelPreview(previewPayload);
    expect(result.engine).toBe('escp-raster');
    expect(result.sourceText).toContain('PAGINA PRUEBA ESC/P');
    expect(result.sourceText).toContain('Roman k=0');
    expect(result.markup).toContain('data:image/png;base64,');
  });

  it('escribe artefactos de referencia para comparar con impresion fisica', () => {
    const outDir = path.join(process.cwd(), 'dist');
    const payload = buildLx300ReferencePayload();
    const markup = renderEscpPreviewPng(payload);
    const png = extractPngBuffer(markup);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'lx300-reference-print.bin'), payload);
    fs.writeFileSync(path.join(outDir, 'lx300-reference-preview.png'), png);
    expect(fs.existsSync(path.join(outDir, 'lx300-reference-preview.png'))).toBe(true);
  });
});
