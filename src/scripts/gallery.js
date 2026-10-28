/* =========================================================================
   The wall, the menu, the project view and the About / Contact / Careers panels.
   Content comes from the JSON that Gallery.astro writes into #site-data.
   ========================================================================= */
import { gsap } from 'gsap';
import Lenis from 'lenis';
import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, DataTexture, Vector2, Vector3,
  ShaderMaterial, Mesh, VideoTexture, LinearFilter, Texture, MathUtils,
} from 'three';

/* =========================================================================
   Environment
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (k, dt) => 1 - Math.pow(1 - k, dt * 60);
const wrap = (v, p) => ((((v + p / 2) % p) + p) % p) - p / 2;
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const Q = new URLSearchParams(location.search);
const html = document.documentElement;
const cssVar = (name) => getComputedStyle(html).getPropertyValue(name).trim();
// a #rrggbb colour from gallery.css as 0–1 RGB
const cssRGB = (name) => { const h = cssVar(name).replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255 || 0); };
let VW = innerWidth, VH = innerHeight;
document.documentElement.style.setProperty('--vh', VH + 'px');

/* =========================================================================
   Content (src/content/projects/ and src/content/wall.yaml)
   ========================================================================= */
const DATA = JSON.parse($('#site-data').textContent);
const IM = DATA.images;
const PROJECTS = DATA.projects;
const PBY = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
const [START_KIND, START_ID] = (document.body.dataset.start || '').split(':');

/* =========================================================================
   Wall layout: hung rows on a centre line, consistent gutters, each row
   wraps on its own period, rows repeat vertically.
   ========================================================================= */
const WL = DATA.wall;
const SHAPE = { T: [2 / 3, 1], P: [0.8, 0.96], S: [1, 0.84], L: [1.5, 0.78], W: [16 / 9, 0.74], X: [4 / 3, 0.92] };
const BAND = { A: 440, B: 330 };
const LOGO = 'logo';           // the studio's logo as a tile (see drawLogo)
const TILES = [];
const ROWS = WL.rows.map((r, ri) => ({
  band: r.band, shift: r.shift || 0,
  tiles: r.tiles.map(([k, sh]) => {
    const t = { k, sh, img: IM[k], logo: k === LOGO, row: ri, x: 0, w: 0, h: 0, dx: 0, dy: 0, e: 0, hov: 0, hide: 1, loaded: 0, vis: false, focus: WL.focus[k] || [0.5, 0.5] };
    TILES.push(t); return t;
  }),
}));
const G = { s: 1, gap: 96, rgap: 92, H: 1 };
function layout() {
  const narrow = VW < 700;
  const s = narrow ? clamp(VW / 600, 0.56, 0.7) : clamp(Math.min(VW / 1440, VH / 860), 0.6, 1.3);
  const old = G.s;
  G.s = s; G.gap = (narrow ? 64 : 84) * s; G.rgap = (narrow ? 62 : 62) * s;
  const maxW = narrow ? VW - 56 : 1e9;
  let y = 0;
  for (const r of ROWS) {
    const bh = BAND[r.band] * s; let x = 0;
    for (const t of r.tiles) {
      const [ar, f] = SHAPE[t.sh];
      t.h = Math.round(bh * f); t.w = Math.round(t.h * ar);
      if (t.w > maxW) { t.w = Math.round(maxW); t.h = Math.round(t.w / ar); }
      t.x = x + t.w / 2; x += t.w + G.gap;
    }
    r.y = y + bh / 2; r.bh = bh; r.P = x; r.sx = r.shift * s;
    y += bh + G.rgap;
  }
  G.H = y;
  return old;
}

/* =========================================================================
   Camera / motion state
   ========================================================================= */
const cam = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, bend: 0, press: 0, zoom: 1, dirX: 1, dirY: 0 };
const TD = 0.66;               // wall brightness while the big title is up
const W = { dim: TD, alpha: 1, zoomMul: 1, hoverAny: 0, drift: 0 };
const MENU_DIM = 0.42;         // … with the menu open
let mode = 'intro';            // intro | wall | menu | project
let panel = null;              // 'about' | 'contact' | 'careers' | null
let titleUp = true;            // big title showing
let hovered = null;
let lastInput = performance.now();
let renderOn = true;
const DRIFT = { x: 0.82, y: 0.38 };   // px per frame-second at scale 1 (multiplied below)
// how bright the wall should be for what is open now
const wallDim = () => (panel ? 0.3 : mode === 'menu' ? MENU_DIM : titleUp ? TD : 1);
// a newer change of brightness replaces one still running
const dimTo = (v, duration = 1, ease = 'power2.inOut') => gsap.to(W, { dim: v, duration, ease, overwrite: 'auto' });

