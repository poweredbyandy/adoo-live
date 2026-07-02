const bwipjs = require('bwip-js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const {
  bwipToPng,
  buildPreviewRasterMarkup,
  drawGwBitmap,
} = require('./label-preview-raster');
const {
  drawFixedCellText,
  getEplFontSpec,
} = require('./printer-fonts');

const EPL_FONT_METRICS = {
  1: { width: 8, height: 12 },
  2: { width: 10, height: 16 },
  3: { width: 12, height: 20 },
  4: { width: 14, height: 24 },
  5: { width: 32, height: 48 },
};

function parseGwHeaderLine(line) {
  const match = String(line || '').trim().match(/^GW(\d+),(\d+),(\d+),(\d+)/i);
  if (!match) {
    return null;
  }
  return {
    x: Number.parseInt(match[1], 10) || 0,
    y: Number.parseInt(match[2], 10) || 0,
    bytesPerRow: Number.parseInt(match[3], 10) || 0,
    height: Number.parseInt(match[4], 10) || 0,
  };
}

function parseEplBuffer(buffer) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const lines = [];
  const images = [];
  let offset = 0;

  while (offset < source.length) {
    if (source[offset] === 0x47 && source[offset + 1] === 0x57) {
      let lineEnd = offset;
      while (lineEnd < source.length && source[lineEnd] !== 0x0a && source[lineEnd] !== 0x0d) {
        lineEnd += 1;
      }
      const header = source.toString('ascii', offset, lineEnd);
      const parsed = parseGwHeaderLine(header);
      if (parsed && parsed.bytesPerRow > 0 && parsed.height > 0) {
        let dataStart = lineEnd;
        if (source[dataStart] === 0x0d) {
          dataStart += 1;
        }
        if (source[dataStart] === 0x0a) {
          dataStart += 1;
        }
        const dataLength = parsed.bytesPerRow * parsed.height;
        if (dataStart + dataLength <= source.length) {
          images.push({
            ...parsed,
            width: parsed.bytesPerRow * 8,
            data: Buffer.from(source.subarray(dataStart, dataStart + dataLength)),
          });
          offset = dataStart + dataLength;
          continue;
        }
      }
    }

    let lineEnd = offset;
    while (lineEnd < source.length && source[lineEnd] !== 0x0a && source[lineEnd] !== 0x0d) {
      lineEnd += 1;
    }
    if (lineEnd > offset) {
      const line = source.toString('latin1', offset, lineEnd).trim();
      if (line) {
        lines.push(line);
      }
    }
    offset = lineEnd + 1;
    if (offset < source.length && source[lineEnd] === 0x0d && source[offset] === 0x0a) {
      offset += 1;
    }
  }

  return { lines, images };
}

function readEplDimensions(lines) {
  let widthDots = 812;
  let heightDots = 812;
  for (const line of lines) {
    if (line.startsWith('q')) {
      widthDots = Number.parseInt(line.slice(1), 10) || widthDots;
    } else if (line.startsWith('Q')) {
      heightDots = Number.parseInt(line.split(',')[0].slice(1), 10) || heightDots;
    }
  }
  return { widthDots, heightDots };
}

function extractQuotedText(value) {
  const match = String(value || '').match(/"([^"]*)"/);
  return match ? match[1] : '';
}

