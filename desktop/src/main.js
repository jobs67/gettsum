'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, nativeImage, Notification, shell } = require('electron');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');

const { JsonStore } = require('./store');
const { listLanAddresses } = require('./net');
const { ensureCertificate } = require('./cert');
const { PairingManager } = require('./pairing');
const { DeviceRegistry, cleanName } = require('./devices');
const { ScanProcessor } = require('./scan-processor');
const { createServer } = require('./server');
const { createInjector } = require('./injector');

const MOBILE_DIR = path.join(__dirname, '..', 'mobile-dist');
const HISTORY_LIMIT = 20;
const SETTINGS_DEFAULTS = {
  desktopName: '',
  suffix: 'none', // none | enter | tab — off by default to avoid accidental form submission
  mode: 'type', // type | paste | clipboard
  paused: false,
  maskValues: false,
  preferredAddress: null,
  port: 47800,
  launchAtLogin: false,
  closeToTray: true,
};
const ENUMS = { suffix: ['none', 'enter', 'tab'], mode: ['type', 'paste', 'clipboard'] };

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let tray = null;
let quitting = false;
let settings, devices, pairing, injector, server;
let serverState = { listening: false, error: null, port: null };
let tlsFingerprint = null;
let history = []; // in memory only: cleared when the app exits
let lastOnlineSnapshot = '';
let notice = null;

function desktopName() {
  return settings.get().desktopName || os.hostname();
}

function addresses() {
  return listLanAddresses();
}

function selectedAddress() {
  const list = addresses();
  const preferred = settings.get().preferredAddress;
  return list.find((a) => a.address === preferred) || list[0] || null;
}

function pairingUrl(session) {
  const addr = selectedAddress();
  if (!addr || !serverState.port) return null;
  return {
    base: `https://${addr.address}:${serverState.port}`,
    full: `https://${addr.address}:${serverState.port}/#p=${session.token}`,
  };
}

async function snapshot() {
  const session = pairing.current();
  const url = pairingUrl(session);
  const s = settings.get();
  return {
    desktopName: desktopName(),
    settings: s,
    directInsert: injector.directInsert,
    platform: process.platform,
    server: serverState,
    fingerprint: tlsFingerprint,
    addresses: addresses(),
    selectedAddress: selectedAddress()?.address || null,
    pairing: {
      code: session.code,
      expiresAt: session.expiresAt,
      locked: pairing.isLocked(),
      url: url?.base || null,
      qr: url ? await QRCode.toDataURL(url.full, { margin: 1, width: 280, errorCorrectionLevel: 'M' }) : null,
    },
    devices: devices.list(),
    history: history.map((h) => ({ ...h, value: s.maskValues ? mask(h.value) : h.value })),
    notice,
  };
}

