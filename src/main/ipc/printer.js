const { IPC } = require('../../shared/ipc-channels');
const { validatePrintPayload, validatePrintRawPayload } = require('../../shared/validators');
const { PERMISSION_TYPES, ensurePermission, getDialogParent } = require('../permission-service');
const {
  isDeviceAllowed,
  buildPrinterDeviceKey,
} = require('../device-permission-service');
const { t } = require('../../i18n');
const { listSystemPrinters } = require('../device-printers');

function buildPrintOptions(payload) {
  return {
    silent: payload.silent,
    printBackground: payload.printBackground,
    deviceName: payload.deviceName,
    copies: payload.copies,
  };
}

function normalizeRawData(data) {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.from(data);
  }
  return Buffer.from(String(data));
}

async function assertPrinterAllowed(windowRegistry, getActiveWebContents, deviceName) {
  if (!deviceName) {
    return;
  }
  const webContents = getActiveWebContents();
  if (!webContents) {
    return;
  }
  const printers = await webContents.getPrintersAsync();
  const match = printers.find((printer) => printer.name === deviceName);
  if (!match) {
    return;
  }
  const key = buildPrinterDeviceKey(match);
  if (!isDeviceAllowed(windowRegistry.config, 'printers', key)) {
    throw new Error(t('This printer is disabled in Settings → Permissions.'));
  }
}

function registerPrinterHandlers(ipcMain, windowRegistry, getActiveWebContents, logVerbose) {
  const ensurePrinters = async (actionLabel) => {
    await ensurePermission(windowRegistry, PERMISSION_TYPES.PRINTERS, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'printer-ipc',
      actionLabel,
    });
  };

  ipcMain.handle(IPC.PRINTER_LIST, async () => {
    await ensurePrinters(t('List printers'));
    const printers = await listSystemPrinters(windowRegistry);
    logVerbose('printer:list', printers.length);
    return printers.filter((printer) => isDeviceAllowed(
      windowRegistry.config,
      'printers',
      buildPrinterDeviceKey(printer),
    ));
  });

  ipcMain.handle(IPC.PRINTER_PRINT, async (_event, payload) => {
    await ensurePrinters(t('Print document'));
    const result = validatePrintPayload(payload);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const webContents = getActiveWebContents();
    if (!webContents) {
      throw new Error('No active page to print');
    }

    await assertPrinterAllowed(windowRegistry, getActiveWebContents, result.value.deviceName);
    const options = buildPrintOptions(result.value);
    logVerbose('printer:print', options.deviceName || 'default');

    return new Promise((resolve, reject) => {
      webContents.print(options, (success, failureReason) => {
        if (!success) {
          reject(new Error(failureReason || 'Print failed'));
          return;
        }
        resolve({ success: true });
      });
    });
  });

  ipcMain.handle(IPC.PRINTER_PRINT_RAW, async (_event, payload) => {
    await ensurePrinters(t('Print raw data'));
    const result = validatePrintRawPayload(payload);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const webContents = getActiveWebContents();
    if (!webContents) {
      throw new Error('No active page to print');
    }

    await assertPrinterAllowed(windowRegistry, getActiveWebContents, result.value.deviceName);
    const rawBuffer = normalizeRawData(result.value.data);
    logVerbose('printer:printRaw', result.value.deviceName || 'default', rawBuffer.length);

    return new Promise((resolve, reject) => {
      webContents.print(
        {
          silent: true,
          deviceName: result.value.deviceName,
          printBackground: false,
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || 'Raw print failed'));
            return;
          }
          resolve({ success: true, bytes: rawBuffer.length });
        },
      );
    });
  });
}

module.exports = {
  registerPrinterHandlers,
  buildPrintOptions,
  normalizeRawData,
};
