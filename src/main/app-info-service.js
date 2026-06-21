const { app } = require('electron');
const { getSystemInfo } = require('./system-info-service');
const { getAppIconUrl } = require('./app-icon');
const { getUpdaterCacheInfo } = require('./update-cache-service');

function getAboutInfo() {
  const system = getSystemInfo();
  const updaterCache = getUpdaterCacheInfo();
  return {
    appName: app.getName(),
    productName: system.runtime.appName,
    version: system.runtime.appVersion,
    iconUrl: getAppIconUrl(),
    electron: system.runtime.electron,
    chrome: system.runtime.chrome,
    node: system.runtime.node,
    platform: system.platform,
    arch: system.arch,
    osType: system.os.type,
    osRelease: system.os.release,
    osVersion: system.os.version,
    hostname: system.device.hostname,
    deviceUid: system.device.uid,
    ipAddress: system.device.ipAddress,
    macAddress: system.device.macAddress,
    totalMemoryGb: system.hardware.totalMemoryGb,
    cpuModel: system.hardware.cpuModel,
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    updaterCachePath: updaterCache.cachePath,
    updaterPendingPath: updaterCache.pendingPath,
    updaterCacheAvailable: updaterCache.available,
    isPackaged: system.runtime.isPackaged,
  };
}

module.exports = {
  getAboutInfo,
};
