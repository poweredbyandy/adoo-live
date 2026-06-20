const { IPC } = require('../../shared/ipc-channels');

let usbModule = null;

async function loadUsb() {
  if (!usbModule) {
    usbModule = require('usb');
  }
  return usbModule;
}

function registerUsbHandlers(ipcMain, logVerbose) {
  ipcMain.handle(IPC.USB_LIST, async () => {
    const usb = await loadUsb();
    const devices = usb.getDeviceList();
    logVerbose('usb:list', devices.length);
    return devices.map((device) => ({
      busNumber: device.busNumber,
      deviceAddress: device.deviceAddress,
      vendorId: device.deviceDescriptor.idVendor,
      productId: device.deviceDescriptor.idProduct,
    }));
  });
}

module.exports = { registerUsbHandlers, loadUsb };
