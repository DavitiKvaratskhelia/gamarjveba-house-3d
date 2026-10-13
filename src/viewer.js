// გამარჯვების სახლი — ინტერაქტიული 3D სანახავი
// ნავიგაცია: სამი რეჟიმი — Orbit (გარედან), Walk (პირველი პირი, შეჯახებით), Plan (ორთოგრაფიული ზედხედი).
// თითოეულ მომენტში აქტიურია მხოლოდ ერთი კონტროლერი; რეჟიმის ბოლო პოზიცია სესიის განმავლობაში ინახება.
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
import { DIMENSIONS, ROOMS, STATUS_LABEL, H, WALLS, OPENINGS, LEAVES, THRESHOLDS, PORCH } from './config.js';
import { allFurnitureTextures } from './furniture.js';
import { REF_VIEWS, WARM_LIGHTS } from './ref-views.js';
import { CollisionWorld, WalkController, attachJoystick, EYE } from './navigation.js';

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const canvas = $('#c');
const coarse = matchMedia('(pointer: coarse)').matches;
const touchCapable = coarse || navigator.maxTouchPoints > 0;
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reducedMQ.matches;
const M = 0.001;
// ჯოისტიკი ჩანს სენსორულ მოწყობილობებზე (Walk რეჟიმში)
document.body.classList.toggle('touch', matchMedia('(any-pointer: coarse)').matches);

// ------------------------------------------------------------------ რენდერერი
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// სუსტ (სენსორულ) მოწყობილობებზე pixel ratio ზომიერად შეზღუდულია
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
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

{ const an = renderer.capabilities.getMaxAnisotropy(); for (const t of allFurnitureTextures()) { t.anisotropy = an; t.needsUpdate = true; } }
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
const hemi = new THREE.HemisphereLight('#ffffff', '#cfc7bb', 0.9);
scene.add(hemi);
// ცის (ნახევარსფეროს) და გარემოს განათება ჩრდილს არ აგდებს — სახურავის ჩვენებისას ის ოთახებში „გადის“ და
// ინტერიერს ზედმეტად ანათებს (ღია ფერის ქსოვილები თეთრდება). სახურავით — ცის წილი მცირდება (ფანჯრებიდან შემოსული).
function updateSky() {
  const roof = groups.ceiling.visible;
  hemi.intensity = roof ? 0.32 : 0.9;
  scene.environmentIntensity = roof ? 0.3 : 0.55;
}
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

// ------------------------------------------------------------------ კამერები და კონტროლერები
const BASE_FOV = 35, WALK_FOV = 68;
// near/far — სივრცის მასშტაბით: Orbit 3 სმ…400 მ, Walk 5 სმ…120 მ (ახლოდან ობიექტები არ ქრება)
const persp = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.03, 400);
const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
let camera = persp, needsRender = true, userMoved = false, focused = null, refActive = null;
let mode = 'orbit';
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

// მომხმარებლის ნებისმიერი ქმედება: მიმდინარე კამერის ანიმაცია წყდება, მართვა მაშინვე მას გადაეცემა
function onUserInput() {
  userMoved = true;
  if (tween) { if (tween.walkEntry) finishTween(); else tween = null; }
  closeHelp();
}
function makeOrbitLike(cam, plan) {
  const c = new OrbitControls(cam, renderer.domElement);
  c.enableDamping = !reduced();
  c.dampingFactor = 0.14;         // რბილი, მაგრამ ზედმეტი ინერციის გარეშე
  c.screenSpacePanning = true;
  c.zoomToCursor = true;
  c.rotateSpeed = 0.7;
  c.zoomSpeed = 0.9;
  c.panSpeed = 1;
  if (plan) {
    c.enableRotate = false;        // გეგმა: ორიენტაცია სტაბილურია (ჩრდილოეთი ზემოთ)
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    c.minZoom = 0.6; c.maxZoom = 24;
  } else {
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.minDistance = 0.6;
    c.maxPolarAngle = Math.PI / 2 - 0.03;   // კამერა იატაკის / მიწის ქვემოთ ვერ ჩადის
  }
  // ბორბალი / trackpad: ერთი მოვლენის ნაბიჯი შეზღუდულია (დიდი „ნახტომები“ აღარ არის), pinch — ნაკლებად მგრძნობიარე
  const base = c._customWheelEvent.bind(c);
  c._customWheelEvent = (e) => { const ev = base(e); ev.deltaY = THREE.MathUtils.clamp(ev.deltaY * (e.ctrlKey ? 0.55 : 1), -120, 120); return ev; };
  c.addEventListener('start', onUserInput);
  c.addEventListener('change', () => { needsRender = true; });
  c.enabled = false;
  return c;
}
const orbitCtl = makeOrbitLike(persp, false);
const planCtl = makeOrbitLike(ortho, true);
orbitCtl.target.copy(homeTarget);
let controls = orbitCtl; // აქტიური Orbit/Plan კონტროლერი (Walk-ში — null-ის ნაცვლად orbitCtl, მაგრამ გამორთული)

