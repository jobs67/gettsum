// Simulates a phone: fake camera showing an EAN-13, pairs by code, checks insertion end to end.
const { app, BrowserWindow, session } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path');
const origin = process.env.GETTSUM_URL || 'https://127.0.0.1:47800';
const code = process.env.GETTSUM_CODE;
const y4m = process.env.GETTSUM_Y4M || path.join(__dirname, 'ean.y4m');
const formPs1 = path.join(__dirname, 'test-form.ps1');
const outFile = path.join(__dirname, 'form-out.txt');
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('use-file-for-fake-video-capture', y4m);
app.on('certificate-error', (e, wc, url, err, cert, cb) => {
  if (url.startsWith(origin)) { e.preventDefault(); cb(true); } else cb(false);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'media'));
  const win = new BrowserWindow({ width: 400, height: 760, show: false, focusable: false, webPreferences: { backgroundThrottling: false } });
  win.showInactive();
  win.webContents.on('console-message', (e) => console.log('[page]', e.message));
  const js = (code) => win.webContents.executeJavaScript(code);
  const waitFor = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(200); } throw new Error('timeout: ' + expr); };
  let form;
  try {
    await session.defaultSession.clearStorageData(); // always start unpaired
    try { fs.unlinkSync(outFile); } catch {}
    // The form must hold the keyboard focus before the camera starts reading.
    form = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', formPs1, outFile, '20000']);
    await sleep(2500);
    await win.loadURL(origin + '/');
    await waitFor(`!document.getElementById('screen-pair').hidden`);
    await js(`document.getElementById('pair-code').value='${code}'; document.getElementById('pair-form').requestSubmit(); true`);
    await waitFor(`!document.getElementById('screen-intro').hidden || !document.getElementById('screen-scan').hidden`);
    console.log('PAIRED; conn =', await js(`document.getElementById('conn-text').textContent`));
    if (await js(`!document.getElementById('screen-intro').hidden`)) await js(`document.getElementById('btn-camera').click(); true`);
    await waitFor(`/Inserido/.test(document.getElementById('result-msg').textContent)`);
    console.log('SCAN 1:', await js(`document.getElementById('result-value').textContent + ' | ' + document.getElementById('result-msg').textContent`));
    await sleep(5000); // barcode stays in view: must NOT be sent again
    await js(`document.getElementById('btn-repeat').click(); true`);
    await sleep(1500);
    console.log('REPEAT:', await js(`document.getElementById('result-msg').textContent`));
    await win.webContents.capturePage().then((img) => fs.writeFileSync(path.join(__dirname, 'phone.png'), img.toPNG()));
    await new Promise((r) => form.on('exit', r));
    console.log('FORM TEXT:', JSON.stringify(fs.readFileSync(outFile, 'utf8').replace(/^\uFEFF/, '')));
  } catch (err) {
    console.error('FAIL', err.message);
    console.error('PHONE UI:', await js(`JSON.stringify({ conn: document.getElementById('conn-text').textContent, value: document.getElementById('result-value').textContent, msg: document.getElementById('result-msg').textContent, phase: document.getElementById('viewport').dataset.phase })`));
    process.exitCode = 1;
  }
  app.quit();
});

