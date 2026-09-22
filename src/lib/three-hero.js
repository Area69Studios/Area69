import * as THREE from 'three';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initHeroScene() {
  const canvas = document.getElementById('webgl-hero');
  if (!canvas) return;

  const container = canvas.parentElement;
  let width = container.clientWidth;
  let height = container.clientHeight;

  const FOG_COLOR = 0x0a0a0b;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 8, 34);

  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
  camera.position.set(0, 1.6, 7);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  // --- Desert floor: a grid of points receding to the horizon ---
  const cols = 72;
  const rows = 40;
  const spacingX = 0.55;
  const spacingZ = 0.62;
  const groundCount = cols * rows;

  const groundGeo = new THREE.BufferGeometry();
  const groundPos = new Float32Array(groundCount * 3);
  const groundColor = new Float32Array(groundCount * 3);
  const groundBase = new Float32Array(groundCount * 3);

  const red = new THREE.Color(0xe2261c);
  const dim = new THREE.Color(0x2a0f0d);

  let p = 0;
  for (let row = 0; row < rows; row++) {
    const z = -row * spacingZ + 1.5;
    const depthT = row / (rows - 1);
    for (let col = 0; col < cols; col++) {
      const x = (col - cols / 2) * spacingX;
      const ix = p * 3;
      groundPos[ix] = x;
      groundPos[ix + 1] = 0;
      groundPos[ix + 2] = z;
      groundBase[ix] = x;
      groundBase[ix + 1] = 0;
      groundBase[ix + 2] = z;

      const c = red.clone().lerp(dim, depthT);
      groundColor[ix] = c.r;
      groundColor[ix + 1] = c.g;
      groundColor[ix + 2] = c.b;
      p++;
    }
  }
  groundGeo.setAttribute('position', new THREE.BufferAttribute(groundPos, 3));
  groundGeo.setAttribute('color', new THREE.BufferAttribute(groundColor, 3));

  const groundMat = new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    fog: true,
  });
  const ground = new THREE.Points(groundGeo, groundMat);
  scene.add(ground);

  // --- Sky: sparse stars above the horizon ---
  const starCount = 500;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const ix = i * 3;
    starPos[ix] = (Math.random() - 0.5) * 46;
    starPos[ix + 1] = Math.random() * 11 + 0.4;
    starPos[ix + 2] = -Math.random() * 32 + 2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xf4f3ef,
    size: 0.028,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    fog: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- mouse parallax ---
  const mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // --- scroll-linked transition out of hero ---
  let scrollProgress = 0;
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      scrollProgress = self.progress;
    },
  });

  const clock = new THREE.Clock();
  let visible = true;

  function animate() {
    requestAnimationFrame(animate);
    if (!visible) return;

    const t = clock.getElapsedTime();
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const ix = i * 3;
      const bx = groundBase[ix];
      const bz = groundBase[ix + 2];
      const wave =
        Math.sin(bx * 0.35 + t * 0.6) * 0.1 + Math.sin(bz * 0.25 - t * 0.5) * 0.12;
      posAttr.setY(i, wave);
    }
    posAttr.needsUpdate = true;

    starMat.opacity = 0.45 + Math.sin(t * 0.4) * 0.08;

    camera.rotation.y = mouse.x * 0.06;
    camera.rotation.x = -0.08 + mouse.y * 0.04;
    camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.03;

    const heroFade = 1 - Math.min(scrollProgress * 1.6, 1);
    camera.position.z = 7 - scrollProgress * 4.5;
    groundMat.opacity = 0.85 * heroFade;
    starMat.opacity *= heroFade;

    renderer.render(scene, camera);
  }
  animate();

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
  });

  function onResize() {
    width = container.clientWidth;
    height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);
}