// ---- Walk: შეჯახების სამყარო (გამარტივებული ფორმები) — კედლები, ყრუ მინები, რაფები, კარის ფრთები, მსხვილი ავეჯი
const world = new CollisionWorld();
for (const w of WALLS) world.addRect(w.r[0] * M, w.r[1] * M, w.r[2] * M, w.r[3] * M, w.id);
for (const o of OPENINGS) if (o.type === 'fixed' || o.sill > 0) world.addRect(o.r[0] * M, o.r[1] * M, o.r[2] * M, o.r[3] * M, o.id);
for (const l of LEAVES) {
  if ((l.z0 || 0) > 1.0 * 1000) continue;
  world.addSeg(l.seg[0] * M, l.seg[1] * M, l.seg[2] * M, l.seg[3] * M, Math.max(0.02, l.t * M / 2), l.id);
}
for (const g of groups.furniture.children) {
  const b = new THREE.Box3().setFromObject(g);
  const fs = b.getSize(new THREE.Vector3());
  // სხეულის სიმაღლეზე (≤1.0 მ-დან იწყება) და არა წვრილმანი: დეკორი/სანათები/მაღლა ჩამოკიდებული გავლას არ ბლოკავს
  if (b.min.y > 1.0 || fs.y < 0.15 || fs.x * fs.z < 0.02) continue;
  world.addRect(b.min.x, b.min.z, b.max.x, b.max.z, g.name);
}
for (const room of ROOMS) for (const r of room.rects) world.addWalkable(r[0] * M, r[1] * M, r[2] * M, r[3] * M);
for (const t of THRESHOLDS) world.addWalkable(t[0] * M, t[1] * M, t[2] * M, t[3] * M);
world.addWalkable(PORCH[0] * M, PORCH[1] * M, PORCH[2] * M, PORCH[3] * M);
// საწყისი წერტილი: შესასვლელთან (კარის აღმოსავლეთით — ღია კარის ფრთა ხედს არ ფარავს), მზერა მისაღებისა და ტერასისკენ
const WALK_START = { x: 9.1, z: 6.3, yaw: 0.11, pitch: -0.05 };
const walk = new WalkController(persp, renderer.domElement, world, { reducedMotion: reduced(), onInput: onUserInput, onChange: () => updateWalkHud() });
const resetJoystick = attachJoystick($('#joy'), walk, onUserInput);

