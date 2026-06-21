const { TAB_TYPES } = require('./tab-types');

const DISABLE_REASONS = {
  NOT_ODOO_TAB: 'not_odoo_tab',
  CANNOT_GO_BACK: 'cannot_go_back',
  CANNOT_GO_FORWARD: 'cannot_go_forward',
  NO_HISTORY: 'no_history',
  NO_FIND_MATCHES: 'no_find_matches',
  ALREADY_DEFAULT_INSTANCE: 'already_default_instance',
  NO_DOWNLOAD_FILE: 'no_download_file',
  HIDDEN: 'hidden',
  ALREADY_ACTIVE_MODE: 'already_active_mode',
  ALREADY_ACTIVE_TAB: 'already_active_tab',
};

const STATIC_CLICKABLES = [
  {
    id: 'btn-back',
    zone: 'toolbar',
    label: 'Back',
    api: 'goBack',
    disabledWhen: (state) => !state.isOdooTabActive || !state.canGoBack,
    disabledReason: (state) => (
      !state.isOdooTabActive ? DISABLE_REASONS.NOT_ODOO_TAB : DISABLE_REASONS.CANNOT_GO_BACK
    ),
  },
  {
    id: 'btn-forward',
    zone: 'toolbar',
    label: 'Forward',
    api: 'goForward',
    disabledWhen: (state) => !state.isOdooTabActive || !state.canGoForward,
    disabledReason: (state) => (
      !state.isOdooTabActive ? DISABLE_REASONS.NOT_ODOO_TAB : DISABLE_REASONS.CANNOT_GO_FORWARD
    ),
  },
  {
    id: 'btn-reload',
    zone: 'toolbar',
    label: 'Reload',
    api: 'reload',
    disabledWhen: (state) => !state.isOdooTabActive,
    disabledReason: () => DISABLE_REASONS.NOT_ODOO_TAB,
  },
  {
    id: 'btn-home',
    zone: 'toolbar',
    label: 'Home',
    api: 'home',
  },
  {
    id: 'btn-menu',
    zone: 'toolbar',
    label: 'Menu',
    api: 'setMenuOpen',
    apiArgs: (state) => [!state.menuOpen],
  },
  {
    id: 'btn-new-tab',
    zone: 'tabs',
    label: 'New tab',
    api: 'newTab',
    hiddenWhen: (state) => !state.capabilities?.canHaveTabs,
    cssHiddenClass: 'tab-only',
  },
  {
    id: 'btn-find-prev',
    zone: 'find-bar',
    label: 'Find previous',
    api: 'findInPage',
    hiddenWhen: (state) => !state.findBarVisible || !state.isOdooTabActive,
    disabledWhen: (state) => !state.findBarVisible || !state.isOdooTabActive,
    skipApiWhenDisabled: true,
  },
  {
    id: 'btn-find-next',
    zone: 'find-bar',
    label: 'Find next',
    api: 'findInPage',
    hiddenWhen: (state) => !state.findBarVisible || !state.isOdooTabActive,
    disabledWhen: (state) => !state.findBarVisible || !state.isOdooTabActive,
    skipApiWhenDisabled: true,
  },
  {
    id: 'btn-find-close',
    zone: 'find-bar',
    label: 'Close find bar',
    api: 'setFindBarVisible',
    apiArgs: () => [false],
    hiddenWhen: (state) => !state.findBarVisible || !state.isOdooTabActive,
  },
  {
    id: 'btn-zoom-out',
    zone: 'menu',
    label: 'Zoom out',
    api: 'setZoom',
    apiArgs: () => [-0.5],
    menuOverlay: true,
  },
  {
    id: 'btn-zoom-in',
    zone: 'menu',
    label: 'Zoom in',
    api: 'setZoom',
    apiArgs: () => [0.5],
    menuOverlay: true,
  },
  {
    id: 'btn-zoom-reset',
    zone: 'menu',
    label: 'Reset zoom',
    api: 'resetZoom',
    menuOverlay: true,
  },
  {
    id: 'btn-settings-close',
    zone: 'settings',
    label: 'Close settings',
    requiresSettingsOpen: true,
    uiEffect: 'closeSettingsModal',
  },
  {
    id: 'btn-pick-download-folder',
    zone: 'settings',
    label: 'Pick download folder',
    api: 'pickDownloadFolder',
    requiresSettingsOpen: true,
    settingsPanel: 'downloads',
  },
  {
    id: 'btn-reset-download-folder',
    zone: 'settings',
    label: 'Reset download folder',
    api: 'setDownloadFolder',
    apiArgs: () => [null],
    requiresSettingsOpen: true,
    settingsPanel: 'downloads',
    hiddenWhen: () => true,
    hiddenByDefault: true,
  },
  {
    id: 'btn-check-updates',
    zone: 'settings',
    label: 'Check updates',
    api: 'checkForUpdates',
    requiresSettingsOpen: true,
    settingsPanel: 'about',
  },
  {
    id: 'btn-download-update',
    zone: 'settings',
    label: 'Download update',
    api: 'downloadUpdate',
    requiresSettingsOpen: true,
    settingsPanel: 'about',
    hiddenByDefault: true,
  },
  {
    id: 'btn-install-update',
    zone: 'settings',
    label: 'Install update',
    api: 'installUpdate',
    requiresSettingsOpen: true,
    settingsPanel: 'about',
    hiddenByDefault: true,
  },
  {
    id: 'update-toast-action',
    zone: 'update-toast',
    label: 'Update toast action',
    hiddenByDefault: true,
  },
  {
    id: 'update-toast-dismiss',
    zone: 'update-toast',
    label: 'Dismiss update toast',
    hiddenByDefault: true,
  },
  {
    id: 'btn-regenerate-odoo-assets',
    zone: 'settings',
    label: 'Regenerate Odoo assets',
    api: 'regenerateOdooAssets',
    requiresSettingsOpen: true,
    settingsPanel: 'about',
  },
  {
    id: 'btn-factory-reset',
    zone: 'settings',
    label: 'Factory reset',
    api: 'factoryReset',
    requiresSettingsOpen: true,
    settingsPanel: 'about',
  },
  {
    id: 'home-instance-submit',
    zone: 'home',
    label: 'Add or save instance',
    api: 'addInstance',
    requiresHomePanel: true,
    isSubmit: true,
  },
  {
    id: 'home-instance-cancel',
    zone: 'home',
    label: 'Cancel instance edit',
    requiresHomePanel: true,
    hiddenByDefault: true,
    uiEffect: 'resetHomeInstanceForm',
  },
  {
    id: 'btn-history-clear',
    zone: 'history',
    label: 'Clear history',
    api: 'clearPageHistory',
    requiresHistoryPanel: true,
    disabledWhen: (state) => !(state.panelData?.pageHistory?.length),
    disabledReason: () => DISABLE_REASONS.NO_HISTORY,
  },
];

