'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const MAX_BODY_BYTES = 16 * 1024;
const SCAN_ID = /^[A-Za-z0-9_-]{8,64}$/;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; " +
    "media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(self)',
};

class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES * 64) {
        req.destroy(); // abusive client: stop reading altogether
        return;
      }
      if (size > MAX_BODY_BYTES) {
        // Keep draining so the 413 response can still be delivered.
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(new HttpError(413, 'too_large', 'Valor longo demais.'));
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new HttpError(400, 'bad_json'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * HTTPS server for the phone: serves the mobile UI and the JSON API.
 *
 * API (all JSON):
 *   POST /api/pair    { token | code, name }  -> { deviceId, secret, desktopName }
 *   GET  /api/status  (auth)                  -> { desktopName, deviceName, paused, mode, suffix, directInsert }
 *   POST /api/scan    (auth) { id, value, format } -> { status, target, message, duplicate? }
 *   POST /api/device  (auth) { name }          -> { name }
 *   POST /api/unpair  (auth)                   -> { ok }
 * Auth: "Authorization: Bearer <deviceId>.<secret>"
 */
function createServer({ tls, staticDir, pairing, devices, processor, getStatus, onEvent = () => {} }) {
  const routes = {
    'POST /api/pair': async (req) => {
      const body = await readJson(req);
      const outcome = pairing.consume({ token: body.token, code: body.code });
      if (outcome === 'locked') {
        onEvent('pairing-locked');
        throw new HttpError(429, 'locked', 'Muitas tentativas. Aguarde alguns segundos e use o novo código.');
      }
      if (outcome !== 'ok') {
        onEvent('pairing-failed');
        throw new HttpError(401, 'invalid_code', 'Código inválido ou expirado.');
      }
      const { device, secret } = devices.add(body.name);
      onEvent('paired', device);
      return { deviceId: device.id, secret, deviceName: device.name, desktopName: getStatus().desktopName };
    },

    'GET /api/status': async (req, device) => ({ ...getStatus(), deviceName: device.name }),

    'POST /api/scan': async (req, device) => {
      const body = await readJson(req);
      if (typeof body.id !== 'string' || !SCAN_ID.test(body.id)) throw new HttpError(400, 'bad_id');
      if (typeof body.value !== 'string') throw new HttpError(400, 'bad_value');
      const format = typeof body.format === 'string' ? body.format.slice(0, 32) : null;
      return processor.process({ id: body.id, value: body.value, format }, device);
    },

    'POST /api/device': async (req, device) => {
      const body = await readJson(req);
      const updated = devices.rename(device.id, body.name);
      onEvent('devices-changed');
      return { name: updated.name };
    },

    'POST /api/unpair': async (req, device) => {
      devices.remove(device.id);
      onEvent('devices-changed');
      return { ok: true };
    },
  };

  async function handleApi(req, res, url) {
    const route = routes[`${req.method} ${url.pathname}`];
    if (!route) throw new HttpError(404, 'not_found');
    let device = null;
    if (url.pathname !== '/api/pair') {
      device = devices.authenticate(req.headers.authorization);
      if (!device) throw new HttpError(401, 'unauthorized', 'Dispositivo não autorizado. Pareie novamente.');
      const wasOnline = devices.isOnline(device.id);
      devices.touch(device.id);
      if (!wasOnline) onEvent('devices-changed');
    }
    sendJson(res, 200, await route(req, device));
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed');
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(staticDir, rel);
    if (!file.startsWith(path.resolve(staticDir) + path.sep)) throw new HttpError(404, 'not_found');
    let data;
    try {
      data = fs.readFileSync(file);
    } catch {
      throw new HttpError(404, 'not_found');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  const server = https.createServer({ key: tls.key, cert: tls.cert }, async (req, res) => {
    const url = new URL(req.url, 'https://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else serveStatic(req, res, url);
    } catch (err) {
      if (!(err instanceof HttpError)) console.error('[server]', err);
      const status = err instanceof HttpError ? err.status : 500;
      if (res.headersSent) return res.end();
      if (url.pathname.startsWith('/api/')) {
        sendJson(res, status, { error: err.code || 'internal', message: err instanceof HttpError ? err.message : 'Erro interno.' });
      } else {
        res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(status === 404 ? 'Não encontrado' : 'Erro');
      }
    }
  });

  return {
    server,
    listen(port, host = '0.0.0.0') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve(server.address().port);
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    },
  };
}

module.exports = { createServer };
