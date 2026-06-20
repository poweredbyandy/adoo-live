const { IPC } = require('../../shared/ipc-channels');
const { webPushServer } = require('../web-push-server');
const { appLogger } = require('../logger');

function registerPushHandlers(ipcMain) {
  ipcMain.handle(IPC.PUSH_SUBSCRIBE, async () => {
    const subscription = await webPushServer.createSubscription();
    appLogger.add('info', 'webpush', 'Suscripción push creada', subscription.endpoint);
    return subscription;
  });

  ipcMain.handle(IPC.PUSH_GET_SUBSCRIPTION, async () => webPushServer.getActiveSubscription());

  ipcMain.handle(IPC.PUSH_UNSUBSCRIBE, async () => {
    webPushServer.clearSubscriptions();
    appLogger.add('info', 'webpush', 'Suscripción push eliminada');
    return true;
  });
}

module.exports = { registerPushHandlers };
