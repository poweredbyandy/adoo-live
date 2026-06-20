const {
  parseCommitMessage,
  buildChangelogSectionFromGit,
} = require('../../scripts/lib/changelog-from-git');

describe('changelog-from-git', () => {
  it('clasifica commits con tag y módulo', () => {
    const parsed = parseCommitMessage('[ADD] odoo-kiosk: add home panel');
    expect(parsed).toEqual({
      section: 'Added',
      line: 'odoo-kiosk: add home panel',
    });
  });

  it('clasifica fixes', () => {
    const parsed = parseCommitMessage('[FIX] shell: close menu on backdrop click');
    expect(parsed?.section).toBe('Fixed');
  });

  it('omite commits de release y mantenimiento', () => {
    expect(parseCommitMessage('[REL] odoo-kiosk: prepare release v1.0.0')).toBeNull();
    expect(parseCommitMessage('[CLN] ui: lint pass')).toBeNull();
    expect(parseCommitMessage('Release v1.0.0-beta.1')).toBeNull();
  });

  it('coloca commits sin tag en Other', () => {
    const parsed = parseCommitMessage('random commit without format');
    expect(parsed?.section).toBe('Other');
  });

  it('genera markdown de sección', () => {
    const section = buildChangelogSectionFromGit('1.0.0-beta.1');
    expect(section).toContain('## [1.0.0-beta.1]');
    expect(section).toMatch(/### (Added|Changed|Fixed|Other)/);
  });
});
