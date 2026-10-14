// გამარჯვების სახლი — განათების სისტემის გეომეტრია (რელსები, ორთავიანი სანათები, ორმაგი და ერთმაგი ჩაშენებული სანათები).
// ჯგუფი „Lighting_Fixtures“ მოდელის ძირში ცალკეა (ჭერის ჯგუფში არ არის) — ჭერის დამალვა სანათებს არ მალავს.
// მანათობელი ნაწილების მასალა ჯგუფზეა საერთო (lensMaterials) — სანახავი ცვლის მათ ფერს (K) და სიკაშკაშეს.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CEILING, RAILS, DOUBLES, SINGLES, GROUPS, DIM, lightRGB } from './lighting.js';

const M = 0.001;
const mat = (name, color, rough, metal = 0, extra = {}) => Object.assign(new THREE.MeshStandardMaterial({ name, color: new THREE.Color(color), roughness: rough, metalness: metal }), extra);
const MAT = {
  railBlack: mat('lighting_rail_black', '#1c1c1d', 0.45, 0.4),
  headWhite: mat('lighting_head_white', '#f1f0ec', 0.38),
  trimWhite: mat('lighting_trim_white', '#f4f3ef', 0.45),
  innerDark: mat('lighting_inner_dark', '#2d2c2b', 0.5, 0.3),
  ringBronze: mat('lighting_ring_bronze', '#6b5a49', 0.35, 0.7),
};
for (const m of Object.values(MAT)) m.userData = { description: 'განათების სისტემა — კორპუსი' };
// მანათობელი ზედაპირი თითო ჯგუფზე (ფერი = K, emissive — ჩართვა / სიკაშკაშე)
export const lensMaterials = {};
for (const [k, g] of Object.entries(GROUPS)) {
  const [r, gg, b] = lightRGB(g.cct);
  const c = new THREE.Color().setRGB(r, gg, b, THREE.LinearSRGBColorSpace);
  lensMaterials[k] = new THREE.MeshStandardMaterial({ name: `lighting_lens_${g.cct}K`, color: '#f6f4ef', roughness: 0.3, emissive: c, emissiveIntensity: 2.2 });
  lensMaterials[k].userData = { description: `მანათობელი ზედაპირი ${g.cct}K`, cct: g.cct };
}

// ---- დამხმარეები (მმ → მ; y — სიმაღლე)
const at = (g, x, y, z) => g.translate(x * M, y * M, z * M);
const box = (w, h, d) => new THREE.BoxGeometry(w * M, h * M, d * M);
const cyl = (r, h, seg = 24) => new THREE.CylinderGeometry(r * M, r * M, h * M, seg);
function meshOf(list, material, name) {
  const indexed = list.every((q) => q.index);
  const g = list.length === 1 ? list[0] : mergeGeometries(indexed ? list : list.map((q) => q.index ? q.toNonIndexed() : q), false);
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.castShadow = false; // მცირე დეტალები — ჩრდილს არ აგდებენ (წარმადობა)
  m.receiveShadow = true;
  return m;
}
// წარმადობა: 53 სანათი × 2–3 მასალა = ~150 ცალკე მეში (draw call). ამიტომ გეომეტრია ერთიანდება ქვეჯგუფისა და მასალის
// მიხედვით (≈12 მეში), ხოლო თითო სანათს რჩება საკუთარი კვანძი (კოდი, ინფორმაცია, ადგილი) და უხილავი არჩევის ყუთი.
const PICK_MAT = new THREE.MeshBasicMaterial({ name: 'lighting_pick_proxy', visible: false });
function item(name, info, parts, buckets) {
  const g = new THREE.Group();
  g.name = name;
  g.userData.info = info;
  const bb = new THREE.Box3();
  for (const [material, list] of parts) for (const q of list) {
    q.computeBoundingBox(); bb.union(q.boundingBox);
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material).push(q);
  }
  const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), pad = 0.02; // pad — მცირე სანათის ადვილად ასარჩევად
  g.position.copy(c); // კვანძი — სანათის ცენტრში (GLB-შიც)
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(sz.x + pad, sz.y + pad, sz.z + pad), PICK_MAT);
  proxy.name = name + '_pick';
  proxy.userData.pickProxy = true; // მხოლოდ სანახავისთვის (GLB-ში არ გადის)
  g.add(proxy);
  return g;
}
function flush(subGroup, buckets, prefix) {
  for (const [material, list] of buckets) {
    const m = meshOf(list, material, `${prefix}_${material.name}`);
    m.userData.noPick = true; // არჩევა — სანათის ყუთით
    subGroup.add(m);
  }
}
const st = (o) => ({ 'მდებარეობა': 'vec', ...o });

