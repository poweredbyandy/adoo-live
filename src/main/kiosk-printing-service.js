const { buildPostScript } = require('../shared/kiosk-page-fetch');
const { getOriginFromUrl } = require('../shared/kiosk-compatibility');
const { shouldHandleRemotePrintJob } = require('../shared/kiosk-printing');
const { getDeviceIdentity } = require('./device-identity');
const { printDocument, resolvePrinterName } = require('./printer-service');
const { OdooBusClient } = require('./odoo-bus-client');
const { appLogger } = require('./logger');
const { t } = require('../i18n');
const { notifyPrintJob } = require('./print-notification-service');
const { PERMISSION_TYPES, ensurePermission, getDialogParent, isPermissionGranted } = require('./permission-service');

async function postPrintJobResult(webContents, jobId, body) {
  if (!webContents || webContents.isDestroyed()) {
    return null;
  }
  const path = `/pba_kiosk/print/jobs/${jobId}/result`;
  return webContents.executeJavaScript(buildPostScript(path, body), true);
}

class KioskPrintingService {
  constructor(webContents) {
    this.webContents = webContents;
    this.busClient = null;
  }

  start(origin) {
    if (!origin || this.busClient) {
      return;
    }
    const { windowRegistry } = require('./window-registry');
    const config = windowRegistry.config || require('./config').loadConfig();
    if (!isPermissionGranted(config, PERMISSION_TYPES.WEBSOCKET)) {
      return;
    }
    this.busClient = new OdooBusClient({
      origin,
      webContents: this.webContents,
      onPrintJob: (job) => {
        this.handleRemotePrintJob(job).catch((error) => {
          appLogger.add('error', 'kiosk-print', t('Remote print job failed'), error.message);
        });
      },
    });
    this.busClient.start().catch((error) => {
      appLogger.add('warn', 'kiosk-bus', t('Bus websocket error'), error.message);
    });
  }

  stop() {
    if (this.busClient) {
      this.busClient.stop();
      this.busClient = null;
    }
  }

  async printLocal(payload) {
    const { windowRegistry } = require('./window-registry');
    await ensurePermission(windowRegistry, PERMISSION_TYPES.PRINTERS, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'kiosk-print-local',
      actionLabel: t('Print document'),
    });

    const noticeId = notifyPrintJob(this.webContents, {
      id: payload.print_uid || undefined,
      phase: 'sending',
      source: 'local',
      documentName: payload.document_name,
      reportName: payload.job_name,
      printerUid: payload.printer_uid,
      printUid: payload.print_uid,
    });
    try {
      const printerName = await resolvePrinterName(this.webContents, payload.printer_uid);
      const result = await printDocument(this.webContents, payload);
      notifyPrintJob(this.webContents, {
        id: noticeId,
        phase: 'completed',
        source: 'local',
        documentName: payload.document_name,
        reportName: payload.job_name,
        printerName: result.printerName || printerName,
        printerUid: payload.printer_uid,
        printUid: payload.print_uid,
      });
      appLogger.add(
        'info',
        'kiosk-print',
        t('Local print completed'),
        payload.print_uid || payload.job_name || '',
        result.printerName,
      );
      return { ok: true, ...result };
    } catch (error) {
      notifyPrintJob(this.webContents, {
        id: noticeId,
        phase: 'failed',
        source: 'local',
        documentName: payload.document_name,
        reportName: payload.job_name,
        printerUid: payload.printer_uid,
        printUid: payload.print_uid,
        error: error.message || t('Unknown error'),
      });
      throw error;
    }
  }

  async handleRemotePrintJob(job) {
    const identity = getDeviceIdentity();
    if (!shouldHandleRemotePrintJob(job, identity.device_uid)) {
      return;
    }

    const { windowRegistry } = require('./window-registry');
    await ensurePermission(windowRegistry, PERMISSION_TYPES.PRINTERS, {
      browserWindow: getDialogParent(windowRegistry),
      source: 'kiosk-print-remote',
      actionLabel: t('Remote print job'),
    });

    const noticeId = notifyPrintJob(this.webContents, {
      id: job.print_uid || String(job.job_id || ''),
      phase: 'sending',
      source: 'remote',
      documentName: job.document_name,
      reportName: job.report_name,
      printerName: job.printer_name,
      printerUid: job.printer_uid,
      printUid: job.print_uid,
      jobId: job.job_id,
    });
    appLogger.add(
      'info',
      'kiosk-print',
      t('Remote print job received'),
      String(job.job_id || ''),
      job.print_uid || '',
    );
    try {
      await printDocument(this.webContents, {
        printer_uid: job.printer_uid,
        document: job.document,
        document_name: job.document_name,
        mime_type: job.mime_type || 'application/pdf',
        print_format: job.print_format,
        encoding: job.encoding,
        command_set: job.command_set,
        device_path: job.device_path,
        baud_rate: job.baud_rate,
        job_name: job.report_name,
        print_uid: job.print_uid,
      });
      await postPrintJobResult(this.webContents, job.job_id, {
        device_uid: identity.device_uid,
        success: true,
      });
      notifyPrintJob(this.webContents, {
        id: noticeId,
        phase: 'completed',
        source: 'remote',
        documentName: job.document_name,
        reportName: job.report_name,
        printerName: job.printer_name,
        printerUid: job.printer_uid,
        printUid: job.print_uid,
        jobId: job.job_id,
      });
      appLogger.add(
        'info',
        'kiosk-print',
        t('Remote print completed'),
        String(job.job_id || ''),
        job.print_uid || '',
      );
    } catch (error) {
      await postPrintJobResult(this.webContents, job.job_id, {
        device_uid: identity.device_uid,
        success: false,
        failure_reason: error.message || t('Unknown error'),
      });
      notifyPrintJob(this.webContents, {
        id: noticeId,
        phase: 'failed',
        source: 'remote',
        documentName: job.document_name,
        reportName: job.report_name,
        printerName: job.printer_name,
        printerUid: job.printer_uid,
        printUid: job.print_uid,
        jobId: job.job_id,
        error: error.message || t('Unknown error'),
      });
      appLogger.add(
        'warn',
        'kiosk-print',
        t('Remote print failed'),
        String(job.job_id || ''),
        error.message,
      );
      throw error;
    }
  }
}

const printingByWebContents = new Map();

function getPrintingService(webContents) {
  if (!webContents) {
    return null;
  }
  const key = webContents.id;
  if (!printingByWebContents.has(key)) {
    printingByWebContents.set(key, new KioskPrintingService(webContents));
    webContents.once('destroyed', () => {
      printingByWebContents.delete(key);
    });
  }
  return printingByWebContents.get(key);
}

async function printLocalFromBridge(webContents, payload) {
  const service = getPrintingService(webContents);
  if (!service) {
    throw new Error('No hay una sesión activa para imprimir.');
  }
  return service.printLocal(payload);
}

function startRemotePrinting(webContents, pageUrl) {
  const origin = getOriginFromUrl(pageUrl);
  if (!origin) {
    return;
  }
  getPrintingService(webContents)?.start(origin);
}

function stopRemotePrinting(webContents) {
  getPrintingService(webContents)?.stop();
}

function stopAllRemotePrinting() {
  for (const service of printingByWebContents.values()) {
    service.stop();
  }
}

module.exports = {
  KioskPrintingService,
  getPrintingService,
  postPrintJobResult,
  printLocalFromBridge,
  startRemotePrinting,
  stopRemotePrinting,
  stopAllRemotePrinting,
};
