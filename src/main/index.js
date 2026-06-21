const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const { APP_DISPLAY_NAME } = require('../shared/constants');
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
const { initUpdateService, checkForUpdatesOnStartup } = require('./update-service');
const { applyAppIcon } = require('./app-icon');

let modeManager = null;
let cleanupIpc = null;
let isDisconnectingDevices = false;
let appBootstrapped = false;

const gotLock = app.requestSingleInstanceLock();
app.setName(APP_DISPLAY_NAME);
if (!gotLock) {
  console.log('[adoo IoT] Ya hay otra instancia en ejecución. Cierra la ventana existente o termina el proceso Electron.');
  app.quit();
  process.exit(0);
}

function bootstrapApp() {
  if (appBootstrapped) {
    return;
  }
  appBootstrapped = true;

  setupProcessLogging();
  const config = loadConfig();
  initI18n(config.uiLanguage);
  appLogger.add('info', 'app', t('Application starting'), config.baseUrl || t('No instances configured'));
  appLogger.add(
    'info',
    'notify',
    Notification.isSupported() ? t('Native notifications available') : t('Native notifications not supported'),
  );
  modeManager = new ModeManager(config.startupMode);
  windowRegistry.init(config, modeManager);
  configureSession(windowRegistry);
  cleanupIpc = registerIpcHandlers(ipcMain, windowRegistry, modeManager);

  appLogger.subscribe((entry) => {
    windowRegistry.broadcastLogEntry(entry);
  });

  appLogger.add('info', 'app', t('Initial mode'), config.startupMode);
}

function openMainWindow() {
  bootstrapApp();
  const manager = windowRegistry.createMainWindow();
  registerKeymap(windowRegistry);
  return manager;
}

app.whenReady().then(async () => {
  applyAppIcon();
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

  openMainWindow();
  const firstManager = windowRegistry.getFocused() || windowRegistry.getAll()[0];
  if (firstManager?.window) {
    firstManager.window.once('ready-to-show', () => {
      const { runFirstRunPermissionsPrompt } = require('./permission-service');
      void runFirstRunPermissionsPrompt(windowRegistry);
    });
  }
  initUpdateService();

  if (firstManager?.window?.webContents) {
    firstManager.window.webContents.once('did-finish-load', () => {
      void checkForUpdatesOnStartup();
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
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
