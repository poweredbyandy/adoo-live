const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_ENTRIES = 500;

class AppLogger {
  constructor() {
    this.entries = [];
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(entry) {
    this.subscribers.forEach((callback) => {
      try {
        callback(entry);
      } catch {
        void 0;
      }
    });
  }

  add(level, source, message, detail) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message: String(message || ''),
      detail: detail !== undefined ? String(detail) : undefined,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }
    this.notify(entry);
    const line = `[${entry.timestamp}] [${level}] [${source}] ${entry.message}${entry.detail ? ` | ${entry.detail}` : ''}`;
    if (level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
    return entry;
  }

  getEntries() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
    logWithI18n('info', 'logger', 'Logs cleared');
  }

  exportText() {
    return this.entries
      .map((entry) => {
        const detail = entry.detail ? ` | ${entry.detail}` : '';
        return `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}${detail}`;
      })
      .join('\n');
  }

  exportToFile() {
    const filePath = path.join(app.getPath('userData'), `odoo-kiosk-logs-${Date.now()}.txt`);
    fs.writeFileSync(filePath, this.exportText(), 'utf8');
    logWithI18n('info', 'logger', 'Logs exported', filePath);
    return filePath;
  }
}

const appLogger = new AppLogger();

function logWithI18n(level, source, msgid, detail) {
  try {
    const { t } = require('../i18n');
    return appLogger.add(level, source, t(msgid), detail);
  } catch {
    return appLogger.add(level, source, msgid, detail);
  }
}

function attachWebContentsLogging(webContents, source) {
  if (!webContents || webContents._odooKioskLoggingAttached) {
    return;
  }
  webContents._odooKioskLoggingAttached = true;

  webContents.on('console-message', (event) => {
    const message = String(event.message || '');
    if (message.includes('Electron Security Warning')) {
      return;
    }
    const levelMap = { debug: 'debug', info: 'info', warning: 'warn', error: 'error' };
    const detail = event.sourceId ? `${event.sourceId}:${event.lineNumber}` : String(event.lineNumber);
    appLogger.add(levelMap[event.level] || 'info', source, message, detail);
  });

  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appLogger.add('error', source, 'did-fail-load', `${validatedURL} (${errorCode}) ${errorDescription}`);
  });

  webContents.on('render-process-gone', (_event, details) => {
    appLogger.add('error', source, 'render-process-gone', JSON.stringify(details));
  });
}

function setupProcessLogging() {
  process.on('uncaughtException', (error) => {
    appLogger.add('error', 'main', 'uncaughtException', error.stack || error.message);
  });

  process.on('unhandledRejection', (reason) => {
    const detail = reason instanceof Error ? reason.stack || reason.message : String(reason);
    appLogger.add('error', 'main', 'unhandledRejection', detail);
  });
}

module.exports = { appLogger, attachWebContentsLogging, setupProcessLogging };
