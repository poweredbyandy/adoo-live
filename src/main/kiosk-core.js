const { buildGetScript } = require('../shared/kiosk-page-fetch');
const { APP_VERSION } = require('./kiosk-compatibility');

async function fetchKioskManifest(webContents, appVersion = APP_VERSION) {
  if (!webContents || webContents.isDestroyed()) {
    return null;
  }
  const path = `/pba_kiosk/manifest?app_version=${encodeURIComponent(appVersion)}`;
  try {
    const result = await webContents.executeJavaScript(buildGetScript(path), true);
    if (!result?.ok) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

async function fetchDeviceSpec(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return null;
  }
  try {
    const result = await webContents.executeJavaScript(
      buildGetScript('/pba_kiosk/device/spec'),
      true,
    );
    if (!result?.ok) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

function getRequiredPlugins(manifest) {
  const plugins = Array.isArray(manifest?.plugins) ? manifest.plugins : [];
  return {
    core: plugins.find((plugin) => plugin.electron_package === '@pba/kiosk-core'),
    devices: plugins.find((plugin) => plugin.electron_package === '@pba/kiosk-devices'),
    printing: plugins.find((plugin) => plugin.electron_package === '@pba/kiosk-printing'),
  };
}

module.exports = {
  APP_VERSION,
  fetchDeviceSpec,
  fetchKioskManifest,
  getRequiredPlugins,
};