function parseEplLine(line) {
  const command = line[0];
  const value = line.slice(1);
  if (command === 'A') {
    const parts = value.split(',');
    const x = Number.parseInt(parts[0], 10) || 0;
    const y = Number.parseInt(parts[1], 10) || 0;
    const rotation = Number.parseInt(parts[2], 10) || 0;
    const font = Number.parseInt(parts[3], 10) || 3;
    const hmul = Number.parseInt(parts[4], 10) || 1;
    const vmul = Number.parseInt(parts[5], 10) || 1;
    const spec = getEplFontSpec(font, hmul, vmul);
    return {
      type: 'text',
      x,
      y,
      rotation,
      font,
      hmul,
      vmul,
      height: spec.cellHeight,
      xScale: spec.cellWidth / Math.max(1, spec.cellHeight * 0.6),
      text: extractQuotedText(value),
    };
  }
  if (command === 'B') {
    const parts = value.split(',');
    const x = Number.parseInt(parts[0], 10) || 0;
    const y = Number.parseInt(parts[1], 10) || 0;
    const barcodeType = String(parts[3] || '').trim();
    const narrow = Number.parseInt(parts[4], 10) || 2;
    const wide = Number.parseInt(parts[5], 10) || 4;
    const height = Number.parseInt(parts[6], 10) || 80;
    const readable = String(parts[7] || '').trim().toUpperCase() === 'B';
    return {
      type: 'barcode',
      x,
      y,
      barcodeType,
      narrow,
      wide,
      height,
      readable,
      text: extractQuotedText(value),
    };
  }
  if (command === 'X') {
    const parts = value.split(',');
    return {
      type: 'box',
      x: Number.parseInt(parts[0], 10) || 0,
      y: Number.parseInt(parts[1], 10) || 0,
      width: Number.parseInt(parts[2], 10) || 0,
      height: Number.parseInt(parts[3], 10) || 0,
      thickness: Number.parseInt(parts[4], 10) || 1,
    };
  }
  if (command === 'L' && value.startsWith('O')) {
    const parts = value.slice(1).split(',');
    return {
      type: 'fill',
      x: Number.parseInt(parts[0], 10) || 0,
      y: Number.parseInt(parts[1], 10) || 0,
      width: Number.parseInt(parts[2], 10) || 0,
      height: Number.parseInt(parts[3], 10) || 0,
    };
  }
  return null;
}

function escapeXml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderGwBitmapSvg(image) {
  const { x, y, bytesPerRow, height, data, width } = image;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 180));
  let rects = '';
  for (let row = 0; row < height; row += step) {
    for (let col = 0; col < width; col += step) {
      const byteIndex = row * bytesPerRow + (col >> 3);
      const bit = 7 - (col & 7);
      if (byteIndex < data.length && (data[byteIndex] >> bit) & 1) {
        rects += `<rect x="${x + col}" y="${y + row}" width="${step}" height="${step}" fill="#111827"/>`;
      }
    }
  }
  return rects;
}

function renderBarcodeSvg(item) {
  const barcodeMap = {
    1: 'code39',
    3: 'code39',
  };
  const bcid = barcodeMap[item.barcodeType] || 'code39';
  try {
    const svg = bwipjs.toSVG({
      bcid,
      text: item.text,
      scale: Math.max(1, item.narrow),
      height: Math.max(6, item.height / 8),
      includetext: item.readable,
      textxalign: 'center',
      textsize: 10,
    });
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number) || [];
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const svgWidth = viewBox[2] || Math.max(180, item.text.length * item.wide * 8);
    const svgHeight = viewBox[3] || item.height;
    const targetHeight = item.readable ? item.height + 26 : item.height;
    const scale = targetHeight / svgHeight;
    return `<g transform="translate(${item.x} ${item.y}) scale(${scale})" data-barcode-width="${svgWidth}">${inner}</g>`;
  } catch {
    return `<text x="${item.x}" y="${item.y + item.height}" font-size="18" font-family="monospace" fill="#111827">${escapeXml(item.text)}</text>`;
  }
}

