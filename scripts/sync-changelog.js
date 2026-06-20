const fs = require('fs');
const path = require('path');
const { buildChangelogSectionFromGit } = require('./lib/changelog-from-git');

const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');
const UNRELEASED_HEADER = '## [Unreleased]';

function readChangelog() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    return '# Changelog\n\n';
  }
  return fs.readFileSync(CHANGELOG_PATH, 'utf8');
}

function extractUnreleasedBullets(content) {
  const unreleasedMatch = content.match(/## \[Unreleased\][\s\S]*?(?=^## \[|\s*$)/m);
  if (!unreleasedMatch) {
    return [];
  }
  const bullets = [];
  unreleasedMatch[0].split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      bullets.push(trimmed.slice(2));
    }
  });
  return bullets;
}

function mergeUnreleasedIntoSection(sectionMarkdown, unreleasedBullets) {
  if (!unreleasedBullets.length) {
    return sectionMarkdown;
  }
  const extraBlock = `### Added\n\n${unreleasedBullets.map((item) => `- ${item}`).join('\n')}\n`;
  if (sectionMarkdown.includes('### Added')) {
    return sectionMarkdown.replace(
      /(### Added\n\n)/,
      `$1${unreleasedBullets.map((item) => `- ${item}\n`).join('')}`,
    );
  }
  return `${sectionMarkdown}\n\n${extraBlock}`.trimEnd();
}

function upsertVersionSection(content, version, sectionMarkdown) {
  const versionHeader = `## [${version}]`;
  const sectionWithHeader = sectionMarkdown.startsWith(versionHeader)
    ? sectionMarkdown
    : `${versionHeader}\n\n${sectionMarkdown.replace(/^## \[[^\]]+\]\s*\n?/, '')}`;

  if (content.includes(versionHeader)) {
    const pattern = new RegExp(
      `## \\[${version.replace(/\./g, '\\.')}\\][\\s\\S]*?(?=^## \\[|$)`,
      'm',
    );
    return content.replace(pattern, sectionWithHeader.trimEnd());
  }

  if (content.includes(UNRELEASED_HEADER)) {
    return content.replace(
      UNRELEASED_HEADER,
      `${UNRELEASED_HEADER}\n\n### Added\n\n### Changed\n\n### Fixed\n\n${sectionWithHeader.trimEnd()}`,
    );
  }

  return `${content.trimEnd()}\n\n${sectionWithHeader.trimEnd()}\n`;
}

function clearUnreleasedBullets(content) {
  return content.replace(
    /(## \[Unreleased\][\s\S]*?)(?=^## \[)/m,
    '## [Unreleased]\n\n### Added\n\n### Changed\n\n### Fixed\n\n',
  );
}

function syncChangelog(version) {
  const unreleasedBullets = extractUnreleasedBullets(readChangelog());
  let section = buildChangelogSectionFromGit(version);
  section = mergeUnreleasedIntoSection(section, unreleasedBullets);

  let content = readChangelog();
  content = upsertVersionSection(content, version, section);
  content = clearUnreleasedBullets(content);
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  fs.writeFileSync(CHANGELOG_PATH, content);
  return section;
}

const version = process.env.VERSION || process.argv[2];
if (!version) {
  console.error('Usage: VERSION=1.0.0 node scripts/sync-changelog.js');
  process.exit(1);
}

const section = syncChangelog(version.replace(/^v/, ''));
process.stdout.write(section);
