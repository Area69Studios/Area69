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

  // Saturate smoothly instead of clipping: wherever ink piled up it used to
  // blow out to a flat white core with a hard edge.
  vec3 shaped = vec3(1.0) - exp(-ink * 1.5);
  float lum = max(max(shaped.r, shaped.g), shaped.b);
  vec3 col = bg + shaped + vec3(pow(lum, 6.0)) * 0.18;

  // the near-black radial banded visibly in 8-bit
  float n = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * (1.6 / 255.0);
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
  const SIM_SHORT = small ? 96 : 112;
  const DYE_SHORT = small ? 288 : 400;
  // the pressure solve is most of the per-step cost; a gentle ambient
  // flow does not need a tightly converged projection
  const PRESSURE_ITERATIONS = small ? 12 : 16;

  const DENSITY_DISSIPATION = 0.993;
  const VELOCITY_DISSIPATION = 0.988;
  const PRESSURE_DECAY = 0.8;
  // high vorticity amplifies grid-scale noise, which showed up as a cellular
  // speckle rather than smoke; ambient drift does not need much of it
  const CURL_STRENGTH = 16;

  // the dye buffer is small, so drawing it at 1x costs far less on a
  // high-DPI screen and looks identical once it is this soft
  renderer.setPixelRatio(1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.autoClear = true;

  function aspect() {
    return Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
  }

  function createFBO(w, h) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  function createDoubleFBO(w, h) {
    let read = createFBO(w, h);
    let write = createFBO(w, h);
    return {
      get read() { return read; },
      get write() { return write; },
      swap() { const tmp = read; read = write; write = tmp; },
      dispose() { read.dispose(); write.dispose(); },
    };
  }

  /* The grid has to match the canvas proportions. On a square grid stretched
     across a wide canvas, one unit of velocity moves the fluid further
     horizontally than vertically, which smeared every plume sideways. */
  function buildSim() {
    const ar = aspect();
    const dims = (short) => (ar >= 1
      ? { w: Math.round(short * ar), h: short }
      : { w: short, h: Math.round(short / ar) });
    const s = dims(SIM_SHORT);
    const d = dims(DYE_SHORT);
    return {
      ar,
      velocity: createDoubleFBO(s.w, s.h),
      dye: createDoubleFBO(d.w, d.h),
      pressure: createDoubleFBO(s.w, s.h),
      divergence: createFBO(s.w, s.h),
      curl: createFBO(s.w, s.h),
      texel: new THREE.Vector2(1 / s.w, 1 / s.h),
    };
  }

  let sim = buildSim();

  const mat = (frag, uniforms) =>
    new THREE.ShaderMaterial({ vertexShader: BASE_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

  const advectMat = mat(ADVECT_FRAG, {
    uVelocity: { value: null }, uSource: { value: null },
    texelSize: { value: sim.texel }, dt: { value: 0.016 }, dissipation: { value: 1 },
  });
  const divergenceMat = mat(DIVERGENCE_FRAG, { uVelocity: { value: null }, texelSize: { value: sim.texel } });
  const curlMat = mat(CURL_FRAG, { uVelocity: { value: null }, texelSize: { value: sim.texel } });
  const vorticityMat = mat(VORTICITY_FRAG, {
    uVelocity: { value: null }, uCurl: { value: null },
    texelSize: { value: sim.texel }, curl: { value: CURL_STRENGTH }, dt: { value: 0.016 },
  });
  const pressureMat = mat(PRESSURE_FRAG, { uPressure: { value: null }, uDivergence: { value: null }, texelSize: { value: sim.texel } });
  const gradientMat = mat(GRADIENT_FRAG, { uPressure: { value: null }, uVelocity: { value: null }, texelSize: { value: sim.texel } });
  const clearMat = mat(CLEAR_FRAG, { uTexture: { value: null }, value: { value: PRESSURE_DECAY } });
  const splatMat = mat(SPLAT_FRAG, {
    uTarget: { value: null }, aspectRatio: { value: 1 },
    color: { value: new THREE.Vector3() }, point: { value: new THREE.Vector2() }, radius: { value: 0.004 },
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

  function splat(x, y, dx, dy, r, g, b, radius) {
    splatMat.uniforms.aspectRatio.value = sim.ar;
    splatMat.uniforms.point.value.set(x, y);
    splatMat.uniforms.radius.value = radius;

    splatMat.uniforms.uTarget.value = sim.velocity.read.texture;
    splatMat.uniforms.color.value.set(dx, dy, 0);
    blit(splatMat, sim.velocity.write);
    sim.velocity.swap();

    splatMat.uniforms.uTarget.value = sim.dye.read.texture;
    splatMat.uniforms.color.value.set(r, g, b);
    blit(splatMat, sim.dye.write);
    sim.dye.swap();
  }

  // brand red, with the odd warmer splat for variation
  function inkColor() {
    if (Math.random() < 0.16) return [0.5, 0.26, 0.2];
    const v = 0.3 + Math.random() * 0.35;
    return [v, v * (0.06 + Math.random() * 0.06), v * 0.05];
  }

  /* Several soft emitters spread across the canvas, each pushing in a slowly
     rotating direction. A single point source painted a narrow trail with a
     bright head — it read as a moving dot, not as smoke — and stalled into a
     dense blob wherever its path slowed down. */
  const emitters = [
    { cx: 0.22, cy: 0.42, ax: 0.14, ay: 0.20, fx: 0.11, fy: 0.08, px: 0.0, fr: 0.13, pr: 0.0, force: 900 },
    { cx: 0.78, cy: 0.56, ax: 0.15, ay: 0.18, fx: 0.09, fy: 0.12, px: 2.1, fr: -0.11, pr: 2.4, force: 900 },
    { cx: 0.5, cy: 0.78, ax: 0.22, ay: 0.12, fx: 0.07, fy: 0.15, px: 4.2, fr: 0.16, pr: 4.1, force: 820 },
  ];

  let elapsedTime = Math.random() * 40;
  function ambient(dt) {
    elapsedTime += dt;
    const t = elapsedTime;
    const gain = Math.min(dt * 60, 2);
    for (const e of emitters) {
      const x = e.cx + e.ax * Math.sin(t * e.fx + e.px);
      const y = e.cy + e.ay * Math.sin(t * e.fy + e.px * 0.7);
      const ang = t * e.fr + e.pr;
      const [r, g, b] = inkColor();
      const k = 0.17 * gain;
      splat(x, y, Math.cos(ang) * e.force, Math.sin(ang) * e.force, r * k, g * k, b * k, 0.006);
    }
  }

  function openingBurst() {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const rad = 0.16 + Math.random() * 0.2;
      const x = 0.5 + Math.cos(a) * rad;
      const y = 0.52 + Math.sin(a) * rad;
      const [r, g, b] = inkColor();
      splat(x, y, Math.cos(a) * 1500, Math.sin(a) * 1500, r * 1.1, g * 1.1, b * 1.1, 0.008);
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
    const texel = sim.texel;
    curlMat.uniforms.texelSize.value = texel;
    vorticityMat.uniforms.texelSize.value = texel;
    divergenceMat.uniforms.texelSize.value = texel;
    pressureMat.uniforms.texelSize.value = texel;
    gradientMat.uniforms.texelSize.value = texel;
    advectMat.uniforms.texelSize.value = texel;

    curlMat.uniforms.uVelocity.value = sim.velocity.read.texture;
    blit(curlMat, sim.curl);

    vorticityMat.uniforms.uVelocity.value = sim.velocity.read.texture;
    vorticityMat.uniforms.uCurl.value = sim.curl.texture;
    vorticityMat.uniforms.dt.value = dt;
    blit(vorticityMat, sim.velocity.write);
    sim.velocity.swap();

    divergenceMat.uniforms.uVelocity.value = sim.velocity.read.texture;
    blit(divergenceMat, sim.divergence);

    clearMat.uniforms.uTexture.value = sim.pressure.read.texture;
    blit(clearMat, sim.pressure.write);
    sim.pressure.swap();

    pressureMat.uniforms.uDivergence.value = sim.divergence.texture;
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      pressureMat.uniforms.uPressure.value = sim.pressure.read.texture;
      blit(pressureMat, sim.pressure.write);
      sim.pressure.swap();
    }

    gradientMat.uniforms.uPressure.value = sim.pressure.read.texture;
    gradientMat.uniforms.uVelocity.value = sim.velocity.read.texture;
    blit(gradientMat, sim.velocity.write);
    sim.velocity.swap();

    // dissipation is per-frame, so raise it to the frame's share of a 60Hz
    // step — otherwise the ink fades faster on a high refresh rate display
    const decay = dt * 60;

    advectMat.uniforms.dt.value = dt;
    advectMat.uniforms.uVelocity.value = sim.velocity.read.texture;
    advectMat.uniforms.uSource.value = sim.velocity.read.texture;
    advectMat.uniforms.dissipation.value = Math.pow(VELOCITY_DISSIPATION, decay);
    blit(advectMat, sim.velocity.write);
    sim.velocity.swap();

    advectMat.uniforms.uVelocity.value = sim.velocity.read.texture;
    advectMat.uniforms.uSource.value = sim.dye.read.texture;
    advectMat.uniforms.dissipation.value = Math.pow(DENSITY_DISSIPATION, decay);
    blit(advectMat, sim.dye.write);
    sim.dye.swap();
  }

  let visible = true;
  let alive = true;
  const clock = new THREE.Clock();
  openingBurst();

  /* Purely ambient, so the sim runs at 30Hz rather than every frame. Ink
     laid down and decay are both scaled by dt, so the motion reads the same
     as at 60Hz — it just costs half as much. */
  const SIM_INTERVAL = 1 / 30;
  let accumulator = 0;

  function frame() {
    if (!alive) return;
    requestAnimationFrame(frame);
    const elapsed = clock.getDelta();
    if (!visible || !inView) return;

    accumulator += Math.min(elapsed, 0.1);
    if (accumulator < SIM_INTERVAL) return;
    const dt = Math.min(accumulator, 0.05);
    accumulator = 0;

    ambient(dt);
    step(dt);

    displayMat.uniforms.uTexture.value = sim.dye.read.texture;
    blit(displayMat, null);
  }
  frame();

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    clock.getDelta();
  });

  /* A lost context leaves a dead canvas that never repaints. Rather than
     sit on a frozen frame, stop and uncover the section's CSS background. */
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    alive = false;
    canvas.style.display = 'none';
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // only worth rebuilding when the proportions actually changed
      if (!alive || Math.abs(aspect() - sim.ar) / sim.ar < 0.1) return;
      const old = sim;
      sim = buildSim();
      old.velocity.dispose();
      old.dye.dispose();
      old.pressure.dispose();
      old.divergence.dispose();
      old.curl.dispose();
      openingBurst();
    }, 250);
  });
}
