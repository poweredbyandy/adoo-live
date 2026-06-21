const { KEYMAP } = require('../shared/keymap');
const { matchesAccelerator } = require('../shared/shortcut-input');
const { consumeOdooDebugLevelFromShortcut } = require('../shared/odoo-debug-shortcut');
const { appLogger } = require('./logger');
const { t } = require('../i18n');

function sendShellAction(windowRegistry, action) {
  const focused = windowRegistry.getFocused();
  if (!focused?.window || focused.window.isDestroyed()) {
    return;
  }
  focused.window.focus();
  focused.window.webContents.send('shell:action', { action });
}

function getTargetManager(windowRegistry) {
  return windowRegistry.getFocused() || windowRegistry.getAll()[0] || null;
}

function applyOdooDebug(windowRegistry) {
  const manager = getTargetManager(windowRegistry);
  if (!manager) {
    appLogger.add('warn', 'keymap', t('Developer Odoo'), t('No active window'));
    return;
  }
  const level = consumeOdooDebugLevelFromShortcut();
  if (!level) {
    return;
  }
  appLogger.add('info', 'keymap', t('Developer Odoo shortcut'), level);
  try {
    manager.setOdooDebug(level);
  } catch (error) {
    appLogger.add('warn', 'odoo', t('Odoo developer mode enabled'), error.message);
  }
}

function handleOdooDebugShortcut(windowRegistry) {
  applyOdooDebug(windowRegistry);
}

function createKeymapHandlers(windowRegistry) {
  return {
    toggleOdooDebug: () => applyOdooDebug(windowRegistry),
    toggleFind: () => {
      const focused = windowRegistry.getFocused();
      if (!focused?.window || focused.window.isDestroyed()) {
        return;
      }
      focused.window.focus();
      focused.window.webContents.focus();
      sendShellAction(windowRegistry, 'toggleFind');
    },
    reloadHard: () => {
      const focused = windowRegistry.getFocused();
      focused?.reload(true);
    },
    toggleDevTools: () => {
      getTargetManager(windowRegistry)?.toggleDevTools();
    },
    openLogs: () => sendShellAction(windowRegistry, 'openLogs'),
    'setMode:kiosk': () => sendShellAction(windowRegistry, 'setMode:kiosk'),
    'setMode:free': () => sendShellAction(windowRegistry, 'setMode:free'),
  };
}

function attachKeymapShortcuts(windowRegistry, webContents) {
  if (!webContents || webContents._odooKioskKeymapAttached) {
    return;
  }
  webContents._odooKioskKeymapAttached = true;
  const handlers = createKeymapHandlers(windowRegistry);

  webContents.on('before-input-event', (event, input) => {
    for (const entry of KEYMAP) {
      if (!matchesAccelerator(input, entry.accelerator)) {
        continue;
      }
      const handler = handlers[entry.action];
      if (!handler) {
        continue;
      }
      event.preventDefault();
      handler();
      return;
    }
  });
}

function registerKeymap(windowRegistry) {
  windowRegistry.getAll().forEach((manager) => {
    if (manager.window?.webContents) {
      attachKeymapShortcuts(windowRegistry, manager.window.webContents);
    }
    manager.tabs?.forEach((tab) => {
      if (tab.view?.webContents) {
        attachKeymapShortcuts(windowRegistry, tab.view.webContents);
      }
    });
    if (manager.menuOverlayView?.webContents) {
      attachKeymapShortcuts(windowRegistry, manager.menuOverlayView.webContents);
    }
  });
  appLogger.add('info', 'keymap', t('Shortcuts registered'), String(KEYMAP.length));
}

module.exports = {
  registerKeymap,
  attachKeymapShortcuts,
  handleOdooDebugShortcut,
  applyOdooDebug,
};
