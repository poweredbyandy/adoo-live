(function ensureOdooKioskSecureContext() {
  if (window.__odooKioskSecureContextPatched) {
    return;
  }
  window.__odooKioskSecureContextPatched = true;
  try {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      enumerable: true,
      get() {
        return true;
      },
    });
  } catch {
    void 0;
  }
})();
