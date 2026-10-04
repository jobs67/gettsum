'use strict';

const MAX_VALUE_LENGTH = 4096;
const RESULT_TTL_MS = 10 * 60 * 1000;
const MAX_RESULTS = 500;

/**
 * Removes control characters. Typing a raw "\n" or "\t" from a QR Code would act as
 * Enter/Tab and could submit a form by accident; the configurable suffix is the only
 * way to send those keys. (GS1 group separators are dropped as well.)
 */
function sanitize(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

/**
 * Serializes insertions (in arrival order) and makes them idempotent per scan id, so a
 * phone retrying after a timeout never types the same reading twice.
 */
class ScanProcessor {
  constructor({ inject, getSettings, onResult = () => {}, now = Date.now }) {
    this.inject = inject;
    this.getSettings = getSettings;
    this.onResult = onResult;
    this.now = now;
    this.results = new Map(); // key -> { result, at }
    this.inFlight = new Map(); // key -> Promise
    this.queue = Promise.resolve();
  }

  /**
   * @param {{ id: string, value: string, format?: string }} scan
   * @param {{ id: string, name: string }} device
   */
  process(scan, device) {
    const key = `${device.id}:${scan.id}`;
    this.#prune();
    const done = this.results.get(key);
    if (done) return Promise.resolve({ ...done.result, duplicate: true });
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const value = sanitize(scan.value);
    if (!value) {
      return Promise.resolve({ status: 'error', target: null, message: 'Leitura vazia.' });
    }
    if (value.length > MAX_VALUE_LENGTH) {
      return Promise.resolve({ status: 'error', target: null, message: 'Valor longo demais.' });
    }

    const run = this.queue.then(async () => {
      const settings = this.getSettings();
      if (settings.paused) {
        // Not cached: the user can resume reception and retry the same scan.
        return { status: 'paused', target: null, message: 'Recepção pausada no computador.' };
      }
      let result;
      try {
        result = await this.inject(value, { mode: settings.mode, suffix: settings.suffix });
      } catch (err) {
        result = { status: 'error', target: null, message: `Falha ao inserir: ${err.message}` };
      }
      if (result.status !== 'error') this.results.set(key, { result, at: this.now() });
      this.onResult({ device, value, format: scan.format || null, ...result });
      return result;
    });

    this.queue = run.catch(() => {});
    this.inFlight.set(key, run);
    run.finally(() => this.inFlight.delete(key));
    return run;
  }

  #prune() {
    const cutoff = this.now() - RESULT_TTL_MS;
    for (const [key, { at }] of this.results) {
      if (at < cutoff || this.results.size > MAX_RESULTS) this.results.delete(key);
      else break; // Map keeps insertion order: the rest is newer
    }
  }
}

module.exports = { ScanProcessor, sanitize, MAX_VALUE_LENGTH };
