'use strict';

// Win32 text injection through SendInput (KEYEVENTF_UNICODE), so text reaches the focused
// control regardless of the keyboard layout, at the current caret position.

const koffi = require('koffi');

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');
const advapi32 = koffi.load('advapi32.dll');

const MOUSEINPUT = koffi.struct('GETTSUM_MOUSEINPUT', {
  dx: 'int32', dy: 'int32', mouseData: 'uint32', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t',
});
const KEYBDINPUT = koffi.struct('GETTSUM_KEYBDINPUT', {
  wVk: 'uint16', wScan: 'uint16', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t',
});
const HARDWAREINPUT = koffi.struct('GETTSUM_HARDWAREINPUT', {
  uMsg: 'uint32', wParamL: 'uint16', wParamH: 'uint16',
});
const INPUT = koffi.struct('GETTSUM_INPUT', {
  type: 'uint32',
  u: koffi.union({ mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT }),
});

const SendInput = user32.func('__stdcall', 'SendInput', 'uint32', ['uint32', koffi.pointer(INPUT), 'int']);
const GetForegroundWindow = user32.func('__stdcall', 'GetForegroundWindow', 'void *', []);
const GetWindowTextW = user32.func('__stdcall', 'GetWindowTextW', 'int', ['void *', koffi.out(koffi.pointer('uint16_t')), 'int']);
const GetWindowThreadProcessId = user32.func('__stdcall', 'GetWindowThreadProcessId', 'uint32', ['void *', koffi.out(koffi.pointer('uint32_t'))]);
const OpenProcess = kernel32.func('__stdcall', 'OpenProcess', 'void *', ['uint32', 'bool', 'uint32']);
const GetCurrentProcess = kernel32.func('__stdcall', 'GetCurrentProcess', 'void *', []);
const CloseHandle = kernel32.func('__stdcall', 'CloseHandle', 'bool', ['void *']);
const OpenProcessToken = advapi32.func('__stdcall', 'OpenProcessToken', 'bool', ['void *', 'uint32', koffi.out(koffi.pointer('void *'))]);
const GetTokenInformation = advapi32.func('__stdcall', 'GetTokenInformation', 'bool',
  ['void *', 'int', koffi.out(koffi.pointer('uint32_t')), 'uint32', koffi.out(koffi.pointer('uint32_t'))]);

const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;
const VK = { RETURN: 0x0d, TAB: 0x09, CONTROL: 0x11, V: 0x56 };
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const TOKEN_QUERY = 0x0008;
const TOKEN_ELEVATION = 20;

const INPUT_SIZE = koffi.sizeof(INPUT);

function key(wVk, wScan, flags) {
  return { type: INPUT_KEYBOARD, u: { ki: { wVk, wScan, dwFlags: flags, time: 0, dwExtraInfo: 0 } } };
}

function vkPress(vk) {
  return [key(vk, 0, 0), key(vk, 0, KEYEVENTF_KEYUP)];
}

function unicodeInputs(text) {
  const inputs = [];
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i); // UTF-16 code units; surrogate pairs are sent as two units
    inputs.push(key(0, unit, KEYEVENTF_UNICODE), key(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
  }
  return inputs;
}

function suffixInputs(suffix) {
  if (suffix === 'enter') return vkPress(VK.RETURN);
  if (suffix === 'tab') return vkPress(VK.TAB);
  return [];
}

function pasteInputs() {
  return [key(VK.CONTROL, 0, 0), ...vkPress(VK.V), key(VK.CONTROL, 0, KEYEVENTF_KEYUP)];
}

function send(inputs) {
  if (inputs.length === 0) return;
  const sent = SendInput(inputs.length, inputs, INPUT_SIZE);
  if (sent !== inputs.length) {
    throw new Error(`SendInput enviou ${sent} de ${inputs.length} eventos`);
  }
}

function isElevated(processHandle) {
  const token = [null];
  if (!OpenProcessToken(processHandle, TOKEN_QUERY, token)) return null; // unknown
  try {
    const elevation = [0];
    const len = [0];
    if (!GetTokenInformation(token[0], TOKEN_ELEVATION, elevation, 4, len)) return null;
    return elevation[0] !== 0;
  } finally {
    CloseHandle(token[0]);
  }
}

const selfElevated = isElevated(GetCurrentProcess()) === true;

function processElevated(pid) {
  const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
  if (!handle) return null;
  try {
    return isElevated(handle);
  } finally {
    CloseHandle(handle);
  }
}

/**
 * Describes the window that will receive the keystrokes.
 * @returns {{ hwnd: unknown, title: string, pid: number, blockedByUipi: boolean } | null}
 */
function foregroundTarget() {
  const hwnd = GetForegroundWindow();
  if (!hwnd) return null;
  const buf = new Uint16Array(256);
  const len = GetWindowTextW(hwnd, buf, buf.length);
  const title = Buffer.from(buf.buffer, 0, Math.max(0, len) * 2).toString('utf16le');
  const pid = [0];
  GetWindowThreadProcessId(hwnd, pid);
  // A non-elevated process cannot send input to an elevated window (UIPI): SendInput would
  // silently drop the events, so detect it upfront. An unreadable token is treated as elevated.
  const targetElevated = processElevated(pid[0]);
  const blockedByUipi = !selfElevated && targetElevated !== false;
  return { hwnd, title, pid: pid[0], blockedByUipi };
}

module.exports = {
  foregroundTarget,
  typeText(text, suffix) {
    send([...unicodeInputs(text), ...suffixInputs(suffix)]);
  },
  pressPaste(suffix) {
    send([...pasteInputs(), ...suffixInputs(suffix)]);
  },
  INPUT_SIZE,
};
