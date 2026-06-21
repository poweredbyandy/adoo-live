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

function collectPrinterWebContents(windowRegistry) {
  const candidates = [];
  const seen = new Set();
  const addCandidate = (webContents) => {
    if (!webContents || webContents.isDestroyed()) {
      return;
    }
    const key = webContents.id;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(webContents);
  };

  const managers = windowRegistry?.getAll?.() || [];
  const focused = windowRegistry?.getFocused?.();
  const orderedManagers = focused
    ? [focused, ...managers.filter((manager) => manager !== focused)]
    : managers;

  for (const manager of orderedManagers) {
    addCandidate(manager.window?.webContents);
    addCandidate(manager.resolveOdooWebContents?.({ requireLoaded: false }));
    for (const tab of manager.tabs || []) {
      addCandidate(tab.view?.webContents);
    }
  }
  return candidates;
}

async function listSystemPrinters(windowRegistry) {
  const candidates = collectPrinterWebContents(windowRegistry);
  for (const webContents of candidates) {
    try {
      const printers = await webContents.getPrintersAsync();
      if (Array.isArray(printers)) {
        return printers;
      }
    } catch {
      void 0;
    }
  }
  return [];
}

module.exports = {
  buildPrinterUid,
  collectPrinterWebContents,
  getPrintersPayload,
  inferConnectionType,
  listSystemPrinters,
  mapPrinter,
  mapPrinterStatus,
};
