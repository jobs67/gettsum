'use strict';

const $ = (id) => document.getElementById(id);
const api = window.gettsum;
let state = null;
let renaming = false; // skip re-rendering the device list while a name is being edited

const STATUS_LABEL = {
  inserted: 'Inserido',
  copied: 'Copiado',
  paused: 'Pausado',
  error: 'Falhou',
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
}

function timeAgo(ts) {
  if (!ts) return 'nunca conectado nesta sessão';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'agora';
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  return `há ${Math.round(s / 3600)} h`;
}

function render(s) {
  state = s;
  $('desktop-name').textContent = s.desktopName;
  $('desktopName').placeholder = s.desktopName;

  // status
  const online = s.devices.filter((d) => d.online);
  const status = $('status');
  let text;
  let tone;
  if (!s.server.listening) {
    text = s.server.error ? 'Servidor parado' : 'Iniciando…';
    tone = 'bad';
  } else if (s.settings.paused) {
    text = 'Recepção pausada';
    tone = 'warn';
  } else if (online.length) {
    text = `Conectado: ${online.map((d) => d.name).join(', ')}`;
    tone = 'ok';
  } else {
    text = s.devices.length ? 'Aguardando o celular abrir o Gettsum' : 'Aguardando pareamento';
    tone = 'idle';
  }
  status.dataset.tone = tone;
  $('status-text').textContent = text;

  // banner
  const banner = $('banner');
  const bannerText = s.server.error || s.notice;
  banner.hidden = !bannerText;
  banner.dataset.tone = s.server.error ? 'bad' : 'warn';
  banner.textContent = bannerText || '';
  if (s.server.error) {
    banner.append(' ', el('button', { class: 'link', onclick: () => api.restartServer() }, 'Tentar novamente'));
  }

  // pairing
  $('qr').src = s.pairing.qr || '';
  $('qr').style.visibility = s.pairing.qr ? 'visible' : 'hidden';
  $('qr-locked').hidden = !s.pairing.locked;
  $('url').textContent = s.pairing.url || 'sem rede disponível';
  $('code').textContent = `${s.pairing.code.slice(0, 3)} ${s.pairing.code.slice(3)}`;
  const addrSelect = $('address');
  $('address-field').hidden = s.addresses.length < 2;
  addrSelect.replaceChildren(
    ...s.addresses.map((a) => {
      const opt = el('option', { value: a.address }, `${a.address} (${a.name})`);
      opt.selected = a.address === s.selectedAddress;
      return opt;
    }),
  );

  // devices
  $('no-devices').hidden = s.devices.length > 0;
  if (!renaming) $('devices').replaceChildren(
    ...s.devices.map((d) =>
      el(
        'li',
        { class: d.online ? 'online' : '' },
        el('span', { class: 'dot', title: d.online ? 'Conectado' : 'Desconectado' }),
        el('div', { class: 'grow' }, el('strong', {}, d.name), el('div', { class: 'muted small' }, d.online ? 'Conectado' : `Visto ${timeAgo(d.lastSeen)}`)),
        el('button', { class: 'link', onclick: (e) => startRename(e.target.closest('li'), d) }, 'Renomear'),
        el('button', {
          class: 'link danger',
          onclick: () => {
            if (confirm(`Remover "${d.name}"? Ele não poderá mais enviar leituras até ser pareado de novo.`)) api.removeDevice(d.id);
          },
        }, 'Remover'),
      ),
    ),
  );

  // settings
  const st = s.settings;
  for (const id of ['mode', 'suffix']) $(id).value = st[id];
  for (const id of ['paused', 'maskValues', 'launchAtLogin', 'closeToTray']) $(id).checked = st[id];
  if (document.activeElement !== $('desktopName')) $('desktopName').value = st.desktopName;
  if (document.activeElement !== $('port')) $('port').value = st.port;
  const note = $('platform-note');
  note.hidden = s.directInsert;
  note.textContent = 'Neste sistema a inserção direta não está disponível: o valor é copiado para a área de transferência e você cola com Ctrl/Cmd+V.';
  $('mode').disabled = !s.directInsert;
  $('suffix').disabled = !s.directInsert || st.mode === 'clipboard';

  // history
  $('no-history').hidden = s.history.length > 0;
  $('history').replaceChildren(
    ...s.history.map((h) =>
      el(
        'tr',
        {},
        el('td', {}, new Date(h.at).toLocaleTimeString('pt-BR')),
        el('td', {}, h.device),
        el('td', { class: 'mono' }, h.value),
        el(
          'td',
          {},
          el('span', { class: `tag ${h.status}` }, STATUS_LABEL[h.status] || h.status),
          ' ',
          el('span', { class: 'muted small' }, h.target ? `em “${h.target}”` : h.message || ''),
        ),
      ),
    ),
  );
  tick();
}

function startRename(li, device) {
  const strong = li.querySelector('strong');
  const input = el('input', { maxlength: '40', 'aria-label': 'Novo nome do celular' });
  input.value = device.name;
  let done = false;
  renaming = true;
  const finish = (save) => {
    if (done) return;
    done = true;
    renaming = false;
    if (save && input.value.trim() && input.value.trim() !== device.name) api.renameDevice(device.id, input.value);
    else render(state);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  strong.replaceWith(input);
  input.focus();
  input.select();
}

function tick() {
  if (!state) return;
  const left = Math.max(0, Math.round((state.pairing.expiresAt - Date.now()) / 1000));
  $('expires').textContent = `Código válido por ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

// events
$('regen').addEventListener('click', () => api.regeneratePairing());
$('clear-history').addEventListener('click', () => api.clearHistory());
$('address').addEventListener('change', (e) => api.selectAddress(e.target.value));
for (const id of ['mode', 'suffix']) {
  $(id).addEventListener('change', (e) => api.setSettings({ [id]: e.target.value }));
}
for (const id of ['paused', 'maskValues', 'launchAtLogin', 'closeToTray']) {
  $(id).addEventListener('change', (e) => api.setSettings({ [id]: e.target.checked }));
}
$('desktopName').addEventListener('change', (e) => api.setSettings({ desktopName: e.target.value }));
$('port').addEventListener('change', (e) => api.setSettings({ port: Number(e.target.value) }));

api.onState(render);
api.getState().then(render);
setInterval(tick, 1000);
