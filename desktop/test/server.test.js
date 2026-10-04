'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const { ensureCertificate } = require('../src/cert');
const { JsonStore } = require('../src/store');
const { PairingManager } = require('../src/pairing');
const { DeviceRegistry } = require('../src/devices');
const { ScanProcessor, sanitize } = require('../src/scan-processor');
const { createServer } = require('../src/server');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gettsum-test-'));
const staticDir = path.join(tmp, 'static');
fs.mkdirSync(staticDir);
fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>ok</title>');
fs.writeFileSync(path.join(tmp, 'secret.txt'), 'nope');

let ctx;

function request(method, pathname, { body, auth } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: '127.0.0.1',
        port: ctx.port,
        method,
        path: pathname,
        rejectUnauthorized: false,
        headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, json, text: data, headers: res.headers });
        });
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

test.before(async () => {
  const tls = await ensureCertificate(tmp, { hostname: 'test-pc', ips: ['127.0.0.1'] });
  const settings = { paused: false, mode: 'type', suffix: 'none' };
  const injected = [];
  const pairing = new PairingManager({ maxAttempts: 3, lockoutMs: 200 });
  const devices = new DeviceRegistry(new JsonStore(path.join(tmp, 'devices.json'), { devices: [] }));
  const processor = new ScanProcessor({
    getSettings: () => settings,
    inject: async (value, opts) => {
      await new Promise((r) => setTimeout(r, 30));
      injected.push({ value, ...opts });
      return { status: 'inserted', target: 'Formulário de teste', message: null };
    },
  });
  const server = createServer({
    tls,
    staticDir,
    pairing,
    devices,
    processor,
    getStatus: () => ({ desktopName: 'test-pc', ...settings, directInsert: true }),
  });
  const port = await server.listen(0, '127.0.0.1');
  ctx = { server, port, pairing, devices, settings, injected, tls };
});

test.after(() => ctx.server.close());

async function pair() {
  const res = await request('POST', '/api/pair', { body: { token: ctx.pairing.current().token, name: 'Celular teste' } });
  assert.equal(res.status, 200);
  return `${res.json.deviceId}.${res.json.secret}`;
}

test('certificate is reused when it still covers the addresses', async () => {
  const again = await ensureCertificate(tmp, { hostname: 'test-pc', ips: ['127.0.0.1'] });
  assert.equal(again.regenerated, false);
  assert.equal(again.fingerprint, ctx.tls.fingerprint);
  const widened = await ensureCertificate(tmp, { hostname: 'test-pc', ips: ['127.0.0.1', '192.168.0.50'] });
  assert.equal(widened.regenerated, true);
});

test('serves the mobile page and blocks path traversal', async () => {
  const ok = await request('GET', '/');
  assert.equal(ok.status, 200);
  assert.match(ok.headers['content-security-policy'], /default-src 'self'/);
  const traversal = await request('GET', '/..%2Fsecret.txt');
  assert.equal(traversal.status, 404);
});

test('pairs with the QR token, which is single-use', async () => {
  const token = ctx.pairing.current().token;
  const first = await request('POST', '/api/pair', { body: { token, name: 'Pixel' } });
  assert.equal(first.status, 200);
  assert.ok(first.json.secret.length >= 40);
  const reused = await request('POST', '/api/pair', { body: { token, name: 'Outro' } });
  assert.equal(reused.status, 401);
});

test('pairs with the 6-digit code', async () => {
  const res = await request('POST', '/api/pair', { body: { code: ctx.pairing.current().code, name: 'iPhone' } });
  assert.equal(res.status, 200);
  assert.equal(res.json.deviceName, 'iPhone');
});

