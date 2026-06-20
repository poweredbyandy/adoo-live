const { buildPostScript } = require('../shared/kiosk-page-fetch');
const { getOriginFromUrl } = require('../shared/kiosk-compatibility');
const { getDeviceIdentity, getPrimaryNetworkInfo } = require('./device-identity');
const { getPrintersPayload } = require('./device-printers');
const { fingerprintPrinters } = require('./printer-service');
const { fetchDeviceSpec, fetchKioskManifest } = require('./kiosk-core');
const { startRemotePrinting, stopRemotePrinting } = require('./kiosk-printing-service');
const { appLogger } = require('./logger');
const { t } = require('../i18n');
const { loadConfig } = require('./config');
const { PERMISSION_TYPES, isPermissionGranted } = require('./permission-service');

const managers = new Map();

function getNetworkFingerprint() {
  const network = getPrimaryNetworkInfo();
  return `${network.mac_address}|${network.ip_address}`;
}

class KioskDeviceManager {
  constructor(webContents) {
    this.webContents = webContents;
    this.sessionActive = false;
    this.attached = false;
    this.networkFingerprint = getNetworkFingerprint();
    this.printersFingerprint = '';
    this.manifestLoaded = false;
    this.handleNavigation = () => {
      this.onNavigation().catch(() => {});
    };
  }

  attach() {
    if (this.attached || this.webContents.isDestroyed()) {
      this.onNavigation().catch(() => {});
      return;
    }
    this.attached = true;
    this.webContents.on('did-navigate', this.handleNavigation);
    this.webContents.on('did-finish-load', this.handleNavigation);
    this.onNavigation().catch(() => {});
  }

  detach({ disconnect = false, reason = 'session_end' } = {}) {
    if (this.attached) {
      this.webContents.removeListener('did-navigate', this.handleNavigation);
      this.webContents.removeListener('did-finish-load', this.handleNavigation);
      this.attached = false;
    }
    stopRemotePrinting(this.webContents);
    if (this.sessionActive) {
      this.sessionActive = false;
      if (disconnect) {
        this.sendDisconnect(reason).catch(() => {});
      }
    }
  }

  async onNavigation() {
    if (this.webContents.isDestroyed()) {
      return;
    }
    const hasSession = await this.hasActiveOdooSession();
    if (hasSession && !this.sessionActive) {
      this.sessionActive = true;
      await this.bootstrapSession();
      await this.sendHeartbeat('session_start');
      return;
    }
    if (!hasSession && this.sessionActive) {
      this.sessionActive = false;
      stopRemotePrinting(this.webContents);
      await this.sendDisconnect('session_end');
    }
    if (hasSession && this.sessionActive) {
      await this.checkNetworkChanged();
      await this.checkPrintersChanged();
    }
  }

  async bootstrapSession() {
    if (this.manifestLoaded) {
      startRemotePrinting(this.webContents, this.webContents.getURL());
      return;
    }
    const manifest = await fetchKioskManifest(this.webContents);
    await fetchDeviceSpec(this.webContents);
    if (manifest?.compatible) {
      this.manifestLoaded = true;
      startRemotePrinting(this.webContents, this.webContents.getURL());
    }
  }

  async hasActiveOdooSession() {
    const pageUrl = this.webContents.getURL();
    if (!pageUrl || pageUrl.startsWith('about:') || /\/web\/login(?:\?|$|\/)/.test(pageUrl)) {
      return false;
    }
    try {
      const cookies = await this.webContents.session.cookies.get({ url: pageUrl });
      return cookies.some((cookie) => cookie.name === 'session_id' && cookie.value);
    } catch {
      return false;
    }
  }

  async buildPayload() {
    const identity = getDeviceIdentity();
    const config = loadConfig();
    const printers = isPermissionGranted(config, PERMISSION_TYPES.PRINTERS)
      ? await getPrintersPayload(this.webContents)
      : [];
    return {
      device_uid: identity.device_uid,
      hostname: identity.hostname,
      mac_address: identity.mac_address,
      ip_address: identity.ip_address,
      app_version: identity.app_version,
      platform: identity.platform,
      os_version: identity.os_version,
      printers,
    };
  }

