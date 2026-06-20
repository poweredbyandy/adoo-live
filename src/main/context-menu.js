const { Menu, clipboard, BrowserWindow } = require('electron');
const { t } = require('../i18n');

function buildContextMenuTemplate(webContents, params, options = {}) {
  const { editFlags } = params;
  const template = [];
  const hasEditActions = editFlags.canUndo
    || editFlags.canRedo
    || editFlags.canCut
    || editFlags.canCopy
    || editFlags.canPaste
    || editFlags.canDelete
    || editFlags.canSelectAll;

  if (editFlags.canUndo || editFlags.canRedo) {
    template.push(
      {
        label: t('Undo'),
        enabled: editFlags.canUndo,
        click: () => webContents.undo(),
      },
      {
        label: t('Redo'),
        enabled: editFlags.canRedo,
        click: () => webContents.redo(),
      },
      { type: 'separator' },
    );
  }

  if (params.isEditable || editFlags.canCut || editFlags.canCopy || editFlags.canPaste) {
    template.push(
      {
        label: t('Cut'),
        enabled: editFlags.canCut,
        click: () => webContents.cut(),
      },
      {
        label: t('Copy'),
        enabled: editFlags.canCopy,
        click: () => webContents.copy(),
      },
      {
        label: t('Paste'),
        enabled: editFlags.canPaste,
        click: () => webContents.paste(),
      },
    );
  } else if (editFlags.canCopy) {
    template.push({
      label: t('Copy'),
      enabled: true,
      click: () => webContents.copy(),
    });
  }

  if (editFlags.canDelete) {
    template.push({
      label: t('Delete'),
      enabled: true,
      click: () => webContents.delete(),
    });
  }

  if (editFlags.canSelectAll) {
    template.push(
      { type: 'separator' },
      {
        label: t('Select all'),
        click: () => webContents.selectAll(),
      },
    );
  }

  if (params.linkURL) {
    template.push(
      { type: 'separator' },
      {
        label: t('Copy link address'),
        click: () => clipboard.writeText(params.linkURL),
      },
    );
    if (typeof options.onOpenLink === 'function') {
      template.push({
        label: t('Open link in new tab'),
        click: () => options.onOpenLink(params.linkURL),
      });
    }
  }

  if (params.mediaType === 'image' && params.srcURL) {
    template.push(
      { type: 'separator' },
      {
        label: t('Copy image address'),
        click: () => clipboard.writeText(params.srcURL),
      },
    );
  }

  if (options.showNavigation) {
    const navItems = [];
    if (typeof options.canGoBack === 'function' && typeof options.goBack === 'function') {
      navItems.push({
        label: t('Back'),
        enabled: options.canGoBack(),
        click: () => options.goBack(),
      });
    }
    if (typeof options.canGoForward === 'function' && typeof options.goForward === 'function') {
      navItems.push({
        label: t('Forward'),
        enabled: options.canGoForward(),
        click: () => options.goForward(),
      });
    }
    if (typeof options.reload === 'function') {
      navItems.push({
        label: t('Reload'),
        click: () => options.reload(),
      });
    }
    if (navItems.length) {
      template.push({ type: 'separator' }, ...navItems);
    }
  }

  if (!template.length && !hasEditActions && !params.linkURL) {
    template.push({
      label: t('Copy'),
      enabled: false,
      click: () => webContents.copy(),
    });
  }

  return template;
}

function attachContextMenu(webContents, options = {}) {
  if (!webContents || webContents._odooKioskContextMenuAttached) {
    return;
  }
  webContents._odooKioskContextMenuAttached = true;

  webContents.on('context-menu', (_event, params) => {
    const template = buildContextMenuTemplate(webContents, params, options);
    if (!template.length) {
      return;
    }
    const menu = Menu.buildFromTemplate(template);
    const window = options.getWindow?.()
      || BrowserWindow.fromWebContents(webContents)
      || null;
    menu.popup({
      window: window && !window.isDestroyed() ? window : undefined,
      x: params.x,
      y: params.y,
    });
  });
}

module.exports = { attachContextMenu, buildContextMenuTemplate };
