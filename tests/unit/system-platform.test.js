const { buildPlatformFlags, buildPlatformId, normalizePlatform } = require('../../src/shared/system-platform');

describe('system-platform', () => {
  it('construye platformId para rutas nativas', () => {
    expect(buildPlatformId('win32', 'x64')).toBe('win32-x64');
    expect(buildPlatformId('darwin', 'arm64')).toBe('darwin-arm64');
    expect(buildPlatformId('linux', 'x64')).toBe('linux-x64');
  });

  it('normaliza nombres de plataforma', () => {
    expect(normalizePlatform('win32')).toBe('windows');
    expect(normalizePlatform('darwin')).toBe('mac');
    expect(normalizePlatform('linux')).toBe('linux');
  });

  it('expone flags de plataforma y arquitectura', () => {
    expect(buildPlatformFlags('win32', 'x64')).toEqual({
      windows: true,
      mac: false,
      linux: false,
      arm: false,
      x64: true,
    });
    expect(buildPlatformFlags('darwin', 'arm64')).toEqual({
      windows: false,
      mac: true,
      linux: false,
      arm: true,
      x64: false,
    });
  });
});
