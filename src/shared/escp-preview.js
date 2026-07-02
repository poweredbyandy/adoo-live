const { createCanvas } = require('@napi-rs/canvas');
const {
  buildPreviewRasterDocument,
  buildPreviewRasterMarkup,
} = require('./label-preview-raster');
const {
  EPSON_LX300_PLUS_II,
  getLx300PageCanvasSize,
} = require('./epson-lx300-profile');
const {
  getEscpTypography,
  normalizeEscpFontFace,
  drawEscpChar,
} = require('./printer-fonts');

const LINE_WIDTH = EPSON_LX300_PLUS_II.columnsAt10Cpi;
const PAGE_LAYOUT = getLx300PageCanvasSize();

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function createDefaultState() {
  return {
    bold: false,
    wide: false,
    underline: false,
    doubleStrike: false,
    condensed: false,
    italic: false,
    quality: 'draft',
    fontFace: 'draft',
    cpi: EPSON_LX300_PLUS_II.defaultCpi,
    lpi: EPSON_LX300_PLUS_II.defaultLpi,
  };
}

function segmentKey(state) {
  return [
    state.bold ? 1 : 0,
    state.wide ? 1 : 0,
    state.underline ? 1 : 0,
    state.doubleStrike ? 1 : 0,
    state.condensed ? 1 : 0,
    state.italic ? 1 : 0,
    state.quality || 'draft',
    normalizeEscpFontFace(state.fontFace),
    state.cpi,
    state.lpi,
  ].join(':');
}

function pushText(segments, text, state) {
  if (!text) {
    return;
  }
  const last = segments[segments.length - 1];
  const key = segmentKey(state);
  if (last && last.key === key) {
    last.text += text;
    return;
  }
  segments.push({
    key,
    text,
    bold: state.bold,
    wide: state.wide,
    underline: state.underline,
    doubleStrike: state.doubleStrike,
    condensed: state.condensed,
    italic: state.italic,
    quality: state.quality,
    fontFace: normalizeEscpFontFace(state.fontFace),
    cpi: state.cpi,
    lpi: state.lpi,
  });
}

function consumeEscCommand(buffer, index, state) {
  let next = index + 2;
  if (next > buffer.length) {
    return { index: buffer.length, state: null, reset: false };
  }
  const cmd = buffer[index + 1];
  switch (cmd) {
    case 0x40:
      return { index: next, state: null, reset: true };
    case 0x45:
      return {
        index: Math.min(next + 1, buffer.length),
        state: { bold: buffer[next] === 0x01 },
        reset: false,
      };
    case 0x46:
      return { index: next, state: { bold: false }, reset: false };
    case 0x47:
      return { index: next, state: { doubleStrike: true }, reset: false };
    case 0x48:
      return { index: next, state: { doubleStrike: false }, reset: false };
    case 0x57:
      return {
        index: Math.min(next + 1, buffer.length),
        state: { wide: buffer[next] === 0x01 },
        reset: false,
      };
    case 0x2d:
      return {
        index: Math.min(next + 1, buffer.length),
        state: { underline: buffer[next] === 0x01 },
        reset: false,
      };
    case 0x78:
      return {
        index: Math.min(next + 1, buffer.length),
        state: { quality: buffer[next] === 0x01 ? 'lq' : 'draft' },
        reset: false,
      };
    case 0x55:
    case 0x74:
    case 0x52:
      return { index: Math.min(next + 1, buffer.length), state: null, reset: false };
    case 0x6b: {
      const fontId = buffer[next] ?? 0;
      const fontFace = fontId === 2 ? 'courier' : fontId === 1 ? 'sans' : 'roman';
      return {
        index: Math.min(next + 1, buffer.length),
        state: { fontFace },
        reset: false,
      };
    }
    case 0x50:
      return { index: next, state: { cpi: 10, condensed: false }, reset: false };
    case 0x4d:
      return { index: next, state: { cpi: 12, condensed: false }, reset: false };
    case 0x67:
      return {
        index: Math.min(next + 1, buffer.length),
        state: { cpi: buffer[next] === 0x01 ? 15 : 10, condensed: false },
        reset: false,
      };
    case 0x32:
      return { index: next, state: { lpi: 6 }, reset: false };
    case 0x30:
      return { index: Math.min(next + 1, buffer.length), state: { lpi: 8 }, reset: false };
    case 0x34:
      return { index: next, state: { italic: true }, reset: false };
    case 0x35:
      return { index: next, state: { italic: false }, reset: false };
    case 0x64: {
      const feedLines = Math.max(1, buffer[next] ?? 1);
      return {
        index: Math.min(next + 1, buffer.length),
        state: null,
        reset: false,
        feedLines,
      };
    }
    case 0x4a: {
      const feedUnits = Math.max(0, buffer[next] ?? 0);
      return {
        index: Math.min(next + 1, buffer.length),
        state: null,
        reset: false,
        feedLines: feedUnits > 0 ? 1 : 0,
      };
    }
    default:
      return { index: next, state: null, reset: false };
  }
}

function consumeGsCommand(buffer, index) {
  let next = index + 2;
  if (next > buffer.length) {
    return buffer.length;
  }
  const cmd = buffer[index + 1];
  if (cmd === 0x21) {
    return Math.min(next + 1, buffer.length);
  }
  return next;
}

