// გამარჯვების სახლი — ინტერაქტიული 3D სანახავი
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildModel } from './model.js';
import { DIMENSIONS, ROOMS, STATUS_LABEL, H } from './config.js';

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const canvas = $('#c');
const coarse = matchMedia('(pointer: coarse)').matches;
const M = 0.001;

// ------------------------------------------------------------------ რენდერერი
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const labelRenderer = new CSS2DRenderer({ element: $('#labels') });

const scene = new THREE.Scene();
scene.background = new THREE.Color('#eceae6');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

// ------------------------------------------------------------------ მოდელი
const { root, groups } = buildModel();
scene.add(root);

const bbox = new THREE.Box3().setFromObject(root);
const center = bbox.getCenter(new THREE.Vector3());
const size = bbox.getSize(new THREE.Vector3());
const houseCenter = new THREE.Vector3(8.15, 0, 3.75); // სახლის კორპუსის ცენტრი (16.3 × 7.5 მ)
const homeTarget = new THREE.Vector3(center.x, 0.5, center.z);
const DIM_PAD = 2.2;
function fitCorners() {
  const p = dims.visible ? DIM_PAD : 0.3;
  const out = [];
  for (const x of [bbox.min.x - p, bbox.max.x + p]) for (const y of [bbox.min.y, groups.ceiling.visible ? bbox.max.y : H.ceiling * M]) for (const z of [bbox.min.z - p, bbox.max.z + p]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

// ------------------------------------------------------------------ მიწა და განათება (GLB-ში არ შედის)
const helpers = new THREE.Group();
helpers.name = 'helpers';
scene.add(helpers);
{
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: '#e3e0da', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, H.ground * M - 0.002, center.z);
  ground.receiveShadow = true;
  ground.name = 'ground';
  ground.userData.noPick = true;
  helpers.add(ground);
}
scene.add(new THREE.HemisphereLight('#ffffff', '#cfc7bb', 0.9));
const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
sun.position.set(center.x - 10, 22, center.z + 14);
sun.target.position.copy(center);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#e6eeff', 0.5);
fill.position.set(center.x + 12, 9, center.z - 12);
scene.add(fill);

// ------------------------------------------------------------------ კამერები
const persp = new THREE.PerspectiveCamera(35, 1, 0.03, 400);
const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
let camera = persp, controls, viewName = 'home', userMoved = false, lastPersp = null, needsRender = true;
let maxDist = 80, focused = null, dragging = false;
let composer = null, aoPass = null;

function buildComposer() {
  const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
  composer?.dispose();
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const k = coarse ? 0.5 : 1;
  aoPass = new GTAOPass(scene, camera, Math.round(w * k), Math.round(h * k));
  aoPass.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.2, scale: 1.0, samples: coarse ? 8 : 16 });
  aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: coarse ? 8 : 16 });
  aoPass.blendIntensity = 0.8;
  composer.addPass(aoPass);
  composer.addPass(new OutputPass());
}