function homeCam() {
  const r0 = ROWS[0];
  const st = TILES.find((t) => t.k === WL.start[0]) || r0.tiles[0];
  cam.x = cam.tx = st.x + ROWS[st.row].sx + WL.start[1] * G.s;
  const r1 = ROWS[1] || r0;
  cam.y = cam.ty = (r0.y - r0.bh / 2 + r1.y + r1.bh / 2) / 2 + (VW < 700 ? 0 : 8 * G.s);
}
function place(t) {
  const r = ROWS[t.row];
  t.dx = wrap(t.x + r.sx - cam.x, r.P);
  t.dy = wrap(r.y - cam.y, G.H);
}
function tileRect(t, k = cam.zoom, hov = t.hov) {
  const sc = 1 + 0.045 * hov;
  const w = t.w * sc * k, h = t.h * sc * k;
  const cx = VW / 2 + t.dx * k, cy = VH / 2 + t.dy * k;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function shiftOf(t, k = cam.zoom) {
  return [clamp((t.dx * k) / (VW * 0.5), -1.3, 1.3) * 0.6, clamp((-t.dy * k) / (VH * 0.5), -1.3, 1.3) * 0.6];
}
const ZOOM = (t) => 1.1 - 0.04 * t.hov;

/* =========================================================================
   Renderers: WebGL (three.js) with a DOM fallback
   ========================================================================= */
const VS = /* glsl */`
uniform vec2 uView; uniform float uBend; uniform vec2 uDir;
varying vec2 vUv; varying float vShade;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec2 n = w.xy / (uView * 0.5);
  float r2 = dot(n, n);
  float d = dot(n, uDir);
  w.z -= uBend * (r2 * 0.15 + d * d * 0.07) * uView.y;
  vShade = 1.0 - uBend * clamp(r2, 0.0, 2.0) * 0.14;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */`
precision highp float;
uniform sampler2D uTex; uniform vec2 uPlane; uniform vec2 uImg; uniform vec2 uFocus; uniform vec2 uShift;
uniform float uZoom; uniform float uDim; uniform float uGrade; uniform float uAlpha; uniform float uLoaded;
uniform vec3 uFade; uniform vec3 uTint; uniform vec3 uPh;
varying vec2 vUv; varying float vShade;
void main() {
  float pr = uPlane.x / uPlane.y, ir = uImg.x / uImg.y;
  vec2 s = pr > ir ? vec2(1.0, ir / pr) : vec2(pr / ir, 1.0);
  s /= uZoom;
  vec2 room = 1.0 - s;
  vec2 o = clamp(room * uFocus + uShift * room * 0.5, vec2(0.0), room);
  vec3 c = texture2D(uTex, o + vUv * s).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 g = mix(vec3(l), c, 0.8);
  g = (g - 0.5) * 1.05 + 0.5;
  g *= uTint;
  c = mix(c, g, uGrade);
  // dimmed tiles fade to black on the dark theme, to the page colour on the light one
  c = mix(uFade, c, uDim * vShade);
  c = mix(mix(uFade, uPh, uDim), c, uLoaded);
  gl_FragColor = vec4(c * uAlpha, uAlpha);
}`;

function makeGL(canvas) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const FOV = 35;
  const camera = new PerspectiveCamera(FOV, VW / VH, 1, 30000);
  let D = 1;
  const geo = new PlaneGeometry(1, 1, 24, 24);
  const blank = new DataTexture(new Uint8Array([22, 22, 21, 255]), 1, 1);
  blank.needsUpdate = true;
  const shared = {
    uView: { value: new Vector2(VW, VH) }, uBend: { value: 0 }, uDir: { value: new Vector2(1, 0) },
    uFade: { value: new Vector3() }, uTint: { value: new Vector3() }, uPh: { value: new Vector3() },
  };
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const queue = [];
  const api = {
    kind: 'gl',
    resize() {
      renderer.setSize(VW, VH, false);
      camera.aspect = VW / VH;
      D = VH / 2 / Math.tan(MathUtils.degToRad(FOV / 2));
      camera.updateProjectionMatrix();
      shared.uView.value.set(VW, VH);
    },
    // the theme's wall colours (--wall-fade, --wall-tint, --wall-ph in gallery.css)
    colors() {
      for (const [u, v] of [['uFade', '--wall-fade'], ['uTint', '--wall-tint'], ['uPh', '--wall-ph']]) shared[u].value.set(...cssRGB(v));
      for (const t of TILES) if (t.tex && t.logo) t.tex.needsUpdate = true;
    },
    add(t) {
      const mat = new ShaderMaterial({
        vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
        uniforms: {
          ...shared,
          uTex: { value: blank }, uPlane: { value: new Vector2(1, 1) }, uImg: { value: new Vector2(1, 1) },
          uFocus: { value: new Vector2(0.5, 0.5) }, uShift: { value: new Vector2() }, uZoom: { value: 1.1 },
          uDim: { value: 1 }, uGrade: { value: 1 }, uAlpha: { value: 0 }, uLoaded: { value: 0 },
        },
      });
      const m = new Mesh(geo, mat);
      m.frustumCulled = false; m.visible = false;
      scene.add(m);
      t.mesh = m; t.u = mat.uniforms;
    },
    image(t, img) { queue.push([t, img]); },
    video(t, v) {
      const tex = new VideoTexture(v);
      tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.generateMipmaps = false;
      t.u.uTex.value = tex;
      t.u.uImg.value.set(v.videoWidth || 9, v.videoHeight || 16);
      t.u.uFocus.value.set(0.5, 0.5);
    },
    // compile the tile shader now, before the loader animates: in the background where the browser
    // supports it (KHR_parallel_shader_compile), otherwise straight away
    warm() {
      if (!scene.children.length) return;
      scene.children.forEach((m) => (m.visible = true));
      if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) renderer.compileAsync(scene, camera).catch(() => {});
      else renderer.compile(scene, camera);
      scene.children.forEach((m) => (m.visible = false));
    },
    frame() {
      // upload textures within a small time budget per frame to stay smooth
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 5) {
        const [t, img] = queue.shift();
        const tex = new Texture(img);
        // bitmaps arrive already flipped (see loadTiles); images are flipped by WebGL
        if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) tex.flipY = false;
        tex.anisotropy = aniso; tex.needsUpdate = true;
        t.u.uTex.value = t.tex = tex;
        t.u.uImg.value.set(img.naturalWidth || img.width, img.naturalHeight || img.height);
        renderer.initTexture(tex);
        t.texReady = true;
        if (RM) t.loaded = 1; else gsap.to(t, { loaded: 1, duration: 0.9, ease: 'power2.out' });
      }
      shared.uBend.value = cam.bend;
      shared.uDir.value.set(cam.dirX, -cam.dirY);
      for (const t of TILES) {
        const m = t.mesh;
        if (!t.vis) { m.visible = false; continue; }
        const e = t.e, sc = (0.3 + 0.7 * e) * (1 + 0.045 * t.hov);
        m.visible = true;
        m.position.set(t.dx * e, -t.dy * e, 0);
        m.scale.set(t.w * sc, t.h * sc, 1);
        const u = t.u;
        u.uPlane.value.set(t.w, t.h);
        const [sx, sy] = shiftOf(t, 1);
        u.uShift.value.set(sx * e, sy * e);
        u.uZoom.value = ZOOM(t);
        u.uDim.value = W.dim * (1 - 0.46 * W.hoverAny * (1 - t.hov));
        u.uGrade.value = t.logo ? 0 : 1 - t.hov;
        u.uAlpha.value = Math.min(1, e * 2.2) * W.alpha * t.hide;
        u.uLoaded.value = t.loaded;
      }
      camera.position.set(0, 0, D / cam.zoom);
      renderer.render(scene, camera);
    },
    show(on) { canvas.style.visibility = on ? 'visible' : 'hidden'; },
  };
  api.resize();
  return api;
}

function makeDOM(root) {
  root.hidden = false;
  $('.gl').style.display = 'none';
  const api = {
    kind: 'dom',
    resize() {},
    colors() {},
    add(t) {
      const el = document.createElement('div');
      el.className = 'dt';
      el.style.visibility = 'hidden';
      root.append(el);
      t.el = el;
    },
    image(t, img) {
      img.alt = ''; img.draggable = false;
      if (t.img && t.img.ref) img.dataset.ref = '';
      t.el.prepend(img); t.texReady = true;
      if (RM) t.loaded = 1; else gsap.to(t, { loaded: 1, duration: 0.9 });
    },
    video(t, v) {
      v.style.cssText = 'position:absolute;inset:0';
      t.el.append(v);
    },
    frame() {
      for (const t of TILES) {
        const el = t.el;
        if (!t.vis) { if (t.shown) { el.style.visibility = 'hidden'; t.shown = false; } continue; }
        if (!t.shown) { el.style.visibility = 'visible'; t.shown = true; }
        const e = t.e, k = cam.zoom;
        if (t._w !== t.w || t._h !== t.h) { el.style.width = t.w + 'px'; el.style.height = t.h + 'px'; t._w = t.w; t._h = t.h; }
        const sc = (0.3 + 0.7 * e) * (1 + 0.045 * t.hov) * k;
        const cx = VW / 2 + t.dx * e * k, cy = VH / 2 + t.dy * e * k;
        el.style.transform = `translate3d(${(cx - t.w / 2).toFixed(1)}px,${(cy - t.h / 2).toFixed(1)}px,0) scale(${sc.toFixed(4)})`;
        el.style.opacity = (Math.min(1, e * 2.2) * W.alpha * t.hide * t.loaded * W.dim * (1 - 0.46 * W.hoverAny * (1 - t.hov))).toFixed(3);
        el.classList.toggle('is-hover', t.hov > 0.5);
      }
    },
    show(on) { root.style.visibility = on ? 'visible' : 'hidden'; },
  };
  return api;
}

let R = null;
const texSrc = (k) => IM[k].wall;
const vidSrc = (k) => IM[k].wallVideo;

// texture loading, nearest tiles first
let loadedCount = 0, tilesStarted = false;
// Decoding into an ImageBitmap happens off the main thread, and the bitmap arrives already flipped for
// WebGL, so uploading it is cheap. Safari before 17 and Firefox before 98 mishandle the options
// (three.js's GLTFLoader makes the same check); they keep the plain image path.
const UA = navigator.userAgent;
const SAFARI = /^((?!chrome|android).)*safari/i.test(UA) ? +((UA.match(/Version\/(\d+)/) || [])[1] || -1) : 0;
const FIREFOX = /firefox/i.test(UA) ? +((UA.match(/Firefox\/(\d+)/) || [])[1] || -1) : 0;
const BITMAPS = typeof createImageBitmap === 'function' && !(SAFARI && SAFARI < 17) && !(FIREFOX && FIREFOX < 98);
function imageOf(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return (img.decode ? img.decode() : new Promise((r, x) => { img.onload = r; img.onerror = x; })).then(() => img);
}
function bitmapOf(src) {
  return fetch(src)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
    .then((b) => createImageBitmap(b, { imageOrientation: 'flipY', premultiplyAlpha: 'none' }));
}
function loadTiles() {
  if (tilesStarted) return;
  tilesStarted = true;
  const order = [...TILES].sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
  const viaBitmap = BITMAPS && R.kind === 'gl';
  // the logo tile's lettering waits for the site's font (but not for long)
  const font = `500 20px ${getComputedStyle(document.body).fontFamily}`;
  const fontIn = Promise.race([document.fonts ? document.fonts.load(font) : null, new Promise((r) => setTimeout(r, 1800))]).catch(() => {});
  let i = 0;
  const next = () => {
    const t = order[i++];
    if (!t) return;
    if (t.logo) { fontIn.then(() => { R.image(t, drawLogo(t)); loadedCount++; }); next(); return; }
    const src = texSrc(t.k);
    (viaBitmap ? bitmapOf(src).catch(() => imageOf(src)) : imageOf(src)).then((img) => {
      R.image(t, img); loadedCount++;
      if (t.img.video) startVideo(t);
    }).catch(() => {}).finally(next);
  };
  for (let c = 0; c < 6; c++) next();
}
// The studio's logo as a tile on the wall (`logo` in wall.yaml): the mark with the name beneath.
// Drawn here rather than kept as an image so that it follows the light / dark switch.
const MARK_D = $('.brand path').getAttribute('d');
function drawLogo(t) {
  const cv = t.cv || (t.cv = document.createElement('canvas'));
  const w = 800, h = Math.round(w / SHAPE[t.sh][0]);
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = cssVar('--tile-bg'); g.fillRect(0, 0, w, h);
  // the mark: about a third of the tile's height, a little above the middle
  const mh = h * 0.3, s = mh / VB[3], cy = h * 0.45;
  g.save();
  g.translate(w / 2 - (VB[2] * s) / 2 - VB[0] * s, cy - mh / 2 - VB[1] * s);
  g.scale(s, s);
  g.fillStyle = cssVar('--tile-fg');
  g.fill(new Path2D(MARK_D));
  g.restore();
  // the name in spaced capitals, set letter by letter (canvas letter-spacing is not everywhere yet)
  const fs = h * 0.026, sp = fs * 0.34, ch = [...DATA.name.toUpperCase()];
  g.font = `500 ${fs}px ${getComputedStyle(document.body).fontFamily}`;
  g.fillStyle = cssVar('--tile-fg-2');
  const ws = ch.map((c) => g.measureText(c).width);
  let x = w / 2 - (ws.reduce((a, b) => a + b, 0) + sp * (ch.length - 1)) / 2;
  ch.forEach((c, i) => { g.fillText(c, x, cy + mh / 2 + h * 0.115); x += ws[i] + sp; });
  return cv;
}
function startVideo(t) {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  v.preload = 'auto'; v.dataset.ref = '';
  v.src = vidSrc(t.k);
  t.video = v;
  v.addEventListener('playing', () => { if (!t.vReady) { t.vReady = true; R.video(t, v); } });
  if (R.kind === 'dom') R.video(t, v);
}

/* =========================================================================
   Wall frame update
   ========================================================================= */
function wallUpdate(dt, now) {
  const idle = now - lastInput > 2400;
  const canDrift = !RM && idle && !drag.on && (mode === 'wall' || mode === 'intro' || mode === 'menu');
  W.drift = lerp(W.drift, canDrift ? 1 : 0, damp(0.02, dt));
  cam.tx += DRIFT.x * W.drift * dt * 60 * G.s * 0.22;
  cam.ty += DRIFT.y * W.drift * dt * 60 * G.s * 0.22;
  const ox = cam.x, oy = cam.y;
  // under a finger the wall follows closely; otherwise it eases and glides
  const k = damp(RM ? 0.3 : drag.on && drag.touch ? 0.24 : 0.075, dt);
  cam.x += (cam.tx - cam.x) * k;
  cam.y += (cam.ty - cam.y) * k;
  const vx = (cam.x - ox) / Math.max(dt, 1e-3), vy = (cam.y - oy) / Math.max(dt, 1e-3);
  cam.vx = lerp(cam.vx, vx, damp(0.25, dt)); cam.vy = lerp(cam.vy, vy, damp(0.25, dt));
  const sp = Math.hypot(cam.vx, cam.vy);
  if (sp > 1) { cam.dirX = cam.vx / sp; cam.dirY = cam.vy / sp; }
  const bt = RM ? 0 : clamp((sp - 90) / (2400 * G.s), 0, 1);
  cam.bend = lerp(cam.bend, bt, damp(bt > cam.bend ? 0.1 : 0.05, dt));
  cam.press = lerp(cam.press, drag.on && drag.moved ? 1 : 0, damp(0.08, dt));
  cam.zoom = (1 - 0.075 * cam.bend - 0.028 * cam.press) * W.zoomMul;

  // visibility + hover
  const k2 = cam.zoom;
  const mx = VW / (2 * k2) + VW * 0.2 * cam.bend, my = VH / (2 * k2) + VH * 0.2 * cam.bend;
  for (const t of TILES) {
    place(t);
    t.vis = t.e > 0.001 && Math.abs(t.dx * t.e) < mx + t.w * 0.6 + 40 && Math.abs(t.dy * t.e) < my + t.h * 0.6 + 40;
    if (t.video) {
      if (t.vis && t.video.paused && !document.hidden) t.video.play().catch(() => {});
      else if (!t.vis && !t.video.paused) t.video.pause();
    }
  }
  updateHover();
  for (const t of TILES) t.hov = lerp(t.hov, t === hovered ? 1 : 0, damp(0.11, dt));
  W.hoverAny = lerp(W.hoverAny, hovered ? 1 : 0, damp(0.09, dt));
  R.frame();
}

/* =========================================================================
   Input: drag, wheel, keys, idle drift
   ========================================================================= */
const drag = { on: false, moved: false, touch: false, id: null, sx: 0, sy: 0, lx: 0, ly: 0, vx: 0, vy: 0, t: 0, dist: 0 };
const pointer = { x: VW / 2, y: VH / 2, in: false };
let lastPointer = 0;
addEventListener('pointerdown', () => (lastPointer = performance.now()), true);
addEventListener('keydown', (e) => { if (e.key === 'Tab') $$('.no-ring').forEach((el) => el.classList.remove('no-ring')); }, true);
function focusSoft(el) {
  if (!el) return;
  if (performance.now() - lastPointer < 4000) {
    el.classList.add('no-ring');
    el.addEventListener('blur', () => el.classList.remove('no-ring'), { once: true });
  }
  el.focus({ preventScroll: true });
}
const stage = () => (R && R.kind === 'dom' ? $('.dom-wall') : $('.gl'));

function onDown(e) {
  if (mode !== 'wall' || (e.button !== undefined && e.button !== 0)) return;
  drag.on = true; drag.moved = false; drag.id = e.pointerId; drag.touch = e.pointerType === 'touch';
  drag.sx = drag.lx = e.clientX; drag.sy = drag.ly = e.clientY; drag.vx = drag.vy = 0; drag.t = performance.now(); drag.dist = 0;
  try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
  cursor.el.classList.add('down');
  lastInput = performance.now();
}
function onMove(e) {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (!drag.on || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
  drag.lx = e.clientX; drag.ly = e.clientY;
  drag.dist += Math.hypot(dx, dy);
  if (drag.dist > 6) drag.moved = true;
  const now = performance.now(), dt = Math.max(1, now - drag.t); drag.t = now;
  drag.vx = lerp(drag.vx, dx / dt, 0.35); drag.vy = lerp(drag.vy, dy / dt, 0.35);
  const m = 1.15 / cam.zoom;
  cam.tx -= dx * m; cam.ty -= dy * m;
  lastInput = now;
  if (drag.dist > 24) shrinkTitle();
}
function onUp(e) {
  if (!drag.on || e.pointerId !== drag.id) return;
  drag.on = false;
  cursor.el.classList.remove('down');
  if (!drag.moved) {
    const t = hitTest(e.clientX, e.clientY);
    if (t) openFromTile(t);
  } else if (!RM) {
    const since = performance.now() - drag.t;
    if (since < 80) { cam.tx -= drag.vx * 260; cam.ty -= drag.vy * 260; }
  }
  drag.moved = false;
  lastInput = performance.now();
}
function onWheel(e) {
  if (mode !== 'wall' || panel) return;
  e.preventDefault();
  const f = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? VH : 1;
  let dx = e.deltaX * f, dy = e.deltaY * f;
  if (e.shiftKey && !dx) { dx = dy; dy = 0; }
  cam.tx += clamp(dx, -240, 240) * 1.1;
  cam.ty += clamp(dy, -240, 240) * 1.1;
  lastInput = performance.now();
  if (Math.abs(dx) + Math.abs(dy) > 2) shrinkTitle();
}
function onKey(e) {
  if (e.key === 'Escape') { escape(); return; }
  if (lb.open) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) { e.preventDefault(); lbShow(lb.i + step, true); }
    return;
  }
  if (mode !== 'wall' || panel) return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  const step = 260 * G.s;
  const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (map[e.key]) { e.preventDefault(); cam.tx += map[e.key][0]; cam.ty += map[e.key][1]; lastInput = performance.now(); shrinkTitle(); }
}

function hitTest(x, y) {
  if (mode !== 'wall') return null;
  const k = cam.zoom;
  const wx = (x - VW / 2) / k, wy = (y - VH / 2) / k;
  for (const t of TILES) {
    if (!t.vis || t.e < 0.98) continue;
    const sc = 1 + 0.045 * t.hov;
    if (Math.abs(wx - t.dx) <= (t.w * sc) / 2 && Math.abs(wy - t.dy) <= (t.h * sc) / 2) return t;
  }
  return null;
}
function updateHover() {
  let h = null;
  if (FINE && pointer.in && mode === 'wall' && !drag.moved && !busy && !titleBack && Math.hypot(cam.vx, cam.vy) < 1400 * G.s) h = hitTest(pointer.x, pointer.y);
  if (h !== hovered) {
    hovered = h;
    if (h && h.logo) {
      cursor.name.textContent = DATA.name;
      cursor.act.textContent = 'About';
    } else if (h) {
      const p = PBY[h.img.p];
      cursor.name.textContent = p ? p.name : '';
      cursor.act.textContent = 'View';
      preload(h.img.mid);
    }
  }
  cursor.state(hovered ? 'view' : null, 'wall');
}
const preloaded = new Map();
function preload(src) {
  if (!src || preloaded.has(src)) return preloaded.get(src);
  const im = new Image(); im.decoding = 'async'; im.src = src;
  const p = (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => im);
  preloaded.set(src, p); return p;
}

/* =========================================================================
   Cursor
   ========================================================================= */
const cursor = {
  el: $('.cur'), name: $('.cur-name'), act: $('.cur-act'), x: VW / 2, y: VH / 2, owner: null,
  state(s, owner) {
    if (owner !== undefined && this.owner && this.owner !== owner && !s) return;
    this.owner = s ? owner : null;
    this.el.classList.toggle('view', s === 'view');
    this.el.classList.toggle('drag', s === 'drag');
  },
  update(dt) {
    this.x = lerp(this.x, pointer.x, damp(0.28, dt)); this.y = lerp(this.y, pointer.y, damp(0.28, dt));
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px,${this.y.toFixed(1)}px,0)`;
  },
};

