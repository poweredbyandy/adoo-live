const { isOdooDebugShortcutInput } = require('../shared/shortcut-input');
const { consumeOdooDebugLevelFromShortcut } = require('../shared/odoo-debug-shortcut');
const { appLogger } = require('./logger');
const { t } = require('../i18n');

function attachInputShortcuts(windowRegistry, webContents) {
  if (!webContents || webContents._odooKioskInputShortcutsAttached) {
    return;
  }
  webContents._odooKioskInputShortcutsAttached = true;

  webContents.on('before-input-event', (event, input) => {
    if (!isOdooDebugShortcutInput(input)) {
      return;
    }
    event.preventDefault();

    const level = consumeOdooDebugLevelFromShortcut();
    if (!level) {
      return;
    }

    const manager = windowRegistry.getByWebContents(webContents)
      || windowRegistry.getFocused()
      || windowRegistry.getAll()[0];
    if (!manager) {
      appLogger.add('warn', 'keymap', t('Developer Odoo'), t('No active window'));
      return;
    }

    appLogger.add('info', 'keymap', t('Developer Odoo shortcut'), level);
    try {
      manager.setOdooDebug(level);
    } catch (error) {
      appLogger.add('warn', 'odoo', t('Odoo developer mode enabled'), error.message);
    }
  });
}

module.exports = { attachInputShortcuts };