function makeControls(cam, target) {
  controls?.dispose();
  controls = new OrbitControls(cam, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 1.1;
  controls.minDistance = 0.4;
  controls.maxDistance = maxDist;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minZoom = 0.4;
  controls.maxZoom = 30;
  controls.enableRotate = cam !== ortho;
  controls.touches = { ONE: cam === ortho ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.addEventListener('start', () => { userMoved = true; dragging = true; tween = null; hideHint(); });
  controls.addEventListener('end', () => { dragging = false; });
  controls.addEventListener('change', () => { needsRender = true; });
  controls.update();
}

function fitDistance(cam, dir, target, corners = fitCorners(), margin = 0.92) {
  const f = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, f).normalize();
  const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * margin, th = tv * cam.aspect;
  let d = 0;
  for (const c of corners) {
    const p = c.clone().sub(target), along = p.dot(dir);
    d = Math.max(d, along + Math.abs(p.dot(right)) / th, along + Math.abs(p.dot(up)) / tv);
  }
  return d;
}
// საწყისი — ზემოდან დახრილი, სამხრეთ-დასავლეთიდან (შესასვლელის მხრიდან); წინა ხედი — ტერასის ფასადი
const DIRS = {
  home: new THREE.Vector3(-0.36, 1.45, 0.78).normalize(),
  front: new THREE.Vector3(0, 0.3, -1).normalize(),
  side: new THREE.Vector3(-1, 0.3, 0).normalize(),
};
function perspPose(dir, target = homeTarget, corners) {
  const d = fitDistance(persp, dir, target, corners);
  maxDist = Math.max(maxDist, d * 1.8);
  if (controls) controls.maxDistance = maxDist;
  return { pos: target.clone().addScaledVector(dir, d), target: target.clone() };
}
function useCamera(cam) {
  if (camera === cam) return;
  const t = controls ? controls.target.clone() : homeTarget.clone();
  camera = cam;
  makeControls(cam, t);
  buildComposer();
}
function setView(name, animate = true) {
  viewName = name;
  focused = null;
  if (name !== 'fit') setActiveView(name);
  if (name === 'top' || (name === 'fit' && camera === ortho)) {
    if (camera === persp) lastPersp = { pos: persp.position.clone(), target: controls.target.clone() };
    useCamera(ortho);
    fitOrtho();
    tweenTo({ pos: new THREE.Vector3(center.x, 60, center.z + 0.001), target: new THREE.Vector3(center.x, 0, center.z), zoom: 1 }, animate);
    return;
  }
  let pose;
  if (name === '3d') pose = lastPersp || perspPose(DIRS.home);
  else if (name === 'fit') pose = perspPose(persp.position.clone().sub(controls.target).normalize(), center.clone());
  else pose = perspPose(DIRS[name] || DIRS.home);
  if (camera !== persp) { persp.position.set(controls.target.x, 30, controls.target.z + 0.01); useCamera(persp); }
  tweenTo(pose, animate);
  if (name !== 'fit') lastPersp = null;
}
// თავისუფალი არე (პანელების გარეშე) — მოდელი ცენტრდება ამ არეში: კომპიუტერზე მარჯვენა პანელის მარცხნივ,
// ტელეფონზე ქვედა ზოლის ზემოთ
function freeArea() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const tb = $('.toolbar').getBoundingClientRect();
  let fw = w, fh = h;
  if (tb.height < h * 0.5 && tb.bottom > h - 4 && tb.width > w * 0.8) fh = Math.max(h * 0.5, tb.top);
  else if (tb.left > w * 0.45) fw = Math.max(w * 0.5, tb.left - 8);
  return { w, h, fw, fh };
}
function applyViewOffset() {
  const { w, h, fw, fh } = freeArea();
  if (!w || !h) return;
  persp.aspect = fw / fh;
  persp.setViewOffset(fw, fh, 0, 0, w, h);
  persp.updateProjectionMatrix();
}
function fitOrtho() {
  const { w, h, fw, fh } = freeArea();
  if (!w || !h) return;
  const aspect = fw / fh, m = 1.06, p = dims.visible ? DIM_PAD : 0.3;
  const hh = Math.max((size.z / 2 + p) * m, ((size.x / 2 + p) * m) / aspect);
  Object.assign(ortho, { left: -hh * aspect, right: hh * aspect, top: hh, bottom: -hh });
  ortho.setViewOffset(fw, fh, 0, 0, w, h);
  ortho.updateProjectionMatrix();
}

