const { app, BrowserWindow } = require('electron');
const { GITHUB_OWNER, GITHUB_REPO, fetchLatestRelease } = require('../shared/github-release');
const { compareVersions } = require('../shared/version-utils');
const { IPC } = require('../shared/ipc-channels');
const { appLogger } = require('./logger');
const { t } = require('../i18n');

let autoUpdater = null;
let progressListener = null;
let lastCheckResult = null;
let downloadPromise = null;

function getAutoUpdater() {
  if (!autoUpdater) {
    ({ autoUpdater } = require('electron-updater'));
  }
  return autoUpdater;
}

function setProgressListener(listener) {
  progressListener = typeof listener === 'function' ? listener : null;
}

function emitProgress(payload) {
  if (!progressListener) {
    return;
  }
  progressListener(payload);
}

function broadcastUpdateEvent(payload) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (window.isDestroyed()) {
      return;
    }
    window.webContents.send(IPC.UPDATE_EVENT, payload);
  });
}

function normalizeGithubCheck(currentVersion, release) {
  const updateAvailable = compareVersions(release.version, currentVersion) > 0;
  return {
    currentVersion,
    latestVersion: release.version,
    updateAvailable,
    upToDate: !updateAvailable,
    releaseUrl: release.releaseUrl,
    releaseNotes: release.releaseNotes,
    publishedAt: release.publishedAt,
    canAutoUpdate: app.isPackaged,
    source: 'github',
  };
}

async function checkForUpdatesViaGithub() {
  const currentVersion = app.getVersion();
  const release = await fetchLatestRelease();
  if (!release) {
    lastCheckResult = {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      upToDate: true,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      releaseNotes: '',
      publishedAt: '',
      canAutoUpdate: app.isPackaged,
      source: 'github',
      noReleasesPublished: true,
    };
    return lastCheckResult;
  }
  lastCheckResult = normalizeGithubCheck(currentVersion, release);
  return lastCheckResult;
}

function buildUpdateCheckError(currentVersion, error) {
  return {
    currentVersion,
    latestVersion: '',
    updateAvailable: false,
    upToDate: false,
    releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
    releaseNotes: '',
    publishedAt: '',
    canAutoUpdate: app.isPackaged,
    source: 'github',
    error: true,
    message: error.message || String(error),
  };
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();
  try {
    if (!app.isPackaged) {
      const result = await checkForUpdatesViaGithub();
      broadcastUpdateEvent({ phase: 'checked', ...result });
      return result;
    }

    const updater = getAutoUpdater();
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;

    const pending = await updater.checkForUpdates();
    const info = pending?.updateInfo;
    const latestVersion = String(info?.version || '').trim();
    if (!latestVersion) {
      return checkForUpdatesViaGithub();
    }
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    lastCheckResult = {
      currentVersion,
      latestVersion,
      updateAvailable,
      upToDate: !updateAvailable,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v${latestVersion}`,
      releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : '',
      publishedAt: info?.releaseDate || '',
      canAutoUpdate: true,
      source: 'auto-updater',
    };
    broadcastUpdateEvent({ phase: 'checked', ...lastCheckResult });
    return lastCheckResult;
  } catch (error) {
    appLogger.add('warn', 'update', t('Update check failed'), error.message);
    try {
      return await checkForUpdatesViaGithub();
    } catch (fallbackError) {
      lastCheckResult = buildUpdateCheckError(currentVersion, fallbackError);
      broadcastUpdateEvent({ phase: 'error', message: lastCheckResult.message });
      return lastCheckResult;
    }
  }
}

async function downloadUpdate() {
  const status = lastCheckResult || await checkForUpdates();
  if (!status.updateAvailable) {
    throw new Error(t('You are already on the latest version.'));
  }
  if (!app.isPackaged) {
    return {
      mode: 'manual',
      releaseUrl: status.releaseUrl,
    };
  }
  if (downloadPromise) {
    return downloadPromise;
  }
  emitProgress({ phase: 'downloading', percent: 0 });
  broadcastUpdateEvent({ phase: 'downloading', percent: 0 });
  downloadPromise = getAutoUpdater().downloadUpdate()
    .then(() => ({
      mode: 'auto',
      ready: true,
    }))
    .finally(() => {
      downloadPromise = null;
    });
  return downloadPromise;
}

function quitAndInstallUpdate() {
  if (!app.isPackaged) {
    throw new Error(t('Automatic installation is only available in the packaged app.'));
  }
  getAutoUpdater().quitAndInstall(false, true);
}

function initUpdateService() {
  if (!app.isPackaged) {
    return;
  }
  const updater = getAutoUpdater();
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;

  updater.on('checking-for-update', () => {
    broadcastUpdateEvent({ phase: 'checking' });
  });

  updater.on('update-available', (info) => {
    broadcastUpdateEvent({
      phase: 'available',
      latestVersion: info.version,
    });
  });

  updater.on('update-not-available', () => {
    broadcastUpdateEvent({ phase: 'not-available' });
  });

  updater.on('download-progress', (progress) => {
    const payload = {
      phase: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    };
    emitProgress(payload);
    broadcastUpdateEvent(payload);
  });

  updater.on('update-downloaded', (info) => {
    const payload = {
      phase: 'downloaded',
      latestVersion: info.version,
    };
    emitProgress(payload);
    broadcastUpdateEvent(payload);
  });

  updater.on('error', (error) => {
    const payload = {
      phase: 'error',
      message: error.message || String(error),
    };
    emitProgress(payload);
    broadcastUpdateEvent(payload);
    appLogger.add('error', 'update', payload.message);
  });
}

module.exports = {
  checkForUpdates,
  downloadUpdate,
  getLastCheckResult: () => lastCheckResult,
  initUpdateService,
  quitAndInstallUpdate,
  setProgressListener,
};
