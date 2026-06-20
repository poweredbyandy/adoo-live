function canGoBack(webContents) {
  if (!webContents) {
    return false;
  }
  if (webContents.navigationHistory) {
    return webContents.navigationHistory.canGoBack();
  }
  return webContents.canGoBack();
}

function canGoForward(webContents) {
  if (!webContents) {
    return false;
  }
  if (webContents.navigationHistory) {
    return webContents.navigationHistory.canGoForward();
  }
  return webContents.canGoForward();
}

function goBack(webContents) {
  if (!webContents) {
    return;
  }
  if (webContents.navigationHistory) {
    webContents.navigationHistory.goBack();
    return;
  }
  webContents.goBack();
}

function goForward(webContents) {
  if (!webContents) {
    return;
  }
  if (webContents.navigationHistory) {
    webContents.navigationHistory.goForward();
    return;
  }
  webContents.goForward();
}

module.exports = { canGoBack, canGoForward, goBack, goForward };
