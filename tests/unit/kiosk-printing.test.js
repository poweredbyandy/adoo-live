const {
  encodeEscPosBuffer,
  extractBusPrintJobs,
  looksLikeBinaryEscPos,
  preparePrintBuffer,
  resolvePrintFormat,
  shouldHandleRemotePrintJob,
  validateLocalPrintPayload,
} = require('../../src/shared/kiosk-printing');

describe('kiosk-printing', () => {
  it('valida payload local de impresión PDF', () => {
    const result = validateLocalPrintPayload({
      printer_uid: 'printer-1',
      document: 'ZGF0YQ==',
      mime_type: 'application/pdf',
      print_uid: 'abc',
    });
    expect(result.valid).toBe(true);
    expect(result.value.printer_uid).toBe('printer-1');
    expect(result.value.print_format).toBe('pdf');
  });

  it('resuelve print_format desde mime_type kiosk', () => {
    expect(resolvePrintFormat({ mime_type: 'application/vnd.pba.kiosk.zpl' })).toBe('zpl');
    expect(resolvePrintFormat({ mime_type: 'application/vnd.pba.kiosk.escpos' })).toBe('escpos');
    expect(resolvePrintFormat({ print_format: 'esc_p' })).toBe('esc_p');
  });

  it('valida payload escpos con encoding', () => {
    const result = validateLocalPrintPayload({
      printer_uid: 'printer-1',
      document: 'SGVsbG8=',
      print_format: 'escpos',
      encoding: 'cp437',
    });
    expect(result.valid).toBe(true);
    expect(result.value.print_format).toBe('escpos');
    expect(result.value.encoding).toBe('cp437');
  });

  it('rechaza payload local inválido', () => {
    expect(validateLocalPrintPayload(null).valid).toBe(false);
    expect(validateLocalPrintPayload({ document: 'ZGF0YQ==' }).valid).toBe(false);
    expect(validateLocalPrintPayload({
      printer_uid: 'printer-1',
      document: 'ZGF0YQ==',
      print_format: 'unknown',
      mime_type: 'text/plain',
    }).valid).toBe(false);
  });

  it('detecta bytes ESC/POS binarios', () => {
    expect(looksLikeBinaryEscPos(Buffer.from([0x1b, 0x40]))).toBe(true);
    expect(looksLikeBinaryEscPos(Buffer.from('Hello'))).toBe(false);
  });

  it('aplica encoding latin-1 solo a texto escpos', () => {
    const textBuffer = Buffer.from('café', 'utf8');
    const encoded = encodeEscPosBuffer(textBuffer, 'latin-1');
    expect(encoded.equals(Buffer.from('café', 'latin1'))).toBe(true);
    const binary = Buffer.from([0x1b, 0x40, 0xc3, 0xa9]);
    expect(encodeEscPosBuffer(binary, 'latin-1').equals(binary)).toBe(true);
  });

  it('prepara buffer raw sin transformación', () => {
    const payload = Buffer.from([0x00, 0x1b, 0x5e, 0x58, 0x41]);
    const encoded = payload.toString('base64');
    const prepared = preparePrintBuffer(encoded, { print_format: 'raw' });
    expect(prepared.equals(payload)).toBe(true);
  });

  it('extrae jobs del bus de Odoo', () => {
    const jobs = extractBusPrintJobs({
      id: 1,
      message: {
        type: 'pba_kiosk_print_job',
        payload: {
          job_id: 10,
          device_uid: 'device-a',
          origin_device_uid: 'device-b',
        },
      },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].job_id).toBe(10);
  });

  it('ignora jobs remotos con origen igual al destino', () => {
    expect(shouldHandleRemotePrintJob({
      device_uid: 'device-a',
      origin_device_uid: 'device-a',
    }, 'device-a')).toBe(false);
    expect(shouldHandleRemotePrintJob({
      device_uid: 'device-a',
      origin_device_uid: 'device-b',
    }, 'device-a')).toBe(true);
  });
});
