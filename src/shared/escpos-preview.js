const { createCanvas } = require('@napi-rs/canvas');
const {
  buildPreviewRasterMarkup,
} = require('./label-preview-raster');
const {
  getEscposFontSpec,
} = require('./printer-fonts');
const {
  THERMAL_80MM,
  getThermal80mmCanvasWidth,
} = require('./paper-profiles');

const RECEIPT_WIDTH = 48;
const THERMAL_DPI = THERMAL_80MM.dpi;
const THERMAL_WIDTH_DOTS = getThermal80mmCanvasWidth();
const THERMAL_PAD_X = THERMAL_80MM.marginXDots;
const THERMAL_PAD_Y = THERMAL_80MM.marginYDots;
const LINE_HEIGHT_DOTS = 24;

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
    underline: false,
    doubleWidth: false,
    doubleHeight: false,
    fontB: false,
  };
}

function segmentKey(state) {
  return [
    state.bold ? 1 : 0,
    state.underline ? 1 : 0,
    state.doubleWidth ? 1 : 0,
    state.doubleHeight ? 1 : 0,
    state.fontB ? 1 : 0,
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
    underline: state.underline,
    doubleWidth: state.doubleWidth,
    doubleHeight: state.doubleHeight,
    fontB: state.fontB,
  });
}

function applyGsSize(state, value) {
  return {
    ...state,
    doubleHeight: (value & 0x01) !== 0,
    doubleWidth: (value & 0x10) !== 0,
  };
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
    case 0x2d:
      return {
        index: Math.min(next + 1, buffer.length),
        state: { underline: buffer[next] === 0x01 },
        reset: false,
      };
    case 0x4d:
      return { index: next, state: { fontB: true }, reset: false };
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
    case 0x74:
      return { index: Math.min(next + 1, buffer.length), state: null, reset: false };
    default:
      return { index: next, state: null, reset: false };
  }
}

function consumeGsCommand(buffer, index, state) {
  let next = index + 2;
  if (next > buffer.length) {
    return { index: buffer.length, state };
  }
  const cmd = buffer[index + 1];
  if (cmd === 0x21) {
    const value = buffer[next] ?? 0;
    return {
      index: Math.min(next + 1, buffer.length),
      state: applyGsSize(state, value),
    };
  }
  if (cmd === 0x56 || cmd === 0x42) {
    return { index: Math.min(next + 1, buffer.length), state };
  }
  return { index: next, state };
}

function parseEscposDocument(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const lines = [];
  let lineSegments = [];
  let state = createDefaultState();

  function endLine() {
    lines.push(lineSegments);
    lineSegments = [];
  }

  let index = 0;
  while (index < buffer.length) {
    const byte = buffer[index];
    if (byte === 0x0c) {
      endLine();
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
      const result = consumeGsCommand(buffer, index, state);
      index = result.index;
      state = result.state;
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

  return lines;
}

function renderSegmentHtml(segment) {
  const classes = [];
  if (segment.bold) {
    classes.push('escpos-bold');
  }
  if (segment.underline) {
    classes.push('escpos-underline');
  }
  if (segment.doubleWidth) {
    classes.push('escpos-double-width');
  }
  if (segment.doubleHeight) {
    classes.push('escpos-double-height');
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

function renderEscposPreviewHtml(bytes) {
  const lines = parseEscposDocument(bytes);
  if (!lines.length) {
    return '';
  }
  const body = lines.map((line) => {
    const content = renderLineHtml(line);
    return `<div class="escpos-line">${content || '&#160;'}</div>`;
  }).join('');
  return `<div class="print-preview-receipt"><div class="escpos-lines">${body}</div></div>`;
}

function lineHeightForSegments(segments) {
  if (!segments.length) {
    return LINE_HEIGHT_DOTS;
  }
  return getEscposFontSpec(segments[0]).lineHeight;
}

function drawEscposSegment(ctx, segment, x, y) {
  const spec = getEscposFontSpec(segment);
  ctx.font = `${spec.fontWeight} ${spec.fontSize}px ${spec.family}`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  let cursorX = x;
  for (const char of segment.text) {
    const advance = spec.charWidth;
    if (segment.doubleWidth) {
      ctx.save();
      ctx.translate(cursorX, y);
      ctx.scale(2, 1);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(char, cursorX, y);
    }
    if (segment.underline) {
      ctx.fillRect(cursorX, y + spec.lineHeight - 2, Math.max(1, advance - 1), 1);
    }
    cursorX += advance;
  }
  return cursorX;
}

function drawEscposLine(ctx, segments, x, y) {
  let cursorX = x;
  for (const segment of segments) {
    cursorX = drawEscposSegment(ctx, segment, cursorX, y);
  }
}

function renderEscposPreviewPng(bytes) {
  const lines = parseEscposDocument(bytes);
  if (!lines.length) {
    return '';
  }
  let contentHeight = THERMAL_PAD_Y;
  const lineHeights = lines.map((line) => lineHeightForSegments(line));
  for (const lineHeight of lineHeights) {
    contentHeight += lineHeight;
  }
  contentHeight += THERMAL_PAD_Y;
  const canvasWidth = THERMAL_WIDTH_DOTS;
  const canvasHeight = Math.max(contentHeight, LINE_HEIGHT_DOTS + THERMAL_PAD_Y * 2);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  let y = THERMAL_PAD_Y;
  for (let index = 0; index < lines.length; index += 1) {
    const lineHeight = lineHeights[index];
    drawEscposLine(ctx, lines[index], THERMAL_PAD_X, y);
    y += lineHeight;
  }
  const png = canvas.toBuffer('image/png');
  return buildPreviewRasterMarkup(png, {
    pageClass: 'print-preview-receipt',
    extraClass: 'print-preview-escpos-raster',
    width: canvasWidth,
    height: canvasHeight,
    caption: `ESC/POS · papel ${THERMAL_80MM.label} · fuente ${lines[0]?.[0]?.fontB ? 'B' : 'A'} · ${THERMAL_WIDTH_DOTS} dots · ${THERMAL_DPI} DPI`,
    alt: 'ESC/POS preview',
  });
}

function formatEscposSourceText(bytes) {
  const lines = parseEscposDocument(bytes);
  return lines.map((line) => line.map((segment) => segment.text).join('')).join('\n');
}

module.exports = {
  RECEIPT_WIDTH,
  THERMAL_80MM,
  THERMAL_DPI,
  THERMAL_WIDTH_DOTS,
  formatEscposSourceText,
  parseEscposDocument,
  renderEscposPreviewHtml,
  renderEscposPreviewPng,
};
