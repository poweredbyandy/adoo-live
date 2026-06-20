const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

const APP_VERSION = require('../../package.json').version;

const DEVICE_STORE_NAME = 'device-identity.json';
const INTERFACE_PRIORITY = ['en0', 'eth0', 'wlan0', 'Wi-Fi', 'Ethernet'];

function getDeviceStorePath(customUserDataPath) {
  const basePath = customUserDataPath || app.getPath('userData');
  return path.join(basePath, DEVICE_STORE_NAME);
}

function loadOrCreateDeviceUid(customUserDataPath) {
  const storePath = getDeviceStorePath(customUserDataPath);
  try {
    if (fs.existsSync(storePath)) {
      const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (data.device_uid) {
        return String(data.device_uid);
      }
    }
  } catch {
    void 0;
  }
  const deviceUid = crypto.randomUUID();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify({ device_uid: deviceUid }, null, 2)}\n`, 'utf8');
  return deviceUid;
}

function normalizeMacAddress(mac) {
  if (!mac || mac === '00:00:00:00:00:00') {
    return '';
  }
  return String(mac).toUpperCase();
}

function pickNetworkInterface(entries) {
  if (!entries) {
    return null;
  }
  for (const entry of entries) {
    if (entry.internal || entry.family !== 'IPv4') {
      continue;
    }
    return {
      mac_address: normalizeMacAddress(entry.mac),
      ip_address: entry.address || '',
    };
  }
  return null;
}

function getPrimaryNetworkInfo() {
  const interfaces = os.networkInterfaces();
  for (const name of INTERFACE_PRIORITY) {
    const match = pickNetworkInterface(interfaces[name]);
    if (match) {
      return match;
    }
  }
  for (const entries of Object.values(interfaces)) {
    const match = pickNetworkInterface(entries);
    if (match) {
      return match;
    }
  }
  return { mac_address: '', ip_address: '' };
}

function getOsVersion() {
  if (typeof os.version === 'function') {
    return os.version();
  }
  return `${os.type()} ${os.release()}`;
}

function getDeviceIdentity(customUserDataPath) {
  const network = getPrimaryNetworkInfo();
  return {
    device_uid: loadOrCreateDeviceUid(customUserDataPath),
    hostname: os.hostname(),
    mac_address: network.mac_address,
    ip_address: network.ip_address,
    app_version: APP_VERSION,
    platform: process.platform,
    os_version: getOsVersion(),
  };
}

module.exports = {
  getDeviceIdentity,
  getDeviceStorePath,
  getOsVersion,
  getPrimaryNetworkInfo,
  loadOrCreateDeviceUid,
  normalizeMacAddress,
};
