import { api, loadAuth, saveAuth, clearAuth, UnauthorizedError, NetworkError } from './api.js';
import { Scanner, FORMATS } from './scanner.js';
import { feedback, unlockAudio } from './feedback.js';

const $ = (id) => document.getElementById(id);

// ---------- preferences ----------

const PREFS_KEY = 'gettsum.prefs';
const DEFAULT_PREFS = {
  sound: true,
  vibration: true,
  confirm: false,
  formats: FORMATS.filter((f) => f.default).map((f) => f.id),
};

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable (private mode): keep in memory
  }
}

// ---------- state ----------

const SAME_CODE_SUPPRESS_MS = 1500; // a code must leave the frame this long before it is read again
const MIN_GAP_MS = 700; // between two different codes

let auth = loadAuth();
let prefs = loadPrefs();
let connection = 'unknown'; // unknown | online | offline
let desktop = null; // last /api/status payload
let phase = 'idle'; // idle | scanning | confirm | sending | failed
let pending = null; // { id, value, format }
let last = null; // last successfully delivered { value, format }, memory only
let userPaused = false;
let lastAcceptAt = 0;
const recentlySeen = new Map(); // value -> last time it was in view
let pollTimer = null;
let pollFailures = 0;
let wakeLock = null;

const scanner = new Scanner($('video'), onDetect);

// ---------- helpers ----------

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function defaultDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return 'Celular';
}

function show(screen) {
  for (const id of ['screen-pair', 'screen-intro', 'screen-scan']) $(id).hidden = id !== screen;
  $('btn-settings').hidden = screen === 'screen-pair';
}

function formatLabel(id) {
  return FORMATS.find((f) => f.id === id)?.label || id || '';
}

// ---------- connection indicator ----------

function renderConnection() {
  const el = $('conn');
  let text;
  let tone;
  if (!auth) {
    text = 'Não pareado';
    tone = 'idle';
  } else if (connection === 'online') {
    tone = desktop.paused ? 'warn' : 'ok';
    text = `Conectado a ${desktop.desktopName}`;
    if (desktop.paused) text += ' · recepção pausada';
  } else if (connection === 'offline') {
    tone = 'bad';
    text = 'Sem conexão — tentando de novo…';
  } else {
    tone = 'idle';
    text = 'Conectando…';
  }
  el.dataset.tone = tone;
  $('conn-text').textContent = text;
  $('offline-help').hidden = connection !== 'offline' || !auth;
}

function schedulePoll(delay) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, delay);
}

async function poll() {
  if (!auth) return;
  try {
    desktop = await api.status(auth);
    connection = 'online';
    pollFailures = 0;
  } catch (err) {
    if (err instanceof UnauthorizedError) return handleUnauthorized();
    pollFailures += 1;
    // Tolerate a single missed poll before showing "disconnected".
    if (pollFailures >= 2) connection = 'offline';
  }
  renderConnection();
  schedulePoll(connection === 'online' ? 3000 : Math.min(10000, 2000 * pollFailures));
}

// ---------- pairing ----------

async function pair(payload) {
  $('pair-error').textContent = '';
  $('pair-busy').hidden = false;
  $('pair-form').hidden = true;
  try {
    const res = await api.pair({ ...payload, name: defaultDeviceName() });
    auth = { deviceId: res.deviceId, secret: res.secret };
    saveAuth(auth);
    desktop = { desktopName: res.desktopName, paused: false };
    connection = 'online';
    renderConnection();
    await enterScanner();
    toast(`Pareado com ${res.desktopName}`);
    poll();
  } catch (err) {
    $('pair-error').textContent =
      err instanceof NetworkError
        ? 'Não foi possível falar com o computador. Verifique o Wi-Fi.'
        : err.status === 401
          ? 'Código inválido ou expirado. Confira o código exibido no computador.'
          : err.message;
  } finally {
    $('pair-busy').hidden = true;
    $('pair-form').hidden = false;
  }
}

function handleUnauthorized() {
  clearAuth();
  auth = null;
  desktop = null;
  connection = 'unknown';
  clearTimeout(pollTimer);
  stopCamera();
  phase = 'idle';
  show('screen-pair');
  $('pair-error').textContent = 'Este celular não está mais autorizado neste computador. Pareie novamente.';
  renderConnection();
}

$('pair-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('pair-code').value.replace(/\D/g, '');
  if (code.length !== 6) {
    $('pair-error').textContent = 'Digite os 6 números exibidos no computador.';
    return;
  }
  pair({ code });
});

// ---------- camera ----------

