const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { isValidMode } = require('../shared/validators');

const DEFAULTS = {
  baseUrl: null,
  defaultMode: 'free',
  kioskAllowedHosts: ['localhost', '127.0.0.1'],
  maxTabs: 10,
  developerPin: null,
  lastMode: null,
  instances: [],
  defaultInstanceId: null,
  uiLanguage: 'en',
  downloadPath: null,
  permissions: {
    printers: false,
    devices: false,
    camera: false,
    files: false,
  },
  permissionsGrantedAt: {},
};

function getUserConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function isFirstInstall() {
  return !fs.existsSync(getUserConfigPath());
}

function getConfigPath() {
  const userConfig = getUserConfigPath();
  if (fs.existsSync(userConfig)) {
    return userConfig;
  }
  return path.join(app.getAppPath(), 'config.default.json');
}

function resolveStartupMode(config) {
  if (isValidMode(config.lastMode)) {
    return config.lastMode;
  }
  if (isValidMode(config.defaultMode)) {
    return config.defaultMode;
  }
  return DEFAULTS.defaultMode;
}

function loadConfig() {
  const { resolveInstancesConfig } = require('./instances');
  const usingDefaultFile = !fs.existsSync(getUserConfigPath());
  try {
    const configPath = getConfigPath();
    const raw = fs.readFileSync(configPath, 'utf8');
    const merged = resolveInstancesConfig(
      { ...DEFAULTS, ...JSON.parse(raw) },
      { usingDefaultFile },
    );
    return {
      ...merged,
      startupMode: resolveStartupMode(merged),
    };
  } catch {
    return resolveInstancesConfig({
      ...DEFAULTS,
      startupMode: DEFAULTS.defaultMode,
    }, { usingDefaultFile: true });
  }
}

function saveUserConfig(patch) {
  const userPath = getUserConfigPath();
  let existing = {};
  try {
    if (fs.existsSync(userPath)) {
      existing = JSON.parse(fs.readFileSync(userPath, 'utf8'));
    }
  } catch {
    existing = {};
  }
  const next = { ...existing, ...patch };
  fs.mkdirSync(path.dirname(userPath), { recursive: true });
  fs.writeFileSync(userPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function saveLastMode(mode) {
  if (!isValidMode(mode)) {
    return null;
  }
  return saveUserConfig({ lastMode: mode });
}

module.exports = {
  loadConfig,
  getConfigPath,
  getUserConfigPath,
  isFirstInstall,
  resolveStartupMode,
  saveUserConfig,
  saveLastMode,
  DEFAULTS,
};
