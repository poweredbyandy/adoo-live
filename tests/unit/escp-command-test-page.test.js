const {
  ESCP_COMMAND_TEST_SECTIONS,
  buildEscpCommandTestLines,
  buildEscpCommandTestPayload,
  buildEscpCommandTestPreviewPayload,
} = require('../../src/shared/escp-command-test-page');
const { parseEscpDocument, renderEscpPreviewPng } = require('../../src/shared/escp-preview');
const { renderLabelPreview } = require('../../src/shared/label-preview');

describe('escp-command-test-page', () => {
  it('incluye todas las secciones de comandos ESC/P', () => {
    const text = buildEscpCommandTestLines().join('\n');
    for (const section of ESCP_COMMAND_TEST_SECTIONS) {
      if (section === 'FORM FEED') {
        continue;
      }
      expect(text).toContain(section);
    }
  });

  it('genera documento de dos paginas con form feed', () => {
    const payload = buildEscpCommandTestPayload();
    const pages = parseEscpDocument(payload);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].length).toBeGreaterThan(25);
    expect(pages[1][0].map((segment) => segment.text).join('')).toContain('PAGINA 2');
  });

  it('parsea negrita, ancho doble, condensado y cursiva del fixture', () => {
    const payload = buildEscpCommandTestPayload();
    const pages = parseEscpDocument(payload);
    const flat = pages.flat().flat();
    expect(flat.some((segment) => segment.bold)).toBe(true);
    expect(flat.some((segment) => segment.wide)).toBe(true);
    expect(flat.some((segment) => segment.condensed)).toBe(true);
    expect(flat.some((segment) => segment.italic)).toBe(true);
    expect(flat.some((segment) => segment.doubleStrike)).toBe(true);
    expect(flat.some((segment) => segment.underline)).toBe(true);
    expect(flat.some((segment) => segment.cpi === 12)).toBe(true);
    expect(flat.some((segment) => segment.fontFace === 'courier')).toBe(true);
  });

  it('renderiza la pagina de prueba completa como PNG carta', async () => {
    const previewPayload = buildEscpCommandTestPreviewPayload();
    const result = await renderLabelPreview(previewPayload);
    expect(result.engine).toBe('escp-raster');
    expect(result.sourceText).toContain('PAGINA PRUEBA ESC/P');
    expect(result.markup).toContain('data:image/png;base64,');
    const markup = renderEscpPreviewPng(buildEscpCommandTestPayload());
    expect(markup).toContain('Carta 8.5×11');
  });
});
