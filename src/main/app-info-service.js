const os = require('os');
const { app } = require('electron');
const { APP_DISPLAY_NAME } = require('../shared/constants');
const { getDeviceIdentity, getOsVersion } = require('./device-identity');
const { getAppIconUrl } = require('./app-icon');

function getAboutInfo() {
  const identity = getDeviceIdentity();
  return {
    appName: app.getName(),
    productName: APP_DISPLAY_NAME,
    version: app.getVersion(),
    iconUrl: getAppIconUrl(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    osType: os.type(),
    osRelease: os.release(),
    osVersion: getOsVersion(),
    hostname: identity.hostname,
    deviceUid: identity.device_uid,
    ipAddress: identity.ip_address,
    macAddress: identity.mac_address,
    totalMemoryGb: Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10,
    cpuModel: os.cpus()[0]?.model || '',
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    isPackaged: app.isPackaged,
  };
}

module.exports = {
  getAboutInfo,
};
