const KEYMAP = [
  {
    id: 'odoo-debug',
    action: 'toggleOdooDebug',
    accelerator: 'CommandOrControl+Shift+D',
    label: 'Odoo developer mode (double: assets)',
  },
  {
    id: 'mode-kiosk',
    action: 'setMode:kiosk',
    accelerator: 'CommandOrControl+Shift+1',
    label: 'Kiosk mode',
  },
  {
    id: 'mode-free',
    action: 'setMode:free',
    accelerator: 'CommandOrControl+Shift+2',
    label: 'Window mode',
  },
  {
    id: 'find',
    action: 'toggleFind',
    accelerator: 'CommandOrControl+F',
    label: 'Find in page',
  },
  {
    id: 'reload-hard',
    action: 'reloadHard',
    accelerator: 'CommandOrControl+Shift+R',
    label: 'Hard reload',
  },
  {
    id: 'devtools',
    action: 'toggleDevTools',
    accelerator: 'CommandOrControl+Shift+I',
    label: 'Developer tools',
  },
  {
    id: 'logs',
    action: 'openLogs',
    accelerator: 'CommandOrControl+Shift+L',
    label: 'View logs',
  },
];

function formatAccelerator(accelerator, platform = process.platform) {
  const parts = String(accelerator || '').split('+');
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);

  if (platform === 'darwin') {
    const symbols = mods.map((mod) => {
      if (mod === 'CommandOrControl' || mod === 'Command') {
        return '⌘';
      }
      if (mod === 'Shift') {
        return '⇧';
      }
      if (mod === 'Alt') {
        return '⌥';
      }
      if (mod === 'Control') {
        return '⌃';
      }
      return mod;
    });
    return `${symbols.join('')}${key}`;
  }

  const labels = mods.map((mod) => {
    if (mod === 'CommandOrControl') {
      return 'Ctrl';
    }
    return mod;
  });
  return [...labels, key].join('+');
}

function getKeymapForDisplay(platform = process.platform, translate = (value) => value) {
  return KEYMAP.map((entry) => ({
    ...entry,
    label: translate(entry.label),
    display: formatAccelerator(entry.accelerator, platform),
  }));
}

module.exports = { KEYMAP, formatAccelerator, getKeymapForDisplay };
