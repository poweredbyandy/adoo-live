const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { t } = require('../i18n');

let overlayWindow = null;

function showUpdateOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
    return overlayWindow;
  }

  const display = screen.getPrimaryDisplay();
  overlayWindow = new BrowserWindow({
    width: display.workAreaSize.width,
    height: display.workAreaSize.height,
    x: display.bounds.x,
    y: display.bounds.y,
    frame: false,
    backgroundColor: '#202225',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    fullscreen: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  overlayWindow.setMenu(null);
  overlayWindow.loadFile(path.join(__dirname, '../renderer/update-overlay.html'), {
    query: {
      title: t('Updating adoo IoT...'),
      detail: t('Please wait while the update is installed.'),
    },
  });
  overlayWindow.once('ready-to-show', () => {
    if (!overlayWindow.isDestroyed()) {
      overlayWindow.show();
    }
  });
  return overlayWindow;
}

module.exports = {
  showUpdateOverlay,
};
