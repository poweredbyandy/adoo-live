const SUPPORTED_PRINT_FORMATS = [
  'pdf',
  'escpos',
  'esc_p',
  'zpl',
  'epl',
  'raw',
  'html',
];

const MIME_TO_PRINT_FORMAT = {
  'application/pdf': 'pdf',
  'application/octet-stream': 'raw',
  'application/vnd.pba.kiosk.escpos': 'escpos',
  'application/vnd.pba.kiosk.esc-p': 'esc_p',
  'application/vnd.pba.kiosk.zpl': 'zpl',
  'application/vnd.pba.kiosk.epl': 'epl',
  'text/html': 'html',
};

const DIRECT_DEVICE_FORMATS = new Set(['zpl', 'epl']);

const ESCPOS_FORMATS = new Set(['escpos', 'esc_p']);

function normalizePrintFormat(value) {
  const format = String(value || '').trim().toLowerCase();
  return SUPPORTED_PRINT_FORMATS.includes(format) ? format : '';
}

function resolvePrintFormat(payload = {}) {
  const explicit = normalizePrintFormat(payload.print_format);
  if (explicit) {
    return explicit;
  }
  const mimeType = String(payload.mime_type || '').trim().toLowerCase();
  if (MIME_TO_PRINT_FORMAT[mimeType]) {
    return MIME_TO_PRINT_FORMAT[mimeType];
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (mimeType === 'application/octet-stream') {
    return 'raw';
  }
  return '';
}

function looksLikeBinaryEscPos(buffer) {
  if (!buffer || !buffer.length) {
    return false;
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 256));
  return sample.includes(0x1b) || sample.includes(0x1d) || sample.includes(0x00);
}

function encodeEscPosBuffer(buffer, encoding) {
  const normalizedEncoding = String(encoding || 'cp437').trim().toLowerCase();
  if (!buffer || !buffer.length) {
    return buffer;
  }
  if (normalizedEncoding === 'binary' || normalizedEncoding === 'utf-8') {
    return buffer;
  }
  if (looksLikeBinaryEscPos(buffer)) {
    return buffer;
  }
  const text = buffer.toString('utf8');
  if (normalizedEncoding === 'latin-1' || normalizedEncoding === 'iso-8859-1') {
    return Buffer.from(text, 'latin1');
  }
  if (normalizedEncoding === 'cp437') {
    return Buffer.from(text, 'latin1');
  }
  return buffer;
}

function preparePrintBuffer(documentBase64, { print_format: printFormat, encoding } = {}) {
  const buffer = decodeBase64Document(documentBase64);
  const format = normalizePrintFormat(printFormat) || 'raw';
  if (ESCPOS_FORMATS.has(format)) {
    return encodeEscPosBuffer(buffer, encoding);
  }
  return buffer;
}

function isDirectDevicePath(value) {
  const path = String(value || '').trim();
  if (!path) {
    return false;
  }
  if (path.startsWith('/dev/')) {
    return true;
  }
  if (/^COM\d+$/i.test(path)) {
    return true;
  }
  return path.startsWith('\\\\.\\');
}

function validateLocalPrintPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'El payload de impresión debe ser un objeto.' };
  }
  const printerUid = String(payload.printer_uid || '').trim();
  const document = String(payload.document || '').trim();
  const mimeType = String(payload.mime_type || 'application/pdf').trim();
  const printFormat = resolvePrintFormat(payload);
  if (!printerUid) {
    return { valid: false, error: 'El campo printer_uid es obligatorio.' };
  }
  if (!document) {
    return { valid: false, error: 'El documento en base64 es obligatorio.' };
  }
  if (!printFormat) {
    return { valid: false, error: `Formato de impresión no soportado: ${payload.print_format || mimeType}` };
  }
  const devicePath = payload.device_path ? String(payload.device_path).trim() : '';
  if (devicePath && !isDirectDevicePath(devicePath)) {
    return { valid: false, error: `Ruta de dispositivo no válida: ${devicePath}` };
  }
  const baudRate = Number(payload.baud_rate);
  return {
    valid: true,
    value: {
      printer_uid: printerUid,
      document,
      document_name: payload.document_name ? String(payload.document_name) : 'document',
      mime_type: mimeType,
      print_format: printFormat,
      encoding: payload.encoding ? String(payload.encoding) : '',
      command_set: payload.command_set ? String(payload.command_set) : '',
      job_name: payload.job_name ? String(payload.job_name) : '',
      print_uid: payload.print_uid ? String(payload.print_uid) : '',
      device_path: devicePath,
      baud_rate: Number.isFinite(baudRate) && baudRate > 0 ? baudRate : 9600,
    },
  };
}

function decodeBase64Document(documentBase64) {
  return Buffer.from(String(documentBase64), 'base64');
}

function shouldHandleRemotePrintJob(job, deviceUid) {
  if (!job || !deviceUid) {
    return false;
  }
  if (job.device_uid !== deviceUid) {
    return false;
  }
  if (job.origin_device_uid && job.origin_device_uid === deviceUid) {
    return false;
  }
  return true;
}

function extractBusPrintJobs(message) {
  const jobs = [];

  const visit = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.type === 'pba_kiosk_print_job') {
      const payload = node.payload && typeof node.payload === 'object' ? node.payload : node;
      jobs.push(payload);
      return;
    }
    Object.values(node).forEach(visit);
  };

  visit(message);
  return jobs;
}

module.exports = {
  DIRECT_DEVICE_FORMATS,
  ESCPOS_FORMATS,
  MIME_TO_PRINT_FORMAT,
  SUPPORTED_PRINT_FORMATS,
  decodeBase64Document,
  encodeEscPosBuffer,
  extractBusPrintJobs,
  isDirectDevicePath,
  looksLikeBinaryEscPos,
  preparePrintBuffer,
  resolvePrintFormat,
  shouldHandleRemotePrintJob,
  validateLocalPrintPayload,
};
