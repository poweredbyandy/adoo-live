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

module.exports = { isShortcutKeyEvent, isOdooDebugShortcutInput };
