const GITHUB_OWNER = 'poweredbyandy';
const GITHUB_REPO = 'adoo-live';

async function fetchLatestRelease(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) {
    throw new Error('fetch is not available to query GitHub releases.');
  }
  const response = await fetchImpl(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'odoo-kiosk-browser',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub release lookup failed (${response.status}).`);
  }
  const payload = await response.json();
  const tagName = String(payload.tag_name || '').trim();
  if (!tagName) {
    throw new Error('GitHub release response did not include a tag.');
  }
  return {
    version: tagName.replace(/^v/i, ''),
    tagName,
    releaseUrl: payload.html_url || '',
    releaseNotes: payload.body || '',
    publishedAt: payload.published_at || '',
  };
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  fetchLatestRelease,
};
