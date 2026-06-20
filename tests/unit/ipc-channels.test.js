const { IPC } = require('../../src/shared/ipc-channels');
const fs = require('fs');
const path = require('path');

describe('ipc-channels', () => {
  it('define canales únicos', () => {
    const values = Object.values(IPC);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('usa los mismos canales en preload shell y odoo', () => {
    const shellPreload = fs.readFileSync(path.join(__dirname, '../../src/preload/shell-preload.js'), 'utf8');
    const odooPreload = fs.readFileSync(path.join(__dirname, '../../src/preload/odoo-preload.js'), 'utf8');

    expect(shellPreload).toContain('IPC.BROWSER_GET_STATE');
    expect(shellPreload).toContain('IPC.BROWSER_SET_MODE');
    expect(odooPreload).toContain('IPC.NOTIFY_SHOW');
    expect(odooPreload).toContain('IPC.SERIAL_LIST');
    expect(odooPreload).toContain('IPC.USB_LIST');
    expect(odooPreload).toContain('IPC.PRINTER_PRINT');
    expect(odooPreload).toContain('IPC.BROWSER_GET_SYSTEM_INFO');
  });
});
