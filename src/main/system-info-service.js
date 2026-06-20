const os = require('os');
const { app } = require('electron');
const { APP_DISPLAY_NAME } = require('../shared/constants');
const { buildPlatformFlags, buildPlatformId, normalizePlatform } = require('../shared/system-platform');
const { getDeviceIdentity, getOsVersion } = require('./device-identity');

function getSystemLocale() {
  if (typeof app.getLocale === 'function') {
    return app.getLocale();
  }
  if (typeof Intl?.DateTimeFormat === 'function') {
    return Intl.DateTimeFormat().resolvedOptions().locale || '';
  }
  return '';
}

function getSystemInfo() {
  const identity = getDeviceIdentity();
  const platform = process.platform;
  const arch = process.arch;
  const flags = buildPlatformFlags(platform, arch);
  const cpus = os.cpus();
  const totalMemoryBytes = os.totalmem();

  return {
    platform,
    arch,
    platformId: buildPlatformId(platform, arch),
    platformName: normalizePlatform(platform),
    os: {
      type: os.type(),
      release: os.release(),
      version: getOsVersion(),
    },
    flags,
    device: {
      uid: identity.device_uid,
      hostname: identity.hostname,
      ipAddress: identity.ip_address,
      macAddress: identity.mac_address,
    },
    runtime: {
      appName: APP_DISPLAY_NAME,
      appVersion: identity.app_version,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      isPackaged: app.isPackaged,
    },
    hardware: {
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || '',
      totalMemoryBytes,
      totalMemoryGb: Math.round((totalMemoryBytes / (1024 ** 3)) * 10) / 10,
    },
    locale: getSystemLocale(),
  };
}

module.exports = {
  getSystemInfo,
};
