const { IPC } = require('../../shared/ipc-channels');
const { validatePrintPayload, validatePrintRawPayload } = require('../../shared/validators');
const { PERMISSION_TYPES, ensurePermission, getDialogParent } = require('../permission-service');
const { filterAllowedPrinters } = require('../device-permission-core');
const { getDefaultDevices, setDefaultDevices } = require('../default-device-service');
const { loadConfig } = require('../config');
const { t } = require('../../i18n');
const { listSystemPrinters, mapPrinter } = require('../device-printers');

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
  if (!filterAllowedPrinters(loadConfig(), [match]).length) {
    throw new Error(t('This printer is disabled in Settings → Permissions.'));
  }
}

async function resolvePrintDeviceName(windowRegistry, explicitName) {
  if (explicitName) {
    return explicitName;
  }
  const defaults = getDefaultDevices(windowRegistry.config || loadConfig());
  if (!defaults.printerUid) {
    return undefined;
  }
  const printers = filterAllowedPrinters(loadConfig(), await listSystemPrinters(windowRegistry));
  const match = printers.find((printer) => mapPrinter(printer).printer_uid === defaults.printerUid);
  return match ? mapPrinter(match).name : undefined;
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
    return filterAllowedPrinters(loadConfig(), printers);
  });

  ipcMain.handle(IPC.PRINTER_GET_DEFAULTS, async () => {
    windowRegistry.reloadConfig();
    return getDefaultDevices(windowRegistry.config);
  });

  ipcMain.handle(IPC.PRINTER_SET_DEFAULTS, async (_event, payload) => {
    windowRegistry.reloadConfig();
    const next = setDefaultDevices(payload || {});
    windowRegistry.reloadConfig();
    windowRegistry.broadcastState();
    return next;
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

    const deviceName = await resolvePrintDeviceName(windowRegistry, result.value.deviceName);
    await assertPrinterAllowed(windowRegistry, getActiveWebContents, deviceName);
    const options = buildPrintOptions({ ...result.value, deviceName });
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

    const deviceName = await resolvePrintDeviceName(windowRegistry, result.value.deviceName);
    await assertPrinterAllowed(windowRegistry, getActiveWebContents, deviceName);
    const rawBuffer = normalizeRawData(result.value.data);
    logVerbose('printer:printRaw', deviceName || 'default', rawBuffer.length);

    return new Promise((resolve, reject) => {
      webContents.print(
        {
          silent: true,
          deviceName,
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
