// Camera + barcode decoding. Frames never leave the phone: only decoded text is reported.

import { BarcodeDetector as ZXingDetector, prepareZXingModule } from 'barcode-detector/ponyfill';

// Serve the WebAssembly decoder from the desktop itself (works without internet, no CDN).
prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => (path.endsWith('.wasm') ? `./${path}` : prefix + path),
  },
});

export const FORMATS = [
  { id: 'ean_13', label: 'EAN-13', default: true },
  { id: 'ean_8', label: 'EAN-8', default: true },
  { id: 'upc_a', label: 'UPC-A', default: true },
  { id: 'upc_e', label: 'UPC-E', default: true },
  { id: 'code_128', label: 'Code 128', default: true },
  { id: 'qr_code', label: 'QR Code', default: false },
  { id: 'code_39', label: 'Code 39', default: false },
  { id: 'itf', label: 'ITF (Interleaved 2 of 5)', default: false },
  { id: 'data_matrix', label: 'Data Matrix', default: false },
];

const SCAN_INTERVAL_MS = 120;

async function createDetector(formats) {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      if (formats.every((f) => supported.includes(f))) {
        return { detector: new window.BarcodeDetector({ formats }), engine: 'nativo' };
      }
    } catch {
      // fall through to ZXing
    }
  }
  return { detector: new ZXingDetector({ formats }), engine: 'ZXing' };
}

export class Scanner {
  /**
   * @param {HTMLVideoElement} video
   * @param {(result: { value: string, format: string }) => void} onDetect
   */
  constructor(video, onDetect) {
    this.video = video;
    this.onDetect = onDetect;
    this.stream = null;
    this.track = null;
    this.detector = null;
    this.active = false; // decoding enabled
    this.busy = false;
    this.timer = null;
    this.torchOn = false;
  }

  async setFormats(formats) {
    const { detector, engine } = await createDetector(formats);
    this.detector = detector;
    this.engine = engine;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador não permite acesso à câmera. Use o Chrome (Android) ou o Safari (iPhone).');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    this.track = this.stream.getVideoTracks()[0];
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();

    const caps = this.track.getCapabilities?.() || {};
    if (caps.focusMode?.includes('continuous')) {
      this.track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }
    this.torchOn = false;
    this.timer = setInterval(() => this.#tick(), SCAN_INTERVAL_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.track = null;
    this.video.srcObject = null;
  }

  get running() {
    return Boolean(this.stream);
  }

  get torchSupported() {
    return Boolean(this.track?.getCapabilities?.().torch);
  }

  async toggleTorch() {
    if (!this.torchSupported) return false;
    this.torchOn = !this.torchOn;
    await this.track.applyConstraints({ advanced: [{ torch: this.torchOn }] });
    return this.torchOn;
  }

  async #tick() {
    if (!this.active || this.busy || !this.detector || this.video.readyState < 2) return;
    this.busy = true;
    try {
      const codes = await this.detector.detect(this.video);
      const code = codes.find((c) => c.rawValue);
      if (code && this.active) this.onDetect({ value: code.rawValue, format: code.format });
    } catch {
      // transient decode errors are expected; keep scanning
    } finally {
      this.busy = false;
    }
  }
}
