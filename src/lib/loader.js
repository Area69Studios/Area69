import { gsap } from 'gsap';

export function runPreloader() {
  return new Promise((resolve) => {
    const pre = document.getElementById('preloader');
    const bar = pre.querySelector('.preloader-bar span');
    const pct = pre.querySelector('.preloader-pct');

    const progress = { v: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(pre, {
          yPercent: -100,
          duration: 0.9,
          ease: 'power4.inOut',
          onComplete: () => {
            pre.style.display = 'none';
            resolve();
          },
        });
      },
    });

    tl.to(progress, {
      v: 100,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => {
        const val = Math.round(progress.v);
        bar.style.width = val + '%';
        pct.textContent = val + '%';
      },
    });
  });
}
