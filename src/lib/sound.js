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

/* Redesigned a second time to move the whole palette down and away from
   treble: every oscillator dropped roughly an octave, every lowpass
   cutoff pulled in to shave off the upper harmonics that used to give
   these their glassy edge, and the noise attacks switched from highpass
   (all treble, by definition) to bandpass centred low -- a dull knock
   instead of a hiss. The earlier rules still hold: no filter Q above ~1,
   no oscillator sweeping more than a few dozen Hz, confirmatory sounds
   are a short two-note chime at a clean interval rather than one tone
   bending. */
const voices = {
  // barely there: a soft low tick, rounded rather than glassy
  hover() {
    hiss({ peak: 0.15, attack: 0.002, hold: 0.003, release: 0.05, cutoff: 1500, q: 0.8, type: 'bandpass' });
    tone({ type: 'triangle', from: 340, peak: 0.055, attack: 0.002, hold: 0.005, release: 0.06, cutoff: 650, q: 0.7 });
  },

  // a clean tap: a dull knock over a deep, unbent body
  click() {
    hiss({ peak: 0.17, attack: 0.001, hold: 0.004, release: 0.055, cutoff: 1900, q: 0.8, type: 'bandpass' });
    tone({ type: 'triangle', from: 130, peak: 0.32, attack: 0.002, hold: 0.012, release: 0.13, cutoff: 300, q: 0.9 });
  },

  // a soft two-note pad, a fifth apart and an octave down -- a room
  // settling, not a machine
  section() {
    tone({ type: 'sine', from: 147, peak: 0.17, attack: 0.13, hold: 0.05, release: 0.55, cutoff: 340, q: 0.8 });
    tone({ type: 'sine', from: 220, peak: 0.12, attack: 0.15, hold: 0.05, release: 0.6, cutoff: 480, q: 0.8, delay: 0.03 });
    hiss({ peak: 0.035, attack: 0.19, hold: 0.04, release: 0.42, cutoff: 850, q: 0.6, type: 'bandpass' });
  },

  // the site arriving: an ascending chime, G3 to D4, warm rather than
  // glassy at the top
  reveal() {
    tone({ type: 'sine', from: 196, peak: 0.26, attack: 0.012, hold: 0.06, release: 0.6, cutoff: 520, q: 0.8 });
    tone({ type: 'sine', from: 294, peak: 0.21, attack: 0.012, hold: 0.07, release: 0.7, cutoff: 650, q: 0.8, delay: 0.1 });
    hiss({ peak: 0.04, attack: 0.05, hold: 0.05, release: 0.6, cutoff: 1300, q: 0.6, type: 'bandpass' });
  },

  // a gate opening: a low, gentle rising swoosh, closing on an A3-E4
  // confirm chime -- the same shape as before, an octave lower throughout
  transition() {
    hiss({ peak: 0.08, attack: 0.09, hold: 0.04, release: 0.28, cutoff: 280, sweepTo: 700, q: 0.9, type: 'bandpass' });
    tone({ type: 'sine', from: 220, peak: 0.23, attack: 0.012, hold: 0.05, release: 0.24, cutoff: 600, q: 0.8, delay: 0.1 });
    tone({ type: 'sine', from: 330, peak: 0.2, attack: 0.012, hold: 0.06, release: 0.32, cutoff: 700, q: 0.8, delay: 0.17 });
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
