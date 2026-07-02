const { contextBridge, ipcRenderer, webFrame } = require('electron');
const fs = require('fs');
const path = require('path');
const { IPC } = require('../shared/ipc-channels');

const PRELOAD_DIR = __dirname;
const SECURE_CONTEXT_SHIM_SOURCE = fs.readFileSync(
  path.join(PRELOAD_DIR, 'odoo-secure-context-shim.js'),
  'utf8',
);
const WEBUSB_SHIM_SOURCE = fs.readFileSync(path.join(PRELOAD_DIR, 'odoo-webusb-shim.js'), 'utf8');
const WEBSERIAL_SHIM_SOURCE = fs.readFileSync(path.join(PRELOAD_DIR, 'odoo-webserial-shim.js'), 'utf8');

function injectMainWorldShim(source) {
  if (typeof webFrame?.executeJavaScript !== 'function') {
    return;
  }
  webFrame.executeJavaScript(source).catch(() => undefined);
}

injectMainWorldShim(SECURE_CONTEXT_SHIM_SOURCE);
injectMainWorldShim(WEBUSB_SHIM_SOURCE);
injectMainWorldShim(WEBSERIAL_SHIM_SOURCE);

const deviceUid = ipcRenderer.sendSync(IPC.PBA_KIOSK_DEVICE_UID);

contextBridge.exposeInMainWorld('pbaKiosk', {
  device_uid: deviceUid,
  print: (payload) => ipcRenderer.invoke(IPC.PBA_KIOSK_PRINT, payload),
  preview: (payload) => ipcRenderer.invoke(IPC.PBA_KIOSK_PREVIEW, payload),
});

contextBridge.exposeInMainWorld('odooBrowser', {
  getMode: () => ipcRenderer.invoke(IPC.BROWSER_GET_MODE),
  notify: (opts) => ipcRenderer.invoke(IPC.NOTIFY_SHOW, opts),
  printPreview: {
    getMode: () => ipcRenderer.invoke(IPC.PBA_KIOSK_PRINT_PREVIEW_MODE_GET),
    capture: (payload) => ipcRenderer.invoke(IPC.PBA_KIOSK_USB_PRINT_CAPTURE, payload),
  },
  push: {
    subscribe: () => ipcRenderer.invoke(IPC.PUSH_SUBSCRIBE),
    getSubscription: () => ipcRenderer.invoke(IPC.PUSH_GET_SUBSCRIPTION),
    unsubscribe: () => ipcRenderer.invoke(IPC.PUSH_UNSUBSCRIBE),
  },
  serial: {
    list: () => ipcRenderer.invoke(IPC.SERIAL_LIST),
    open: (path, opts) => ipcRenderer.invoke(IPC.SERIAL_OPEN, { path, opts }),
    write: (id, data) => ipcRenderer.invoke(IPC.SERIAL_WRITE, { id, data }),
    close: (id) => ipcRenderer.invoke(IPC.SERIAL_CLOSE, { id }),
  },
  usb: {
    list: () => ipcRenderer.invoke(IPC.USB_LIST),
    open: (deviceKey) => ipcRenderer.invoke(IPC.USB_OPEN, { deviceKey }),
    transferOut: (deviceKey, endpointNumber, data) => ipcRenderer.invoke(
      IPC.USB_TRANSFER_OUT,
      { deviceKey, endpointNumber, data },
    ),
    close: (deviceKey) => ipcRenderer.invoke(IPC.USB_CLOSE, { deviceKey }),
  },
  printer: {
    list: () => ipcRenderer.invoke(IPC.PRINTER_LIST),
    print: (opts) => ipcRenderer.invoke(IPC.PRINTER_PRINT, opts),
    printRaw: (opts) => ipcRenderer.invoke(IPC.PRINTER_PRINT_RAW, opts),
    getDefaults: () => ipcRenderer.invoke(IPC.PRINTER_GET_DEFAULTS),
    setDefaults: (defaults) => ipcRenderer.invoke(IPC.PRINTER_SET_DEFAULTS, defaults),
  },
  system: {
    getInfo: () => ipcRenderer.invoke(IPC.BROWSER_GET_SYSTEM_INFO),
  },
});
