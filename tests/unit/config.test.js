const { resolveStartupMode, DEFAULTS } = require('../../src/main/config');

describe('config', () => {
  it('usa lastMode cuando es válido', () => {
    expect(resolveStartupMode({ lastMode: 'free', defaultMode: 'kiosk' })).toBe('free');
  });

  it('usa defaultMode si no hay lastMode', () => {
    expect(resolveStartupMode({ defaultMode: 'developer' })).toBe('developer');
  });

  it('cae al modo por defecto si los modos guardados no son válidos', () => {
    expect(resolveStartupMode({ lastMode: 'invalid', defaultMode: 'bad' })).toBe(DEFAULTS.defaultMode);
  });
});
