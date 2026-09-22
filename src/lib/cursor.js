export function initCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor || window.matchMedia('(hover: none)').matches) return;

  const dot = cursor.querySelector('.cursor-dot');
  const ring = cursor.querySelector('.cursor-ring');

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
  });

  function tick() {
    ringX += (mouseX - ringX) * 0.16;
    ringY += (mouseY - ringY) * 0.16;
    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
    requestAnimationFrame(tick);
  }
  tick();

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('[data-cursor="link"], a, button')) {
      cursor.classList.add('hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-cursor="link"], a, button')) {
      cursor.classList.remove('hover');
    }
  });

  document.addEventListener('mousedown', () => cursor.classList.add('down'));
  document.addEventListener('mouseup', () => cursor.classList.remove('down'));
}
