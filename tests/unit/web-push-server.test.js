const { toBase64Url, decodeBase64Url, parsePushPayload } = require('../../src/main/web-push-server');

describe('web-push-server helpers', () => {
  it('codifica y decodifica base64url', () => {
    const original = Buffer.from('odoo-kiosk');
    const encoded = toBase64Url(original);
    expect(decodeBase64Url(encoded).toString()).toBe('odoo-kiosk');
  });

  it('parsea payload JSON de notificación', () => {
    expect(parsePushPayload(Buffer.from('{"title":"Hola","body":"Mundo"}'))).toEqual({
      title: 'Hola',
      body: 'Mundo',
    });
  });

  it('parsea payload de texto plano', () => {
    expect(parsePushPayload(Buffer.from('Mensaje simple'))).toEqual({
      title: 'Odoo',
      body: 'Mensaje simple',
    });
  });
});
