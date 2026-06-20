function normalizeOdooWebPath(pathname) {
  const segments = String(pathname || '/').split('/').filter(Boolean);
  const webIndex = segments.indexOf('web');
  if (webIndex >= 0) {
    return `/${segments.slice(0, webIndex + 1).join('/')}`;
  }
  return '/web';
}

function buildOdooDebugReloadUrl(urlString, level) {
  const url = new URL(urlString);
  url.pathname = normalizeOdooWebPath(url.pathname);
  url.hash = '';
  url.search = '';
  if (level) {
    url.searchParams.set('debug', level);
  }
  return url.toString();
}

function applyOdooDebugToUrl(urlString, level) {
  const url = new URL(urlString);
  if (!level) {
    url.searchParams.delete('debug');
  } else {
    url.searchParams.set('debug', level);
  }
  return url.toString();
}

function getOdooDebugLevel(urlString) {
  try {
    const url = new URL(urlString);
    return url.searchParams.get('debug');
  } catch {
    return null;
  }
}

module.exports = {
  normalizeOdooWebPath,
  buildOdooDebugReloadUrl,
  applyOdooDebugToUrl,
  getOdooDebugLevel,
};
