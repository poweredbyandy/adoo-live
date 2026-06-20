const http = require('http');
const crypto = require('crypto');
const { appLogger } = require('./logger');
const { showNotification } = require('./notification-service');

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function getServerPublicKey(headers) {
  const dhHeader = headers['crypto-key'] || headers.cryptokey || '';
  const dhMatch = dhHeader.match(/dh=([^;]+)/i);
  return dhMatch ? decodeBase64Url(dhMatch[1]) : null;
}

function decryptAes128Gcm(body, headers, subscription) {
  const ece = require('http_ece');
  const salt = body.slice(0, 16);
  const ciphertext = body.slice(16);
  const serverPublicKey = getServerPublicKey(headers);

  return ece.decrypt(ciphertext, {
    version: 'aes128gcm',
    salt,
    privateKey: subscription.privateKey,
    dh: serverPublicKey || subscription.publicKey,
    authSecret: subscription.authSecret,
  });
}

function decryptAesGcm(body, headers, subscription) {
  const ece = require('http_ece');
  const saltHeader = headers.encryption || headers['encryption'] || '';
  const saltMatch = saltHeader.match(/salt=([^;]+)/i);
  const salt = saltMatch ? decodeBase64Url(saltMatch[1]) : body.slice(0, 16);
  const serverPublicKey = getServerPublicKey(headers);

  return ece.decrypt(body, {
    version: 'aesgcm',
    salt,
    privateKey: subscription.privateKey,
    dh: serverPublicKey || subscription.publicKey,
    authSecret: subscription.authSecret,
  });
}

function parsePushPayload(buffer) {
  const text = buffer.toString('utf8').trim();
  try {
    return JSON.parse(text);
  } catch {
    return { title: 'Odoo', body: text };
  }
}

class WebPushServer {
  constructor() {
    this.server = null;
    this.port = 0;
    this.subscriptions = new Map();
    this.activeSubscription = null;
  }

  async start() {
    if (this.server) {
      return this.port;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch((error) => {
          appLogger.add('error', 'webpush', 'request failed', error.message);
          res.writeHead(500);
          res.end();
        });
      });

      this.server.on('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port;
        appLogger.add('info', 'webpush', 'Servidor push local iniciado', `http://127.0.0.1:${this.port}`);
        resolve(this.port);
      });
    });
  }

  async createSubscription() {
    await this.start();
    const privateKey = crypto.createECDH('prime256v1');
    privateKey.generateKeys();
    const auth = crypto.randomBytes(16);
    const id = crypto.randomBytes(8).toString('hex');
    const endpoint = `http://127.0.0.1:${this.port}/webpush/${id}`;
    const subscription = {
      id,
      endpoint,
      expirationTime: null,
      keys: {
        p256dh: toBase64Url(privateKey.getPublicKey()),
        auth: toBase64Url(auth),
      },
      privateKey: privateKey.getPrivateKey(),
      publicKey: privateKey.getPublicKey(),
      authSecret: auth,
    };
    this.subscriptions.set(id, subscription);
    this.activeSubscription = subscription;
    return {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: subscription.keys,
    };
  }

  getActiveSubscription() {
    if (!this.activeSubscription) {
      return null;
    }
    const { endpoint, expirationTime, keys } = this.activeSubscription;
    return { endpoint, expirationTime, keys };
  }

  clearSubscriptions() {
    this.subscriptions.clear();
    this.activeSubscription = null;
  }

  async handleRequest(req, res) {
    const parsed = new URL(req.url, `http://127.0.0.1:${this.port}`);
    const match = parsed.pathname.match(/^\/webpush\/([^/]+)$/);
    if (!match || req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }

    const subscription = this.subscriptions.get(match[1]);
    if (!subscription) {
      res.writeHead(404);
      res.end();
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
    );

    let decrypted;
    try {
      const encoding = headers['content-encoding'] || 'aes128gcm';
      decrypted =
        encoding === 'aesgcm'
          ? decryptAesGcm(body, headers, subscription)
          : decryptAes128Gcm(body, headers, subscription);
    } catch (error) {
      appLogger.add('error', 'webpush', 'No se pudo descifrar push', error.message);
      res.writeHead(202);
      res.end();
      return;
    }

    const payload = parsePushPayload(decrypted);
    const title = payload.title || payload.options?.title || 'Odoo';
    const bodyText = payload.body || payload.options?.body || payload.message || '';
    showNotification({
      title,
      body: bodyText,
      silent: Boolean(payload.silent),
      action: 'focus',
    });
    appLogger.add('info', 'webpush', 'Notificación recibida', title);

    res.writeHead(201);
    res.end();
  }

  async stop() {
    if (!this.server) {
      return;
    }
    await new Promise((resolve) => this.server.close(resolve));
    this.server = null;
    this.port = 0;
    this.clearSubscriptions();
  }
}

const webPushServer = new WebPushServer();

module.exports = { WebPushServer, webPushServer, toBase64Url, decodeBase64Url, parsePushPayload };
