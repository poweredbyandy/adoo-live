const { IPC } = require('../../shared/ipc-channels');
const { validateLocalPrintPayload, validatePrintPreviewPayload } = require('../../shared/kiosk-printing');
const {
  buildPreviewPayloadFromBytes,
  shouldAutoPrintAfterPreview,
} = require('../../shared/print-preview-mode');
const { loadConfig } = require('../config');
const { getDeviceIdentity } = require('../device-identity');
const { printLocalFromBridge, postPrintJobResult } = require('../kiosk-printing-service');
const { notifyPrintersPossiblyChanged } = require('../kiosk-device-service');
const { PERMISSION_TYPES, ensurePermission, getDialogParent } = require('../permission-service');
const {
  getPrintPreviewMode,
  openPrintPreview,
  resolveManager,
  runPrintJobWithPreview,
} = require('../print-preview-flow');
const { t } = require('../../i18n');

async function printPreviewPayload(event, payload, windowRegistry) {
  const result = validateLocalPrintPayload(payload);
  if (!result.valid) {
    throw new Error(result.error);
  }
  const printResult = await printLocalFromBridge(event.sender, result.value);
  await notifyPrintersPossiblyChanged(event.sender);
  return printResult;
}

async function printLocalWithPermission(event, payload, windowRegistry) {
  await ensurePermission(windowRegistry, PERMISSION_TYPES.PRINTERS, {
    browserWindow: getDialogParent(windowRegistry),
    source: 'pba-kiosk-print',
    actionLabel: t('Print from Odoo'),
  });

  const result = validateLocalPrintPayload(payload);
  if (!result.valid) {
    throw new Error(result.error);
  }
  if (event.sender.isDestroyed()) {
    throw new Error('No hay una sesión activa para imprimir.');
  }
  const printResult = await printLocalFromBridge(event.sender, result.value);
  await notifyPrintersPossiblyChanged(event.sender);
  return printResult;
}

function registerPbaKioskHandlers(ipcMain) {
  ipcMain.on(IPC.PBA_KIOSK_DEVICE_UID, (event) => {
    event.returnValue = getDeviceIdentity().device_uid;
  });

  ipcMain.handle(IPC.PBA_KIOSK_PRINT_PREVIEW_MODE_GET, () => {
    const { windowRegistry } = require('../window-registry');
    return getPrintPreviewMode(windowRegistry.config || loadConfig());
  });

  ipcMain.handle(IPC.PBA_KIOSK_PRINT, async (event, payload) => {
    const { windowRegistry } = require('../window-registry');
    return runPrintJobWithPreview({
      webContents: event.sender,
      payload,
      windowRegistry,
      printJob: (enriched) => printLocalWithPermission(event, enriched, windowRegistry),
    });
  });

  ipcMain.handle(IPC.PBA_KIOSK_PREVIEW, async (event, payload) => {
    const result = validatePrintPreviewPayload(payload);
    if (!result.valid) {
      throw new Error(result.error);
    }
    const { windowRegistry } = require('../window-registry');
    return openPrintPreview(resolveManager(windowRegistry, event), result.value);
  });

  ipcMain.handle(IPC.PBA_KIOSK_USB_PRINT_CAPTURE, async (event, payload) => {
    const bytes = Array.isArray(payload?.data) ? payload.data : [];
    const { windowRegistry } = require('../window-registry');
    const config = windowRegistry.config || loadConfig();
    const mode = getPrintPreviewMode(config);
    const previewPayload = buildPreviewPayloadFromBytes(bytes, payload || {});
    const manager = resolveManager(windowRegistry, event);
    await openPrintPreview(manager, previewPayload);

    if (payload?.autoPrint && shouldAutoPrintAfterPreview(mode)) {
      try {
        await ensurePermission(windowRegistry, PERMISSION_TYPES.PRINTERS, {
          browserWindow: getDialogParent(windowRegistry),
          source: 'pba-kiosk-usb-capture',
          actionLabel: t('Print preview document'),
        });
        const printResult = await printPreviewPayload(event, previewPayload, windowRegistry);
        return { ok: true, preview: true, printed: true, ...printResult };
      } catch (error) {
        return {
          ok: true,
          preview: true,
          printed: false,
          printError: error.message || t('Unknown error'),
        };
      }
    }
    return { ok: true, preview: true };
  });

  ipcMain.handle(IPC.PBA_KIOSK_PRINT_PREVIEW, async (event) => {
    const { windowRegistry } = require('../window-registry');
    const manager = resolveManager(windowRegistry, event);
    const payload = manager?.getPrintPreviewPayload();
    if (!payload) {
      throw new Error('No hay documento previsualizado para imprimir.');
    }
    await ensurePermission(windowRegistry, PERMISSION_TYPES.PRINTERS, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'pba-kiosk-print-preview',
      actionLabel: t('Print preview document'),
    });
    try {
      const printResult = await printPreviewPayload(event, payload, windowRegistry);
      if (payload.job_id) {
        await postPrintJobResult(event.sender, payload.job_id, {
          device_uid: getDeviceIdentity().device_uid,
          success: true,
        });
      }
      return printResult;
    } catch (error) {
      if (payload.job_id) {
        await postPrintJobResult(event.sender, payload.job_id, {
          device_uid: getDeviceIdentity().device_uid,
          success: false,
          failure_reason: error.message || t('Unknown error'),
        });
      }
      throw error;
    }
  });

  ipcMain.handle(IPC.PBA_KIOSK_CLOSE_PREVIEW, async (event) => {
    const { windowRegistry } = require('../window-registry');
    const manager = resolveManager(windowRegistry, event);
    return manager?.closePrintPreview() || false;
  });

  ipcMain.handle(IPC.LABEL_PREVIEW_RENDER, async (_event, payload) => {
    const { renderLabelPreview } = require('../../shared/label-preview');
    return renderLabelPreview(payload || {});
  });
}

module.exports = { registerPbaKioskHandlers, getPrintPreviewMode };
