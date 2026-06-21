const { saveUserConfig } = require('./config');
const { buildPrinterUid } = require('./device-printers');
const { loadSerialPort } = require('./ipc/serial');
const { loadUsb } = require('./ipc/usb');
const { PERMISSION_TYPES, isPermissionGranted } = require('./permission-service');
const { normalizeDeviceDenylist } = require('../shared/permission-device-denylist');
const { t } = require('../i18n');

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

function setDeviceAllowed(windowRegistry, category, deviceKey, allowed) {
  if (!DEVICE_CATEGORIES.includes(category)) {
    throw new Error(t('Unknown device category.'));
  }
  const key = String(deviceKey || '').trim();
  if (!key) {
    throw new Error(t('Invalid device identifier.'));
  }
  const denylist = normalizeDeviceDenylist(windowRegistry.config);
  const entries = new Set(denylist[category]);
  if (enabledDevice(allowed)) {
    entries.delete(key);
  } else {
    entries.add(key);
  }
  denylist[category] = [...entries];
  saveUserConfig({ permissionDeviceDenylist: denylist });
  windowRegistry.reloadConfig();
  windowRegistry.broadcastState();
  return {
    category,
    deviceKey: key,
    allowed: isDeviceAllowed(windowRegistry.config, category, key),
    denylist,
  };
}

function enabledDevice(value) {
  return Boolean(value);
}

function getActiveWebContents(windowRegistry) {
  const manager = windowRegistry?.getFocused?.() || windowRegistry?.getAll?.()?.[0];
  if (!manager) {
    return null;
  }
  const activeTab = manager.tabs?.find((tab) => tab.id === manager.activeTabId);
  const webContents = activeTab?.view?.webContents;
  if (webContents && !webContents.isDestroyed()) {
    return webContents;
  }
  for (const tab of manager.tabs || []) {
    if (tab.view?.webContents && !tab.view.webContents.isDestroyed()) {
      return tab.view.webContents;
    }
  }
  return null;
}

async function listSerialDevices() {
  try {
    const { SerialPort } = await loadSerialPort();
    const ports = await SerialPort.list();
    return ports.map((port) => ({
      id: buildSerialDeviceKey(port),
      label: port.path,
      detail: [port.manufacturer, port.serialNumber].filter(Boolean).join(' · '),
    }));
  } catch {
    return [];
  }
}

async function listUsbDevices() {
  try {
    const usb = await loadUsb();
    return usb.getDeviceList().map((device) => ({
      id: buildUsbDeviceKey({
        vendorId: device.deviceDescriptor.idVendor,
        productId: device.deviceDescriptor.idProduct,
        busNumber: device.busNumber,
        deviceAddress: device.deviceAddress,
      }),
      label: `USB ${device.deviceDescriptor.idVendor.toString(16)}:${device.deviceDescriptor.idProduct.toString(16)}`,
      detail: t('Bus %(bus)s · address %(address)s', {
        bus: device.busNumber,
        address: device.deviceAddress,
      }),
    }));
  } catch {
    return [];
  }
}

async function listPrinterDevices(windowRegistry) {
  const webContents = getActiveWebContents(windowRegistry);
  if (!webContents) {
    return [];
  }
  try {
    const printers = await webContents.getPrintersAsync();
    return printers.map((printer) => ({
      id: buildPrinterDeviceKey(printer),
      label: printer.displayName || printer.name,
      detail: printer.description || '',
      isDefault: Boolean(printer.isDefault),
    }));
  } catch {
    return [];
  }
}

function attachAllowedFlag(config, category, devices) {
  return devices.map((device) => ({
    ...device,
    allowed: isDeviceAllowed(config, category, device.id),
    permissionEnabled: Boolean(isPermissionGranted(config, getPermissionTypeForCategory(category))),
  }));
}

async function listPermissionDevices(windowRegistry) {
  const config = windowRegistry.config;
  const [printers, serial, usb] = await Promise.all([
    listPrinterDevices(windowRegistry),
    listSerialDevices(),
    listUsbDevices(),
  ]);
  return {
    printers: attachAllowedFlag(config, 'printers', printers),
    serial: attachAllowedFlag(config, 'serial', serial),
    usb: attachAllowedFlag(config, 'usb', usb),
    denylist: normalizeDeviceDenylist(config),
  };
}

function filterAllowedDevices(config, category, devices) {
  return devices.filter((device) => {
    const id = device.id || device.printer_uid || device.path || buildUsbDeviceKey(device);
    return isDeviceAllowed(config, category, id);
  });
}

module.exports = {
  DEVICE_CATEGORIES,
  buildPrinterDeviceKey,
  buildSerialDeviceKey,
  buildUsbDeviceKey,
  normalizeDeviceDenylist,
  isDeviceAllowed,
  isDeviceDenied,
  setDeviceAllowed,
  listPermissionDevices,
  filterAllowedDevices,
  getPermissionTypeForCategory,
};
