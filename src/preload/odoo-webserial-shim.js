(function installOdooWebSerialBridge() {
  if (window.__odooKioskSecureContextPatched !== true) {
    try {
      Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        enumerable: true,
        get() {
          return true;
        },
      });
      window.__odooKioskSecureContextPatched = true;
    } catch {
      void 0;
    }
  }
  if (window.__odooKioskWebSerialShimInstalled) {
    return;
  }
  window.__odooKioskWebSerialShimInstalled = true;

  const GRANTED_SERIAL_KEY = 'odoo-kiosk-granted-serial-ports';

  function loadGrantedPorts() {
    try {
      const raw = sessionStorage.getItem(GRANTED_SERIAL_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveGrantedPorts(ports) {
    sessionStorage.setItem(GRANTED_SERIAL_KEY, JSON.stringify(ports));
  }

  function rememberPort(portInfo) {
    const granted = loadGrantedPorts();
    if (!granted.some((entry) => entry.path === portInfo.path)) {
      granted.push(portInfo);
      saveGrantedPorts(granted);
    }
  }

  function matchesFilter(port, filter) {
    if (!filter || typeof filter !== 'object') {
      return true;
    }
    if (filter.usbVendorId !== undefined && Number(port.vendorId) !== Number(filter.usbVendorId)) {
      return false;
    }
    if (filter.usbProductId !== undefined && Number(port.productId) !== Number(filter.usbProductId)) {
      return false;
    }
    return true;
  }

  function filterPorts(ports, filters) {
    const list = Array.isArray(ports) ? ports : [];
    if (!Array.isArray(filters) || !filters.length) {
      return list;
    }
    return list.filter((port) => filters.some((filter) => matchesFilter(port, filter)));
  }

  function pickPort(ports, filters, defaults) {
    const filtered = filterPorts(ports, filters);
    if (!filtered.length) {
      return null;
    }
    if (defaults?.serialPath) {
      const preferred = filtered.find((port) => port.path === defaults.serialPath);
      if (preferred) {
        return preferred;
      }
    }
    if (filtered.length === 1) {
      return filtered[0];
    }
    return filtered[0];
  }

  async function waitForBridge() {
    if (window.odooBrowser?.serial?.list && window.odooBrowser?.printer?.getDefaults) {
      return window.odooBrowser;
    }
    for (let attempt = 0; attempt < 200; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      if (window.odooBrowser?.serial?.list && window.odooBrowser?.printer?.getDefaults) {
        return window.odooBrowser;
      }
    }
    return null;
  }

  class ShimSerialPort {
    constructor(portInfo) {
      this.path = portInfo.path;
      this.readable = null;
      this.writable = null;
      this.opened = false;
      this.baudRate = 9600;
    }

    async open(options) {
      const bridge = await waitForBridge();
      if (!bridge?.serial?.open) {
        throw new Error('WebSerial no está disponible en este navegador.');
      }
      this.baudRate = Number(options?.baudRate || 9600);
      await bridge.serial.open(this.path, { baudRate: this.baudRate });
      this.opened = true;
      this.writable = new WritableStream({
        write: async (chunk) => {
          const buffer = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          await bridge.serial.write(this.path, Array.from(buffer));
        },
      });
      this.readable = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
    }

    async close() {
      if (!this.opened) {
        return;
      }
      const bridge = await waitForBridge();
      if (bridge?.serial?.close) {
        await bridge.serial.close(this.path);
      }
      this.opened = false;
      this.readable = null;
      this.writable = null;
    }

    getInfo() {
      return {
        path: this.path,
        usbVendorId: undefined,
        usbProductId: undefined,
      };
    }
  }

  const shim = {
    async getPorts() {
      const granted = loadGrantedPorts();
      return granted.map((port) => new ShimSerialPort(port));
    },
    async requestPort(options) {
      const bridge = await waitForBridge();
      if (!bridge?.serial?.list) {
        throw new Error('WebSerial no está disponible en este navegador.');
      }
      const [ports, defaults] = await Promise.all([
        bridge.serial.list(),
        bridge.printer.getDefaults(),
      ]);
      const selected = pickPort(ports, options?.filters, defaults);
      if (!selected) {
        throw new Error('No se encontró un puerto serie compatible.');
      }
      rememberPort(selected);
      return new ShimSerialPort(selected);
    },
  };

  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    enumerable: true,
    value: shim,
  });
})();
