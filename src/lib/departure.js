import { gsap } from 'gsap';
import { play } from './sound.js';
import { markWatched } from './watched.js';

const ID_RE = /(?:youtu\.be\/|[?&]v=)([\w-]{11})/;

/* Everything in Proyectos producidos goes off-site, to YouTube. Leaving
   cold -- link click, new tab, gone -- is the normal web, but it also
   means the site never gets to say anything on the way out. This is the
   one beat where it does.

   Two things this animation is not allowed to fight:

   1. It cannot delay a NEW tab opening. A tab navigated by script after
      the click's own gesture has passed is exactly what Safari on iOS
      silently refuses -- an earlier version tried that (open blank,
      point it at the real URL once the animation finished) and the tab
      just sat on about:blank forever.
   2. It also cannot let navigation happen instantly and unintercepted,
      because then there is nothing left to watch -- the browser switches
      to the new tab the moment the click lands, before a single frame of
      the animation has painted. That was the next thing this went
      through, and it is what left the transition running on a tab
      nobody was still looking at.

   The way out of both at once: stay on THIS tab. Prevent the default
   navigation, run the animation here, and once it ends send the CURRENT
   tab to the video with location.href. A popup blocker only ever
   watches for new windows -- navigating the tab a script is already
   running in is not something any browser gates behind a fresh gesture,
   so this needs none of the tricks the other two approaches did. */
export function initDepartureTransition() {
  const overlay = document.getElementById('departure');
  if (!overlay) return;

  const title = overlay.querySelector('.dep-title');
  const els = overlay.querySelectorAll('.dep-eyebrow, .dep-line, .dep-title, .dep-dest');
  const setting = overlay.querySelectorAll('.dep-frame, .dep-mark');
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
        gsap.set(setting, { clearProps: 'opacity' });
        gsap.set(rule, { clearProps: 'transform' });
        resolve();
      };

      if (reduced) {
        gsap.set(overlay, { opacity: 1 });
        gsap.set([els, setting], { opacity: 1 });
        gsap.set(rule, { scaleX: 1 });
        gsap.delayedCall(0.5, finish);
        return;
      }

      // el visor y la marca se asientan primero, como si la pantalla se
      // enfocara; el texto llega encima de esa base, no a la vez
      gsap.timeline({ onComplete: finish })
        .set(overlay, { opacity: 1 })
        .to(setting, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0)
        .fromTo(els, { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.05 }, 0.15)
        .to(rule, { scaleX: 1, duration: 0.5, ease: 'power2.inOut' }, '-=0.15')
        .to({}, { duration: 0.3 }) // un instante de lectura antes de salir
        .to(overlay, { opacity: 0, duration: 0.35, ease: 'power2.in' });
    });
  }

  // la tarjeta entera es el enlace; ya no hay un boton separado dentro
  document.querySelectorAll('a.work-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      // cuenta como visto en cualquier forma de clic, incluida la que se
      // deja pasar tal cual mas abajo (Ctrl+clic, pestaña en segundo plano)
      const match = ID_RE.exec(card.href);
      if (match) markWatched(match[1]);

      // un modificador significa que el usuario ya esta pidiendo su propio
      // comportamiento (pestaña en segundo plano, ventana nueva...) -- eso
      // se respeta tal cual, sin interponer nada
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();

      const href = card.href;
      const cardTitle = card.querySelector('h3')?.textContent.trim() || 'AREA69';

      play('transition');
      run(cardTitle).then(() => { window.location.href = href; });
    });
  });
}