// ---- ორთავიანი სანათი რელსზე: ადაპტერი + ორი ცილინდრი (რენდერი A01/A03)
function railFixture(x, y, emit, gid, idx, zone) {
  const { r, len, gap, drop } = DIM.head, top = CEILING - DIM.rail.h;
  const body = [], dark = [], lens = [];
  dark.push(at(box(36, 26, 120), x, top - 13, y));                               // ადაპტერი რელსის ქვეშ
  dark.push(at(box(18, drop - 26, 18), x, top - 26 - (drop - 26) / 2, y));        // საკიდი
  dark.push(at(box(22, 14, gap + 2 * r), x, top - drop, y));                      // ძელი რელსის გასწვრივ (ორი თავი — რელსის მიმართულებით, რენდერი A03)
  for (const s of [-1, 1]) {
    const cz = y + s * gap / 2, cy = top - drop - 7 - len / 2;
    body.push(at(cyl(r, len), x, cy, cz));
    dark.push(at(cyl(r - 5, 6), x, cy - len / 2 - 1, cz));                        // შავი შიდა რგოლი
    lens.push(at(cyl(r - 11, 4), x, cy - len / 2 - 2, cz));
    emit.push({ group: gid, fixture: idx, zone, x, y: cy - len / 2 - 4, z: cz, dir: [0, -1, 0] });
  }
  return [[MAT.headWhite, body], [MAT.railBlack, dark], [lensMaterials.rail, lens]];
}

