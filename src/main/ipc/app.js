const { dialog } = require('electron');
const { IPC } = require('../../shared/ipc-channels');
const { performFactoryReset } = require('../factory-reset-service');
const { getDialogParent } = require('../permission-service');
const { t } = require('../../i18n');

function registerAppHandlers(ipcMain, windowRegistry, resolveWindowManager, primaryManager) {
  ipcMain.handle(IPC.APP_CONFIRM, async (event, payload = {}) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    const browserWindow = windowManager?.window || getDialogParent(windowRegistry);
    const confirmLabel = payload.confirmLabel || t('OK');
    const cancelLabel = payload.cancelLabel || t('Cancel');
    const result = await dialog.showMessageBox(browserWindow || undefined, {
      type: payload.type || 'question',
      buttons: [confirmLabel, cancelLabel],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: payload.title || '',
      message: payload.message || '',
      detail: payload.detail || '',
    });
    return { confirmed: result.response === 0 };
  });

  ipcMain.handle(IPC.APP_FACTORY_RESET, async (event) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    const browserWindow = windowManager?.window || getDialogParent(windowRegistry);

    const result = await dialog.showMessageBox(browserWindow || undefined, {
      type: 'warning',
      buttons: [t('Erase all data'), t('Cancel')],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: t('Erase all data'),
      message: t('Reset this app to factory defaults?'),
      detail: t(
        'This will delete configuration, history, downloads metadata, logs, device identity, and all other local app data. The app will restart. This cannot be undone.',
      ),
    });

    if (result.response !== 0) {
      return { cancelled: true };
    }

    await performFactoryReset();
    return { reset: true };
  });
}

module.exports = { registerAppHandlers };
