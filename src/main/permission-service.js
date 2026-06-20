const { dialog } = require('electron');
const { saveUserConfig, isFirstInstall } = require('./config');
const { appLogger } = require('./logger');
const { t } = require('../i18n');
const {
  PERMISSION_TYPES,
  PERMISSION_TYPE_LIST,
  DEFAULT_PERMISSIONS,
} = require('../shared/permission-types');

function normalizePermissions(config) {
  const stored = config?.permissions || {};
  return {
    printers: Boolean(stored.printers),
    devices: Boolean(stored.devices),
    camera: Boolean(stored.camera),
    files: Boolean(stored.files),
  };
}

function normalizeGrantedAt(config) {
  const stored = config?.permissionsGrantedAt || {};
  return {
    printers: stored.printers || null,
    devices: stored.devices || null,
    camera: stored.camera || null,
    files: stored.files || null,
  };
}

function getPermissionLabel(type) {
  switch (type) {
    case PERMISSION_TYPES.PRINTERS:
      return t('printers');
    case PERMISSION_TYPES.DEVICES:
      return t('devices');
    case PERMISSION_TYPES.CAMERA:
      return t('camera');
    case PERMISSION_TYPES.FILES:
      return t('files');
    default:
      return type;
  }
}

function getPermissionsSnapshot(config) {
  const permissions = normalizePermissions(config);
  const grantedAt = normalizeGrantedAt(config);
  return {
    printers: permissions.printers,
    devices: permissions.devices,
    camera: permissions.camera,
    files: permissions.files,
    grantedAt: {
      printers: permissions.printers ? grantedAt.printers : null,
      devices: permissions.devices ? grantedAt.devices : null,
      camera: permissions.camera ? grantedAt.camera : null,
      files: permissions.files ? grantedAt.files : null,
    },
  };
}

function isPermissionGranted(config, type) {
  if (!PERMISSION_TYPE_LIST.includes(type)) {
    return false;
  }
  return Boolean(normalizePermissions(config)[type]);
}

function getDialogParent(windowRegistry) {
  const manager = windowRegistry?.getFocused?.() || windowRegistry?.getAll?.()?.[0];
  if (manager?.window && !manager.window.isDestroyed()) {
    return manager.window;
  }
  return undefined;
}

function grantPermission(windowRegistry, type, source) {
  const config = windowRegistry.config;
  const permissions = normalizePermissions(config);
  const grantedAt = normalizeGrantedAt(config);
  const now = new Date().toISOString();

  permissions[type] = true;
  if (!grantedAt[type]) {
    grantedAt[type] = now;
  }

  saveUserConfig({ permissions, permissionsGrantedAt: grantedAt });
  windowRegistry.reloadConfig();
  windowRegistry.broadcastState();

  appLogger.add(
    'info',
    'permissions',
    t('Permission granted: %(permission)s', { permission: getPermissionLabel(type) }),
    `${source} · ${now}`,
  );

  return getPermissionsSnapshot(windowRegistry.config);
}

function setUserPermission(windowRegistry, type, enabled, source = 'settings') {
  if (!PERMISSION_TYPE_LIST.includes(type)) {
    throw new Error(t('Unknown permission type.'));
  }

  const config = windowRegistry.config;
  const permissions = normalizePermissions(config);
  const grantedAt = normalizeGrantedAt(config);
  const now = new Date().toISOString();

  if (enabled) {
    permissions[type] = true;
    if (!grantedAt[type]) {
      grantedAt[type] = now;
    }
    appLogger.add(
      'info',
      'permissions',
      t('Permission enabled: %(permission)s', { permission: getPermissionLabel(type) }),
      `${source} · ${grantedAt[type]}`,
    );
  } else {
    permissions[type] = false;
    appLogger.add(
      'info',
      'permissions',
      t('Permission disabled: %(permission)s', { permission: getPermissionLabel(type) }),
      source,
    );
  }

  saveUserConfig({ permissions, permissionsGrantedAt: grantedAt });
  windowRegistry.reloadConfig();
  windowRegistry.broadcastState();

  return {
    snapshot: getPermissionsSnapshot(windowRegistry.config),
    revoked: !enabled,
    type,
  };
}