// ------------------------------------------------------------------ რბილი ანიმაცია
let tween = null;
function tweenTo(pose, animate = true, ms = 700) {
  const from = { pos: camera.position.clone(), target: controls.target.clone(), zoom: camera.zoom };
  const to = { pos: pose.pos, target: pose.target, zoom: pose.zoom ?? camera.zoom };
  if (!animate) {
    camera.position.copy(to.pos); controls.target.copy(to.target); camera.zoom = to.zoom;
    camera.updateProjectionMatrix(); controls.update(); needsRender = true; tween = null;
    return;
  }
  tween = { from, to, t0: performance.now(), ms };
}
function stepTween(now) {
  if (!tween) return false;
  const k = Math.min(1, (now - tween.t0) / tween.ms);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
  controls.target.lerpVectors(tween.from.target, tween.to.target, e);
  camera.zoom = tween.from.zoom + (tween.to.zoom - tween.from.zoom) * e;
  camera.updateProjectionMatrix();
  if (k >= 1) tween = null;
  return true;
}
function zoomBy(factor) {
  hideHint();
  userMoved = true;
  if (camera === ortho) {
    tweenTo({ pos: camera.position.clone(), target: controls.target.clone(), zoom: THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom) }, true, 280);
  } else {
    const off = camera.position.clone().sub(controls.target);
    const len = THREE.MathUtils.clamp(off.length() / factor, controls.minDistance, controls.maxDistance);
    tweenTo({ pos: controls.target.clone().add(off.setLength(len)), target: controls.target.clone() }, true, 280);
  }
}

// ------------------------------------------------------------------ ზომები და ოთახების წარწერები
const dims = new THREE.Group();
dims.name = 'dimensions';
dims.visible = false;
scene.add(dims);
const lineMat = {
  pdf: new THREE.LineBasicMaterial({ color: '#1f2933', depthTest: false, transparent: true }),
  approx: new THREE.LineDashedMaterial({ color: '#d9480f', dashSize: 0.14, gapSize: 0.09, depthTest: false, transparent: true }),
};
function label(text, cls, pos, parent = dims) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.position.copy(pos);
  parent.add(o);
  return o;
}
function addLine(pts, kind) {
  const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat[kind]);
  if (kind === 'approx') l.computeLineDistances();
  l.renderOrder = 10;
  dims.add(l);
}
for (const d of DIMENSIONS) {
  const kind = d.status === 'pdf' ? 'pdf' : 'approx';
  const cls = `dim ${kind}`;
  if (d.v) {
    const [x, z] = d.a.map((q) => q * M), [y0, y1] = d.v.map((q) => q * M), tk = 0.09;
    addLine([new THREE.Vector3(x, y0, z), new THREE.Vector3(x, y1, z), new THREE.Vector3(x - tk, y0, z), new THREE.Vector3(x + tk, y0, z), new THREE.Vector3(x - tk, y1, z), new THREE.Vector3(x + tk, y1, z)], kind);
    label(d.text, cls, new THREE.Vector3(x, (y0 + y1) / 2, z));
    continue;
  }
  const y = (d.z ?? 30) * M;
  const a = new THREE.Vector3(d.a[0] * M, y, d.a[1] * M), b = new THREE.Vector3(d.b[0] * M, y, d.b[1] * M);
  const u = b.clone().sub(a).normalize();
  const t = u.clone().add(new THREE.Vector3(-u.z, 0, u.x)).normalize().multiplyScalar(0.09);
  addLine([a, b, a.clone().sub(t), a.clone().add(t), b.clone().sub(t), b.clone().add(t)], kind);
  label(d.text, cls, a.clone().lerp(b, 0.5));
}
for (const r of ROOMS) {
  const el = document.createElement('div');
  el.className = 'room';
  el.innerHTML = `<b>${r.id === 'T' ? '' : r.id + ' · '}${r.name}</b><span>${r.area}</span>`;
  const o = new CSS2DObject(el);
  o.position.set(r.label[0] * M, 0.05, r.label[1] * M);
  dims.add(o);
}
label('ტერასის ფასადი', 'facade', new THREE.Vector3(8.15, 3.9, -3.4));
label('შესასვლელი', 'facade', new THREE.Vector3(12.6, 3.9, 8.6));

