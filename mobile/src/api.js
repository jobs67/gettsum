// HTTP client for the Gettsum desktop that served this page (same origin).

const AUTH_KEY = 'gettsum.auth';

export class UnauthorizedError extends Error {}
export class NetworkError extends Error {}

export function loadAuth() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    return auth && auth.deviceId && auth.secret ? auth : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

async function call(method, path, { body, auth, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth.deviceId}.${auth.secret}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    throw new NetworkError(err.name === 'AbortError' ? 'Tempo esgotado' : 'Sem conexão com o computador');
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON error page
  }
  if (res.status === 401 && auth) throw new UnauthorizedError(data?.message || 'Não autorizado');
  if (!res.ok) {
    const err = new Error(data?.message || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  pair: (payload) => call('POST', '/api/pair', { body: payload }),
  status: (auth) => call('GET', '/api/status', { auth, timeoutMs: 4000 }),
  scan: (auth, scan) => call('POST', '/api/scan', { auth, body: scan, timeoutMs: 10000 }),
  rename: (auth, name) => call('POST', '/api/device', { auth, body: { name } }),
  unpair: (auth) => call('POST', '/api/unpair', { auth }),
};
