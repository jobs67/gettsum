// Bundles the mobile UI into ../desktop/mobile-dist, which the desktop app serves to phones.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../desktop/mobile-dist');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(here, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome90', 'safari15'],
  outfile: path.join(out, 'app.js'),
  logLevel: 'info',
});

for (const file of ['index.html', 'styles.css', 'icon.svg', 'manifest.webmanifest']) {
  cpSync(path.join(here, 'src', file), path.join(out, file));
}
// ZXing decoder, served locally instead of from a CDN.
cpSync(path.join(here, 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'), path.join(out, 'zxing_reader.wasm'));
console.log('mobile-dist pronto em', out);