// ------------------------------------------------------------------ კადრში მოქცევა
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
  const fov = persp.fov; persp.fov = BASE_FOV; persp.updateProjectionMatrix();
  const d = fitDistance(persp, dir, target, corners);
  persp.fov = fov; persp.updateProjectionMatrix();
  return { pos: target.clone().addScaledVector(dir, d), target: target.clone(), fov: BASE_FOV };
}
// ზუმის ზღვარი — რეალური მოდელის ზომით (მთლიანი სახლის ხედის ≈2-ჯერ)
function updateOrbitLimits() {
  const d = perspPose(DIRS.home).pos.distanceTo(homeTarget);
  orbitCtl.maxDistance = Math.max(12, d * 2);
}
function freeArea() {
  const w = stage.clientWidth, h = stage.clientHeight;
  let fw = w, fh = h;
  if (mode === 'walk') return { w, h, fw, fh };
  const nav = $('#navbar').getBoundingClientRect(), side = $('.toolbar').getBoundingClientRect();
  fh = Math.max(h * 0.5, nav.top - 6);                                         // ქვედა ნავიგაციის ზოლის ზემოთ
  if (nav.width > w * 0.8) { /* ტელეფონი */ } else if (side.width && side.left > w * 0.45 && getComputedStyle($('.toolbar')).display !== 'none') fw = Math.max(w * 0.5, side.left - 8);
  return { w, h, fw, fh };
}
function applyViewOffset() {
  const { w, h, fw, fh } = freeArea();
  if (!w || !h) return;
  persp.aspect = fw / fh;
  if (fw === w && fh === h) persp.clearViewOffset(); else persp.setViewOffset(fw, fh, 0, 0, w, h);
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
const planHome = () => ({ pos: new THREE.Vector3(center.x, 60, center.z + 0.001), target: new THREE.Vector3(center.x, 0, center.z), zoom: 1 });

// ------------------------------------------------------------------ რბილი ანიმაცია (300–600 მწმ)
const MS = 520;
let tween = null;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
// Orbit / Plan: პოზიცია + სამიზნე (+ zoom, fov)
function tweenTo(pose, animate = true, ms = MS) {
  const ctl = controls;
  const from = { pos: camera.position.clone(), target: ctl.target.clone(), zoom: camera.zoom, fov: camera.isPerspectiveCamera ? camera.fov : 0 };
  const to = { pos: pose.pos, target: pose.target, zoom: pose.zoom ?? camera.zoom, fov: pose.fov ?? from.fov };
  if (!animate || reduced()) {
    camera.position.copy(to.pos); ctl.target.copy(to.target); camera.zoom = to.zoom; if (to.fov) camera.fov = to.fov;
    camera.updateProjectionMatrix(); ctl.update(); needsRender = true; tween = null;
    return;
  }
  tween = { kind: 'orbit', from, to, t0: performance.now(), ms };
}
// Walk-ში შესვლა: პოზიცია + ორიენტაცია (quaternion) + fov; ბოლოს — Walk კონტროლერი ირთვება
function tweenToWalk(p) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ'));
  const from = { pos: persp.position.clone(), quat: persp.quaternion.clone(), fov: persp.fov };
  const to = { pos: new THREE.Vector3(p.x, EYE, p.z), quat: q, fov: WALK_FOV };
  tween = { kind: 'walk', walkEntry: true, from, to, pose: p, t0: performance.now(), ms: reduced() ? 0 : MS };
  if (reduced()) finishTween(); // შემცირებული მოძრაობა — გადასვლა მყისიერია
}
function finishTween() { if (tween) stepTween(tween.t0 + tween.ms + 1); }
function stepTween(now) {
  if (!tween) return false;
  const k = tween.ms ? Math.min(1, (now - tween.t0) / tween.ms) : 1, e = ease(k);
  const { from, to } = tween;
  if (tween.kind === 'orbit') {
    camera.position.lerpVectors(from.pos, to.pos, e);
    controls.target.lerpVectors(from.target, to.target, e);
    camera.zoom = from.zoom + (to.zoom - from.zoom) * e;
    if (camera.isPerspectiveCamera && to.fov) camera.fov = from.fov + (to.fov - from.fov) * e;
    camera.updateProjectionMatrix();
  } else {
    persp.position.lerpVectors(from.pos, to.pos, e);
    persp.quaternion.slerpQuaternions(from.quat, to.quat, e);
    persp.fov = from.fov + (to.fov - from.fov) * e;
    persp.updateProjectionMatrix();
  }
  if (k >= 1) {
    const t = tween; tween = null;
    if (t.kind === 'walk' && mode === 'walk') { walk.setPose(t.pose.x, t.pose.z, t.pose.yaw, t.pose.pitch); walk.enabled = true; }
  }
  needsRender = true;
  return true;
}

