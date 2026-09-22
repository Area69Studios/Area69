import '@fontsource/anton/latin-400.css';
import '@fontsource/six-caps/latin-400.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { runPreloader } from './lib/loader.js';
import { initSmoothScroll } from './lib/lenis-scroll.js';
import { initHeroFluid } from './lib/hero-fluid.js';
import { initCounters } from './lib/counters.js';
import { initScrollProgress, initMagneticButtons, initCardGlow, initOutlineFill } from './lib/modern.js';
import { initSound, play } from './lib/sound.js';
import { initContactForm } from './lib/contact.js';

gsap.registerPlugin(ScrollTrigger);

function heroIntro() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.to('.eyebrow', { opacity: 1, y: 0, duration: 0.7 })
    .to('.reveal-word', { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'power4.out' }, '-=0.4')
    .to('.tagline', { opacity: 1, y: 0, duration: 0.8 }, '-=0.6')
    .to('.hero-cta', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
    .to('.scroll-cue', { opacity: 1, duration: 0.6 }, '-=0.4');
  gsap.set('.scroll-cue', { opacity: 0 });
}

function initNav() {
  const nav = document.querySelector('.nav');
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('mobileMenu');
  let lastY = window.scrollY;

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: () => {
      const y = window.scrollY;
      nav.classList.toggle('nav-scrolled', y > 40);
      if (y > lastY && y > 200) {
        nav.classList.add('nav-hidden');
      } else {
        nav.classList.remove('nav-hidden');
      }
      lastY = y;
    },
  });

  const menuLinks = menu.querySelectorAll('a');
  gsap.set(menuLinks, { opacity: 0, y: 24 });

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    toggle.classList.toggle('active', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) {
      gsap.to(menuLinks, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.06,
        delay: 0.15,
      });
    } else {
      gsap.set(menuLinks, { opacity: 0, y: 24 });
    }
  });

  menu.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );
}

function manifestoScrollytelling() {
  const section = document.getElementById('manifesto');
  const lines = gsap.utils.toArray('.line');
  if (!section || !lines.length) return;

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=140%',
    pin: true,
    scrub: 0.6,
    onUpdate: (self) => {
      const step = 1 / lines.length;
      const activeIndex = Math.min(lines.length - 1, Math.floor(self.progress / step));
      lines.forEach((line, i) => line.classList.toggle('is-active', i <= activeIndex));
    },
  });
}

function servicesReveal() {
  gsap.utils.toArray('.service-card').forEach((card, i) => {
    gsap.fromTo(
      card,
      { opacity: 0, y: 60 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        delay: (i % 3) * 0.08,
        scrollTrigger: {
          trigger: card,
          start: 'top 90%',
        },
      }
    );
  });
}

function workHorizontalScroll() {
  const section = document.getElementById('proyectos');
  const track = document.querySelector('.work-track');
  if (!section || !track) return;

  gsap.fromTo(
    section.querySelectorAll('.work-head > *'),
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: section, start: 'top 75%' },
    }
  );

  function getScrollDistance() {
    return Math.max(0, track.scrollWidth - window.innerWidth + 96);
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + getScrollDistance(),
    pin: true,
    scrub: 0.6,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      gsap.set(track, { x: -getScrollDistance() * self.progress });
    },
  });
}

function eventsReveal() {
  gsap.utils.toArray('.reveal-up').forEach((el) => {
    if (el.closest('#hero')) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      }
    );
  });
}

/* The row's "Detalles" opens in place. GSAP measures the height rather than
   a CSS max-height guess, so the copy can change length without the
   animation clipping it or leaving a gap. */
function initEventDetails() {
  document.querySelectorAll('.event-link[aria-controls]').forEach((btn) => {
    const note = document.getElementById(btn.getAttribute('aria-controls'));
    if (!note) return;

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));

      if (open) {
        gsap.to(note, {
          height: 0, opacity: 0, duration: 0.32, ease: 'power2.in',
          onComplete: () => { note.hidden = true; gsap.set(note, { clearProps: 'height,opacity' }); },
        });
      } else {
        note.hidden = false;
        gsap.fromTo(note,
          { height: 0, opacity: 0 },
          { height: 'auto', opacity: 1, duration: 0.42, ease: 'power3.out',
            onComplete: () => gsap.set(note, { clearProps: 'height' }) });
      }
    });
  });
}

async function boot() {
  // Start the loading screen but do not wait on it: everything below is
  // setup work the loading screen exists to cover. Booting the fluid used
  // to land 0.3s into the curtain lift, and compiling its shaders blocked
  // the main thread right as the panel was travelling — the curtain visibly
  // stalled and jumped. Done here it is behind a still panel, and the fluid
  // is already alive by the time it is uncovered.
  const loading = runPreloader();

  initSound();
  initSmoothScroll();
  initHeroFluid();
  initNav();
  manifestoScrollytelling();
  servicesReveal();
  workHorizontalScroll();
  initCounters();
  eventsReveal();
  initEventDetails();
  initContactForm();
  initScrollProgress();
  initMagneticButtons();
  initCardGlow();
  initOutlineFill();
  ScrollTrigger.refresh();

  await loading;
  play('reveal');
  heroIntro();
}

boot();
