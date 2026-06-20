const {
  ModeManager,
  canHaveTabs,
  canEditUrl,
  shouldAutoOpenDevTools,
  isNavigationRestricted,
  isVerboseLogging,
  isValidTransition,
  validateDeveloperPin,
  getModeCapabilities,
} = require('../../src/main/mode-manager');
const { MODES } = require('../../src/shared/constants');

describe('mode-manager', () => {
  it('expone capacidades por modo', () => {
    expect(getModeCapabilities(MODES.KIOSK)).toEqual({
      mode: MODES.KIOSK,
      canHaveTabs: false,
      canEditUrl: false,
      autoDevTools: false,
      navigationRestricted: true,
      verboseLogging: false,
    });

    expect(getModeCapabilities(MODES.FREE)).toMatchObject({
      canHaveTabs: true,
      canEditUrl: true,
      autoDevTools: false,
    });

    expect(getModeCapabilities(MODES.DEVELOPER)).toMatchObject({
      canHaveTabs: true,
      autoDevTools: true,
      verboseLogging: true,
    });
  });

  it('valida transiciones entre modos distintos', () => {
    expect(isValidTransition(MODES.KIOSK, MODES.FREE)).toBe(true);
    expect(isValidTransition(MODES.FREE, MODES.FREE)).toBe(false);
  });

  it('requiere pin para modo desarrollador cuando está configurado', () => {
    expect(validateDeveloperPin('1234', '1234')).toBe(true);
    expect(validateDeveloperPin('0000', '1234')).toBe(false);
    expect(validateDeveloperPin(undefined, null)).toBe(true);
  });

  it('cambia de modo y conserva estado', () => {
    const manager = new ModeManager(MODES.KIOSK);
    const capabilities = manager.setMode(MODES.FREE);
    expect(capabilities.mode).toBe(MODES.FREE);
    expect(manager.getMode()).toBe(MODES.FREE);
  });

  it('rechaza pin inválido al entrar en desarrollador', () => {
    const manager = new ModeManager(MODES.FREE);
    expect(() => manager.setMode(MODES.DEVELOPER, 'bad', 'secret')).toThrow('Invalid developer PIN');
  });

  it('expone helpers de capacidades', () => {
    expect(canHaveTabs(MODES.KIOSK)).toBe(false);
    expect(canEditUrl(MODES.KIOSK)).toBe(false);
    expect(shouldAutoOpenDevTools(MODES.DEVELOPER)).toBe(true);
    expect(isNavigationRestricted(MODES.KIOSK)).toBe(true);
    expect(isVerboseLogging(MODES.DEVELOPER)).toBe(true);
  });
});
