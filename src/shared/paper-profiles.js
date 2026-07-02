const US_LETTER = {
  kind: 'sheet',
  label: 'Carta',
  widthIn: 8.5,
  heightIn: 11,
  printableWidthIn: 8,
  marginLeftIn: 0.25,
  marginRightIn: 0.25,
  marginTopIn: 1 / 6,
  marginBottomIn: 1 / 6,
};

const THERMAL_80MM = {
  kind: 'roll',
  label: '80 mm',
  widthMm: 80,
  dpi: 203,
  marginXDots: 8,
  marginYDots: 12,
};

function inchesToDots(inches, dpi) {
  return Math.round(inches * dpi);
}

function mmToDots(mm, dpi = THERMAL_80MM.dpi) {
  return Math.round((mm / 25.4) * dpi);
}

function getLetterCanvasSize(dpiX, dpiY, profile = US_LETTER) {
  return {
    width: inchesToDots(profile.widthIn, dpiX),
    height: inchesToDots(profile.heightIn, dpiY),
    marginLeft: inchesToDots(profile.marginLeftIn, dpiX),
    marginRight: inchesToDots(profile.marginRightIn, dpiX),
    marginTop: inchesToDots(profile.marginTopIn, dpiY),
    marginBottom: inchesToDots(profile.marginBottomIn, dpiY),
    printableWidth: inchesToDots(profile.printableWidthIn, dpiX),
  };
}

function getThermal80mmCanvasWidth(profile = THERMAL_80MM) {
  return mmToDots(profile.widthMm, profile.dpi);
}

module.exports = {
  US_LETTER,
  THERMAL_80MM,
  getLetterCanvasSize,
  getThermal80mmCanvasWidth,
  inchesToDots,
  mmToDots,
};