  async sendHeartbeat(reason) {
    const payload = await this.buildPayload();
    this.printersFingerprint = fingerprintPrinters(payload.printers);
    this.networkFingerprint = getNetworkFingerprint();
    const result = await this.webContents.executeJavaScript(
      buildPostScript('/pba_kiosk/device/heartbeat', payload),
      true,
    );
    if (result?.ok && result.data?.ok) {
      appLogger.add('info', 'kiosk-device', t('Device heartbeat sent'), reason, payload.hostname);
      return true;
    }
    const detail = result?.data?.error || result?.error || (result?.status ? `HTTP ${result.status}` : t('Unknown error'));
    appLogger.add('warn', 'kiosk-device', t('Device heartbeat failed'), reason, detail);
    if (result?.status === 401 || result?.status === 403) {
      this.sessionActive = false;
      stopRemotePrinting(this.webContents);
    }
    return false;
  }

  async sendDisconnect(reason) {
    const identity = getDeviceIdentity();
    const result = await this.webContents.executeJavaScript(
      buildPostScript('/pba_kiosk/device/disconnect', { device_uid: identity.device_uid }),
      true,
    );
    if (result?.ok && result.data?.ok !== false) {
      appLogger.add('info', 'kiosk-device', t('Device disconnected'), reason, identity.device_uid);
    }
    return result;
  }

  async checkNetworkChanged() {
    const nextFingerprint = getNetworkFingerprint();
    if (nextFingerprint === this.networkFingerprint) {
      return false;
    }
    this.networkFingerprint = nextFingerprint;
    await this.sendHeartbeat('network_changed');
    return true;
  }

  async checkPrintersChanged() {
    const config = loadConfig();
    if (!isPermissionGranted(config, PERMISSION_TYPES.PRINTERS)) {
      return false;
    }
    const printers = await getPrintersPayload(this.webContents);
    const nextFingerprint = fingerprintPrinters(printers);
    if (!this.printersFingerprint) {
      this.printersFingerprint = nextFingerprint;
      return false;
    }
    if (nextFingerprint === this.printersFingerprint) {
      return false;
    }
    this.printersFingerprint = nextFingerprint;
    await this.sendHeartbeat('printers_changed');
    return true;
  }
}

function getManagerKey(webContents) {
  return webContents?.id;
}

function attachKioskDeviceManager(webContents, compatible) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }
  const key = getManagerKey(webContents);
  if (!compatible) {
    const existing = managers.get(key);
    if (existing) {
      existing.detach({ disconnect: false });
      managers.delete(key);
    }
    return;
  }
  let manager = managers.get(key);
  if (!manager) {
    manager = new KioskDeviceManager(webContents);
    managers.set(key, manager);
    webContents.once('destroyed', () => {
      managers.delete(key);
    });
  }
  if (!manager.attached) {
    manager.attach();
  } else {
    manager.onNavigation().catch(() => {});
  }
}

function stopKioskDeviceSession(webContents) {
  const key = getManagerKey(webContents);
  const manager = managers.get(key);
  if (!manager) {
    stopRemotePrinting(webContents);
    return;
  }
  manager.detach({ disconnect: false });
  managers.delete(key);
}

async function disconnectAllKioskDevices() {
  const pending = [];
  const seenOrigins = new Set();
  for (const manager of managers.values()) {
    if (manager.webContents.isDestroyed()) {
      continue;
    }
    const origin = getOriginFromUrl(manager.webContents.getURL());
    if (origin && seenOrigins.has(origin)) {
      manager.detach({ disconnect: false });
      continue;
    }
    if (origin) {
      seenOrigins.add(origin);
    }
    pending.push((async () => {
      stopRemotePrinting(manager.webContents);
      await manager.sendDisconnect('app_close');
      manager.detach({ disconnect: false });
    })());
  }
  await Promise.all(pending);
  managers.clear();
}

async function notifyPrintersPossiblyChanged(webContents) {
  const manager = managers.get(getManagerKey(webContents));
  if (!manager || !manager.sessionActive) {
    return false;
  }
  return manager.checkPrintersChanged();
}

module.exports = {
  KioskDeviceManager,
  attachKioskDeviceManager,
  disconnectAllKioskDevices,
  getNetworkFingerprint,
  notifyPrintersPossiblyChanged,
  stopKioskDeviceSession,
};
