const { IPC } = require('../../shared/ipc-channels');
const { TAB_TYPES } = require('../../shared/tab-types');
const { isVerboseLogging } = require('../mode-manager');
const { appLogger } = require('../logger');
const { saveLastMode } = require('../config');
const { registerNotificationHandlers } = require('./notifications');
const { registerPushHandlers } = require('./push');
const { registerSerialHandlers, closeAllSerialPorts } = require('./serial');
const { registerUsbHandlers } = require('./usb');
const { registerPrinterHandlers } = require('./printer');
const { registerPbaKioskHandlers } = require('./pba-kiosk');
const { registerUpdateHandlers } = require('./update');
const { registerDownloadHandlers } = require('./downloads');
const { registerPermissionHandlers } = require('./permissions');
const { registerAppHandlers } = require('./app');
const {
  getInstancesSnapshot,
  addInstance,
  updateInstance,
  removeInstance,
  setDefaultInstance,
} = require('../instances');
const { historyStore } = require('../history-store');
const { initI18n, normalizeLocale } = require('../../i18n');
const { saveUserConfig } = require('../config');
const { createApplicationMenu } = require('../menu');
const { showTabContextMenu } = require('../tab-context-menu');

function wrapHandler(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      appLogger.add('error', 'ipc', error.message, error.stack);
      throw error;
    }
  };
}

function createVerboseLogger(modeManager) {
  return (action, ...args) => {
    if (!isVerboseLogging(modeManager.getMode())) {
      return;
    }
    console.log(`[odoo-kiosk][dev] ${action}`, ...args);
  };
}

function resolveWindowManager(windowRegistry, event, fallback = null) {
  return windowRegistry.getByWebContents(event.sender) || fallback || windowRegistry.getFocused();
}

