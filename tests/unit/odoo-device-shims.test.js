const fs = require('fs');
const path = require('path');

function readShimSource(name) {
  return fs.readFileSync(path.join(__dirname, '../../src/preload', name), 'utf8');
}

describe('odoo device shims', () => {
  it('marca isSecureContext como true en el shim WebUSB', () => {
    const source = readShimSource('odoo-webusb-shim.js');
    expect(source).toContain('isSecureContext');
    expect(source).toContain("Object.defineProperty(navigator, 'usb'");
    expect(source).toContain('__kiosk_virtual_print_preview__');
    expect(source).toContain('printPreview.capture');
    expect(source).toContain('configurationValue');
    expect(source).toContain('this.configuration =');
  });

  it('expone navigator.serial en el shim WebSerial', () => {
    const source = readShimSource('odoo-webserial-shim.js');
    expect(source).toContain('isSecureContext');
    expect(source).toContain("Object.defineProperty(navigator, 'serial'");
  });

  it('preload inyecta los shims en el mundo de la página', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/preload/odoo-preload.js'),
      'utf8',
    );
    expect(source).toContain('webFrame.executeJavaScript');
    expect(source).toContain('odoo-secure-context-shim.js');
    expect(source).toContain('odoo-webusb-shim.js');
    expect(source).toContain('odoo-webserial-shim.js');
  });
});
