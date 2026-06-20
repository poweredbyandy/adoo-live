const { IPC } = require('../../shared/ipc-channels');
const { validateNotifyPayload } = require('../../shared/validators');
const { showNotification } = require('../notification-service');

function registerNotificationHandlers(ipcMain) {
  ipcMain.handle(IPC.NOTIFY_SHOW, async (_event, payload) => {
    const result = validateNotifyPayload(payload);
    if (!result.valid) {
      throw new Error(result.error);
    }

    return showNotification({
      title: result.value.title,
      body: result.value.body,
      silent: result.value.silent,
      action: payload?.action,
    });
  });
}

module.exports = { registerNotificationHandlers };
