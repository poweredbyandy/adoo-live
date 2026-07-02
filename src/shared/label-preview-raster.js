const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { ensureSystemFonts } = require('./printer-fonts');

const LABEL_DPMM = 8;
const LABEL_DPI = LABEL_DPMM * 25.4;

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function drawGwBitmap(ctx, image, color = '#000000') {
  const { x, y, bytesPerRow, height, data, width } = image;
  ctx.fillStyle = color;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const byteIndex = row * bytesPerRow + (col >> 3);
      const bit = 7 - (col & 7);
      if (byteIndex < data.length && (data[byteIndex] >> bit) & 1) {
        ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }
}

async function compositePngWithGraphics(pngBuffer, graphics, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  if (pngBuffer?.length) {
    const img = await loadImage(pngBuffer);
    ctx.drawImage(img, 0, 0);
  }
  for (const block of graphics) {
    drawGwBitmap(ctx, block);
  }
  return canvas.toBuffer('image/png');
}

function toImageBuffer(value) {
  if (!value) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (Array.isArray(value)) {
    return Buffer.from(value);
  }
  return Buffer.from(String(value));
}

function buildPreviewRasterMarkup(pngBuffer, options = {}) {
  ensureSystemFonts();
  const buffer = toImageBuffer(pngBuffer);
  if (!buffer.length) {
    return '';
  }
  const base64 = buffer.toString('base64');
  const classNames = ['print-preview-raster'];
  if (options.pageClass) {
    classNames.push(options.pageClass);
  }
  if (options.extraClass) {
    classNames.push(options.extraClass);
  }
  const alt = escapeHtml(options.alt || 'Print preview');
  const widthAttr = options.width ? ` width="${options.width}"` : '';
  const heightAttr = options.height ? ` height="${options.height}"` : '';
  const caption = options.caption
    ? `<div class="print-preview-raster-caption">${escapeHtml(options.caption)}</div>`
    : '';
  return [
    `<div class="${classNames.join(' ')}">`,
    `<img class="print-preview-raster-img" src="data:image/png;base64,${base64}" alt="${alt}"${widthAttr}${heightAttr} loading="lazy"/>`,
    caption,
    '</div>',
  ].join('');
}

function buildPreviewRasterDocument(parts, options = {}) {
  const classNames = ['print-preview-raster-document'];
  if (options.extraClass) {
    classNames.push(options.extraClass);
  }
  return `<div class="${classNames.join(' ')}">${parts.filter(Boolean).join('')}</div>`;
}

function parseZplGraphicFields(text) {
  const blocks = [];
  const pattern = /\^FO(\d+),(\d+)\^GFA,(\d+),(\d+),(\d+),([0-9A-Fa-f]+)\^FS/g;
  let match = pattern.exec(String(text || ''));
  while (match) {
    const x = Number.parseInt(match[1], 10) || 0;
    const y = Number.parseInt(match[2], 10) || 0;
    const bytesPerRow = Number.parseInt(match[5], 10) || 0;
    const hex = match[6] || '';
    if (!bytesPerRow || !hex) {
      match = pattern.exec(String(text || ''));
      continue;
    }
    const data = Buffer.from(hex, 'hex');
    const height = Math.floor(data.length / bytesPerRow);
    blocks.push({
      x,
      y,
      bytesPerRow,
      height,
      width: bytesPerRow * 8,
      data,
    });
    match = pattern.exec(String(text || ''));
  }
  return blocks;
}

function bwipToPng(options) {
  const bwipjs = require('bwip-js');
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(options, (error, png) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(png);
    });
  });
}

module.exports = {
  LABEL_DPI,
  LABEL_DPMM,
  bwipToPng,
  buildPreviewRasterDocument,
  buildPreviewRasterMarkup,
  compositePngWithGraphics,
  drawGwBitmap,
  parseZplGraphicFields,
  toImageBuffer,
};
