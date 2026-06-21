const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { BrowserWindow } = require('electron');
const { loadConfig } = require('./config');
const { PERMISSION_TYPES, isPermissionGranted } = require('./permission-service');
const { isDeviceAllowed, buildPrinterDeviceKey } = require('./device-permission-service');
const {
  buildPrinterUid,
  getPrintersPayload,
  mapPrinter,
} = require('./device-printers');
const { loadSerialPort } = require('./ipc/serial');
const {
  DIRECT_DEVICE_FORMATS,
  ESCPOS_FORMATS,
  isDirectDevicePath,
  preparePrintBuffer,
  resolvePrintFormat,
} = require('../shared/kiosk-printing');

const execFileAsync = promisify(execFile);

async function listPrinters(webContents) {
  const payload = await getPrintersPayload(webContents);
  return payload.map((printer) => ({ ...printer }));
}

async function resolvePrinterName(webContents, printerUid) {
  const printers = await listPrinters(webContents);
  const match = printers.find((printer) => printer.printer_uid === printerUid);
  if (!match) {
    throw new Error(`No se encontró la impresora local con printer_uid ${printerUid}.`);
  }
  const config = loadConfig();
  if (!isDeviceAllowed(config, 'printers', buildPrinterDeviceKey(match))) {
    throw new Error('Esta impresora está desactivada en Ajustes → Permisos.');
  }
  return match.name;
}

async function resolveDirectDevicePath(webContents, printerUid, explicitPath) {
  if (isDirectDevicePath(explicitPath)) {
    return explicitPath;
  }
  const printers = await listPrinters(webContents);
  const match = printers.find((printer) => printer.printer_uid === printerUid);
  if (!match) {
    return '';
  }
  const location = String(match.location || '').trim();
  if (isDirectDevicePath(location)) {
    return location;
  }
  return '';
}

function writeTempFile(prefix, extension, buffer) {
  const filePath = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function removeTempFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    void 0;
  }
}

function assertPrintablePdfBuffer(buffer) {
  if (!buffer || buffer.length < 128) {
    throw new Error(
      'El PDF recibido está vacío o es demasiado pequeño. Si la impresión normal de Odoo también sale en blanco, revise los registros seleccionados del informe.',
    );
  }
  const header = buffer.subarray(0, 4).toString('ascii');
  if (header !== '%PDF') {
    throw new Error('El documento recibido no es un PDF válido.');
  }
}

async function waitForHiddenWindowLoad(window, fileUrl) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Tiempo de espera agotado al preparar el documento para imprimir.'));
    }, 30000);
    const finish = (error) => {
      clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }
      setTimeout(resolve, 750);
    };
    window.webContents.once('did-finish-load', () => finish());
    window.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
      finish(new Error(errorDescription || `No se pudo cargar el documento (${errorCode}).`));
    });
    window.loadURL(fileUrl);
  });
}

async function printPdfWithSystemCommand(printerName, pdfBuffer) {
  const tempPath = writeTempFile('pba-kiosk-print', 'pdf', pdfBuffer);
  try {
    await execFileAsync('lp', ['-d', printerName, tempPath]);
  } finally {
    removeTempFile(tempPath);
  }
}

async function printPdfWithHiddenWindow(printerName, pdfBuffer) {
  const tempPath = writeTempFile('pba-kiosk-print', 'pdf', pdfBuffer);
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });
  try {
    await waitForHiddenWindowLoad(window, pathToFileURL(tempPath).href);
    await new Promise((resolve, reject) => {
      window.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          printBackground: true,
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || 'No se pudo imprimir el PDF.'));
            return;
          }
          resolve();
        },
      );
    });
  } finally {
    window.destroy();
    removeTempFile(tempPath);
  }
}

async function printHtmlWithHiddenWindow(printerName, htmlBuffer) {
  const tempPath = writeTempFile('pba-kiosk-html', 'html', htmlBuffer);
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });
  try {
    await waitForHiddenWindowLoad(window, pathToFileURL(tempPath).href);
    await new Promise((resolve, reject) => {
      window.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          printBackground: true,
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || 'No se pudo imprimir el HTML.'));
            return;
          }
          resolve();
        },
      );
    });
  } finally {
    window.destroy();
    removeTempFile(tempPath);
  }
}

