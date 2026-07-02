let serialportModule = null;

async function loadSerialPort() {
  if (!serialportModule) {
    serialportModule = require('serialport');
  }
  return serialportModule;
}

module.exports = {
  loadSerialPort,
};
