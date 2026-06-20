const TAB_TYPES = {
  ODOO: 'odoo',
  HOME: 'home',
  LOGS: 'logs',
  HISTORY: 'history',
  DOWNLOADS: 'downloads',
  SETTINGS: 'settings',
};

const PANEL_TITLES = {
  [TAB_TYPES.HOME]: 'Home panel',
  [TAB_TYPES.LOGS]: 'Logs',
  [TAB_TYPES.HISTORY]: 'History',
  [TAB_TYPES.DOWNLOADS]: 'Downloads',
  [TAB_TYPES.SETTINGS]: 'Settings',
};

const SINGLETON_PANEL_TYPES = new Set([
  TAB_TYPES.HOME,
  TAB_TYPES.LOGS,
  TAB_TYPES.HISTORY,
  TAB_TYPES.DOWNLOADS,
  TAB_TYPES.SETTINGS,
]);

module.exports = { TAB_TYPES, PANEL_TITLES, SINGLETON_PANEL_TYPES };