/* =========================================================================
   Title: "Vistaraa / Architects" rises in. On the first scroll the V and the A
   light up, leave their words, and fly into the top-left corner, where they
   come together as the logo.
   ========================================================================= */
const hero = $('.hero'), title = $('.title'), brand = $('.brand');
function splitChars(el) {
  return $$('.tw', el).map((tw) => {
    const txt = tw.textContent; tw.textContent = '';
    return [...txt].map((c) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; tw.append(s); return s; });
  });
}
const titleLines = splitChars(title);
const titleChars = titleLines.flat();
const initials = titleLines.map((l) => l[0]).slice(0, 2);   // the V and the A
initials.forEach((c) => c.classList.add('ini'));
let titleIntro = null;   // the letters rising in (or flying back); the logo waits for them
let titleBack = false;   // the title is flying back out of the corner (tiles show no hover meanwhile)

// Where each letter sits in the logo, in the logo's own units (its viewBox is 35 43 509 662):
// the V is the back stroke with the left side of the A; the A is the peak, the seat (its bar) and the legs.
const VB = [35, 43, 509, 662];
const SLOTS = [[35, 43, 375, 551], [142, 48, 544, 705]];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mixBox = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });
const slotIn = (m, [x0, y0, x1, y1]) => {
  const s = m.w / VB[2];
  return { x: m.x + (x0 - VB[0]) * s, y: m.y + (y0 - VB[1]) * s, w: (x1 - x0) * s, h: (y1 - y0) * s };
};
// the ink of a single letter on screen (the glyph itself, not its line box)
const measureCtx = document.createElement('canvas').getContext('2d');
function inkBox(el) {
  const cs = getComputedStyle(el);
  measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = measureCtx.measureText(el.textContent);
  const r = document.createRange(); r.selectNodeContents(el);
  const b = r.getBoundingClientRect();   // the text's content area: its top sits one ascent above the baseline
  const base = b.top + (Number.isFinite(m.fontBoundingBoxAscent) ? m.fontBoundingBoxAscent : b.height * 0.76);
  return { x: b.left - m.actualBoundingBoxLeft, y: base - m.actualBoundingBoxAscent, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent };
}
function logoDone() {
  hero.classList.add('is-done');
  brand.classList.remove('is-wait');
}
function shrinkTitle(instant) {
  if (!titleUp || mode === 'intro') return;
  titleUp = false;
  $('.hint').classList.add('is-gone');
  hero.classList.add('is-gone');
  if (VW < 700) $('.foot').classList.add('is-hidden');
  dimTo(wallDim(), 1.6);
  if (RM || instant || initials.length < 2 || !measureCtx) { logoDone(); return; }
  gsap.to('.hero-line span', { opacity: 0, y: -10, duration: 0.6, ease: 'power2.in', overwrite: 'auto' });
  // scrolled while the letters were still rising (or flying back): let them finish quickly first
  if (titleIntro && titleIntro.progress() < 1) titleIntro.timeScale(4).eventCallback('onComplete', formLogo);
  else formLogo();
}
// The way between the title and the corner: at u = 0 the V and the A stand in their words, at u = 1
// a copy of the logo sits exactly over the one in the corner. render() draws any point on the way.
function logoFlight() {
  gsap.killTweensOf(titleChars);
  gsap.set(titleChars, { clearProps: 'transform' });
  title.classList.add('is-forming');
  const lay = initials.map((c) => c.getBoundingClientRect());
  const ink = initials.map(inkBox);
  const mark = $('svg', brand), B0 = mark.getBoundingClientRect();
  const B = { x: B0.left, y: B0.top, w: B0.width, h: B0.height };
  // the logo starts as large as the V (so the V keeps its size as the two letters close in),
  // centred between the two letters
  const k0 = ink[0].h / (SLOTS[0][3] - SLOTS[0][1]);
  const M0 = { w: VB[2] * k0, h: VB[3] * k0 };
  const ux = Math.min(ink[0].x, ink[1].x), uy = Math.min(ink[0].y, ink[1].y);
  M0.x = (ux + Math.max(ink[0].x + ink[0].w, ink[1].x + ink[1].w)) / 2 - M0.w / 2;
  M0.y = (uy + Math.max(ink[0].y + ink[0].h, ink[1].y + ink[1].h)) / 2 - M0.h / 2;
  // a copy of the logo, drawn at the starting size (so it stays sharp as it shrinks), which takes over
  // from the letters on the way
  const fly = mark.cloneNode(true);
  fly.setAttribute('class', 'logo-fly');
  Object.assign(fly.style, { width: M0.w + 'px', height: M0.h + 'px' });
  document.body.append(fly);
  const st = { u: 0 };
  const render = () => {
    const u = st.u, k = Math.pow(B.w / M0.w, u);
    const w = M0.w * k, h = M0.h * k;
    const M = { x: lerp(M0.x + M0.w / 2, B.x + B.w / 2, u) - w / 2, y: lerp(M0.y + M0.h / 2, B.y + B.h / 2, u) - h / 2, w, h };
    const a = smooth(0, 0.5, u);   // how far the letters have closed into the logo's shape
    initials.forEach((el, i) => {
      const I = ink[i], L = lay[i], R = mixBox(I, slotIn(M, SLOTS[i]), a);
      const sx = R.w / I.w, sy = R.h / I.h;
      el.style.transform = `translate(${(R.x - L.left - sx * (I.x - L.left)).toFixed(2)}px, ${(R.y - L.top - sy * (I.y - L.top)).toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      el.style.opacity = (1 - smooth(0.55, 0.9, u)).toFixed(3);
    });
    fly.style.transform = `translate(${M.x.toFixed(2)}px, ${M.y.toFixed(2)}px) scale(${k.toFixed(5)})`;
    fly.style.opacity = smooth(0.42, 0.8, u).toFixed(3);
  };
  return { st, render, fly };
}
function formLogo() {
  const rest = titleChars.filter((c) => !initials.includes(c));
  const { st, render, fly } = logoFlight();
  gsap.timeline({ onComplete: () => { logoDone(); fly.remove(); } })
    // the V and the A light up while the rest of the letters dim, then fall away
    .to(initials, { color: cssVar('--accent'), duration: 0.45, ease: 'power2.out' }, 0)
    .to(rest, { opacity: 0.14, duration: 0.45, ease: 'power2.out' }, 0)
    .to(rest, { opacity: 0, yPercent: 24, duration: 0.55, ease: 'power2.in', stagger: 0.016 }, 0.4)
    // the two fly to the corner, closing into the logo's shape, and become it
    .to(st, { u: 1, duration: 1.7, ease: 'power3.inOut', onUpdate: render }, 0.55)
    .to(initials, { color: cssVar('--fg'), duration: 0.6, ease: 'none' }, 1.15);
}
// On the wall, clicking the logo plays the opening back: the logo flies out of the corner and parts
// into the V and the A, which settle into "Vistaraa / Architects" as the other letters return.
// The next scroll forms the logo again.
function showTitle() {
  if (titleUp || mode !== 'wall' || panel || busy || brand.classList.contains('is-wait')) return;
  titleUp = true;
  hero.classList.remove('is-gone');
  $('.hint').classList.remove('is-gone');
  $('.foot').classList.remove('is-hidden');
  dimTo(wallDim(), 1.4);
  const line = $$('.hero-line span');
  if (RM || initials.length < 2 || !measureCtx) {
    gsap.set([...titleChars, ...line], { clearProps: 'all' });
    hero.classList.remove('is-done'); brand.classList.add('is-wait');
    return;
  }
  const rest = titleChars.filter((c) => !initials.includes(c));
  const { st, render, fly } = logoFlight();
  st.u = 1; render();
  brand.classList.add('is-wait');
  gsap.set(rest, { opacity: 0 });
  gsap.set(initials, { color: cssVar('--fg') });
  hero.classList.remove('is-done');
  titleBack = true;
  titleIntro = gsap.timeline()
    // the logo leaves the corner and parts into the V and the A, which light up on the way
    .to(st, { u: 0, duration: 1.6, ease: 'power3.inOut', onUpdate: render }, 0)
    .to(initials, { color: cssVar('--accent'), duration: 0.5, ease: 'power2.out' }, 0.45)
    // the other letters come back around them
    .fromTo(rest, { opacity: 0, yPercent: 24 }, { opacity: 1, yPercent: 0, duration: 0.9, ease: 'power3.out', stagger: 0.018 }, 1.25)
    .to(initials, { color: cssVar('--fg'), duration: 0.8, ease: 'power1.inOut' }, 1.75)
    .fromTo(line, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, 1.6)
    .call(() => { titleBack = false; fly.remove(); title.classList.remove('is-forming'); gsap.set(titleChars, { clearProps: 'transform,opacity,color' }); });
}

/* =========================================================================
   Flyer: FLIP of an image between a wall tile / thumbnail and full-bleed
   ========================================================================= */
const gradeOn = () => cssVar('--grade');   // the wall's colour grade for this theme
const GRADE_OFF = 'saturate(1) contrast(1) brightness(1)';
function makeFlyer(img, rect, opt = {}) {
  const el = document.createElement('div');
  el.className = 'flyer';
  Object.assign(el.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
  let media;
  if (opt.video) { media = opt.video; media.style.cssText = ''; }
  else { media = new Image(); media.alt = ''; media.decoding = 'sync'; media.src = opt.src || img.mid; }
  if (opt.focus) media.style.objectPosition = `${opt.focus[0] * 100}% ${opt.focus[1] * 100}%`;
  el.append(media);
  document.body.append(el);
  return { el, media };
}
function innerFrom(t, rect) {
  // match the shader: zoomed + parallax-shifted inside the frame
  const z = ZOOM(t), room = 1 - 1 / z;
  const [sx, sy] = shiftOf(t);
  return { scale: z, x: -sx * room * 0.5 * rect.w * z, y: sy * room * 0.5 * rect.h * z };
}

/* =========================================================================
   Project view
   ========================================================================= */
const pj = $('.pj'), pjScroll = $('.pj-scroll'), pjInner = $('.pj-inner');
let pjLenis = null, pjCur = null, pjHeroKey = null, origin = null, prevMode = 'wall', busy = false;
const grid = $('.pj-grid');
// project images: two columns, one below 861px (see .pj-grid)
const GRID_SIZES = '(max-width: 860px) 94vw, 48vw';

function mediaEl(img, eager) {
  if (img.video) {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.autoplay = true; v.preload = eager ? 'auto' : 'metadata'; v.poster = img.mid; v.src = img.video;
    v.setAttribute('aria-label', img.alt); v.dataset.ref = '';
    v.width = img.w; v.height = img.h;
    return v;
  }
  const i = new Image();
  i.alt = img.alt; i.decoding = 'async'; i.loading = eager ? 'eager' : 'lazy'; i.draggable = false;
  i.width = img.w; i.height = img.h;
  i.sizes = GRID_SIZES;
  i.srcset = `${img.mid} ${img.mw}w, ${img.lg} ${img.lw}w, ${img.full} ${img.fw}w`;
  i.src = img.lg;
  if (img.ref) i.dataset.ref = '';
  return i;
}
function renderProject(p, heroKey) {
  pjCur = p; pjHeroKey = heroKey;
  const himg = IM[heroKey];
  const hm = $('.pj-hero-media'); hm.textContent = '';
  if (himg.video) {
    const v = mediaEl(himg, true); v.className = 'lo'; hm.append(v);
  } else {
    const lo = new Image(); lo.alt = himg.alt; lo.src = himg.mid; lo.className = 'lo'; if (himg.ref) lo.dataset.ref = '';
    const hi = new Image(); hi.alt = ''; hi.setAttribute('aria-hidden', 'true'); hi.className = 'hi'; hi.decoding = 'async'; if (himg.ref) hi.dataset.ref = '';
    hi.onload = () => hi.classList.add('on'); hi.src = himg.full;
    hm.append(lo, hi);
  }
  $('.pj-kicker').textContent = `${p.no} — ${p.typ}${p.placeholder ? ' · Reference' : ''}`;
  $('.pj-title').innerHTML = p.name.split(' ').map((w) => `<span class="w"><span>${esc(w)}</span></span>`).join(' ');
  $('.pj-line').innerHTML = p.line;
  const body = $('.pj-body');
  if (p.placeholder) {
    body.innerHTML = `<dl class="pj-facts"><div><dt>Typology</dt><dd>${esc(p.typ)}</dd></div><div><dt>Status</dt><dd>Reference</dd></div></dl>
      <p class="pj-note">Reference project: stock photography stands in for a future ${esc(DATA.name)} project.</p>`;
  } else {
    body.innerHTML = p.copy +
      (p.facts.length ? `<dl class="pj-facts">${p.facts.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>` : '');
  }
  grid.textContent = '';
  p.seq.forEach((k, i) => {
    const img = IM[k];
    const f = document.createElement('figure'); f.className = 'pj-fig';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pj-zoom'; b.dataset.i = i;
    b.style.aspectRatio = `${img.w} / ${img.h}`;
    b.setAttribute('aria-label', `Enlarge image ${i + 1}${img.cap ? `: ${img.cap}` : ''}`);
    b.append(mediaEl(img, i < 4));
    const c = document.createElement('figcaption');
    c.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b><span>${esc(img.cap)}</span>`;
    const li = document.createElement('li');
    f.append(b, c); li.append(f); grid.append(li);
  });
  pjScroll.scrollTop = 0;
  if (pjLenis) pjLenis.scrollTo(0, { immediate: true });
}
function heroIn() {
  const w = $$('.pj-title .w > span'), k = $('.pj-kicker'), cue = $('.pj-scrollcue');
  if (RM) return;
  gsap.fromTo(w, { yPercent: 110 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.08 });
  gsap.fromTo([k, cue], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.25 });
}
function setInert(on) {
  for (const el of [$('#main'), $('.bar'), $('.foot'), $('.menu')]) el.inert = on;
}
function wallVisible(on) {
  renderOn = on; R.show(on);
  if (!on) for (const t of TILES) if (t.video && !t.video.paused) t.video.pause();
}
function showProject() {
  pj.classList.add('on'); gsap.set(pj, { opacity: 1 });
  requestAnimationFrame(() => pj.classList.add('shade'));
  setInert(true);
  $('.bar').classList.add('is-hidden');
  if (!pjLenis && Lenis && !RM) pjLenis = new Lenis({ wrapper: pjScroll, content: pjInner, lerp: 0.09, smoothWheel: true });
  if (pjLenis) pjLenis.start();
}
async function openFromTile(t) {
  if (busy || mode !== 'wall') return;
  if (t.logo) { openPanel('about'); return; }
  const p = PBY[t.img.p]; if (!p) return;
  busy = true; shrinkTitle();
  route(p.url, p.name);
  cam.tx = cam.x; cam.ty = cam.y;
  hovered = t; cursor.state(null);
  const rect = tileRect(t);
  let fl;
  if (t.img.video && t.video) {
    fl = makeFlyer(t.img, rect, { video: t.video });
  } else {
    await Promise.race([preload(t.img.mid), new Promise((r) => setTimeout(r, 350))]);
    fl = makeFlyer(t.img, rect, { focus: t.focus });
  }
  const inner = innerFrom(t, rect);
  gsap.set(fl.media, { ...inner, filter: t.hov > 0.5 ? GRADE_OFF : gradeOn() });
  t.hide = 0;
  renderProject(p, t.k);
  prevMode = 'wall'; origin = t; mode = 'project';
  if (RM) {
    fl.el.remove(); t.hide = 1; showProject(); gsap.from(pj, { opacity: 0, duration: 0.4 });
    wallVisible(false); busy = false; focusIn(); return;
  }
  dimTo(0, 0.9);
  gsap.to(W, { zoomMul: 0.93, duration: 1.2, ease: 'power3.inOut' });
  const tl = gsap.timeline({ defaults: { duration: 1.15, ease: 'expo.inOut' } });
  tl.to(fl.el, { left: 0, top: 0, width: VW, height: VH }, 0)
    .to(fl.media, { x: 0, y: 0, scale: 1, filter: GRADE_OFF }, 0)
    .add(() => {
      showProject(); heroIn();
      const finish = () => { if (t.img.video && t.video) { fl.el.remove(); } else fl.el.remove(); wallVisible(false); busy = false; focusIn(); };
      if (t.img.video) {
        const hv = $('.pj-hero-media video');
        if (hv && t.video) { try { hv.currentTime = t.video.currentTime % (hv.duration || 1e9); } catch (_) {} }
        gsap.to(fl.el, { opacity: 0, duration: 0.6, delay: 0.35, onComplete: finish });
      } else requestAnimationFrame(finish);
    });
}
function openProject(p, fromEl) {
  // from the menu or the a11y list
  if (busy) return;
  busy = true;
  route(p.url, p.name);
  const heroKey = p.hero, img = IM[heroKey];
  prevMode = mode === 'project' ? prevMode : mode;
  origin = null;
  const r = fromEl ? fromEl.getBoundingClientRect() : null;
  const go = () => {
    renderProject(p, heroKey);
    mode = 'project';
    if (RM || !r || !r.width) {
      showProject(); heroIn(); gsap.fromTo(pj, { opacity: 0 }, { opacity: 1, duration: 0.5 });
      wallVisible(false); busy = false; focusIn(); return;
    }
    const fl = makeFlyer(img, { x: r.left, y: r.top, w: r.width, h: r.height });
    gsap.timeline({ defaults: { duration: 1.1, ease: 'expo.inOut' } })
      .to(fl.el, { left: 0, top: 0, width: VW, height: VH }, 0)
      .add(() => { showProject(); heroIn(); requestAnimationFrame(() => fl.el.remove()); wallVisible(false); busy = false; focusIn(); });
  };
  preload(img.mid).then(go);
}
function closeProject() {
  if (busy || mode !== 'project') return;
  busy = true;
  route(ROOT + '/');
  if (!tilesStarted) loadTiles();
  wallVisible(true);
  $('.bar').classList.remove('is-hidden');
  const scrolled = pjScroll.scrollTop > 30;
  // opened from the menu: the menu is still open underneath, so go back to it
  const back = prevMode === 'menu' && menu.classList.contains('on') ? 'menu' : 'wall';
  const t = back === 'wall' && origin && origin.k === pjHeroKey && !scrolled && !RM ? origin : null;
  if (pjLenis) pjLenis.stop();
  const end = () => {
    pj.classList.remove('on', 'shade'); gsap.set(pj, { opacity: 0 });
    $$('.pj video').forEach((v) => v.pause());
    setInert(false); $('.bar').classList.remove('is-hidden');
    mode = back; busy = false; lastInput = performance.now();
    if (back === 'menu') { $('#main').inert = true; $('.foot').inert = true; const b = $(`.menu-pj[data-p="${pjCur.id}"]`); if (b) focusSoft(b); }
  };
  if (back === 'menu') {
    gsap.to(pj, { opacity: 0, duration: 0.6, ease: 'power2.inOut', onComplete: end });
    return;
  }
  dimTo(titleUp ? TD : 1, 1.1);
  gsap.to(W, { zoomMul: 1, duration: 1.15, ease: 'expo.inOut' });
  if (!t) {
    if (origin) origin.hide = 1;
    gsap.to(pj, { opacity: 0, duration: 0.7, ease: 'power2.inOut', onComplete: end });
    return;
  }
  // FLIP back into the tile, which has not moved
  const img = IM[t.k];
  const heroHi = $('.pj-hero-media .hi.on');
  const fl = img.video && t.video ? makeFlyer(img, { x: 0, y: 0, w: VW, h: VH }, { video: t.video })
                                  : makeFlyer(img, { x: 0, y: 0, w: VW, h: VH }, { focus: t.focus, src: heroHi ? img.full : img.mid });
  if (t.video) t.video.play().catch(() => {});
  gsap.set(fl.media, { filter: GRADE_OFF, scale: 1, x: 0, y: 0 });
  pj.classList.remove('on', 'shade'); gsap.set(pj, { opacity: 0 });
  t.hov = 0;
  const k = 1 - 0.075 * cam.bend;
  const rect = tileRect(t, k, 0);
  const inner = innerFrom(t, rect);
  gsap.timeline({ defaults: { duration: 1.05, ease: 'expo.inOut' } })
    .to(fl.el, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }, 0)
    .to(fl.media, { ...inner, filter: gradeOn() }, 0)
    .add(() => {
      t.hide = 1;
      requestAnimationFrame(() => { fl.el.remove(); });
      end();
      const s = $('.wall-a11y a'); if (document.activeElement === document.body && s) s.blur();
    });
}
function focusIn() { focusSoft($('.pj-close')); }
$('.pj-close').addEventListener('click', closeProject);
$('.pj-mark').addEventListener('click', (e) => { e.preventDefault(); closeProject(); });
grid.addEventListener('click', (e) => {
  const b = e.target.closest('.pj-zoom');
  if (b && pjCur) lbOpen(+b.dataset.i, b);
});

