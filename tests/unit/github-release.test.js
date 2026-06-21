const { pickLatestRelease } = require('../../src/shared/github-release');

describe('github-release', () => {
  it('elige la release más reciente incluyendo pre-releases', () => {
    const latest = pickLatestRelease([
      { tag_name: 'v1.0.0-beta.6', draft: false, html_url: 'https://example.test/b6' },
      { tag_name: 'v1.0.0-beta.7', draft: false, html_url: 'https://example.test/b7', prerelease: true },
      { tag_name: 'v1.0.0-beta.5', draft: false, html_url: 'https://example.test/b5' },
    ]);
    expect(latest.version).toBe('1.0.0-beta.7');
    expect(latest.releaseUrl).toBe('https://example.test/b7');
  });

  it('ignora borradores', () => {
    const latest = pickLatestRelease([
      { tag_name: 'v2.0.0', draft: true, html_url: 'https://example.test/draft' },
      { tag_name: 'v1.0.0-beta.6', draft: false, html_url: 'https://example.test/b6' },
    ]);
    expect(latest.version).toBe('1.0.0-beta.6');
  });
});
