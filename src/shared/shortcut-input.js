function isShortcutKeyEvent(input) {
  return Boolean(input && (input.type === 'keyDown' || input.type === 'rawKeyDown'));
}

function isOdooDebugShortcutInput(input) {
  if (!isShortcutKeyEvent(input) || input.isAutoRepeat) {
    return false;
  }
  const modifier = input.control || input.meta;
  if (!modifier || !input.shift || input.alt) {
    return false;
  }
  const key = String(input.key || '').toLowerCase();
  return key === 'd' || input.code === 'KeyD';
}

function matchesKeyToken(input, keyToken) {
  const key = String(input.key || '');
  const code = String(input.code || '');
  const lower = key.toLowerCase();

  switch (keyToken) {
    case 'Plus':
      return key === '+' || code === 'Equal' || code === 'NumpadAdd';
    case '-':
      return key === '-' || code === 'Minus' || code === 'NumpadSubtract';
    case '0':
      return key === '0' || code === 'Digit0' || code === 'Numpad0';
    case 'Esc':
      return lower === 'escape' || code === 'Escape';
    case 'Left':
      return code === 'ArrowLeft' || lower === 'arrowleft';
    case 'Right':
      return code === 'ArrowRight' || lower === 'arrowright';
    case 'Home':
      return lower === 'home' || code === 'Home';
    default:
      if (keyToken.length === 1) {
        return lower === keyToken.toLowerCase()
          || code === `Key${keyToken.toUpperCase()}`
          || code === `Digit${keyToken}`;
      }
      return lower === keyToken.toLowerCase() || code === keyToken;
  }
}

function matchesAccelerator(input, accelerator, platform = process.platform) {
  if (!isShortcutKeyEvent(input) || input.isAutoRepeat) {
    return false;
  }

  const parts = String(accelerator || '').split('+').filter(Boolean);
  if (!parts.length) {
    return false;
  }

  const keyToken = parts[parts.length - 1];
  const modParts = parts.slice(0, -1);
  const wantsCmdOrCtrl = modParts.some((mod) => mod === 'CommandOrControl' || mod === 'Command' || mod === 'Control');
  const wantsShift = modParts.includes('Shift');
  const wantsAlt = modParts.includes('Alt');

  if (wantsCmdOrCtrl) {
    const modifierOk = platform === 'darwin'
      ? Boolean(input.meta || input.control)
      : Boolean(input.control || input.meta);
    if (!modifierOk) {
      return false;
    }
  } else if (input.meta || input.control) {
    return false;
  }

  if (wantsShift !== Boolean(input.shift)) {
    return false;
  }

  if (wantsAlt !== Boolean(input.alt)) {
    return false;
  }

  return matchesKeyToken(input, keyToken);
}

module.exports = {
  isShortcutKeyEvent,
  isOdooDebugShortcutInput,
  matchesAccelerator,
  matchesKeyToken,
};
