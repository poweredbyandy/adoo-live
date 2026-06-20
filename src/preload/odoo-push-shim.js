(function installOdooPushShim() {
  if (window.__odooKioskPushShimInstalled) {
    return;
  }
  window.__odooKioskPushShimInstalled = true;

  function toArrayBuffer(base64Url) {
    const normalized = String(base64Url).replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function createSubscriptionObject(data) {
    return {
      endpoint: data.endpoint,
      expirationTime: data.expirationTime ?? null,
      options: data.options || {},
      getKey(name) {
        if (name === 'p256dh') {
          return toArrayBuffer(data.keys.p256dh);
        }
        if (name === 'auth') {
          return toArrayBuffer(data.keys.auth);
        }
        return null;
      },
      toJSON() {
        return {
          endpoint: data.endpoint,
          expirationTime: data.expirationTime ?? null,
          keys: data.keys,
        };
      },
      unsubscribe() {
        if (!window.odooBrowser?.push?.unsubscribe) {
          return Promise.resolve(true);
        }
        return window.odooBrowser.push.unsubscribe();
      },
    };
  }

  let activeSubscription = null;

  function createPushManager() {
    return {
      async subscribe(options) {
        if (!window.odooBrowser?.push?.subscribe) {
          throw new Error('Odoo Kiosk push bridge unavailable');
        }
        const subscription = await window.odooBrowser.push.subscribe({
          applicationServerKey: options?.applicationServerKey
            ? Array.from(new Uint8Array(options.applicationServerKey))
            : undefined,
        });
        activeSubscription = createSubscriptionObject({
          ...subscription,
          options: {
            applicationServerKey: options?.applicationServerKey,
            userVisibleOnly: options?.userVisibleOnly,
          },
        });
        return activeSubscription;
      },
      async getSubscription() {
        return null;
      },
      async permissionState() {
        return 'granted';
      },
    };
  }

  function patchRegistration(registration) {
    if (!registration || registration.__odooKioskPushPatched) {
      return registration;
    }
    registration.__odooKioskPushPatched = true;
    Object.defineProperty(registration, 'pushManager', {
      configurable: true,
      enumerable: true,
      get() {
        return createPushManager();
      },
    });
    return registration;
  }

  if (navigator.serviceWorker) {
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = async function patchedRegister(...args) {
      const registration = await originalRegister(...args);
      return patchRegistration(registration);
    };

    const originalGetRegistration = navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker);
    navigator.serviceWorker.getRegistration = async function patchedGetRegistration(...args) {
      const registration = await originalGetRegistration(...args);
      return registration ? patchRegistration(registration) : registration;
    };
  }

  if (navigator.serviceWorker?.getRegistration) {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        patchRegistration(registration);
      }
    }).catch(() => undefined);
  }
})();