// ------------------------------------------------------------------ რეჟიმები: Orbit / Walk / Plan
const saved = { orbit: null, walk: null, plan: null };   // ბოლო პოზიცია თითოეულ რეჟიმში (სესია)
let planPrevCeiling = null;
function savePose() {
  if (tween) finishTween();
  if (mode === 'orbit') saved.orbit = { pos: persp.position.clone(), target: orbitCtl.target.clone(), fov: persp.fov };
  else if (mode === 'plan') saved.plan = { pos: ortho.position.clone(), target: planCtl.target.clone(), zoom: ortho.zoom };
  else if (mode === 'walk' && walk.enabled) saved.walk = walk.pose();
}
function useCamera(cam) {
  if (camera === cam) return;
  camera = cam;
  buildComposer();
}
function setMode(next, opts = {}) {
  if (next === mode && !opts.force) return;
  savePose();
  const prev = mode;
  // გასვლა
  if (prev === 'walk') { walk.enabled = false; walk.releaseLock(); walk.stopAll(); resetJoystick(); }
  if (prev === 'plan' && planPrevCeiling !== null) { setLayer('ceiling', planPrevCeiling); planPrevCeiling = null; }
  orbitCtl.enabled = false; planCtl.enabled = false;
  mode = next;
  refActive = null; $('#ref-select').value = '';
  document.body.dataset.mode = next;
  document.querySelectorAll('[data-mode]').forEach((b) => { const on = b.dataset.mode === next; b.setAttribute('aria-checked', String(on)); b.classList.toggle('active', on); b.tabIndex = on ? 0 : -1; });
  persp.near = next === 'walk' ? 0.05 : 0.03; persp.far = next === 'walk' ? 120 : 400;
  applyViewOffset();
  if (next === 'orbit') {
    useCamera(persp); controls = orbitCtl; orbitCtl.enabled = true;
    let pose = opts.pose || saved.orbit || perspPose(DIRS.home);
    if (prev === 'walk') {
      // რბილი გადასვლა: სამიზნე იწყება კამერის წინ — ორიენტაცია არ ხტება
      const d = new THREE.Vector3(); persp.getWorldDirection(d);
      orbitCtl.target.copy(persp.position).addScaledVector(d, 3);
    }
    tweenTo(pose, opts.animate !== false);
  } else if (next === 'plan') {
    if (planPrevCeiling === null) { planPrevCeiling = groups.ceiling.visible; if (planPrevCeiling) setLayer('ceiling', false); }
    useCamera(ortho); controls = planCtl; planCtl.enabled = true;
    fitOrtho();
    const pose = opts.pose || saved.plan || planHome();
    if (prev !== 'plan') { ortho.position.set(pose.target.x, 60, pose.target.z + 0.001); planCtl.target.set(pose.target.x, 0, pose.target.z); ortho.zoom = pose.zoom * 0.82; ortho.updateProjectionMatrix(); planCtl.update(); }
    tweenTo(pose, opts.animate !== false);
  } else {
    useCamera(persp); controls = orbitCtl;
    const p = opts.pose || saved.walk || WALK_START;
    tweenToWalk(p);
    if (opts.animate === false) finishTween();
    showWalkTip();
  }
  updateWalkHud();
  updateFocusBtn();
  needsRender = true;
}
// Home — მიმდინარე რეჟიმის საწყისი ხედი (მხოლოდ კამერა და ნავიგაციის პარამეტრები)
function resetView(animate = true) {
  userMoved = false; focused = null; refActive = null; $('#ref-select').value = '';
  if (mode === 'orbit') tweenTo(perspPose(DIRS.home), animate);
  else if (mode === 'plan') { fitOrtho(); tweenTo(planHome(), animate); }
  else { walk.enabled = false; tweenToWalk(WALK_START); if (!animate) finishTween(); }
}
// Fit to View — მთლიანი სივრცე კადრში; Walk-იდან — გადასვლა Orbit-ზე
function fitView() {
  userMoved = false; focused = null;
  if (mode === 'walk') { setMode('orbit', { pose: perspPose(DIRS.home, center.clone()) }); return; }
  if (mode === 'plan') { fitOrtho(); tweenTo(planHome()); return; }
  const dir = persp.position.clone().sub(orbitCtl.target).normalize();
  if (dir.y < 0.25) { dir.y = 0.25; dir.normalize(); }
  tweenTo(perspPose(dir, center.clone()));
}
// სტანდარტული ხედები (წინა, გვერდი) — Orbit რეჟიმში
function setView(name, animate = true) {
  if (name === 'top') { setMode('plan'); return; }
  if (name === '3d') { setMode('orbit'); return; }
  if (name === 'home') { resetView(animate); return; }
  if (name === 'fit') { fitView(); return; }
  if (mode !== 'orbit') setMode('orbit', { pose: perspPose(DIRS[name] || DIRS.home), animate });
  else tweenTo(perspPose(DIRS[name] || DIRS.home), animate);
  userMoved = false;
}
function zoomBy(factor) {
  onUserInput();
  if (mode === 'walk') return;
  if (camera === ortho) {
    tweenTo({ pos: camera.position.clone(), target: controls.target.clone(), zoom: THREE.MathUtils.clamp(camera.zoom * factor, planCtl.minZoom, planCtl.maxZoom) }, true, 280);
  } else {
    const off = camera.position.clone().sub(controls.target);
    const len = THREE.MathUtils.clamp(off.length() / factor, orbitCtl.minDistance, orbitCtl.maxDistance);
    tweenTo({ pos: controls.target.clone().add(off.setLength(len)), target: controls.target.clone() }, true, 280);
  }
}
// Orbit/Plan: სამიზნე რჩება მოდელის არეში — კამერა უკონტროლოდ ვერ „გაიქცევა“
function clampTargets() {
  const lo = bbox.min.clone().addScalar(-2), hi = bbox.max.clone().addScalar(2);
  if (mode === 'orbit') {
    const t = orbitCtl.target, before = t.clone();
    t.x = THREE.MathUtils.clamp(t.x, lo.x, hi.x); t.z = THREE.MathUtils.clamp(t.z, lo.z, hi.z); t.y = THREE.MathUtils.clamp(t.y, 0.2, 3.4);
    if (!t.equals(before)) persp.position.add(t.clone().sub(before));
  } else if (mode === 'plan') {
    const t = planCtl.target, before = t.clone();
    t.x = THREE.MathUtils.clamp(t.x, bbox.min.x, bbox.max.x); t.z = THREE.MathUtils.clamp(t.z, bbox.min.z, bbox.max.z);
    if (!t.equals(before)) ortho.position.add(t.clone().sub(before));
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
    const ir = infoRoot(h.object);
    if (ir) return ir;
  }
  return null;
}
function select(obj) {
  selected = obj;
  updateFocusBtn();
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
  for (const key of ['ფორმა', 'მასალა']) {
    if (!inf.status?.[key]) continue;
    const [txt, cls] = STATUS_LABEL[inf.status[key]];
    const val = key === 'ფორმა' ? (inf.shape || '—') : (inf.materials?.length ? `${inf.materials.length} მასალა` : '—');
    rows.push(`<tr><th>${key}</th><td>${val}</td><td><span class="badge ${cls}">${txt}</span></td></tr>`);
  }
  const matList = inf.materials?.length ? `<p class="note">${inf.materials.map((m) => '• ' + m).join('<br>')}</p>` : '';
  const meta = [inf.code, inf.kind, inf.zone].filter(Boolean).join(' · ');
  const sheets = inf.sheets?.length ? `<p class="src">ფურცელი: ${inf.sheets.join(', ')}</p>` : '';
  $('#info-body').innerHTML = `<div class="meta">${meta}</div><h2>${inf.name}</h2><table>${rows.join('')}</table>${inf.note ? `<p class="note">${inf.note}</p>` : ''}${matList}${sheets}`;
  card.hidden = false;
  needsRender = true;
}
// Focus: ობიექტის ზომა და ეკრანის პროპორცია; კამერა ობიექტის შიგნით არ ხვდება; Orbit-ში ბრუნვის ცენტრი = ობიექტი
function focusOn(obj) {
  if (!obj) { toast('ჯერ აირჩიეთ ობიექტი (დაჭერით)'); return; }
  focused = obj;
  userMoved = true;
  const b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  const rad = b.getBoundingSphere(new THREE.Sphere()).radius;
  if (mode === 'walk') {
    // Walk: კამერა ობიექტისკენ ბრუნდება (ადგილიდან არ იძვრება)
    const dx = c.x - walk.pos.x, dz = c.z - walk.pos.z, dy = c.y - EYE;
    const p = { ...walk.pose(), yaw: Math.atan2(-dx, -dz), pitch: THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.2, 1.2) };
    walk.enabled = false; tweenToWalk(p);
    if (tween) tween.ms = 380;
    return;
  }
  if (mode === 'plan') {
    const s = b.getSize(new THREE.Vector3());
    const span = Math.max(s.x / (ortho.right - ortho.left), s.z / (ortho.top - ortho.bottom));
    tweenTo({ pos: new THREE.Vector3(c.x, ortho.position.y, c.z + 0.001), target: new THREE.Vector3(c.x, 0, c.z), zoom: THREE.MathUtils.clamp(0.4 / Math.max(span, 1e-3), planCtl.minZoom, planCtl.maxZoom) });
    return;
  }
  const cs = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) cs.push(new THREE.Vector3(x, y, z));
  const dir = persp.position.clone().sub(orbitCtl.target).normalize();
  if (dir.y < 0.3) dir.y = 0.3;
  dir.normalize();
  const d = THREE.MathUtils.clamp(Math.max(fitDistance(persp, dir, c, cs, 0.55), rad * 1.4 + persp.near), orbitCtl.minDistance, orbitCtl.maxDistance);
  tweenTo({ pos: c.clone().addScaledVector(dir, d), target: c }, true, MS + 80);
}
// დაჭერა vs გადათრევა: მოძრაობა > 6 px ან > 450 მწმ — კამერის მართვაა და ობიექტი არ ირჩევა
let down = null, lastTap = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, multi: !e.isPrimary }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || e.pointerId !== down.id || down.multi) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
  down = null;
  if (moved > 6 || dt > 450 || (e.pointerType === 'mouse' && e.button !== 0)) return;
  // Walk + ჩაკეტილი მაუსი: ირჩევა ეკრანის ცენტრში (ჯვრის ქვეშ) მყოფი ობიექტი
  const r = renderer.domElement.getBoundingClientRect();
  const [px, py] = walk.locked ? [r.left + r.width / 2, r.top + r.height / 2] : [e.clientX, e.clientY];
  const obj = pick(px, py);
  const now = performance.now();
  const dbl = lastTap && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
  lastTap = dbl ? null : { t: now, x: e.clientX, y: e.clientY };
  select(obj);
  if (dbl && obj) focusOn(obj);
});