const MENU_ACTION_CLICKABLES = [
  { action: 'new-tab', label: 'New Odoo tab', api: 'newTab', tabOnly: true },
  { action: 'find', label: 'Find in page', uiEffect: 'toggleFindBar' },
  { action: 'open-history', label: 'Page history', api: 'openTab', apiArgs: () => [TAB_TYPES.HISTORY] },
  { action: 'open-downloads', label: 'Download history', api: 'openTab', apiArgs: () => [TAB_TYPES.DOWNLOADS] },
  { action: 'open-settings', label: 'Settings', uiEffect: 'openSettingsModal' },
  { action: 'devtools', label: 'Developer tools', api: 'toggleDevTools', devOnly: true },
  { action: 'open-logs', label: 'View logs', api: 'openTab', apiArgs: () => [TAB_TYPES.LOGS], tabOnly: true },
  { action: 'copy-logs', label: 'Copy logs', uiEffect: 'copyLogs' },
  { action: 'export-logs', label: 'Export logs', api: 'exportLogs' },
  { action: 'clear-logs', label: 'Clear logs', api: 'clearLogs' },
];

const SETTINGS_NAV_CLICKABLES = [
  { panel: 'personalization', label: 'Personalization' },
  { panel: 'downloads', label: 'Downloads' },
  { panel: 'permissions', label: 'Permissions' },
  { panel: 'logs', label: 'Logs' },
  { panel: 'about', label: 'About' },
];

