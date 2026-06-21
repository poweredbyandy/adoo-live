function normalizeDeviceDenylist(config) {
  const stored = config?.permissionDeviceDenylist || {};
  const normalizeList = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  };
  return {
    printers: normalizeList(stored.printers),
    serial: normalizeList(stored.serial),
    usb: normalizeList(stored.usb),
  };
}

module.exports = {
  normalizeDeviceDenylist,
};
