const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getOdooSession } = require('./session');
const { disconnectAllKioskDevices } = require('./kiosk-device-service');
const { closeAllSerialPorts } = require('./ipc/serial');
const { appLogger } = require('./logger');

async function clearOdooSessionData() {
  const odooSession = getOdooSession();
  await odooSession.clearStorageData();
  await odooSession.clearCache();
}

async function wipeUserDataDirectory(userDataPath) {
  if (!userDataPath || !fs.existsSync(userDataPath)) {
    return;
  }
  fs.rmSync(userDataPath, { recursive: true, force: true });
}

async function performFactoryReset() {
  const userDataPath = app.getPath('userData');

  await disconnectAllKioskDevices();
  closeAllSerialPorts();
  await clearOdooSessionData();
  appLogger.clear();
  await wipeUserDataDirectory(userDataPath);

  app.relaunch();
  app.quit();
}

module.exports = {
  performFactoryReset,
  wipeUserDataDirectory,
  clearOdooSessionData,
};
