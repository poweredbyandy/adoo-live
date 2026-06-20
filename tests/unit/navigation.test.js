const { canGoBack, canGoForward, goBack, goForward } = require('../../src/main/navigation');

describe('navigation helpers', () => {
  it('usa navigationHistory cuando existe', () => {
    const calls = [];
    const webContents = {
      navigationHistory: {
        canGoBack: () => true,
        canGoForward: () => false,
        goBack: () => calls.push('history-back'),
        goForward: () => calls.push('history-forward'),
      },
      canGoBack: () => false,
      goBack: () => calls.push('legacy-back'),
    };

    expect(canGoBack(webContents)).toBe(true);
    expect(canGoForward(webContents)).toBe(false);
    goBack(webContents);
    expect(calls).toEqual(['history-back']);
  });

  it('usa API legacy como fallback', () => {
    const calls = [];
    const webContents = {
      canGoBack: () => true,
      canGoForward: () => true,
      goBack: () => calls.push('legacy-back'),
      goForward: () => calls.push('legacy-forward'),
    };

    expect(canGoBack(webContents)).toBe(true);
    goForward(webContents);
    expect(calls).toEqual(['legacy-forward']);
  });
});
