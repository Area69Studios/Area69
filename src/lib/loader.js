import { gsap } from 'gsap';

/* The mark is the progress bar: red ink rises through the letterforms and
   the logo develops out of its own outline. The surface is a real wave, so
   it reads as liquid rather than as a bar with a straight top edge. */
const POINTS = 18;
const WAVE = 2.2;   // % of the mark's height
const SPEED = 1.9;  // radians per second

function inkPath(level, t) {
  // level: 0 empty, 1 full. y is measured from the top in clip-path space.
  const base = 100 - level * 100;
  // flatten as it tops out, so the finished mark has a clean edge
  const amp = WAVE * Math.min(1, (1 - level) * 3.2);
  const pts = [];
  for (let i = 0; i <= POINTS; i++) {
    const x = (i / POINTS) * 100;
    const y = base + amp * Math.sin((i / POINTS) * Math.PI * 3 + t * SPEED);
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  pts.push('100% 100%', '0% 100%');
  return `polygon(${pts.join(',')})`;
}

export function runPreloader() {
  return new Promise((resolve) => {
    const pre = document.getElementById('preloader');
    if (!pre) { resolve(); return; }

    const stage = pre.querySelector('.pre-stage');
    const fill = pre.querySelector('.pre-fill');
    const meta = pre.querySelector('.pre-meta');
    const count = pre.querySelector('.pre-count');

    const finish = () => {
      pre.style.display = 'none';
      pre.setAttribute('aria-hidden', 'true');
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fill.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      count.textContent = '100';
      gsap.to(pre, { opacity: 0, duration: 0.4, onComplete: () => { finish(); resolve(); } });
      return;
    }

    const state = { v: 0, t: 0 };

    // the wave keeps moving even where the level pauses
    const waveTicker = gsap.to(state, { t: 100, duration: 100, ease: 'none' });

    /* Painting is a repaint of a 620px text layer, so it stops the moment
       the level tops out — nothing changes after that, and the exit needs
       every frame it can get for the transform. */
    let painting = true;
    const paint = () => {
      if (!painting) return;
      fill.style.clipPath = inkPath(state.v / 100, state.t);
      count.textContent = String(Math.round(state.v)).padStart(3, '0');
    };
    gsap.ticker.add(paint);

    gsap.timeline()
      .to(meta, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0.12)

      /* One unbroken rise. This used to climb in three surges with a beat
         between them, which did not read as pouring — it read as stalling. */
      .to(state, { v: 100, duration: 1.1, ease: 'power1.inOut' }, 0.12)

      .addLabel('out', '+=0.14')
      .to(meta, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 'out')

      /* power2.inOut, not expo.inOut. Over a 900px travel expo moves 93px in
         a single frame at its steepest — a tenth of the distance at once,
         which the eye reads as a cut rather than a move. This caps it at 30px.
         The mark trails the panel: two speeds are what give the exit depth. */
      .to(pre, {
        yPercent: -100,
        duration: 0.95,
        ease: 'power2.inOut',
        onStart: () => {
          painting = false;
          gsap.ticker.remove(paint);
          gsap.delayedCall(0.3, resolve);
        },
        onComplete: () => {
          waveTicker.kill();
          finish();
        },
      }, 'out')
      .to(stage, { yPercent: -42, duration: 0.95, ease: 'power2.inOut' }, 'out');
  });
}
