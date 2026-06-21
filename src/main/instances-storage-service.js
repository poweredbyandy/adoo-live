const { getInstancesSnapshot } = require('./instances');
const { getAdooModuleCacheStats } = require('./adoo-module-service');
const { getOriginFromUrl } = require('../shared/kiosk-compatibility');

function collectConnectedOrigins(windowRegistry) {
  const origins = new Set();
  for (const manager of windowRegistry.getAll?.() || []) {
    for (const tab of manager.tabs || []) {
      const webContents = tab.view?.webContents;
      if (!webContents || webContents.isDestroyed()) {
        continue;
      }
      const origin = getOriginFromUrl(webContents.getURL());
      if (origin) {
        origins.add(origin);
      }
    }
  }
  return origins;
}

function getInstancesStorageSnapshot(windowRegistry) {
  const snapshot = getInstancesSnapshot(windowRegistry.config);
  const connectedOrigins = collectConnectedOrigins(windowRegistry);
  let totalBytes = 0;
  const items = snapshot.items.map((instance) => {
    const adooModule = getAdooModuleCacheStats(instance.origin);
    totalBytes += adooModule.bytes || 0;
    return {
      ...instance,
      connected: connectedOrigins.has(instance.origin),
      isDefault: instance.id === snapshot.defaultInstanceId,
      adooModule,
    };
  });
  return {
    items,
    defaultInstanceId: snapshot.defaultInstanceId,
    defaultBaseUrl: snapshot.defaultBaseUrl,
    totalBytes,
  };
}

module.exports = {
  getInstancesStorageSnapshot,
};