// ------------------------------------------------------------------ ღილაკები
const layerTargets = { ceiling: [groups.ceiling], exterior: [groups.exterior], furniture: [groups.furniture], dims: [dims] };
function setLayer(key, on) {
  for (const g of layerTargets[key]) g.visible = on;
  if (key === 'ceiling') updateSky();
  document.querySelector(`[data-layer="${key}"]`).setAttribute('aria-pressed', String(on));
  if (key === 'dims') { $('#legend').hidden = !on; fitOrtho(); if (!userMoved && !tween && mode !== 'walk') resetView(true); }
  if (selected && !isShown(selected)) select(null);
  needsRender = true;
}
// რეჟიმის გადამრთველი (radiogroup: ისრებით გადართვაც მუშაობს)
document.querySelectorAll('[data-mode]').forEach((b) => {
  b.addEventListener('click', () => { setMode(b.dataset.mode); });
  b.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const order = ['orbit', 'walk', 'plan'], i = (order.indexOf(mode) + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
    setMode(order[i]); document.querySelector(`[data-mode="${order[i]}"]`).focus();
  });
});
$('#nav-home').addEventListener('click', () => resetView());
$('#nav-fit').addEventListener('click', () => fitView());
$('#nav-focus').addEventListener('click', () => focusOn(selected));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { closeSheet(); setView(b.dataset.view); }));
document.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => setLayer(b.dataset.layer, !layerTargets[b.dataset.layer][0].visible)));
$('#zoom-in').addEventListener('click', () => zoomBy(1.35));
$('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.35));
$('#info-close').addEventListener('click', () => select(null));
$('#info-focus').addEventListener('click', () => focusOn(selected));
function updateFocusBtn() {
  const b = $('#nav-focus');
  b.setAttribute('aria-disabled', String(!selected));
  b.title = selected ? `ფოკუსი: ${selected.userData.info?.name || ''} (F)` : 'ფოკუსი — ჯერ აირჩიეთ ობიექტი (F)';
}

// სრული ეკრანი — სადაც მხარდაჭერილია; სხვაგან: დამატებითი პანელების დამალვა
function pseudoFs(on, msg) { document.body.classList.toggle('pseudo-fs', on); if (msg) toast(msg); setTimeout(resize, 50); }
function toggleFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); return; }
  if (document.body.classList.contains('pseudo-fs')) { pseudoFs(false); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const fallback = () => pseudoFs(true, 'ბრაუზერმა სრული ეკრანი არ დაუშვა — დამალულია დამატებითი პანელები');
  if (!req) { fallback(); return; }
  const p = req.call(el);
  if (p && p.catch) p.catch(fallback);
}
for (const id of ['#fullscreen', '#nav-fs']) $(id)?.addEventListener('click', toggleFullscreen);
const onFs = () => { const on = !!(document.fullscreenElement || document.webkitFullscreenElement) || document.body.classList.contains('pseudo-fs'); $('#nav-fs').setAttribute('aria-pressed', String(on)); };
document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);

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

