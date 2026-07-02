(function installOdooWebUsbBridge() {
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
  if (window.__odooKioskWebUsbShimInstalled) {
    return;
  }
  window.__odooKioskWebUsbShimInstalled = true;

  const GRANTED_USB_KEY = 'odoo-kiosk-granted-usb-devices';
  const VIRTUAL_USB_DEVICE_KEY = '__kiosk_virtual_print_preview__';

  function normalizeUsbId(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    const text = String(value).trim().toLowerCase();
    if (text.startsWith('0x')) {
      return Number.parseInt(text, 16);
    }
    const decimal = Number(text);
    if (Number.isFinite(decimal)) {
      return decimal;
    }
    const hex = Number.parseInt(text, 16);
    return Number.isFinite(hex) ? hex : null;
  }

  function loadGrantedDevices() {
    try {
      const raw = sessionStorage.getItem(GRANTED_USB_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveGrantedDevices(devices) {
    sessionStorage.setItem(GRANTED_USB_KEY, JSON.stringify(devices));
  }

  function rememberDevice(device) {
    const granted = loadGrantedDevices();
    if (!granted.some((entry) => entry.deviceKey === device.deviceKey)) {
      granted.push(device);
      saveGrantedDevices(granted);
    }
  }

  function deviceHasClassCode(device, classCode) {
    const classes = Array.isArray(device?.interfaceClasses) ? device.interfaceClasses : [];
    const deviceClass = normalizeUsbId(device?.deviceClass);
    return classes.includes(classCode) || deviceClass === classCode;
  }

  function matchesFilter(device, filter) {
    if (!filter || typeof filter !== 'object') {
      return true;
    }
    const vendorId = normalizeUsbId(filter.vendorId);
    const productId = normalizeUsbId(filter.productId);
    if (vendorId !== null && normalizeUsbId(device.vendorId) !== vendorId) {
      return false;
    }
    if (productId !== null && normalizeUsbId(device.productId) !== productId) {
      return false;
    }
    if (filter.classCode !== undefined && filter.classCode !== null) {
      if (!deviceHasClassCode(device, Number(filter.classCode))) {
        return false;
      }
    }
    return true;
  }

  function filterDevices(devices, filters) {
    const list = Array.isArray(devices) ? devices : [];
    if (!Array.isArray(filters) || !filters.length) {
      return list;
    }
    return list.filter((device) => filters.some((filter) => matchesFilter(device, filter)));
  }

  function pickDevice(devices, filters, defaults) {
    const list = Array.isArray(devices) ? devices : [];
    if (!list.length) {
      return null;
    }
    if (defaults?.usbDeviceKey) {
      const preferred = list.find((device) => device.deviceKey === defaults.usbDeviceKey);
      if (preferred) {
        return preferred;
      }
    }
    if (defaults?.serialPath) {
      const preferred = list.find((device) => device.viaSerialPath === defaults.serialPath);
      if (preferred) {
        return preferred;
      }
    }
    const granted = loadGrantedDevices();
    for (const entry of granted) {
      const remembered = list.find((device) => device.deviceKey === entry.deviceKey);
      if (remembered) {
        return remembered;
      }
    }
    const filtered = filterDevices(list, filters);
    if (filtered.length) {
      return filtered[0];
    }
    if (list.length === 1) {
      return list[0];
    }
    return null;
  }

  async function waitForBridge() {
    if (window.odooBrowser?.usb?.list && window.odooBrowser?.printer?.getDefaults) {
      return window.odooBrowser;
    }
    for (let attempt = 0; attempt < 200; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      if (window.odooBrowser?.usb?.list && window.odooBrowser?.printer?.getDefaults) {
        return window.odooBrowser;
      }
    }
    return null;
  }

  async function getPrintPreviewMode() {
    const bridge = await waitForBridge();
    if (!bridge?.printPreview?.getMode) {
      return 'off';
    }
    try {
      return await bridge.printPreview.getMode();
    } catch {
      return 'off';
    }
  }

  function toByteArray(data) {
    if (data instanceof ArrayBuffer) {
      return Array.from(new Uint8Array(data));
    }
    return Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  async function capturePrintData(bytes, previewMode) {
    const bridge = await waitForBridge();
    if (!bridge?.printPreview?.capture) {
      return;
    }
    await bridge.printPreview.capture({
      data: bytes,
      autoPrint: previewMode === 'before_and_print',
    });
  }

  function buildDefaultUsbConfiguration() {
    return {
      configurationValue: 1,
      interfaces: [{
        interfaceNumber: 0,
        alternates: [{
          alternateSetting: 0,
          interfaceClass: 7,
          endpoints: [{
            endpointNumber: 1,
            direction: 'out',
            type: 'bulk',
            packetSize: 512,
          }],
        }],
      }],
    };
  }

  class ShimUSBDevice {
    constructor(deviceInfo, options = {}) {
      this.deviceKey = deviceInfo.deviceKey;
      this.vendorId = deviceInfo.vendorId;
      this.productId = deviceInfo.productId;
      this.busNumber = deviceInfo.busNumber;
      this.deviceAddress = deviceInfo.deviceAddress;
      this.opened = false;
      this.virtual = Boolean(options.virtual);
      this.previewMode = options.previewMode || 'off';
      this.configuration = null;
      this.configurations = [buildDefaultUsbConfiguration()];
      this.previewChunks = [];
      this.previewCaptured = false;
    }

    shouldCapturePreview() {
      return this.previewMode === 'before' || this.previewMode === 'before_and_print';
    }

    queuePreviewBytes(bytes) {
      if (!this.shouldCapturePreview() || this.previewCaptured || !bytes.length) {
        return;
      }
      this.previewChunks.push(bytes);
    }

    async flushPreviewCapture() {
      if (!this.shouldCapturePreview() || this.previewCaptured || !this.previewChunks.length) {
        return;
      }
      this.previewCaptured = true;
      const totalLength = this.previewChunks.reduce((total, chunk) => total + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of this.previewChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      this.previewChunks = [];
      await capturePrintData(Array.from(combined), this.previewMode);
    }

    async open() {
      if (this.virtual) {
        this.opened = true;
        return;
      }
      const bridge = await waitForBridge();
      if (!bridge?.usb?.open) {
        throw new Error('WebUSB no está disponible en este navegador.');
      }
      await bridge.usb.open(this.deviceKey);
      this.opened = true;
    }

    async close() {
      if (!this.opened) {
        return;
      }
      await this.flushPreviewCapture();
      if (this.virtual) {
        this.opened = false;
        return;
      }
      const bridge = await waitForBridge();
      if (bridge?.usb?.close) {
        await bridge.usb.close(this.deviceKey);
      }
      this.opened = false;
    }

    async selectConfiguration(configurationValue) {
      const value = Number.isFinite(Number(configurationValue))
        ? Number(configurationValue)
        : this.configurations[0]?.configurationValue || 1;
      this.configuration = this.configurations.find(
        (item) => item.configurationValue === value,
      ) || this.configurations[0];
    }

    async claimInterface() {
      return undefined;
    }

    async releaseInterface() {
      await this.flushPreviewCapture();
      return undefined;
    }

    async transferOut(endpointNumber, data) {
      const bytes = toByteArray(data);
      if (this.shouldCapturePreview()) {
        this.queuePreviewBytes(bytes);
        if (this.previewMode === 'before' || this.virtual) {
          return {
            status: 'ok',
            bytesWritten: bytes.length,
          };
        }
      }
      const bridge = await waitForBridge();
      if (!bridge?.usb?.transferOut) {
        throw new Error('WebUSB no está disponible en este navegador.');
      }
      const result = await bridge.usb.transferOut(this.deviceKey, endpointNumber, bytes);
      return {
        status: 'ok',
        bytesWritten: result?.bytesWritten || bytes.length,
      };
    }

    async transferIn() {
      return { status: 'stall', data: new DataView(new ArrayBuffer(0)) };
    }
  }

  const shim = {
    async getDevices() {
      const granted = loadGrantedDevices();
      return granted.map((device) => new ShimUSBDevice(device));
    },
    async requestDevice(options) {
      const bridge = await waitForBridge();
      if (!bridge?.usb?.list) {
        throw new Error('WebUSB no está disponible en este navegador.');
      }
      const previewMode = await getPrintPreviewMode();
      const [devices, defaults] = await Promise.all([
        bridge.usb.list(),
        bridge.printer.getDefaults(),
      ]);
      const selected = pickDevice(devices, options?.filters, defaults);
      if (selected) {
        rememberDevice(selected);
        return new ShimUSBDevice(selected, { previewMode });
      }
      if (previewMode === 'before' || previewMode === 'before_and_print') {
        return new ShimUSBDevice({
          deviceKey: VIRTUAL_USB_DEVICE_KEY,
          vendorId: 0,
          productId: 0,
        }, {
          virtual: true,
          previewMode,
        });
      }
      const count = Array.isArray(devices) ? devices.length : 0;
      throw new Error(
        count
          ? 'No se encontró un dispositivo USB compatible con los filtros del informe. Configure un dispositivo predeterminado en Ajustes → Permisos.'
          : 'No se detectó ningún dispositivo USB. Conecte la impresora y compruebe que el acceso a dispositivos está activo en Ajustes → Permisos.',
      );
    },
  };

  Object.defineProperty(navigator, 'usb', {
    configurable: true,
    enumerable: true,
    value: shim,
  });
})();
