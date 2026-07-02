const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');

function extractChangelogSection(version) {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    return '';
  }
  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const blocks = changelog.split(/^## /m);
  for (const block of blocks) {
    const headerMatch = block.match(/^\[([^\]]+)\]/);
    if (!headerMatch) {
      continue;
    }
    if (headerMatch[1] === version) {
      return block.replace(/^\[[^\]]+\]\s*/, '').trim();
    }
  }
  return '';
}

function buildReleaseBody(version) {
  const section = extractChangelogSection(version);
  let body = `## adoo IoT v${version}\n\n`;
  body += '### macOS — primera instalación\n\n';
  body += 'Si macOS indica que la app **está dañada**, no lo está: es el bloqueo de Gatekeeper para apps descargadas sin firma Apple.\n\n';
  body += '1. Arrastra **adoo IoT** a **Applications**.\n';
  body += '2. **Clic derecho** → **Abrir** → **Abrir** (solo la primera vez).\n\n';
  body += 'O en Terminal:\n\n';
  body += '```bash\n';
  body += 'xattr -dr com.apple.quarantine "/Applications/adoo IoT.app"\n';
  body += '```\n\n';
  body += 'Con doble clic y solo una advertencia suave hace falta **firmar y notarizar** con Apple Developer ID.\n\n';
  if (section) {
    body += section;
  } else {
    body += 'See the auto-generated notes below for merged changes in this release.';
  }
  return body;
}

const version = process.env.VERSION || process.argv[2];
if (!version) {
  console.error('Usage: VERSION=1.0.0 node scripts/release-notes.js');
  process.exit(1);
}

process.stdout.write(buildReleaseBody(version.replace(/^v/, '')));
