const {
  isValidMode,
  isHostAllowed,
  isUrlAllowed,
  validateNotifyPayload,
  validateSerialOpenPayload,
  validateSerialWritePayload,
  validateSerialClosePayload,
  validatePrintPayload,
  validatePrintRawPayload,
  clampZoomLevel,
  calculateContentBounds,
  canAddTab,
} = require('../../src/shared/validators');

describe('validators', () => {
  it('valida modos permitidos', () => {
    expect(isValidMode('kiosk')).toBe(true);
    expect(isValidMode('invalid')).toBe(false);
  });

  it('permite hosts configurados en kiosko', () => {
    const allowed = ['localhost', '127.0.0.1'];
    expect(isHostAllowed('localhost', allowed)).toBe(true);
    expect(isHostAllowed('odoo.localhost', allowed)).toBe(true);
    expect(isHostAllowed('evil.com', allowed)).toBe(false);
    expect(isUrlAllowed('http://localhost:8069/web', allowed)).toBe(true);
    expect(isUrlAllowed('https://evil.com', allowed)).toBe(false);
  });

  it('valida payload de notificaciones', () => {
    expect(validateNotifyPayload({ title: 'Hola' }).valid).toBe(true);
    expect(validateNotifyPayload({}).valid).toBe(false);
    expect(validateNotifyPayload(null).valid).toBe(false);
  });

  it('valida payloads de serial', () => {
    expect(validateSerialOpenPayload({ path: '/dev/ttyUSB0' }).valid).toBe(true);
    expect(validateSerialOpenPayload({ path: '/dev/ttyUSB0', opts: { baudRate: -1 } }).valid).toBe(false);
    expect(validateSerialWritePayload({ id: 'a', data: 'test' }).valid).toBe(true);
    expect(validateSerialClosePayload({ id: 'a' }).valid).toBe(true);
  });

  it('valida payloads de impresión', () => {
    expect(validatePrintPayload({ deviceName: 'POS' }).valid).toBe(true);
    expect(validatePrintRawPayload({ data: [1, 2, 3] }).valid).toBe(true);
    expect(validatePrintRawPayload({}).valid).toBe(false);
  });

  it('calcula bounds y límites de pestañas', () => {
    expect(calculateContentBounds({ width: 1000, height: 800 }, 48)).toEqual({
      x: 0,
      y: 48,
      width: 1000,
      height: 752,
    });
    expect(calculateContentBounds({ width: 1000, height: 800 }, 48, 280)).toEqual({
      x: 0,
      y: 48,
      width: 720,
      height: 752,
    });
    expect(canAddTab(9, 10)).toBe(true);
    expect(canAddTab(10, 10)).toBe(false);
    expect(clampZoomLevel(10, -3, 3)).toBe(3);
    expect(clampZoomLevel(-10, -3, 3)).toBe(-3);
  });
});
