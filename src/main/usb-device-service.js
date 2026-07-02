const { loadUsb } = require('./usb-loader');
const { toEnrichedUsbDeviceInfo } = require('./usb-enumeration');
const {
  closeAllSerialBackedDevices,
  closeSerialBackedDevice,
  isSerialBackedDeviceKey,
  openSerialBackedDevice,
  transferSerialBackedOut,
} = require('./usb-serial-bridge');

const sessions = new Map();

function parseDeviceKey(deviceKey) {
  const [vendorId, productId, busNumber, deviceAddress] = String(deviceKey || '')
    .split(':')
    .map((part) => Number(part));
  if (!Number.isFinite(vendorId) || !Number.isFinite(productId)) {
    throw new Error('Identificador USB inválido.');
  }
  return {
    vendorId,
    productId,
    busNumber: Number.isFinite(busNumber) ? busNumber : 0,
    deviceAddress: Number.isFinite(deviceAddress) ? deviceAddress : 0,
  };
}

async function findUsbDevice(deviceKey) {
  const parsed = parseDeviceKey(deviceKey);
  const usb = await loadUsb();
  const match = usb.getDeviceList().find((device) => (
    device.deviceDescriptor.idVendor === parsed.vendorId
    && device.deviceDescriptor.idProduct === parsed.productId
    && device.busNumber === parsed.busNumber
    && device.deviceAddress === parsed.deviceAddress
  ));
  if (!match) {
    throw new Error('Dispositivo USB no encontrado.');
  }
  return match;
}

function resolveOutEndpoint(device, iface, endpointNumber) {
  const endpoints = iface?.endpoints || [];
  if (endpointNumber !== undefined && endpointNumber !== null) {
    const match = endpoints.find((endpoint) => (
      endpoint.direction === 'out'
      && (endpoint.address === endpointNumber || endpoint.endpointNumber === endpointNumber)
    ));
    if (match) {
      return match;
    }
  }
  const fallback = endpoints.find((endpoint) => endpoint.direction === 'out');
  if (!fallback) {
    throw new Error('No se encontró un endpoint de salida en el dispositivo USB.');
  }
  return fallback;
}

function getSession(deviceKey) {
  const session = sessions.get(deviceKey);
  if (!session) {
    throw new Error('El dispositivo USB no está abierto.');
  }
  return session;
}

async function openUsbDevice(deviceKey) {
  const key = String(deviceKey || '').trim();
  if (!key) {
    throw new Error('Identificador USB obligatorio.');
  }
  if (isSerialBackedDeviceKey(key)) {
    return openSerialBackedDevice(key);
  }
  if (sessions.has(key)) {
    return { deviceKey: key, alreadyOpen: true };
  }
  const device = await findUsbDevice(key);
  device.open();
  const configuration = device.configDescriptor || device.deviceDescriptor;
  const interfaceCount = configuration?.bNumInterfaces || 1;
  let iface = null;
  for (let index = 0; index < interfaceCount; index += 1) {
    try {
      const candidate = device.interface(index);
      if (candidate?.endpoints?.some((endpoint) => endpoint.direction === 'out')) {
        iface = candidate;
        break;
      }
    } catch {
      void 0;
    }
  }
  if (!iface) {
    try {
      iface = device.interface(0);
    } catch (error) {
      try {
        device.close();
      } catch {
        void 0;
      }
      throw error;
    }
  }
  try {
    if (typeof iface.isKernelDriverActive === 'function' && iface.isKernelDriverActive()) {
      iface.detachKernelDriver();
    }
  } catch {
    void 0;
  }
  iface.claim();
  sessions.set(key, {
    device,
    iface,
    outEndpoint: resolveOutEndpoint(device, iface),
  });
  return { deviceKey: key, opened: true };
}

async function transferUsbOut(deviceKey, endpointNumber, data) {
  const key = String(deviceKey || '').trim();
  if (isSerialBackedDeviceKey(key)) {
    return transferSerialBackedOut(key, data);
  }
  const session = getSession(key);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const endpoint = endpointNumber === undefined || endpointNumber === null
    ? session.outEndpoint
    : resolveOutEndpoint(session.device, session.iface, endpointNumber);
  await new Promise((resolve, reject) => {
    endpoint.transfer(buffer, (error) => {
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

async function closeUsbDevice(deviceKey) {
  const key = String(deviceKey || '').trim();
  if (isSerialBackedDeviceKey(key)) {
    return closeSerialBackedDevice(key);
  }
  const session = sessions.get(key);
  if (!session) {
    return { closed: false };
  }
  try {
    try {
      session.iface.release(true, () => {});
    } catch {
      void 0;
    }
    session.device.close();
  } catch {
    void 0;
  }
  sessions.delete(key);
  return { closed: true };
}

function closeAllUsbDevices() {
  for (const deviceKey of [...sessions.keys()]) {
    void closeUsbDevice(deviceKey);
  }
  closeAllSerialBackedDevices();
}

function toUsbDeviceInfo(device) {
  return toEnrichedUsbDeviceInfo(device);
}

module.exports = {
  closeAllUsbDevices,
  closeUsbDevice,
  openUsbDevice,
  toUsbDeviceInfo,
  transferUsbOut,
};
