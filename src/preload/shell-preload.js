const { contextBridge, ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipc-channels');

contextBridge.exposeInMainWorld('shellAPI', {
  getState: () => ipcRenderer.invoke(IPC.BROWSER_GET_STATE),
  setMode: (mode, pin) => ipcRenderer.invoke(IPC.BROWSER_SET_MODE, { mode, pin }),
  navigate: (url) => ipcRenderer.invoke(IPC.BROWSER_NAVIGATE, url),
  goBack: () => ipcRenderer.invoke(IPC.BROWSER_GO_BACK),
  goForward: () => ipcRenderer.invoke(IPC.BROWSER_GO_FORWARD),
  reload: (options) => ipcRenderer.invoke(IPC.BROWSER_RELOAD, options),
  stop: () => ipcRenderer.invoke(IPC.BROWSER_STOP),
  home: () => ipcRenderer.invoke(IPC.BROWSER_HOME),
  newTab: (url) => ipcRenderer.invoke(IPC.BROWSER_NEW_TAB, url),
  openTab: (type, url) => ipcRenderer.invoke(IPC.BROWSER_OPEN_TAB, { type, url }),
  reorderTab: (tabId, newIndex) => ipcRenderer.invoke(IPC.BROWSER_REORDER_TAB, { tabId, newIndex }),
  detachTab: (tabId, position) => ipcRenderer.invoke(IPC.BROWSER_DETACH_TAB, { tabId, ...position }),
  duplicateTab: (tabId) => ipcRenderer.invoke(IPC.BROWSER_DUPLICATE_TAB, tabId),
  attachTab: (sourceWindowId, tabId, insertIndex) => ipcRenderer.invoke(IPC.BROWSER_ATTACH_TAB, { sourceWindowId, tabId, insertIndex }),
  mergeWindow: (sourceWindowId, insertIndex) => ipcRenderer.invoke(IPC.BROWSER_MERGE_WINDOW, { sourceWindowId, insertIndex }),
  closeTab: (tabId) => ipcRenderer.invoke(IPC.BROWSER_CLOSE_TAB, tabId),
  switchTab: (tabId) => ipcRenderer.invoke(IPC.BROWSER_SWITCH_TAB, tabId),
  findInPage: (text, options) => ipcRenderer.invoke(IPC.BROWSER_FIND_IN_PAGE, { text, options }),
  stopFind: (action) => ipcRenderer.invoke(IPC.BROWSER_STOP_FIND, action),
  setZoom: (delta) => ipcRenderer.invoke(IPC.BROWSER_SET_ZOOM, { delta }),
  resetZoom: () => ipcRenderer.invoke(IPC.BROWSER_SET_ZOOM, { reset: true }),
  toggleDevTools: () => ipcRenderer.invoke(IPC.BROWSER_TOGGLE_DEVTOOLS),
  setFindBarVisible: (visible) => ipcRenderer.invoke(IPC.SHELL_SET_FIND_BAR, visible),
  setMenuOpen: (open) => ipcRenderer.invoke(IPC.SHELL_SET_MENU_OPEN, open),
  setSettingsOpen: (open) => ipcRenderer.invoke(IPC.SHELL_SET_SETTINGS_OPEN, open),
  sendShellAction: (action) => ipcRenderer.invoke(IPC.SHELL_SEND_ACTION, { action }),
  dismissPrintNotice: (id) => ipcRenderer.invoke(IPC.SHELL_PRINT_NOTICE_DISMISS, id),
  getLogs: () => ipcRenderer.invoke(IPC.LOG_GET),
  clearLogs: () => ipcRenderer.invoke(IPC.LOG_CLEAR),
  exportLogs: () => ipcRenderer.invoke(IPC.LOG_EXPORT),
  appendLog: (payload) => ipcRenderer.invoke(IPC.LOG_APPEND, payload),
  getInstances: () => ipcRenderer.invoke(IPC.INSTANCES_GET),
  addInstance: (label, url) => ipcRenderer.invoke(IPC.INSTANCES_ADD, { label, url }),
  updateInstance: (id, patch) => ipcRenderer.invoke(IPC.INSTANCES_UPDATE, { id, ...patch }),
  removeInstance: (id) => ipcRenderer.invoke(IPC.INSTANCES_REMOVE, id),
  setDefaultInstance: (id) => ipcRenderer.invoke(IPC.INSTANCES_SET_DEFAULT, id),
  clearPageHistory: () => ipcRenderer.invoke(IPC.HISTORY_CLEAR_PAGE),
  setLocale: (locale) => ipcRenderer.invoke(IPC.I18N_SET_LOCALE, locale),
  getAboutInfo: () => ipcRenderer.invoke(IPC.APP_GET_ABOUT),
  checkForUpdates: () => ipcRenderer.invoke(IPC.UPDATE_CHECK),
  downloadUpdate: () => ipcRenderer.invoke(IPC.UPDATE_DOWNLOAD),
  installUpdate: () => ipcRenderer.invoke(IPC.UPDATE_INSTALL),
  factoryReset: () => ipcRenderer.invoke(IPC.APP_FACTORY_RESET),
  confirm: (options) => ipcRenderer.invoke(IPC.APP_CONFIRM, options),
  getDownloadFolder: () => ipcRenderer.invoke(IPC.DOWNLOAD_GET_FOLDER),
  setDownloadFolder: (folderPath) => ipcRenderer.invoke(IPC.DOWNLOAD_SET_FOLDER, folderPath),
  pickDownloadFolder: () => ipcRenderer.invoke(IPC.DOWNLOAD_PICK_FOLDER),
  openDownloadFile: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_OPEN_FILE, id),
  openDownloadFolder: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_OPEN_FOLDER, id),
  removeDownload: (id, deleteFile) => ipcRenderer.invoke(IPC.DOWNLOAD_REMOVE, { id, deleteFile }),
  getPermissions: () => ipcRenderer.invoke(IPC.PERMISSION_GET),
  setPermission: (type, enabled) => ipcRenderer.invoke(IPC.PERMISSION_SET, { type, enabled }),
  showTabContextMenu: (payload) => ipcRenderer.send(IPC.SHELL_TAB_CONTEXT_MENU, payload),
  onStateUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on(IPC.SHELL_STATE_UPDATE, listener);
    return () => ipcRenderer.removeListener(IPC.SHELL_STATE_UPDATE, listener);
  },
  onAction: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('shell:action', listener);
    return () => ipcRenderer.removeListener('shell:action', listener);
  },
  onLogEntry: (callback) => {
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on(IPC.LOG_ENTRY, listener);
    return () => ipcRenderer.removeListener(IPC.LOG_ENTRY, listener);
  },
  onFindResult: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on(IPC.SHELL_FIND_RESULT, listener);
    return () => ipcRenderer.removeListener(IPC.SHELL_FIND_RESULT, listener);
  },
  onUpdateEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(IPC.UPDATE_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.UPDATE_EVENT, listener);
  },
});
