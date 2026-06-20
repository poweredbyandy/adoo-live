const { KEYMAP, formatAccelerator } = require('../../src/shared/keymap');

describe('keymap', () => {
  it('define atajos únicos', () => {
    const accelerators = KEYMAP.map((entry) => entry.accelerator);
    expect(new Set(accelerators).size).toBe(accelerators.length);
  });

  it('incluye atajo de modo desarrollador Odoo', () => {
    const odooDebug = KEYMAP.find((entry) => entry.action === 'toggleOdooDebug');
    expect(odooDebug).toBeTruthy();
    expect(odooDebug.accelerator).toBe('CommandOrControl+Shift+D');
  });

  it('formatea atajos para macOS', () => {
    expect(formatAccelerator('CommandOrControl+Shift+D', 'darwin')).toBe('⌘⇧D');
  });

  it('formatea atajos para Windows/Linux', () => {
    expect(formatAccelerator('CommandOrControl+Shift+D', 'win32')).toBe('Ctrl+Shift+D');
  });
});
