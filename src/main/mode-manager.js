const { MODES } = require('../shared/constants');
const { isValidMode } = require('../shared/validators');

function canHaveTabs(mode) {
  return mode !== MODES.KIOSK;
}

function canEditUrl(mode) {
  return mode !== MODES.KIOSK;
}

function shouldAutoOpenDevTools(mode) {
  return mode === MODES.DEVELOPER;
}

function isNavigationRestricted(mode) {
  return mode === MODES.KIOSK;
}

function isVerboseLogging(mode) {
  return mode === MODES.DEVELOPER;
}

function isValidTransition(fromMode, toMode) {
  if (!isValidMode(fromMode) || !isValidMode(toMode)) {
    return false;
  }
  return fromMode !== toMode;
}

function validateDeveloperPin(pin, expectedPin) {
  if (!expectedPin) {
    return true;
  }
  return String(pin || '') === String(expectedPin);
}

function getModeCapabilities(mode) {
  return {
    mode,
    canHaveTabs: canHaveTabs(mode),
    canEditUrl: canEditUrl(mode),
    autoDevTools: shouldAutoOpenDevTools(mode),
    navigationRestricted: isNavigationRestricted(mode),
    verboseLogging: isVerboseLogging(mode),
  };
}

class ModeManager {
  constructor(initialMode = MODES.KIOSK) {
    this.mode = isValidMode(initialMode) ? initialMode : MODES.KIOSK;
  }

  getMode() {
    return this.mode;
  }

  getCapabilities() {
    return getModeCapabilities(this.mode);
  }

  setMode(nextMode, pin, expectedPin) {
    if (!isValidMode(nextMode)) {
      throw new Error(`Invalid mode: ${nextMode}`);
    }
    if (!isValidTransition(this.mode, nextMode)) {
      return this.getCapabilities();
    }
    if (nextMode === MODES.DEVELOPER && !validateDeveloperPin(pin, expectedPin)) {
      throw new Error('Invalid developer PIN');
    }
    this.mode = nextMode;
    return this.getCapabilities();
  }
}

module.exports = {
  ModeManager,
  canHaveTabs,
  canEditUrl,
  shouldAutoOpenDevTools,
  isNavigationRestricted,
  isVerboseLogging,
  isValidTransition,
  validateDeveloperPin,
  getModeCapabilities,
};
