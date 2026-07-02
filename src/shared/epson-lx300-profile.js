const EPSON_LX300_PLUS_II = {
  model: 'Epson LX-300+II',
  emulation: 'ESC/P',
  paper: 'letter',
  dpiX: 240,
  dpiY: 144,
  pins: 9,
  printableWidthIn: 8,
  pageWidthIn: 8.5,
  pageHeightIn: 11,
  marginLeftIn: 0.25,
  marginRightIn: 0.25,
  marginTopIn: 1 / 6,
  marginBottomIn: 1 / 6,
  columnsAt10Cpi: 80,
  defaultCpi: 10,
  defaultLpi: 6,
  cpiValues: {
    10: 10,
    12: 12,
    15: 15,
    17: 17,
  },
};

const LX300_FONT_FACES = {
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

function normalizeLx300FontFace(value) {
  const face = String(value || 'draft').trim().toLowerCase();
  if (face === 'roman' || face === 'sans' || face === 'courier') {
    return face;
  }
  return 'draft';
}

function resolveLx300Cpi(state = {}) {
  if (state.condensed) {
    return 17;
  }
  const cpi = Number(state.cpi);
  if (EPSON_LX300_PLUS_II.cpiValues[cpi]) {
    return cpi;
  }
  return EPSON_LX300_PLUS_II.defaultCpi;
}

function getLx300Typography(state = {}, profile = EPSON_LX300_PLUS_II) {
  const fontFace = normalizeLx300FontFace(state.fontFace);
  const face = LX300_FONT_FACES[fontFace];
  const cpi = resolveLx300Cpi(state);
  const lpi = state.lpi === 8 ? 8 : profile.defaultLpi;
  const charWidth = profile.dpiX / cpi;
  const lineHeight = profile.dpiY / lpi;
  const fontScale = {
    sans: 0.86,
    roman: 0.88,
    courier: 0.92,
    draft: 0.92,
  }[fontFace] || 0.9;
  const fontSize = Math.round(lineHeight * fontScale);
  return {
    ...face,
    fontFace,
    charWidth,
    lineHeight,
    fontSize,
    cpi,
    lpi,
    columns: Math.floor((profile.printableWidthIn * profile.dpiX) / charWidth),
    quality: state.quality === 'lq' ? 'lq' : 'draft',
  };
}

function getLx300PageCanvasSize(profile = EPSON_LX300_PLUS_II) {
  return {
    width: Math.round(profile.pageWidthIn * profile.dpiX),
    height: Math.round(profile.pageHeightIn * profile.dpiY),
    marginLeft: Math.round(profile.marginLeftIn * profile.dpiX),
    marginRight: Math.round(profile.marginRightIn * profile.dpiX),
    marginTop: Math.round(profile.marginTopIn * profile.dpiY),
    marginBottom: Math.round(profile.marginBottomIn * profile.dpiY),
    printableWidth: Math.round(profile.printableWidthIn * profile.dpiX),
  };
}

module.exports = {
  EPSON_LX300_PLUS_II,
  LX300_FONT_FACES,
  getLx300PageCanvasSize,
  getLx300Typography,
  normalizeLx300FontFace,
  resolveLx300Cpi,
};
