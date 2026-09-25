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
import { isWatched } from './lib/watched.js';
import { readViewPref, writeViewPref } from './lib/view-pref.js';

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

/* The section scrolls sideways, not down, so a pill nav for it cannot use
   the site's usual #anchor + lenis.scrollTo(element): that resolves to
   where a target sits in the vertical flow, and every group here sits at
   the same vertical spot -- the pin holds the whole section still while
   the track slides under it. What actually needs to change is how far
   into the pinned scroll range the page is, so a jump has to convert a
   group's horizontal offset into the matching page scrollY instead. */
function workHorizontalScroll(lenis) {
  const section = document.getElementById('proyectos');
  const track = document.querySelector('.work-track');
  const groups = gsap.utils.toArray('.work-group');
  const filters = gsap.utils.toArray('.work-filter');
  const viewButtons = gsap.utils.toArray('.work-view');
  const cards = gsap.utils.toArray('.work-card');
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

  function setActiveFilter(name) {
    filters.forEach((btn) => {
      const active = btn.dataset.jump === name;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  // The pills mean two different things depending on the view: in the
  // carousel there's nothing to hide, every card is already reachable by
  // scrolling, so a click jumps to it instead. In grid/compact all six
  // sit on screen together, so there a click actually filters -- and
  // clicking the same pill again clears back to showing all of them,
  // since there's no separate "todas" pill to do that job instead.
  function applyCategoryFilter(name) {
    cards.forEach((card) => {
      const inGroup = card.closest('.work-group')?.dataset.group === name;
      card.classList.toggle('is-filtered-out', !inGroup);
    });
    setActiveFilter(name);
  }

  // Only clears which cards are hidden -- NOT the active pill. Carousel
  // mode calls this too (switching view has to drop any filter grid/
  // compact left behind, or cards would stay hidden once back in the
  // track), but there the active pill means "currently scrolled to",
  // which has nothing to do with filtering and shouldn't be blanked out
  // just because a filter reset happened alongside it.
  function clearCategoryFilter() {
    cards.forEach((card) => card.classList.remove('is-filtered-out'));
  }

  let currentView = 'carousel';

  // With only six cards, the trailing groups are narrower than the track's
  // last screenful, so their own offset can land past the maximum the
  // track ever scrolls to -- there simply isn't enough content after them
  // to push them flush against the viewport's edge. That means two pills
  // (say cortos and largos) can resolve to the exact same maxed-out scroll
  // position, which geometry alone can't tell apart once there. While a
  // click is actively driving the scroll, the pill it set stands as-is
  // rather than being re-derived from geometry on every frame of that
  // scroll -- otherwise an intermediate frame near the same ceiling would
  // relabel it before the animation even finishes.
  let jumping = false;

  // Lenis's own tween has no cancel hook: a wheel or touch mid-jump
  // silently replaces it without ever firing the onComplete below, which
  // would otherwise leave "jumping" stuck true and the pills frozen on
  // whatever they last showed. Any real scroll gesture is a clearer signal
  // than that missing callback, so it hands control back here directly.
  window.addEventListener('wheel', () => { jumping = false; }, { passive: true });
  window.addEventListener('touchstart', () => { jumping = false; }, { passive: true });

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + getScrollDistance(),
    pin: true,
    scrub: 0.6,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const distance = getScrollDistance();
      gsap.set(track, { x: -distance * self.progress });
      if (jumping) return;

      if (self.progress >= 0.999) {
        // nothing left after the last group to push it flush against the
        // viewport's edge, so at full scroll it's what's on screen
        // regardless of where its own offset says it "should" land
        setActiveFilter(groups[groups.length - 1].dataset.group);
      } else {
        // otherwise, whichever group's left edge the track has scrolled
        // past most recently is the one actually under the viewport's
        // leading edge
        const x = distance * self.progress;
        let current = groups[0];
        for (const group of groups) {
          if (group.offsetLeft <= x + 40) current = group;
        }
        setActiveFilter(current.dataset.group);
      }
    },
  });

  // Shared by the pills and the keyboard nav below: both need the same
  // offset-to-scrollY conversion, just aimed at a different element.
  function jumpTo(offsetLeft, duration) {
    if (!lenis) return;
    jumping = true;
    const distance = getScrollDistance();
    const progress = distance > 0 ? Math.min(1, offsetLeft / distance) : 0;
    const y = trigger.start + progress * (trigger.end - trigger.start);
    lenis.scrollTo(y, { duration, onComplete: () => { jumping = false; } });
  }

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (currentView !== 'carousel') {
        // clicking the pill that's already filtering clears it, since
        // there's no separate "todas" pill to do that job
        if (btn.classList.contains('is-active')) {
          clearCategoryFilter();
          setActiveFilter(null);
        } else {
          applyCategoryFilter(btn.dataset.jump);
        }
        return;
      }
      const group = groups.find((g) => g.dataset.group === btn.dataset.jump);
      if (!group) return;
      setActiveFilter(btn.dataset.jump);
      jumpTo(group.offsetLeft, 1.2);
    });
  });

  // Arrow-key nav between cards, remote-control style. DOM order already
  // matches the visual left-to-right order across every group, since the
  // track is just those groups laid out one after another -- so this
  // needs no separate index of its own, only the flattened card list.

  // Which card counts as "current" when none is actually focused: the
  // last one the track has scrolled past, same rule the pill sync above
  // already uses for groups.
  function nearestCardIndex() {
    const distance = getScrollDistance();
    const x = distance * trigger.progress;
    let idx = 0;
    cards.forEach((card, i) => { if (card.offsetLeft <= x + 40) idx = i; });
    return idx;
  }

  // Is Proyectos the section actually filling the screen right now? A
  // plain geometry check rather than ScrollTrigger's own isActive flag,
  // which turned out to read false right at the very end of the pin's
  // range -- Lenis's momentum tends to leave the scroll a hair past
  // trigger.end after a real wheel gesture settles, and that alone was
  // enough to make isActive false while the section was still visibly
  // pinned full-screen. The pin holds it at height:100vh for the entire
  // range it's engaged, boundaries included, so this reads the same
  // thing more reliably.
  function proyectosIsPinned() {
    const rect = section.getBoundingClientRect();
    return rect.top <= 1 && rect.bottom >= window.innerHeight - 1;
  }

  // A first attempt scoped this to keydown on each card, which only ever
  // fires once that card holds real keyboard focus -- and the only way
  // there is Tab, since clicking a card navigates away immediately rather
  // than just focusing it. Almost nobody tabs all the way to Proyectos
  // before reaching for the arrow keys, so in practice it never fired.
  // This listens on the window instead, gated on the section actually
  // being pinned on screen -- arriving there by scroll or wheel is
  // enough on its own. A focused card (from Tab, or from a previous
  // arrow press) still gets exact card-to-card precision; without one,
  // the nearest card to the current scroll position stands in.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    // nothing to jump along in grid/compact -- there's no horizontal
    // track there, just a normal page the browser already scrolls
    if (currentView !== 'carousel') return;
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
    const focusedIndex = cards.indexOf(document.activeElement);
    if (focusedIndex === -1 && !proyectosIsPinned()) return;
    const currentIndex = focusedIndex !== -1 ? focusedIndex : nearestCardIndex();
    const target = cards[e.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1];
    if (!target) return;
    e.preventDefault();
    target.focus({ preventScroll: true });
    // jumpTo sets "jumping", which is also what tells onUpdate to leave
    // the pills alone -- so without this, arrow nav would land on a card
    // from a different group while the pill row kept showing whichever
    // one was active before
    const group = target.closest('.work-group');
    if (group) setActiveFilter(group.dataset.group);
    jumpTo(target.offsetLeft, 0.5);
  });

  // Switching view: carousel pins the section and lays the track out as
  // one long row; grid/compact are just a normal flowing page, so the
  // pin has to actually come off rather than sit there disabled-looking
  // -- ScrollTrigger's own enable/disable is what does that cleanly,
  // pin-spacer and all, without needing to rebuild the trigger each time.
  // refresh() afterward is for every OTHER scroll-triggered animation on
  // the page below this one: un-pinning changes the whole document's
  // height, so their trigger positions need recalculating too, not just
  // this one's.
  function applyView(view) {
    currentView = view;
    section.classList.remove('view-carousel', 'view-grid', 'view-compact');
    section.classList.add(`view-${view}`);
    viewButtons.forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (view === 'carousel') {
      trigger.enable();
      // the active pill here tracks scroll position, not a filter, and
      // the next onUpdate will resync it -- clearing it would just flash
      // every pill off until then, wiping out the correct state the
      // static markup (or the pin's own last position) already has
    } else {
      trigger.disable();
      setActiveFilter(null); // no category selected yet in grid/compact
      // the pin's onUpdate leaves an inline translateX on the track from
      // wherever the carousel last was -- gsap.set only ever writes that
      // property, disabling the trigger doesn't touch it, so grid/compact
      // inherited it too: every card shifted sideways by that same
      // amount and #proyectos's own overflow: hidden clipped off
      // whatever that shift pushed past the edge. Re-entering carousel
      // doesn't need this cleared itself -- the next onUpdate overwrites
      // it with a correct value the moment the pin re-engages.
      gsap.set(track, { clearProps: 'x' });
    }
    clearCategoryFilter();
    ScrollTrigger.refresh();
    writeViewPref(view);
  }

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === currentView) return;
      applyView(btn.dataset.view);
      // each view's height is completely different, so without this the
      // switch can leave the page stranded mid-scroll over content that
      // just moved out from under it. Lenis.scrollTo(element) resolves
      // its target as rect.top + its OWN tracked scroll position, not
      // the page's real one -- disabling the pin just now moved
      // everything below it without Lenis driving that change, so its
      // tracked value is stale at exactly this moment and the computed
      // target lands on whatever now sits at the wrong offset (often the
      // section after this one). Computing the target from the live,
      // always-current window.scrollY instead and handing Lenis that
      // plain number skips its own resolution step entirely.
      if (lenis) {
        // Lenis caches its own max-scroll limit and only recalculates it
        // on a (debounced) resize observer -- not synchronously the
        // instant enable()/disable() just changed the document's height
        // by re-pinning or un-pinning the section above. Landing here
        // right after the very first enable() this session (nothing had
        // forced a recalculation before that point) it can still be
        // holding yesterday's shorter limit, silently clamping the
        // target below down to wherever that stale limit sits -- often
        // 0, which reads as "jumped to the hero" even though the
        // requested target was correct.
        lenis.resize();
        const y = section.getBoundingClientRect().top + window.scrollY;
        lenis.scrollTo(y, { duration: 0.8 });
      }
    });
  });

  applyView(readViewPref());
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

