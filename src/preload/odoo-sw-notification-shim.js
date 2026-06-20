/* eslint-env serviceworker */

(function installServiceWorkerNotificationBridge() {
  if (self.__odooKioskSwNotificationShimInstalled) {
    return;
  }
  self.__odooKioskSwNotificationShimInstalled = true;

  const originalShowNotification = ServiceWorkerRegistration.prototype.showNotification;
  ServiceWorkerRegistration.prototype.showNotification = async function showNotificationBridge(title, options) {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    clients.forEach((client) => {
      client.postMessage({
        type: 'odoo-kiosk-native-notification',
        payload: {
          title,
          options: options || {},
        },
      });
    });
    if (clients.length) {
      return undefined;
    }
    return originalShowNotification.call(this, title, options);
  };
})();
