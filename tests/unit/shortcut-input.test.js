const { isOdooDebugShortcutInput } = require('../../src/shared/shortcut-input');

describe('shortcut-input', () => {
  it('detecta Cmd+Shift+D en keyDown', () => {
    expect(isOdooDebugShortcutInput({
      type: 'keyDown',
      key: 'D',
      meta: true,
      shift: true,
      alt: false,
      control: false,
      isAutoRepeat: false,
    })).toBe(true);
  });

  it('detecta Cmd+Shift+D en rawKeyDown', () => {
    expect(isOdooDebugShortcutInput({
      type: 'rawKeyDown',
      code: 'KeyD',
      meta: true,
      shift: true,
      alt: false,
      control: false,
      isAutoRepeat: false,
    })).toBe(true);
  });

  it('ignora pulsaciones sin shift', () => {
    expect(isOdooDebugShortcutInput({
      type: 'keyDown',
      key: 'd',
      meta: true,
      shift: false,
      isAutoRepeat: false,
    })).toBe(false);
  });
});
