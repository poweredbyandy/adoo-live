const path = require('path');
const { BrowserWindow } = require('electron');
const { WindowManager } = require('./window-manager');
const { createApplicationMenu } = require('./menu');
const { IPC } = require('../shared/ipc-channels');
const { appLogger } = require('./logger');
const { loadConfig } = require('./config');

let windowCounter = 0;

class WindowRegistry {
  constructor() {
    this.managers = new Map();
    this.config = null;
    this.modeManager = null;
  }

  init(config, modeManager) {
    this.config = config;
    this.modeManager = modeManager;
  }

  reloadConfig() {
    this.config = loadConfig();
    this.getAll().forEach((manager) => {
      manager.config = this.config;
    });
    return this.config;
  }

  createId() {
    windowCounter += 1;
    return `win-${windowCounter}`;
  }

  register(manager) {
    this.managers.set(manager.id, manager);
  }

  unregister(manager) {
    this.managers.delete(manager.id);
  }

  get(id) {
    return this.managers.get(id) || null;
  }

  getByWebContents(webContents) {
    if (!webContents) {
      return null;
    }
    for (const manager of this.getAll()) {
      if (manager.menuOverlayView?.webContents === webContents) {
        return manager;
      }
      if (manager.window?.webContents === webContents) {
        return manager;
      }
      if (manager.tabs?.some((tab) => tab.view?.webContents === webContents)) {
        return manager;
      }
    }
    const window = BrowserWindow.fromWebContents(webContents);
    if (!window) {
      return null;
    }
    return this.getAll().find((manager) => manager.window === window) || null;
  }

  getFocused() {
    const focused = BrowserWindow.getFocusedWindow();
    if (!focused) {
      return this.getAll()[0] || null;
    }
    return this.getAll().find((manager) => manager.window === focused) || null;
  }

  getAll() {
    return Array.from(this.managers.values());
  }

  broadcastState() {
    this.getAll().forEach((manager) => manager.broadcastState());
  }

  broadcastLogEntry(entry) {
    this.getAll().forEach((manager) => {
      if (manager.window && !manager.window.isDestroyed()) {
        manager.window.webContents.send(IPC.LOG_ENTRY, entry);
      }
    });
  }

  applyModeChange(previousMode) {
    this.getAll().forEach((manager) => manager.applyModeChange(previousMode));
  }

  createMainWindow() {
    const manager = new WindowManager(this.config, this.modeManager, this);
    manager.id = this.createId();
    this.register(manager);
    const window = manager.createWindow();
    createApplicationMenu(this);
    manager.attachWindowLifecycle();
    return manager;
  }

  createWindowWithTabs(tabs, bounds = {}) {
    if (!this.modeManager.getCapabilities().canHaveTabs) {
      throw new Error('Tabs are disabled in kiosk mode');
    }
    const manager = new WindowManager(this.config, this.modeManager, this);
    manager.id = this.createId();
    this.register(manager);
    manager.pendingTabs = tabs;
    manager.pendingActiveTabId = tabs[0]?.id || null;
    const window = manager.createWindow({ skipInitialTab: true });
    manager.attachWindowLifecycle();
    if (bounds.x !== undefined && bounds.y !== undefined) {
      window.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: bounds.width || 1280,
        height: bounds.height || 800,
      });
    }
    return manager;
  }

  closeManager(manager) {
    if (!manager?.window || manager.window.isDestroyed()) {
      this.unregister(manager);
      return;
    }
    manager.window.close();
  }
}

const windowRegistry = new WindowRegistry();

module.exports = { WindowRegistry, windowRegistry };
