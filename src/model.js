// გამარჯვების სახლი — 3D გეომეტრიის აგება config.js-ისა და furniture-data.js-ის მიხედვით.
// იყენებს მხოლოდ three.js-ს (DOM-ის გარეშე) — მუშაობს ბრაუზერშიც და Node-შიც (GLB ექსპორტი).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  H, COLORS, WALLS, OPENINGS, LEAVES, ROOMS, THRESHOLDS, PLINTH, PORCH, STEPS, ROOF, CLADDING, STATUS_LABEL,
} from './config.js';
import { FURNITURE } from './furniture-data.js';

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

// ------------------------------------------------------------------ ავეჯი
const FUR_KIND = {
  wardrobe: 'კარადა', slab: 'თარო / ფილა', officeChair: 'სკამი', bed: 'საწოლი', nightstand: 'ტუმბო', kitchen: 'სამზარეულო',
  table: 'მაგიდა', chair: 'სკამი', sofa: 'დივანი', armchair: 'სავარძელი', coffee: 'მაგიდა', console: 'კონსოლი',
  tv: 'ტელევიზორი', slats: 'ღარებიანი ტიხარი', mirror: 'სარკე', vanity: 'ნიჟარის კარადა', box: 'ყუთი', wc: 'უნიტაზი',
  glass: 'მინის ტიხარი', towel: 'საშრობი',
};
function furnitureInfo(f) {
  const [x0, y0, x1, y1] = f.r;
  const fr = frameOf(f.r, f.face || (x1 - x0 >= y1 - y0 ? 'y1' : 'x1'));
  const z0 = f.z0 ?? 0, h = (f.h ?? 0) - z0;
  const size = { 'სიგრძე': fmt(fr.L), 'სიღრმე': fmt(fr.D), 'სიმაღლე': fmt(h) };
  if (z0 > 0) size['ქვედა ნიშნული'] = fmt(z0);
  const st = f.st || {};
  return {
    code: f.code || f.id, kind: FUR_KIND[f.type], zone: f.zone ? `ოთახი ${f.zone}` : '', name: f.name, size,
    status: { 'სიგრძე': st.w || 'vec', 'სიღრმე': st.d || 'vec', 'სიმაღლე': st.h || 'assumed', 'ქვედა ნიშნული': st.h || 'assumed', 'მდებარეობა': st.pos || 'vec' },
    note: f.note, sheets: f.code ? ['A.8', f.code === 'F1' || f.code === 'F2' || f.code === 'F3' || f.code === 'F4' ? 'A.15' : 'A.16'] : ['A.8'],
  };
}
const BUILD = {
  wardrobe(f, p) {
    const fr = frameOf(f.r, f.face);
    const front = 18, gap = 4;
    const mods = f.mods.map((m) => (typeof m === 'number' ? { w: m } : { w: parseInt(m), open: m.endsWith('o'), flute: m.endsWith('f') }));
    const total = mods.reduce((s2, m) => s2 + m.w, 0), k = fr.L / total;
    let u = 0;
    const edges = [];
    mods.forEach((m) => {
      const a = u, b = u + m.w * k;
      u = b; edges.push(b);
      if (m.w <= 20) { p.box(f.mat, fr.rect(a, 0, b, fr.D), 0, f.h); return; }      // გვერდითი ფილა
      if (m.open) {
        // ღია თაროები: ზურგი, გვერდები, თაროები ყოველ ~380 მმ-ში (ფონი — თეთრი)
        p.box('white', fr.rect(a, 0, b, fr.D - 300), 0, f.h);
        p.box(f.mat, fr.rect(a, fr.D - 300, a + 18, fr.D), 0, f.h);
        p.box(f.mat, fr.rect(b - 18, fr.D - 300, b, fr.D), 0, f.h);
        p.box(f.mat, fr.rect(a + 18, fr.D - 300, b - 18, fr.D), 0, 60);
        p.box(f.mat, fr.rect(a + 18, fr.D - 300, b - 18, fr.D), f.h - 22, f.h);
        for (let z = 400; z < f.h - 150; z += 380) p.box(f.mat, fr.rect(a + 18, fr.D - 300, b - 18, fr.D), z, z + 22);
        return;
      }
      p.box(f.mat, fr.rect(a, 0, b, fr.D - front), 0, f.h);
      const sp = f.split && f.split < f.h ? [[0, f.split - gap / 2], [f.split + gap / 2, f.h]] : [[0, f.h]];
      for (const [z0, z1] of sp) {
        p.box(f.mat, fr.rect(a + gap / 2, fr.D - front, b - gap / 2, fr.D), z0, z1);
        if (m.flute) for (let q = a + 20; q < b - 34; q += 30) p.box(f.mat, fr.rect(q, fr.D, q + 14, fr.D + 6), z0, z1);
      }
    });
    if (f.handles) {
      const [h0, h1] = f.handleZ;
      for (const i of f.handles) { const e = edges[i - 1]; p.box('metal', fr.rect(e - 32, fr.D, e - 18, fr.D + 30), h0, h1); p.box('metal', fr.rect(e + 18, fr.D, e + 32, fr.D + 30), h0, h1); }
    }
  },
  slab(f, p) { p.box(f.mat, f.r, f.z0 ?? 0, f.h); },
  box(f, p) { p.box(f.mat, f.r, f.z0 ?? 0, f.h); },
  officeChair(f, p) {
    const fr = frameOf(f.r, f.face);
    const cu = fr.L / 2, cv = fr.D / 2;
    p.box('blackMetal', fr.rect(cu - 25, cv - 25, cu + 25, cv + 25), 60, 430);
    p.box('blackMetal', fr.rect(cu - 280, cv - 25, cu + 280, cv + 25), 30, 60);
    p.box('blackMetal', fr.rect(cu - 25, cv - 280, cu + 25, cv + 280), 30, 60);
    p.box(f.mat, fr.rect(cu - 240, cv - 230, cu + 240, cv + 230), 430, 500);
    p.box(f.mat, fr.rect(cu - 230, 40, cu + 230, 100), 520, f.h);
  },
  bed(f, p) {
    const fr = frameOf(f.r, f.face === 'x1' ? 'x0' : f.face === 'x0' ? 'x1' : f.face === 'y1' ? 'y0' : 'y1'); // v=0 — სათავე
    const R = fr.rect; // face — სათავის მხარე (კედელთან); ლოკალურად v იზომება სათავიდან
    p.box(f.mat, R(0, 0, fr.L, 90), 0, f.h);                         // სათავე
    p.box(f.mat, R(0, 90, fr.L, fr.D), 60, 330);                     // საწოლის ჩარჩო
    p.box('bedding', R(30, 100, fr.L - 30, fr.D - 20), 330, 560);    // ლეიბი
    p.box('fabricWarm', R(10, fr.D * 0.62, fr.L - 10, fr.D - 10), 560, 575); // გადასაფარებელი
    const pw = Math.min(700, (fr.L - 160) / 2);
    p.box('bedding', R(60, 120, 60 + pw, 470), 560, 690);
    p.box('bedding', R(fr.L - 60 - pw, 120, fr.L - 60, 470), 560, 690);
  },
  nightstand(f, p) {
    const fr = frameOf(f.r, f.face);
    p.box(f.mat, fr.rect(0, 0, fr.L, fr.D), 80, f.h);
    p.box('oak', fr.rect(30, 30, fr.L - 30, fr.D - 30), 0, 80);
    p.box('metal', fr.rect(fr.L / 2 - 50, fr.D, fr.L / 2 + 50, fr.D + 10), f.h - 110, f.h - 95);
  },
  kitchen(f, p) {
    const fr = frameOf(f.r, f.face);
    let u = 0;
    const edges = f.mods.map((w) => [u, (u += w)]);
    const front = 18;
    const tallA = edges[0], tallB = edges[edges.length - 1];
    // მაღალი სვეტები (ღუმელები / მაცივარი)
    for (const [a, b] of [tallA, tallB]) {
      p.box('white', fr.rect(a, 0, b, fr.D - front), 0, f.h);
      p.box('white', fr.rect(a + 2, fr.D - front, b - 2, fr.D), 100, f.h);
      p.box('appliance', fr.rect(a, 0, b, fr.D - 30), 0, 100);
    }
    // ღუმელები — ჩრდილოეთის სვეტში (OV/MW)
    for (const [z0, z1] of f.ovens) p.box('appliance', fr.rect(tallA[0] + 20, fr.D - 4, tallA[1] - 20, fr.D + 4), z0 + 15, z1 - 15);
    // მაცივრის კარის ჭრილი
    p.box('appliance', fr.rect(tallB[0] + 6, fr.D, tallB[1] - 6, fr.D + 2), 1800, 1806);
    const a0 = tallA[1], a1 = tallB[0];
    // ქვედა კარადები, ცოკოლი, სამუშაო ზედაპირი
    p.box('white', fr.rect(a0, 0, a1, fr.D - front - 50), 100, f.base - f.top);
    p.box('appliance', fr.rect(a0, 0, a1, fr.D - 70), 0, 100);
    for (const [a, b] of edges.slice(1, -1)) p.box('white', fr.rect(a + 2, fr.D - front - 50, b - 2, fr.D - 50), 100, f.base - f.top);
    p.box('worktop', fr.rect(a0, 0, a1, fr.D), f.base - f.top, f.base);
    // ზურგი (600) და ზედა კარადები (ხის ტონი, რენდერი A01)
    p.box('worktop', fr.rect(a0, 0, a1, 15), f.base, f.base + 600);
    p.box('oak', fr.rect(a0, 0, a1, f.upperDepth), f.base + 600, f.h);
    for (const [a, b] of edges.slice(1, -1)) p.box('oak', fr.rect(a + 2, f.upperDepth, b - 2, f.upperDepth + 4), f.base + 600, f.h);
    // გაზქურა და ნიჟარა (A.8 კონტური)
    const [hx0, hy0, hx1, hy1] = [f.r[0] + 35, f.hob[0], f.r[2] - 45, f.hob[1]];
    p.box('screen', [hx0, hy0, hx1, hy1], f.base, f.base + 6);
    p.box('metal', [f.r[0] + 70, f.sink[0], f.r[2] - 70, f.sink[1]], f.base - 2, f.base + 3);
    p.box('metal', [f.r[0] + 40, (f.sink[0] + f.sink[1]) / 2 - 15, f.r[0] + 70, (f.sink[0] + f.sink[1]) / 2 + 15], f.base, f.base + 280);
  },
  table(f, p) {
    const [x0, y0, x1, y1] = f.r;
    p.box(f.mat, f.r, f.h - 30, f.h);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, lx = (x1 - x0) / 2 - 220, ly = (y1 - y0) / 2 - 220;
    // ორი ხის საყრდენი (რენდერი A01: ხის კვარცხლბეკი)
    if (y1 - y0 > x1 - x0) { p.box('oak', [cx - 180, cy - ly - 40, cx + 180, cy - ly + 40], 0, f.h - 30); p.box('oak', [cx - 180, cy + ly - 40, cx + 180, cy + ly + 40], 0, f.h - 30); }
    else { p.box('oak', [cx - lx - 40, cy - 180, cx - lx + 40, cy + 180], 0, f.h - 30); p.box('oak', [cx + lx - 40, cy - 180, cx + lx + 40, cy + 180], 0, f.h - 30); }
  },
  chair(f, p) {
    const fr = frameOf(f.r, f.face);
    const L = fr.L, D = fr.D;
    for (const [u, v] of [[40, 40], [L - 40, 40], [40, D - 40], [L - 40, D - 40]]) p.box('oak', fr.rect(u - 15, v - 15, u + 15, v + 15), 0, 440);
    p.box(f.mat, fr.rect(20, 20, L - 20, D - 10), 440, 480);
    p.box(f.mat, fr.rect(30, 10, L - 30, 50), 480, f.h);
  },
  sofa(f, p) {
    const fr = frameOf(f.r, f.face);
    const L = fr.L, D = fr.D, arm = 150, back = 290;
    p.box(f.mat, fr.rect(0, 0, L, back), 80, f.h);
    p.box(f.mat, fr.rect(0, 0, arm, D), 80, 600);
    p.box(f.mat, fr.rect(L - arm, 0, L, D), 80, 600);
    p.box(f.mat, fr.rect(arm, back, L - arm, D), 80, 300);
    const n = 2, cw = (L - 2 * arm) / n;
    for (let i = 0; i < n; i++) p.box('fabricWarm', fr.rect(arm + i * cw + 8, back, arm + (i + 1) * cw - 8, D - 10), 300, 430);
    p.box('oak', fr.rect(20, 20, L - 20, D - 20), 0, 80);
  },
  armchair(f, p) {
    const fr = frameOf(f.r, f.face);
    const L = fr.L, D = fr.D;
    // ხის ჩარჩო (რენდერი A01) + რბილი ბალიშები
    p.box('oakDark', fr.rect(0, 0, 45, D), 0, 600); p.box('oakDark', fr.rect(L - 45, 0, L, D), 0, 600);
    p.box('oakDark', fr.rect(45, 60, L - 45, 120), 150, f.h);
    p.box(f.mat, fr.rect(45, 100, L - 45, D - 20), 220, 420);
    p.box(f.mat, fr.rect(60, 110, L - 60, 230), 420, f.h - 30);
  },
  coffee(f, p) {
    const [x0, y0, x1, y1] = f.r;
    p.box(f.mat, f.r, f.h - 40, f.h);
    p.box('oakDark', [x0 + 80, y0 + 80, x1 - 80, y1 - 80], 0, f.h - 40);
  },
  console(f, p) {
    const fr = frameOf(f.r, f.face);
    const z0 = f.z0, z1 = f.h;
    p.box(f.mat, fr.rect(0, 0, fr.L, fr.D - 18), z0, z1);
    const n = f.drawers, w = fr.L / n;
    for (let i = 0; i < n; i++) p.box(f.mat, fr.rect(i * w + 2, fr.D - 18, (i + 1) * w - 2, fr.D), z0 + 2, z1 - 2);
    if (f.legs) for (const u of [80, fr.L - 80]) for (const v of [60, fr.D - 60]) p.box('blackMetal', fr.rect(u - 15, v - 15, u + 15, v + 15), 0, z0);
  },
  tv(f, p) {
    const fr = frameOf(f.r, f.face);
    p.box('blackMetal', fr.rect(0, 0, fr.L, fr.D - 6), f.z0, f.h);
    p.box('screen', fr.rect(8, fr.D - 6, fr.L - 8, fr.D), f.z0 + 8, f.h - 8);
  },
  slats(f, p) {
    const [x0, y0, x1, y1] = f.r;
    const pitch = (x1 - x0 - f.slat) / (f.n - 1);
    for (let i = 0; i < f.n; i++) { const a = x0 + i * pitch; p.box(f.mat, [a, y0, a + f.slat, y1], 0, f.h); }
  },
  mirror(f, p) {
    const fr = frameOf(f.r, f.face);
    p.box('frame', fr.rect(0, 0, fr.L, fr.D - 4), f.z0, f.h);
    p.box('mirror', fr.rect(6, fr.D - 4, fr.L - 6, fr.D), f.z0 + 6, f.h - 6);
  },
  vanity(f, p) {
    const fr = frameOf(f.r, f.face);
    p.box(f.mat, fr.rect(0, 0, fr.L, fr.D - 20), f.z0, f.h - 20);
    if (f.fluted) for (let q = 15; q < fr.L - 15; q += 32) p.box(f.mat, fr.rect(q, fr.D - 20, q + 18, fr.D), f.z0, f.h - 20);
    else p.box(f.mat, fr.rect(0, fr.D - 20, fr.L, fr.D), f.z0, f.h - 20);
    p.box('worktop', fr.rect(0, 0, fr.L, fr.D), f.h - 20, f.h);
    if (f.basin) {
      if (f.basinH > 0) {
        p.box('ceramic', f.basin, f.h, f.h + f.basinH);
      } else p.box('ceramic', f.basin, f.h, f.h + 4);
      const [bx0, by0, bx1, by1] = f.basin, cy = (by0 + by1) / 2;
      const wall = f.face === 'x1' ? f.r[0] : f.r[2];
      p.box('metal', [wall + (f.face === 'x1' ? 10 : -60), cy - 15, wall + (f.face === 'x1' ? 60 : -10), cy + 15], f.h + Math.max(f.basinH, 0) + 40, f.h + Math.max(f.basinH, 0) + 220);
    }
  },
  wc(f, p) {
    const fr = frameOf(f.r, f.face);
    p.box('ceramic', fr.rect(0, 0, fr.L, fr.D * 0.3), 180, 420);
    const [a, b, c2, d2] = fr.rect(0, fr.D * 0.25, fr.L, fr.D);
    const bowl = new THREE.CylinderGeometry(0.5, 0.42, 0.24, 28);
    bowl.scale((c2 - a) * M, 1, (d2 - b) * M);
    bowl.translate((a + c2) / 2 * M, 0.30, (b + d2) / 2 * M);
    p.add('ceramic', bowl);
  },
  glass(f, p) {
    p.add('glass', boxGeo(f.r, 0, f.h));
    const [x0, y0, x1, y1] = f.r;
    if (x1 - x0 > y1 - y0) { p.box('metal', [x0, y0 - 5, x1, y1 + 5], f.h - 20, f.h); } else { p.box('metal', [x0 - 5, y0, x1 + 5, y1], f.h - 20, f.h); }
  },
  towel(f, p) {
    const [x0, y0, x1, y1] = f.r;
    p.box('metal', [x0, y0, x1, y0 + 25], f.z0, f.h); p.box('metal', [x0, y1 - 25, x1, y1], f.z0, f.h);
    for (let z = f.z0 + 60; z < f.h - 30; z += 110) p.box('metal', [x0 + 20, y0, x1 - 20, y1], z, z + 22);
  },
};
function buildFurniture(f) {
  const g = infoGroup(f.id, furnitureInfo(f));
  const p = new Parts();
  BUILD[f.type](f, p);
  return p.into(g, f.id);
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
  for (const f of FURNITURE) groups.furniture.add(buildFurniture(f));

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
