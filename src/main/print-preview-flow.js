const { loadConfig } = require('./config');
const { getDefaultDevices } = require('./default-device-service');
const { validatePrintPreviewPayload } = require('../shared/kiosk-printing');
const {
  normalizePrintPreviewMode,
  shouldPreviewBeforePrint,
} = require('../shared/print-preview-mode');

function getPrintPreviewMode(config = loadConfig()) {
  return normalizePrintPreviewMode(config.printPreviewMode);
}

function withDefaultPrinterUid(payload, config = loadConfig()) {
  const printerUid = String(payload?.printer_uid || '').trim();
  if (printerUid) {
    return payload;
  }
  const defaults = getDefaultDevices(config);
  if (!defaults.printerUid) {
    return payload;
  }
  return {
    ...payload,
    printer_uid: defaults.printerUid,
  };
}

function resolveManager(windowRegistry, event) {
  return windowRegistry.getByWebContents(event.sender) || windowRegistry.getFocused();
}

async function openPrintPreview(manager, payload) {
  if (!manager) {
    throw new Error('No hay una ventana activa para previsualizar.');
  }
  manager.openPrintPreview(payload);
  return { ok: true, preview: true };
}

async function runPrintJobWithPreview({
  webContents,
  payload,
  windowRegistry,
  printJob,
}) {
  const config = windowRegistry?.config || loadConfig();
  const mode = getPrintPreviewMode(config);
  const enriched = withDefaultPrinterUid(payload, config);
  const previewResult = validatePrintPreviewPayload(enriched);

  if (shouldPreviewBeforePrint(mode) && previewResult.valid) {
    const manager = resolveManager(windowRegistry, { sender: webContents });
    await openPrintPreview(manager, previewResult.value);
    if (mode === 'before') {
      return { ok: true, previewOnly: true, preview: true };
    }
  }

  return printJob(enriched);
}

module.exports = {
  getPrintPreviewMode,
  openPrintPreview,
  resolveManager,
  runPrintJobWithPreview,
  withDefaultPrinterUid,
};
