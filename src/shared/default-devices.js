const DEFAULT_DEVICE_DEFAULTS = {
  printerUid: '',
  usbDeviceKey: '',
  serialPath: '',
};

function normalizeDefaultDevices(config) {
  const stored = config?.defaultDevices || {};
  return {
    printerUid: String(stored.printerUid || '').trim(),
    usbDeviceKey: String(stored.usbDeviceKey || '').trim(),
    serialPath: String(stored.serialPath || '').trim(),
  };
}

module.exports = {
  DEFAULT_DEVICE_DEFAULTS,
  normalizeDefaultDevices,
};
