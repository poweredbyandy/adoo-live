const { IPC } = require('../../shared/ipc-channels');
const { validateLocalPrintPayload } = require('../../shared/kiosk-printing');
const { getDeviceIdentity } = require('../device-identity');
const { printLocalFromBridge } = require('../kiosk-printing-service');
const { notifyPrintersPossiblyChanged } = require('../kiosk-device-service');
const { PERMISSION_TYPES, ensurePermission, getDialogParent } = require('../permission-service');
const { t } = require('../../i18n');

function registerPbaKioskHandlers(ipcMain) {
  ipcMain.on(IPC.PBA_KIOSK_DEVICE_UID, (event) => {
    event.returnValue = getDeviceIdentity().device_uid;
  });

  ipcMain.handle(IPC.PBA_KIOSK_PRINT, async (event, payload) => {
    const { windowRegistry } = require('../window-registry');
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
  });
}

module.exports = { registerPbaKioskHandlers };
