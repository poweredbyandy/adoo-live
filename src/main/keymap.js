const { globalShortcut } = require('electron');
const { KEYMAP } = require('../shared/keymap');
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

function registerKeymap(windowRegistry, modeManager) {
  const handlers = {
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
    openLogs: () => sendShellAction(windowRegistry, 'openLogs'),
    'setMode:kiosk': () => sendShellAction(windowRegistry, 'setMode:kiosk'),
    'setMode:free': () => sendShellAction(windowRegistry, 'setMode:free'),
  };

  KEYMAP.forEach((entry) => {
    if (entry.action === 'toggleOdooDebug' && process.platform === 'darwin') {
      return;
    }
    const handler = handlers[entry.action];
    if (!handler) {
      return;
    }
    const registered = globalShortcut.register(entry.accelerator, handler);
    if (!registered) {
      appLogger.add('warn', 'keymap', t('Could not register shortcut'), entry.accelerator);
    }
  });

  appLogger.add('info', 'keymap', t('Shortcuts registered'), String(KEYMAP.length));
}

module.exports = { registerKeymap, handleOdooDebugShortcut, applyOdooDebug };
