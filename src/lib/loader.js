import { gsap } from 'gsap';

/* Everything here animates transform and opacity only. Nothing repaints per
   frame, which is what keeps the sequence smooth under load — the page's own
   setup runs behind this panel while it is still. */

export function runPreloader() {
  return new Promise((resolve) => {
    const pre = document.getElementById('preloader');
    if (!pre) { resolve(); return; }

    const stage = pre.querySelector('.pre-stage');
    const chars = pre.querySelectorAll('.pre-c');
    const rule = pre.querySelector('.pre-rule i');
    const meta = pre.querySelector('.pre-meta');
    const count = pre.querySelector('.pre-count');

    const finish = () => {
      pre.style.display = 'none';
      pre.setAttribute('aria-hidden', 'true');
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(chars, { y: '0%' });
      gsap.set(rule, { scaleX: 1 });
      gsap.set(meta, { opacity: 1 });
      count.textContent = '100';
      gsap.to(pre, { opacity: 0, duration: 0.4, onComplete: () => { finish(); resolve(); } });
      return;
    }

    const progress = { v: 0 };

    gsap.timeline()
      /* Each character clears its own mask, a beat apart. The stagger is what
         gives the entrance its shape; all three at once is just a slab. */
      .to(chars, {
        y: '0%',
        duration: 1.0,
        ease: 'expo.out',
        stagger: 0.085,
      })
      // a settle on the whole mark, slower than the characters, so it comes
      // to rest after them rather than with them
      .from(stage, { scale: 1.05, duration: 1.25, ease: 'power2.out' }, 0)
      .to(meta, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0.4)
      .to(progress, {
        v: 100,
        duration: 0.95,
        ease: 'power1.inOut',
        onUpdate: () => {
          count.textContent = String(Math.round(progress.v)).padStart(3, '0');
          gsap.set(rule, { scaleX: progress.v / 100 });
        },
      }, 0.35)

      .addLabel('out', '+=0.08')

      // the mark leaves the way it arrived, back through its own masks
      .to(chars, {
        y: '-115%',
        duration: 0.5,
        ease: 'power3.inOut',
        stagger: 0.055,
      }, 'out')
      .to(meta, { opacity: 0, duration: 0.32, ease: 'power2.in' }, 'out')
      .to(rule, { scaleY: 0, duration: 0.32, ease: 'power2.in' }, 'out+=0.1')

      /* power2.inOut, not expo.inOut: over a full-viewport travel expo moves
         a tenth of the distance in its steepest frame, which the eye reads as
         a cut. Resolving partway through hands the hero its intro while the
         panel is still moving, so there is no seam. */
      .to(pre, {
        yPercent: -100,
        duration: 0.9,
        ease: 'power2.inOut',
        onStart: () => { gsap.delayedCall(0.3, resolve); },
        onComplete: finish,
      }, 'out+=0.35');
  });
}
