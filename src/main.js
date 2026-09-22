import '@fontsource/anton/latin-400.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { runPreloader } from './lib/loader.js';
import { initCursor } from './lib/cursor.js';
import { initSmoothScroll } from './lib/lenis-scroll.js';
import { initHeroScene } from './lib/three-hero.js';
import { initCounters } from './lib/counters.js';

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

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    toggle.classList.toggle('active', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
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

function releasesReveal() {
  gsap.utils.toArray('.release-card').forEach((card, i) => {
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

function rosterHorizontalScroll() {
  const section = document.getElementById('roster');
  const track = document.querySelector('.roster-track');
  if (!section || !track) return;

  gsap.fromTo(
    section.querySelectorAll('.roster-head > *'),
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

function initContactForm() {
  const form = document.getElementById('contactForm');
  const note = document.getElementById('formNote');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    note.textContent = 'Señal recibida. AREA69 te contactará pronto.';
    form.reset();
  });
}

async function boot() {
  await runPreloader();
  initCursor();
  initSmoothScroll();
  initHeroScene();
  initNav();
  heroIntro();
  manifestoScrollytelling();
  releasesReveal();
  rosterHorizontalScroll();
  initCounters();
  eventsReveal();
  initContactForm();

  ScrollTrigger.refresh();
}

boot();
