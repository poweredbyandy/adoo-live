const { buildCompatibilityCheckUrl, getOriginFromUrl, isNavigableOdooUrl } = require('../../src/shared/kiosk-compatibility');

describe('kiosk-compatibility', () => {
  it('construye la URL del controlador de compatibilidad', () => {
    expect(buildCompatibilityCheckUrl('https://odoo.example.com/web', '1.0.0')).toBe(
      'https://odoo.example.com/pba_kiosk/compatibility?app_version=1.0.0',
    );
  });

  it('ignora URLs no http(s)', () => {
    expect(getOriginFromUrl('about:blank')).toBeNull();
    expect(getOriginFromUrl('chrome-error://chromewebdata/')).toBeNull();
    expect(buildCompatibilityCheckUrl('file:///tmp/test', '1.0.0')).toBeNull();
    expect(isNavigableOdooUrl('chrome-error://chromewebdata/')).toBe(false);
    expect(isNavigableOdooUrl('https://odoo.example.com/web')).toBe(true);
  });
});
