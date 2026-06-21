const { compareVersions } = require('./version-utils');

const GITHUB_OWNER = 'poweredbyandy';
const GITHUB_REPO = 'adoo-live';

function normalizeReleasePayload(payload) {
  const tagName = String(payload.tag_name || '').trim();
  if (!tagName) {
    return null;
  }
  return {
    version: tagName.replace(/^v/i, ''),
    tagName,
    releaseUrl: payload.html_url || '',
    releaseNotes: payload.body || '',
    publishedAt: payload.published_at || '',
    prerelease: Boolean(payload.prerelease),
  };
}

function pickLatestRelease(releases) {
  let latest = null;
  for (const release of releases) {
    if (!release || release.draft) {
      continue;
    }
    const normalized = normalizeReleasePayload(release);
    if (!normalized) {
      continue;
    }
    if (!latest || compareVersions(normalized.version, latest.version) > 0) {
      latest = normalized;
    }
  }
  return latest;
}

async function fetchLatestRelease(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) {
    throw new Error('fetch is not available to query GitHub releases.');
  }
  const response = await fetchImpl(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=100`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'odoo-kiosk-browser',
      },
    },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GitHub release lookup failed (${response.status}).`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload) || !payload.length) {
    return null;
  }
  return pickLatestRelease(payload);
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  fetchLatestRelease,
  pickLatestRelease,
};
