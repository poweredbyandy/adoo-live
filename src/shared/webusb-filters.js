function normalizeUsbId(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  const text = String(value).trim().toLowerCase();
  if (text.startsWith('0x')) {
    return Number.parseInt(text, 16);
  }
  const decimal = Number(text);
  if (Number.isFinite(decimal)) {
    return decimal;
  }
  const hex = Number.parseInt(text, 16);
  return Number.isFinite(hex) ? hex : null;
}

function deviceHasClassCode(device, classCode) {
  const classes = Array.isArray(device?.interfaceClasses) ? device.interfaceClasses : [];
  const deviceClass = normalizeUsbId(device?.deviceClass);
  return classes.includes(classCode) || deviceClass === classCode;
}

function deviceMatchesFilter(device, filter) {
  if (!filter || typeof filter !== 'object') {
    return true;
  }
  const vendorId = normalizeUsbId(filter.vendorId);
  const productId = normalizeUsbId(filter.productId);
  if (vendorId !== null && normalizeUsbId(device.vendorId) !== vendorId) {
    return false;
  }
  if (productId !== null && normalizeUsbId(device.productId) !== productId) {
    return false;
  }
  if (filter.classCode !== undefined && filter.classCode !== null) {
    const classCode = Number(filter.classCode);
    if (!deviceHasClassCode(device, classCode)) {
      return false;
    }
  }
  return true;
}

function filterUsbDevices(devices, filters) {
  const list = Array.isArray(devices) ? devices : [];
  if (!Array.isArray(filters) || !filters.length) {
    return list;
  }
  return list.filter((device) => filters.some((filter) => deviceMatchesFilter(device, filter)));
}

function pickUsbDevice(devices, filters, defaults = {}) {
  const list = Array.isArray(devices) ? devices : [];
  if (!list.length) {
    return null;
  }
  if (defaults.usbDeviceKey) {
    const preferred = list.find((device) => device.deviceKey === defaults.usbDeviceKey);
    if (preferred) {
      return preferred;
    }
  }
  if (defaults.serialPath) {
    const preferred = list.find((device) => (
      device.viaSerialPath === defaults.serialPath
      || device.serialPath === defaults.serialPath
    ));
    if (preferred) {
      return preferred;
    }
  }
  const filtered = filterUsbDevices(list, filters);
  if (filtered.length) {
    return filtered[0];
  }
  if (list.length === 1) {
    return list[0];
  }
  return null;
}

module.exports = {
  deviceHasClassCode,
  deviceMatchesFilter,
  filterUsbDevices,
  normalizeUsbId,
  pickUsbDevice,
};
