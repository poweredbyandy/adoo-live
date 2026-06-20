const crypto = require('crypto');

function buildPrinterUid(printer) {
  return crypto
    .createHash('sha256')
    .update(String(printer.name || ''))
    .digest('hex')
    .slice(0, 32);
}

function mapPrinterStatus(status) {
  if (status === 0 || status === 1 || status === 2) {
    return 'ready';
  }
  if (status === undefined || status === null) {
    return 'unknown';
  }
  return 'offline';
}

function inferConnectionType(printer) {
  const optionType = printer.options?.type || printer.options?.['printer-type'] || '';
  if (optionType) {
    return String(optionType).toLowerCase();
  }
  const label = `${printer.name || ''} ${printer.description || ''}`.toLowerCase();
  if (label.includes('usb')) {
    return 'usb';
  }
  if (label.includes('network') || label.includes('ip_') || label.includes('socket')) {
    return 'network';
  }
  return 'unknown';
}

function mapPrinter(printer) {
  return {
    printer_uid: buildPrinterUid(printer),
    name: printer.name,
    driver: printer.description || '',
    is_default: Boolean(printer.isDefault),
    status: mapPrinterStatus(printer.status),
    connection_type: inferConnectionType(printer),
    model: printer.displayName || printer.name,
    location: printer.options?.location || printer.options?.['printer-location'] || '',
  };
}

async function getPrintersPayload(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return [];
  }
  const printers = await webContents.getPrintersAsync();
  return printers.map((printer) => mapPrinter(printer));
}

module.exports = {
  buildPrinterUid,
  getPrintersPayload,
  inferConnectionType,
  mapPrinter,
  mapPrinterStatus,
};
