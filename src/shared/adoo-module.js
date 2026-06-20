const ADOO_MODULE_FOLDER = 'adoo_module';
const MANIFEST_FILE = 'manifest.json';

function getOriginFromUrl(pageUrl) {
  try {
    const parsed = new URL(pageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function buildAdooModuleManifestUrl(origin) {
  if (!origin) {
    return null;
  }
  return `${origin}/${ADOO_MODULE_FOLDER}/${MANIFEST_FILE}`;
}

function buildAdooModuleAssetUrl(origin, relativePath) {
  if (!origin || !relativePath) {
    return null;
  }
  const normalized = String(relativePath).replace(/^\/+/, '');
  return `${origin}/${ADOO_MODULE_FOLDER}/${normalized}`;
}

function getOriginStorageKey(origin) {
  if (!origin) {
    return null;
  }
  try {
    const parsed = new URL(origin);
    let key = parsed.hostname;
    const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
    if (parsed.port && parsed.port !== defaultPort) {
      key += `-${parsed.port}`;
    }
    return key.replace(/[^a-zA-Z0-9._-]/g, '_');
  } catch {
    return null;
  }
}

function isSafeRelativeAssetPath(relativePath) {
  const value = String(relativePath || '').trim();
  if (!value || value === MANIFEST_FILE) {
    return false;
  }
  if (value.startsWith('/') || value.includes('\\')) {
    return false;
  }
  const segments = value.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}

function normalizeManifestEntry(entry) {
  if (typeof entry === 'string') {
    const path = entry.trim();
    if (!isSafeRelativeAssetPath(path)) {
      return null;
    }
    return { path };
  }
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const path = String(entry.path || '').trim();
  if (!isSafeRelativeAssetPath(path)) {
    return null;
  }
  const sha256 = entry.sha256 ? String(entry.sha256).trim().toLowerCase() : null;
  return sha256 ? { path, sha256 } : { path };
}

function normalizeAdooModuleManifest(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const version = String(raw.version || '').trim();
  if (!version) {
    return null;
  }
  const files = [];
  const source = Array.isArray(raw.files) ? raw.files : (Array.isArray(raw.assets) ? raw.assets : []);
  for (const entry of source) {
    const normalized = normalizeManifestEntry(entry);
    if (normalized) {
      files.push(normalized);
    }
  }
  return { version, files };
}

function isAdooModuleCacheCurrent(localManifest, remoteManifest) {
  if (!localManifest || !remoteManifest) {
    return false;
  }
  return String(localManifest.version) === String(remoteManifest.version);
}

module.exports = {
  ADOO_MODULE_FOLDER,
  MANIFEST_FILE,
  buildAdooModuleAssetUrl,
  buildAdooModuleManifestUrl,
  getOriginFromUrl,
  getOriginStorageKey,
  isAdooModuleCacheCurrent,
  isSafeRelativeAssetPath,
  normalizeAdooModuleManifest,
};
