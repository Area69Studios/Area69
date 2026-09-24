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
import { initDepartureTransition } from './lib/departure.js';

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
/* YouTube thumbnails fail in two different ways and only one of them is an
   error. maxresdefault 404s when the video was not uploaded in HD, which
   fires 'error'; but some sizes answer 200 with a 120x90 grey placeholder,
   which loads "successfully" and shows nothing. So this walks the sizes on
   either signal: a failed load, or one that arrives too small to be real. */
const YT_SIZES = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'];

/* Two different letterboxes end up on these cards, and they need different
   answers.

   The first is in the file's shape: YouTube's sddefault and hqdefault are
   4:3 files with the 16:9 frame sitting inside black bars. That one is pure
   arithmetic — the frame is centred, so how much to scale follows from the
   ratio alone, with nothing to read and nothing to fail.

   The second is inside the picture: a 16:9 file whose frame was itself shot
   wider. Only the pixels show that, and reading them needs the host's
   permission. Measured on the user's own screenshot the bar came to 11.9% of
   the card — which both cases produce, so the site does both: the arithmetic
   always, the pixels on top when they are readable. */

const FRAME = 16 / 9;

function applyCrop(img, scale, centre) {
  if (!(scale > 1.002)) { img.style.transform = ''; return; }
  /* Right to left: the shift happens in the image's own coordinates and is
     then scaled with it, which lands the kept band exactly on the card. */
  img.style.transform =
    `scale(${scale.toFixed(4)}) translateY(${(-(centre - 0.5) * 100).toFixed(2)}%)`;
}

// a file narrower than 16:9 is holding a 16:9 frame between centred bars
function cropByRatio(img) {
  const ratio = img.naturalWidth / img.naturalHeight;
  if (!ratio || ratio > FRAME - 0.02) return 1;
  const scale = FRAME / ratio;
  return scale > 3 ? 1 : scale;
}

/* A separate copy asked for with CORS, so reading it cannot taint the canvas
   the visible image is drawn on. The query string matters: without it the
   browser may hand back the copy it already cached for the plain request,
   which carries no CORS headers and fails the load. If the host refuses,
   onload never fires and the arithmetic crop is what stands. */
function cropByPixels(img, floor) {
  const probe = new Image();
  probe.crossOrigin = 'anonymous';
  probe.onload = () => {
    try {
      /* 320 wide, not 96: at 96 a 1280x720 frame resamples to 54 rows, so a
         bar 6.6 rows deep reads as 6 and a sliver of it survives the crop.
         At this size the same bar lands on a whole number of rows. */
      const w = 320;
      const h = Math.max(1, Math.round((probe.naturalHeight / probe.naturalWidth) * w));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(probe, 0, 0, w, h);
      const { data } = cx.getImageData(0, 0, w, h); // throws on a tainted canvas

      const rowIsBar = (y) => {
        let sum = 0;
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        return sum / w < 14; // near black the whole way across
      };

      let top = 0;
      while (top < h && rowIsBar(top)) top++;
      let bottom = h - 1;
      while (bottom > top && rowIsBar(bottom)) bottom--;
      if (top === 0 && bottom === h - 1) return;  // no bars
      if (bottom - top < h * 0.3) return;         // too little left to trust

      const t = top / h;
      const b = (bottom + 1) / h;
      const scale = 1 / (b - t);
      if (scale > 3) return;                      // implausible, leave it
      // never undo the crop the ratio already earned
      if (scale <= floor + 0.01) return;
      applyCrop(img, scale, (t + b) / 2);
    } catch {
      /* the host sent no CORS headers: nothing to do, and nothing broken */
    }
  };
  probe.src = `${img.src}${img.src.includes('?') ? '&' : '?'}x=cors`;
}

