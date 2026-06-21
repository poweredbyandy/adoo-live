const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { t } = require('../i18n');

const OVERLAY_WIDTH = 296;
const OVERLAY_HEIGHT = 228;

let overlayWindow = null;

function getOverlayBounds() {
  const display = screen.getPrimaryDisplay();
  return {
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: Math.round(display.bounds.x + (display.workAreaSize.width - OVERLAY_WIDTH) / 2),
    y: Math.round(display.bounds.y + (display.workAreaSize.height - OVERLAY_HEIGHT) / 2),
  };
}

function showUpdateOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
    return overlayWindow;
  }

  const bounds = getOverlayBounds();
  overlayWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    hasShadow: true,
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
