let usbModule = null;

async function loadUsb() {
  if (!usbModule) {
    usbModule = require('usb');
  }
  return usbModule;
}

module.exports = {
  loadUsb,
};
