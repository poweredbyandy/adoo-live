const {
  buildPreviewPayloadFromBytes,
  inferPrintFormatFromBytes,
  normalizePrintPreviewMode,
  shouldAutoPrintAfterPreview,
  shouldPreviewBeforePrint,
} = require('../../src/shared/print-preview-mode');

describe('print-preview-mode', () => {
  it('normaliza modos desconocidos a before', () => {
    expect(normalizePrintPreviewMode('before')).toBe('before');
    expect(normalizePrintPreviewMode('before_and_print')).toBe('before_and_print');
    expect(normalizePrintPreviewMode('off')).toBe('off');
    expect(normalizePrintPreviewMode('invalid')).toBe('before');
  });

  it('detecta ZPL y EPL en buffers de etiquetas', () => {
    expect(inferPrintFormatFromBytes(Buffer.from('^XA^FO50,50^FDTest^FS^XZ'))).toBe('zpl');
    expect(inferPrintFormatFromBytes(Buffer.from('N\nq812\nA50,50,0,3,1,1,N,"Hola"\nP1\n'))).toBe('epl');
  });

  it('distingue ESC/P matriz de ESC/POS termico en WebUSB', () => {
    const escp = Buffer.from(
      '\x1b@\x1b\x78\x01\x1b\x55\x01\x1b\x47EMPRESA SA\r\n'
      + 'Nota de despacho de la Factura: F001\r\n'
      + '-'.repeat(80) + '\r\n',
      'latin1',
    );
    const escpos = Buffer.from(
      '\x1b@\x1d!\x00Ticket POS\n'
      + 'Producto A\n'
      + 'Total: 10.00\n'
      + '\x1dV\x00',
      'latin1',
    );
    expect(inferPrintFormatFromBytes(escp)).toBe('esc_p');
    expect(inferPrintFormatFromBytes(escpos)).toBe('escpos');
    expect(buildPreviewPayloadFromBytes(escp, {}).print_format).toBe('esc_p');
    expect(buildPreviewPayloadFromBytes(escpos, {}).print_format).toBe('escpos');
  });

  it('respeta command_set y mime_type al construir payload', () => {
    const bytes = Buffer.from('\x1b@demo', 'latin1');
    expect(buildPreviewPayloadFromBytes(bytes, { command_set: 'esc_p_epson' }).print_format).toBe('esc_p');
    expect(buildPreviewPayloadFromBytes(bytes, {
      mime_type: 'application/vnd.pba.kiosk.escpos',
    }).print_format).toBe('escpos');
  });

  it('construye payload de previsualización en base64', () => {
    const payload = buildPreviewPayloadFromBytes(Buffer.from('^XA^XZ'), {
      document_name: 'label.zpl',
    });
    expect(payload.print_format).toBe('zpl');
    expect(payload.document).toBe(Buffer.from('^XA^XZ').toString('base64'));
    expect(payload.document_name).toBe('label.zpl');
  });

  it('expone helpers de flujo de impresión', () => {
    expect(shouldPreviewBeforePrint('before')).toBe(true);
    expect(shouldPreviewBeforePrint('before_and_print')).toBe(true);
    expect(shouldPreviewBeforePrint('off')).toBe(false);
    expect(shouldAutoPrintAfterPreview('before_and_print')).toBe(true);
    expect(shouldAutoPrintAfterPreview('before')).toBe(false);
  });
});
