const { saveUserConfig } = require('./config');
const {
  inferConnectionType,
  listSystemPrinters,
  mapPrinter,
  mapPrinterStatus,
} = require('./device-printers');
const { loadSerialPort } = require('./serial-loader');
const { loadUsb } = require('./usb-loader');
const { listSerialBackedUsbDevices, isSerialBackedDeviceKey, parseSerialBackedDeviceKey } = require('./usb-serial-bridge');
const { PERMISSION_TYPES, isPermissionGranted } = require('./permission-service');
const { normalizeDeviceDenylist } = require('../shared/permission-device-denylist');
const { t } = require('../i18n');
const {
  DEVICE_CATEGORIES,
  buildPrinterDeviceKey,
  buildSerialDeviceKey,
  buildUsbDeviceKey,
  isDeviceAllowed,
  isDeviceDenied,
  filterAllowedDevices,
  filterAllowedPrinters,
  resolveDeviceKey,
  getPermissionTypeForCategory,
} = require('./device-permission-core');

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
  if (Boolean(allowed)) {
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
    const native = usb.getDeviceList().map((device) => {
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
    const serialBacked = (await listSerialBackedUsbDevices()).map((entry) => ({
      id: entry.deviceKey,
      label: entry.label || entry.viaSerialPath,
      fields: compactFields({
        path: entry.viaSerialPath,
        vendorId: formatUsbId(entry.vendorId),
        productId: formatUsbId(entry.productId),
        via: 'serial',
      }),
    }));
    return [...native, ...serialBacked];
  } catch {
    return [];
  }
}

async function listPrinterDevices(windowRegistry) {
  try {
    const printers = await listSystemPrinters(windowRegistry);
    return printers.flatMap((printer) => {
      try {
        const mapped = mapPrinter(printer);
        const connectionType = inferConnectionType(printer);
        const status = mapPrinterStatus(printer.status);
        const name = mapped.name || '';
        const displayName = printer.displayName || '';
        const driver = printer.description || '';
        const location = printer.options?.location || printer.options?.['printer-location'] || '';
        if (!name) {
          return [];
        }
        return [{
          id: mapped.printer_uid,
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
        }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function resolveAllowedFlag(config, category, device) {
  const id = String(device.id || '').trim();
  if (category === 'usb' && isSerialBackedDeviceKey(id)) {
    return isDeviceAllowed(config, 'serial', parseSerialBackedDeviceKey(id));
  }
  return isDeviceAllowed(config, category, id);
}

function attachAllowedFlag(config, category, devices) {
  return devices.map((device) => ({
    ...device,
    allowed: resolveAllowedFlag(config, category, device),
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
  filterAllowedPrinters,
  resolveDeviceKey,
  getPermissionTypeForCategory,
};
