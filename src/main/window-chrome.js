const { TITLEBAR_HEIGHT, CHROME_BG, CHROME_SYMBOL } = require('../shared/constants');
const { getAppIconPath } = require('./app-icon');

function getTitleBarOverlay() {
  return {
    color: CHROME_BG,
    symbolColor: CHROME_SYMBOL,
    height: TITLEBAR_HEIGHT,
  };
}

function getBrowserWindowOptions() {
  const overlay = getTitleBarOverlay();
  const iconOption = { icon: getAppIconPath() };

  if (process.platform === 'darwin') {
    return {
      ...iconOption,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
    };
  }

  if (process.platform === 'win32' || process.platform === 'linux') {
    return {
      ...iconOption,
      titleBarStyle: 'hidden',
      titleBarOverlay: overlay,
    };
  }

  return iconOption;
}

function applyWindowChrome(browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) {
    return;
  }
  if (process.platform === 'win32' || process.platform === 'linux') {
    browserWindow.setTitleBarOverlay(getTitleBarOverlay());
  }
}

module.exports = {
  getBrowserWindowOptions,
  applyWindowChrome,
  getTitleBarOverlay,
};
