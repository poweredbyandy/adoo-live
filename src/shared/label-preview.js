const { formatEplSourceText, renderEplPreviewPng } = require('./epl-preview');
const { formatEscpSourceText, renderEscpPreviewPng, renderEscpPreviewHtml } = require('./escp-preview');
const { formatEscposSourceText, renderEscposPreviewPng, renderEscposPreviewHtml } = require('./escpos-preview');
const {
  LABEL_DPMM,
  buildPreviewRasterMarkup,
  compositePngWithGraphics,
  parseZplGraphicFields,
} = require('./label-preview-raster');

let zebrashPromise;

function loadZebrash() {
  if (!zebrashPromise) {
    zebrashPromise = import('@zebrash/node');
  }
  return zebrashPromise;
}

function decodeBase64Bytes(documentBase64) {
  return Buffer.from(String(documentBase64 || ''), 'base64');
}

function decodeBase64ToText(documentBase64, encoding) {
  const bytes = decodeBase64Bytes(documentBase64);
  const normalizedEncoding = String(encoding || 'utf-8').trim().toLowerCase();
  if (normalizedEncoding === 'binary') {
    return bytes.toString('latin1');
  }
  try {
    return new TextDecoder(normalizedEncoding === 'cp437' ? 'utf-8' : normalizedEncoding).decode(bytes);
  } catch {
    return bytes.toString('latin1');
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderTextFallback(bytes, format) {
  if (format === 'esc_p') {
    const markup = renderEscpPreviewHtml(bytes);
    if (markup) {
      return markup;
    }
  }
  if (format === 'escpos') {
    const markup = renderEscposPreviewHtml(bytes);
    if (markup) {
      return markup;
    }
  }
  return renderMessageFallback('No se pudo generar la previsualización.');
}

function renderMessageFallback(message) {
  return `<div class="print-preview-message">${escapeHtml(message)}</div>`;
}

function readZplDimensions(zpl, label) {
  const llMatch = String(zpl || '').match(/\^LL(\d+)/i);
  const widthDots = label?.printWidth || 812;
  const heightDots = llMatch ? Number.parseInt(llMatch[1], 10) || widthDots : widthDots;
  return {
    widthDots,
    heightDots,
    widthMm: widthDots / LABEL_DPMM,
    heightMm: heightDots / LABEL_DPMM,
  };
}

async function renderZplPreviewPng(text) {
  const { Parser, Drawer } = await loadZebrash();
  const source = String(text || '');
  const labels = new Parser().parse(source);
  if (!labels.length) {
    return null;
  }
  const label = labels[0];
  const dims = readZplDimensions(source, label);
  const drawer = new Drawer();
  let png = await drawer.drawLabelAsPng(label, {
    dpmm: LABEL_DPMM,
    labelWidthMm: dims.widthMm,
    labelHeightMm: dims.heightMm,
  });
  const graphics = parseZplGraphicFields(source);
  if (graphics.length) {
    png = await compositePngWithGraphics(png, graphics, dims.widthDots, dims.heightDots);
  }
  return buildPreviewRasterMarkup(png, {
    pageClass: 'print-preview-label-page',
    extraClass: 'print-preview-zpl-raster',
    width: dims.widthDots,
    height: dims.heightDots,
    caption: `${dims.widthDots}×${dims.heightDots} dots (203 DPI)`,
    alt: 'ZPL preview',
  });
}

function formatSourceForDisplay(payload = {}) {
  const format = String(payload.print_format || 'raw').trim().toLowerCase();
  const bytes = payload.document ? decodeBase64Bytes(payload.document) : Buffer.from('');
  if (format === 'epl' && bytes.length) {
    return formatEplSourceText(bytes);
  }
  if (format === 'zpl') {
    return bytes.length ? bytes.toString('latin1') : String(payload.text || '');
  }
  if (format === 'esc_p' && bytes.length) {
    return formatEscpSourceText(bytes);
  }
  if (format === 'escpos' && bytes.length) {
    return formatEscposSourceText(bytes);
  }
  if (format === 'esc_p' || format === 'escpos') {
    return String(payload.text || '');
  }
  return String(payload.text || '');
}

async function renderLabelPreview(payload = {}) {
  const format = String(payload.print_format || 'raw').trim().toLowerCase();
  const bytes = payload.document ? decodeBase64Bytes(payload.document) : Buffer.from('');
  const text = payload.text || decodeBase64ToText(payload.document, payload.encoding);

  if (!text && !bytes.length) {
    return { markup: null, engine: 'none' };
  }

  if (format === 'raw' || format === 'html') {
    return {
      markup: `<pre class="print-preview-raw">${escapeHtml(formatSourceForDisplay({ ...payload, text }))}</pre>`,
      engine: 'fallback',
    };
  }

  try {
    if (format === 'zpl') {
      const source = bytes.length ? bytes.toString('latin1') : text;
      const markup = await renderZplPreviewPng(source);
      if (markup) {
        return {
          markup,
          engine: 'zebrash-raster',
          sourceText: formatSourceForDisplay(payload),
        };
      }
    }

    if (format === 'epl') {
      const source = bytes.length ? bytes : Buffer.from(text, 'latin1');
      const markup = await renderEplPreviewPng(source);
      if (markup) {
        return {
          markup,
          engine: 'epl-raster',
          sourceText: formatSourceForDisplay(payload),
        };
      }
    }

    if (format === 'esc_p') {
      const source = bytes.length ? bytes : Buffer.from(text, 'latin1');
      const markup = renderEscpPreviewPng(source);
      if (markup) {
        return {
          markup,
          engine: 'escp-raster',
          sourceText: formatSourceForDisplay(payload),
        };
      }
    }

    if (format === 'escpos') {
      const source = bytes.length ? bytes : Buffer.from(text, 'latin1');
      const markup = renderEscposPreviewPng(source);
      if (markup) {
        return {
          markup,
          engine: 'escpos-raster',
          sourceText: formatSourceForDisplay(payload),
        };
      }
    }
  } catch (error) {
    return {
      markup: renderMessageFallback('No se pudo generar la previsualización.'),
      engine: 'fallback',
      error: error.message,
      sourceText: formatSourceForDisplay(payload),
    };
  }

  if (format === 'escpos' || format === 'esc_p') {
    const source = bytes.length ? bytes : Buffer.from(text, 'latin1');
    return {
      markup: renderTextFallback(source, format),
      engine: format === 'esc_p' ? 'escp-preview' : 'escpos-preview',
      sourceText: formatSourceForDisplay(payload),
    };
  }

  return {
    markup: renderMessageFallback('No se pudo generar la previsualización.'),
    engine: 'fallback',
    sourceText: formatSourceForDisplay(payload),
  };
}

module.exports = {
  decodeBase64ToText,
  formatSourceForDisplay,
  renderLabelPreview,
};
