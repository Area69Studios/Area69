import * as THREE from 'three';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initHeroScene() {
  const canvas = document.getElementById('webgl-hero');
  if (!canvas) return;

  const container = canvas.parentElement;
  let width = container.clientWidth;
  let height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 7);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  const group = new THREE.Group();
  scene.add(group);

  // --- Core signal orb: organic, displaced icosahedron point cloud ---
  const geo = new THREE.IcosahedronGeometry(1.7, 4);
  const basePositions = geo.attributes.position.array.slice();

  const pointsMat = new THREE.PointsMaterial({
    color: 0xe2261c,
    size: 0.024,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const orbPoints = new THREE.Points(geo, pointsMat);
  group.add(orbPoints);

  // static containment cage for structure
  const wireGeo = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.9, 1));
  const wireMat = new THREE.LineBasicMaterial({ color: 0x6a1a16, transparent: true, opacity: 0.3 });
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  group.add(wireframe);

  // --- Ambient particle field ---
  const fieldCount = 800;
  const fieldGeo = new THREE.BufferGeometry();
  const fieldPos = new Float32Array(fieldCount * 3);
  for (let i = 0; i < fieldCount; i++) {
    const r = 5 + Math.random() * 9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    fieldPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    fieldPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    fieldPos[i * 3 + 2] = r * Math.cos(phi);
  }
  fieldGeo.setAttribute('position', new THREE.BufferAttribute(fieldPos, 3));
  const fieldMat = new THREE.PointsMaterial({
    color: 0xf4f3ef,
    size: 0.015,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const field = new THREE.Points(fieldGeo, fieldMat);
  scene.add(field);

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
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const ix = i * 3;
      const bx = basePositions[ix];
      const by = basePositions[ix + 1];
      const bz = basePositions[ix + 2];
      const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
      const nx = bx / len;
      const ny = by / len;
      const nz = bz / len;
      const noise =
        Math.sin(bx * 1.6 + t * 0.9) +
        Math.sin(by * 1.6 + t * 1.15) +
        Math.sin(bz * 1.6 + t * 0.7);
      const displaced = len + noise * 0.09;
      posAttr.setXYZ(i, nx * displaced, ny * displaced, nz * displaced);
    }
    posAttr.needsUpdate = true;

    group.rotation.y = t * 0.12 + scrollProgress * 1.4;
    group.rotation.x = Math.sin(t * 0.2) * 0.08 + mouse.y * 0.25;
    group.rotation.z += (mouse.x * 0.15 - group.rotation.z) * 0.03;

    field.rotation.y = t * 0.015;

    camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.04;
    camera.position.y += (-mouse.y * 0.3 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    const heroFade = 1 - Math.min(scrollProgress * 1.6, 1);
    group.scale.setScalar(1 + scrollProgress * 0.6);
    pointsMat.opacity = 0.9 * heroFade + 0.05;
    wireMat.opacity = 0.3 * heroFade;
    fieldMat.opacity = 0.35 * heroFade;

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
