// გამარჯვების სახლი — 3D გეომეტრიის აგება config.js-ისა და furniture-data.js-ის მიხედვით.
// იყენებს მხოლოდ three.js-ს (DOM-ის გარეშე) — მუშაობს ბრაუზერშიც და Node-შიც (GLB ექსპორტი).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  H, COLORS, WALLS, OPENINGS, LEAVES, ROOMS, THRESHOLDS, PLINTH, PORCH, STEPS, ROOF, CLADDING, STATUS_LABEL,
} from './config.js';
import { FURNITURE } from './furniture-data.js';
import { buildFurnitureItem } from './furniture.js';

const M = 0.001; // მმ → მ
const fmt = (mm) => (mm / 1000).toFixed(2);

// ------------------------------------------------------------------ მასალები
const matCache = new Map();
export function mat(key) {
  if (matCache.has(key)) return matCache.get(key);
  const c = COLORS[key];
  if (!c) throw new Error('უცნობი მასალა: ' + key);
  const m = new THREE.MeshStandardMaterial({ name: key, color: new THREE.Color(c.c), roughness: c.r ?? 0.7, metalness: c.m ?? 0 });
  if (c.o !== undefined) { m.transparent = true; m.opacity = c.o; m.depthWrite = false; m.side = THREE.DoubleSide; }
  m.userData = { description: c.name, source: STATUS_LABEL[c.src]?.[0] };
  matCache.set(key, m);
  return m;
}

