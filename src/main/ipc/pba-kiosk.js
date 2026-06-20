const { IPC } = require('../../shared/ipc-channels');
const { validateLocalPrintPayload } = require('../../shared/kiosk-printing');
const { getDeviceIdentity } = require('../device-identity');
const { printLocalFromBridge } = require('../kiosk-printing-service');
const { notifyPrintersPossiblyChanged } = require('../kiosk-device-service');

function registerPbaKioskHandlers(ipcMain) {
  ipcMain.on(IPC.PBA_KIOSK_DEVICE_UID, (event) => {
    event.returnValue = getDeviceIdentity().device_uid;
  });

  ipcMain.handle(IPC.PBA_KIOSK_PRINT, async (event, payload) => {
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
