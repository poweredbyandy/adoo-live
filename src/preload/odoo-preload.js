const { contextBridge, ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipc-channels');

const deviceUid = ipcRenderer.sendSync(IPC.PBA_KIOSK_DEVICE_UID);

contextBridge.exposeInMainWorld('pbaKiosk', {
  device_uid: deviceUid,
  print: (payload) => ipcRenderer.invoke(IPC.PBA_KIOSK_PRINT, payload),
});

contextBridge.exposeInMainWorld('odooBrowser', {
  getMode: () => ipcRenderer.invoke(IPC.BROWSER_GET_MODE),
  notify: (opts) => ipcRenderer.invoke(IPC.NOTIFY_SHOW, opts),
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
  },
  printer: {
    list: () => ipcRenderer.invoke(IPC.PRINTER_LIST),
    print: (opts) => ipcRenderer.invoke(IPC.PRINTER_PRINT, opts),
    printRaw: (opts) => ipcRenderer.invoke(IPC.PRINTER_PRINT_RAW, opts),
  },
  system: {
    getInfo: () => ipcRenderer.invoke(IPC.BROWSER_GET_SYSTEM_INFO),
  },
});
