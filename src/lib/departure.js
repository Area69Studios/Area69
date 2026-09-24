import { gsap } from 'gsap';
import { play } from './sound.js';

/* Everything in Proyectos producidos goes off-site, to YouTube. Leaving
   cold -- link click, new tab, gone -- is the normal web, but it also
   means the site never gets to say anything on the way out. This is the
   one beat where it does. */
export function initDepartureTransition() {
  const overlay = document.getElementById('departure');
  if (!overlay) return;

  const title = overlay.querySelector('.dep-title');
  const els = overlay.querySelectorAll('.dep-eyebrow, .dep-line, .dep-title, .dep-dest');
  const rule = overlay.querySelector('.dep-rule i');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function run(projectTitle) {
    return new Promise((resolve) => {
      title.textContent = projectTitle;
      overlay.classList.add('is-active');

      const finish = () => {
        overlay.classList.remove('is-active');
        gsap.set(overlay, { clearProps: 'opacity' });
        gsap.set(els, { clearProps: 'opacity,transform' });
        gsap.set(rule, { clearProps: 'transform' });
        resolve();
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
    });
  }

  document.querySelectorAll('.work-card .work-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      // un modificador significa que el usuario ya esta pidiendo su propio
      // comportamiento (pestaña en segundo plano, ventana nueva...) -- eso
      // se respeta tal cual, sin interponer nada
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();

      const href = link.href;
      const cardTitle = link.closest('.work-card')?.querySelector('h3')?.textContent.trim() || 'AREA69';

      /* Abierta aqui, sincrona dentro del propio gesto de clic, la pestaña
         no cuenta como un popup no solicitado. Si se abriera despues, en el
         resolve() de la animacion, el navegador ya no tiene ese gesto que
         la respalde y puede bloquearla.

         Sin 'noopener' en las features -- eso hace que window.open()
         devuelva null, justo la referencia que hace falta para navegarla
         mas tarde. En su lugar se anula win.opener a mano: mismo efecto
         (la pestaña nueva no puede tocar esta) sin perder el control. */
      const win = window.open('', '_blank');
      if (win) win.opener = null;

      play('transition');
      run(cardTitle).then(() => {
        if (win) {
          try { win.location.href = href; return; } catch { /* sigue abajo */ }
        }
        window.open(href, '_blank', 'noopener');
      });
    });
  });
}
