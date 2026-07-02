const PRINT_PREVIEW_MODES = ['off', 'before', 'before_and_print'];

const KIOSK_MIME_FORMATS = {
  'application/vnd.pba.kiosk.zpl': 'zpl',
  'application/vnd.pba.kiosk.epl': 'epl',
  'application/vnd.pba.kiosk.escpos': 'escpos',
  'application/vnd.pba.kiosk.esc-p': 'esc_p',
};

function normalizePrintPreviewMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return PRINT_PREVIEW_MODES.includes(mode) ? mode : 'before';
}

function shouldPreviewBeforePrint(mode) {
  return mode === 'before' || mode === 'before_and_print';
}

function shouldAutoPrintAfterPreview(mode) {
  return mode === 'before_and_print';
}

function includesBytes(buffer, sequence) {
  const needle = Buffer.isBuffer(sequence) ? sequence : Buffer.from(sequence);
  if (!needle.length || buffer.length < needle.length) {
    return false;
  }
  for (let index = 0; index <= buffer.length - needle.length; index += 1) {
    if (buffer.subarray(index, index + needle.length).equals(needle)) {
      return true;
    }
  }
  return false;
}

function scoreEscFamily(buffer) {
  const text = buffer.toString('latin1');
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const formFeedCount = (text.match(/\f/g) || []).length;
  let escpScore = 0;
  let escposScore = 0;

  if (formFeedCount > 0) {
    escpScore += 6;
  }
  if (crlfCount >= 3) {
    escpScore += 5;
  } else if (crlfCount > 0) {
    escpScore += 2;
  }

  const lfOnlyCount = (text.match(/(?<!\r)\n/g) || []).length;
  if (lfOnlyCount > crlfCount && crlfCount < 2) {
    escposScore += 3;
  }

  if (includesBytes(buffer, [0x1b, 0x57])) {
    escpScore += 3;
  }
  if (includesBytes(buffer, [0x1b, 0x47]) || includesBytes(buffer, [0x1b, 0x48])) {
    escpScore += 3;
  }
  if (includesBytes(buffer, [0x1b, 0x46])) {
    escpScore += 2;
  }
  if (includesBytes(buffer, [0x1b, 0x78]) || includesBytes(buffer, [0x1b, 0x55])) {
    escpScore += 2;
  }
  if (buffer.includes(0x0f)) {
    escpScore += 1;
  }

  if (includesBytes(buffer, [0x1d, 0x21])) {
    escposScore += 4;
  }
  if (includesBytes(buffer, [0x1d, 0x56]) || includesBytes(buffer, [0x1d, 0x42])) {
    escposScore += 3;
  }

  const matrixLines = text.split(/\r\n/).filter((line) => {
    const visible = line.replace(/[\x00-\x1f\x7f]/g, '');
    return visible.length >= 72 && visible.length <= 80;
  }).length;
  if (matrixLines >= 3) {
    escpScore += 4;
  }

  const receiptLines = text.split(/\n/).map((line) => line.replace(/[\x00-\x1f\x7f]/g, ''))
    .filter((line) => line.length > 0 && line.length <= 48).length;
  if (receiptLines >= 5 && crlfCount < 2) {
    escposScore += 2;
  }

  return { escpScore, escposScore, crlfCount };
}

function inferEscFamilyFromBytes(buffer) {
  const { escpScore, escposScore, crlfCount } = scoreEscFamily(buffer);
  if (escpScore > escposScore) {
    return 'esc_p';
  }
  if (escposScore > escpScore) {
    return 'escpos';
  }
  return crlfCount >= 2 ? 'esc_p' : 'escpos';
}

function inferPrintFormatFromBytes(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (!buffer.length) {
    return 'raw';
  }
  const text = buffer.toString('latin1');
  const trimmed = text.trimStart();
  if (/^\^XA/i.test(trimmed) || text.includes('^XA')) {
    return 'zpl';
  }
  if (/^N[\r\n]/.test(trimmed) || /\nP\d/.test(text) || /\nQ\d+/i.test(text)) {
    return 'epl';
  }
  if (buffer.includes(0x1b) || buffer.includes(0x1d)) {
    return inferEscFamilyFromBytes(buffer);
  }
  return 'raw';
}

function resolvePrintFormat(buffer, meta = {}) {
  const explicit = String(meta.print_format || '').trim().toLowerCase();
  if (explicit && explicit !== 'raw') {
    return explicit;
  }

  const mimeType = String(meta.mime_type || '').trim().toLowerCase();
  if (KIOSK_MIME_FORMATS[mimeType]) {
    return KIOSK_MIME_FORMATS[mimeType];
  }

  const commandSet = String(meta.command_set || '').trim().toLowerCase();
  if (commandSet === 'esc_p_epson' || commandSet === 'esc_p') {
    return 'esc_p';
  }
  if (commandSet === 'escpos') {
    return 'escpos';
  }

  return inferPrintFormatFromBytes(buffer);
}

function buildPreviewPayloadFromBytes(bytes, meta = {}) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const printFormat = resolvePrintFormat(buffer, meta);
  return {
    printer_uid: meta.printer_uid ? String(meta.printer_uid) : '',
    document: buffer.toString('base64'),
    document_name: meta.document_name ? String(meta.document_name) : 'webusb-print',
    mime_type: meta.mime_type || `application/vnd.pba.kiosk.${printFormat}`,
    print_format: printFormat,
    encoding: meta.encoding || (['zpl', 'epl', 'escpos', 'esc_p'].includes(printFormat) ? 'binary' : ''),
    command_set: meta.command_set ? String(meta.command_set) : '',
    job_name: meta.job_name ? String(meta.job_name) : 'WebUSB',
    print_uid: meta.print_uid ? String(meta.print_uid) : `webusb-${Date.now()}`,
  };
}

module.exports = {
  PRINT_PREVIEW_MODES,
  buildPreviewPayloadFromBytes,
  inferEscFamilyFromBytes,
  inferPrintFormatFromBytes,
  normalizePrintPreviewMode,
  resolvePrintFormat,
  shouldAutoPrintAfterPreview,
  shouldPreviewBeforePrint,
};
