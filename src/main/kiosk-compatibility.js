const { net } = require('electron');
const { getOdooSession } = require('./session');
const { buildCompatibilityCheckUrl, isNavigableOdooUrl } = require('../shared/kiosk-compatibility');

const APP_VERSION = require('../../package.json').version;

function buildCompatibilityProbeScript(appVersion) {
  const versionLiteral = JSON.stringify(String(appVersion));
  return `(async () => {
    try {
      const response = await fetch('/pba_kiosk/compatibility?app_version=' + encodeURIComponent(${versionLiteral}), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        return { compatible: false, status: response.status };
      }
      const data = await response.json();
      return {
        compatible: Boolean(data.compatible),
        status: response.status,
        odooVersion: data.odoo_version,
        kioskApiVersion: data.kiosk_api_version,
      };
    } catch (error) {
      return { compatible: false, error: String(error) };
    }
  })()`;
}

async function checkKioskCompatibilityFromWebContents(webContents, appVersion = APP_VERSION) {
  if (!webContents || webContents.isDestroyed()) {
    return null;
  }
  const pageUrl = webContents.getURL();
  if (!isNavigableOdooUrl(pageUrl)) {
    return null;
  }
  try {
    return await webContents.executeJavaScript(buildCompatibilityProbeScript(appVersion), true);
  } catch {
    return checkKioskCompatibility(pageUrl, appVersion);
  }
}

async function checkKioskCompatibility(pageUrl, appVersion = APP_VERSION) {
  const url = buildCompatibilityCheckUrl(pageUrl, appVersion);
  if (!url) {
    return null;
  }
  try {
    const odooSession = getOdooSession();
    const fetchImpl = typeof odooSession.fetch === 'function'
      ? odooSession.fetch.bind(odooSession)
      : net.fetch.bind(net);
    const response = await fetchImpl(url, {
      method: 'GET',
      bypassCustomProtocolHandlers: true,
    });
    if (!response.ok) {
      return { compatible: false, status: response.status };
    }
    const data = await response.json();
    return {
      compatible: Boolean(data.compatible),
      status: response.status,
      odooVersion: data.odoo_version,
      kioskApiVersion: data.kiosk_api_version,
    };
  } catch (error) {
    return { compatible: false, error: String(error) };
  }
}

module.exports = {
  APP_VERSION,
  buildCompatibilityProbeScript,
  checkKioskCompatibility,
  checkKioskCompatibilityFromWebContents,
};
