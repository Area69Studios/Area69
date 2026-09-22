import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initCounters() {
  document.querySelectorAll('.stat-number').forEach((el) => {
    const target = Number(el.dataset.target || 0);
    const counter = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(counter, {
          v: target,
          duration: 1.8,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = String(Math.round(counter.v));
          },
        });
      },
    });
  });
}
