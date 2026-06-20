const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, net } = require('electron');
const { getOdooSession } = require('./session');
const { buildGetScript } = require('../shared/kiosk-page-fetch');
const {
  ADOO_MODULE_FOLDER,
  MANIFEST_FILE,
  buildAdooModuleAssetUrl,
  buildAdooModuleManifestUrl,
  getOriginStorageKey,
  isAdooModuleCacheCurrent,
  normalizeAdooModuleManifest,
} = require('../shared/adoo-module');
const { getOriginFromUrl } = require('../shared/kiosk-compatibility');
const { appLogger } = require('./logger');
const { t } = require('../i18n');
const { getSystemInfo } = require('./system-info-service');

const BOOTSTRAP_FILES = ['main.js', 'index.js', 'bootstrap.js'];
const syncInFlight = new Map();
const loadedRuntimes = new Map();

function getAdooModulesRoot() {
  return path.join(app.getPath('userData'), 'adoo-modules');
}

function getAdooModuleRoot(origin) {
  const key = getOriginStorageKey(origin);
  if (!key) {
    return null;
  }
  return path.join(getAdooModulesRoot(), key);
}

function readLocalManifest(origin) {
  const root = getAdooModuleRoot(origin);
  if (!root) {
    return null;
  }
  const manifestPath = path.join(root, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return normalizeAdooModuleManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  } catch {
    return null;
  }
}

function getSessionFetch() {
  const odooSession = getOdooSession();
  if (typeof odooSession.fetch === 'function') {
    return odooSession.fetch.bind(odooSession);
  }
  return net.fetch.bind(net);
}

async function fetchRemoteManifestFromWebContents(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return null;
  }
  const pageUrl = webContents.getURL();
  const origin = getOriginFromUrl(pageUrl);
  if (!origin) {
    return null;
  }
  try {
    const result = await webContents.executeJavaScript(
      buildGetScript(`/${ADOO_MODULE_FOLDER}/${MANIFEST_FILE}`),
      true,
    );
    if (result?.ok && result.data) {
      const manifest = normalizeAdooModuleManifest(result.data);
      if (manifest) {
        return { origin, manifest };
      }
    }
  } catch {
    void 0;
  }
  return fetchRemoteManifestFromOrigin(origin);
}

