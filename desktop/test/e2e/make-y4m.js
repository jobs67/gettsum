// Draws an EAN-13 barcode straight into a Y4M (YUV420) video for Chromium's fake camera.
const fs = require('fs');
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = L.map(p => [...p].map(b => b === '0' ? '1' : '0').reverse().join(''));
const R = L.map(p => [...p].map(b => b === '0' ? '1' : '0').join(''));
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function ean13(d12) {
  const s = [...d12].map(Number).reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0);
  const code = d12 + ((10 - s % 10) % 10);
  const d = [...code].map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return { code, bits: bits + '101' };
}
const { code, bits } = ean13(process.argv[3] || '789123456789');
const W = 640, H = 480, mod = 5, x0 = Math.floor((W - bits.length * mod) / 2);
const Y = Buffer.alloc(W * H, 235);
for (let y = 140; y < 340; y++) for (let i = 0; i < bits.length; i++) if (bits[i] === '1')
  for (let k = 0; k < mod; k++) Y[y * W + x0 + i * mod + k] = 16;
const UV = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
const parts = [Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`)];
for (let f = 0; f < 15; f++) parts.push(Buffer.from('FRAME\n'), Y, UV);
fs.writeFileSync(process.argv[2], Buffer.concat(parts));
console.log(code);
