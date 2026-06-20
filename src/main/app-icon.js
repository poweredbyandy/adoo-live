const path = require('path');
const { app, nativeImage } = require('electron');

const ICON_FILE_NAME = 'icon.png';

function getAppIconPath() {
  return path.join(app.getAppPath(), ICON_FILE_NAME);
}

function getAppIcon() {
  const image = nativeImage.createFromPath(getAppIconPath());
  if (image.isEmpty()) {
    return null;
  }
  return image;
}

function getAppIconUrl() {
  const iconPath = getAppIconPath();
  return `file://${iconPath}`;
}

function applyAppIcon() {
  const icon = getAppIcon();
  if (!icon) {
    return;
  }
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon);
  }
}

module.exports = {
  ICON_FILE_NAME,
  applyAppIcon,
  getAppIcon,
  getAppIconPath,
  getAppIconUrl,
};
