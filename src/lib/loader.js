import { gsap } from 'gsap';

/* Digits only: in a condensed display face the letters vary enough in width
   to make the mark jitter while it scrambles. */
const GLYPHS = '0123456789';
const rnd = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

const STATUS = [
  { at: 0, text: 'ESTABLECIENDO ENLACE' },
  { at: 32, text: 'TRIANGULANDO POSICION' },
  { at: 62, text: 'DECODIFICANDO SENAL' },
  { at: 92, text: 'ENLACE ESTABLE' },
];

/* Settles the text one character at a time, the rest cycling, so a line
   reads as being decoded rather than typed. */
function decodeInto(el, text, duration = 0.42) {
  if (el.dataset.target === text) return;
  el.dataset.target = text;
  const state = { p: 0 };
  gsap.killTweensOf(state);
  gsap.to(state, {
    p: 1,
    duration,
    ease: 'none',
    onUpdate: () => {
      const locked = Math.floor(text.length * state.p);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        out += i < locked || text[i] === ' ' ? text[i] : rnd();
      }
      el.textContent = out;
    },
    onComplete: () => { el.textContent = text; },
  });
}

export function runPreloader() {
  return new Promise((resolve) => {
    const pre = document.getElementById('preloader');
    if (!pre) { resolve(); return; }

    const bands = pre.querySelectorAll('.pre-bands i');
    const chars = [...pre.querySelectorAll('.pre-ch')];
    const bar = pre.querySelector('.pre-bar span');
    const pct = pre.querySelector('.pre-pct');
    const status = pre.querySelector('.pre-status');

    const finish = () => {
      pre.style.display = 'none';
      pre.setAttribute('aria-hidden', 'true');
      resolve();
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      chars.forEach((c) => { c.textContent = c.dataset.ch; });
      bar.style.width = '100%';
      pct.textContent = '100';
      gsap.to(pre, { opacity: 0, duration: 0.3, onComplete: finish });
      return;
    }

    // each character locks in at its own point in the load
    const lockAt = [42, 68, 90];

    const progress = { v: 0 };
    gsap.timeline({
      onComplete: () => {
        gsap.timeline({ onComplete: finish })
          .to('.pre-scan', { opacity: 0, duration: 0.2 })
          .to(chars, { scale: 1.06, duration: 0.18, ease: 'power2.out', stagger: 0.04 }, 0)
          .to('.pre-content, .pre-frame, .pre-coords', { opacity: 0, duration: 0.28, ease: 'power2.in' }, 0.14)
          // the backdrop peels away in strips rather than sliding off whole
          .to(bands, {
            scaleY: 0,
            duration: 0.62,
            ease: 'power4.inOut',
            stagger: { each: 0.038, from: 'center' },
          }, 0.24);
      },
    }).to(progress, {
      v: 100,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        const v = progress.v;
        const val = Math.round(v);

        bar.style.width = val + '%';
        pct.textContent = String(val).padStart(3, '0');

        chars.forEach((c, i) => {
          c.textContent = v >= lockAt[i] ? c.dataset.ch : rnd();
        });

        for (let i = STATUS.length - 1; i >= 0; i--) {
          if (v >= STATUS[i].at) { decodeInto(status, STATUS[i].text); break; }
        }
      },
    });
  });
}