const MODE_SEGMENT_CLICKABLES = [
  { mode: 'kiosk', label: 'Kiosk mode' },
  { mode: 'free', label: 'Window mode' },
  { mode: 'developer', label: 'Developer mode' },
];

const MENU_GROUP_TOGGLES = [
  { group: 'history', label: 'History group', tabOnly: true },
  { group: 'developer', label: 'Developer group', devOnly: true },
  { group: 'help', label: 'Help group' },
];

const DYNAMIC_CLICKABLES = [
  {
    selector: '.instance-open',
    zone: 'home',
    label: 'Open instance',
    api: 'newTab',
    requiresHomePanel: true,
  },
  {
    selector: '.instance-action-btn[data-ui-icon], .instance-action-btn .ui-icon',
    zone: 'home',
    label: 'Instance default',
    api: 'setDefaultInstance',
    parentSelector: '.instance-actions',
    matchTitle: 'Mark as default',
  },
  {
    selector: '.instance-action-btn.danger',
    zone: 'home',
    label: 'Delete instance',
    api: 'removeInstance',
    requiresConfirm: true,
  },
  {
    selector: '.history-item',
    zone: 'history',
    label: 'Open history entry',
    api: 'newTab',
    requiresHistoryPanel: true,
  },
  {
    selector: '.download-action-btn',
    zone: 'downloads',
    label: 'Download row action',
    requiresDownloadsPanel: true,
  },
  {
    selector: '.tab-item',
    zone: 'tabs',
    label: 'Switch tab',
    api: 'switchTab',
    hiddenWhen: (state) => !state.capabilities?.canHaveTabs,
  },
  {
    selector: '.tab-close',
    zone: 'tabs',
    label: 'Close tab',
    api: 'closeTab',
    hiddenWhen: (state) => !state.capabilities?.canHaveTabs,
  },
  {
    selector: '.print-notice-dismiss',
    zone: 'print-banner',
    label: 'Dismiss print notice',
    api: 'dismissPrintNotice',
    hiddenWhen: (state) => !state.printNotices?.length,
  },
];

const BACKDROP_CLICKABLES = [
  {
    id: 'menu-backdrop',
    zone: 'menu',
    label: 'Menu backdrop',
    api: 'setMenuOpen',
    apiArgs: () => [false],
    menuOverlay: true,
  },
  {
    id: 'settings-modal-backdrop',
    zone: 'settings',
    label: 'Settings backdrop',
    uiEffect: 'closeSettingsModal',
    requiresSettingsOpen: true,
    hiddenByDefault: true,
  },
];

function isCssHidden(element) {
  if (!element) {
    return true;
  }
  if (element.classList.contains('hidden')) {
    return true;
  }
  const style = element.ownerDocument?.defaultView?.getComputedStyle(element);
  return style?.display === 'none' || style?.visibility === 'hidden';
}

function evaluateStaticClickable(entry, state, element) {
  if (!element) {
    return { present: false, clickable: false, reason: 'missing_element' };
  }
  if (entry.hiddenWhen?.(state) || entry.hiddenByDefault) {
    if (isCssHidden(element)) {
      return { present: true, clickable: false, reason: DISABLE_REASONS.HIDDEN };
    }
  }
  if (entry.disabledWhen?.(state) || element.disabled) {
    return {
      present: true,
      clickable: false,
      reason: entry.disabledReason?.(state) || 'disabled',
      disabled: true,
    };
  }
  return { present: true, clickable: true };
}

function listTrackedStaticIds() {
  return STATIC_CLICKABLES.map((entry) => entry.id).filter(Boolean);
}

function listAllMenuActions() {
  return MENU_ACTION_CLICKABLES.map((entry) => entry.action);
}

module.exports = {
  DISABLE_REASONS,
  STATIC_CLICKABLES,
  MENU_ACTION_CLICKABLES,
  SETTINGS_NAV_CLICKABLES,
  MODE_SEGMENT_CLICKABLES,
  MENU_GROUP_TOGGLES,
  DYNAMIC_CLICKABLES,
  BACKDROP_CLICKABLES,
  evaluateStaticClickable,
  isCssHidden,
  listTrackedStaticIds,
  listAllMenuActions,
};
