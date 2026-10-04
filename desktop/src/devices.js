'use strict';

const crypto = require('crypto');

const ONLINE_WINDOW_MS = 10 * 1000;
const MAX_NAME_LENGTH = 40;

function hash(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function cleanName(name, fallback) {
  const clean = String(name ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return clean || fallback;
}

/**
 * Paired phones. Only a hash of each device secret is persisted; the secret itself lives
 * on the phone. Last-seen times are kept in memory to drive the "connected" indicator.
 */
class DeviceRegistry {
  constructor(store, { now = Date.now } = {}) {
    this.store = store; // JsonStore with { devices: [] }
    this.now = now;
    this.lastSeen = new Map();
  }

  #devices() {
    return this.store.get().devices;
  }

  add(name) {
    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString('base64url');
    const device = { id, name: cleanName(name, 'Celular'), secretHash: hash(secret), pairedAt: new Date().toISOString() };
    this.store.set({ devices: [...this.#devices(), device] });
    this.touch(id);
    return { device, secret };
  }

  /** Parses "Bearer <id>.<secret>" and returns the device or null. */
  authenticate(authorization) {
    const match = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]+)$/.exec(authorization || '');
    if (!match) return null;
    const device = this.#devices().find((d) => d.id === match[1]);
    if (!device) return null;
    const expected = Buffer.from(device.secretHash, 'hex');
    const actual = Buffer.from(hash(match[2]), 'hex');
    return crypto.timingSafeEqual(expected, actual) ? device : null;
  }

  rename(id, name) {
    const devices = this.#devices().map((d) => (d.id === id ? { ...d, name: cleanName(name, d.name) } : d));
    this.store.set({ devices });
    return devices.find((d) => d.id === id) || null;
  }

  remove(id) {
    this.store.set({ devices: this.#devices().filter((d) => d.id !== id) });
    this.lastSeen.delete(id);
  }

  touch(id) {
    this.lastSeen.set(id, this.now());
  }

  isOnline(id) {
    return this.now() - (this.lastSeen.get(id) || 0) < ONLINE_WINDOW_MS;
  }

  list() {
    return this.#devices().map(({ id, name, pairedAt }) => ({
      id,
      name,
      pairedAt,
      lastSeen: this.lastSeen.get(id) || null,
      online: this.isOnline(id),
    }));
  }
}

module.exports = { DeviceRegistry, cleanName };
