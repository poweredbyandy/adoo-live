const { t } = require('../i18n');

function buildFindOptions(options = {}) {
  return {
    forward: options.forward !== false,
    findNext: !options.followUp,
    matchCase: Boolean(options.matchCase),
  };
}

function formatFindStatus(result) {
  if (!result || !result.query) {
    return { label: '', matches: 0, activeMatchOrdinal: 0, query: '' };
  }
  const rawMatches = Number(result.matches);
  if (rawMatches < 0) {
    return {
      label: t('Searching...'),
      matches: -1,
      activeMatchOrdinal: 0,
      query: result.query,
    };
  }
  const matches = Math.max(0, rawMatches || 0);
  const activeMatchOrdinal = Math.max(0, Number(result.activeMatchOrdinal) || 0);
  if (matches === 0) {
    return {
      label: t('No results'),
      matches: 0,
      activeMatchOrdinal: 0,
      query: result.query,
    };
  }
  return {
    label: t('%(current)s of %(total)s', { current: activeMatchOrdinal, total: matches }),
    matches,
    activeMatchOrdinal,
    query: result.query,
  };
}

module.exports = { buildFindOptions, formatFindStatus };