// ------------------------------------------------------------------ გეომეტრიის დამხმარეები
// ყუთი გეგმის კოორდინატებში (მმ): [x0,y0,x1,y1], z0…z1 → BoxGeometry მეტრებში, უკვე სწორ ადგილას
function boxGeo(r, z0, z1) {
  const [x0, y0, x1, y1] = r;
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0) * M, Math.abs(z1 - z0) * M, Math.abs(y1 - y0) * M);
  g.translate((x0 + x1) / 2 * M, (z0 + z1) / 2 * M, (y0 + y1) / 2 * M);
  return g;
}
function mesh(geo, matKey, name) {
  const m = new THREE.Mesh(geo, typeof matKey === 'string' ? mat(matKey) : matKey);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
// ჯგუფის შიგნით ერთნაირი მასალის ნაწილები ერთ მეშად ერთიანდება (ნაკლები draw call)
class Parts {
  constructor() { this.by = new Map(); }
  add(matKey, geo) { if (!this.by.has(matKey)) this.by.set(matKey, []); this.by.get(matKey).push(geo); return this; }
  box(matKey, r, z0, z1) { return this.add(matKey, boxGeo(r, z0, z1)); }
  into(group, prefix) {
    for (const [k, list] of this.by) {
      const g = list.length === 1 ? list[0] : mergeGeometries(list.map((q) => q.index ? q.toNonIndexed() : q), false);
      group.add(mesh(g, k, `${prefix}_${k}`));
    }
    return group;
  }
}
// ბრუნვის გარეშე ლოკალური სისტემა ავეჯისთვის: u — სიგრძე (ფასადის გასწვრივ), v — სიღრმე (0 = ზურგი, d = წინა მხარე)
function frameOf(r, face) {
  const [x0, y0, x1, y1] = r;
  const alongX = face === 'y0' || face === 'y1';
  const L = alongX ? x1 - x0 : y1 - y0, D = alongX ? y1 - y0 : x1 - x0;
  // (u, v) → (x, y); v იზრდება ზურგიდან წინისკენ
  const toXY = (u, v) => {
    if (face === 'x1') return [x0 + v, y0 + u];
    if (face === 'x0') return [x1 - v, y0 + u];
    if (face === 'y1') return [x0 + u, y0 + v];
    return [x0 + u, y1 - v]; // y0
  };
  const rect = (u0, v0, u1, v1) => {
    const [a, b] = toXY(u0, v0), [c, d] = toXY(u1, v1);
    return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
  };
  return { L, D, rect };
}
function infoGroup(name, info) {
  const g = new THREE.Group();
  g.name = name;
  g.userData.info = info;
  return g;
}

// ------------------------------------------------------------------ კედლები
function wallInfo(w) {
  const [x0, y0, x1, y1] = w.r;
  const len = Math.max(x1 - x0, y1 - y0), th = Math.min(x1 - x0, y1 - y0);
  const kindTxt = { ext: 'გარე კედელი', col: 'რკინაბეტონის სვეტი', int: 'შიდა ტიხარი' }[w.kind];
  return {
    code: w.id, kind: kindTxt, name: w.kind === 'col' ? `სვეტი ${th} × ${len} მმ` : `${kindTxt} — ${w.id}`,
    size: { 'სიგრძე': fmt(len), 'სისქე': fmt(th), 'სიმაღლე': fmt(H.ceiling) },
    status: { 'სიგრძე': 'pdf', 'სისქე': 'pdf', 'სიმაღლე': 'assumed', 'მდებარეობა': 'pdf' },
    note: w.kind === 'col' ? 'A.9: 300 × 300 (კონკრეტის აღნიშვნა გეგმაზე).' : 'A.9 — ზომების ჯაჭვები და ვექტორული კონტური.',
    sheets: ['A.9', 'A.8'],
  };
}
function buildWall(w) {
  const g = infoGroup(w.id, wallInfo(w));
  const p = new Parts();
  const matKey = w.kind === 'col' ? 'column' : w.kind === 'ext' ? 'wallExt' : 'wallInt';
  p.box(matKey, w.r, 0, H.ceiling);
  // შიდა წახნაგი გარე კედლებზე — შიდა საღებავი (თხელი ფენა, რომ გარეთ ბათქაში დარჩეს)
  for (const [side, key, from, to] of w.paint || []) p.add(key, paintGeo(w.r, side, from, to));
  return p.into(g, w.id);
}
function paintGeo(r, side, from, to, z0 = 0, z1 = H.ceiling) {
  const t = 4;
  const [x0, y0, x1, y1] = r;
  if (side === 'x0') return boxGeo([x0 - t, from, x0, to], z0, z1);
  if (side === 'x1') return boxGeo([x1, from, x1 + t, to], z0, z1);
  if (side === 'y0') return boxGeo([from, y0 - t, to, y0], z0, z1);
  return boxGeo([from, y1, to, y1 + t], z0, z1);
}
// გარე კედლების შიდა მხარე — შიდა საღებავით (ოთახის მხრიდან)
const INNER_FACES = { // კედელი → [მხარე, from, to]
  'W-N1': ['y1', 300, 1000], 'W-N2': ['y1', 3500, 4300], 'W-N3': ['y1', 4600, 6100], 'W-N4': ['y1', 10500, 12800], 'W-N5': ['y1', 15300, 16000],
  'C-02': ['y1', 4300, 4600], 'C-03': ['y1', 10200, 10500], 'W-W1': ['x1', 300, 6900], 'W-E1': ['x0', 300, 4900],
  'W-S1': ['y0', 2600, 4300], 'W-S3': ['y0', 10500, 16000], 'W-S2a': ['y0', 4600, 5600], 'W-S2b': ['y0', 6000, 6440],
  'W-S2c': ['y0', 8360, 8800], 'W-S2d': ['y0', 9200, 10200], 'C-06': ['y0', 4300, 4600], 'C-07': ['y0', 10200, 10500],
  'C-05': ['x1', 6900, 7200], 'C-08': ['x0', 6900, 7200],
};

// ღიობის ზედა (და ქვედა) ნაწილი
function buildOpeningFill(o) {
  const g = infoGroup(o.id, {
    code: o.id, kind: { door: 'შიდა კარის ღიობი', sliding: 'გასაწევი კარი', bifold: 'დასაკეცი კარი', entry: 'შესასვლელი კარი', fixed: 'ყრუ მინა', window: 'ფანჯარა' }[o.type],
    name: o.name,
    size: { 'სიგანე': fmt(Math.max(o.r[2] - o.r[0], o.r[3] - o.r[1])), 'სიმაღლე': fmt(o.head - o.sill), ...(o.sill ? { 'რაფა': fmt(o.sill) } : {}) },
    status: { 'სიგანე': o.st.w, 'სიმაღლე': o.st.h, 'რაფა': 'assumed', 'მდებარეობა': 'pdf' },
    sheets: ['A.9', 'A.8'],
  });
  const p = new Parts();
  const key = o.kind === 'ext' ? 'wallExt' : 'wallInt';
  if (o.head < H.ceiling) p.box(key, o.r, o.head, H.ceiling);
  if (o.sill > 0) p.box(key, o.r, 0, o.sill);
  const [x0, y0, x1, y1] = o.r;
  const alongX = x1 - x0 > y1 - y0;
  // ჩარჩო (შავი პროფილი) და ყრუ მინა ფასადის ღიობებში
  if (o.kind === 'ext') {
    const f = 50;
    const mid = alongX ? (y0 + y1) / 2 : (x0 + x1) / 2;
    const band = (a, b) => alongX ? [a, mid - 30, b, mid + 30] : [mid - 30, a, mid + 30, b];
    const lo = alongX ? x0 : y0, hi = alongX ? x1 : y1;
    p.box('frame', band(lo, hi), o.head - f, o.head);
    p.box('frame', band(lo, lo + f), o.sill, o.head);
    p.box('frame', band(hi - f, hi), o.sill, o.head);
    if (o.sill > 0 || o.type === 'fixed') p.box('frame', band(lo, hi), o.sill, o.sill + f);
    if (o.type === 'fixed') p.add('glass', boxGeo(alongX ? [lo + f, mid - 6, hi - f, mid + 6] : [mid - 6, lo + f, mid + 6, hi - f], o.sill + f, o.head - f));
  } else {
    // შიდა კარის ჩარჩო (თეთრი წირთხლი)
    const jt = 20;
    if (alongX) {
      p.box('doorWhite', [x0, y0 - 10, x0 + jt, y1 + 10], 0, o.head); p.box('doorWhite', [x1 - jt, y0 - 10, x1, y1 + 10], 0, o.head);
      p.box('doorWhite', [x0, y0 - 10, x1, y1 + 10], o.head, o.head + jt);
    } else {
      p.box('doorWhite', [x0 - 10, y0, x1 + 10, y0 + jt], 0, o.head); p.box('doorWhite', [x0 - 10, y1 - jt, x1 + 10, y1], 0, o.head);
      p.box('doorWhite', [x0 - 10, y0, x1 + 10, y1], o.head, o.head + jt);
    }
  }
  return p.into(g, o.id);
}

// კარის / მინის ფრთა სეგმენტის გასწვრივ
function buildLeaf(l) {
  const [x1, y1, x2, y2] = l.seg;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const z0 = l.z0 || 0;
  const g = infoGroup(l.id, {
    code: l.id, kind: l.glass ? 'მინის ფრთა' : 'კარის ფრთა',
    name: `${OPENINGS.find((o) => o.id === l.open)?.name || ''} — ფრთა`,
    size: { 'სიგანე': fmt(len), 'სიმაღლე': fmt(l.h), 'სისქე': fmt(l.t) },
    status: { 'სიგანე': 'vec', 'სიმაღლე': l.open === 'O-02' || l.open === 'O-07' ? 'assumed' : 'pdf', 'სისქე': 'vec', 'მდებარეობა': 'vec' },
    note: 'მდგომარეობა (გაღებული / გაშლილი) — როგორც A.8-ზეა დახატული.',
    sheets: ['A.8'],
  });
  const p = new Parts();
  const local = (u0, u1, t0, t1, a, b) => { // ფრთის ლოკალურ ღერძებში
    const geo = new THREE.BoxGeometry((u1 - u0) * M, (b - a) * M, (t1 - t0) * M);
    geo.translate((u0 + u1) / 2 * M, (a + b) / 2 * M, (t0 + t1) / 2 * M);
    return geo;
  };
  const t = l.t;
  if (l.glass) {
    const f = 50;
    p.add('frame', local(0, len, -t / 2, t / 2, z0, z0 + f)).add('frame', local(0, len, -t / 2, t / 2, z0 + l.h - f, z0 + l.h))
      .add('frame', local(0, f, -t / 2, t / 2, z0, z0 + l.h)).add('frame', local(len - f, len, -t / 2, t / 2, z0, z0 + l.h))
      .add('glass', local(f, len - f, -6, 6, z0 + f, z0 + l.h - f));
  } else {
    p.add(l.mat, local(0, len, -t / 2, t / 2, z0, z0 + l.h));
    // სახელური
    const hz = 1000;
    p.add('metal', local(len - 120, len - 60, -t / 2 - 45, t / 2 + 45, hz - 12, hz + 12));
  }
  p.into(g, l.id);
  const inner = new THREE.Group();
  inner.add(...g.children);
  inner.position.set(x1 * M, 0, y1 * M);
  inner.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
  g.add(inner);
  return g;
}

// ------------------------------------------------------------------ მთავარი ფუნქცია
export function buildModel() {
  const root = new THREE.Group();
  root.name = 'Gamarjveba_House';
  root.userData = { units: 'meters', origin: 'ჩრდილო-დასავლეთის გარე კუთხე, იატაკის დონე (±0.000)', source: 'დავით კვარაცხელია - ტექნიკური ნახაზები.pdf (A.8–A.16)' };
  const G = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };
  const groups = {
    site: G('Site_Plinth_Terrace_Steps'),
    floor: G('Floors'),
    exterior: G('Walls_Exterior'),
    interior: G('Walls_Interior'),
    furniture: G('Furniture'),
    ceiling: G('Ceiling_Roof'),
  };

  // ცოკოლი, ტერასა, შესასვლელი, საფეხურები
  {
    const p = new Parts();
    for (const r of PLINTH) p.box('plinth', r, H.ground, -H.finish);
    const g = infoGroup('Plinth', { kind: 'ცოკოლი', name: 'ცოკოლი (საძირკვლის ზედა ნაწილი)', size: { 'სიმაღლე': fmt(-H.ground) }, status: { 'სიმაღლე': 'assumed', 'მდებარეობა': 'vec' }, note: 'მიწის ნიშნული PDF-ში არ წერია; აღებულია 4 საფეხური × 150 მმ.', sheets: ['A.8'] });
    groups.site.add(p.into(g, 'Plinth'));
    const pp = new Parts();
    pp.box('stone', PORCH, -H.finish, 0);
    groups.site.add(pp.into(infoGroup('Porch', { kind: 'შესასვლელი', name: 'შესასვლელის მოედანი', size: { 'სიგანე': fmt(PORCH[2] - PORCH[0]), 'სიღრმე': fmt(PORCH[3] - PORCH[1]) }, status: { 'სიგანე': 'vec', 'სიღრმე': 'vec', 'მდებარეობა': 'vec' }, sheets: ['A.8', 'A.9'] }), 'Porch'));
    for (const s of STEPS) {
      const sp = new Parts();
      sp.box('stone', s.r, H.ground, s.top);
      groups.site.add(sp.into(infoGroup(s.id, { code: s.id, kind: 'საფეხური', name: `საფეხური ${s.id.startsWith('ST-N') ? '(ტერასა)' : '(შესასვლელი)'}`, size: { 'სიგანე': fmt(s.r[2] - s.r[0]), 'სიღრმე': fmt(s.r[3] - s.r[1]), 'ზედა ნიშნული': fmt(s.top) }, status: { 'სიგანე': 'vec', 'სიღრმე': 'vec', 'ზედა ნიშნული': 'assumed', 'მდებარეობა': 'vec' }, sheets: ['A.8', 'A.9'] }), s.id));
    }
  }

  // იატაკი
  for (const room of ROOMS) {
    const p = new Parts();
    for (const r of room.rects) p.box(room.mat, r, -H.finish, 0);
    const area = room.rects.reduce((a, [x0, y0, x1, y1]) => a + (x1 - x0) * (y1 - y0), 0) / 1e6;
    const g = infoGroup(`Floor_${room.id}`, {
      code: room.id, kind: room.exterior ? 'ტერასა' : 'ოთახი', name: `${room.id === 'T' ? '' : room.id + ' · '}${room.name}`,
      size: { 'ფართობი (PDF)': room.area, 'ფართობი (მოდელი)': `${area.toFixed(1)} მ²`, 'მოპირკეთება': COLORS[room.mat].name },
      status: { 'ფართობი (PDF)': 'pdf', 'ფართობი (მოდელი)': 'vec', 'მოპირკეთება': 'render', 'მდებარეობა': 'pdf' },
      note: 'მოდელის ფართობი — სუფთა კედლებს შორის (ბათქაშის 15 მმ-ის გარეშე).', sheets: ['A.8'],
    });
    groups.floor.add(p.into(g, `Floor_${room.id}`));
  }
  {
    const p = new Parts();
    for (const [x0, y0, x1, y1, m] of THRESHOLDS) p.box(m, [x0, y0, x1, y1], -H.finish, 0);
    const g = new THREE.Group(); g.name = 'Thresholds';
    groups.floor.add(p.into(g, 'Threshold'));
  }

  // კედლები, სვეტები
  for (const w of WALLS) {
    const target = w.kind === 'int' ? groups.interior : groups.exterior;
    const g = buildWall(w);
    const f = INNER_FACES[w.id];
    if (f) g.add(mesh(paintGeo(w.r, f[0], f[1], f[2]), 'wallInt', `${w.id}_inner`));
    target.add(g);
  }
  // ღიობები, კარები, მინები
  for (const o of OPENINGS) (o.kind === 'ext' ? groups.exterior : groups.interior).add(buildOpeningFill(o));
  for (const l of LEAVES) {
    const o = OPENINGS.find((q) => q.id === l.open);
    (o.kind === 'ext' ? groups.exterior : groups.interior).add(buildLeaf(l));
  }
  // ფასადის ხის პანელი (რენდერი)
  {
    const p = new Parts();
    for (const [a, b, z0, z1] of CLADDING.spans) {
      p.box('slat', [a, CLADDING.y - 8, b, CLADDING.y], z0, z1);
      for (let x = a + 10; x + CLADDING.fin <= b; x += CLADDING.pitch) p.box('slat', [x, CLADDING.y - CLADDING.depth, x + CLADDING.fin, CLADDING.y - 8], z0, z1);
    }
    const g = infoGroup('Facade_Cladding', { kind: 'ფასადის მოპირკეთება', name: 'ღარებიანი PVC პანელი — ტერასის ფასადი', size: { 'სიმაღლე': fmt(H.ceiling) }, status: { 'სიმაღლე': 'assumed', 'მდებარეობა': 'render' }, note: 'მხოლოდ რენდერზეა (A08 „ტერასა“): დასაკეცი კარის ორივე მხარეს. ზუსტი საზღვრები ნახაზზე არ არის.', sheets: [] });
    groups.exterior.add(p.into(g, 'Facade_Cladding'));
  }

  // ავეჯი
  for (const f of FURNITURE) groups.furniture.add(buildFurnitureItem(f));

  // ჭერი / სახურავი
  {
    const p = new Parts();
    p.box('roof', ROOF.r, ROOF.z0, ROOF.z1);
    const g = infoGroup('Roof', { kind: 'ჭერი / სახურავი', name: 'სახურავის ფილა (ჭერი 3.00 მ-ზე)', size: { 'სიგრძე': fmt(ROOF.r[2] - ROOF.r[0]), 'სიღრმე': fmt(ROOF.r[3] - ROOF.r[1]), 'ჭერის სიმაღლე': fmt(ROOF.z0), 'სისქე': fmt(ROOF.z1 - ROOF.z0) }, status: { 'სიგრძე': 'pdf', 'სიღრმე': 'vec', 'ჭერის სიმაღლე': 'assumed', 'სისქე': 'assumed', 'მდებარეობა': 'vec' }, note: 'გეგმა სახურავს არ აჩვენებს; კონტური = გარე კედლების ჩარჩო (ტერასისა და შესასვლელის ჩათვლით), რენდერი A08.', sheets: ['A.12'] });
    groups.ceiling.add(p.into(g, 'Roof'));
  }

  root.updateMatrixWorld(true);
  return { root, groups };
}