function initThumbFallbacks() {
  document.querySelectorAll('img[data-yt]').forEach((img) => {
    const next = () => {
      const step = Number(img.dataset.ytStep || 0) + 1;
      if (step >= YT_SIZES.length) return; // nothing left to try
      img.dataset.ytStep = String(step);
      img.src = `https://i.ytimg.com/vi/${img.dataset.yt}/${YT_SIZES[step]}.jpg`;
    };
    img.addEventListener('error', next);
    img.addEventListener('load', () => {
      if (img.naturalWidth <= 0) return;
      if (img.naturalWidth <= 120) { next(); return; }
      const byRatio = cropByRatio(img);
      applyCrop(img, byRatio, 0.5);
      cropByPixels(img, byRatio);
    });
  });
}

/* A silent preview that only starts once someone actually pauses on a
   card, not while scrolling past it. The id comes off the card's own
   href. Destroying the iframe on mouseleave (rather than pausing it) is
   what guarantees the audio and the network request actually stop.

   enablejsapi turns on the postMessage protocol the embed already
   speaks: send it {event:"listening"} once and it broadcasts its own
   currentTime/duration a few times a second on its own, no polling from
   here. That is what drives the red progress bar -- real position in
   the preview that is actually playing on the card, not a guess and not
   anything YouTube would have to be asked for over an API key this site
   does not have. It resets every loop and has nothing to do with
   whatever a visitor watched on YouTube itself last time; there is no
   way to reach that from here. */
function initVideoPreviews() {
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const HOVER_DELAY = 2500;
  const ID_RE = /(?:youtu\.be\/|[?&]v=)([\w-]{11})/;

  // contentWindow -> the <i> bar to drive, so an infoDelivery message can
  // find its card without searching the dom for it
  const players = new Map();

  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://www.youtube.com') return;
    const bar = players.get(e.source);
    if (!bar) return;
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    if (data.event !== 'infoDelivery' || !data.info) return;
    const { currentTime, duration } = data.info;
    if (!duration) return;
    bar.style.width = `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%`;
  });

  document.querySelectorAll('.work-card').forEach((card) => {
    const media = card.querySelector('.work-media');
    const progress = card.querySelector('.work-progress');
    const bar = progress?.querySelector('i');
    const match = ID_RE.exec(card.href);
    if (!match || !media) return;
    const id = match[1];

    let timer = null;
    let wrap = null;

    const stop = () => {
      clearTimeout(timer);
      timer = null;
      if (wrap) {
        const iframe = wrap.querySelector('iframe');
        if (iframe?.contentWindow) players.delete(iframe.contentWindow);
        wrap.remove();
        wrap = null;
      }
      progress?.classList.remove('is-active');
      if (bar) bar.style.width = '0%';
    };

    const start = () => {
      // the source is 16:9 and the card is 3:4; sized and centred like this
      // it covers the card the same way object-fit: cover crops the still
      const h = card.getBoundingClientRect().height;
      wrap = document.createElement('div');
      wrap.className = 'work-video';
      const iframe = document.createElement('iframe');
      const origin = encodeURIComponent(window.location.origin);
      iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&loop=1&playlist=${id}&rel=0&iv_load_policy=3&enablejsapi=1&origin=${origin}`;
      iframe.title = '';
      iframe.tabIndex = -1;
      iframe.setAttribute('allow', 'autoplay; encrypted-media');
      iframe.style.width = `${h * (16 / 9)}px`;
      iframe.style.height = `${h}px`;
      wrap.appendChild(iframe);
      media.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('is-active'));

      if (bar) {
        progress.classList.add('is-active');
        if (iframe.contentWindow) players.set(iframe.contentWindow, bar);
        // the embed's own message listener is not necessarily up yet the
        // instant it loads, so the handshake is repeated a few times
        // rather than sent once and hoped for
        let pings = 0;
        const ping = () => {
          if (!iframe.isConnected) return;
          iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id }), 'https://www.youtube.com');
          if (++pings < 6) setTimeout(ping, 400);
        };
        iframe.addEventListener('load', ping);
      }
    };

    card.addEventListener('mouseenter', () => { timer = setTimeout(start, HOVER_DELAY); });
    card.addEventListener('mouseleave', stop);
  });
}

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
  initThumbFallbacks();
  initVideoPreviews();
  initDepartureTransition();
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
