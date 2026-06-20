const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');
const { IPC } = require('../../shared/ipc-channels');
const { historyStore } = require('../history-store');
const { saveUserConfig } = require('../config');
const { getDownloadFolderInfo } = require('../download-service');
const { PERMISSION_TYPES, ensurePermission, getDialogParent } = require('../permission-service');
const { t } = require('../../i18n');

function registerDownloadHandlers(ipcMain, windowRegistry, resolveWindowManager, primaryManager) {
  const ensureFiles = async (actionLabel) => {
    await ensurePermission(windowRegistry, PERMISSION_TYPES.FILES, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'download-ipc',
      actionLabel,
    });
  };

  ipcMain.handle(IPC.DOWNLOAD_OPEN_FILE, async (event, id) => {
    await ensureFiles(t('Open downloaded file'));
    const entry = historyStore.downloads.find((item) => item.id === id);
    if (!entry?.path || !fs.existsSync(entry.path)) {
      throw new Error(t('File not found.'));
    }
    const result = await shell.openPath(entry.path);
    if (result) {
      throw new Error(result);
    }
    return true;
  });

  ipcMain.handle(IPC.DOWNLOAD_OPEN_FOLDER, async (event, id) => {
    await ensureFiles(t('Open downloads folder'));
    const entry = historyStore.downloads.find((item) => item.id === id);
    if (entry?.path && fs.existsSync(entry.path)) {
      shell.showItemInFolder(entry.path);
      return true;
    }
    const folder = getDownloadFolderInfo(windowRegistry.config).path;
    if (!folder || !fs.existsSync(folder)) {
      throw new Error(t('Folder not found.'));
    }
    const result = await shell.openPath(folder);
    if (result) {
      throw new Error(result);
    }
    return true;
  });

  ipcMain.handle(IPC.DOWNLOAD_REMOVE, async (event, payload) => {
    const id = payload?.id;
    const deleteFile = Boolean(payload?.deleteFile);
    if (deleteFile) {
      await ensureFiles(t('Delete downloaded file'));
    }
    const removed = historyStore.removeDownload(id, deleteFile);
    if (!removed) {
      throw new Error(t('Download not found.'));
    }
    windowRegistry.broadcastState();
    return true;
  });

  ipcMain.handle(IPC.DOWNLOAD_GET_FOLDER, async () => {
    return getDownloadFolderInfo(windowRegistry.config);
  });

  ipcMain.handle(IPC.DOWNLOAD_SET_FOLDER, async (_event, folderPath) => {
    await ensureFiles(t('Set downloads folder'));
    const nextPath = folderPath ? String(folderPath).trim() : null;
    if (nextPath && !fs.existsSync(nextPath)) {
      throw new Error(t('Folder not found.'));
    }
    saveUserConfig({ downloadPath: nextPath || null });
    windowRegistry.reloadConfig();
    return getDownloadFolderInfo(windowRegistry.config);
  });

  ipcMain.handle(IPC.DOWNLOAD_PICK_FOLDER, async (event) => {
    await ensureFiles(t('Choose downloads folder'));
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    const browserWindow = windowManager?.window;
    const result = await dialog.showOpenDialog(browserWindow || undefined, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths?.length) {
      return null;
    }
    const picked = result.filePaths[0];
    saveUserConfig({ downloadPath: picked });
    windowRegistry.reloadConfig();
    return getDownloadFolderInfo(windowRegistry.config);
  });
}

module.exports = { registerDownloadHandlers };
