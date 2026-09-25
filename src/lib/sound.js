/* Synthesised rather than sampled: no files to fetch, nothing to licence,
   and the timbre is tunable in place. Everything here is short, clean
   noise ticks and unresonant sine/triangle tones -- filtered noise for
   attack, plain fixed or two-note chimes for confirmation, nothing that
   bends pitch far enough to read as a sci-fi sweep. */

const STORE_KEY = 'a69-sound';

let ctx = null;
let master = null;
let wet = null;
let noiseBuf = null;
let enabled = true;
let started = false;

function readPref() {
  try {
    return localStorage.getItem(STORE_KEY) !== 'off';
  } catch {
    return true; // private mode, blocked storage: fall back to on
  }
}

function writePref(on) {
  try { localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}

/* A second of decaying noise makes a serviceable room. It is what gives the
   clicks their tail — dry, they sound like a UI from 2009. */
function impulse(seconds = 1.2, decay = 3.4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function noise(seconds = 1) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function boot() {
  if (started) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  started = true;

  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  const verb = ctx.createConvolver();
  verb.buffer = impulse();
  wet = ctx.createGain();
  wet.gain.value = 0.3;
  wet.connect(verb);
  verb.connect(master);

  noiseBuf = noise();
}

// a voice's output goes to both the dry master and the reverb send
function bus(gain) {
  gain.connect(master);
  gain.connect(wet);
}

function env(node, peak, attack, hold, release, delay = 0) {
  const t = ctx.currentTime + delay;
  node.gain.cancelScheduledValues(t);
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.setValueAtTime(peak, t + attack + hold);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release;
}

// delay lets a voice place a second or third note a beat after the first,
// which is what turns a single tone into a short chime rather than a chord
function tone({ type = 'sine', from, to, peak, attack, hold, release, cutoff = 900, q = 1, delay = 0 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  const t = ctx.currentTime + delay;
  osc.frequency.setValueAtTime(from, t);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, t + attack + hold + release);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = q;

  const g = ctx.createGain();
  const end = env(g, peak, attack, hold, release, delay);

  osc.connect(filter); filter.connect(g); bus(g);
  osc.start(t);
  osc.stop(end + 0.05);
}

function hiss({ peak, attack, hold, release, cutoff, q = 1, type = 'bandpass', sweepTo, delay = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  const t = ctx.currentTime + delay;
  filter.frequency.setValueAtTime(cutoff, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + hold + release);
  filter.Q.value = q;

  const g = ctx.createGain();
  const end = env(g, peak, attack, hold, release, delay);

  src.connect(filter); filter.connect(g); bus(g);
  src.start(t);
  src.stop(end + 0.05);
}

/* Redesigned around three rules that the previous palette broke:
   no filter Q above ~1 (that resonance is what read as a cheap synth
   "boing"), no oscillator sweeping more than a few dozen Hz (a fast wide
   sweep is a sci-fi laser, not a UI tick), and anything confirmatory is a
   short two-note chime at a clean interval -- a fourth or fifth -- rather
   than one tone bending. Ticks lean on filtered noise for their attack,
   the way a real key or shutter does, with a fixed-pitch triangle under it
   for body instead of a moving sine. */
const voices = {
  // barely there: a soft high tick, no tone bend
  hover() {
    hiss({ peak: 0.16, attack: 0.002, hold: 0.003, release: 0.045, cutoff: 3000, q: 1, type: 'highpass' });
    tone({ type: 'triangle', from: 780, peak: 0.05, attack: 0.002, hold: 0.004, release: 0.05, cutoff: 1500, q: 0.7 });
  },

  // a clean tap: a tight noise attack over a fixed, unbent low body
  click() {
    hiss({ peak: 0.18, attack: 0.001, hold: 0.004, release: 0.05, cutoff: 3400, q: 1, type: 'highpass' });
    tone({ type: 'triangle', from: 220, peak: 0.28, attack: 0.002, hold: 0.01, release: 0.1, cutoff: 480, q: 0.9 });
  },

  // a soft two-note pad, a fifth apart -- a room settling, not a machine
  section() {
    tone({ type: 'sine', from: 220, peak: 0.16, attack: 0.12, hold: 0.05, release: 0.5, cutoff: 500, q: 0.8 });
    tone({ type: 'sine', from: 330, peak: 0.11, attack: 0.14, hold: 0.05, release: 0.55, cutoff: 700, q: 0.8, delay: 0.03 });
    hiss({ peak: 0.04, attack: 0.18, hold: 0.04, release: 0.4, cutoff: 1400, q: 0.6, type: 'bandpass' });
  },

  // the site arriving: an ascending chime, G4 to D5, with a breath of air
  reveal() {
    tone({ type: 'sine', from: 392, peak: 0.24, attack: 0.01, hold: 0.05, release: 0.55, cutoff: 1000, q: 0.8 });
    tone({ type: 'sine', from: 587, peak: 0.2, attack: 0.01, hold: 0.06, release: 0.65, cutoff: 1300, q: 0.8, delay: 0.09 });
    hiss({ peak: 0.045, attack: 0.04, hold: 0.05, release: 0.6, cutoff: 2400, q: 0.6, type: 'bandpass' });
  },

  // a gate opening: a gentle rising swoosh, narrower and quieter at the
  // top than the old sweep, closing on an A4-E5 confirm chime
  transition() {
    hiss({ peak: 0.09, attack: 0.08, hold: 0.04, release: 0.26, cutoff: 500, sweepTo: 1300, q: 0.9 });
    tone({ type: 'sine', from: 440, peak: 0.22, attack: 0.01, hold: 0.04, release: 0.22, cutoff: 1200, q: 0.8, delay: 0.09 });
    tone({ type: 'sine', from: 659, peak: 0.19, attack: 0.01, hold: 0.05, release: 0.3, cutoff: 1400, q: 0.8, delay: 0.15 });
  },
};

export function play(name) {
  if (!enabled || !started || document.hidden) return;
  if (ctx.state === 'suspended') ctx.resume();
  const v = voices[name];
  if (v) { try { v(); } catch { /* a dropped sound is never worth an error */ } }
}

export function initSound() {
  enabled = readPref();

  // Browsers hold the context suspended until a gesture, so it is built on
  // the first one rather than at load.
  const unlock = () => {
    boot();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((e) =>
    window.addEventListener(e, unlock, { once: true, passive: true })
  );

  const toggle = document.getElementById('soundToggle');
  const paint = () => {
    if (!toggle) return;
    toggle.classList.toggle('is-off', !enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? 'Silenciar sonido' : 'Activar sonido');
  };
  paint();

  if (toggle) {
    toggle.addEventListener('click', () => {
      enabled = !enabled;
      writePref(enabled);
      paint();
      if (enabled) { unlock(); play('hover'); }
    });
  }

  const INTERACTIVE = 'a, button, .work-card, .service-card, .event-row, .field input, .field textarea';

  /* Delegated, and only when the pointer actually crosses into a new
     element: mouseover alone re-fires while moving within one. */
  let lastHover = null;
  let lastHoverAt = 0;
  document.addEventListener('mouseover', (e) => {
    if (window.matchMedia('(hover: none)').matches) return;
    const el = e.target.closest(INTERACTIVE);
    if (!el || el === lastHover || el.id === 'soundToggle') return;
    lastHover = el;
    const now = performance.now();
    if (now - lastHoverAt < 55) return; // sweeping a grid should not machine-gun
    lastHoverAt = now;
    play('hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest?.(INTERACTIVE)) lastHover = null;
  });

  /* Same chime, same debounce state as the mouseover above -- keyboard
     attention landing on a card (Tab, or the arrow-key nav jumping
     between them) is the same event as a pointer landing on one, just
     through a different input. Not gated behind (hover: none) the way
     mouseover is: that guard exists to stop touch's synthetic hover on
     tap, which doesn't apply here, since focus only ever moves this way
     from a real keyboard. */
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.(INTERACTIVE);
    if (!el || el === lastHover || el.id === 'soundToggle') return;
    lastHover = el;
    const now = performance.now();
    if (now - lastHoverAt < 55) return;
    lastHoverAt = now;
    play('hover');
  });

  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest(INTERACTIVE)) play('click');
  });

  /* One note per section as it takes the viewport. rootMargin pins the
     trigger to a band across the middle so it fires once per section rather
     than twice at each edge. */
  const sections = document.querySelectorAll('main section[id]');
  if (sections.length && 'IntersectionObserver' in window) {
    let current = null;
    let settled = false;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        if (id === current) continue;
        current = id;
        if (settled) play('section');
      }
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    sections.forEach((s) => io.observe(s));
    // the first section resolving on load is not a transition
    setTimeout(() => { settled = true; }, 1200);
  }
}
