const { compareVersions, parseVersionParts } = require('../../src/shared/version-utils');

describe('version-utils', () => {
  it('parsea partes de version semver', () => {
    expect(parseVersionParts('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersionParts('2.0')).toEqual([2, 0]);
  });

  it('compara versiones semver', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.2.0')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '10.0.0')).toBeLessThan(0);
  });

  it('compara sufijos pre-release', () => {
    expect(compareVersions('1.0.0-beta.6', '1.0.0-beta.7')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta.7', '1.0.0-beta.6')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-beta.7', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0-beta.7')).toBeGreaterThan(0);
  });
});