/* The shimmer lives on .work-media's own background -- nothing extra in the
   DOM. While the <img> has nothing to paint the sweep shows straight
   through it; once the image loads, object-fit: cover already covers the
   whole card, so the animation underneath is simply never seen again. The
   one case that needs a real signal is total failure (every size in
   YT_SIZES exhausted): nothing will ever cover it, so left alone it would
   shimmer forever as if still loading. */
function settleShimmer(img, ok) {
  img.closest('.work-media')?.classList.add(ok ? 'is-loaded' : 'is-empty');
}

function initThumbFallbacks() {
  document.querySelectorAll('img[data-yt]').forEach((img) => {
    const next = () => {
      const step = Number(img.dataset.ytStep || 0) + 1;
      if (step >= YT_SIZES.length) { settleShimmer(img, false); return; } // nothing left to try
      img.dataset.ytStep = String(step);
      img.src = `https://i.ytimg.com/vi/${img.dataset.yt}/${YT_SIZES[step]}.jpg`;
    };
    img.addEventListener('error', next);
    img.addEventListener('load', () => {
      if (img.naturalWidth <= 0) return;
      if (img.naturalWidth <= 120) { next(); return; }
      settleShimmer(img, true);
      const byRatio = cropByRatio(img);
      applyCrop(img, byRatio, 0.5);
      cropByPixels(img, byRatio);
    });
  });

  // the local covers (JOHN JOHNSON 1-4) carry no data-yt and no retry
  // chain -- whatever the first settle says is the only one there is
  document.querySelectorAll('.work-media img:not([data-yt])').forEach((img) => {
    if (img.complete && img.naturalWidth > 0) { settleShimmer(img, true); return; }
    img.addEventListener('load', () => settleShimmer(img, true), { once: true });
    img.addEventListener('error', () => settleShimmer(img, false), { once: true });
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
const ID_RE = /(?:youtu\.be\/|[?&]v=)([\w-]{11})/;

function initVideoPreviews() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Data Saver is the visitor telling the browser to keep data usage down;
  // an autoplaying preview is exactly what that setting exists to prevent
  if (navigator.connection?.saveData) return;

  const hasHover = window.matchMedia('(hover: hover)').matches;
  const HOVER_DELAY = 1500;

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
    let muteBtn = null;

    const stop = () => {
      clearTimeout(timer);
      timer = null;
      if (wrap) {
        const iframe = wrap.querySelector('iframe');
        if (iframe?.contentWindow) players.delete(iframe.contentWindow);
        wrap.remove();
        wrap = null;
      }
      if (muteBtn) {
        muteBtn.remove();
        muteBtn = null;
      }
      progress?.classList.remove('is-active');
      // clears the live-playback override, not the width itself -- if the
      // card is marked watched, CSS is what puts the bar back to full
      if (bar) bar.style.width = '';
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

      // the preview autoplays muted -- browsers require that to autoplay
      // at all -- so this is what lets someone actually hear it without
      // leaving the card. It's a sibling of .work-media, not nested
      // inside it: .work-media is its own stacking context, so anything
      // inside it -- however high its own z-index -- still sits, as a
      // whole, below every other direct child of the card (.work-num
      // among them, which stretches to the card's full width under the
      // card's own flex layout and would otherwise catch the click first).
      // .work-video turns pointer-events off on itself so the cursor
      // stays "inside" the card while the preview plays; this button
      // opts back in, and both stopPropagation and preventDefault matter
      // on the click, since without them it would bubble to the card's
      // own link and navigate to YouTube instead of just toggling sound.
      muteBtn = document.createElement('button');
      muteBtn.type = 'button';
      muteBtn.className = 'work-mute is-off';
      muteBtn.tabIndex = -1;
      muteBtn.setAttribute('aria-pressed', 'false');
      muteBtn.setAttribute('aria-label', 'Activar sonido de la vista previa');
      // muted (the default, since that's the only way the preview is ever
      // allowed to autoplay) shows a plain muted-speaker glyph; unmuted
      // swaps it for the level-meter bars, animating to show sound is
      // actually coming out of it. CSS switches between the two off the
      // same is-off class the click handler below already toggles.
      muteBtn.innerHTML =
        '<svg class="work-mute-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4 9.91 6.09 12 8.18V4zm4.5 8c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71z"/>' +
        '</svg>' +
        '<span class="work-mute-bars"><i></i><i></i><i></i><i></i></span>';
      let muted = true;
      muteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        muted = !muted;
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: [] }),
          'https://www.youtube.com'
        );
        muteBtn.classList.toggle('is-off', muted);
        muteBtn.setAttribute('aria-pressed', String(!muted));
        muteBtn.setAttribute('aria-label', muted ? 'Activar sonido de la vista previa' : 'Silenciar la vista previa');
      });
      card.appendChild(muteBtn);
      requestAnimationFrame(() => muteBtn.classList.add('is-active'));

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

    if (hasHover) {
      card.addEventListener('mouseenter', () => { timer = setTimeout(start, HOVER_DELAY); });
      card.addEventListener('mouseleave', stop);
      return;
    }

    /* No hover to hang this off, so the touch equivalent is a hold: press
       and keep still for the same 1.5s and the preview takes over: lift
       before then and the tap goes through as a tap. The card's own click
       handler (in departure.js) is what would normally fire on lift, so
       once the hold has actually triggered a preview, that lift's default
       is prevented -- otherwise the preview would appear and the page
       would navigate away in the same breath, one right after the other. */
    // some browsers (Android Chrome among them) raise this for a held
    // link regardless of -webkit-touch-callout, which is Safari-only
    card.addEventListener('contextmenu', (e) => e.preventDefault());

    let longPressed = false;
    let startX = 0;
    let startY = 0;

    card.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      longPressed = false;
      timer = setTimeout(() => { longPressed = true; start(); }, HOVER_DELAY);
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (Math.hypot(t.clientX - startX, t.clientY - startY) < 10) return;
      clearTimeout(timer);
      if (longPressed) { stop(); longPressed = false; }
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
      clearTimeout(timer);
      if (!longPressed) return; // a plain tap: let the click through as normal
      e.preventDefault();
      stop();
      longPressed = false;
    });

    card.addEventListener('touchcancel', () => {
      clearTimeout(timer);
      if (longPressed) { stop(); longPressed = false; }
    });
  });
}

