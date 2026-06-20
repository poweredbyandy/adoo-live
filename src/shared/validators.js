const { MODES } = require('./constants');

function isValidMode(mode) {
  return Object.values(MODES).includes(mode);
}

function normalizeHost(hostname) {
  return String(hostname || '').toLowerCase();
}

function isHostAllowed(hostname, allowedHosts) {
  const host = normalizeHost(hostname);
  if (!host) {
    return false;
  }
  return allowedHosts.some((allowed) => {
    const normalized = normalizeHost(allowed);
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function isUrlAllowed(urlString, allowedHosts) {
  try {
    const url = new URL(urlString);
    return isHostAllowed(url.hostname, allowedHosts);
  } catch {
    return false;
  }
}

function validateNotifyPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object' };
  }
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  if (!title && !body) {
    return { valid: false, error: 'Title or body is required' };
  }
  return {
    valid: true,
    value: {
      title: title || 'Odoo',
      body,
      silent: Boolean(payload.silent),
    },
  };
}

function validateSerialOpenPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object' };
  }
  const path = String(payload.path || '').trim();
  if (!path) {
    return { valid: false, error: 'Serial path is required' };
  }
  const opts = payload.opts && typeof payload.opts === 'object' ? payload.opts : {};
  const baudRate = Number(opts.baudRate || 9600);
  if (!Number.isFinite(baudRate) || baudRate <= 0) {
    return { valid: false, error: 'Invalid baudRate' };
  }
  return {
    valid: true,
    value: { path, opts: { baudRate, autoOpen: true } },
  };
}

function validateSerialWritePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object' };
  }
  const id = String(payload.id || '').trim();
  if (!id) {
    return { valid: false, error: 'Serial id is required' };
  }
  if (payload.data === undefined || payload.data === null) {
    return { valid: false, error: 'Serial data is required' };
  }
  return { valid: true, value: { id, data: payload.data } };
}

function validateSerialClosePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object' };
  }
  const id = String(payload.id || '').trim();
  if (!id) {
    return { valid: false, error: 'Serial id is required' };
  }
  return { valid: true, value: { id } };
}

function validatePrintPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object' };
  }
  return {
    valid: true,
    value: {
      deviceName: payload.deviceName ? String(payload.deviceName) : undefined,
      silent: Boolean(payload.silent),
      printBackground: payload.printBackground !== false,
      copies: Number(payload.copies || 1),
    },
  };
}

function validatePrintRawPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object' };
  }
  const data = payload.data;
  if (data === undefined || data === null) {
    return { valid: false, error: 'Raw print data is required' };
  }
  return {
    valid: true,
    value: {
      deviceName: payload.deviceName ? String(payload.deviceName) : undefined,
      data,
    },
  };
}

function clampZoomLevel(level, minLevel, maxLevel) {
  return Math.min(maxLevel, Math.max(minLevel, Number(level) || 0));
}

function calculateContentBounds(windowBounds, chromeHeight, menuPanelWidth = 0) {
  const reservedMenuWidth = Math.max(0, Number(menuPanelWidth) || 0);
  const width = Math.max(0, windowBounds.width - reservedMenuWidth);
  const height = Math.max(0, windowBounds.height - chromeHeight);
  return {
    x: 0,
    y: chromeHeight,
    width,
    height,
  };
}

function canAddTab(tabCount, maxTabs) {
  return tabCount < maxTabs;
}

module.exports = {
  isValidMode,
  isHostAllowed,
  isUrlAllowed,
  validateNotifyPayload,
  validateSerialOpenPayload,
  validateSerialWritePayload,
  validateSerialClosePayload,
  validatePrintPayload,
  validatePrintRawPayload,
  clampZoomLevel,
  calculateContentBounds,
  canAddTab,
};
