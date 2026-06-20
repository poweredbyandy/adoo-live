const { execFile } = require('child_process');
const crypto = require('crypto');
const { Notification, app } = require('electron');
const { APP_DISPLAY_NAME } = require('../shared/constants');
const { getAppIconPath } = require('./app-icon');
const { appLogger } = require('./logger');

let clickHandler = null;
const activeNotifications = new Map();

function setNotificationClickHandler(handler) {
  clickHandler = handler;
}

function releaseNotification(id) {
  activeNotifications.delete(id);
}

function showMacOsScriptNotification(title, body) {
  const safeTitle = String(title).slice(0, 200);
  const safeBody = String(body).slice(0, 500);
  const script = `display notification ${JSON.stringify(safeBody)} with title ${JSON.stringify(safeTitle)}`;
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ shown: true, via: 'osascript' });
    });
  });
}

function buildDownloadNotification(entry, state) {
  const filename = entry?.filename || 'Archivo';
  if (state === 'completed') {
    return {
      title: 'Descarga completada',
      body: filename,
      action: 'open-downloads',
    };
  }
  if (state === 'cancelled') {
    return {
      title: 'Descarga cancelada',
      body: filename,
      silent: true,
    };
  }
  if (state === 'interrupted') {
    return {
      title: 'Descarga interrumpida',
      body: filename,
    };
  }
  return null;
}

function handleNotificationClick(payload) {
  if (clickHandler && payload.action) {
    clickHandler(payload.action);
    return;
  }
  if (clickHandler) {
    clickHandler('focus');
  }
}

async function showNativeFallback(title, body, payload, reason) {
  if (process.platform !== 'darwin') {
    return { shown: false, reason };
  }
  try {
    const result = await showMacOsScriptNotification(title, body);
    appLogger.add('info', 'notify', title, `${body || ''} | fallback=osascript`);
    return result;
  } catch (error) {
    appLogger.add('error', 'notify', 'Fallback osascript falló', error.message);
    return { shown: false, reason: error.message };
  }
}

function showNotification(payload = {}) {
  if (!Notification.isSupported()) {
    appLogger.add('warn', 'notify', 'Notificaciones no soportadas en este sistema');
    return showNativeFallback(
      String(payload.title || APP_DISPLAY_NAME),
      String(payload.body || ''),
      payload,
      'unsupported',
    );
  }

  const title = String(payload.title || APP_DISPLAY_NAME).trim() || APP_DISPLAY_NAME;
  const body = String(payload.body || '').trim();
  const silent = Boolean(payload.silent);
  const id = crypto.randomUUID();

  if (process.platform === 'darwin' && app && !app.isPackaged) {
    appLogger.add('info', 'notify', title, body || undefined);
    return showNativeFallback(title, body, payload, 'development');
  }

  const notification = new Notification({
    title,
    body,
    silent,
    icon: getAppIconPath(),
  });

  activeNotifications.set(id, notification);

  const cleanup = () => {
    releaseNotification(id);
  };

  const timeoutId = setTimeout(cleanup, 120000);

  const finalize = () => {
    clearTimeout(timeoutId);
    cleanup();
  };

  notification.on('click', () => {
    handleNotificationClick(payload);
    finalize();
  });

  notification.on('close', finalize);

  notification.on('failed', (_event, error) => {
    const message = String(error || '');
    appLogger.add('error', 'notify', 'No se pudo mostrar notificación', message);
    finalize();
    showNativeFallback(title, body, payload, message);
  });

  notification.show();
  appLogger.add('info', 'notify', title, body || undefined);
  return { shown: true };
}

function showDownloadNotification(entry, state) {
  const payload = buildDownloadNotification(entry, state);
  if (!payload) {
    return { shown: false };
  }
  return showNotification(payload);
}

module.exports = {
  setNotificationClickHandler,
  buildDownloadNotification,
  showNotification,
  showDownloadNotification,
  showMacOsScriptNotification,
  releaseNotification,
  activeNotifications,
};
