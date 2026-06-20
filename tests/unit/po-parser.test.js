const { parsePo } = require('../../src/i18n/po-parser');

describe('po-parser', () => {
  it('parsea entradas msgid/msgstr estándar', () => {
    const catalog = parsePo(`
msgid "Menu"
msgstr "Menú"

msgid "Home"
msgstr "Inicio"
`);
    expect(catalog.Menu).toBe('Menú');
    expect(catalog.Home).toBe('Inicio');
  });

  it('usa msgid cuando msgstr está vacío', () => {
    const catalog = parsePo(`
msgid "Logs"
msgstr ""
`);
    expect(catalog.Logs).toBe('Logs');
  });

  it('parsea cadenas multilínea', () => {
    const catalog = parsePo(`
msgid ""
"Line one "
"line two"
msgstr ""
"Primera "
"segunda"
`);
    expect(catalog['Line one line two']).toBe('Primera segunda');
  });
});
