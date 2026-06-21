function parseVersionParts(value) {
  const normalized = String(value || '').trim().replace(/^v/i, '');
  const core = normalized.split('-')[0];
  return core.split('.').map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

function parseVersion(value) {
  const normalized = String(value || '').trim().replace(/^v/i, '');
  const match = normalized.match(/^(\d+(?:\.\d+)*)(?:-(.+))?$/);
  if (!match) {
    return { core: [0], prerelease: '' };
  }
  const core = match[1].split('.').map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  return { core, prerelease: match[2] || '' };
}

function comparePrereleaseIdent(left, right) {
  const leftParts = left.split('.');
  const rightParts = right.split('.');
  const size = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < size; index += 1) {
    const leftPart = leftParts[index] || '';
    const rightPart = rightParts[index] || '';
    const leftNumber = Number.parseInt(leftPart, 10);
    const rightNumber = Number.parseInt(rightPart, 10);
    const leftIsNumber = Number.isFinite(leftNumber) && String(leftNumber) === leftPart;
    const rightIsNumber = Number.isFinite(rightNumber) && String(rightNumber) === rightPart;
    if (leftIsNumber && rightIsNumber) {
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      continue;
    }
    const textCompare = leftPart.localeCompare(rightPart);
    if (textCompare !== 0) {
      return textCompare;
    }
  }
  return 0;
}

function compareVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  const size = Math.max(leftVersion.core.length, rightVersion.core.length);
  for (let index = 0; index < size; index += 1) {
    const leftPart = leftVersion.core[index] || 0;
    const rightPart = rightVersion.core[index] || 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }
  if (!leftVersion.prerelease && !rightVersion.prerelease) {
    return 0;
  }
  if (!leftVersion.prerelease && rightVersion.prerelease) {
    return 1;
  }
  if (leftVersion.prerelease && !rightVersion.prerelease) {
    return -1;
  }
  return comparePrereleaseIdent(leftVersion.prerelease, rightVersion.prerelease);
}

module.exports = {
  comparePrereleaseIdent,
  compareVersions,
  parseVersion,
  parseVersionParts,
};
