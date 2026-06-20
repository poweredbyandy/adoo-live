const { TITLEBAR_HEIGHT, CHROME_BG, CHROME_SYMBOL } = require('../shared/constants');

function getTitleBarOverlay() {
  return {
    color: CHROME_BG,
    symbolColor: CHROME_SYMBOL,
    height: TITLEBAR_HEIGHT,
  };
}

function getBrowserWindowOptions() {
  const overlay = getTitleBarOverlay();

  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
    };
  }

  if (process.platform === 'win32' || process.platform === 'linux') {
    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: overlay,
    };
  }

  return {};
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
