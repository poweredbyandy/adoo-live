const { execFileSync } = require('child_process');

const COMMIT_PATTERN = /^\[([A-Z]+)\]\s+([^:]+):\s*(.+)$/;
const COMMIT_PATTERN_SHORT = /^\[([A-Z]+)\]\s+(.+)$/;

const TAG_TO_SECTION = {
  ADD: 'Added',
  FIX: 'Fixed',
  IMP: 'Changed',
  REF: 'Changed',
  PERF: 'Changed',
  REM: 'Removed',
  REV: 'Removed',
  I18N: 'Translations',
  MOV: 'Changed',
};

const SKIP_TAGS = new Set(['REL', 'MERGE', 'CLA', 'CLN', 'LINT']);

const SECTION_ORDER = ['Added', 'Changed', 'Fixed', 'Removed', 'Translations', 'Other'];

function runGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function getPreviousTag(currentTag) {
  const tags = runGit(['tag', '-l', 'v*', '--sort=-v:refname'])
    .split('\n')
    .filter(Boolean)
    .filter((tag) => tag !== currentTag);
  return tags[0] || '';
}

function getCommitMessages(currentTag) {
  const previousTag = getPreviousTag(currentTag);
  const range = previousTag ? `${previousTag}..${currentTag}` : currentTag;
  const raw = runGit([
    'log',
    range,
    '--no-merges',
    '--pretty=format:%s',
  ]);
  if (!raw) {
    return [];
  }
  return raw.split('\n').map((line) => line.trim()).filter(Boolean);
}

function shouldSkipMessage(message) {
  if (/^release v/i.test(message)) {
    return true;
  }
  if (/^merge /i.test(message)) {
    return true;
  }
  return false;
}

function parseCommitMessage(message) {
  if (shouldSkipMessage(message)) {
    return null;
  }

  let match = message.match(COMMIT_PATTERN);
  if (match) {
    const tag = match[1];
    if (SKIP_TAGS.has(tag)) {
      return null;
    }
    const moduleName = match[2].trim();
    const description = match[3].trim();
    const section = TAG_TO_SECTION[tag] || 'Other';
    return {
      section,
      line: `${moduleName}: ${description}`,
    };
  }

  match = message.match(COMMIT_PATTERN_SHORT);
  if (match) {
    const tag = match[1];
    if (SKIP_TAGS.has(tag)) {
      return null;
    }
    const section = TAG_TO_SECTION[tag] || 'Other';
    return {
      section,
      line: match[2].trim(),
    };
  }

  return {
    section: 'Other',
    line: message,
  };
}

function groupCommitsBySection(messages) {
  const grouped = Object.fromEntries(SECTION_ORDER.map((section) => [section, []]));
  messages.forEach((message) => {
    const parsed = parseCommitMessage(message);
    if (!parsed) {
      return;
    }
    if (!grouped[parsed.section]) {
      grouped[parsed.section] = [];
    }
    grouped[parsed.section].push(parsed.line);
  });
  return grouped;
}

function formatSectionMarkdown(version, grouped) {
  let markdown = `## [${version}]\n\n`;
  let hasContent = false;

  SECTION_ORDER.forEach((sectionName) => {
    const items = grouped[sectionName] || [];
    if (!items.length) {
      return;
    }
    hasContent = true;
    markdown += `### ${sectionName}\n\n`;
    items.forEach((item) => {
      markdown += `- ${item}\n`;
    });
    markdown += '\n';
  });

  if (!hasContent) {
    return `## [${version}]\n\n### Changed\n\n- Maintenance release.\n`;
  }

  return markdown.trimEnd();
}

function buildChangelogSectionFromGit(version) {
  const currentTag = version.startsWith('v') ? version : `v${version}`;
  const messages = getCommitMessages(currentTag);
  const grouped = groupCommitsBySection(messages);
  return formatSectionMarkdown(version.replace(/^v/, ''), grouped);
}

module.exports = {
  SECTION_ORDER,
  TAG_TO_SECTION,
  SKIP_TAGS,
  parseCommitMessage,
  buildChangelogSectionFromGit,
  getPreviousTag,
  getCommitMessages,
};
