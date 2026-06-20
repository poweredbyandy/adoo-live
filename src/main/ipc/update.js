const { IPC } = require('../../shared/ipc-channels');
const { getAboutInfo } = require('../app-info-service');
const {
  checkForUpdates,
  downloadUpdate,
  quitAndInstallUpdate,
} = require('../update-service');
const { shell } = require('electron');

function registerUpdateHandlers(ipcMain) {
  ipcMain.handle(IPC.APP_GET_ABOUT, async () => getAboutInfo());

  ipcMain.handle(IPC.UPDATE_CHECK, async () => checkForUpdates());

  ipcMain.handle(IPC.UPDATE_DOWNLOAD, async () => {
    const result = await downloadUpdate();
    if (result.mode === 'manual' && result.releaseUrl) {
      await shell.openExternal(result.releaseUrl);
    }
    return result;
  });

  ipcMain.handle(IPC.UPDATE_INSTALL, async () => {
    quitAndInstallUpdate();
    return { ok: true };
  });
}

module.exports = { registerUpdateHandlers };
