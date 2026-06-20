const { app, BrowserWindow, ipcMain, globalShortcut, Notification } = require('electron');
const { loadConfig } = require('./config');
const { initI18n, t } = require('../i18n');
const { configureSession } = require('./session');
const { ModeManager } = require('./mode-manager');
const { windowRegistry } = require('./window-registry');
const { registerIpcHandlers } = require('./ipc');
const { registerKeymap } = require('./keymap');
const { setupProcessLogging, appLogger } = require('./logger');
const { webPushServer } = require('./web-push-server');
const { setNotificationClickHandler } = require('./notification-service');
const { disconnectAllKioskDevices } = require('./kiosk-device-service');

let modeManager = null;
let cleanupIpc = null;
let isDisconnectingDevices = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function createMainWindow() {
  setupProcessLogging();
  const config = loadConfig();
  initI18n(config.uiLanguage);
  appLogger.add('info', 'app', t('Application starting'), config.baseUrl);
  appLogger.add(
    'info',
    'notify',
    Notification.isSupported() ? t('Native notifications available') : t('Native notifications not supported'),
  );
  modeManager = new ModeManager(config.startupMode);
  windowRegistry.init(config, modeManager);
  configureSession();

  const manager = windowRegistry.createMainWindow();
  cleanupIpc = registerIpcHandlers(ipcMain, windowRegistry, modeManager);
  registerKeymap(windowRegistry, modeManager);

  appLogger.subscribe((entry) => {
    windowRegistry.broadcastLogEntry(entry);
  });

  appLogger.add('info', 'app', t('Initial mode'), config.startupMode);

  return manager;
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.andyengit.odoo-kiosk');
  }
  await webPushServer.start();

  setNotificationClickHandler((action) => {
    const focused = windowRegistry.getFocused() || windowRegistry.getAll()[0];
    if (!focused?.window || focused.window.isDestroyed()) {
      return;
    }
    if (focused.window.isMinimized()) {
      focused.window.restore();
    }
    focused.window.focus();
    focused.window.webContents.send('shell:action', { action });
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('second-instance', () => {
  const focused = windowRegistry.getFocused() || windowRegistry.getAll()[0];
  if (focused?.window) {
    if (focused.window.isMinimized()) {
      focused.window.restore();
    }
    focused.window.focus();
  }
});

app.on('before-quit', (event) => {
  if (isDisconnectingDevices) {
    return;
  }
  event.preventDefault();
  isDisconnectingDevices = true;
  disconnectAllKioskDevices()
    .catch(() => {})
    .finally(() => {
      app.quit();
    });
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  if (cleanupIpc) {
    cleanupIpc();
  }
  await webPushServer.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
