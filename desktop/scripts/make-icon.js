'use strict';
/**
 * Generates the app icon (no external deps): build/icon.ico (multi-size, PNG entries)
 * and src/assets/icon.png (256px, used for the window).
 * Usage: node scripts/make-icon.js
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const SUPERSAMPLE = 8;

const GREEN_TOP = [34, 197, 94];
const GREEN_BOTTOM = [21, 128, 61];
const WHITE = [255, 255, 255];
const RED = [239, 68, 68];

// Bars as [x, width] in a 64-unit grid (same pattern as mobile/src/icon.svg).
const BARS_DETAILED = [[12, 4], [19, 2], [24, 5], [32, 2], [37, 3], [43, 2], [48, 4]];
// Small sizes: fewer, wider bars aligned to a 16-unit grid so they stay crisp.
const BARS_SIMPLE = [[3, 2], [6, 1], [8, 2], [11, 2]].map(([x, w]) => [x * 4, w * 4]);

// Geometry is snapped to whole pixels so bars and the laser stay sharp at small sizes.
function shapeAt(size) {
  const small = size < 48;
  const unit = size / 64;
  const laserH = Math.max(1, Math.round(3 * unit));
  const laserTop = Math.round(size / 2 - laserH / 2);
  return {
    margin: small ? 0 : Math.round(2 * unit),
    radius: (small ? 0.18 : 0.22) * size,
    bars: (small ? BARS_SIMPLE : BARS_DETAILED).map(([x, w]) => {
      const x0 = Math.round(x * unit);
      return [x0, Math.max(x0 + 1, Math.round((x + w) * unit))];
    }),
    barTop: Math.round(16 * unit),
    barBottom: Math.round(48 * unit),
    laserX0: Math.round(8 * unit),
    laserX1: Math.round(56 * unit),
    laserTop,
    laserBottom: laserTop + laserH,
  };
}

function insideRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function colorAt(x, y, size, s) {
  if (!insideRoundedRect(x, y, s.margin, s.margin, size - s.margin, size - s.margin, s.radius)) return null;
  if (y >= s.laserTop && y < s.laserBottom && x >= s.laserX0 && x < s.laserX1) return RED;
  if (y >= s.barTop && y < s.barBottom && s.bars.some(([x0, x1]) => x >= x0 && x < x1)) return WHITE;
  const t = y / size;
  return GREEN_TOP.map((c, i) => c + (GREEN_BOTTOM[i] - c) * t);
}

function render(size) {
  const s = shapeAt(size);
  const rgba = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const c = colorAt(px + (sx + 0.5) / n, py + (sy + 0.5) / n, size, s);
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const o = (py * size + px) * 4;
      if (a) {
        rgba[o] = Math.round(r / a);
        rgba[o + 1] = Math.round(g / a);
        rgba[o + 2] = Math.round(b / a);
        rgba[o + 3] = Math.round((255 * a) / (n * n));
      }
    }
  }
  return rgba;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const root = path.join(__dirname, '..');
const images = SIZES.map((size) => ({ size, png: encodePng(size, render(size)) }));
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.mkdirSync(path.join(root, 'src', 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), encodeIco(images));
fs.writeFileSync(path.join(root, 'src', 'assets', 'icon.png'), images.at(-1).png);
console.log(`icon.ico (${SIZES.join(', ')}) e src/assets/icon.png gerados`);