function registerIpcHandlers(ipcMain, windowRegistry, modeManager) {
  const logVerbose = createVerboseLogger(modeManager);
  const primaryManager = () => windowRegistry.getFocused() || windowRegistry.getAll()[0] || null;

  ipcMain.handle(IPC.BROWSER_GET_MODE, wrapHandler(() => modeManager.getCapabilities()));

  ipcMain.handle(IPC.BROWSER_GET_STATE, wrapHandler((event) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_SET_MODE, wrapHandler((_event, payload) => {
    const nextMode = payload?.mode;
    const pin = payload?.pin;
    const previousMode = modeManager.getMode();
    const capabilities = modeManager.setMode(nextMode, pin, windowRegistry.getAll()[0]?.config?.developerPin);
    windowRegistry.applyModeChange(previousMode);
    if (capabilities.mode !== previousMode) {
      saveLastMode(capabilities.mode);
    }
    logVerbose('browser:setMode', capabilities.mode);
    return capabilities;
  }));

  ipcMain.handle(IPC.BROWSER_NAVIGATE, wrapHandler((event, url) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.navigate(url);
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_GO_BACK, wrapHandler((event) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.goBack();
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_GO_FORWARD, wrapHandler((event) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.goForward();
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_RELOAD, wrapHandler((event, options) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.reload(Boolean(options?.ignoreCache));
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_STOP, wrapHandler((event) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.stop();
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_HOME, wrapHandler((event) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.home();
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_NEW_TAB, wrapHandler((event, url) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (!modeManager.getCapabilities().canHaveTabs) {
      throw new Error('Tabs are disabled in kiosk mode');
    }
    const tab = windowManager.createTab(url || undefined);
    windowManager.switchTab(tab.id);
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_OPEN_TAB, wrapHandler((event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (!modeManager.getCapabilities().canHaveTabs) {
      throw new Error('Tabs are disabled in kiosk mode');
    }
    const type = payload?.type;
    if (!type || !Object.values(TAB_TYPES).includes(type)) {
      throw new Error(`Invalid tab type: ${type}`);
    }
    if (type === TAB_TYPES.ODOO) {
      const tab = windowManager.createOdooTab(payload?.url || undefined);
      windowManager.switchTab(tab.id);
    } else {
      windowManager.openOrSwitchPanelTab(type);
    }
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_REORDER_TAB, wrapHandler((event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (!modeManager.getCapabilities().canHaveTabs) {
      throw new Error('Tabs are disabled in kiosk mode');
    }
    windowManager.reorderTab(payload?.tabId, Number(payload?.newIndex ?? 0));
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_DETACH_TAB, wrapHandler((event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (!modeManager.getCapabilities().canHaveTabs) {
      throw new Error('Tabs are disabled in kiosk mode');
    }
    windowManager.detachTab(payload?.tabId, {
      screenX: Number(payload?.screenX),
      screenY: Number(payload?.screenY),
    });
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_DUPLICATE_TAB, wrapHandler((event, tabId) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.duplicateTab(tabId);
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_ATTACH_TAB, wrapHandler((event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (!modeManager.getCapabilities().canHaveTabs) {
      throw new Error('Tabs are disabled in kiosk mode');
    }
    windowManager.attachTabFrom(payload?.sourceWindowId, payload?.tabId, Number(payload?.insertIndex ?? 0));
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_MERGE_WINDOW, wrapHandler((event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (!modeManager.getCapabilities().canHaveTabs) {
      throw new Error('Tabs are disabled in kiosk mode');
    }
    windowManager.mergeWindowFrom(payload?.sourceWindowId, Number(payload?.insertIndex ?? windowManager.tabs.length));
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_CLOSE_TAB, wrapHandler((event, tabId) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.closeTab(tabId);
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_SWITCH_TAB, wrapHandler((event, tabId) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.switchTab(tabId);
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.BROWSER_GET_TABS, wrapHandler((event) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    return windowManager.getState().tabs;
  }));

  ipcMain.handle(IPC.BROWSER_FIND_IN_PAGE, wrapHandler((event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    return windowManager.findInPage(payload?.text, payload?.options);
  }));

  ipcMain.handle(IPC.BROWSER_STOP_FIND, wrapHandler((event, action) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.stopFind(action);
    return true;
  }));

  ipcMain.handle(IPC.BROWSER_SET_ZOOM, wrapHandler((event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (payload?.reset) {
      return windowManager.resetZoom();
    }
    return windowManager.setZoom(Number(payload?.delta || 0));
  }));

  ipcMain.handle(IPC.BROWSER_TOGGLE_DEVTOOLS, wrapHandler((event) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    return windowManager.toggleDevTools();
  }));

  ipcMain.handle(IPC.SHELL_SET_FIND_BAR, wrapHandler((event, visible) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.setFindBarVisible(visible);
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.SHELL_SET_MENU_OPEN, wrapHandler((event, open) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.setMenuOpen(open);
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.SHELL_SET_SETTINGS_OPEN, wrapHandler((event, open) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.setSettingsOpen(open);
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.SHELL_SEND_ACTION, wrapHandler((event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (windowManager?.window && !windowManager.window.isDestroyed()) {
      windowManager.window.webContents.send('shell:action', { action: payload?.action });
    }
    return true;
  }));

  ipcMain.handle(IPC.SHELL_PRINT_NOTICE_DISMISS, wrapHandler((event, noticeId) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    windowManager.dismissPrintNotice(String(noticeId || ''));
    return windowManager.getState();
  }));

  ipcMain.handle(IPC.LOG_GET, wrapHandler(() => appLogger.getEntries()));
  ipcMain.handle(IPC.LOG_CLEAR, wrapHandler(() => {
    appLogger.clear();
    windowRegistry.broadcastState();
    return true;
  }));
  ipcMain.handle(IPC.LOG_EXPORT, wrapHandler(async () => {
    const { ensurePermission, PERMISSION_TYPES, getDialogParent } = require('../permission-service');
    const { t } = require('../../i18n');
    await ensurePermission(windowRegistry, PERMISSION_TYPES.FILES, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'log-export',
      actionLabel: t('Export logs to file'),
    });
    return appLogger.exportToFile();
  }));
  ipcMain.handle(IPC.LOG_APPEND, wrapHandler((_event, payload) => {
    appLogger.add(payload?.level || 'info', payload?.source || 'shell', payload?.message || '', payload?.detail);
    windowRegistry.broadcastState();
    return true;
  }));

  ipcMain.handle(IPC.INSTANCES_GET, wrapHandler(() => getInstancesSnapshot(windowRegistry.config)));

  ipcMain.handle(IPC.INSTANCES_ADD, wrapHandler((_event, payload) => {
    addInstance(windowRegistry.config, payload?.label, payload?.url);
    windowRegistry.reloadConfig();
    windowRegistry.broadcastState();
    return getInstancesSnapshot(windowRegistry.config);
  }));

  ipcMain.handle(IPC.INSTANCES_UPDATE, wrapHandler((_event, payload) => {
    updateInstance(windowRegistry.config, payload?.id, {
      label: payload?.label,
      url: payload?.url,
    });
    windowRegistry.reloadConfig();
    windowRegistry.broadcastState();
    return getInstancesSnapshot(windowRegistry.config);
  }));

  ipcMain.handle(IPC.INSTANCES_REMOVE, wrapHandler((_event, id) => {
    removeInstance(windowRegistry.config, id);
    windowRegistry.reloadConfig();
    windowRegistry.broadcastState();
    return getInstancesSnapshot(windowRegistry.config);
  }));

  ipcMain.handle(IPC.INSTANCES_SET_DEFAULT, wrapHandler((_event, id) => {
    setDefaultInstance(windowRegistry.config, id);
    windowRegistry.reloadConfig();
    windowRegistry.broadcastState();
    return getInstancesSnapshot(windowRegistry.config);
  }));

  ipcMain.handle(IPC.HISTORY_CLEAR_PAGE, wrapHandler(() => {
    historyStore.clearPageHistory();
    windowRegistry.broadcastState();
    return true;
  }));

  ipcMain.handle(IPC.I18N_SET_LOCALE, wrapHandler((_event, locale) => {
    const nextLocale = initI18n(normalizeLocale(locale));
    saveUserConfig({ uiLanguage: nextLocale });
    const config = windowRegistry.reloadConfig();
    config.uiLanguage = nextLocale;
    windowRegistry.getAll().forEach((manager) => {
      manager.config.uiLanguage = nextLocale;
    });
    createApplicationMenu(windowRegistry);
    windowRegistry.broadcastState();
    return nextLocale;
  }));

  ipcMain.on(IPC.SHELL_TAB_CONTEXT_MENU, (event, payload) => {
    const windowManager = resolveWindowManager(windowRegistry, event, primaryManager());
    if (!windowManager?.window || windowManager.window.isDestroyed()) {
      return;
    }
    if (!modeManager.getCapabilities().canHaveTabs) {
      return;
    }
    showTabContextMenu(windowManager.window, payload, {
      onDetach: (tabId, position) => {
        try {
          windowManager.detachTab(tabId, position);
        } catch (error) {
          appLogger.add('error', 'tabs', error.message);
        }
      },
      onDuplicate: (tabId) => {
        try {
          windowManager.duplicateTab(tabId);
        } catch (error) {
          appLogger.add('error', 'tabs', error.message);
        }
      },
      onClose: (tabId) => {
        windowManager.closeTab(tabId);
      },
    });
  });

  registerNotificationHandlers(ipcMain);
  registerPushHandlers(ipcMain);
  registerSerialHandlers(ipcMain, windowRegistry, logVerbose);
  registerUsbHandlers(ipcMain, windowRegistry, logVerbose);
  registerPrinterHandlers(ipcMain, windowRegistry, () => primaryManager()?.getActiveWebContents() || null, logVerbose);
  registerPbaKioskHandlers(ipcMain);
  registerUpdateHandlers(ipcMain);
  registerDownloadHandlers(ipcMain, windowRegistry, resolveWindowManager, primaryManager);
  registerPermissionHandlers(ipcMain, windowRegistry);
  registerAppHandlers(ipcMain, windowRegistry, resolveWindowManager, primaryManager);

  return () => {
    closeAllSerialPorts();
  };
}

module.exports = { registerIpcHandlers, createVerboseLogger, resolveWindowManager };
