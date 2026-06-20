const { Menu, shell } = require('electron');
const { ZOOM_STEP } = require('../shared/constants');
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

  const template = [
    {
      label: t('Navigation'),
      submenu: [
        {
          label: t('Back'),
          accelerator: 'Alt+Left',
          click: () => getFocused()?.goBack(),
        },
        {
          label: t('Forward'),
          accelerator: 'Alt+Right',
          click: () => getFocused()?.goForward(),
        },
        {
          label: t('Reload'),
          accelerator: 'CmdOrCtrl+R',
          click: () => getFocused()?.reload(false),
        },
        {
          label: t('Hard reload'),
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => getFocused()?.reload(true),
        },
        {
          label: t('Stop'),
          accelerator: 'Esc',
          click: () => getFocused()?.stop(),
        },
        {
          label: t('Home'),
          accelerator: 'CmdOrCtrl+Home',
          click: () => getFocused()?.home(),
        },
      ],
    },
    {
      label: t('View'),
      submenu: [
        {
          label: t('Find in page'),
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const focused = getFocused();
            if (focused?.window) {
              sendToShell(focused.window, 'shell:action', { action: 'toggleFind' });
            }
          },
        },
        {
          label: t('Zoom in'),
          accelerator: 'CmdOrCtrl+Plus',
          click: () => getFocused()?.setZoom(ZOOM_STEP),
        },
        {
          label: t('Zoom out'),
          accelerator: 'CmdOrCtrl+-',
          click: () => getFocused()?.setZoom(-ZOOM_STEP),
        },
        {
          label: t('Reset zoom'),
          accelerator: 'CmdOrCtrl+0',
          click: () => getFocused()?.resetZoom(),
        },
        { type: 'separator' },
        {
          label: t('Developer tools'),
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => getFocused()?.toggleDevTools(),
        },
      ],
    },
    {
      label: t('Tabs'),
      submenu: [
        {
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
        },
        {
          label: t('Close tab'),
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focused = getFocused();
            if (focused?.activeTabId) {
              focused.closeTab(focused.activeTabId);
            }
          },
        },
      ],
    },
    {
      label: t('Help'),
      submenu: [
        {
          label: t('Odoo developer mode'),
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => handleOdooDebugShortcut(windowRegistry),
        },
        {
          label: t('View logs'),
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            const focused = getFocused();
            if (focused?.window) {
              sendToShell(focused.window, 'shell:action', { action: 'openLogs' });
            }
          },
        },
        {
          label: t('Open API documentation'),
          click: () => {
            shell.openExternal('https://github.com/andyengit/odoo-kiosk');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { createApplicationMenu };
