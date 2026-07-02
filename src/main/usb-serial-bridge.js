const { normalizeUsbId } = require('../shared/webusb-filters');
const { isDeviceAllowed } = require('./device-permission-core');
const { loadSerialPort } = require('./serial-loader');

const SERIAL_DEVICE_PREFIX = 'serial:';
const serialSessions = new Map();

function buildSerialBackedDeviceKey(path) {
  return `${SERIAL_DEVICE_PREFIX}${path}`;
}

function isSerialBackedDeviceKey(deviceKey) {
  return String(deviceKey || '').startsWith(SERIAL_DEVICE_PREFIX);
}

function parseSerialBackedDeviceKey(deviceKey) {
  return String(deviceKey || '').slice(SERIAL_DEVICE_PREFIX.length);
}

async function listSerialBackedUsbDevices() {
  try {
    const { SerialPort } = await loadSerialPort();
    const ports = await SerialPort.list();
    return ports.flatMap((port) => {
      const path = String(port.path || '').trim();
      if (!path) {
        return [];
      }
      const vendorId = normalizeUsbId(port.vendorId);
      const productId = normalizeUsbId(port.productId);
      if (vendorId === null && productId === null) {
        return [];
      }
      const labelParts = [port.manufacturer, port.serialNumber, path].filter(Boolean);
      return [{
        vendorId: vendorId ?? 0,
        productId: productId ?? 0,
        busNumber: 0,
        deviceAddress: 0,
        deviceClass: 0,
        interfaceClasses: [],
        deviceKey: buildSerialBackedDeviceKey(path),
        viaSerialPath: path,
        label: labelParts[0] || path,
      }];
    });
  } catch {
    return [];
  }
}

function isSerialBackedEntryAllowed(config, entry) {
  const path = entry?.viaSerialPath || parseSerialBackedDeviceKey(entry?.deviceKey);
  return isDeviceAllowed(config, 'serial', path);
}

function filterAllowedUsbEntries(config, entries) {
  return entries.filter((entry) => {
    if (entry?.viaSerialPath) {
      return isSerialBackedEntryAllowed(config, entry);
    }
    return isDeviceAllowed(config, 'usb', entry.deviceKey);
  });
}

async function openSerialBackedDevice(deviceKey, options = {}) {
  const key = String(deviceKey || '').trim();
  if (!key || !isSerialBackedDeviceKey(key)) {
    throw new Error('Identificador de puerto serie inválido.');
  }
  if (serialSessions.has(key)) {
    return { deviceKey: key, alreadyOpen: true };
  }
  const path = parseSerialBackedDeviceKey(key);
  const { SerialPort } = await loadSerialPort();
  const port = new SerialPort({
    path,
    baudRate: Number(options.baudRate || 9600),
    autoOpen: true,
  });
  await new Promise((resolve, reject) => {
    port.once('open', resolve);
    port.once('error', reject);
  });
  serialSessions.set(key, { port, path });
  return { deviceKey: key, opened: true };
}

async function transferSerialBackedOut(deviceKey, data) {
  const key = String(deviceKey || '').trim();
  const session = serialSessions.get(key);
  if (!session) {
    throw new Error('El puerto serie no está abierto.');
  }
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await new Promise((resolve, reject) => {
    session.port.write(buffer, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  return {
    status: 'ok',
    bytesWritten: buffer.length,
  };
}

async function closeSerialBackedDevice(deviceKey) {
  const key = String(deviceKey || '').trim();
  const session = serialSessions.get(key);
  if (!session) {
    return { closed: false };
  }
  await new Promise((resolve) => {
    try {
      session.port.close(() => resolve());
    } catch {
      resolve();
    }
  });
  serialSessions.delete(key);
  return { closed: true };
}

function closeAllSerialBackedDevices() {
  for (const deviceKey of [...serialSessions.keys()]) {
    void closeSerialBackedDevice(deviceKey);
  }
}

module.exports = {
  buildSerialBackedDeviceKey,
  closeAllSerialBackedDevices,
  closeSerialBackedDevice,
  filterAllowedUsbEntries,
  isSerialBackedDeviceKey,
  isSerialBackedEntryAllowed,
  listSerialBackedUsbDevices,
  openSerialBackedDevice,
  parseSerialBackedDeviceKey,
  transferSerialBackedOut,
};
