const { IPC } = require('../../shared/ipc-channels');
const {
  validateSerialOpenPayload,
  validateSerialWritePayload,
  validateSerialClosePayload,
} = require('../../shared/validators');
const { PERMISSION_TYPES, ensurePermission, getDialogParent } = require('../permission-service');
const {
  isDeviceAllowed,
  buildSerialDeviceKey,
  filterAllowedDevices,
} = require('../device-permission-service');
const { t } = require('../../i18n');

let serialportModule = null;
const openPorts = new Map();

async function loadSerialPort() {
  if (!serialportModule) {
    serialportModule = require('serialport');
  }
  return serialportModule;
}

function registerSerialHandlers(ipcMain, windowRegistry, logVerbose) {
  const ensureDevices = async (actionLabel) => {
    await ensurePermission(windowRegistry, PERMISSION_TYPES.DEVICES, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'serial-ipc',
      actionLabel,
    });
  };

  ipcMain.handle(IPC.SERIAL_LIST, async () => {
    await ensureDevices(t('List serial ports'));
    const { SerialPort } = await loadSerialPort();
    const ports = await SerialPort.list();
    logVerbose('serial:list', ports.length);
    const mapped = ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer || '',
      serialNumber: port.serialNumber || '',
      vendorId: port.vendorId || '',
      productId: port.productId || '',
    }));
    return filterAllowedDevices(windowRegistry.config, 'serial', mapped.map((port) => ({
      ...port,
      id: port.path,
    }))).map(({ id, ...port }) => port);
  });

  ipcMain.handle(IPC.SERIAL_OPEN, async (_event, payload) => {
    await ensureDevices(t('Open serial port'));
    const result = validateSerialOpenPayload(payload);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const { SerialPort } = await loadSerialPort();
    const { path: portPath, opts } = result.value;
    if (!isDeviceAllowed(windowRegistry.config, 'serial', buildSerialDeviceKey(portPath))) {
      throw new Error(t('This serial port is disabled in Settings → Permissions.'));
    }
    if (openPorts.has(portPath)) {
      return { id: portPath, alreadyOpen: true };
    }

    const port = new SerialPort({
      path: portPath,
      baudRate: opts.baudRate,
      autoOpen: true,
    });
    await new Promise((resolve, reject) => {
      port.on('open', resolve);
      port.on('error', reject);
    });

    openPorts.set(portPath, port);
    logVerbose('serial:open', portPath);
    return { id: portPath, opened: true };
  });

  ipcMain.handle(IPC.SERIAL_WRITE, async (_event, payload) => {
    await ensureDevices(t('Write to serial port'));
    const result = validateSerialWritePayload(payload);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const port = openPorts.get(result.value.id);
    if (!port) {
      throw new Error(`Serial port not open: ${result.value.id}`);
    }

    const buffer = Buffer.isBuffer(result.value.data)
      ? result.value.data
      : Buffer.from(String(result.value.data));

    await new Promise((resolve, reject) => {
      port.write(buffer, (error) => (error ? reject(error) : resolve()));
    });

    logVerbose('serial:write', result.value.id, buffer.length);
    return { written: buffer.length };
  });

  ipcMain.handle(IPC.SERIAL_CLOSE, async (_event, payload) => {
    await ensureDevices(t('Close serial port'));
    const result = validateSerialClosePayload(payload);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const port = openPorts.get(result.value.id);
    if (!port) {
      return { closed: false };
    }

    await new Promise((resolve) => {
      port.close(() => resolve());
    });
    openPorts.delete(result.value.id);
    logVerbose('serial:close', result.value.id);
    return { closed: true };
  });
}

function closeAllSerialPorts() {
  for (const [id, port] of openPorts.entries()) {
    try {
      port.close();
    } catch {
      void id;
    }
  }
  openPorts.clear();
}

function closeSerialPort(portPath) {
  const port = openPorts.get(portPath);
  if (!port) {
    return false;
  }
  try {
    port.close();
  } catch {
    void 0;
  }
  openPorts.delete(portPath);
  return true;
}

module.exports = { registerSerialHandlers, closeAllSerialPorts, closeSerialPort, loadSerialPort };
