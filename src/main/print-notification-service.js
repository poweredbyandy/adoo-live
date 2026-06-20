const crypto = require('crypto');
const { showNotification } = require('./notification-service');
const { appLogger } = require('./logger');
const { t } = require('../i18n');

function getWindowRegistry() {
  return require('./window-registry').windowRegistry;
}

function buildPrintNoticeBody(notice) {
  const documentLabel = notice.reportName || notice.documentName || t('Document');
  const printerLabel = notice.printerName || notice.printerUid || t('Printer');
  return t('%(document)s → %(printer)s', {
    document: documentLabel,
    printer: printerLabel,
  });
}

function buildPrintNoticeTitle(notice) {
  if (notice.phase === 'completed') {
    return notice.source === 'remote' ? t('Remote print completed') : t('Local print completed');
  }
  if (notice.phase === 'failed') {
    return notice.source === 'remote' ? t('Remote print failed') : t('Print failed');
  }
  return notice.source === 'remote'
    ? t('Receiving remote print job')
    : t('Sending document to printer');
}

function normalizePrintNotice(rawNotice = {}) {
  const id = String(
    rawNotice.id || rawNotice.printUid || rawNotice.print_uid || crypto.randomUUID(),
  );
  const phase = ['sending', 'completed', 'failed'].includes(rawNotice.phase)
    ? rawNotice.phase
    : 'sending';
  const source = rawNotice.source === 'remote' ? 'remote' : 'local';
  return {
    id,
    phase,
    source,
    documentName: rawNotice.documentName || rawNotice.document_name || '',
    reportName: rawNotice.reportName || rawNotice.report_name || rawNotice.jobName || rawNotice.job_name || '',
    printerName: rawNotice.printerName || rawNotice.printer_name || '',
    printerUid: rawNotice.printerUid || rawNotice.printer_uid || '',
    printUid: rawNotice.printUid || rawNotice.print_uid || id,
    jobId: rawNotice.jobId || rawNotice.job_id || null,
    error: rawNotice.error || rawNotice.failure_reason || '',
    updatedAt: Date.now(),
  };
}

function notifyPrintJob(webContents, rawNotice) {
  const manager = getWindowRegistry().getByWebContents(webContents);
  if (!manager) {
    return null;
  }
  const notice = normalizePrintNotice(rawNotice);
  manager.upsertPrintNotice(notice);

  const body = notice.error || buildPrintNoticeBody(notice);
  const title = buildPrintNoticeTitle(notice);
  if (notice.phase === 'sending') {
    showNotification({ title, body, silent: true });
  } else if (notice.phase === 'completed') {
    showNotification({ title, body });
  } else if (notice.phase === 'failed') {
    showNotification({ title, body });
  }

  appLogger.add(
    notice.phase === 'failed' ? 'warn' : 'info',
    'kiosk-print',
    title,
    body,
  );
  return notice.id;
}

module.exports = {
  buildPrintNoticeBody,
  buildPrintNoticeTitle,
  normalizePrintNotice,
  notifyPrintJob,
};
