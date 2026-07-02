const { loadConfig, saveUserConfig } = require('./config');
const { normalizeDefaultDevices } = require('../shared/default-devices');

function getDefaultDevices(config = loadConfig()) {
  return normalizeDefaultDevices(config);
}

function setDefaultDevices(patch) {
  const current = getDefaultDevices();
  const next = {
    printerUid: patch?.printerUid !== undefined ? String(patch.printerUid || '').trim() : current.printerUid,
    usbDeviceKey: patch?.usbDeviceKey !== undefined ? String(patch.usbDeviceKey || '').trim() : current.usbDeviceKey,
    serialPath: patch?.serialPath !== undefined ? String(patch.serialPath || '').trim() : current.serialPath,
  };
  saveUserConfig({ defaultDevices: next });
  return next;
}

module.exports = {
  getDefaultDevices,
  setDefaultDevices,
};