// ---- დახმარება (Help) — მოწყობილობისა და რეჟიმის მიხედვით
const HELP = touchCapable && coarse ? {
  orbit: [['1 თითი', 'ტრიალი'], ['2 თითის გაშლა / შეკუმშვა', 'მიახლოება / დაშორება'], ['2 თითით გადათრევა', 'ხედის გადაადგილება'], ['შეხება', 'ობიექტის ინფორმაცია'], ['ორმაგი შეხება', 'ფოკუსი ობიექტზე']],
  walk: [['მარცხენა ჯოისტიკი', 'სიარული (წინ / უკან / გვერდზე)'], ['თითით გადათრევა ეკრანზე', 'მიხედვა'], ['ორივე ერთად', 'სიარული და მიხედვა სხვადასხვა თითით'], ['შეხება', 'ობიექტის ინფორმაცია']],
  plan: [['1 თითი', 'გადაადგილება'], ['2 თითი', 'ზუმი'], ['შეხება', 'ობიექტის ინფორმაცია'], ['ორმაგი შეხება', 'ფოკუსი']],
} : {
  orbit: [['მარცხენა ღილაკი + გადათრევა', 'ტრიალი'], ['მარჯვენა ღილაკი + გადათრევა', 'ხედის გადაადგილება'], ['ბორბალი / trackpad', 'მიახლოება / დაშორება (კურსორისკენ)'], ['დაჭერა', 'ობიექტის ინფორმაცია'], ['ორჯერ დაჭერა · F', 'ფოკუსი ობიექტზე'], ['Home', 'საწყისი ხედი']],
  walk: [['W A S D · ისრები', 'სიარული'], ['Shift', 'სწრაფი სიარული'], ['მაუსით გადათრევა', 'მიხედვა'], ['„მაუსით ხედვა“ · L', 'მაუსის ჩაკეტვა (Esc — გათავისუფლება)'], ['დაჭერა', 'ინფორმაცია (ჩაკეტვისას — ჯვრის ქვეშ)'], ['F', 'მონიშნული ობიექტისკენ შებრუნება'], ['Home', 'შესასვლელთან დაბრუნება']],
  plan: [['მარცხენა / მარჯვენა ღილაკი + გადათრევა', 'გადაადგილება'], ['ბორბალი / trackpad', 'ზუმი (კურსორისკენ)'], ['დაჭერა', 'ობიექტის ინფორმაცია'], ['ორჯერ დაჭერა · F', 'ფოკუსი'], ['Home', 'მთლიანი გეგმა']],
};
const MODE_NAME = { orbit: 'Orbit — სივრცის გარედან', walk: 'Walk — სივრცეში სიარული', plan: 'Plan — ზედხედი' };
function renderHelp() {
  $('#help-body').innerHTML = ['orbit', 'walk', 'plan'].map((m) => `<section class="${m === mode ? 'cur' : ''}"><h3>${MODE_NAME[m]}${m === mode ? ' <span class="badge ok">აქტიური</span>' : ''}</h3><dl>${HELP[m].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></section>`).join('');
}
function openHelp() { renderHelp(); $('#help').hidden = false; $('#nav-help').setAttribute('aria-expanded', 'true'); $('#help-close').focus(); }
function closeHelp() { if ($('#help').hidden) return; $('#help').hidden = true; $('#nav-help').setAttribute('aria-expanded', 'false'); }
$('#nav-help').addEventListener('click', () => ($('#help').hidden ? openHelp() : closeHelp()));
$('#help-close').addEventListener('click', closeHelp);
$('#sheet-help')?.addEventListener('click', () => { closeSheet(); openHelp(); });

