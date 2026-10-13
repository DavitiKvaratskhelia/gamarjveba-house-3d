// გამარჯვების სახლი — Walk რეჟიმი: პირველი პირის ნავიგაცია, შეჯახება, ვირტუალური ჯოისტიკი.
//
// შეჯახება 2D-შია (იატაკის სიბრტყე): კამერა = წრე რადიუსით RADIUS (ვერტიკალური ცილინდრი 0…≈1.8 მ).
// დამაბრკოლებლები — გამარტივებული ფორმები (მართკუთხედები და სისქიანი მონაკვეთები) 1 მ-იან ბადეში (სივრცითი ძიება),
// ამიტომ ყოველ კადრში დეტალური მოდელი არ მოწმდება. დასაშვები არე — იატაკის მართკუთხედების გაერთიანება.
import * as THREE from 'three';

export const EYE = 1.65;      // თვალის სიმაღლე, მ
export const RADIUS = 0.22;   // „სხეულის“ რადიუსი, მ (0.44 მ — მხრების სიგანე; გადის ნახევრად გაშლილ დასაკეც კარშიც)
const SPEED = 1.35, FAST = 2.6; // მ/წმ (Shift — ზომიერი აჩქარება)
const PITCH_MAX = 80 * Math.PI / 180;
const CELL = 1.0;

// ---------------------------------------------------------------- შეჯახების სამყარო
export class CollisionWorld {
  constructor() { this.items = []; this.grid = new Map(); this.walk = []; }
  // მართკუთხედი [x0, z0, x1, z1] (მ)
  addRect(x0, z0, x1, z1, tag) { this._add({ t: 'r', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), tag }); }
  // მონაკვეთი სისქით (კარის ფრთები, დახრილი მინები)
  addSeg(ax, az, bx, bz, half, tag) { this._add({ t: 's', ax, az, bx, bz, half, tag, x0: Math.min(ax, bx) - half, z0: Math.min(az, bz) - half, x1: Math.max(ax, bx) + half, z1: Math.max(az, bz) + half }); }
  addWalkable(x0, z0, x1, z1) { this.walk.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]); }
  _add(it) {
    const id = this.items.push(it) - 1;
    for (let i = Math.floor(it.x0 / CELL); i <= Math.floor(it.x1 / CELL); i++) for (let j = Math.floor(it.z0 / CELL); j <= Math.floor(it.z1 / CELL); j++) {
      const k = i + ',' + j; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(id);
    }
  }
  _inWalk(x, z) { for (const [x0, z0, x1, z1] of this.walk) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true; return false; }
  // თავისუფალია თუ არა წრე (x, z, r)
  free(x, z, r = RADIUS) {
    // იატაკის საზღვარი: ცენტრი და 4 წერტილი რადიუსზე უნდა იყოს დასაშვებ არეში
    if (!this._inWalk(x, z) || !this._inWalk(x + r, z) || !this._inWalk(x - r, z) || !this._inWalk(x, z + r) || !this._inWalk(x, z - r)) return false;
    const seen = new Set();
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
      const ids = this.grid.get(i + ',' + j); if (!ids) continue;
      for (const id of ids) {
        if (seen.has(id)) continue; seen.add(id);
        const it = this.items[id];
        if (it.t === 'r') {
          const cx = Math.max(it.x0, Math.min(x, it.x1)), cz = Math.max(it.z0, Math.min(z, it.z1));
          if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
        } else {
          const dx = it.bx - it.ax, dz = it.bz - it.az, L2 = dx * dx + dz * dz || 1e-9;
          const t = Math.max(0, Math.min(1, ((x - it.ax) * dx + (z - it.az) * dz) / L2));
          const px = it.ax + dx * t, pz = it.az + dz * t, rr = r + it.half;
          if ((x - px) ** 2 + (z - pz) ** 2 < rr * rr) return false;
        }
      }
    }
    return true;
  }
  // მოძრაობა (dx, dz) — შეჯახებისას სრიალი კედლის გასწვრივ; მცირე ნაბიჯებით (გავლა კედელში შეუძლებელია)
  move(p, dx, dz) {
    const dist = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(dist / 0.05));
    let hit = false;
    for (let s = 0; s < n; s++) {
      const sx = dx / n, sz = dz / n;
      if (this.free(p.x + sx, p.z + sz)) { p.x += sx; p.z += sz; continue; }
      hit = true;
      if (Math.abs(sx) > 1e-6 && this.free(p.x + sx, p.z)) p.x += sx;
      else if (Math.abs(sz) > 1e-6 && this.free(p.x, p.z + sz)) p.z += sz;
    }
    return hit;
  }
  // უახლოესი თავისუფალი წერტილი (თუ საწყისი წერტილი დაკავებულია)
  nearestFree(x, z) {
    if (this.free(x, z)) return { x, z };
    for (let rr = 0.1; rr < 4; rr += 0.1) for (let a = 0; a < 24; a++) {
      const q = { x: x + Math.cos(a / 24 * Math.PI * 2) * rr, z: z + Math.sin(a / 24 * Math.PI * 2) * rr };
      if (this.free(q.x, q.z)) return q;
    }
    return { x, z };
  }
}

