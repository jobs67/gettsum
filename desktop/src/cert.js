'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const selfsigned = require('selfsigned');

// Apple rejects TLS server certificates valid for more than 398 days.
const VALIDITY_DAYS = 397;
const RENEW_BEFORE_MS = 30 * 24 * 3600 * 1000;

/**
 * Loads the persisted self-signed certificate, generating a new one when it is missing,
 * close to expiring, or does not cover every current LAN address. A new certificate means
 * the phone shows the browser warning once again, so it is only regenerated when needed.
 * @returns {Promise<{ key: string, cert: string, fingerprint: string, regenerated: boolean }>}
 */
async function ensureCertificate(dir, { hostname, ips }) {
  const file = path.join(dir, 'tls.json');
  let stored = null;
  try {
    stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // missing or corrupt: regenerate
  }

  const fresh = stored && new Date(stored.notAfter).getTime() - Date.now() > RENEW_BEFORE_MS;
  const coversIps = stored && ips.every((ip) => stored.ips.includes(ip));
  if (fresh && coversIps) {
    return { key: stored.key, cert: stored.cert, fingerprint: fingerprintOf(stored.cert), regenerated: false };
  }

  // Keep previously known addresses so switching back and forth between networks
  // does not keep invalidating the certificate.
  const allIps = [...new Set([...(stored?.ips || []), ...ips, '127.0.0.1'])];
  const notBefore = new Date(Date.now() - 60 * 1000);
  const notAfter = new Date(notBefore.getTime() + VALIDITY_DAYS * 24 * 3600 * 1000);
  const pems = await selfsigned.generate([{ name: 'commonName', value: `Gettsum ${hostname}` }], {
    keySize: 2048,
    algorithm: 'sha256',
    notBeforeDate: notBefore,
    notAfterDate: notAfter,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          ...(hostname ? [{ type: 2, value: hostname }] : []),
          ...allIps.map((ip) => ({ type: 7, ip })),
        ],
      },
    ],
  });

  const record = { key: pems.private, cert: pems.cert, ips: allIps, notAfter: notAfter.toISOString() };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record), { mode: 0o600 });
  return { key: record.key, cert: record.cert, fingerprint: fingerprintOf(record.cert), regenerated: true };
}

function fingerprintOf(certPem) {
  return new crypto.X509Certificate(certPem).fingerprint256;
}

module.exports = { ensureCertificate };
