const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('./patch-usb-binding.js');

const electronInstall = path.join(__dirname, '../node_modules/electron/install.js');
if (!fs.existsSync(electronInstall)) {
  process.exit(0);
}

const result = spawnSync(process.execPath, [electronInstall], { stdio: 'inherit' });
if (result.status !== 0) {
  process.exit(result.status || 1);
}