async function enterScanner() {
  let granted = false;
  try {
    granted = (await navigator.permissions?.query({ name: 'camera' }))?.state === 'granted';
  } catch {
    // Permissions API without "camera" (older Safari)
  }
  if (granted) {
    await startCamera();
  } else {
    show('screen-intro');
  }
}

async function startCamera() {
  $('camera-error').textContent = '';
  try {
    await scanner.setFormats(prefs.formats);
    if (!scanner.running) await scanner.start();
    show('screen-scan');
    $('btn-torch').hidden = !scanner.torchSupported;
    // Returning to the app must not drop a scan that is waiting for a decision.
    setPhase(phase === 'idle' ? 'scanning' : phase);
    requestWakeLock();
  } catch (err) {
    show('screen-intro');
    $('camera-error').textContent =
      err.name === 'NotAllowedError'
        ? 'O acesso à câmera foi negado. Libere a câmera para este site nas configurações do navegador e toque em “Ativar câmera”.'
        : err.name === 'NotFoundError'
          ? 'Nenhuma câmera encontrada neste aparelho.'
          : err.message;
  }
}

function stopCamera() {
  scanner.active = false;
  scanner.stop();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    // not supported / not allowed: the screen may dim while scanning
  }
}

$('btn-camera').addEventListener('click', () => {
  unlockAudio();
  startCamera();
});

document.addEventListener('visibilitychange', () => {
  if (!auth) return;
  if (document.hidden) {
    stopCamera();
  } else {
    poll();
    if (!$('screen-scan').hidden || phase !== 'idle') startCamera();
  }
});

// ---------- scanning flow ----------

function setPhase(next) {
  phase = next;
  scanner.active = !userPaused && auth !== null;
  $('viewport').dataset.phase = userPaused ? 'paused' : next;
  $('hint').textContent = userPaused
    ? 'Leitura pausada'
    : next === 'scanning'
      ? 'Aponte para o código de barras'
      : next === 'sending'
        ? 'Enviando…'
        : '';
  $('btn-repeat').disabled = !last || next === 'sending';
}

function onDetect({ value, format }) {
  const now = Date.now();
  for (const [v, t] of recentlySeen) if (now - t > SAME_CODE_SUPPRESS_MS) recentlySeen.delete(v);

  const stillInView = recentlySeen.has(value);
  recentlySeen.set(value, now);
  if (stillInView || phase !== 'scanning' || now - lastAcceptAt < MIN_GAP_MS) return;
  lastAcceptAt = now;

  feedback('read', prefs);
  flash();
  pending = { id: newId(), value, format };
  if (prefs.confirm) openConfirm();
  else send();
}

function flash() {
  const vp = $('viewport');
  vp.classList.remove('flash');
  void vp.offsetWidth; // restart animation
  vp.classList.add('flash');
}

function openConfirm() {
  setPhase('confirm');
  $('confirm-value').textContent = pending.value;
  $('confirm-format').textContent = formatLabel(pending.format);
  $('confirm-target').textContent = desktop ? `Será inserido no campo ativo de ${desktop.desktopName}.` : '';
  $('sheet-confirm').showModal();
}

$('confirm-send').addEventListener('click', () => {
  $('sheet-confirm').close();
  send();
});
$('confirm-rescan').addEventListener('click', () => {
  // Allow the same code to be read again right away.
  recentlySeen.delete(pending.value);
  pending = null;
  $('sheet-confirm').close();
  setPhase('scanning');
});
$('confirm-cancel').addEventListener('click', () => {
  pending = null;
  $('sheet-confirm').close();
  setPhase('scanning');
});
$('sheet-confirm').addEventListener('cancel', (e) => {
  e.preventDefault(); // force an explicit choice
});

function renderResult({ tone, value, message, actions = [] }) {
  const box = $('result');
  box.dataset.tone = tone;
  $('result-value').textContent = value ?? '—';
  $('result-msg').textContent = message;
  $('result-actions').replaceChildren(
    ...actions.map(([label, handler, primary]) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (primary) b.className = 'primary';
      b.addEventListener('click', handler);
      return b;
    }),
  );
}

