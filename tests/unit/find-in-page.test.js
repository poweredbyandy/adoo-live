const { initI18n } = require('../../src/i18n');
const { buildFindOptions, formatFindStatus } = require('../../src/main/find-in-page');

describe('find-in-page helpers', () => {
  beforeEach(() => {
    initI18n('en');
  });

  it('construye opciones para búsqueda inicial y siguiente', () => {
    expect(buildFindOptions({ forward: true, followUp: false })).toEqual({
      forward: true,
      findNext: true,
      matchCase: false,
    });
    expect(buildFindOptions({ forward: false, followUp: true })).toEqual({
      forward: false,
      findNext: false,
      matchCase: false,
    });
  });

  it('formatea estado sin resultados en inglés', () => {
    expect(formatFindStatus({ query: 'odoo', matches: 0, activeMatchOrdinal: 0 })).toEqual({
      label: 'No results',
      matches: 0,
      activeMatchOrdinal: 0,
      query: 'odoo',
    });
  });

  it('formatea estado con coincidencias en inglés', () => {
    expect(formatFindStatus({ query: 'sale', matches: 5, activeMatchOrdinal: 2 })).toEqual({
      label: '2 of 5',
      matches: 5,
      activeMatchOrdinal: 2,
      query: 'sale',
    });
  });

  it('formatea estado en español', () => {
    initI18n('es');
    expect(formatFindStatus({ query: 'venta', matches: 5, activeMatchOrdinal: 2 })).toEqual({
      label: '2 de 5',
      matches: 5,
      activeMatchOrdinal: 2,
      query: 'venta',
    });
  });
});
