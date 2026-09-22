import * as THREE from 'three';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* Real-time fluid simulation (semi-Lagrangian advection + Jacobi pressure
   solve + vorticity confinement) rendered as red ink over black. The sim
   runs on small fixed-size buffers, so cost is independent of screen size. */

const BASE_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const ADVECT_FRAG = `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
varying vec2 vUv;
void main() {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = dissipation * texture2D(uSource, coord);
  gl_FragColor.a = 1.0;
}`;

const DIVERGENCE_FRAG = `
uniform sampler2D uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
  float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
  float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).y;
  float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL_FRAG = `
uniform sampler2D uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).y;
  float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).y;
  float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).x;
  float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORTICITY_FRAG = `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform float curl;
uniform float dt;
varying vec2 vUv;
void main() {
  float L = texture2D(uCurl, vUv - vec2(texelSize.x, 0.0)).x;
  float R = texture2D(uCurl, vUv + vec2(texelSize.x, 0.0)).x;
  float T = texture2D(uCurl, vUv + vec2(0.0, texelSize.y)).x;
  float B = texture2D(uCurl, vUv - vec2(0.0, texelSize.y)).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
  gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`;

const PRESSURE_FRAG = `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_FRAG = `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
  vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B) * 0.5;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`;

const CLEAR_FRAG = `
uniform sampler2D uTexture;
uniform float value;
varying vec2 vUv;
void main() {
  gl_FragColor = value * texture2D(uTexture, vUv);
}`;

const SPLAT_FRAG = `
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
varying vec2 vUv;
void main() {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
}`;

const DISPLAY_FRAG = `
uniform sampler2D uTexture;
varying vec2 vUv;
void main() {
  vec3 ink = texture2D(uTexture, vUv).rgb;
  float d = distance(vUv, vec2(0.5, 0.6));
  vec3 bg = mix(vec3(0.086, 0.035, 0.039), vec3(0.039, 0.039, 0.043), smoothstep(0.0, 0.72, d));
  // lift the brightest ink towards white so dense plumes read as hot
  vec3 col = bg + ink + pow(max(ink - 0.55, 0.0), vec3(1.6)) * 1.4;
  gl_FragColor = vec4(col, 1.0);
}`;

export function initHeroFluid() {
  const canvas = document.getElementById('webgl-hero');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  } catch {
    return; // no WebGL: the section's CSS background stands on its own
  }

  const container = canvas.parentElement;
  const small = window.innerWidth < 800;
  const SIM_RES = small ? 96 : 128;
  const DYE_RES = small ? 256 : 512;
  // the pressure solve is most of the per-step cost; a gentle ambient
  // flow does not need a tightly converged projection
  const PRESSURE_ITERATIONS = small ? 8 : 12;

  const DENSITY_DISSIPATION = 0.993;
  const VELOCITY_DISSIPATION = 0.988;
  const PRESSURE_DECAY = 0.8;
  const CURL_STRENGTH = 32;
  const SPLAT_RADIUS = 0.0022;

  // the dye buffer is only 512px, so drawing it at 1x costs far less on
  // a high-DPI screen and looks identical once it is this soft
  renderer.setPixelRatio(1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.autoClear = true;

  const simTexel = new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES);

  function createFBO(size) {
    return new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  function createDoubleFBO(size) {
    let read = createFBO(size);
    let write = createFBO(size);
    return {
      get read() { return read; },
      get write() { return write; },
      swap() { const tmp = read; read = write; write = tmp; },
    };
  }

  const velocity = createDoubleFBO(SIM_RES);
  const dye = createDoubleFBO(DYE_RES);
  const pressure = createDoubleFBO(SIM_RES);
  const divergence = createFBO(SIM_RES);
  const curl = createFBO(SIM_RES);

  const mat = (frag, uniforms) =>
    new THREE.ShaderMaterial({ vertexShader: BASE_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

  const advectMat = mat(ADVECT_FRAG, {
    uVelocity: { value: null }, uSource: { value: null },
    texelSize: { value: simTexel }, dt: { value: 0.016 }, dissipation: { value: 1 },
  });
  const divergenceMat = mat(DIVERGENCE_FRAG, { uVelocity: { value: null }, texelSize: { value: simTexel } });
  const curlMat = mat(CURL_FRAG, { uVelocity: { value: null }, texelSize: { value: simTexel } });
  const vorticityMat = mat(VORTICITY_FRAG, {
    uVelocity: { value: null }, uCurl: { value: null },
    texelSize: { value: simTexel }, curl: { value: CURL_STRENGTH }, dt: { value: 0.016 },
  });
  const pressureMat = mat(PRESSURE_FRAG, { uPressure: { value: null }, uDivergence: { value: null }, texelSize: { value: simTexel } });
  const gradientMat = mat(GRADIENT_FRAG, { uPressure: { value: null }, uVelocity: { value: null }, texelSize: { value: simTexel } });
  const clearMat = mat(CLEAR_FRAG, { uTexture: { value: null }, value: { value: PRESSURE_DECAY } });
  const splatMat = mat(SPLAT_FRAG, {
    uTarget: { value: null }, aspectRatio: { value: 1 },
    color: { value: new THREE.Vector3() }, point: { value: new THREE.Vector2() }, radius: { value: SPLAT_RADIUS },
  });
  const displayMat = mat(DISPLAY_FRAG, { uTexture: { value: null } });

  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), displayMat);
  quadScene.add(quad);

  function blit(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target || null);
    renderer.render(quadScene, quadCamera);
  }

  function aspect() {
    return container.clientWidth / Math.max(container.clientHeight, 1);
  }

  function splat(x, y, dx, dy, r, g, b) {
    splatMat.uniforms.aspectRatio.value = aspect();
    splatMat.uniforms.point.value.set(x, y);
    splatMat.uniforms.radius.value = SPLAT_RADIUS;

    splatMat.uniforms.uTarget.value = velocity.read.texture;
    splatMat.uniforms.color.value.set(dx, dy, 0);
    blit(splatMat, velocity.write);
    velocity.swap();

    splatMat.uniforms.uTarget.value = dye.read.texture;
    splatMat.uniforms.color.value.set(r, g, b);
    blit(splatMat, dye.write);
    dye.swap();
  }

  // brand red with a little variation, plus the occasional hot white core
  function inkColor() {
    const hot = Math.random() < 0.18;
    if (hot) return [0.55, 0.32, 0.28];
    const v = 0.35 + Math.random() * 0.4;
    return [v, v * (0.06 + Math.random() * 0.06), v * 0.05];
  }

  /* A drifting source keeps feeding the fluid so the hero is alive before
     anyone touches it. Ink decays fast, so a periodic burst would leave the
     canvas empty between bursts — this traces a slow open path instead,
     laying down a trail that the vorticity curls into plumes. */
  const auto = { t: Math.random() * 60, x: 0.5, y: 0.5, started: false };
  function autoFeed(dt) {
    auto.t += dt;
    const t = auto.t;
    const x = 0.5 + 0.36 * Math.sin(t * 0.23) * Math.cos(t * 0.11);
    const y = 0.5 + 0.32 * Math.sin(t * 0.19 + 1.3);
    if (auto.started) {
      const gain = Math.min(dt * 60, 2);
      const [r, g, b] = inkColor();
      splat(x, y, (x - auto.x) * 5200, (y - auto.y) * 5200, r * 0.5 * gain, g * 0.5 * gain, b * 0.5 * gain);
    }
    auto.x = x;
    auto.y = y;
    auto.started = true;
  }

  function openingBurst() {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      const rad = 0.14 + Math.random() * 0.16;
      const x = 0.5 + Math.cos(a) * rad;
      const y = 0.55 + Math.sin(a) * rad;
      const [r, g, b] = inkColor();
      splat(x, y, Math.cos(a) * 1800, Math.sin(a) * 1800, r * 1.6, g * 1.6, b * 1.6);
    }
  }


  // --- scroll fade, same transition out of the hero as before ---
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      canvas.style.opacity = String(1 - Math.min(self.progress * 1.5, 1));
    },
  });

  /* Pause the sim while the hero is off screen. This deliberately does not
     use the trigger above: its range starts at 'top top', and ScrollTrigger
     reports isActive false exactly at that boundary — i.e. at the very top
     of the page — which froze the fluid whenever you scrolled back up. */
  let inView = true;
  const heroSection = document.getElementById('hero');
  if (heroSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => { inView = entry.isIntersecting; },
      { threshold: 0 }
    ).observe(heroSection);
  }

  function step(dt) {
    advectMat.uniforms.texelSize.value = simTexel;

    curlMat.uniforms.uVelocity.value = velocity.read.texture;
    blit(curlMat, curl);

    vorticityMat.uniforms.uVelocity.value = velocity.read.texture;
    vorticityMat.uniforms.uCurl.value = curl.texture;
    vorticityMat.uniforms.dt.value = dt;
    blit(vorticityMat, velocity.write);
    velocity.swap();

    divergenceMat.uniforms.uVelocity.value = velocity.read.texture;
    blit(divergenceMat, divergence);

    clearMat.uniforms.uTexture.value = pressure.read.texture;
    blit(clearMat, pressure.write);
    pressure.swap();

    pressureMat.uniforms.uDivergence.value = divergence.texture;
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      pressureMat.uniforms.uPressure.value = pressure.read.texture;
      blit(pressureMat, pressure.write);
      pressure.swap();
    }

    gradientMat.uniforms.uPressure.value = pressure.read.texture;
    gradientMat.uniforms.uVelocity.value = velocity.read.texture;
    blit(gradientMat, velocity.write);
    velocity.swap();

    // dissipation is per-frame, so raise it to the frame's share of a 60Hz
    // step — otherwise the ink fades twice as fast on a 120Hz display
    const decay = dt * 60;

    advectMat.uniforms.dt.value = dt;
    advectMat.uniforms.uVelocity.value = velocity.read.texture;
    advectMat.uniforms.uSource.value = velocity.read.texture;
    advectMat.uniforms.dissipation.value = Math.pow(VELOCITY_DISSIPATION, decay);
    blit(advectMat, velocity.write);
    velocity.swap();

    advectMat.uniforms.uVelocity.value = velocity.read.texture;
    advectMat.uniforms.uSource.value = dye.read.texture;
    advectMat.uniforms.dissipation.value = Math.pow(DENSITY_DISSIPATION, decay);
    blit(advectMat, dye.write);
    dye.swap();
  }

  let visible = true;
  const clock = new THREE.Clock();
  openingBurst();

  /* Purely ambient, so the sim runs at 30Hz rather than every frame. Ink
     laid down and decay are both scaled by dt, so the motion reads the same
     as at 60Hz — it just costs half as much. */
  const SIM_INTERVAL = 1 / 30;
  let accumulator = 0;

  function frame() {
    requestAnimationFrame(frame);
    const elapsed = clock.getDelta();
    if (!visible || !inView) return;

    accumulator += Math.min(elapsed, 0.1);
    if (accumulator < SIM_INTERVAL) return;
    const dt = Math.min(accumulator, 0.05);
    accumulator = 0;

    autoFeed(dt);
    step(dt);

    displayMat.uniforms.uTexture.value = dye.read.texture;
    blit(displayMat, null);
  }
  frame();

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    clock.getDelta();
  });

  window.addEventListener('resize', () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}
