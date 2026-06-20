const { createVerboseLogger } = require('../../src/main/ipc/index');
const { ModeManager } = require('../../src/main/mode-manager');
const { MODES } = require('../../src/shared/constants');

describe('ipc verbose logger', () => {
  it('solo registra en modo desarrollador', () => {
    const modeManager = new ModeManager(MODES.FREE);
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      const logger = createVerboseLogger(modeManager);
      logger('test:event', 'free-mode');
      expect(logs).toHaveLength(0);

      modeManager.setMode(MODES.DEVELOPER);
      logger('test:event', 'dev-mode');
      expect(logs.some((line) => line.includes('[odoo-kiosk][dev] test:event'))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });
});
