# Odoo Browser Bridge API

API expuesta en páginas Odoo 18 mediante `window.odooBrowser`.

## Requisitos

- Navegador Odoo Kiosk en modo Kiosko, Libre o Desarrollador
- Página cargada dentro del `BrowserView` de Odoo (preload activo)

## Métodos

### `getMode()`

Retorna capacidades del modo actual.

```javascript
const mode = await window.odooBrowser.getMode();
// { mode, canHaveTabs, canEditUrl, autoDevTools, navigationRestricted, verboseLogging }
```

### `push.subscribe()` / `push.getSubscription()` / `push.unsubscribe()`

Puente Web Push para Odoo 18. Electron no incluye el servicio push de Chromium; el navegador crea una suscripción local y recibe los mensajes de Odoo en un servidor HTTP interno, mostrando notificaciones nativas.

```javascript
const subscription = await window.odooBrowser.push.subscribe();
```

### `notify(options)`

Muestra una notificación nativa del sistema operativo.

```javascript
await window.odooBrowser.notify({
  title: 'Pedido listo',
  body: 'La orden #123 está preparada',
  silent: false,
});
```

## Serial

```javascript
const ports = await window.odooBrowser.serial.list();
const opened = await window.odooBrowser.serial.open('/dev/ttyUSB0', { baudRate: 9600 });
await window.odooBrowser.serial.write(opened.id, 'PING\n');
await window.odooBrowser.serial.close(opened.id);
```

## USB

```javascript
const devices = await window.odooBrowser.usb.list();
```

## Impresoras

```javascript
const printers = await window.odooBrowser.printer.list();
await window.odooBrowser.printer.print({
  deviceName: printers[0]?.name,
  silent: true,
  printBackground: true,
  copies: 1,
});
await window.odooBrowser.printer.printRaw({
  deviceName: printers[0]?.name,
  data: [27, 64, 72, 101, 108, 108, 111],
});
```

## Integración futura en Odoo 18

En el módulo Odoo se recomienda encapsular llamadas en un servicio JS:

```javascript
/** @odoo-module **/
import { registry } from '@web/core/registry';

export const odooBrowserService = {
  async notify(title, body) {
    if (!window.odooBrowser) {
      return false;
    }
    await window.odooBrowser.notify({ title, body });
    return true;
  },
};

registry.category('services').add('odoo_browser', odooBrowserService);
```

## Seguridad

- No expone `nodeIntegration`
- Todos los payloads se validan en el proceso principal
- En modo Kiosko la navegación externa queda restringida por host
