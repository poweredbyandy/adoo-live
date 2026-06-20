const {
  applyOdooDebugToUrl,
  buildOdooDebugReloadUrl,
  getOdooDebugLevel,
  normalizeOdooWebPath,
} = require('../../src/shared/odoo-debug');

describe('odoo-debug', () => {
  it('añade debug=1 a la URL', () => {
    const next = applyOdooDebugToUrl('https://example.com/web#action=menu', '1');
    expect(next).toBe('https://example.com/web?debug=1#action=menu');
    expect(getOdooDebugLevel(next)).toBe('1');
  });

  it('sustituye debug existente por assets', () => {
    const next = applyOdooDebugToUrl('https://example.com/web?debug=1', 'assets');
    expect(next).toBe('https://example.com/web?debug=assets');
    expect(getOdooDebugLevel(next)).toBe('assets');
  });

  it('elimina debug de la URL', () => {
    const next = applyOdooDebugToUrl('https://example.com/web?debug=assets&foo=bar', null);
    expect(next).toBe('https://example.com/web?foo=bar');
    expect(getOdooDebugLevel(next)).toBeNull();
  });

  it('normaliza la ruta al cliente web', () => {
    expect(normalizeOdooWebPath('/odoo/web/action')).toBe('/odoo/web');
    expect(normalizeOdooWebPath('/')).toBe('/web');
  });

  it('recarga el cliente web con query debug', () => {
    const next = buildOdooDebugReloadUrl('https://example.com/odoo/web#action=crm&menu_id=1', '1');
    expect(next).toBe('https://example.com/odoo/web?debug=1');
  });

  it('usa /web cuando la URL no incluye el cliente', () => {
    const next = buildOdooDebugReloadUrl('https://example.com/', 'assets');
    expect(next).toBe('https://example.com/web?debug=assets');
  });
});
