const { buildContextMenuTemplate } = require('../../src/main/context-menu');
const { initI18n } = require('../../src/i18n');

describe('context-menu', () => {
  const webContents = {
    cut: () => {},
    copy: () => {},
    paste: () => {},
    undo: () => {},
    redo: () => {},
    delete: () => {},
    selectAll: () => {},
  };

  beforeEach(() => {
    initI18n('en');
  });

  it('incluye cortar, copiar y pegar en campos editables', () => {
    const template = buildContextMenuTemplate(webContents, {
      isEditable: true,
      editFlags: {
        canUndo: false,
        canRedo: false,
        canCut: true,
        canCopy: true,
        canPaste: true,
        canDelete: false,
        canSelectAll: true,
      },
    });
    const labels = template.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Cut');
    expect(labels).toContain('Copy');
    expect(labels).toContain('Paste');
    expect(labels).toContain('Select all');
  });

  it('incluye copiar enlace y navegación en páginas', () => {
    const template = buildContextMenuTemplate(webContents, {
      linkURL: 'https://example.com',
      editFlags: {
        canUndo: false,
        canRedo: false,
        canCut: false,
        canCopy: true,
        canPaste: false,
        canDelete: false,
        canSelectAll: false,
      },
    }, {
      showNavigation: true,
      canGoBack: () => true,
      canGoForward: () => false,
      goBack: () => {},
      goForward: () => {},
      reload: () => {},
      onOpenLink: () => {},
    });
    const labels = template.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Copy link address');
    expect(labels).toContain('Open link in new tab');
    expect(labels).toContain('Back');
    expect(labels).toContain('Reload');
  });
});
