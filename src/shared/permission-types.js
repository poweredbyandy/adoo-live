const PERMISSION_TYPES = {
  PRINTERS: 'printers',
  DEVICES: 'devices',
  CAMERA: 'camera',
  FILES: 'files',
  WEBSOCKET: 'websocket',
};

const PERMISSION_TYPE_LIST = Object.values(PERMISSION_TYPES);

const DEFAULT_PERMISSIONS = {
  printers: false,
  devices: false,
  camera: false,
  files: false,
  websocket: false,
};

module.exports = {
  PERMISSION_TYPES,
  PERMISSION_TYPE_LIST,
  DEFAULT_PERMISSIONS,
};
