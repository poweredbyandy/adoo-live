const { saveUserConfig } = require('./config');
const {
  buildPrinterUid,
  inferConnectionType,
  listSystemPrinters,
  mapPrinterStatus,
} = require('./device-printers');
const { loadSerialPort } = require('./ipc/serial');
const { loadUsb } = require('./ipc/usb');
const { PERMISSION_TYPES, isPermissionGranted } = require('./permission-service');
const { normalizeDeviceDenylist } = require('../shared/permission-device-denylist');
const { t } = require('../i18n');

const DEVICE_CATEGORIES = ['printers', 'serial', 'usb'];

function compactFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ''),
  );
}

function formatUsbId(value) {
  return `0x${Number(value).toString(16).padStart(4, '0').toUpperCase()}`;
}

function readUsbDeviceStrings(device) {
  let manufacturer = '';
  let product = '';
  try {
    device.open();
    const descriptor = device.deviceDescriptor;
    if (descriptor.iManufacturer) {
      manufacturer = device.getStringDescriptor(descriptor.iManufacturer) || '';
    }
    if (descriptor.iProduct) {
      product = device.getStringDescriptor(descriptor.iProduct) || '';
    }
  } catch {
    void 0;
  } finally {
    try {
      device.close();
    } catch {
      void 0;
    }
  }
  return { manufacturer, product };
}

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

async function listSerialDevices() {
  try {
    const { SerialPort } = await loadSerialPort();
    const ports = await SerialPort.list();
    return ports.map((port) => ({
      id: buildSerialDeviceKey(port),
      label: port.path,
      fields: compactFields({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        vendorId: port.vendorId,
        productId: port.productId,
        pnpId: port.pnpId,
        locationId: port.locationId,
      }),
    }));
  } catch {
    return [];
  }
}

async function listUsbDevices() {
  try {
    const usb = await loadUsb();
    return usb.getDeviceList().map((device) => {
      const vendorId = device.deviceDescriptor.idVendor;
      const productId = device.deviceDescriptor.idProduct;
      const { manufacturer, product } = readUsbDeviceStrings(device);
      const label = product
        || manufacturer
        || `USB ${formatUsbId(vendorId)}:${formatUsbId(productId)}`;
      return {
        id: buildUsbDeviceKey({
          vendorId,
          productId,
          busNumber: device.busNumber,
          deviceAddress: device.deviceAddress,
        }),
        label,
        fields: compactFields({
          manufacturer,
          product,
          vendorId: formatUsbId(vendorId),
          productId: formatUsbId(productId),
          bus: String(device.busNumber),
          address: String(device.deviceAddress),
        }),
      };
    });
  } catch {
    return [];
  }
}

async function listPrinterDevices(windowRegistry) {
  try {
    const printers = await listSystemPrinters(windowRegistry);
    return printers.map((printer) => {
      const connectionType = inferConnectionType(printer);
      const status = mapPrinterStatus(printer.status);
      const name = printer.name || '';
      const displayName = printer.displayName || '';
      const driver = printer.description || '';
      const location = printer.options?.location || printer.options?.['printer-location'] || '';
      return {
        id: buildPrinterDeviceKey(printer),
        label: displayName || name || t('Printer'),
        isDefault: Boolean(printer.isDefault),
        fields: compactFields({
          name,
          displayName: displayName && displayName !== name ? displayName : '',
          driver,
          status,
          connection: connectionType,
          location,
        }),
      };
    });
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
