const { GlobalFonts } = require('@napi-rs/canvas');
const {
  EPSON_LX300_PLUS_II,
  getLx300Typography,
  normalizeLx300FontFace,
} = require('./epson-lx300-profile');

let systemFontsLoaded = false;

function ensureSystemFonts() {
  if (!systemFontsLoaded) {
    GlobalFonts.loadSystemFonts();
    systemFontsLoaded = true;
  }
}

const EPL_FONTS_203 = {
  1: {
    width: 8,
    height: 12,
    family: '"DejaVu Sans Mono", "Courier New", monospace',
    weight: 'normal',
    uppercaseOnly: false,
  },
  2: {
    width: 10,
    height: 16,
    family: '"DejaVu Sans Mono", "Courier New", monospace',
    weight: 'normal',
    uppercaseOnly: false,
  },
  3: {
    width: 12,
    height: 20,
    family: '"DejaVu Sans Mono", "Courier New", monospace',
    weight: 'normal',
    uppercaseOnly: false,
  },
  4: {
    width: 14,
    height: 24,
    family: '"DejaVu Sans Mono", "Courier New", monospace',
    weight: '600',
    uppercaseOnly: false,
  },
  5: {
    width: 32,
    height: 48,
    family: '"DejaVu Sans Mono", "Courier New", monospace',
    weight: '700',
    uppercaseOnly: true,
  },
};

const ESCP_FONT_FACES = {
  draft: {
    family: '"Courier New", Courier, monospace',
    weight: '400',
    style: 'normal',
  },
  roman: {
    family: '"Times New Roman", Times, serif',
    weight: '400',
    style: 'normal',
  },
  sans: {
    family: 'Helvetica, Arial, sans-serif',
    weight: '400',
    style: 'normal',
  },
  courier: {
    family: '"Courier New", Courier, monospace',
    weight: '400',
    style: 'normal',
  },
};

const ESCPOS_FONTS = {
  A: {
    widthDots: 12,
    heightDots: 24,
    family: '"DejaVu Sans Mono", "Courier New", monospace',
    weight: 'normal',
  },
  B: {
    widthDots: 9,
    heightDots: 17,
    family: '"DejaVu Sans Mono", "Courier New", monospace',
    weight: 'normal',
  },
};

function getEplFontSpec(fontNumber, hmul = 1, vmul = 1) {
  const base = EPL_FONTS_203[fontNumber] || EPL_FONTS_203[3];
  const h = Math.max(1, hmul);
  const v = Math.max(1, vmul);
  return {
    font: fontNumber,
    cellWidth: base.width * h,
    cellHeight: base.height * v,
    fontSize: base.height * v,
    family: base.family,
    fontWeight: base.weight,
    uppercaseOnly: base.uppercaseOnly,
  };
}

function normalizeEscpFontFace(value) {
  return normalizeLx300FontFace(value);
}

function getEscpTypography(state = {}) {
  const typography = getLx300Typography(state, EPSON_LX300_PLUS_II);
  let fontWeight = typography.weight;
  if (state.bold || state.doubleStrike) {
    fontWeight = '700';
  } else if (state.quality === 'lq') {
    fontWeight = '500';
  }
  return {
    ...typography,
    fontWeight,
    fontStyle: state.italic ? 'italic' : typography.style,
  };
}

function getEscposFontSpec(state = {}) {
  const base = state.fontB ? ESCPOS_FONTS.B : ESCPOS_FONTS.A;
  const widthScale = state.doubleWidth ? 2 : 1;
  const heightScale = state.doubleHeight ? 2 : 1;
  return {
    charWidth: base.widthDots * widthScale,
    lineHeight: base.heightDots * heightScale,
    fontSize: Math.round(base.heightDots * heightScale * 0.82),
    family: base.family,
    fontWeight: state.bold ? 'bold' : base.weight,
    fontKey: state.fontB ? 'B' : 'A',
  };
}

function drawFixedCellText(ctx, text, x, y, spec, options = {}) {
  ensureSystemFonts();
  const content = spec.uppercaseOnly ? String(text || '').toUpperCase() : String(text || '');
  const cellW = spec.cellWidth || spec.charWidth;
  const cellH = spec.cellHeight || spec.lineHeight;
  ctx.save();
  ctx.translate(x, y);
  if (options.rotation) {
    ctx.rotate((options.rotation * Math.PI) / 2);
  }
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const offsetX = index * cellW;
    ctx.font = `${spec.fontStyle || 'normal'} ${spec.fontWeight || 'normal'} ${spec.fontSize}px ${spec.family}`;
    const metrics = ctx.measureText(char);
    const scaleX = metrics.width > 0 ? cellW / metrics.width : 1;
    const scaleY = spec.fontSize > 0 ? cellH / spec.fontSize : 1;
    ctx.save();
    ctx.translate(offsetX, 0);
    ctx.scale(scaleX, scaleY);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawEscpChar(ctx, char, x, y, typography, options = {}) {
  const cellW = options.wide ? typography.charWidth * 2 : typography.charWidth;
  const cellH = typography.lineHeight;
  drawFixedCellText(ctx, char, x, y, {
    cellWidth: cellW,
    cellHeight: cellH,
    charWidth: cellW,
    lineHeight: cellH,
    fontSize: typography.fontSize,
    family: typography.family,
    fontWeight: typography.fontWeight,
    fontStyle: typography.fontStyle,
  });
}

module.exports = {
  EPL_FONTS_203,
  ESCP_FONT_FACES,
  ESCPOS_FONTS,
  EPSON_LX300_PLUS_II,
  drawEscpChar,
  drawFixedCellText,
  ensureSystemFonts,
  getEplFontSpec,
  getEscpTypography,
  getEscposFontSpec,
  normalizeEscpFontFace,
};