async function printRawWithSystemCommand(printerName, rawBuffer) {
  const tempPath = writeTempFile('pba-kiosk-raw', 'bin', rawBuffer);
  try {
    if (process.platform === 'win32') {
      await execFileAsync('print', ['/D:', printerName, tempPath], { windowsHide: true });
      return;
    }
    await execFileAsync('lp', ['-d', printerName, '-o', 'raw', tempPath]);
  } finally {
    removeTempFile(tempPath);
  }
}

async function writeToSerialPort(devicePath, buffer, baudRate = 9600) {
  const { SerialPort } = await loadSerialPort();
  const port = new SerialPort({
    path: devicePath,
    baudRate,
    autoOpen: false,
  });
  await new Promise((resolve, reject) => {
    port.open((error) => (error ? reject(error) : resolve()));
  });
  try {
    await new Promise((resolve, reject) => {
      port.write(buffer, (error) => {
        if (error) {
          reject(error);
          return;
        }
        port.drain((drainError) => (drainError ? reject(drainError) : resolve()));
      });
    });
  } finally {
    await new Promise((resolve) => {
      port.close(() => resolve());
    });
  }
}

async function printPdf(webContents, printerName, payload) {
  const buffer = preparePrintBuffer(payload.document, payload);
  assertPrintablePdfBuffer(buffer);
  if (process.platform === 'darwin' || process.platform === 'linux') {
    await printPdfWithSystemCommand(printerName, buffer);
    return { route: 'pdf-cups' };
  }
  await printPdfWithHiddenWindow(printerName, buffer);
  return { route: 'pdf-driver' };
}

async function printHtml(webContents, printerName, payload) {
  const buffer = preparePrintBuffer(payload.document, payload);
  await printHtmlWithHiddenWindow(printerName, buffer);
  return { route: 'html-driver' };
}

async function printRawSpooler(printerName, payload) {
  const buffer = preparePrintBuffer(payload.document, payload);
  await printRawWithSystemCommand(printerName, buffer);
  return { route: 'raw-spooler' };
}

async function printDirectOrSpooler(webContents, printerName, payload, { preferDirect }) {
  const buffer = preparePrintBuffer(payload.document, payload);
  const devicePath = await resolveDirectDevicePath(
    webContents,
    payload.printer_uid,
    payload.device_path,
  );
  if (preferDirect && devicePath) {
    await writeToSerialPort(devicePath, buffer, payload.baud_rate);
    return { route: 'direct-device', devicePath };
  }
  await printRawWithSystemCommand(printerName, buffer);
  return { route: 'raw-spooler' };
}

async function printDocument(webContents, payload) {
  if (!webContents || webContents.isDestroyed()) {
    throw new Error('No hay una sesión activa para imprimir.');
  }
  const printFormat = resolvePrintFormat(payload);
  if (!printFormat) {
    throw new Error(`Formato de impresión no soportado: ${payload.print_format || payload.mime_type}`);
  }
  const printerName = await resolvePrinterName(webContents, payload.printer_uid);

  let routeResult;
  if (printFormat === 'pdf') {
    routeResult = await printPdf(webContents, printerName, payload);
  } else if (printFormat === 'html') {
    routeResult = await printHtml(webContents, printerName, payload);
  } else if (ESCPOS_FORMATS.has(printFormat)) {
    routeResult = await printDirectOrSpooler(webContents, printerName, payload, {
      preferDirect: Boolean(payload.device_path),
    });
  } else if (DIRECT_DEVICE_FORMATS.has(printFormat)) {
    routeResult = await printDirectOrSpooler(webContents, printerName, payload, {
      preferDirect: true,
    });
  } else if (printFormat === 'raw') {
    routeResult = await printRawSpooler(printerName, payload);
  } else {
    throw new Error(`Formato de impresión no soportado: ${printFormat}`);
  }

  return {
    ok: true,
    printerName,
    mode: 'local',
    print_format: printFormat,
    ...routeResult,
  };
}

function fingerprintPrinters(printers) {
  return printers
    .map((printer) => `${printer.printer_uid}:${printer.status}:${printer.is_default ? 1 : 0}`)
    .sort()
    .join('|');
}

module.exports = {
  buildPrinterUid,
  fingerprintPrinters,
  listPrinters,
  mapPrinter,
  printDocument,
  resolveDirectDevicePath,
  resolvePrinterName,
  writeToSerialPort,
};
