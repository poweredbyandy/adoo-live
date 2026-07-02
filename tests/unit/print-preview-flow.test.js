const {
  runPrintJobWithPreview,
  withDefaultPrinterUid,
} = require('../../src/main/print-preview-flow');

describe('print-preview-flow', () => {
  const webContents = { id: 1 };
  const previewPayload = {
    document: Buffer.from('^XA^XZ').toString('base64'),
    mime_type: 'application/vnd.pba.kiosk.zpl',
    print_format: 'zpl',
    document_name: 'label.zpl',
  };

  function createRegistry(config = { printPreviewMode: 'before' }) {
    const manager = {
      openPrintPreview: vi.fn(),
    };
    return {
      config,
      getByWebContents: vi.fn(() => manager),
      getFocused: vi.fn(() => manager),
      manager,
    };
  }

  it('abre previsualización y no imprime en modo before', async () => {
    const windowRegistry = createRegistry({ printPreviewMode: 'before' });
    const printJob = vi.fn();

    const result = await runPrintJobWithPreview({
      webContents,
      payload: previewPayload,
      windowRegistry,
      printJob,
    });

    expect(result).toEqual({ ok: true, previewOnly: true, preview: true });
    expect(windowRegistry.manager.openPrintPreview).toHaveBeenCalledTimes(1);
    expect(printJob).not.toHaveBeenCalled();
  });

  it('abre previsualización e imprime en modo before_and_print', async () => {
    const windowRegistry = createRegistry({ printPreviewMode: 'before_and_print' });
    const printJob = vi.fn().mockResolvedValue({ ok: true, printed: true });

    const result = await runPrintJobWithPreview({
      webContents,
      payload: previewPayload,
      windowRegistry,
      printJob,
    });

    expect(windowRegistry.manager.openPrintPreview).toHaveBeenCalledTimes(1);
    expect(printJob).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, printed: true });
  });

  it('imprime directamente en modo off', async () => {
    const windowRegistry = createRegistry({ printPreviewMode: 'off' });
    const printJob = vi.fn().mockResolvedValue({ ok: true });

    await runPrintJobWithPreview({
      webContents,
      payload: previewPayload,
      windowRegistry,
      printJob,
    });

    expect(windowRegistry.manager.openPrintPreview).not.toHaveBeenCalled();
    expect(printJob).toHaveBeenCalledTimes(1);
  });

  it('conserva job_id al previsualizar trabajos remotos', async () => {
    const windowRegistry = createRegistry({ printPreviewMode: 'before' });
    const printJob = vi.fn();

    await runPrintJobWithPreview({
      webContents,
      payload: { ...previewPayload, job_id: 42 },
      windowRegistry,
      printJob,
    });

    expect(windowRegistry.manager.openPrintPreview).toHaveBeenCalledWith(
      expect.objectContaining({ job_id: 42 }),
    );
  });

  it('inyecta impresora por defecto cuando falta printer_uid', () => {
    const enriched = withDefaultPrinterUid(
      { document: 'abc' },
      { defaultDevices: { printerUid: 'default-printer' } },
    );
    expect(enriched.printer_uid).toBe('default-printer');
  });
});
