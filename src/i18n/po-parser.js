function unescapePoString(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function parsePoStringLines(lines, startIndex) {
  const chunks = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line.startsWith('"')) {
      break;
    }
    chunks.push(unescapePoString(line.slice(1, -1)));
    index += 1;
  }
  return { value: chunks.join(''), nextIndex: index };
}

function parsePo(content) {
  const lines = String(content || '').split(/\r?\n/);
  const catalog = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line || line.startsWith('#')) {
      index += 1;
      continue;
    }

    if (line.startsWith('msgctxt ')) {
      index += 1;
      continue;
    }

    if (!line.startsWith('msgid ')) {
      index += 1;
      continue;
    }

    let msgid = '';
    if (line === 'msgid ""') {
      const parsed = parsePoStringLines(lines, index + 1);
      msgid = parsed.value;
      index = parsed.nextIndex;
    } else {
      msgid = unescapePoString(line.slice(6).trim().slice(1, -1));
      index += 1;
    }

    while (index < lines.length && lines[index].trim().startsWith('"')) {
      const parsed = parsePoStringLines(lines, index);
      msgid += parsed.value;
      index = parsed.nextIndex;
    }

    if (index >= lines.length || !lines[index].trim().startsWith('msgstr ')) {
      continue;
    }

    const msgstrLine = lines[index].trim();
    let msgstr = '';
    if (msgstrLine === 'msgstr ""') {
      const parsed = parsePoStringLines(lines, index + 1);
      msgstr = parsed.value;
      index = parsed.nextIndex;
    } else {
      msgstr = unescapePoString(msgstrLine.slice(7).trim().slice(1, -1));
      index += 1;
    }

    while (index < lines.length && lines[index].trim().startsWith('"')) {
      const parsed = parsePoStringLines(lines, index);
      msgstr += parsed.value;
      index = parsed.nextIndex;
    }

    if (msgid) {
      catalog[msgid] = msgstr || msgid;
    }
  }

  return catalog;
}

module.exports = { parsePo, unescapePoString };