async function ensurePermission(windowRegistry, type, context = {}) {
  if (!PERMISSION_TYPE_LIST.includes(type)) {
    throw new Error(t('Unknown permission type.'));
  }

  const config = windowRegistry.config;
  if (isPermissionGranted(config, type)) {
    return true;
  }

  const actionLabel = context.actionLabel || getPermissionLabel(type);
  const source = context.source || actionLabel;
  const browserWindow = context.browserWindow || getDialogParent(windowRegistry);

  const result = await dialog.showMessageBox(browserWindow || undefined, {
    type: 'question',
    buttons: [t('Allow'), t('Deny')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: t('Permission required'),
    message: t('%(action)s requires access to %(permission)s.', {
      action: actionLabel,
      permission: getPermissionLabel(type),
    }),
    detail: t(
      'Allow this app to use %(permission)s access? You can change this later in Settings → Permissions.',
      { permission: getPermissionLabel(type) },
    ),
  });

  if (result.response !== 0) {
    appLogger.add(
      'warn',
      'permissions',
      t('Permission denied: %(permission)s', { permission: getPermissionLabel(type) }),
      source,
    );
    throw new Error(
      t('Permission denied: %(permission)s', { permission: getPermissionLabel(type) }),
    );
  }

  grantPermission(windowRegistry, type, source);
  return true;
}

function grantAllPermissions(windowRegistry, source) {
  const now = new Date().toISOString();
  const permissions = {
    printers: true,
    devices: true,
    camera: true,
    files: true,
  };
  const permissionsGrantedAt = {
    printers: now,
    devices: now,
    camera: now,
    files: now,
  };
  saveUserConfig({ permissions, permissionsGrantedAt });
  windowRegistry.reloadConfig();
  windowRegistry.broadcastState();
  appLogger.add(
    'info',
    'permissions',
    t('All permissions enabled on first run'),
    `${source} · ${now}`,
  );
  return getPermissionsSnapshot(windowRegistry.config);
}

function declineFirstRunPermissions(windowRegistry) {
  saveUserConfig({ permissions: { ...DEFAULT_PERMISSIONS } });
  windowRegistry.reloadConfig();
  windowRegistry.broadcastState();
  appLogger.add('info', 'permissions', t('First-run permissions declined'), '');
}

async function runFirstRunPermissionsPrompt(windowRegistry) {
  if (!isFirstInstall()) {
    return false;
  }

  const browserWindow = getDialogParent(windowRegistry);
  const result = await dialog.showMessageBox(browserWindow || undefined, {
    type: 'question',
    buttons: [t('Enable all'), t('Not now')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: t('App permissions'),
    message: t('Enable hardware and file permissions for this app?'),
    detail: t(
      'Includes printer, device, camera, and file access. You can change each permission later in Settings → Permissions.',
    ),
  });

  if (result.response === 0) {
    grantAllPermissions(windowRegistry, 'first-run');
    return true;
  }

  declineFirstRunPermissions(windowRegistry);
  return false;
}

function isCameraPermission(permission) {
  return permission === 'media' || permission === 'camera' || permission === 'videoCapture';
}

module.exports = {
  PERMISSION_TYPES,
  PERMISSION_TYPE_LIST,
  DEFAULT_PERMISSIONS,
  normalizePermissions,
  getPermissionLabel,
  getPermissionsSnapshot,
  isPermissionGranted,
  getDialogParent,
  grantPermission,
  grantAllPermissions,
  setUserPermission,
  ensurePermission,
  runFirstRunPermissionsPrompt,
  isCameraPermission,
};