// ------------------------------------------------------------------ ობიექტის არჩევა
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const selBox = new THREE.Box3();
const selHelper = new THREE.Box3Helper(selBox, '#e8590c');
selHelper.visible = false;
selHelper.material.depthTest = false;
selHelper.renderOrder = 20;
helpers.add(selHelper);
let selected = null;
const isShown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const infoRoot = (o) => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.info) return p; return null; };
function pick(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  for (const h of raycaster.intersectObject(root, true)) {
    if (h.object.userData.noPick || !isShown(h.object)) continue;
    // მინა გამჭვირვალეა — თუ მის უკან სხვა ობიექტია, მინა მაინც ირჩევა მხოლოდ პირდაპირ დაჭერისას
    const ir = infoRoot(h.object);
    if (ir) return ir;
  }
  return null;
}
function select(obj) {
  selected = obj;
  const card = $('#info');
  if (!obj) { focused = null; selHelper.visible = false; card.hidden = true; needsRender = true; return; }
  const inf = obj.userData.info;
  selBox.setFromObject(obj);
  selHelper.visible = true;
  const rows = Object.entries(inf.size || {}).map(([k, v]) => {
    const st = inf.status?.[k] || 'pdf';
    const [txt, cls] = STATUS_LABEL[st] || STATUS_LABEL.pdf;
    const val = /^-?\d+(\.\d+)?$/.test(v) ? `${v} მ` : v;
    return `<tr><th>${k}</th><td>${val}</td><td><span class="badge ${cls}">${txt}</span></td></tr>`;
  });
  if (inf.status?.['მდებარეობა']) {
    const [txt, cls] = STATUS_LABEL[inf.status['მდებარეობა']];
    rows.push(`<tr><th>მდებარეობა</th><td>გეგმაზე</td><td><span class="badge ${cls}">${txt}</span></td></tr>`);
  }
  const meta = [inf.code, inf.kind, inf.zone].filter(Boolean).join(' · ');
  const sheets = inf.sheets?.length ? `<p class="src">ფურცელი: ${inf.sheets.join(', ')}</p>` : '';
  $('#info-body').innerHTML = `<div class="meta">${meta}</div><h2>${inf.name}</h2><table>${rows.join('')}</table>${inf.note ? `<p class="note">${inf.note}</p>` : ''}${sheets}`;
  card.hidden = false;
  needsRender = true;
}
function focusOn(obj) {
  if (!obj) return;
  focused = obj;
  const b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  const cs = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) cs.push(new THREE.Vector3(x, y, z));
  userMoved = true;
  if (camera === ortho) {
    const s = b.getSize(new THREE.Vector3());
    const span = Math.max(s.x / (ortho.right - ortho.left), s.z / (ortho.top - ortho.bottom));
    tweenTo({ pos: new THREE.Vector3(c.x, camera.position.y, c.z + 0.001), target: new THREE.Vector3(c.x, 0, c.z), zoom: THREE.MathUtils.clamp(0.4 / Math.max(span, 1e-3), controls.minZoom, controls.maxZoom) });
    return;
  }
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.y < 0.3) dir.y = 0.3;
  dir.normalize();
  const d = THREE.MathUtils.clamp(fitDistance(persp, dir, c, cs, 0.55), 1.2, controls.maxDistance);
  tweenTo({ pos: c.clone().addScaledVector(dir, d), target: c }, true, 750);
}
let down = null, lastTap = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, multi: !e.isPrimary }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || e.pointerId !== down.id || down.multi) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
  down = null;
  if (moved > 6 || dt > 450 || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const obj = pick(e.clientX, e.clientY);
  const now = performance.now();
  const dbl = lastTap && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
  lastTap = dbl ? null : { t: now, x: e.clientX, y: e.clientY };
  select(obj);
  if (dbl && obj) focusOn(obj);
});

// ------------------------------------------------------------------ ღილაკები
function setActiveView(name) { document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name)); }
const layerTargets = { ceiling: [groups.ceiling], exterior: [groups.exterior], furniture: [groups.furniture], dims: [dims] };
function setLayer(key, on) {
  for (const g of layerTargets[key]) g.visible = on;
  document.querySelector(`[data-layer="${key}"]`).setAttribute('aria-pressed', String(on));
  if (key === 'dims') { $('#legend').hidden = !on; fitOrtho(); if (!userMoved && !tween) setView(viewName, true); }
  if (selected && !isShown(selected)) select(null);
  needsRender = true;
}
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { hideHint(); userMoved = false; setView(b.dataset.view); }));
document.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => setLayer(b.dataset.layer, !layerTargets[b.dataset.layer][0].visible)));
$('#zoom-in').addEventListener('click', () => zoomBy(1.35));
$('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.35));
$('#info-close').addEventListener('click', () => select(null));
$('#info-focus').addEventListener('click', () => focusOn(selected));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selected) select(null); });

