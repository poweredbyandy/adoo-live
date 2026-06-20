const { Menu } = require('electron');
const { t } = require('../i18n');

function showTabContextMenu(window, payload, handlers) {
  if (!window || window.isDestroyed() || !payload?.tabId) {
    return;
  }
  const { tabId, x, y, closable } = payload;
  const template = [
    {
      label: t('Move tab to new window'),
      click: () => handlers.onDetach(tabId, { screenX: x, screenY: y }),
    },
    {
      label: t('Duplicate tab'),
      click: () => handlers.onDuplicate(tabId),
    },
    { type: 'separator' },
    {
      label: t('Close tab'),
      enabled: closable !== false,
      click: () => handlers.onClose(tabId),
    },
  ];
  Menu.buildFromTemplate(template).popup({
    window,
    x: Math.round(x),
    y: Math.round(y),
  });
}

module.exports = { showTabContextMenu };
