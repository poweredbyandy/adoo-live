const APP_DISPLAY_NAME = 'adoo IoT';

const MODES = {
  KIOSK: 'kiosk',
  FREE: 'free',
  DEVELOPER: 'developer',
};

const TOOLBAR_HEIGHT = 48;
const TITLEBAR_HEIGHT = 38;
const CHROME_BG = '#1e1f22';
const CHROME_SYMBOL = '#f2f3f5';
const MENU_PANEL_WIDTH = 280;
const SESSION_PARTITION = 'persist:odoo';
const MIN_ZOOM_LEVEL = -3;
const MAX_ZOOM_LEVEL = 3;
const ZOOM_STEP = 0.5;

module.exports = {
  APP_DISPLAY_NAME,
  MODES,
  TOOLBAR_HEIGHT,
  TITLEBAR_HEIGHT,
  CHROME_BG,
  CHROME_SYMBOL,
  MENU_PANEL_WIDTH,
  SESSION_PARTITION,
  MIN_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  ZOOM_STEP,
};
