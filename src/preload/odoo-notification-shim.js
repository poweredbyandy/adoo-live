(function installOdooNotificationBridge() {
  if (window.__odooKioskNotificationShimInstalled) {
    return;
  }
  window.__odooKioskNotificationShimInstalled = true;

  const canBridge = Boolean(window.odooBrowser && typeof window.odooBrowser.notify === 'function');

  function bridgeToNative(title, options) {
    if (!canBridge) {
      return;
    }
    const opts = options && typeof options === 'object' ? options : {};
    window.odooBrowser.notify({
      title: String(title || 'Odoo'),
      body: String(opts.body || ''),
      silent: Boolean(opts.silent),
    }).catch(() => undefined);
  }

  function createStubNotification(title, options) {
    const listeners = new Map();
    const stub = {
      title: String(title || ''),
      body: String(options?.body || ''),
      onclick: null,
      onclose: null,
      onerror: null,
      onshow: null,
      close() {
        const handler = listeners.get('close') || this.onclose;
        if (typeof handler === 'function') {
          handler.call(this);
        }
      },
      addEventListener(type, handler) {
        if (typeof handler === 'function') {
          listeners.set(type, handler);
        }
      },
      removeEventListener(type) {
        listeners.delete(type);
      },
    };
    queueMicrotask(() => {
      const showHandler = listeners.get('show') || stub.onshow;
      if (typeof showHandler === 'function') {
        showHandler.call(stub);
      }
    });
    return stub;
  }

  function patchNotificationConstructor() {
    if (!window.Notification) {
      return;
    }
    function PatchedNotification(title, options) {
      bridgeToNative(title, options);
      const stub = createStubNotification(title, options);
      queueMicrotask(() => {
        const clickHandler = stub.onclick;
        if (typeof clickHandler === 'function') {
          stub.addEventListener('click', clickHandler);
        }
      });
      return stub;
    }

    PatchedNotification.requestPermission = () => Promise.resolve('granted');
    Object.defineProperty(PatchedNotification, 'permission', {
      configurable: true,
      enumerable: true,
      get() {
        return 'granted';
      },
    });

    window.Notification = PatchedNotification;
  }

  function patchPermissionsQuery() {
    if (!navigator.permissions?.query) {
      return;
    }
    const originalQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (descriptor) => {
      if (descriptor?.name === 'notifications') {
        const permissionStatus = {
          state: 'granted',
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
        };
        return Promise.resolve(permissionStatus);
      }
      return originalQuery(descriptor);
    };
  }

  function bindServiceWorkerNativeBridge() {
    if (!navigator.serviceWorker?.addEventListener) {
      return;
    }
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, payload } = event.data || {};
      if (type !== 'odoo-kiosk-native-notification' || !payload) {
        return;
      }
      bridgeToNative(payload.title, payload.options || {});
      if (typeof window.focus === 'function') {
        window.focus();
      }
    });
  }

  patchNotificationConstructor();
  patchPermissionsQuery();
  bindServiceWorkerNativeBridge();
})();
