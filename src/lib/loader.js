import { gsap } from 'gsap';

/* The mark is the progress bar: red ink rises through the letterforms and
   the logo develops out of its own outline. The surface is a real wave, so
   it reads as liquid rather than as a bar with a straight top edge. */
const POINTS = 14;
const WAVE = 2.2;   // % of the mark's height
const SPEED = 3.4;  // radians per second

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

    const paint = () => {
      fill.style.clipPath = inkPath(state.v / 100, state.t);
      count.textContent = String(Math.round(state.v)).padStart(3, '0');
    };
    gsap.ticker.add(paint);

    gsap.timeline()
      .to(meta, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.15)
      // uneven on purpose: ink poured in surges, not at a constant rate
      .to(state, { v: 38, duration: 0.55, ease: 'power2.out' }, 0.1)
      .to(state, { v: 62, duration: 0.42, ease: 'power1.inOut' }, '+=0.08')
      .to(state, { v: 100, duration: 0.6, ease: 'power2.inOut' }, '+=0.06')

      // the filled mark swells, then rushes past the viewport
      .to(stage, { scale: 1.05, duration: 0.2, ease: 'power2.out' })
      .to(meta, { opacity: 0, duration: 0.3, ease: 'power2.in' }, '<')
      .to(stage, {
        scale: 7.5,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.in',
        onStart: () => { gsap.delayedCall(0.28, resolve); },
      })
      .to(pre, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
          gsap.ticker.remove(paint);
          waveTicker.kill();
          finish();
        },
      }, '-=0.55');
  });
}