// ---------------------------------------------------------------- Walk კონტროლერი
export class WalkController {
  constructor(camera, dom, world, opts = {}) {
    this.camera = camera; this.dom = dom; this.world = world;
    this.enabled = false;
    this.pos = new THREE.Vector3(0, EYE, 0);
    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector2();
    this.keys = new Set();
    this.joy = new THREE.Vector2();      // ჯოისტიკი (x — გვერდზე, y — წინ), −1…1
    this.look = new Map();               // pointerId → { x, y }
    this.reduced = !!opts.reducedMotion;
    this.onInput = opts.onInput || (() => {});
    this.onChange = opts.onChange || (() => {});
    this.locked = false;
    this._bind();
  }
  _bind() {
    const isField = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const CODES = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'fast', ShiftRight: 'fast' };
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = CODES[e.code]; if (!k) return;
      this.keys.add(k);
      if (k !== 'fast') { e.preventDefault(); this.onInput(); }   // ისრები გვერდს აღარ ასქროლებს — მხოლოდ Walk-ში
    });
    window.addEventListener('keyup', (e) => { const k = CODES[e.code]; if (k) this.keys.delete(k); });
    const stop = () => this.stopAll();
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    // გახედვა: მაუსის ჩაკეტვა (Pointer Lock) ან გადათრევა / თითი
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      this.onChange();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.locked) return;
      this._turn(e.movementX * 0.0022, e.movementY * 0.0022);
    });
    this.dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.locked) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.look.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    });
    this.dom.addEventListener('pointermove', (e) => {
      const p = this.look.get(e.pointerId);
      if (!p || !this.enabled) return;
      const k = p.type === 'touch' || p.type === 'pen' ? 0.0055 : 0.0042;
      this._turn((e.clientX - p.x) * k, (e.clientY - p.y) * k);
      p.x = e.clientX; p.y = e.clientY;
    });
    const end = (e) => this.look.delete(e.pointerId);
    this.dom.addEventListener('pointerup', end);
    this.dom.addEventListener('pointercancel', end);
    this.dom.addEventListener('lostpointercapture', end);
  }
  _turn(dx, dy) {
    this.yaw -= dx; this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -PITCH_MAX, PITCH_MAX);
    this.onInput(); this.apply();
  }
  get pointerLockSupported() { return 'pointerLockElement' in document && typeof this.dom.requestPointerLock === 'function'; }
  requestLock() {
    if (!this.pointerLockSupported) return false;
    try { const p = this.dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); return true; } catch { return false; }
  }
  releaseLock() { if (document.pointerLockElement === this.dom) document.exitPointerLock(); }
  stopAll() { this.keys.clear(); this.joy.set(0, 0); this.look.clear(); this.vel.set(0, 0); }
  setPose(x, z, yaw, pitch = 0) {
    const q = this.world.nearestFree(x, z);
    this.pos.set(q.x, EYE, q.z); this.yaw = yaw; this.pitch = pitch; this.vel.set(0, 0); this.apply();
  }
  // კამერის მიმდინარე ორიენტაციიდან (მაგ. Orbit-იდან გადასვლისას)
  fromCamera() {
    const d = new THREE.Vector3(); this.camera.getWorldDirection(d);
    this.yaw = Math.atan2(-d.x, -d.z); this.pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), -PITCH_MAX, PITCH_MAX);
  }
  pose() { return { x: this.pos.x, z: this.pos.z, yaw: this.yaw, pitch: this.pitch }; }
  apply() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();
  }
  // dt — წამებში (უკვე შეზღუდული); აბრუნებს true-ს, თუ კამერა მოძრაობს
  update(dt) {
    if (!this.enabled) return false;
    let f = 0, s = 0;
    if (this.keys.has('f')) f += 1; if (this.keys.has('b')) f -= 1;
    if (this.keys.has('r')) s += 1; if (this.keys.has('l')) s -= 1;
    f += this.joy.y; s += this.joy.x;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const speed = this.keys.has('fast') ? FAST : SPEED;
    // მოძრაობა მხოლოდ იატაკის სიბრტყეზე: მიმართულება — მხოლოდ yaw-იდან (ზემოთ ყურება კამერას არ აწევს)
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const tx = (-sin * f + cos * s) * speed, tz = (-cos * f - sin * s) * speed;
    // რბილი აჩქარება/გაჩერება (≈0.08 წმ), FPS-ისგან დამოუკიდებლად
    const k = this.reduced ? 1 : 1 - Math.exp(-dt / 0.08);
    this.vel.x += (tx - this.vel.x) * k; this.vel.y += (tz - this.vel.y) * k;
    if (Math.abs(this.vel.x) < 1e-3 && Math.abs(this.vel.y) < 1e-3 && !len) { this.vel.set(0, 0); return false; }
    this.world.move(this.pos, this.vel.x * dt, this.vel.y * dt);
    this.pos.y = EYE;
    this.apply();
    return true;
  }
}

// ---------------------------------------------------------------- ვირტუალური ჯოისტიკი (Mobile)
export function attachJoystick(el, walk, onInput) {
  const knob = el.querySelector('.knob');
  const DEAD = 0.14;
  let id = null, cx = 0, cy = 0, R = 1;
  const set = (dx, dy) => {
    let m = Math.hypot(dx, dy) / R;
    const a = Math.atan2(dy, dx);
    const vis = Math.min(1, m);
    knob.style.transform = `translate(${Math.cos(a) * vis * R}px, ${Math.sin(a) * vis * R}px)`;
    // dead zone: მცირე გადახრა მოძრაობად არ ითვლება; შემდეგ — წრფივი 0…1
    m = m < DEAD ? 0 : Math.min(1, (m - DEAD) / (1 - DEAD));
    walk.joy.set(Math.cos(a) * m, -Math.sin(a) * m);
  };
  const reset = () => { id = null; walk.joy.set(0, 0); knob.style.transform = ''; el.classList.remove('active'); };
  el.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    e.preventDefault(); e.stopPropagation();
    id = e.pointerId; el.setPointerCapture?.(e.pointerId);
    const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.36;
    el.classList.add('active');
    set(e.clientX - cx, e.clientY - cy); onInput();
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; e.preventDefault(); set(e.clientX - cx, e.clientY - cy); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, (e) => { if (e.pointerId === id) reset(); });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  return reset;
}