function mask(value) {
  return value.length <= 4 ? '••••' : `${'•'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

function pushState() {
  if (win && !win.isDestroyed()) {
    snapshot().then((s) => win.webContents.send('state', s)).catch((e) => console.error(e));
  }
  updateTray();
}

function onlineDevices() {
  return devices.list().filter((d) => d.online);
}

// ---------- tray & window ----------

/** Procedurally drawn barcode icon (avoids shipping binary assets). */
function makeIcon(size, rgb) {
  const buf = Buffer.alloc(size * size * 4);
  const bars = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1];
  const margin = Math.round(size * 0.12);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = x >= margin && x < size - margin && y >= margin && y < size - margin;
      const bar = bars[Math.floor(((x - margin) / (size - 2 * margin)) * bars.length)];
      if (inside && bar) {
        buf[i] = rgb[2]; // B
        buf[i + 1] = rgb[1]; // G
        buf[i + 2] = rgb[0]; // R
        buf[i + 3] = 255;
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

const ICON_ON = [22, 163, 74];
const ICON_OFF = [100, 116, 139];

function updateTray() {
  if (!tray) return;
  const online = onlineDevices();
  const paused = settings.get().paused;
  tray.setImage(makeIcon(16, online.length && !paused ? ICON_ON : ICON_OFF));
  const status = paused
    ? 'Recepção pausada'
    : online.length
      ? `Conectado: ${online.map((d) => d.name).join(', ')}`
      : 'Aguardando celular';
  tray.setToolTip(`Gettsum — ${status}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Gettsum — ${status}`, enabled: false },
      { type: 'separator' },
      { label: 'Abrir', click: showWindow },
      {
        label: paused ? 'Retomar recepção' : 'Pausar recepção',
        click: () => updateSettings({ paused: !paused }),
      },
      { type: 'separator' },
      { label: 'Sair', click: () => { quitting = true; app.quit(); } },
    ]),
  );
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    title: 'Gettsum',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('close', (e) => {
    if (!quitting && settings.get().closeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
}

function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body, silent: true }).show();
}

// ---------- settings ----------

function updateSettings(patch) {
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in SETTINGS_DEFAULTS)) continue;
    if (ENUMS[k] && !ENUMS[k].includes(v)) continue;
    if (typeof SETTINGS_DEFAULTS[k] === 'boolean') clean[k] = Boolean(v);
    else if (k === 'desktopName') clean[k] = cleanName(v, '');
    else if (k === 'port') {
      const port = Number(v);
      if (Number.isInteger(port) && port >= 1024 && port <= 65535) clean[k] = port;
    } else clean[k] = v;
  }
  const before = settings.get();
  settings.set(clean);
  if ('launchAtLogin' in clean) {
    app.setLoginItemSettings({ openAtLogin: clean.launchAtLogin, openAsHidden: true, args: ['--hidden'] });
  }
  if ('port' in clean && clean.port !== before.port) restartServer();
  pushState();
}

// ---------- server ----------

async function startServer() {
  const s = settings.get();
  const ips = addresses().map((a) => a.address);
  try {
    const tls = await ensureCertificate(app.getPath('userData'), { hostname: os.hostname(), ips });
    tlsFingerprint = tls.fingerprint;
    if (tls.regenerated && devices.list().length) {
      notice = 'O endereço do computador mudou: os celulares precisarão aceitar o certificado novamente.';
    }
    const processor = new ScanProcessor({
      inject: (value, opts) => injector.insert(value, opts),
      getSettings: () => settings.get(),
      onResult: (r) => {
        history = [
          {
            at: Date.now(),
            device: r.device.name,
            value: r.value,
            format: r.format,
            status: r.status,
            target: r.target,
            message: r.message,
          },
          ...history,
        ].slice(0, HISTORY_LIMIT);
        pushState();
      },
    });
    server = createServer({
      tls,
      staticDir: MOBILE_DIR,
      pairing,
      devices,
      processor,
      getStatus: () => ({
        desktopName: desktopName(),
        paused: settings.get().paused,
        mode: settings.get().mode,
        suffix: settings.get().suffix,
        directInsert: injector.directInsert,
      }),
      onEvent: (type, payload) => {
        if (type === 'paired') {
          notice = null;
          notify('Gettsum', `Celular pareado: ${payload.name}`);
        }
        if (type === 'pairing-locked') notify('Gettsum', 'Muitas tentativas de pareamento inválidas. Um novo código foi gerado.');
        pushState();
      },
    });
    const port = await server.listen(s.port);
    serverState = { listening: true, error: null, port };
  } catch (err) {
    console.error('[gettsum] servidor:', err);
    const busy = err.code === 'EADDRINUSE';
    serverState = {
      listening: false,
      port: null,
      error: busy ? `A porta ${s.port} já está em uso. Feche o outro programa ou altere a porta nas configurações.` : `Não foi possível iniciar o servidor: ${err.message}`,
    };
  }
  pushState();
}

async function restartServer() {
  if (server) await server.close();
  server = null;
  serverState = { listening: false, error: null, port: null };
  await startServer();
}

// ---------- IPC ----------

function registerIpc() {
  ipcMain.handle('state:get', () => snapshot());
  ipcMain.handle('settings:set', (_e, patch) => updateSettings(patch || {}));
  ipcMain.handle('pairing:regenerate', () => {
    pairing.regenerate();
    pushState();
  });
  ipcMain.handle('device:remove', (_e, id) => {
    devices.remove(String(id));
    pushState();
  });
  ipcMain.handle('device:rename', (_e, id, name) => {
    devices.rename(String(id), name);
    pushState();
  });
  ipcMain.handle('history:clear', () => {
    history = [];
    pushState();
  });
  ipcMain.handle('address:select', (_e, address) => updateSettings({ preferredAddress: String(address) }));
  ipcMain.handle('server:restart', () => restartServer());
}

// ---------- lifecycle ----------

app.on('second-instance', showWindow);
app.on('before-quit', () => {
  quitting = true;
});
app.on('window-all-closed', () => {
  // Keep running in the tray.
});

app.whenReady().then(async () => {
  app.setAppUserModelId('app.gettsum.desktop');
  const dataDir = app.getPath('userData');
  settings = new JsonStore(path.join(dataDir, 'settings.json'), SETTINGS_DEFAULTS);
  devices = new DeviceRegistry(new JsonStore(path.join(dataDir, 'devices.json'), { devices: [] }));
  pairing = new PairingManager({ onChange: () => setImmediate(pushState) });
  injector = createInjector({ clipboard });

  registerIpc();
  tray = new Tray(makeIcon(16, ICON_OFF));
  tray.on('click', showWindow);
  updateTray();

  if (!process.argv.includes('--hidden')) createWindow();
  await startServer();

  // Refresh connection indicators and expire the pairing code on time.
  setInterval(() => {
    pairing.current();
    const snapshotKey = onlineDevices().map((d) => d.id).join(',');
    if (snapshotKey !== lastOnlineSnapshot) {
      lastOnlineSnapshot = snapshotKey;
      pushState();
    }
  }, 2000);
});