/* A static "already opened this" mark, independent of the preview above --
   it is not motion and it costs no data, so it runs regardless of
   reduced-motion or Data Saver. CSS does the actual fill (.is-watched i);
   this only ever adds the class. */
// the YouTube mark is what a card shows by default -- once it's been
// opened, the corner badge swaps to a plain check, in the same red it
// already goes on hover, and stays that way regardless of hover state
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

function initWatchedBars() {
  document.querySelectorAll('.work-card').forEach((card) => {
    const match = ID_RE.exec(card.href);
    if (!match || !isWatched(match[1])) return;
    card.querySelector('.work-progress')?.classList.add('is-watched');
    const badge = card.querySelector('.work-yt');
    if (badge) {
      badge.classList.add('is-watched');
      badge.innerHTML = CHECK_ICON;
    }
  });
}

/* The JOHN JOHNSON cards are chapters of one story, not four unrelated
   uploads -- data-chapter is what says so, since parsing it back out of
   "Capítulo N" text would tie this to copy that's free to change. Only
   ever flags ONE card: the earliest chapter nobody's opened yet, and
   only once at least one earlier one has been -- a visitor who hasn't
   started the saga gets no nudge, and one who's caught up gets none
   either, since there's nothing left to point them toward. */
function initNextChapterCue() {
  const chapters = [...document.querySelectorAll('.work-card[data-chapter]')]
    .sort((a, b) => Number(a.dataset.chapter) - Number(b.dataset.chapter))
    .map((card) => ({ card, id: ID_RE.exec(card.href)?.[1] }))
    .filter((c) => c.id);

  const anyWatched = chapters.some((c) => isWatched(c.id));
  const next = anyWatched && chapters.find((c) => !isWatched(c.id));
  if (!next) return;

  const tag = document.createElement('span');
  tag.className = 'work-next';
  tag.textContent = 'Sigue la historia';
  next.card.querySelector('.work-info')?.prepend(tag);
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
  const lenis = initSmoothScroll();
  initHeroFluid();
  initNav();
  manifestoScrollytelling();
  servicesReveal();
  workHorizontalScroll(lenis);
  initCounters();
  eventsReveal();
  initThumbFallbacks();
  initVideoPreviews();
  initWatchedBars();
  initNextChapterCue();
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