test('locks pairing after repeated wrong codes and rotates the code', async () => {
  const before = ctx.pairing.current().code;
  const wrong = before === '000000' ? '111111' : '000000';
  assert.equal((await request('POST', '/api/pair', { body: { code: wrong } })).status, 401);
  assert.equal((await request('POST', '/api/pair', { body: { code: wrong } })).status, 401);
  assert.equal((await request('POST', '/api/pair', { body: { code: wrong } })).status, 429);
  assert.notEqual(ctx.pairing.current().code, before);
  // Even the right code is refused during the lockout.
  assert.equal((await request('POST', '/api/pair', { body: { code: ctx.pairing.current().code } })).status, 429);
  await new Promise((r) => setTimeout(r, 250));
});

test('rejects API calls without valid credentials', async () => {
  assert.equal((await request('GET', '/api/status')).status, 401);
  const auth = await pair();
  const [id] = auth.split('.');
  assert.equal((await request('GET', '/api/status', { auth: `${id}.wrongsecret` })).status, 401);
  const ok = await request('GET', '/api/status', { auth });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.desktopName, 'test-pc');
});

test('a retried scan id is inserted only once, even when concurrent', async () => {
  const auth = await pair();
  ctx.injected.length = 0;
  const scan = { id: 'scan-abc-12345', value: '7891234567895', format: 'ean_13' };
  const [a, b] = await Promise.all([
    request('POST', '/api/scan', { auth, body: scan }),
    request('POST', '/api/scan', { auth, body: scan }),
  ]);
  const c = await request('POST', '/api/scan', { auth, body: scan });
  assert.equal(a.json.status, 'inserted');
  assert.equal(b.json.status, 'inserted');
  assert.equal(c.json.duplicate, true);
  assert.equal(ctx.injected.length, 1);
  assert.equal(ctx.injected[0].suffix, 'none');
});

test('scans are inserted in arrival order', async () => {
  const auth = await pair();
  ctx.injected.length = 0;
  await Promise.all(
    ['111', '222', '333'].map((value, i) => request('POST', '/api/scan', { auth, body: { id: `order-${i}-abcdef`, value } })),
  );
  assert.deepEqual(ctx.injected.map((x) => x.value), ['111', '222', '333']);
});

test('control characters are stripped so a scan cannot press Enter', async () => {
  assert.equal(sanitize('ABC\r\n123\t\x1dX'), 'ABC123X');
  const auth = await pair();
  ctx.injected.length = 0;
  await request('POST', '/api/scan', { auth, body: { id: 'ctrl-chars-1', value: '123\n' } });
  assert.equal(ctx.injected[0].value, '123');
});

test('paused reception does not insert and allows retry later', async () => {
  const auth = await pair();
  ctx.injected.length = 0;
  ctx.settings.paused = true;
  const paused = await request('POST', '/api/scan', { auth, body: { id: 'paused-scan-1', value: '42' } });
  assert.equal(paused.json.status, 'paused');
  ctx.settings.paused = false;
  const retried = await request('POST', '/api/scan', { auth, body: { id: 'paused-scan-1', value: '42' } });
  assert.equal(retried.json.status, 'inserted');
  assert.equal(ctx.injected.length, 1);
});

test('removing a device revokes its access immediately', async () => {
  const auth = await pair();
  const [id] = auth.split('.');
  ctx.devices.remove(id);
  assert.equal((await request('GET', '/api/status', { auth })).status, 401);
});

test('device can unpair itself and rename', async () => {
  const auth = await pair();
  const renamed = await request('POST', '/api/device', { auth, body: { name: '  Leitor do caixa\n ' } });
  assert.equal(renamed.json.name, 'Leitor do caixa');
  assert.equal((await request('POST', '/api/unpair', { auth })).status, 200);
  assert.equal((await request('GET', '/api/status', { auth })).status, 401);
});

test('rejects malformed scans', async () => {
  const auth = await pair();
  assert.equal((await request('POST', '/api/scan', { auth, body: { id: 'x', value: '1' } })).status, 400);
  assert.equal((await request('POST', '/api/scan', { auth, body: { id: 'valid-id-123', value: 5 } })).status, 400);
  const huge = await request('POST', '/api/scan', { auth, body: { id: 'valid-id-456', value: 'x'.repeat(20000) } });
  assert.equal(huge.status, 413);
});
