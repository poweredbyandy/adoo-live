const WebSocket = require('ws');
const { extractBusPrintJobs } = require('../shared/kiosk-printing');
const { getOdooSession } = require('./session');
const { appLogger } = require('./logger');
const { t } = require('../i18n');

const WEBSOCKET_VERSION = '18.0-5';
const RECONNECT_DELAY_MS = 3000;

class OdooBusClient {
  constructor({ origin, webContents, onPrintJob }) {
    this.origin = origin;
    this.webContents = webContents;
    this.onPrintJob = onPrintJob;
    this.ws = null;
    this.shouldRun = false;
    this.reconnectTimer = null;
  }

  async start() {
    if (this.shouldRun) {
      return;
    }
    this.shouldRun = true;
    await this.connect();
  }

  stop() {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  getWebsocketUrl() {
    return `${this.origin.replace(/^http/i, 'ws')}/websocket?version=${WEBSOCKET_VERSION}`;
  }

  async buildCookieHeader() {
    const session = this.webContents?.session || getOdooSession();
    const cookies = await session.cookies.get({ url: this.origin });
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }

  scheduleReconnect() {
    if (!this.shouldRun || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        this.scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }

  async connect() {
    if (!this.shouldRun || !this.webContents || this.webContents.isDestroyed()) {
      return;
    }
    const cookieHeader = await this.buildCookieHeader();
    if (!cookieHeader.includes('session_id=')) {
      return;
    }
    const ws = new WebSocket(this.getWebsocketUrl(), {
      headers: {
        Cookie: cookieHeader,
        Origin: this.origin,
      },
    });
    this.ws = ws;

    ws.on('open', () => {
      appLogger.add('info', 'kiosk-bus', t('Bus websocket connected'), this.origin);
      ws.send(JSON.stringify({
        event_name: 'subscribe',
        data: {
          channels: [],
          last: 0,
        },
      }));
    });

    ws.on('message', (raw) => {
      this.handleMessage(raw);
    });

    ws.on('close', () => {
      appLogger.add('warn', 'kiosk-bus', t('Bus websocket disconnected'), this.origin);
      this.ws = null;
      this.scheduleReconnect();
    });

    ws.on('error', (error) => {
      appLogger.add('warn', 'kiosk-bus', t('Bus websocket error'), error.message);
    });
  }

  handleMessage(raw) {
    let parsed;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      return;
    }
    const jobs = extractBusPrintJobs(parsed);
    jobs.forEach((job) => {
      this.onPrintJob(job);
    });
  }
}

module.exports = { OdooBusClient, WEBSOCKET_VERSION };
