const { isOdooDebugShortcutInput } = require('../../src/shared/shortcut-input');

describe('shortcut-input', () => {
  it('detecta Cmd+. en keyDown', () => {
    expect(isOdooDebugShortcutInput({
      type: 'keyDown',
      key: '.',
      meta: true,
      shift: false,
      alt: false,
      control: false,
      isAutoRepeat: false,
    })).toBe(true);
  });

  it('detecta Cmd+. en rawKeyDown', () => {
    expect(isOdooDebugShortcutInput({
      type: 'rawKeyDown',
      code: 'Period',
      meta: true,
      shift: false,
      alt: false,
      control: false,
      isAutoRepeat: false,
    })).toBe(true);
  });

  it('ignora pulsaciones con shift', () => {
    expect(isOdooDebugShortcutInput({
      type: 'keyDown',
      key: '.',
      meta: true,
      shift: true,
      isAutoRepeat: false,
    })).toBe(false);
  });

  it('detecta CommandOrControl+F', () => {
    const { matchesAccelerator } = require('../../src/shared/shortcut-input');
    expect(matchesAccelerator({
      type: 'keyDown',
      key: 'f',
      meta: true,
      shift: false,
      alt: false,
      control: false,
      isAutoRepeat: false,
    }, 'CommandOrControl+F', 'darwin')).toBe(true);
  });

  it('no detecta CommandOrControl+F sin meta/control', () => {
    const { matchesAccelerator } = require('../../src/shared/shortcut-input');
    expect(matchesAccelerator({
      type: 'keyDown',
      key: 'f',
      meta: false,
      shift: false,
      alt: false,
      control: false,
      isAutoRepeat: false,
    }, 'CommandOrControl+F', 'darwin')).toBe(false);
  });
});
