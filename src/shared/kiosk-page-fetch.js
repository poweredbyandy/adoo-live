function buildGetScript(path) {
  const pathLiteral = JSON.stringify(path);
  return `(async () => {
    try {
      const response = await fetch(${pathLiteral}, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  })()`;
}

function buildPostScript(path, payload) {
  const pathLiteral = JSON.stringify(path);
  const bodyLiteral = JSON.stringify(JSON.stringify(payload));
  return `(async () => {
    try {
      const response = await fetch(${pathLiteral}, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: ${bodyLiteral},
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  })()`;
}

module.exports = { buildGetScript, buildPostScript };
