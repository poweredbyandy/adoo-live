const {
  resolveOdooDebugLevelFromShortcut,
  consumeOdooDebugLevelFromShortcut,
  resetOdooDebugShortcutState,
  ODOO_DEBUG_DOUBLE_PRESS_MS,
  ODOO_DEBUG_DEDUP_MS,
} = require('../../src/shared/odoo-debug-shortcut');

describe('odoo-debug-shortcut', () => {
  beforeEach(() => {
    resetOdooDebugShortcutState();
  });

  it('devuelve debug=1 en una pulsación', () => {
    expect(resolveOdooDebugLevelFromShortcut()).toBe('1');
  });

  it('devuelve debug=assets en doble pulsación', () => {
    resolveOdooDebugLevelFromShortcut();
    expect(resolveOdooDebugLevelFromShortcut()).toBe('assets');
  });

  it('vuelve a debug=1 si pasa el intervalo de doble pulsación', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    resolveOdooDebugLevelFromShortcut();
    Date.now.mockReturnValue(now + ODOO_DEBUG_DOUBLE_PRESS_MS + 1);
    expect(resolveOdooDebugLevelFromShortcut()).toBe('1');
    Date.now.mockRestore();
  });

  it('deduplica el mismo atajo en el mismo instante', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(consumeOdooDebugLevelFromShortcut()).toBe('1');
    expect(consumeOdooDebugLevelFromShortcut()).toBeNull();
    Date.now.mockReturnValue(now + ODOO_DEBUG_DOUBLE_PRESS_MS + 1);
    expect(consumeOdooDebugLevelFromShortcut()).toBe('1');
    Date.now.mockRestore();
  });
});
