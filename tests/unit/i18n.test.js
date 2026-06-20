const { initI18n, t, getLocale, normalizeLocale } = require('../../src/i18n');

describe('i18n', () => {
  it('usa inglés por defecto', () => {
    initI18n('en');
    expect(getLocale()).toBe('en');
    expect(t('Menu')).toBe('Menu');
  });

  it('traduce al español', () => {
    initI18n('es');
    expect(getLocale()).toBe('es');
    expect(t('Menu')).toBe('Menú');
    expect(t('Page history')).toBe('Historial de páginas');
  });

  it('interpola parámetros gettext', () => {
    initI18n('es');
    expect(t('%(count)s pages', { count: 3 })).toBe('3 páginas');
  });

  it('normaliza locale desconocido a inglés', () => {
    expect(normalizeLocale('fr')).toBe('en');
    expect(normalizeLocale('es-ES')).toBe('es');
  });
});