function pseudoFs(on, msg) { document.body.classList.toggle('pseudo-fs', on); if (msg) toast(msg); setTimeout(resize, 50); }
$('#fullscreen').addEventListener('click', () => {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); return; }
  if (document.body.classList.contains('pseudo-fs')) { pseudoFs(false); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const fallback = () => pseudoFs(true, 'ბრაუზერმა სრული ეკრანი არ დაუშვა — დამალულია დამატებითი პანელები');
  if (!req) { fallback(); return; }
  const p = req.call(el);
  if (p && p.catch) p.catch(fallback);
});

$('#glb').addEventListener('click', () => {
  const btn = $('#glb');
  btn.disabled = true;
  toast('GLB ფაილი მზადდება…');
  // სრული მოდელი — დამალული ჯგუფების ჩათვლით; ზომები, მიწა და მონიშვნა სცენის სხვა ჯგუფებშია და არ შედის
  new GLTFExporter().parse(root, (res) => {
    const blob = new Blob([res], { type: 'model/gltf-binary' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'branch-model.glb';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    btn.disabled = false;
    toast(`GLB ჩამოიტვირთა (${(blob.size / 1048576).toFixed(1)} MB)`);
  }, (err) => { btn.disabled = false; console.error(err); toast('GLB ექსპორტი ვერ მოხერხდა'); }, { binary: true, onlyVisible: false });
});

let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
const hint = $('#hint');
hint.querySelector('.txt').innerHTML = coarse
  ? '<b>1 თითი</b> — ტრიალი · <b>2 თითი</b> — ზუმი და გადაადგილება · <b>შეხება</b> — ინფორმაცია · <b>ორმაგი შეხება</b> — ფოკუსი'
  : '<b>მარცხენა ღილაკი</b> — ტრიალი · <b>ბორბალი</b> — ზუმი · <b>მარჯვენა ღილაკი</b> — გადაადგილება · <b>დაჭერა</b> — ინფორმაცია · <b>ორჯერ დაჭერა</b> — ფოკუსი';
function hideHint() { hint.classList.add('collapsed'); }
hint.querySelector('button').addEventListener('click', () => hint.classList.toggle('collapsed'));
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

// ------------------------------------------------------------------ ზომის ცვლილება
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  applyViewOffset();
  fitOrtho();
  if (!composer) buildComposer();
  else { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); const k = coarse ? 0.5 : 1; aoPass.setSize(Math.round(w * k), Math.round(h * k)); }
  if (!userMoved && !tween) setView(viewName, false);
  needsRender = true;
}
new ResizeObserver(resize).observe(stage);

// ------------------------------------------------------------------ ციკლი
makeControls(persp, homeTarget);
resize();
setView('home', false);
setLayer('ceiling', false); // საწყისად ჭერი მოხსნილია — შიდა განლაგება ჩანს
setLayer('exterior', true);
setLayer('furniture', true);
setLayer('dims', false);

// კონტაქტური ჩრდილები (AO) ითვლება მხოლოდ გაჩერებულ კამერაზე — ტრიალი და ზუმი რჩება რბილი
let lastMove = -1e9, aoDirty = true;
function loop(now) {
  const tw = stepTween(now);
  const changed = controls.update();
  const moving = tw || changed;
  if (moving) { lastMove = now; aoDirty = true; }
  const idle = now - lastMove > 180;
  if (composer && (moving || needsRender || (aoDirty && idle))) {
    aoPass.enabled = idle && !moving;
    composer.render();
    labelRenderer.render(scene, camera);
    needsRender = false;
    if (aoPass.enabled) aoDirty = false;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// შემოწმებისთვის (კონსოლიდან)
window.__house = {
  THREE, scene, root, groups, renderer, houseCenter, get camera() { return camera; }, get controls() { return controls; },
  setView, setLayer, select, focusOn, pick, zoomBy,
  capture() { controls.update(); aoPass.enabled = true; composer.render(); labelRenderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
};
