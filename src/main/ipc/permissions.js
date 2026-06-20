const { IPC } = require('../../shared/ipc-channels');
const { PERMISSION_TYPE_LIST } = require('../../shared/permission-types');
const {
  getPermissionsSnapshot,
  setUserPermission,
} = require('../permission-service');
const { closeAllSerialPorts } = require('./serial');

function registerPermissionHandlers(ipcMain, windowRegistry) {
  ipcMain.handle(IPC.PERMISSION_GET, async () => {
    return getPermissionsSnapshot(windowRegistry.config);
  });

  ipcMain.handle(IPC.PERMISSION_SET, async (_event, payload) => {
    const type = String(payload?.type || '').trim();
    const enabled = Boolean(payload?.enabled);
    if (!PERMISSION_TYPE_LIST.includes(type)) {
      throw new Error('Unknown permission type.');
    }
    const result = setUserPermission(windowRegistry, type, enabled, 'settings');
    if (result.revoked && result.type === 'devices') {
      closeAllSerialPorts();
    }
    return result.snapshot;
  });
}

module.exports = { registerPermissionHandlers };