export function buildLighting() {
  const root = new THREE.Group();
  root.name = 'Lighting_Fixtures';
  root.userData = { note: 'ჭერის განათების სისტემა — A.11/A.12/A.13 + რენდერები; ჭერის ჯგუფისგან დამოუკიდებელი' };
  const sub = {};
  for (const [k, n] of [['rail', 'Rails_Spots_4500K'], ['double', 'Double_Downlights_3000K'], ['single', 'Single_Downlights_3000K']]) {
    sub[k] = new THREE.Group(); sub[k].name = n; root.add(sub[k]);
  }
  const bk = { rail: new Map(), double: new Map(), single: new Map() }; // გეომეტრია მასალების მიხედვით
  const emitters = [];   // ყოველი მანათობელი ელემენტი (ხედის სინათლის წყაროებისთვის)
  const marks = [];      // გეგმის ნიშნულები: { group, kind, x, z, w, l }

  // ---- რელსები და მათი სანათები
  RAILS.forEach((rl, ri) => {
    const L = rl.y1 - rl.y0, top = CEILING - DIM.rail.h;
    const rail = at(box(DIM.rail.w, DIM.rail.h, L), rl.x, top + DIM.rail.h / 2, (rl.y0 + rl.y1) / 2);
    const caps = [at(box(DIM.rail.w + 4, DIM.rail.h + 2, 6), rl.x, top + DIM.rail.h / 2, rl.y0 + 3), at(box(DIM.rail.w + 4, DIM.rail.h + 2, 6), rl.x, top + DIM.rail.h / 2, rl.y1 - 3)];
    sub.rail.add(item(rl.id, {
      code: rl.id, kind: 'სანათის რელსი', zone: `ოთახი ${rl.zone}`, name: `რელსი ${(L / 1000).toFixed(2)} მ (${GROUPS.rail.cct}K სანათებით)`,
      size: { 'სიგრძე': (L / 1000).toFixed(2), 'სიგანე': (DIM.rail.w / 1000).toFixed(3), 'სიმაღლე': (DIM.rail.h / 1000).toFixed(3), 'დამონტაჟება': 'ჭერზე, 3.00 მ' },
      status: st({ 'სიგრძე': 'pdf', 'სიგანე': 'vec', 'სიმაღლე': 'assumed', 'დამონტაჟება': 'assumed' }),
      note: `A.12: ${L} მმ${rl.zone === '01' ? ', TV-ნიშიდან 1620 / 1470 მმ' : ''}. სანათების რაოდენობა რელსზე (${rl.fixtures}) — რენდერიდან (A0${rl.zone === '01' ? 1 : 3}); ნახაზზე არ არის.`,
      sheets: ['A.11', 'A.12'],
    }, [[MAT.railBlack, [rail, ...caps]]], bk.rail));
    marks.push({ group: 'rail', kind: 'rail', x: rl.x, z: (rl.y0 + rl.y1) / 2, w: 60, l: L });
    for (let f = 0; f < rl.fixtures; f++) {
      const y = rl.y0 + L * (f + 0.5) / rl.fixtures; // თანაბრად — ვარაუდი (ზუსტი ადგილი ნახაზზე არ არის)
      const parts = railFixture(rl.x, y, emitters, 'rail', `${rl.id}-${f + 1}`, rl.zone);
      sub.rail.add(item(`${rl.id}-S${f + 1}`, {
        code: `${rl.id}-S${f + 1}`, kind: 'წერტილოვანი სანათი რელსზე', zone: `ოთახი ${rl.zone}`, name: 'ორთავიანი წერტილოვანი სანათი — 4500K',
        size: { 'ფერის ტემპ.': '4500 K', 'ელემენტები': '2', 'ნაკადი': `${GROUPS.rail.lumen} lm × 2`, 'სხივის კუთხე': `${GROUPS.rail.beam}°`, 'თავის ზომა': `Ø${DIM.head.r * 2} × ${DIM.head.len} მმ` },
        status: { 'ფერის ტემპ.': 'spec', 'ელემენტები': 'render', 'ნაკადი': 'assumed', 'სხივის კუთხე': 'assumed', 'თავის ზომა': 'assumed', 'მდებარეობა': 'assumed' },
        note: 'ფორმა — რენდერებიდან (შავი ადაპტერი, ორი თეთრი ცილინდრი). ადგილი რელსზე — თანაბრად განაწილებული (ვარაუდი); მიმართულება — ქვემოთ (ვარაუდი).',
        sheets: ['A.12'],
      }, parts, bk.rail));
      marks.push({ group: 'rail', kind: 'spot', x: rl.x, z: y, w: 2 * DIM.head.r, l: DIM.head.gap + 2 * DIM.head.r });
    }
  });

  // ---- ორმაგი ჩაშენებული სანათები
  for (const d of DOUBLES) {
    const { w, l, lens: lr, pitch } = DIM.double;
    const trim = [at(box(w, 8, l), d.x, CEILING - 4, d.y)], dark = [], lens = [];
    for (const s of [-1, 1]) {
      const z = d.y + s * pitch / 2;
      dark.push(at(cyl(lr + 7, 4), d.x, CEILING - 9, z));
      lens.push(at(cyl(lr, 3), d.x, CEILING - 11, z));
      emitters.push({ group: 'double', fixture: d.id, zone: d.zone, x: d.x, y: CEILING - 12, z, dir: [0, -1, 0] });
    }
    sub.double.add(item(d.id, {
      code: d.id, kind: 'ორმაგი ჩაშენებული სანათი', zone: `ოთახი ${d.zone}`, name: 'ორმაგი წერტილოვანი სანათი — 3000K',
      size: { 'ფერის ტემპ.': '3000 K', 'ელემენტები': '2', 'კორპუსი': `${w} × ${l} მმ`, 'ნაკადი': `${GROUPS.double.lumen} lm × 2`, 'სხივის კუთხე': `${GROUPS.double.beam}°`, 'დამონტაჟება': 'ჭერში, 3.00 მ' },
      status: { 'ფერის ტემპ.': 'spec', 'ელემენტები': 'pdf', 'კორპუსი': 'vec', 'ნაკადი': 'assumed', 'სხივის კუთხე': 'assumed', 'დამონტაჟება': 'assumed', 'მდებარეობა': 'vec' },
      note: 'A.12 — ადგილი (ზომები 1653 / 2750 / 805 / 1235 მმ); A.13 „ჭერის წერტილოვანი – ორიანი“ — 13 ცალი. ფორმა — რენდერებიდან (ორი მრგვალი ელემენტი თეთრ მართკუთხა ჩარჩოში).',
      sheets: ['A.12', 'A.13'],
    }, [[MAT.trimWhite, trim], [MAT.innerDark, dark], [lensMaterials.double, lens]], bk.double));
    marks.push({ group: 'double', kind: 'double', x: d.x, z: d.y, w, l });
  }

  // ---- ერთმაგი ჩაშენებული სანათები
  for (const s of SINGLES) {
    const { d, lens: lr } = DIM.single;
    sub.single.add(item(s.id, {
      code: s.id, kind: 'ერთმაგი ჩაშენებული სანათი', zone: s.zone === 'T' ? 'ტერასა' : `ოთახი ${s.zone}`, name: 'წერტილოვანი სანათი — 3000K',
      size: { 'ფერის ტემპ.': '3000 K', 'ელემენტები': '1', 'დიამეტრი': `Ø${d} მმ`, 'ნაკადი': `${GROUPS.single.lumen} lm`, 'სხივის კუთხე': `${GROUPS.single.beam}°`, 'დამონტაჟება': 'ჭერში, 3.00 მ' },
      status: { 'ფერის ტემპ.': 'spec', 'ელემენტები': 'pdf', 'დიამეტრი': 'vec', 'ნაკადი': 'assumed', 'სხივის კუთხე': 'assumed', 'დამონტაჟება': 'assumed', 'მდებარეობა': 'vec' },
      note: 'A.12 / A.13 „წერტილოვანი“ (ტერასა 12, აბაზანა 9, საძინებელი 8). ფორმა — რენდერი A04 (მუქი ბრინჯაოს რგოლი).',
      sheets: ['A.12', 'A.13'],
    }, [[MAT.ringBronze, [at(cyl(d / 2, 8, 32), s.x, CEILING - 4, s.y)]], [MAT.innerDark, [at(cyl(lr + 9, 4, 28), s.x, CEILING - 9, s.y)]], [lensMaterials.single, [at(cyl(lr, 3, 28), s.x, CEILING - 11, s.y)]]], bk.single));
    emitters.push({ group: 'single', fixture: s.id, zone: s.zone, x: s.x, y: CEILING - 12, z: s.y, dir: [0, -1, 0] });
    marks.push({ group: 'single', kind: 'single', x: s.x, z: s.y, w: d, l: d });
  }
  flush(sub.rail, bk.rail, 'Rails_Spots');
  flush(sub.double, bk.double, 'Double_Downlights');
  flush(sub.single, bk.single, 'Single_Downlights');
  return { root, sub, emitters, marks };
}