async function fetchRemoteManifestFromOrigin(origin) {
  const url = buildAdooModuleManifestUrl(origin);
  if (!url) {
    return null;
  }
  try {
    const response = await getSessionFetch()(url, {
      method: 'GET',
      bypassCustomProtocolHandlers: true,
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const manifest = normalizeAdooModuleManifest(data);
    if (!manifest) {
      return null;
    }
    return { origin, manifest };
  } catch {
    return null;
  }
}

async function fetchAssetBuffer(origin, relativePath) {
  const url = buildAdooModuleAssetUrl(origin, relativePath);
  if (!url) {
    throw new Error(`Invalid asset path: ${relativePath}`);
  }
  const response = await getSessionFetch()(url, {
    method: 'GET',
    bypassCustomProtocolHandlers: true,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${relativePath}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function verifyAssetBuffer(buffer, expectedSha256) {
  if (!expectedSha256) {
    return true;
  }
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  return digest === expectedSha256.toLowerCase();
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeAssetFile(targetRoot, relativePath, buffer) {
  const filePath = path.join(targetRoot, relativePath);
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
}

function removeDirectory(dirPath) {
  if (dirPath && fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function unloadModuleRuntime(origin) {
  const root = getAdooModuleRoot(origin);
  if (!root) {
    return;
  }
  for (const name of BOOTSTRAP_FILES) {
    const fullPath = path.join(root, name);
    if (require.cache[fullPath]) {
      delete require.cache[fullPath];
    }
  }
  loadedRuntimes.delete(origin);
}

function loadModuleRuntime(origin) {
  const root = getAdooModuleRoot(origin);
  if (!root || !fs.existsSync(root)) {
    return null;
  }
  unloadModuleRuntime(origin);
  for (const name of BOOTSTRAP_FILES) {
    const fullPath = path.join(root, name);
    if (!fs.existsSync(fullPath)) {
      continue;
    }
    const moduleExports = require(fullPath);
    const runtimeContext = {
      origin,
      moduleRoot: root,
      system: getSystemInfo(),
    };
    if (typeof moduleExports.adooInit === 'function') {
      moduleExports.adooInit(runtimeContext);
    }
    loadedRuntimes.set(origin, { root, entry: fullPath, exports: moduleExports, context: runtimeContext });
    return moduleExports;
  }
  return null;
}

async function downloadAdooModuleAssets(origin, manifest, targetRoot) {
  const stagingRoot = `${targetRoot}.staging-${process.pid}-${Date.now()}`;
  ensureDirectory(stagingRoot);

  try {
    for (const asset of manifest.files) {
      const buffer = await fetchAssetBuffer(origin, asset.path);
      if (!verifyAssetBuffer(buffer, asset.sha256)) {
        throw new Error(`Checksum mismatch for ${asset.path}`);
      }
      writeAssetFile(stagingRoot, asset.path, buffer);
    }
    const manifestBuffer = Buffer.from(JSON.stringify({
      version: manifest.version,
      files: manifest.files,
    }), 'utf8');
    writeAssetFile(stagingRoot, MANIFEST_FILE, manifestBuffer);

    removeDirectory(targetRoot);
    fs.renameSync(stagingRoot, targetRoot);
    return true;
  } catch (error) {
    removeDirectory(stagingRoot);
    throw error;
  }
}

async function syncAdooModuleFromWebContents(webContents, options = {}) {
  if (!webContents || webContents.isDestroyed()) {
    return { skipped: true, reason: 'no_web_contents' };
  }
  const pageUrl = webContents.getURL();
  const origin = getOriginFromUrl(pageUrl);
  if (!origin) {
    return { skipped: true, reason: 'invalid_origin' };
  }

  const force = Boolean(options.force);
  const inFlightKey = `${origin}:${force ? 'force' : 'normal'}`;
  if (syncInFlight.has(inFlightKey)) {
    return syncInFlight.get(inFlightKey);
  }

  const task = (async () => {
    const remote = await fetchRemoteManifestFromWebContents(webContents);
    if (!remote?.manifest) {
      return { skipped: true, reason: 'no_manifest', origin };
    }

    const targetRoot = getAdooModuleRoot(origin);
    if (!targetRoot) {
      return { skipped: true, reason: 'invalid_origin', origin };
    }

    const localManifest = force ? null : readLocalManifest(origin);
    if (!force && isAdooModuleCacheCurrent(localManifest, remote.manifest)) {
      return { skipped: true, reason: 'up_to_date', origin, version: remote.manifest.version };
    }

    try {
      await downloadAdooModuleAssets(origin, remote.manifest, targetRoot);
      unloadModuleRuntime(origin);
      const runtime = loadModuleRuntime(origin);
      appLogger.add(
        'info',
        'adoo-module',
        t('Odoo module assets updated'),
        origin,
        remote.manifest.version,
      );
      return {
        synced: true,
        origin,
        version: remote.manifest.version,
        runtimeLoaded: Boolean(runtime),
      };
    } catch (error) {
      appLogger.add('error', 'adoo-module', t('Odoo module assets sync failed'), origin, error.message);
      return { error: error.message, origin };
    }
  })();

  syncInFlight.set(inFlightKey, task);
  try {
    return await task;
  } finally {
    syncInFlight.delete(inFlightKey);
  }
}

function clearAdooModuleCacheForOrigin(origin) {
  unloadModuleRuntime(origin);
  const root = getAdooModuleRoot(origin);
  removeDirectory(root);
}

function clearAllAdooModuleCaches() {
  for (const origin of loadedRuntimes.keys()) {
    unloadModuleRuntime(origin);
  }
  removeDirectory(getAdooModulesRoot());
}

async function regenerateAdooModuleAssets(windowRegistry) {
  clearAllAdooModuleCaches();
  const tasks = [];
  for (const manager of windowRegistry.getAll()) {
    for (const tab of manager.tabs || []) {
      if (!tab.kioskCompatible || !tab.view?.webContents) {
        continue;
      }
      const webContents = tab.view.webContents;
      if (webContents.isDestroyed()) {
        continue;
      }
      tasks.push(syncAdooModuleFromWebContents(webContents, { force: true }));
    }
  }
  const results = await Promise.all(tasks);
  return {
    regenerated: true,
    origins: results.filter((item) => item?.synced).map((item) => item.origin),
    results,
  };
}

module.exports = {
  clearAdooModuleCacheForOrigin,
  clearAllAdooModuleCaches,
  getAdooModuleRoot,
  loadModuleRuntime,
  regenerateAdooModuleAssets,
  syncAdooModuleFromWebContents,
  unloadModuleRuntime,
};
