const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getAppCacheDir } = require('electron-updater/out/AppAdapter');

function readUpdaterCacheDirName() {
  if (!app?.isPackaged) {
    return `${app?.getName?.() || 'adoo IoT'}-updater`;
  }
  const configPath = path.join(process.resourcesPath, 'app-update.yml');
  if (!fs.existsSync(configPath)) {
    return `${app.getName()}-updater`;
  }
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const match = content.match(/^updaterCacheDirName:\s*(.+)$/m);
    if (!match) {
      return `${app.getName()}-updater`;
    }
    return match[1].trim().replace(/^['"]|['"]$/g, '');
  } catch {
    return `${app.getName()}-updater`;
  }
}

function getUpdaterCacheInfo(options = {}) {
  const cacheDirName = options.cacheDirName || readUpdaterCacheDirName();
  const baseCachePath = options.baseCachePath || getAppCacheDir();
  const cachePath = path.join(baseCachePath, cacheDirName);
  const pendingPath = path.join(cachePath, 'pending');
  return {
    available: Boolean(app?.isPackaged),
    cacheDirName,
    cachePath,
    pendingPath,
    hasPendingUpdate: hasPendingUpdateDownload(pendingPath),
  };
}

function hasPendingUpdateDownload(pendingPath) {
  const infoPath = path.join(pendingPath, 'update-info.json');
  if (!fs.existsSync(infoPath)) {
    return false;
  }
  try {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    if (!info?.fileName) {
      return false;
    }
    return fs.existsSync(path.join(pendingPath, info.fileName));
  } catch {
    return false;
  }
}

function emptyDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    fs.rmSync(path.join(dirPath, entry.name), { recursive: true, force: true });
  }
}

async function cleanupStaleUpdaterCache(options = {}) {
  if (!options.baseCachePath && !app?.isPackaged) {
    return { cleaned: false, reason: 'development' };
  }
  if (options.preservePending !== false) {
    const info = getUpdaterCacheInfo({
      baseCachePath: options.baseCachePath,
      cacheDirName: options.cacheDirName,
    });
    if (info.hasPendingUpdate) {
      return { cleaned: false, reason: 'pending_update', pendingPath: info.pendingPath };
    }
  }
  if (options.preserveActiveDownload) {
    return { cleaned: false, reason: 'active_download' };
  }

  const { cachePath, pendingPath } = getUpdaterCacheInfo({
    baseCachePath: options.baseCachePath,
    cacheDirName: options.cacheDirName,
  });
  const hadPendingDir = fs.existsSync(pendingPath);
  emptyDirectory(pendingPath);

  let cleaned = hadPendingDir;
  const staleRootEntries = ['current.blockmap'];
  staleRootEntries.forEach((name) => {
    const entryPath = path.join(cachePath, name);
    if (fs.existsSync(entryPath)) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      cleaned = true;
    }
  });

  return {
    cleaned,
    reason: 'stale_cache',
    cachePath,
    pendingPath,
  };
}

module.exports = {
  cleanupStaleUpdaterCache,
  getUpdaterCacheInfo,
  hasPendingUpdateDownload,
  readUpdaterCacheDirName,
};
