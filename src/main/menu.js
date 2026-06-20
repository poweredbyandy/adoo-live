const path = require('path');
const { Menu, shell } = require('electron');
const { ZOOM_STEP } = require('../shared/constants');
const { TAB_TYPES } = require('../shared/tab-types');
const { handleOdooDebugShortcut } = require('./keymap');
const { t } = require('../i18n');

function sendToShell(window, channel, payload) {
  if (!window || window.isDestroyed()) {
    return;
  }
  window.webContents.send(channel, payload);
}

function createApplicationMenu(windowRegistry) {
  const getFocused = () => windowRegistry.getFocused();
  const menuIcon = path.join(__dirname, '../../icon.png');
  const useMenuIcons = process.platform === 'win32' || process.platform === 'linux';

  function withIcon(item) {
    if (!useMenuIcons) {
      return item;
    }
    return { ...item, icon: menuIcon };
  }

  function openPanelTab(type) {
    try {
      getFocused()?.openOrSwitchPanelTab(type);
    } catch {
      void 0;
    }
  }

  function sendShellAction(action) {
    const focused = getFocused();
    if (focused?.window) {
      sendToShell(focused.window, 'shell:action', { action });
    }
  }

  const template = [
    {
      label: t('Navigation'),
      submenu: [
        withIcon({
          label: t('Back'),
          accelerator: 'Alt+Left',
          click: () => getFocused()?.goBack(),
        }),
        withIcon({
          label: t('Forward'),
          accelerator: 'Alt+Right',
          click: () => getFocused()?.goForward(),
        }),
        { type: 'separator' },
        withIcon({
          label: t('Reload'),
          accelerator: 'CmdOrCtrl+R',
          click: () => getFocused()?.reload(false),
        }),
        withIcon({
          label: t('Hard reload'),
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => getFocused()?.reload(true),
        }),
        withIcon({
          label: t('Stop'),
          accelerator: 'Esc',
          click: () => getFocused()?.stop(),
        }),
        withIcon({
          label: t('Home'),
          accelerator: 'CmdOrCtrl+Home',
          click: () => getFocused()?.home(),
        }),
      ],
    },
    {
      label: t('View'),
      submenu: [
        withIcon({
          label: t('Find in page'),
          accelerator: 'CmdOrCtrl+F',
          click: () => sendShellAction('toggleFind'),
        }),
        { type: 'separator' },
        {
          label: t('Zoom'),
          submenu: [
            withIcon({
              label: t('Zoom in'),
              accelerator: 'CmdOrCtrl+Plus',
              click: () => getFocused()?.setZoom(ZOOM_STEP),
            }),
            withIcon({
              label: t('Zoom out'),
              accelerator: 'CmdOrCtrl+-',
              click: () => getFocused()?.setZoom(-ZOOM_STEP),
            }),
            withIcon({
              label: t('Reset zoom'),
              accelerator: 'CmdOrCtrl+0',
              click: () => getFocused()?.resetZoom(),
            }),
          ],
        },
        { type: 'separator' },
        withIcon({
          label: t('Developer tools'),
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => getFocused()?.toggleDevTools(),
        }),
      ],
    },
    {
      label: t('Tabs'),
      submenu: [
        withIcon({
          label: t('New tab'),
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            try {
              const focused = getFocused();
              if (!focused) {
                return;
              }
              const tab = focused.createTab();
              focused.switchTab(tab.id);
            } catch {
              void 0;
            }
          },
        }),
        withIcon({
          label: t('Close tab'),
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focused = getFocused();
            if (focused?.activeTabId) {
              focused.closeTab(focused.activeTabId);
            }
          },
        }),
      ],
    },
    {
      label: t('History'),
      submenu: [
        withIcon({
          label: t('Page history'),
          click: () => openPanelTab(TAB_TYPES.HISTORY),
        }),
        withIcon({
          label: t('Download history'),
          click: () => openPanelTab(TAB_TYPES.DOWNLOADS),
        }),
      ],
    },
    {
      label: t('Settings'),
      submenu: [
        withIcon({
          label: t('Settings'),
          click: () => sendShellAction('openSettings'),
        }),
        { type: 'separator' },
        withIcon({
          label: t('View logs'),
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => openPanelTab(TAB_TYPES.LOGS),
        }),
        withIcon({
          label: t('Export logs to file'),
          click: () => sendShellAction('exportLogs'),
        }),
        withIcon({
          label: t('Copy logs'),
          click: () => sendShellAction('copyLogs'),
        }),
        withIcon({
          label: t('Clear logs'),
          click: () => sendShellAction('clearLogs'),
        }),
      ],
    },
    {
      label: t('Help'),
      submenu: [
        withIcon({
          label: t('Odoo developer mode'),
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => handleOdooDebugShortcut(windowRegistry),
        }),
        { type: 'separator' },
        withIcon({
          label: t('Open API documentation'),
          click: () => {
            shell.openExternal('https://github.com/poweredbyandy/adoo-live');
          },
        }),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { createApplicationMenu };
