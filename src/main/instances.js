const { randomBytes } = require('crypto');
const { extractInstance } = require('./history-store');

const FALLBACK_BASE_URL = 'http://localhost:8069';

let persistHandler = null;

function getConfigApi() {
  return require('./config');
}

function setPersistHandler(handler) {
  persistHandler = handler;
}

function createInstanceId() {
  return `inst-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function normalizeInstanceInput(urlString) {
  const trimmed = String(urlString || '').trim();
  if (!trimmed) {
    return null;
  }
  const withProtocol = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  return extractInstance(withProtocol);
}

function sanitizeInstanceEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const id = String(entry.id || '').trim();
  const label = String(entry.label || '').trim();
  const baseUrl = String(entry.baseUrl || '').trim();
  const parsed = extractInstance(baseUrl);
  if (!id || !parsed) {
    return null;
  }
  return {
    id,
    label: label || parsed.label || parsed.host,
    baseUrl: parsed.baseUrl,
    host: parsed.host,
    origin: parsed.origin,
  };
}

function shouldSeedInstanceFromBaseUrl(config, usingDefaultFile) {
  if (usingDefaultFile) {
    return false;
  }
  const baseUrl = String(config.baseUrl || '').trim();
  if (!baseUrl) {
    return false;
  }
  const seed = extractInstance(baseUrl);
  if (!seed) {
    return false;
  }
  const defaultLocal = extractInstance(FALLBACK_BASE_URL);
  if (defaultLocal && seed.origin === defaultLocal.origin) {
    return false;
  }
  return true;
}

function resolveInstancesConfig(config, options = {}) {
  const usingDefaultFile = Boolean(options.usingDefaultFile);
  const merged = { ...config };
  let instances = Array.isArray(merged.instances)
    ? merged.instances.map(sanitizeInstanceEntry).filter(Boolean)
    : [];

  if (!instances.length && shouldSeedInstanceFromBaseUrl(merged, usingDefaultFile)) {
    const seed = extractInstance(merged.baseUrl);
    if (seed) {
      const id = createInstanceId();
      instances = [{
        id,
        label: seed.label,
        baseUrl: seed.baseUrl,
        host: seed.host,
        origin: seed.origin,
      }];
      merged.defaultInstanceId = id;
    }
  }

  merged.instances = instances;
  if (!instances.length) {
    merged.defaultInstanceId = null;
    merged.baseUrl = null;
  } else {
    const knownIds = new Set(instances.map((item) => item.id));
    if (!knownIds.has(merged.defaultInstanceId)) {
      merged.defaultInstanceId = instances[0]?.id || null;
    }
    merged.baseUrl = getDefaultBaseUrl(merged);
  }
  return merged;
}

function getDefaultBaseUrl(config) {
  const instances = Array.isArray(config?.instances) ? config.instances : [];
  if (!instances.length) {
    return '';
  }
  const selected = instances.find((item) => item.id === config?.defaultInstanceId);
  if (selected?.baseUrl) {
    return selected.baseUrl;
  }
  if (instances[0]?.baseUrl) {
    return instances[0].baseUrl;
  }
  return config?.baseUrl || '';
}

function getInstancesSnapshot(config) {
  const resolved = resolveInstancesConfig(config || {});
  return {
    items: resolved.instances,
    defaultInstanceId: resolved.defaultInstanceId,
    defaultBaseUrl: getDefaultBaseUrl(resolved) || null,
  };
}

function persistInstances(instances, defaultInstanceId) {
  const { saveUserConfig } = getConfigApi();
  const items = instances.map(sanitizeInstanceEntry).filter(Boolean);
  const knownIds = new Set(items.map((item) => item.id));
  const nextDefaultId = knownIds.has(defaultInstanceId) ? defaultInstanceId : (items[0]?.id || null);
  const defaultBaseUrl = items.find((item) => item.id === nextDefaultId)?.baseUrl
    || items[0]?.baseUrl
    || null;

  const patch = {
    instances: items.map(({ id, label, baseUrl, host, origin }) => ({
      id,
      label,
      baseUrl,
      host,
      origin,
    })),
    defaultInstanceId: nextDefaultId,
    baseUrl: defaultBaseUrl,
  };

  if (persistHandler) {
    persistHandler(patch);
  } else {
    getConfigApi().saveUserConfig(patch);
  }

  return getInstancesSnapshot({ instances: items, defaultInstanceId: nextDefaultId, baseUrl: defaultBaseUrl });
}

function loadInstancesFromConfig(config) {
  return resolveInstancesConfig(config).instances;
}

function addInstance(config, label, url) {
  const parsed = normalizeInstanceInput(url);
  if (!parsed) {
    throw new Error('URL de instancia no válida');
  }
  const instances = loadInstancesFromConfig(config);
  const duplicate = instances.find((item) => item.origin === parsed.origin);
  if (duplicate) {
    throw new Error('Ya existe una instancia con ese dominio');
  }
  const entry = {
    id: createInstanceId(),
    label: String(label || '').trim() || parsed.label || parsed.host,
    baseUrl: parsed.baseUrl,
    host: parsed.host,
    origin: parsed.origin,
  };
  const defaultInstanceId = config.defaultInstanceId || entry.id;
  return persistInstances([entry, ...instances], defaultInstanceId);
}

function updateInstance(config, id, patch = {}) {
  const instances = loadInstancesFromConfig(config);
  const index = instances.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error('Instancia no encontrada');
  }
  const current = instances[index];
  const nextUrl = patch.url !== undefined ? patch.url : current.baseUrl;
  const parsed = normalizeInstanceInput(nextUrl);
  if (!parsed) {
    throw new Error('URL de instancia no válida');
  }
  const duplicate = instances.find((item, itemIndex) => itemIndex !== index && item.origin === parsed.origin);
  if (duplicate) {
    throw new Error('Ya existe una instancia con ese dominio');
  }
  instances[index] = {
    ...current,
    label: String(patch.label !== undefined ? patch.label : current.label).trim() || parsed.label,
    baseUrl: parsed.baseUrl,
    host: parsed.host,
    origin: parsed.origin,
  };
  return persistInstances(instances, config.defaultInstanceId);
}

function removeInstance(config, id) {
  const instances = loadInstancesFromConfig(config).filter((item) => item.id !== id);
  if (!instances.length) {
    return persistInstances([], null);
  }
  const defaultInstanceId = config.defaultInstanceId === id ? instances[0].id : config.defaultInstanceId;
  return persistInstances(instances, defaultInstanceId);
}

function setDefaultInstance(config, id) {
  const instances = loadInstancesFromConfig(config);
  if (!instances.some((item) => item.id === id)) {
    throw new Error('Instancia no encontrada');
  }
  return persistInstances(instances, id);
}

module.exports = {
  createInstanceId,
  normalizeInstanceInput,
  resolveInstancesConfig,
  getDefaultBaseUrl,
  getInstancesSnapshot,
  addInstance,
  updateInstance,
  removeInstance,
  setDefaultInstance,
  setPersistHandler,
};
