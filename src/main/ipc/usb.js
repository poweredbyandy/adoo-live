const { IPC } = require('../../shared/ipc-channels');
const { PERMISSION_TYPES, ensurePermission, getDialogParent } = require('../permission-service');
const { isDeviceAllowed } = require('../device-permission-core');
const { loadUsb } = require('../usb-loader');
const {
  closeUsbDevice,
  openUsbDevice,
  toUsbDeviceInfo,
  transferUsbOut,
} = require('../usb-device-service');
const {
  filterAllowedUsbEntries,
  isSerialBackedDeviceKey,
  isSerialBackedEntryAllowed,
  listSerialBackedUsbDevices,
  parseSerialBackedDeviceKey,
} = require('../usb-serial-bridge');
const { t } = require('../../i18n');

function normalizeTransferData(data) {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.from(data);
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return Buffer.from(String(data));
}

function assertUsbEntryAllowed(config, entry) {
  if (entry?.viaSerialPath) {
    return isSerialBackedEntryAllowed(config, entry);
  }
  return isDeviceAllowed(config, 'usb', entry.deviceKey);
}

function assertUsbDeviceAllowed(config, deviceKey) {
  const key = String(deviceKey || '').trim();
  if (isSerialBackedDeviceKey(key)) {
    return isDeviceAllowed(config, 'serial', parseSerialBackedDeviceKey(key));
  }
  return isDeviceAllowed(config, 'usb', key);
}

function registerUsbHandlers(ipcMain, windowRegistry, logVerbose) {
  const ensureDevices = async (actionLabel) => {
    await ensurePermission(windowRegistry, PERMISSION_TYPES.DEVICES, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'usb-ipc',
      actionLabel,
    });
  };

  ipcMain.handle(IPC.USB_LIST, async () => {
    await ensureDevices(t('List USB devices'));
    const usb = await loadUsb();
    const nativeDevices = usb.getDeviceList().map((device) => toUsbDeviceInfo(device));
    const serialBackedDevices = await listSerialBackedUsbDevices();
    const combined = [...nativeDevices, ...serialBackedDevices];
    logVerbose('usb:list', `${nativeDevices.length} native, ${serialBackedDevices.length} serial`);
    return filterAllowedUsbEntries(windowRegistry.config, combined);
  });

  ipcMain.handle(IPC.USB_OPEN, async (_event, payload) => {
    await ensureDevices(t('Open USB device'));
    const deviceKey = String(payload?.deviceKey || '').trim();
    if (!assertUsbDeviceAllowed(windowRegistry.config, deviceKey)) {
      throw new Error(t('This USB device is disabled in Settings → Permissions.'));
    }
    const result = await openUsbDevice(deviceKey);
    logVerbose('usb:open', deviceKey);
    return result;
  });

  ipcMain.handle(IPC.USB_TRANSFER_OUT, async (_event, payload) => {
    await ensureDevices(t('Write to USB device'));
    const deviceKey = String(payload?.deviceKey || '').trim();
    if (!assertUsbDeviceAllowed(windowRegistry.config, deviceKey)) {
      throw new Error(t('This USB device is disabled in Settings → Permissions.'));
    }
    const result = await transferUsbOut(
      deviceKey,
      payload?.endpointNumber,
      normalizeTransferData(payload?.data),
    );
    logVerbose('usb:transferOut', deviceKey, result.bytesWritten);
    return result;
  });

  ipcMain.handle(IPC.USB_CLOSE, async (_event, payload) => {
    await ensureDevices(t('Close USB device'));
    const deviceKey = String(payload?.deviceKey || '').trim();
    const result = await closeUsbDevice(deviceKey);
    logVerbose('usb:close', deviceKey);
    return result;
  });
}

module.exports = {
  registerUsbHandlers,
  loadUsb,
  assertUsbEntryAllowed,
  assertUsbDeviceAllowed,
};
