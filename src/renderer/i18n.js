let catalog = {};
let locale = 'en';

function initClientI18n(nextLocale, nextCatalog) {
  locale = nextLocale || 'en';
  catalog = nextCatalog || {};
  document.documentElement.lang = locale;
}

function t(msgid, params) {
  const key = String(msgid || '');
  let text = catalog[key] ?? key;
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([name, value]) => {
      const replacement = String(value);
      text = text.replace(new RegExp(`%\\(${name}\\)s`, 'g'), replacement);
      text = text.replace(new RegExp(`%${name}s`, 'g'), replacement);
    });
  }
  return text;
}

function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    const msgid = element.dataset.i18n || element.textContent.trim();
    element.textContent = t(msgid);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  });
}

window.i18n = {
  initClientI18n,
  t,
  applyStaticI18n,
  getLocale: () => locale,
};