function parseEscpDocument(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const pages = [[]];
  let lineSegments = [];
  let state = createDefaultState();

  function endLine() {
    pages[pages.length - 1].push(lineSegments);
    lineSegments = [];
  }

  function newPage() {
    if (lineSegments.length) {
      endLine();
    }
    pages.push([]);
  }

  let index = 0;
  while (index < buffer.length) {
    const byte = buffer[index];
    if (byte === 0x0c) {
      newPage();
      index += 1;
      continue;
    }
    if (byte === 0x0d) {
      if (buffer[index + 1] === 0x0a) {
        index += 2;
      } else {
        index += 1;
      }
      endLine();
      continue;
    }
    if (byte === 0x0a) {
      index += 1;
      endLine();
      continue;
    }
    if (byte === 0x1b) {
      const result = consumeEscCommand(buffer, index, state);
      index = result.index;
      if (result.reset) {
        state = createDefaultState();
      } else if (result.state) {
        state = { ...state, ...result.state };
      }
      if (result.feedLines) {
        for (let feed = 0; feed < result.feedLines; feed += 1) {
          endLine();
        }
      }
      continue;
    }
    if (byte === 0x1d) {
      index = consumeGsCommand(buffer, index);
      continue;
    }
    if (byte === 0x0f) {
      state = { ...state, condensed: true };
      index += 1;
      continue;
    }
    if (byte === 0x12) {
      state = { ...state, condensed: false };
      index += 1;
      continue;
    }
    if (byte < 0x20 && byte !== 0x09) {
      index += 1;
      continue;
    }
    pushText(lineSegments, buffer.toString('latin1', index, index + 1), state);
    index += 1;
  }

  if (lineSegments.length) {
    endLine();
  }

  return pages.filter((page) => page.length);
}

function renderSegmentHtml(segment) {
  const classes = [];
  if (segment.bold) {
    classes.push('escp-bold');
  }
  if (segment.wide) {
    classes.push('escp-wide');
  }
  if (segment.underline) {
    classes.push('escp-underline');
  }
  if (segment.doubleStrike) {
    classes.push('escp-double-strike');
  }
  if (segment.condensed) {
    classes.push('escp-condensed');
  }
  const text = escapeHtml(segment.text);
  if (!classes.length) {
    return text;
  }
  return `<span class="${classes.join(' ')}">${text}</span>`;
}

function renderLineHtml(segments) {
  if (!segments.length) {
    return '';
  }
  return segments.map(renderSegmentHtml).join('');
}

function renderEscpPreviewHtml(bytes) {
  const pages = parseEscpDocument(bytes);
  if (!pages.length) {
    return '';
  }
  const pageHtml = pages.map((lines) => {
    const body = lines.map((line) => {
      const content = renderLineHtml(line);
      return `<div class="escp-line">${content || '&#160;'}</div>`;
    }).join('');
    return `<div class="print-preview-escp-page"><div class="escp-lines">${body}</div></div>`;
  }).join('');
  return `<div class="print-preview-escp-document">${pageHtml}</div>`;
}

function drawEscpSegment(ctx, segment, x, y, typography) {
  ctx.fillStyle = '#000000';
  let cursorX = x;
  for (const char of segment.text) {
    const advance = segment.wide ? typography.charWidth * 2 : typography.charWidth;
    drawEscpChar(ctx, char, cursorX, y, typography, { wide: segment.wide });
    if (segment.doubleStrike) {
      drawEscpChar(ctx, char, cursorX + 0.7, y, typography, { wide: segment.wide });
    }
    if (segment.underline) {
      ctx.fillRect(cursorX, y + typography.lineHeight - 2, Math.max(1, advance - 1), 1);
    }
    cursorX += advance;
  }
  return cursorX;
}

function drawEscpLine(ctx, segments, x, y) {
  let cursorX = x;
  for (const segment of segments) {
    const typography = getEscpTypography(segment);
    cursorX = drawEscpSegment(ctx, segment, cursorX, y, typography);
  }
}

function renderEscpPagePng(lines) {
  const { width, height, marginLeft, marginTop, marginBottom } = PAGE_LAYOUT;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const contentBottom = height - marginBottom;
  let y = marginTop;
  for (const line of lines) {
    const lineHeight = getEscpTypography(line[0] || {}).lineHeight;
    if (y + lineHeight > contentBottom) {
      break;
    }
    drawEscpLine(ctx, line, marginLeft, y);
    y += lineHeight;
  }
  return canvas.toBuffer('image/png');
}

function renderEscpPreviewPng(bytes) {
  const pages = parseEscpDocument(bytes);
  if (!pages.length) {
    return '';
  }
  const parts = pages.map((lines, index) => {
    const png = renderEscpPagePng(lines);
    return buildPreviewRasterMarkup(png, {
      pageClass: 'print-preview-escp-page',
      extraClass: 'print-preview-escp-raster',
      width: PAGE_LAYOUT.width,
      height: PAGE_LAYOUT.height,
      caption: `ESC/P · Carta ${EPSON_LX300_PLUS_II.pageWidthIn}×${EPSON_LX300_PLUS_II.pageHeightIn}" · ${EPSON_LX300_PLUS_II.model} · pág. ${index + 1}/${pages.length} · ${LINE_WIDTH} cols · ${EPSON_LX300_PLUS_II.dpiX}×${EPSON_LX300_PLUS_II.dpiY} dpi`,
      alt: `ESC/P page ${index + 1}`,
    });
  });
  return buildPreviewRasterDocument(parts, { extraClass: 'print-preview-escp-document' });
}

function formatEscpSourceText(bytes) {
  const pages = parseEscpDocument(bytes);
  if (!pages.length) {
    return '';
  }
  return pages.map((page) => page.map((line) => line.map((segment) => segment.text).join('')).join('\n')).join('\n\f\n');
}

module.exports = {
  EPSON_LX300_PLUS_II,
  LINE_WIDTH,
  PAGE_LAYOUT,
  formatEscpSourceText,
  parseEscpDocument,
  renderEscpPreviewHtml,
  renderEscpPreviewPng,
};
