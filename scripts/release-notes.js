const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');

function extractChangelogSection(version) {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    return '';
  }
  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const blocks = changelog.split(/^## /m);
  for (const block of blocks) {
    const headerMatch = block.match(/^\[([^\]]+)\]/);
    if (!headerMatch) {
      continue;
    }
    if (headerMatch[1] === version) {
      return block.replace(/^\[[^\]]+\]\s*/, '').trim();
    }
  }
  return '';
}

function buildReleaseBody(version) {
  const section = extractChangelogSection(version);
  let body = `## adoo IoT v${version}\n\n`;
  if (section) {
    body += section;
  } else {
    body += 'See the auto-generated notes below for merged changes in this release.';
  }
  return body;
}

const version = process.env.VERSION || process.argv[2];
if (!version) {
  console.error('Usage: VERSION=1.0.0 node scripts/release-notes.js');
  process.exit(1);
}

process.stdout.write(buildReleaseBody(version.replace(/^v/, '')));
