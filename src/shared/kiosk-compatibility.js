function getOriginFromUrl(pageUrl) {
  try {
    const parsed = new URL(pageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function buildCompatibilityCheckUrl(pageUrl, appVersion) {
  const origin = getOriginFromUrl(pageUrl);
  if (!origin) {
    return null;
  }
  return `${origin}/pba_kiosk/compatibility?app_version=${encodeURIComponent(appVersion)}`;
}

module.exports = { getOriginFromUrl, buildCompatibilityCheckUrl };
