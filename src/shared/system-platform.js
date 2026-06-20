const PLATFORM_ALIASES = {
  win32: 'windows',
  darwin: 'mac',
  linux: 'linux',
};

function normalizePlatform(platform) {
  const value = String(platform || '').toLowerCase();
  return PLATFORM_ALIASES[value] || value;
}

function buildPlatformId(platform, arch) {
  const normalizedPlatform = String(platform || '').toLowerCase();
  const normalizedArch = String(arch || '').toLowerCase();
  if (!normalizedPlatform || !normalizedArch) {
    return '';
  }
  return `${normalizedPlatform}-${normalizedArch}`;
}

function buildPlatformFlags(platform, arch) {
  const normalizedPlatform = String(platform || '').toLowerCase();
  const normalizedArch = String(arch || '').toLowerCase();
  return {
    windows: normalizedPlatform === 'win32',
    mac: normalizedPlatform === 'darwin',
    linux: normalizedPlatform === 'linux',
    arm: normalizedArch === 'arm64' || normalizedArch === 'arm',
    x64: normalizedArch === 'x64' || normalizedArch === 'amd64',
  };
}

module.exports = {
  buildPlatformFlags,
  buildPlatformId,
  normalizePlatform,
};
