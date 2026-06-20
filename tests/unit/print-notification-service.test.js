const {
  buildPrintNoticeBody,
  normalizePrintNotice,
} = require('../../src/main/print-notification-service');

describe('print-notification-service', () => {
  it('normaliza avisos de impresión local', () => {
    const notice = normalizePrintNotice({
      phase: 'sending',
      source: 'local',
      document_name: 'invoice.pdf',
      job_name: 'Factura',
      printer_uid: 'hp-123',
      print_uid: 'abc',
    });

    expect(notice).toMatchObject({
      phase: 'sending',
      source: 'local',
      documentName: 'invoice.pdf',
      reportName: 'Factura',
      printerUid: 'hp-123',
      printUid: 'abc',
    });
  });

  it('construye el detalle del documento y la impresora', () => {
    const body = buildPrintNoticeBody({
      reportName: 'Pedido',
      printerName: 'Cocina',
    });

    expect(body).toContain('Pedido');
    expect(body).toContain('Cocina');
  });
});
