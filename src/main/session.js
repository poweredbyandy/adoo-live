const path = require('path');
const { session } = require('electron');
const { SESSION_PARTITION } = require('../shared/constants');
const { loadConfig } = require('./config');
const {
  PERMISSION_TYPES,
  isPermissionGranted,
  ensurePermission,
  isCameraPermission,
  getDialogParent,
} = require('./permission-service');
const { t } = require('../i18n');

const PRELOAD_DIR = path.join(__dirname, '../preload');

const BASE_ALLOWED_PERMISSIONS = new Set(['notifications', 'clipboard-read', 'push']);

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

function configureSession(windowRegistry) {
  const odooSession = getOdooSession();

  odooSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (isCameraPermission(permission)) {
      const config = loadConfig();
      if (isPermissionGranted(config, PERMISSION_TYPES.CAMERA)) {
        callback(true);
        return;
      }
      ensurePermission(windowRegistry, PERMISSION_TYPES.CAMERA, {
        browserWindow: getDialogParent(windowRegistry),
        source: 'web-camera',
        actionLabel: t('Camera access'),
      })
        .then((allowed) => callback(allowed))
        .catch(() => callback(false));
      return;
    }

    callback(BASE_ALLOWED_PERMISSIONS.has(permission));
  });

  odooSession.setPermissionCheckHandler((_webContents, permission) => {
    if (isCameraPermission(permission)) {
      return isPermissionGranted(loadConfig(), PERMISSION_TYPES.CAMERA);
    }
    return BASE_ALLOWED_PERMISSIONS.has(permission);
  });

  registerOdooPageShims(odooSession);

  return odooSession;
}

module.exports = { getOdooSession, configureSession };
