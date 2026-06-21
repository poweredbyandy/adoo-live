const { IPC } = require('../../shared/ipc-channels');
const { PERMISSION_TYPES, ensurePermission, getDialogParent } = require('../permission-service');
const {
  isDeviceAllowed,
  buildUsbDeviceKey,
  filterAllowedDevices,
} = require('../device-permission-service');
const { t } = require('../../i18n');

let usbModule = null;

async function loadUsb() {
  if (!usbModule) {
    usbModule = require('usb');
  }
  return usbModule;
}

function registerUsbHandlers(ipcMain, windowRegistry, logVerbose) {
  ipcMain.handle(IPC.USB_LIST, async () => {
    await ensurePermission(windowRegistry, PERMISSION_TYPES.DEVICES, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'usb-ipc',
      actionLabel: t('List USB devices'),
    });
    const usb = await loadUsb();
    const devices = usb.getDeviceList();
    logVerbose('usb:list', devices.length);
    const mapped = devices.map((device) => ({
      busNumber: device.busNumber,
      deviceAddress: device.deviceAddress,
      vendorId: device.deviceDescriptor.idVendor,
      productId: device.deviceDescriptor.idProduct,
    }));
    return filterAllowedDevices(windowRegistry.config, 'usb', mapped.map((device) => ({
      ...device,
      id: buildUsbDeviceKey(device),
    }))).map(({ id, ...device }) => device);
  });
}

module.exports = { registerUsbHandlers, loadUsb };
