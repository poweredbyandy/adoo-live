const fs = require('fs');
const path = require('path');
const { parsePo } = require('./po-parser');

const SUPPORTED_LOCALES = ['en', 'es'];
const DEFAULT_LOCALE = 'en';

let currentLocale = DEFAULT_LOCALE;
let catalog = {};

function normalizeLocale(locale) {
  const normalized = String(locale || DEFAULT_LOCALE).toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(normalized) ? normalized : DEFAULT_LOCALE;
}

function getLocalesDir() {
  return path.join(__dirname, 'locales');
}

function readPoCatalog(locale) {
  const poPath = path.join(getLocalesDir(), `${locale}.po`);
  if (!fs.existsSync(poPath)) {
    return {};
  }
  return parsePo(fs.readFileSync(poPath, 'utf8'));
}

function loadCatalog(locale) {
  const normalized = normalizeLocale(locale);
  const english = readPoCatalog('en');
  if (normalized === 'en') {
    return { ...english };
  }
  const localized = readPoCatalog(normalized);
  return { ...english, ...localized };
}

function initI18n(locale) {
  currentLocale = normalizeLocale(locale);
  catalog = loadCatalog(currentLocale);
  return currentLocale;
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

function getLocale() {
  return currentLocale;
}

function getCatalog() {
  return { ...catalog };
}

module.exports = {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  initI18n,
  t,
  getLocale,
  getCatalog,
  normalizeLocale,
};
