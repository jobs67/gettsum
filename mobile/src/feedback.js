// Sound and vibration feedback. The AudioContext must be unlocked by a user gesture (iOS).

let ctx = null;

export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq, start, duration, volume = 0.2) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

const PATTERNS = {
  read: { tones: [[1900, 0, 0.09]], vibrate: [60] },
  success: { tones: [[2300, 0, 0.06]], vibrate: [] },
  error: { tones: [[420, 0, 0.14], [320, 0.18, 0.2]], vibrate: [120, 80, 120] },
};

/**
 * @param {'read'|'success'|'error'} kind
 * @param {{ sound: boolean, vibration: boolean }} prefs
 */
export function feedback(kind, prefs) {
  const p = PATTERNS[kind];
  if (prefs.sound && ctx) {
    try {
      p.tones.forEach(([f, s, d]) => tone(f, s, d));
    } catch {
      // ignore audio failures
    }
  }
  // Vibration API is unavailable on iOS Safari; no-op there.
  if (prefs.vibration && p.vibrate.length && navigator.vibrate) navigator.vibrate(p.vibrate);
}
