const { IPC } = require('../../shared/ipc-channels');
const {
  validateSerialOpenPayload,
  validateSerialWritePayload,
  validateSerialClosePayload,
} = require('../../shared/validators');

let serialportModule = null;
const openPorts = new Map();

async function loadSerialPort() {
  if (!serialportModule) {
    serialportModule = require('serialport');
  }
  return serialportModule;
}

function registerSerialHandlers(ipcMain, logVerbose) {
  ipcMain.handle(IPC.SERIAL_LIST, async () => {
    const { SerialPort } = await loadSerialPort();
    const ports = await SerialPort.list();
    logVerbose('serial:list', ports.length);
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer || '',
      serialNumber: port.serialNumber || '',
      vendorId: port.vendorId || '',
      productId: port.productId || '',
    }));
  });

  ipcMain.handle(IPC.SERIAL_OPEN, async (_event, payload) => {
    const result = validateSerialOpenPayload(payload);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const { SerialPort } = await loadSerialPort();
    const { path: portPath, opts } = result.value;
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

module.exports = { registerSerialHandlers, closeAllSerialPorts, loadSerialPort };
