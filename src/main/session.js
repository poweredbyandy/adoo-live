const path = require('path');
const { session } = require('electron');
const { SESSION_PARTITION } = require('../shared/constants');

const PRELOAD_DIR = path.join(__dirname, '../preload');

function getOdooSession() {
  return session.fromPartition(SESSION_PARTITION);
}

function registerOdooPageShims(odooSession) {
  if (typeof odooSession.registerPreloadScript !== 'function') {
    return;
  }
  const scripts = [
    { id: 'odoo-kiosk-notification-shim', file: 'odoo-notification-shim.js', type: 'frame' },
    { id: 'odoo-kiosk-push-shim', file: 'odoo-push-shim.js', type: 'frame' },
    { id: 'odoo-kiosk-sw-notification-shim', file: 'odoo-sw-notification-shim.js', type: 'service-worker' },
  ];
  scripts.forEach(({ id, file, type }) => {
    try {
      odooSession.registerPreloadScript({
        id,
        type,
        filePath: path.join(PRELOAD_DIR, file),
      });
    } catch {
      void 0;
    }
  });
}

function configureSession() {
  const odooSession = getOdooSession();

  const allowedPermissions = new Set(['notifications', 'media', 'clipboard-read', 'push']);

  odooSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allowedPermissions.has(permission));
  });

  odooSession.setPermissionCheckHandler((_webContents, permission) => {
    return allowedPermissions.has(permission);
  });

  registerOdooPageShims(odooSession);

  return odooSession;
}

module.exports = { getOdooSession, configureSession };