async function send() {
  const scan = pending;
  setPhase('sending');
  renderResult({ tone: 'busy', value: scan.value, message: 'Enviando ao computador…' });
  let result;
  try {
    result = await api.scan(auth, scan);
  } catch (err) {
    if (err instanceof UnauthorizedError) return handleUnauthorized();
    feedback('error', prefs);
    connection = err instanceof NetworkError ? 'offline' : connection;
    renderConnection();
    return failed(
      scan,
      err instanceof NetworkError
        ? 'Não foi possível confirmar o envio. Verifique a conexão e tente novamente — o valor não será digitado duas vezes.'
        : err.message,
    );
  }

  connection = 'online';
  renderConnection();
  if (result.status === 'inserted' || result.status === 'copied') {
    pending = null;
    last = { value: scan.value, format: scan.format };
    feedback('success', prefs);
    renderResult({
      tone: result.status === 'inserted' ? 'ok' : 'warn',
      value: scan.value,
      message:
        result.status === 'inserted'
          ? `✓ Inserido${result.target ? ` em “${result.target}”` : ''}`
          : result.message || 'Copiado para a área de transferência do computador — cole com Ctrl+V.',
    });
    setPhase('scanning');
  } else {
    feedback('error', prefs);
    failed(scan, result.message || 'O computador não conseguiu inserir o valor.');
  }
}

function failed(scan, message) {
  setPhase('failed');
  renderResult({
    tone: 'bad',
    value: scan.value,
    message,
    actions: [
      ['Tentar novamente', () => { pending = scan; send(); }, true],
      ['Descartar', () => {
        pending = null;
        renderResult({ tone: 'idle', value: null, message: 'Leitura descartada.' });
        setPhase('scanning');
      }],
    ],
  });
}

$('btn-repeat').addEventListener('click', () => {
  if (!last || phase === 'sending') return;
  pending = { id: newId(), ...last }; // explicit repeat: a new id, so it is inserted again
  send();
});

$('btn-torch').addEventListener('click', async () => {
  try {
    const on = await scanner.toggleTorch();
    $('btn-torch').setAttribute('aria-pressed', String(on));
  } catch {
    toast('Não foi possível ligar a lanterna.');
  }
});

$('btn-pause').addEventListener('click', () => {
  userPaused = !userPaused;
  $('btn-pause').textContent = userPaused ? '▶ Retomar' : '⏸ Pausar';
  $('btn-pause').setAttribute('aria-pressed', String(userPaused));
  setPhase(phase);
});

// ---------- settings ----------

function renderSettings() {
  $('set-name').value = '';
  $('set-name').placeholder = desktop?.deviceName || '';
  $('set-sound').checked = prefs.sound;
  $('set-vibration').checked = prefs.vibration;
  $('set-vibration').disabled = !navigator.vibrate;
  $('vibration-note').hidden = Boolean(navigator.vibrate);
  $('set-confirm').checked = prefs.confirm;
  $('set-formats').replaceChildren(
    ...FORMATS.map((f) => {
      const label = document.createElement('label');
      label.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = f.id;
      input.checked = prefs.formats.includes(f.id);
      label.append(input, ` ${f.label}`);
      return label;
    }),
  );
  $('set-info').textContent = desktop
    ? `Conectado a ${desktop.desktopName} pela rede local (${location.host}), com criptografia HTTPS. ` +
      (desktop.directInsert ? '' : 'Este computador copia o valor para a área de transferência em vez de digitar. ') +
      `Leitor: ${scanner.engine || '—'}.`
    : '';
}

$('btn-settings').addEventListener('click', () => {
  renderSettings();
  $('sheet-settings').showModal();
});

$('settings-close').addEventListener('click', async () => {
  prefs.sound = $('set-sound').checked;
  prefs.vibration = $('set-vibration').checked;
  prefs.confirm = $('set-confirm').checked;
  const formats = [...$('set-formats').querySelectorAll('input:checked')].map((i) => i.value);
  const formatsChanged = formats.join() !== prefs.formats.join();
  if (formats.length) prefs.formats = formats;
  savePrefs();
  if (formatsChanged && formats.length) await scanner.setFormats(prefs.formats);

  const name = $('set-name').value.trim();
  if (name) {
    try {
      const res = await api.rename(auth, name);
      if (desktop) desktop.deviceName = res.name;
      toast('Nome atualizado');
    } catch {
      toast('Não foi possível renomear agora.');
    }
  }
  $('sheet-settings').close();
});

$('settings-unpair').addEventListener('click', async () => {
  if (!confirm('Desconectar este celular do computador? Será preciso parear novamente.')) return;
  try {
    await api.unpair(auth);
  } catch {
    // even offline, forget the credentials locally
  }
  $('sheet-settings').close();
  handleUnauthorized();
  $('pair-error').textContent = 'Celular desconectado.';
});

// ---------- toast ----------

let toastTimer = null;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2500);
}

// ---------- boot ----------

document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

async function boot() {
  const token = new URLSearchParams(location.hash.slice(1)).get('p');
  if (token) history.replaceState(null, '', location.pathname); // keep the token out of history

  renderConnection();
  if (auth) {
    show('screen-intro');
    await poll();
    if (auth) return enterScanner();
  }
  show('screen-pair');
  if (token) pair({ token });
}

boot();
