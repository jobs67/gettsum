'use strict';

const crypto = require('crypto');

/**
 * Temporary pairing credentials: a 128-bit token (embedded in the QR Code) and a 6-digit
 * code for manual entry. Both expire, are single-use, and are replaced after too many
 * failed attempts, followed by a short lockout to slow down guessing.
 */
class PairingManager {
  constructor({ ttlMs = 5 * 60 * 1000, maxAttempts = 5, lockoutMs = 30 * 1000, now = Date.now, onChange = () => {} } = {}) {
    this.ttlMs = ttlMs;
    this.maxAttempts = maxAttempts;
    this.lockoutMs = lockoutMs;
    this.now = now;
    this.onChange = onChange;
    this.lockedUntil = 0;
    this.regenerate();
  }

  regenerate() {
    this.session = {
      token: crypto.randomBytes(16).toString('base64url'),
      code: String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'),
      expiresAt: this.now() + this.ttlMs,
    };
    this.failures = 0;
    this.onChange(this.session);
    return this.session;
  }

  current() {
    if (this.now() >= this.session.expiresAt) this.regenerate();
    return this.session;
  }

  isLocked() {
    return this.now() < this.lockedUntil;
  }

  /**
   * @returns {'ok' | 'invalid' | 'locked'}
   */
  consume({ token, code }) {
    if (this.isLocked()) return 'locked';
    const session = this.current();
    const matches =
      (typeof token === 'string' && token.length > 0 && safeEqual(token, session.token)) ||
      (typeof code === 'string' && /^\d{6}$/.test(code) && safeEqual(code, session.code));
    if (matches) {
      this.regenerate();
      return 'ok';
    }
    this.failures += 1;
    if (this.failures >= this.maxAttempts) {
      this.lockedUntil = this.now() + this.lockoutMs;
      this.regenerate();
      return 'locked';
    }
    return 'invalid';
  }
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { PairingManager };
