#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildLx300ReferencePayload } = require('../src/shared/lx300-reference-print');
const { renderEscpPreviewPng, PAGE_LAYOUT } = require('../src/shared/escp-preview');

function extractPngBuffer(markup) {
  const match = String(markup || '').match(/data:image\/png;base64,([^"']+)/);
  if (!match) {
    throw new Error('No PNG found in preview markup');
  }
  return Buffer.from(match[1], 'base64');
}

function main() {
  const outDir = path.resolve(process.cwd(), 'dist');
  const rawPath = path.join(outDir, 'lx300-reference-print.bin');
  const pngPath = path.join(outDir, 'lx300-reference-preview.png');
  const htmlPath = path.join(outDir, 'lx300-reference-preview.html');

  const payload = buildLx300ReferencePayload();
  const markup = renderEscpPreviewPng(payload);
  const png = extractPngBuffer(markup);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(rawPath, payload);
  fs.writeFileSync(pngPath, png);
  fs.writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><title>LX-300+II reference</title>
<style>body{margin:0;background:#666;display:flex;justify-content:center;padding:24px}
img{image-rendering:pixelated;box-shadow:0 8px 32px rgba(0,0,0,.35);background:#fff}</style></head>
<body><img src="lx300-reference-preview.png" width="${PAGE_LAYOUT.width}" height="${PAGE_LAYOUT.height}" alt="LX-300+II reference"></body></html>`,
  );

  process.stdout.write(`LX-300+II reference written:\n  ${rawPath}\n  ${pngPath}\n  ${htmlPath}\n`);
}

main();
