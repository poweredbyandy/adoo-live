const { buildPrinterUid } = require('./device-printers');
const { PERMISSION_TYPES, isPermissionGranted } = require('./permission-service');
const { normalizeDeviceDenylist } = require('../shared/permission-device-denylist');

const DEVICE_CATEGORIES = ['printers', 'serial', 'usb'];

function buildPrinterDeviceKey(printer) {
  if (typeof printer === 'string') {
    return printer;
  }
  if (printer?.printer_uid) {
    return String(printer.printer_uid);
  }
  return buildPrinterUid(printer || {});
}

function buildSerialDeviceKey(port) {
  if (typeof port === 'string') {
    return port;
  }
  return String(port?.path || '').trim();
}

function buildUsbDeviceKey(device) {
  if (typeof device === 'string') {
    return device;
  }
  const vendorId = Number(device?.vendorId ?? 0);
  const productId = Number(device?.productId ?? 0);
  const busNumber = Number(device?.busNumber ?? 0);
  const deviceAddress = Number(device?.deviceAddress ?? 0);
  return `${vendorId}:${productId}:${busNumber}:${deviceAddress}`;
}

function getPermissionTypeForCategory(category) {
  if (category === 'printers') {
    return PERMISSION_TYPES.PRINTERS;
  }
  if (category === 'serial' || category === 'usb') {
    return PERMISSION_TYPES.DEVICES;
  }
  return null;
}

function isDeviceDenied(config, category, deviceKey) {
  const key = String(deviceKey || '').trim();
  if (!key || !DEVICE_CATEGORIES.includes(category)) {
    return false;
  }
  const denylist = normalizeDeviceDenylist(config);
  return denylist[category].includes(key);
}

function isDeviceAllowed(config, category, deviceKey) {
  const permissionType = getPermissionTypeForCategory(category);
  if (!permissionType || !isPermissionGranted(config, permissionType)) {
    return false;
  }
  return !isDeviceDenied(config, category, deviceKey);
}

function resolveDeviceKey(category, device) {
  if (device?.id) {
    return String(device.id);
  }
  if (device?.printer_uid) {
    return String(device.printer_uid);
  }
  if (device?.path) {
    return String(device.path);
  }
  if (category === 'printers') {
    return buildPrinterDeviceKey(device);
  }
  if (category === 'serial') {
    return buildSerialDeviceKey(device);
  }
  return buildUsbDeviceKey(device);
}

function filterAllowedDevices(config, category, devices) {
  return devices.filter((device) => isDeviceAllowed(
    config,
    category,
    resolveDeviceKey(category, device),
  ));
}

function filterAllowedPrinters(config, printers) {
  return filterAllowedDevices(config, 'printers', printers);
}

module.exports = {
  DEVICE_CATEGORIES,
  buildPrinterDeviceKey,
  buildSerialDeviceKey,
  buildUsbDeviceKey,
  normalizeDeviceDenylist,
  isDeviceAllowed,
  isDeviceDenied,
  filterAllowedDevices,
  filterAllowedPrinters,
  resolveDeviceKey,
  getPermissionTypeForCategory,
};