// ---- ტელეფონი: მეორეხარისხოვანი პარამეტრების გასაშლელი პანელი
function closeSheet() { document.body.classList.remove('sheet-open'); $('#nav-more').setAttribute('aria-expanded', 'false'); }
$('#nav-more').addEventListener('click', () => {
  const on = !document.body.classList.contains('sheet-open');
  document.body.classList.toggle('sheet-open', on);
  $('#nav-more').setAttribute('aria-expanded', String(on));
  closeHelp();
});

// ---- Walk-ის მინიშნება, ჯვარი, მაუსის ჩაკეტვა
function updateWalkHud() {
  const on = mode === 'walk';
  document.body.classList.toggle('locked', on && walk.locked);
  $('#walkhud').hidden = !on;
  if (!on) return;
  const lockBtn = $('#walk-lock');
  lockBtn.hidden = !walk.pointerLockSupported || coarse;
  $('#walkhud .txt').innerHTML = coarse
    ? '<b>ჯოისტიკი</b> — სიარული · <b>გადათრევა</b> — მიხედვა'
    : walk.locked ? '<b>მაუსი</b> — მიხედვა · <b>W A S D</b> — სიარული · <b>დაჭერა</b> — ინფორმაცია · <b>Esc</b> — გათავისუფლება'
      : '<b>W A S D / ისრები</b> — სიარული · <b>გადათრევა</b> — მიხედვა · <b>Shift</b> — სწრაფად';
}
let tipTimer;
function showWalkTip() { $('#walkhud').classList.remove('dim'); clearTimeout(tipTimer); tipTimer = setTimeout(() => $('#walkhud').classList.add('dim'), 5000); }
$('#walk-lock').addEventListener('click', () => { if (!walk.requestLock()) toast('მაუსის ჩაკეტვა აქ მიუწვდომელია — გამოიყენეთ გადათრევა'); });

// ---- შეხება ღილაკებზე: Chrome სწრაფი გადათრევის (fling) შემდეგ პირველ შეხებას click-ად არ თვლის —
// სენსორზე ღილაკი pointerup-ით ირთვება, ხოლო შემდეგ მოსული მშობლიური click (თუ მოვა) იგნორირდება (ორჯერ არ შესრულდება).
let tapGuard = null;
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  const b = e.target.closest?.('button');
  tapGuard = b && !b.disabled ? { b, x: e.clientX, y: e.clientY, id: e.pointerId } : null;
}, true);
document.addEventListener('pointerup', (e) => {
  const g = tapGuard;
  if (!g || e.pointerId !== g.id) return;
  tapGuard = null;
  if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12 || !g.b.contains(document.elementFromPoint(e.clientX, e.clientY))) return;
  g.b.__tapAt = performance.now();
  g.b.click();
}, true);
document.addEventListener('pointercancel', () => { tapGuard = null; }, true);
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('button');
  if (b && e.isTrusted && b.__tapAt && performance.now() - b.__tapAt < 800) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);