/* =========================================================================
   Viewer: a project's images full screen. Swipe (or the arrow keys) between
   them; pinch or double-tap to zoom (click, with a mouse); swipe down, Close,
   Escape or the phone's back button to leave.
   ========================================================================= */
const lb = {
  el: $('.lb'), bg: $('.lb-bg'), track: $('.lb-track'), ui: $('.lb-ui'),
  count: $('.lb-count'), cap: $('.lb-cap'), prev: $('.lb-prev'), next: $('.lb-next'),
  open: false, closing: false, keys: null, slides: [], i: 0, x: 0,
  z: { s: 1, x: 0, y: 0 },   // zoom of the current image: scale and offset from the centre
  pushed: false, skipPop: false,
};
const LB_ZOOM = 2.5, LB_MAX = 4;
const abs = (u) => new URL(u, location.href).href;

// size of an image fitted to the screen (on desktop, leaving room for the arrows and caption)
function lbFit(k) {
  const im = IM[k], mx = FINE ? 96 : 0, my = FINE ? 76 : 0;
  const s = Math.min((VW - 2 * mx) / im.w, (VH - 2 * my) / im.h);
  return { w: Math.round(im.w * s), h: Math.round(im.h * s) };
}
function lbSrc(j) {
  const k = lb.keys[j], im = IM[k];
  const sharp = (j === lb.i && lb.z.s > 1.3) || lbFit(k).w * (devicePixelRatio || 1) > im.lw * 1.1;
  return abs(sharp ? im.full : im.lg);
}
function lbBuild(keys) {
  lb.keys = keys; lb.track.textContent = '';
  lb.slides = keys.map((k) => {
    const im = IM[k], s = document.createElement('div');
    s.className = 'lb-s';
    let m;
    if (im.video) {
      m = document.createElement('video');
      m.muted = true; m.loop = true; m.playsInline = true; m.setAttribute('playsinline', ''); m.poster = im.mid; m.preload = 'none';
    } else { m = new Image(); m.alt = im.alt; m.decoding = 'async'; m.draggable = false; }
    s.append(m); lb.track.append(s);
    return { k, m, src: '' };
  });
}
function lbLayout() {
  for (const sl of lb.slides) { const f = lbFit(sl.k); sl.m.style.width = f.w + 'px'; sl.m.style.height = f.h + 'px'; }
  gsap.set(lb.track, { x: -lb.i * VW + lb.x });
}
function lbLoad(j) {
  const sl = lb.slides[j]; if (!sl) return;
  const im = IM[sl.k];
  if (im.video) { if (!sl.src) sl.m.src = sl.src = im.video; return; }
  const want = lbSrc(j);
  if (sl.src === want || sl.src === abs(im.full)) return;
  if (!sl.src) { sl.m.src = sl.src = want; return; }
  // a sharper copy: swap it in once loaded, so the picture never blanks
  sl.src = want;
  preload(want).then(() => { if (sl.src === want) sl.m.src = want; });
}
function lbShow(j, animate) {
  j = clamp(j, 0, lb.slides.length - 1);
  if (j !== lb.i) { lbZoom(1, 0, 0, false); lb.z = { s: 1, x: 0, y: 0 }; }
  lb.i = j; lb.x = 0;
  if (animate && !RM) gsap.to(lb.track, { x: -j * VW, duration: 0.55, ease: 'power3.out', overwrite: true });
  else gsap.set(lb.track, { x: -j * VW });
  const n = lb.slides.length;
  lb.count.textContent = `${String(j + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  lb.cap.textContent = IM[lb.keys[j]].cap;
  lb.prev.disabled = j === 0; lb.next.disabled = j === n - 1;
  for (const d of [0, 1, -1, 2]) lbLoad(j + d);
  lb.slides.forEach((sl, k) => { if (sl.m.tagName === 'VIDEO') { if (k === j && lb.open) sl.m.play().catch(() => {}); else sl.m.pause(); } });
}
// zoom the current image to scale s with offset (x, y), kept inside the screen
function lbZoom(s, x, y, animate) {
  const sl = lb.slides[lb.i];
  if (!sl || sl.m.tagName !== 'IMG') return;
  const f = lbFit(sl.k);
  s = clamp(s, 1, LB_MAX);
  const bx = Math.max(0, (f.w * s - VW) / 2), by = Math.max(0, (f.h * s - VH) / 2);
  lb.z = { s, x: clamp(x, -bx, bx), y: clamp(y, -by, by) };
  if (animate && !RM) gsap.to(sl.m, { x: lb.z.x, y: lb.z.y, scale: s, duration: 0.45, ease: 'power3.out', overwrite: true });
  else gsap.set(sl.m, { x: lb.z.x, y: lb.z.y, scale: s });
  lb.el.classList.toggle('zoomed', s > 1.01);
  if (s > 1.3) lbLoad(lb.i);
}
// zoom to s keeping the point (px, py) of the screen where it is
function lbZoomAt(s, px, py, animate) {
  const cx = VW / 2, cy = VH / 2, r = clamp(s, 1, LB_MAX) / lb.z.s;
  lbZoom(s, px - cx - (px - cx - lb.z.x) * r, py - cy - (py - cy - lb.z.y) * r, animate);
}
function lbOpen(j, btn) {
  if (lb.open || lb.closing || !pjCur) return;
  if (lb.keys !== pjCur.seq) lbBuild(pjCur.seq);
  lb.i = j; lb.x = 0; lb.z = { s: 1, x: 0, y: 0 };
  lbLayout();
  // start from the copy already on screen, so the picture is there at once
  const sl = lb.slides[j], gi = btn && btn.querySelector('img');
  if (gi && gi.complete && gi.currentSrc && !sl.src) { sl.m.src = gi.currentSrc; sl.src = gi.currentSrc; }
  lb.open = true;
  lbShow(j, false);
  lb.el.classList.add('on');
  pj.inert = true;
  if (pjLenis) pjLenis.stop();
  history.pushState({ viewer: true }, '', location.href); lb.pushed = true;
  const r = btn ? btn.getBoundingClientRect() : null, f = lbFit(sl.k);
  const ready = () => focusSoft($('.lb-close'));
  if (RM || !r || !r.width) { gsap.set([lb.bg, lb.ui], { opacity: 1 }); ready(); return; }
  // grow out of the picture that was tapped
  gsap.set([lb.bg, lb.ui], { opacity: 0 });
  gsap.fromTo(sl.m, { x: r.left + r.width / 2 - VW / 2, y: r.top + r.height / 2 - VH / 2, scale: r.width / f.w },
    { x: 0, y: 0, scale: 1, duration: 0.7, ease: 'expo.out', onComplete: ready });
  gsap.to(lb.bg, { opacity: 1, duration: 0.45, ease: 'power2.out' });
  gsap.to(lb.ui, { opacity: 1, duration: 0.5, delay: 0.25 });
}
function lbClose(fromHistory) {
  if (!lb.open) return;
  lb.open = false; lb.closing = true;
  if (lb.pushed && !fromHistory) { lb.skipPop = true; history.back(); }
  lb.pushed = false;
  const sl = lb.slides[lb.i], f = lbFit(sl.k);
  gsap.killTweensOf([sl.m, lb.bg, lb.ui, lb.track]);
  gsap.set(lb.track, { x: -lb.i * VW }); lb.x = 0;
  lb.el.classList.remove('zoomed');
  // bring this picture into view behind the viewer, then shrink back into it
  const btn = grid.querySelector(`.pj-zoom[data-i="${lb.i}"]`);
  let r = btn && btn.getBoundingClientRect();
  if (r && (r.bottom < 0 || r.top > VH)) {
    const y = pjScroll.scrollTop + r.top - (VH - r.height) / 2;
    if (pjLenis) pjLenis.scrollTo(y, { immediate: true, force: true }); else pjScroll.scrollTop = y;
    r = btn.getBoundingClientRect();
  }
  const end = () => {
    lb.el.classList.remove('on'); lb.closing = false;
    gsap.set(sl.m, { x: 0, y: 0, scale: 1, opacity: 1 }); lb.z = { s: 1, x: 0, y: 0 };
    for (const s of lb.slides) if (s.m.tagName === 'VIDEO') s.m.pause();
    pj.inert = false;
    if (pjLenis) pjLenis.start();
    if (btn) focusSoft(btn);
  };
  gsap.to(lb.ui, { opacity: 0, duration: 0.25 });
  if (RM || !r || !r.width) {
    gsap.to([lb.bg, sl.m], { opacity: 0, duration: RM ? 0 : 0.3, onComplete: end });
    return;
  }
  gsap.to(sl.m, { x: r.left + r.width / 2 - VW / 2, y: r.top + r.height / 2 - VH / 2, scale: r.width / f.w, duration: 0.6, ease: 'expo.inOut', onComplete: end });
  gsap.to(lb.bg, { opacity: 0, duration: 0.5, ease: 'power2.inOut', delay: 0.1 });
}
$('.lb-close').addEventListener('click', () => lbClose());
lb.prev.addEventListener('click', () => lbShow(lb.i - 1, true));
lb.next.addEventListener('click', () => lbShow(lb.i + 1, true));
addEventListener('popstate', () => {
  if (lb.skipPop) { lb.skipPop = false; return; }
  if (lb.open) lbClose(true);
});

// gestures: one finger swipes (or pans a zoomed image, or drags down to close); two fingers pinch
const lbPtr = new Map();
let lbG = null, lastTap = { t: 0, x: 0, y: 0 };
lb.el.addEventListener('pointerdown', (e) => {
  if (!lb.open || e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
  lbPtr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { lb.el.setPointerCapture(e.pointerId); } catch (_) {}
  const now = performance.now();
  if (lbPtr.size === 1) {
    lbG = { kind: null, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: now, t: now, vx: 0, vy: 0, zx: lb.z.x, zy: lb.z.y };
  } else if (lbPtr.size === 2) {
    const [a, b] = [...lbPtr.values()];
    lbG = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: lb.z.s, m0: [(a.x + b.x) / 2, (a.y + b.y) / 2], z0: { ...lb.z } };
    lb.x = 0; gsap.to(lb.track, { x: -lb.i * VW, duration: 0.3, overwrite: true });
  }
});
lb.el.addEventListener('pointermove', (e) => {
  if (!lbG || !lbPtr.has(e.pointerId)) return;
  lbPtr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (lbG.kind === 'pinch') {
    if (lbPtr.size < 2) return;
    const [a, b] = [...lbPtr.values()], g = lbG;
    const s = clamp((g.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0, 1, LB_MAX);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, cx = VW / 2, cy = VH / 2, r = s / g.s0;
    // the point that was between the fingers stays between them
    lbZoom(s, mx - cx - (g.m0[0] - cx - g.z0.x) * r, my - cy - (g.m0[1] - cy - g.z0.y) * r, false);
    return;
  }
  const g = lbG, now = performance.now(), dt = Math.max(1, now - g.t);
  g.vx = lerp(g.vx, (e.clientX - g.lx) / dt, 0.4); g.vy = lerp(g.vy, (e.clientY - g.ly) / dt, 0.4);
  g.lx = e.clientX; g.ly = e.clientY; g.t = now;
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
  if (!g.kind) {
    if (Math.hypot(dx, dy) < 8) return;
    g.kind = lb.z.s > 1.01 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'swipe' : dy > 0 ? 'dismiss' : 'none';
  }
  if (g.kind === 'pan') lbZoom(lb.z.s, g.zx + dx, g.zy + dy, false);
  else if (g.kind === 'swipe') {
    const edge = (lb.i === 0 && dx > 0) || (lb.i === lb.slides.length - 1 && dx < 0);
    lb.x = edge ? dx * 0.3 : dx;
    gsap.set(lb.track, { x: -lb.i * VW + lb.x });
  } else if (g.kind === 'dismiss') {
    const d = Math.max(0, dy);
    gsap.set(lb.slides[lb.i].m, { y: d, scale: 1 - Math.min(0.2, d / 1800) });
    gsap.set([lb.bg, lb.ui], { opacity: 1 - Math.min(0.85, d / 380) });
  }
});
function lbUp(e) {
  if (!lbPtr.has(e.pointerId)) return;
  lbPtr.delete(e.pointerId);
  const g = lbG;
  if (!g) return;
  if (g.kind === 'pinch') {
    // with one finger still down, wait for it to lift
    if (!lbPtr.size) { if (lb.z.s < 1.05) lbZoom(1, 0, 0, true); lbG = null; }
    return;
  }
  lbG = null;
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0, cancel = e.type === 'pointercancel';
  if (g.kind === 'swipe') {
    const step = !cancel && (Math.abs(dx) > VW * 0.18 || Math.abs(g.vx) > 0.45) ? (dx < 0 ? 1 : -1) : 0;
    lbShow(lb.i + step, true);
  } else if (g.kind === 'dismiss') {
    if (!cancel && (dy > 110 || g.vy > 0.6)) lbClose();
    else {
      gsap.to(lb.slides[lb.i].m, { y: 0, scale: 1, duration: 0.35, ease: 'power3.out' });
      gsap.to([lb.bg, lb.ui], { opacity: 1, duration: 0.3 });
    }
  } else if (!g.kind && !cancel && performance.now() - g.t0 < 350) lbTap(e);
}
lb.el.addEventListener('pointerup', lbUp);
lb.el.addEventListener('pointercancel', lbUp);
function lbTap(e) {
  const r = lb.slides[lb.i].m.getBoundingClientRect();
  const onImage = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (e.pointerType === 'mouse') {
    // click: zoom in at that point, or out again; a click beside the picture closes
    if (!onImage && lb.z.s <= 1.01) lbClose();
    else lbZoomAt(lb.z.s > 1.01 ? 1 : LB_ZOOM, e.clientX, e.clientY, true);
    return;
  }
  // touch: a double tap zooms in at that point, or out again
  const now = performance.now();
  if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
    lastTap.t = 0;
    lbZoomAt(lb.z.s > 1.01 ? 1 : LB_ZOOM, e.clientX, e.clientY, true);
  } else lastTap = { t: now, x: e.clientX, y: e.clientY };
}
let lbWheelT = 0;
lb.el.addEventListener('wheel', (e) => {
  if (!lb.open) return;
  e.preventDefault();
  if (e.ctrlKey) { lbZoomAt(lb.z.s * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY, false); return; }   // trackpad pinch
  if (lb.z.s > 1.01) { lbZoom(lb.z.s, lb.z.x - e.deltaX, lb.z.y - e.deltaY, false); return; }
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY, now = performance.now();
  if (Math.abs(d) > 24 && now - lbWheelT > 450) { lbWheelT = now; lbShow(lb.i + (d > 0 ? 1 : -1), true); }
}, { passive: false });

/* =========================================================================
   Menu: a panel from the right with About, Projects (grouped by category),
   Contact and Careers
   ========================================================================= */
const menu = $('.menu'), menuPanel = $('.menu-panel'), menuScrim = $('.menu-scrim'), itog = $('.itog');
const pBtn = $('.menu-pbtn'), pBox = $('.menu-projects');
gsap.set(menuPanel, { xPercent: 100 });   // waits off to the right
function setProjects(open, instant) {
  pBtn.setAttribute('aria-expanded', String(open));
  menu.classList.toggle('pj-open', open);
  gsap.killTweensOf(pBox);
  if (open) {
    pBox.hidden = false;
    if (RM || instant) { gsap.set(pBox, { height: 'auto' }); return; }
    gsap.fromTo(pBox, { height: 0 }, { height: 'auto', duration: 0.8, ease: 'expo.out' });
    gsap.fromTo($$('.menu-cat-h, .menu-pj', pBox), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.035, delay: 0.08 });
  } else if (RM || instant) { gsap.set(pBox, { height: 0 }); pBox.hidden = true; }
  else gsap.to(pBox, { height: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { pBox.hidden = true; } });
}
pBtn.addEventListener('click', () => setProjects(pBtn.getAttribute('aria-expanded') !== 'true'));
function openMenu() {
  if (mode !== 'wall' || busy) return;
  mode = 'menu'; hovered = null; cursor.state(null);
  shrinkTitle();
  itog.setAttribute('aria-expanded', 'true');
  $('.bar').classList.add('menu-open');
  $('#main').inert = true; $('.foot').inert = true;
  menu.classList.add('on');
  $('.menu-scroll').scrollTop = 0;
  $('.hint').classList.add('is-gone');
  dimTo(MENU_DIM, 0.7);
  gsap.to(W, { zoomMul: 0.965, duration: 1.1, ease: 'expo.out', overwrite: 'auto' });
  if (RM) { gsap.set(menuPanel, { xPercent: 0 }); gsap.set(menuScrim, { opacity: 1 }); }
  else {
    gsap.fromTo(menuPanel, { xPercent: 100 }, { xPercent: 0, duration: 0.9, ease: 'expo.out', overwrite: true });
    gsap.to(menuScrim, { opacity: 1, duration: 0.6, ease: 'power2.out', overwrite: true });
    gsap.fromTo($$('.menu-list > li, .menu-foot', menu), { opacity: 0, x: 36 }, { opacity: 1, x: 0, duration: 1, ease: 'expo.out', stagger: 0.05, delay: 0.12, overwrite: true });
  }
  focusSoft($('.menu-a', menu));
}
function closeMenu(quiet) {
  if (mode !== 'menu' || busy) return;
  mode = 'wall';
  itog.setAttribute('aria-expanded', 'false');
  $('.bar').classList.remove('menu-open');
  $('#main').inert = false; $('.foot').inert = false;
  dimTo(wallDim(), 0.9);
  gsap.to(W, { zoomMul: 1, duration: 1.1, ease: 'expo.out', overwrite: 'auto' });
  const done = () => { menu.classList.remove('on'); setProjects(false, true); };
  if (RM) done();
  else {
    gsap.to(menuPanel, { xPercent: 100, duration: 0.6, ease: 'power3.inOut', overwrite: true, onComplete: done });
    gsap.to(menuScrim, { opacity: 0, duration: 0.5, ease: 'power2.inOut', overwrite: true });
  }
  lastInput = performance.now();
  if (!quiet) focusSoft(itog);
}
itog.addEventListener('click', () => {
  if (panel) closePanel();
  if (mode === 'menu') closeMenu(); else if (mode === 'wall') openMenu();
});
menuScrim.addEventListener('click', () => closeMenu());
$$('.menu-pj').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  if (mode === 'menu') openProject(PBY[a.dataset.p], $('.menu-th', a));
}));

/* =========================================================================
   About / Contact / Careers panels
   ========================================================================= */
const PANELS = { about: 'About', contact: 'Contact', careers: 'Careers' };
const lenisP = {};
const navBtns = $$('.nav a');
function setNav(id) { navBtns.forEach((b) => b.toggleAttribute('aria-current', b.dataset.go === id)); navBtns.forEach((b) => { if (b.dataset.go === id) b.setAttribute('aria-current', 'page'); }); }
let panelOpener = null;
function openPanel(id, quiet) {
  if (mode === 'project' || mode === 'intro' || !PANELS[id]) return;
  if (panel === id) return;
  const prev = panel;
  if (prev) { const pe = $('#' + prev); pe.classList.remove('on'); gsap.set(pe, { opacity: 0 }); if (lenisP[prev]) lenisP[prev].stop(); }
  else panelOpener = mode === 'menu' ? itog : document.activeElement;
  if (mode === 'menu') closeMenu(true);
  panel = id; setNav(id);
  route(ROOT + `/${id}/`, PANELS[id]);
  shrinkTitle();
  const el = $('#' + id);
  el.classList.add('on');
  $('#main').inert = true; $('.foot').inert = true;
  $('.foot').classList.add('is-hidden');
  $('.panel-scroll', el).scrollTop = 0;
  if (Lenis && !RM) {
    if (!lenisP[id]) lenisP[id] = new Lenis({ wrapper: $('.panel-scroll', el), content: $('.panel-in', el), lerp: 0.09, smoothWheel: true });
    lenisP[id].scrollTo(0, { immediate: true }); lenisP[id].start();
  }
  dimTo(0.3, 0.9, 'power2.out');
  hovered = null; cursor.state(null);
  if (RM || quiet) gsap.set(el, { opacity: 1 });
  else {
    gsap.to(el, { opacity: 1, duration: prev ? 0.35 : 0.7, ease: 'power2.out' });
    gsap.fromTo($$('[data-rise]', el), { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.07, delay: prev ? 0.05 : 0.2, clearProps: 'transform' });
  }
  if (!quiet) focusSoft($('.panel-close', el));
}
function closePanel() {
  if (!panel) return;
  const el = $('#' + panel), id = panel;
  panel = null; setNav('work');
  route(ROOT + '/');
  if (lenisP[id]) lenisP[id].stop();
  $('#main').inert = false; $('.foot').inert = false;
  if (VW >= 700 || titleUp) $('.foot').classList.remove('is-hidden');
  dimTo(wallDim(), 1);
  gsap.to(el, { opacity: 0, duration: RM ? 0 : 0.55, ease: 'power2.inOut', onComplete: () => el.classList.remove('on') });
  lastInput = performance.now();
  if (panelOpener && panelOpener.focus) focusSoft(panelOpener);
  panelOpener = null;
}
$$('.panel-close').forEach((b) => b.addEventListener('click', closePanel));
$$('[data-go]').forEach((b) => b.addEventListener('click', (e) => {
  e.preventDefault();
  const go = b.dataset.go;
  if (go === 'work') { closePanel(); if (mode === 'menu') closeMenu(); return; }
  openPanel(go);
}));
$('.brand').addEventListener('click', (e) => {
  e.preventDefault();
  if (panel) closePanel();
  if (mode === 'menu') closeMenu();
  showTitle();
});
$('.ct-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (!f.name.value.trim() || !/.+@.+\..+/.test(f.email.value)) {
    const bad = !f.name.value.trim() ? f.name : f.email;
    bad.focus(); bad.style.borderColor = 'var(--accent)';
    setTimeout(() => (bad.style.borderColor = ''), 1600);
    return;
  }
  const done = () => {
    f.hidden = true;
    const th = $('.thanks'); th.hidden = false; th.focus({ preventScroll: true });
    if (!RM) gsap.from(th, { opacity: 0, y: 24, duration: 1, ease: 'expo.out' });
  };
  if (!DATA.form) { done(); return; }
  const send = $('.send', f), err = $('.form-err', f);
  send.disabled = true; err.hidden = true;
  try {
    const r = await fetch(DATA.form, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    done();
  } catch (_) {
    err.hidden = false;
  } finally {
    send.disabled = false;
  }
});
function escape() {
  if (lb.open) lbClose();
  else if (mode === 'project') closeProject();
  else if (panel) closePanel();
  else if (mode === 'menu') closeMenu();
}

/* =========================================================================
   Accessible list of projects on the wall
   ========================================================================= */
$$('.wall-a11y a').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  if (mode === 'wall') openProject(PBY[a.dataset.p], null);
}));

/* =========================================================================
   Addresses: /, /work/<project>/, /about/, /contact/, /careers/
   (under the folder the site is published in, if any: see src/lib/url.ts)
   ========================================================================= */
const ROOT = import.meta.env.BASE_URL.replace(/\/$/, '');
let popping = false;
const norm = (path) => path.replace(/\/?$/, '/');
function route(path, name) {
  document.title = name ? `${name} — ${DATA.name}` : DATA.home;
  if (popping || norm(location.pathname) === path) return;
  history.pushState(null, '', path);
}
function fromURL() {
  if (busy || mode === 'intro') { setTimeout(fromURL, 150); return; }
  const here = norm(location.pathname);
  const m = (here.startsWith(ROOT + '/') ? here.slice(ROOT.length) : here).match(/^\/(?:work\/([^/]+)|(about|contact|careers))\/$/);
  const p = m && m[1] ? PBY[m[1]] : null, id = m && m[2];
  popping = true;
  try {
    if (p) {
      if (panel) closePanel();
      if (mode !== 'project') openProject(p, null);
      else if (pjCur !== p) { renderProject(p, p.hero); heroIn(); document.title = `${p.name} — ${DATA.name}`; }
    } else if (id) {
      if (mode === 'project') { closeProject(); setTimeout(fromURL, 150); }
      else openPanel(id);
    } else if (mode === 'project') closeProject();
    else if (panel) closePanel();
  } finally {
    popping = false;
  }
}

/* =========================================================================
   Light / dark: the half-filled circle in the top bar. Dark is the default;
   the choice is kept in this browser, and the script in Base.astro's <head>
   applies it before the page paints.
   ========================================================================= */
const themeBtn = $('.theme');
const isLight = () => html.dataset.theme === 'light';
function themeUI() {
  const light = isLight();
  themeBtn.setAttribute('aria-pressed', String(light));
  themeBtn.title = light ? 'Dark mode' : 'Light mode';
  $('meta[name="theme-color"]').content = cssVar('--bg');
  $('meta[name="color-scheme"]').content = light ? 'light' : 'dark';
}
function setTheme(light) {
  const apply = () => {
    if (light) html.dataset.theme = 'light'; else delete html.dataset.theme;
    try { localStorage.setItem('vistaraa-theme', light ? 'light' : 'dark'); } catch (_) {}
    themeUI();
    for (const t of TILES) if (t.cv) drawLogo(t);
    if (R) R.colors();
  };
  // a soft crossfade where the browser supports it; elsewhere the colours simply change
  if (document.startViewTransition && !RM) document.startViewTransition(apply);
  else apply();
}
themeBtn.addEventListener('click', () => setTheme(!isLight()));
themeUI();

/* =========================================================================
   Boot: preloader → fly-out
   ========================================================================= */
const loader = $('.loader');
async function boot() {
  const T0 = performance.now();
  if (loader) {
    const line0 = $('.mk-line', loader);
    line0.style.strokeDasharray = 2600; line0.style.strokeDashoffset = 2600;
    if (!RM) {
      gsap.to(line0, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' });
      gsap.to($('.mk-fill', loader), { opacity: 1, duration: 0.7, delay: 1.15, ease: 'power1.out' });
      gsap.to(line0, { opacity: 0, duration: 0.5, delay: 1.5 });
    }
  }
  layout(); homeCam();
  for (const t of TILES) place(t);
  // renderer
  if (!Q.has('dom')) R = makeGL($('.gl'));
  if (!R) R = makeDOM($('.dom-wall'));
  for (const t of TILES) R.add(t);
  R.colors();
  if (R.warm) R.warm();
  // arriving on a project page: let its own images load first
  if (START_KIND === 'project') setTimeout(loadTiles, 2000); else loadTiles();

  // stage events
  const st = stage();
  st.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKey);
  st.addEventListener('pointerenter', () => { pointer.in = true; if (FINE) cursor.el.classList.add('on'); });
  st.addEventListener('pointerleave', () => { pointer.in = false; hovered = null; cursor.el.classList.remove('on'); });
  if (!FINE) {
    cursor.el.style.display = 'none';
    $('.hint').lastChild.textContent = 'Swipe to explore';
  }
  // the photo at the top has gone under the bar: the bar's shade and colours change (see .pj-top)
  pjScroll.addEventListener('scroll', () => pj.classList.toggle('past', pjScroll.scrollTop > VH - 70), { passive: true });
  addEventListener('resize', onResize);
  addEventListener('popstate', fromURL);
  document.addEventListener('visibilitychange', () => { if (document.hidden) TILES.forEach((t) => t.video && t.video.pause()); });

  requestAnimationFrame(tick);

  const fonts = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1800))]);
  if (!loader) return arrive();

  // preloader: mark draws itself, a line fills as the first images arrive; ≤ 2.4 s
  const fill = $('.loader-bar i', loader);
  const t0 = T0;
  const c = { v: 0 };
  const need = Math.min(14, TILES.filter((t) => Math.abs(t.dx) < VW * 0.7 && Math.abs(t.dy) < VH * 0.7).length);
  if (RM) { loader.remove(); await fonts; return intro(); }
  await new Promise((res) => {
    const step = () => {
      const el = performance.now() - t0;
      const lf = need ? Math.min(1, loadedCount / need) : 1;
      const tf = Math.min(1, el / 1500);
      const target = el > 2150 ? 1 : Math.min(tf, 0.15 + lf * 0.85);
      c.v = lerp(c.v, target, 0.12);
      fill.style.transform = `scaleX(${c.v.toFixed(4)})`;
      if ((c.v > 0.995 && el > 1500) || el > 2250) { fill.style.transform = 'none'; res(); } else requestAnimationFrame(step);
    };
    step();
  });
  await fonts;
  gsap.to(loader, { opacity: 0, duration: 0.55, ease: 'power2.inOut', onComplete: () => loader.remove() });
  intro();
}
// Opened on /work/…, /about/, /contact/ or /careers/: no preloader, and the logo is already in its corner.
function arrive() {
  titleUp = false; W.dim = 1;
  if (VW < 700) $('.foot').classList.add('is-hidden');
  logoDone();
  const p = START_KIND === 'project' && PBY[START_ID];
  if (p) {
    TILES.forEach((t) => (t.e = 1));
    pjCur = p; pjHeroKey = p.hero; prevMode = 'wall'; mode = 'project';
    showProject(); wallVisible(false);
    return;
  }
  mode = 'wall'; lastInput = performance.now();
  const ds = TILES.map((t) => Math.hypot(t.dx, t.dy));
  const max = Math.max(...ds) || 1;
  if (RM) TILES.forEach((t) => (t.e = 1));
  else TILES.forEach((t, i) => gsap.to(t, { e: 1, duration: 1.7, ease: 'expo.out', delay: 0.05 + Math.pow(ds[i] / max, 0.8) * 0.75 }));
  if (START_KIND === 'panel' && PANELS[START_ID]) openPanel(START_ID, true);
}
function intro() {
  const ds = TILES.map((t) => Math.hypot(t.dx, t.dy));
  const max = Math.max(...ds) || 1;
  if (RM) {
    TILES.forEach((t) => (t.e = 1));
    gsap.from('.hero-in', { opacity: 0, duration: 0.6 });
  } else {
    TILES.forEach((t, i) => gsap.to(t, { e: 1, duration: 1.7, ease: 'expo.out', delay: 0.05 + Math.pow(ds[i] / max, 0.8) * 0.75 }));
    gsap.fromTo(W, { zoomMul: 0.9 }, { zoomMul: 1, duration: 2.6, ease: 'expo.out', delay: 0.1 });
    titleIntro = gsap.fromTo(titleChars, { yPercent: 108 }, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.04, delay: 0.45 });
    gsap.fromTo('.hero-line span', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 1.05 });
    gsap.fromTo('.bar', { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 0.9, clearProps: 'opacity' });
    gsap.fromTo('.foot', { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 1.3, clearProps: 'opacity' });
  }
  setTimeout(() => { mode = 'wall'; lastInput = performance.now() - 1200; }, RM ? 0 : 900);
}

/* =========================================================================
   Loop + resize
   ========================================================================= */
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
  if (pjLenis && mode === 'project') pjLenis.raf(now);
  if (panel && lenisP[panel]) lenisP[panel].raf(now);
  if (FINE) cursor.update(dt);
  if (renderOn && R) wallUpdate(dt, now);
}
function onResize() {
  VW = innerWidth; VH = innerHeight;
  document.documentElement.style.setProperty('--vh', VH + 'px');
  const old = layout();
  const f = G.s / old;
  cam.x *= f; cam.y *= f; cam.tx *= f; cam.ty *= f;
  if (R) R.resize();
  if (lb.slides.length) { lbLayout(); if (lb.open) lbZoom(1, 0, 0, false); }
}

// small hook used by automated checks
window.__dbg = {
  get kind() { return R && R.kind; },
  centerTile() {
    let best = null, bd = 1e9;
    for (const t of TILES) {
      if (!t.vis) continue;
      const r = tileRect(t);
      if (r.x < 8 || r.y < 70 || r.x + r.w > VW - 8 || r.y + r.h > VH - 40) continue;
      const d = Math.hypot(r.x + r.w / 2 - VW / 2, r.y + r.h / 2 - VH / 2);
      if (d < bd) { bd = d; best = r; }
    }
    return best ? [best.x + best.w / 2, best.y + best.h / 2] : [VW / 2, VH / 2];
  },
  get viewer() { return { open: lb.open, i: lb.i, n: lb.slides.length, zoom: +lb.z.s.toFixed(2), src: lb.open ? lb.slides[lb.i].m.currentSrc : '' }; },
  tile(k) { const t = TILES.find((x) => x.k === k && x.vis); if (!t) return null; const r = tileRect(t); return [r.x + r.w / 2, r.y + r.h / 2]; },
  probe(x, y) {
    const shown = TILES.filter((t) => { if (!t.vis) return false; const r = tileRect(t); return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }).map((t) => t.k);
    const h = hitTest(x, y);
    return { shown, hit: h ? h.k : null, mode, zoom: +cam.zoom.toFixed(3) };
  },
};
boot();
