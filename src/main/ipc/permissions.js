const { IPC } = require('../../shared/ipc-channels');
const { PERMISSION_TYPE_LIST, PERMISSION_TYPES } = require('../../shared/permission-types');
const {
  getPermissionsSnapshot,
  setUserPermission,
} = require('../permission-service');
const {
  listPermissionDevices,
  setDeviceAllowed,
} = require('../device-permission-service');
const { closeAllSerialPorts, closeSerialPort } = require('./serial');
const { stopAllRemotePrinting } = require('../kiosk-printing-service');
const { closeAllUsbDevices } = require('../usb-device-service');
const { syncKioskDeviceRegistry } = require('../kiosk-device-service');

function registerPermissionHandlers(ipcMain, windowRegistry) {
  ipcMain.handle(IPC.PERMISSION_GET, async () => {
    return getPermissionsSnapshot(windowRegistry.config);
  });

  ipcMain.handle(IPC.PERMISSION_DEVICES_LIST, async () => {
    return listPermissionDevices(windowRegistry);
  });

  ipcMain.handle(IPC.PERMISSION_DEVICE_SET, async (_event, payload) => {
    const category = String(payload?.category || '').trim();
    const deviceKey = String(payload?.deviceKey || payload?.id || '').trim();
    const enabled = Boolean(payload?.enabled);
    const result = setDeviceAllowed(windowRegistry, category, deviceKey, enabled);
    if (category === 'serial' && !enabled) {
      closeSerialPort(deviceKey);
    }
    if (category === 'printers') {
      await syncKioskDeviceRegistry('printer_permissions_changed');
    }
    return {
      ...result,
      devices: await listPermissionDevices(windowRegistry),
    };
  });

  ipcMain.handle(IPC.PERMISSION_SET, async (_event, payload) => {
    const type = String(payload?.type || '').trim();
    const enabled = Boolean(payload?.enabled);
    if (!PERMISSION_TYPE_LIST.includes(type)) {
      throw new Error('Unknown permission type.');
    }
    const result = setUserPermission(windowRegistry, type, enabled, 'settings');
    if (result.revoked && result.type === PERMISSION_TYPES.DEVICES) {
      closeAllSerialPorts();
      closeAllUsbDevices();
    }
    if (result.revoked && result.type === PERMISSION_TYPES.WEBSOCKET) {
      stopAllRemotePrinting();
    }
    if (type === PERMISSION_TYPES.PRINTERS) {
      await syncKioskDeviceRegistry('printer_permissions_changed');
    }
    return result.snapshot;
  });
}

module.exports = { registerPermissionHandlers };