// ---- კლავიატურა (ტექსტის / პარამეტრის ველში არ მუშაობს)
const isField = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
document.addEventListener('keydown', (e) => {
  if (isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (tween?.walkEntry && /^(Key[WASD]|Arrow)/.test(e.code)) finishTween();
  if (e.key === 'Escape') { if (!$('#help').hidden) closeHelp(); else if (document.body.classList.contains('sheet-open')) closeSheet(); else if (selected) select(null); return; }
  if (e.key === 'Home') { e.preventDefault(); resetView(); return; }
  if (e.code === 'KeyF') { focusOn(selected); return; }
  if (e.code === 'KeyL' && mode === 'walk' && !coarse) { walk.locked ? walk.releaseLock() : walk.requestLock(); }
});
// iOS Safari: ორი თითის ჟესტი გვერდს არ ადიდებს — მხოლოდ 3D არეში
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) stage.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
stage.addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------------ რენდერებთან შედარება
// კამერები რენდერების ხედებთან მიახლოებით (ref-views.js) — Orbit რეჟიმში; თავისუფალი ნავიგაცია რჩება
const refSel = $('#ref-select');
refSel.innerHTML = '<option value="">— აირჩიეთ ხედი —</option>' + REF_VIEWS.map((v) => `<option value="${v.id}">${v.label}</option>`).join('');
function setRefView(id) {
  const v = REF_VIEWS.find((q) => q.id === id);
  if (!v) return;
  const pose = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target), fov: v.fov };
  if (mode !== 'orbit') setMode('orbit', { pose }); else tweenTo(pose, true, 700);
  setLayer('ceiling', !v.id.startsWith('A08'));
  refActive = v; refSel.value = id;
  userMoved = true;
}
refSel.addEventListener('change', () => { if (refSel.value) setRefView(refSel.value); });
const warmRig = new THREE.Group();
warmRig.name = 'warm reference lights (viewer only)';
warmRig.visible = false;
for (const p of WARM_LIGHTS) { const l = new THREE.PointLight('#ffd2a1', 0, 0, 2); l.power = 900; l.position.set(...p); warmRig.add(l); }
scene.add(warmRig);
function setWarm(on) {
  warmRig.visible = on;
  for (const l of warmRig.children) l.intensity = on ? l.power / (4 * Math.PI) : 0;
  $('#warm').setAttribute('aria-pressed', String(on));
  needsRender = true;
}
$('#warm').addEventListener('click', () => setWarm(!warmRig.visible));

// ------------------------------------------------------------------ ზომის / ორიენტაციის ცვლილება
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  applyViewOffset();
  fitOrtho();
  if (!composer) buildComposer();
  else { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); const k = coarse ? 0.5 : 1; aoPass.setSize(Math.round(w * k), Math.round(h * k)); }
  updateOrbitLimits();
  if (!userMoved && !tween && mode !== 'walk') resetView(false);
  needsRender = true;
}
new ResizeObserver(resize).observe(stage);
reducedMQ.addEventListener?.('change', () => { orbitCtl.enableDamping = planCtl.enableDamping = !reduced(); walk.reduced = reduced(); });

// ------------------------------------------------------------------ ციკლი (ერთადერთი)
resize();
setMode('orbit', { force: true, animate: false });
resetView(false);
setLayer('ceiling', false); // საწყისად ჭერი მოხსნილია — შიდა განლაგება ჩანს
setLayer('exterior', true);
setLayer('furniture', true);
setLayer('dims', false);
setWarm(false);
document.getElementById('loading')?.remove();

// კონტაქტური ჩრდილები (AO) ითვლება მხოლოდ გაჩერებულ კამერაზე — მოძრაობა რჩება რბილი
let lastMove = -1e9, aoDirty = true, lastT = performance.now();
function loop(now) {
  // dt შეზღუდულია: ხანგრძლივი პაუზის (სხვა ჩანართი) შემდეგ კამერა არ ხტება; სიჩქარე FPS-ზე არ არის დამოკიდებული
  const dt = Math.min(0.25, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  const tw = stepTween(now);
  let changed = false;
  if (mode === 'walk') changed = walk.update(dt);
  else { changed = controls.update(); clampTargets(); }
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
  THREE, scene, root, groups, renderer, houseCenter, world, walk, get mode() { return mode; }, get camera() { return camera; }, get controls() { return mode === 'walk' ? null : controls; }, get tween() { return tween; }, saved,
  setMode, setView, resetView, fitView, setLayer, select, focusOn, pick, zoomBy, setRefView, setWarm, REF_VIEWS, get selected() { return selected; },
  capture() { if (controls && mode !== 'walk') controls.update(); aoPass.enabled = true; composer.render(); labelRenderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
};