function renderEplPreviewSvg(buffer) {
  const parsed = parseEplBuffer(buffer);
  const dims = readEplDimensions(parsed.lines);
  const width = dims.widthDots;
  const height = dims.heightDots;
  const body = [];

  for (const image of parsed.images) {
    body.push(renderGwBitmapSvg(image));
  }

  for (const line of parsed.lines) {
    const item = parseEplLine(line);
    if (!item) {
      continue;
    }
    if (item.type === 'text') {
      body.push(`<text x="0" y="${Math.round(item.height * 0.82)}" font-size="${item.height}" font-family="'Courier New', monospace" fill="#111827" transform="translate(${item.x} ${item.y}) scale(${item.xScale} 1)">${escapeXml(item.text)}</text>`);
    } else if (item.type === 'barcode') {
      body.push(renderBarcodeSvg(item));
    } else if (item.type === 'box') {
      body.push(`<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" fill="none" stroke="#111827" stroke-width="${item.thickness}"/>`);
    } else if (item.type === 'fill') {
      body.push(`<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" fill="#111827"/>`);
    }
  }

  const pad = 10;
  const outerWidth = width + pad * 2;
  const outerHeight = height + pad * 2 + 18;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="print-preview-label-svg" viewBox="0 0 ${outerWidth} ${outerHeight}" width="${outerWidth}" height="${outerHeight}">`,
    `<rect x="0" y="0" width="${outerWidth}" height="${outerHeight}" fill="#f5f5f4" rx="4"/>`,
    `<rect x="${pad}" y="${pad}" width="${width}" height="${height}" fill="#fff" stroke="#e5e5e5" stroke-width="1" rx="2"/>`,
    `<g transform="translate(${pad}, ${pad})">`,
    body.join(''),
    '</g>',
    `<text x="${outerWidth / 2}" y="${outerHeight - 4}" text-anchor="middle" fill="#a1a1aa" font-size="8" font-family="monospace">${width}×${height} dots (203 DPI)</text>`,
    '</svg>',
  ].join('');
}

function formatEplSourceText(buffer) {
  const parsed = parseEplBuffer(buffer);
  return parsed.lines.join('\n');
}

async function renderBarcodePng(item) {
  const barcodeMap = {
    1: 'code39',
    3: 'code39',
  };
  const bcid = barcodeMap[item.barcodeType] || 'code39';
  try {
    return await bwipToPng({
      bcid,
      text: item.text,
      scale: Math.max(1, item.narrow),
      height: Math.max(6, item.height / 8),
      includetext: item.readable,
      textxalign: 'center',
      textsize: 10,
    });
  } catch {
    return null;
  }
}

async function renderEplPreviewPng(buffer) {
  const parsed = parseEplBuffer(buffer);
  const dims = readEplDimensions(parsed.lines);
  const width = dims.widthDots;
  const height = dims.heightDots;
  const pad = 10;
  const canvas = createCanvas(width + pad * 2, height + pad * 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f5f4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pad, pad, width, height);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 0.5, pad + 0.5, width - 1, height - 1);
  ctx.save();
  ctx.translate(pad, pad);

  for (const image of parsed.images) {
    drawGwBitmap(ctx, image);
  }

  for (const line of parsed.lines) {
    const item = parseEplLine(line);
    if (!item) {
      continue;
    }
    if (item.type === 'text') {
      const spec = getEplFontSpec(item.font, item.hmul, item.vmul);
      drawFixedCellText(ctx, item.text, item.x, item.y, spec, { rotation: item.rotation });
    } else if (item.type === 'box') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = item.thickness;
      ctx.strokeRect(item.x + 0.5, item.y + 0.5, item.width, item.height);
    } else if (item.type === 'fill') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(item.x, item.y, item.width, item.height);
    } else if (item.type === 'barcode') {
      const png = await renderBarcodePng(item);
      if (png) {
        const img = await loadImage(png);
        const targetHeight = item.readable ? item.height + 26 : item.height;
        const scale = targetHeight / img.height;
        const drawWidth = img.width * scale;
        ctx.drawImage(img, item.x, item.y, drawWidth, targetHeight);
      } else {
        ctx.fillStyle = '#000000';
        ctx.font = '18px "Courier New", Courier, monospace';
        ctx.fillText(item.text, item.x, item.y + item.height);
      }
    }
  }

  ctx.restore();
  const png = canvas.toBuffer('image/png');
  return buildPreviewRasterMarkup(png, {
    pageClass: 'print-preview-label-page',
    extraClass: 'print-preview-epl-raster',
    width: canvas.width,
    height: canvas.height,
    caption: `${width}×${height} dots (203 DPI)`,
    alt: 'EPL preview',
  });
}

module.exports = {
  formatEplSourceText,
  parseEplBuffer,
  readEplDimensions,
  renderEplPreviewPng,
  renderEplPreviewSvg,
  renderGwBitmapSvg,
};
