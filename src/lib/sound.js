/* Synthesised rather than sampled: no files to fetch, nothing to licence,
   and the timbre is tunable in place. Everything here is low-passed and
   short — the palette is sub thumps and filtered noise, not beeps. */

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

function env(node, peak, attack, hold, release) {
  const t = ctx.currentTime;
  node.gain.cancelScheduledValues(t);
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.setValueAtTime(peak, t + attack + hold);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release;
}

function tone({ type = 'sine', from, to, peak, attack, hold, release, cutoff = 900, q = 1 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(from, t);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, t + attack + hold + release);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = q;

  const g = ctx.createGain();
  const end = env(g, peak, attack, hold, release);

  osc.connect(filter); filter.connect(g); bus(g);
  osc.start(t);
  osc.stop(end + 0.05);
}

function hiss({ peak, attack, hold, release, cutoff, q = 1, type = 'bandpass', sweepTo }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  const t = ctx.currentTime;
  filter.frequency.setValueAtTime(cutoff, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + hold + release);
  filter.Q.value = q;

  const g = ctx.createGain();
  const end = env(g, peak, attack, hold, release);

  src.connect(filter); filter.connect(g); bus(g);
  src.start(t);
  src.stop(end + 0.05);
}

const voices = {
  /* Subordinate to the click, not inaudible. Measured against silence the
     first pass came out at 0.0002 RMS — the bandpass takes most of the
     noise's energy, so the level has to be set after the filter, not before. */
  hover() {
    hiss({ peak: 0.22, attack: 0.004, hold: 0.006, release: 0.075, cutoff: 1500, q: 1.4 });
    tone({ from: 300, to: 210, peak: 0.1, attack: 0.004, hold: 0.006, release: 0.085, cutoff: 760 });
  },

  // a body hit: sub drop under a short filtered transient
  click() {
    tone({ from: 150, to: 44, peak: 0.42, attack: 0.003, hold: 0.012, release: 0.16, cutoff: 420, q: 3 });
    hiss({ peak: 0.1, attack: 0.002, hold: 0.006, release: 0.1, cutoff: 2600, sweepTo: 700, q: 0.9 });
  },

  // longer and lower: a room changing rather than a control responding
  section() {
    tone({ from: 38, to: 82, peak: 0.34, attack: 0.09, hold: 0.06, release: 0.5, cutoff: 260, q: 2.4 });
    hiss({ peak: 0.055, attack: 0.16, hold: 0.04, release: 0.44, cutoff: 260, sweepTo: 1500, q: 0.7 });
  },

  // the site arriving
  reveal() {
    tone({ from: 110, to: 34, peak: 0.5, attack: 0.006, hold: 0.03, release: 0.75, cutoff: 340, q: 2.2 });
    hiss({ peak: 0.09, attack: 0.02, hold: 0.05, release: 0.7, cutoff: 1800, sweepTo: 300, q: 0.8 });
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
