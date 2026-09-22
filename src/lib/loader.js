import { gsap } from 'gsap';

/* Long, weighted easings throughout. Every value here is one gesture seen
   from a different angle — the mark rising, the rule filling, the count
   climbing — so they share a single curve rather than each having its own. */
const RISE = 'expo.out';
const LIFT = 'expo.inOut';

export function runPreloader() {
  return new Promise((resolve) => {
    const pre = document.getElementById('preloader');
    if (!pre) { resolve(); return; }

    const word = pre.querySelector('.pre-word');
    const meta = pre.querySelector('.pre-meta');
    const rule = pre.querySelector('.pre-rule i');
    const count = pre.querySelector('.pre-count');

    const finish = () => {
      pre.style.display = 'none';
      pre.setAttribute('aria-hidden', 'true');
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(word, { y: '0%' });
      count.textContent = '100';
      gsap.to(pre, {
        opacity: 0,
        duration: 0.4,
        onComplete: () => { finish(); resolve(); },
      });
      return;
    }

    const progress = { v: 0 };

    gsap.timeline()
      .to(word, {
        y: '0%',
        letterSpacing: '0.02em',
        duration: 1.15,
        ease: RISE,
      })
      .to(meta, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.28)
      .to(progress, {
        v: 100,
        duration: 1.15,
        ease: 'power1.inOut',
        onUpdate: () => {
          const v = progress.v;
          count.textContent = String(Math.round(v)).padStart(3, '0');
          gsap.set(rule, { scaleX: v / 100 });
        },
      }, 0.3)

      // settle before the lift, so the curtain does not start mid-count
      .to(word, { y: '-18%', opacity: 0, duration: 0.55, ease: 'power3.in' }, '+=0.1')
      .to(meta, { opacity: 0, duration: 0.42, ease: 'power2.in' }, '<')

      /* The curtain leaves while the hero is already coming in underneath.
         Resolving partway through the lift is what removes the seam — wait
         for onComplete and the two animations run back to back instead. */
      .to(pre, {
        yPercent: -100,
        duration: 1.05,
        ease: LIFT,
        onStart: () => { gsap.delayedCall(0.36, resolve); },
        onComplete: finish,
      }, '-=0.4');
  });
}
