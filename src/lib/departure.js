import { gsap } from 'gsap';
import { play } from './sound.js';

/* Everything in Proyectos producidos goes off-site, to YouTube. Leaving
   cold -- link click, new tab, gone -- is the normal web, but it also
   means the site never gets to say anything on the way out. This is the
   one beat where it does.

   It never touches the navigation itself. An earlier version opened a
   blank tab on click and pointed it at the real URL once this animation
   finished, to line the two up -- but a tab navigated outside the
   original click's gesture is exactly what Safari on iOS silently
   refuses: the tab opened, sat on about:blank, and never went anywhere.
   The <a target="_blank"> already does this instantly and reliably on
   every browser; this is only ever a decoration running alongside it. */
export function initDepartureTransition() {
  const overlay = document.getElementById('departure');
  if (!overlay) return;

  const title = overlay.querySelector('.dep-title');
  const els = overlay.querySelectorAll('.dep-eyebrow, .dep-line, .dep-title, .dep-dest');
  const rule = overlay.querySelector('.dep-rule i');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function run(projectTitle) {
    title.textContent = projectTitle;
    overlay.classList.add('is-active');

    const finish = () => {
      overlay.classList.remove('is-active');
      gsap.set(overlay, { clearProps: 'opacity' });
      gsap.set(els, { clearProps: 'opacity,transform' });
      gsap.set(rule, { clearProps: 'transform' });
    };

    if (reduced) {
      gsap.set(overlay, { opacity: 1 });
      gsap.set(els, { opacity: 1 });
      gsap.set(rule, { scaleX: 1 });
      gsap.delayedCall(0.5, finish);
      return;
    }

    gsap.timeline({ onComplete: finish })
      .set(overlay, { opacity: 1 })
      .fromTo(els, { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.05 })
      .to(rule, { scaleX: 1, duration: 0.5, ease: 'power2.inOut' }, '-=0.15')
      .to({}, { duration: 0.2 }) // un instante de lectura antes de salir
      .to(overlay, { opacity: 0, duration: 0.3, ease: 'power2.in' });
  }

  document.querySelectorAll('.work-card .work-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      // un modificador significa que el usuario ya esta pidiendo su propio
      // comportamiento (pestaña en segundo plano, ventana nueva...) -- eso
      // se respeta tal cual, sin interponer nada
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const cardTitle = link.closest('.work-card')?.querySelector('h3')?.textContent.trim() || 'AREA69';
      play('transition');
      run(cardTitle);
      // sin preventDefault: el propio <a> navega ya, tal cual siempre hizo
    });
  });
}
