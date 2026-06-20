const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getSystemDownloadPath() {
  return app.getPath('downloads');
}

function getEffectiveDownloadPath(config) {
  const custom = String(config?.downloadPath || '').trim();
  if (custom && fs.existsSync(custom)) {
    return custom;
  }
  return getSystemDownloadPath();
}

function resolveDownloadSavePath(config, filename) {
  const safeName = String(filename || 'download').replace(/[/\\]/g, '_');
  const directory = getEffectiveDownloadPath(config);
  return path.join(directory, safeName);
}

function getDownloadFolderInfo(config) {
  const custom = String(config?.downloadPath || '').trim();
  const systemPath = getSystemDownloadPath();
  if (custom) {
    return {
      path: custom,
      isCustom: true,
      systemPath,
    };
  }
  return {
    path: systemPath,
    isCustom: false,
    systemPath,
  };
}

module.exports = {
  getSystemDownloadPath,
  getEffectiveDownloadPath,
  resolveDownloadSavePath,
  getDownloadFolderInfo,
};
