const { buildUsbDeviceKey } = require('./device-permission-core');

function collectInterfaceClasses(device) {
  const classes = new Set();
  try {
    const deviceClass = device.deviceDescriptor?.bDeviceClass;
    if (deviceClass !== undefined && deviceClass !== 0) {
      classes.add(Number(deviceClass));
    }
    const config = device.configDescriptor;
    if (config?.interfaces) {
      for (const iface of config.interfaces) {
        const cls = iface.descriptor?.bInterfaceClass;
        if (cls !== undefined) {
          classes.add(Number(cls));
        }
      }
    }
  } catch {
    void 0;
  }
  return [...classes];
}

function toEnrichedUsbDeviceInfo(device) {
  const vendorId = device.deviceDescriptor.idVendor;
  const productId = device.deviceDescriptor.idProduct;
  return {
    vendorId,
    productId,
    busNumber: device.busNumber,
    deviceAddress: device.deviceAddress,
    deviceClass: Number(device.deviceDescriptor?.bDeviceClass || 0),
    interfaceClasses: collectInterfaceClasses(device),
    deviceKey: buildUsbDeviceKey({
      vendorId,
      productId,
      busNumber: device.busNumber,
      deviceAddress: device.deviceAddress,
    }),
  };
}

module.exports = {
  collectInterfaceClasses,
  toEnrichedUsbDeviceInfo,
};
