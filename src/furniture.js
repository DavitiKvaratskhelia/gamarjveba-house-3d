// გამარჯვების სახლი — ავეჯის 3D რეკონსტრუქცია რენდერების მიხედვით („დავით კვარაცხელია რენდერები.pdf“, A01–A08).
//
// ყოველი ნივთი აიგება საკუთარ ლოკალურ სისტემაში (მმ):
//   x — სიგრძე (0…L; ფასადის მხრიდან შეხედვისას მარცხნიდან მარჯვნივ — ნახაზების ხედის მიმართულება),
//   y — სიმაღლე იატაკიდან, z — სიღრმე (0 = ზურგი / კედელი, D = წინა მხარე).
// შემდეგ ჯგუფი ბრუნდება `face`-ის მიხედვით და დგება გეგმის კონტურში (furniture-data.js → r).
// UV-ები ითვლება რეალურ მმ-ში (ფაქტურის ზომის მიხედვით) — ფაქტურა არ იჭიმება და ბოჭკოს მიმართულება იმართება `grain`-ით.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { woodTextures, marbleTextures, fabricTextures, wovenTextures } from './textures.js';

const M = 0.001;
const DEG = Math.PI / 180;

// ================================================================ მასალები
// kind: wood | marble | fabric | woven | paint | metal | glass | emissive. color — მასალის საკუთარი ფერი
// (რენდერის თბილი განათების გარეშე შეფასებული). src: render | assumed.
export const FMAT = {
  // ხე
  oakLight:   { kind: 'wood', name: 'ღია მუხა (შპონი) — სამზარეულოს ზედა კარადები, TV-პანელები, F9, მაგიდა F4', wood: { base: '#cdb493', dark: '#a98c6b', light: '#dcc6a8', seed: 11, pores: 0.25 }, r: 0.62 },
  oakNatural: { kind: 'wood', name: 'ნატურალური მუხა — სასადილო სკამები და მაგიდის ფეხები', wood: { base: '#c4a27b', dark: '#9b7954', light: '#d3b590', seed: 21, size: [1600, 400], pores: 0.25 }, r: 0.55 },
  walnut:     { kind: 'wood', name: 'კაკალი — სავარძლების ჩარჩო, ჟურნალების მაგიდის საყრდენი, კომოდი 06', wood: { base: '#634634', dark: '#3e2a1d', light: '#7a5a43', seed: 31, contrast: 0.5, size: [1600, 400], pores: 0.25 }, r: 0.5 },
  smokedOak:  { kind: 'wood', name: 'შებოლილი მუხა — კარადა F8', wood: { base: '#86715f', dark: '#644f3f', light: '#9a8573', seed: 41, contrast: 0.45, pores: 0.25 }, r: 0.6 },
  oakGreige:  { kind: 'wood', name: 'ნაცრისფერ-ბეჟი მუხა — საწოლის კედლის პანელი 05', wood: { base: '#9c8775', dark: '#7a6655', light: '#ae9a88', seed: 71, contrast: 0.35, pores: 0.25 }, r: 0.62 },
  oakWarm:    { kind: 'wood', name: 'თბილი მუხა — საწოლის კედლის პანელი 05, კარადა F7', wood: { base: '#bb9a76', dark: '#94734f', light: '#cfb08c', seed: 51, pores: 0.25 }, r: 0.6 },
  teak:       { kind: 'wood', name: 'ტიკი — ტერასის ავეჯი', wood: { base: '#a97c4c', dark: '#7f5932', light: '#c09363', seed: 61, size: [1600, 400], pores: 0.25 }, r: 0.7 },
  // ქვა
  marbleWhite:{ kind: 'marble', name: 'თეთრი მარმარილო ნაცრისფერი ძარღვებით — სასადილო მაგიდა', marble: { base: '#efedea', vein: '#8b8783', vein2: '#bdb8b2', seed: 3, density: 2.6, width: 0.03 }, r: 0.18 },
  marbleGold: { kind: 'marble', name: 'Calacatta — თეთრი, ოქროსფერ-ნაცრისფერი ძარღვებით (ჟურნალების მაგიდა, კომოდი 06)', marble: { base: '#f0ede8', vein: '#8d857c', vein2: '#c9b38f', seed: 7, density: 2.2, width: 0.028 }, r: 0.15 },
  marbleViola:{ kind: 'marble', name: 'მარმარილო მუქი იისფერ-ნაცრისფერი ძარღვებით — ნიჟარის ზედაპირი 03, ტუმბოები 02', marble: { base: '#edecea', vein: '#4f4652', vein2: '#8f8995', seed: 13, density: 3.0, width: 0.045 }, r: 0.2 },
  stoneLight: { kind: 'paint', name: 'ღია ნაცრისფერი ქვა (სამზარეულოს ზედაპირი და ზურგი)', color: '#d9d5cf', r: 0.45 },
  terrazzo:   { kind: 'paint', name: 'ტერაცოს ფილა (ინსტალაციის ყუთი 03)', color: '#e5dbcd', r: 0.55 },
  porcelain:  { kind: 'paint', name: 'კერამოგრანიტი (ინსტალაციის ყუთი 04)', color: '#dcd5ca', r: 0.55 },
  // ქსოვილი
  sofaFabric: { kind: 'fabric', name: 'დივნის ქსოვილი — ღია ნაცრისფერ-ბეჟი (სელის ტიპის)', fabric: { base: '#cbc4b9', seed: 5, weave: 2.4 }, sheen: 0.35 },
  creamBoucle:{ kind: 'fabric', name: 'კრემისფერი ბუკლე — სავარძლების ბალიშები', fabric: { base: '#e3dbcf', seed: 6, weave: 3, boucle: 0.6 }, sheen: 0.3 },
  greyBoucle: { kind: 'fabric', name: 'ნაცრისფერი ბუკლე — საწოლი 02', fabric: { base: '#cdc8c1', seed: 8, weave: 3, boucle: 0.7 }, sheen: 0.25 },
  chairGrey:  { kind: 'fabric', name: 'ღია ნაცრისფერი ქსოვილი — სასადილოს რბილი სკამები', fabric: { base: '#d5d2cc', seed: 9, weave: 2.2, boucle: 0.3 }, sheen: 0.3 },
  roseVelvet: { kind: 'fabric', name: 'მტვრისფერი ვარდისფერი ხავერდი — სამუშაო სკამი 02', fabric: { base: '#a8847d', seed: 10, weave: 1.2 }, sheen: 0.9, sheenRough: 0.45 },
  mauveVelvet:{ kind: 'fabric', name: 'მოვისფერი ხავერდი — F9 სკამის ბალიში, საწოლის გადასაფარებელი 02', fabric: { base: '#a98e89', seed: 12, weave: 1.2 }, sheen: 0.9, sheenRough: 0.45 },
  greyVelvet: { kind: 'fabric', name: 'ნაცრისფერი ხავერდი — საწოლი 06', fabric: { base: '#a8a39d', seed: 14, weave: 1.2 }, sheen: 0.9, sheenRough: 0.5 },
  whiteUphol: { kind: 'fabric', name: 'თეთრი რბილი ზედაპირი — საწოლი 05', fabric: { base: '#efeeeb', seed: 15, weave: 1.6 }, sheen: 0.2 },
  linenWhite: { kind: 'fabric', name: 'თეთრი თეთრეული', fabric: { base: '#f3f1ed', seed: 16, weave: 1.4 }, sheen: 0.2 },
  linenGreige:{ kind: 'fabric', name: 'ბეჟი თეთრეული / ბალიშები', fabric: { base: '#cdbfae', seed: 17, weave: 1.6 }, sheen: 0.3 },
  duvetGrey:  { kind: 'fabric', name: 'ღია ნაცრისფერი საბანი — საწოლი 06', fabric: { base: '#d9d6d1', seed: 18, weave: 1.6 }, sheen: 0.3 },
  brownVelvet:{ kind: 'fabric', name: 'ყავისფერი ხავერდი — ბალიშები 06', fabric: { base: '#6b4b34', seed: 19, weave: 1.2 }, sheen: 0.9, sheenRough: 0.4 },
  blueThrow:  { kind: 'fabric', name: 'ცისფერი პლედი — საწოლი 05', fabric: { base: '#4e7186', seed: 20, weave: 3.5 }, sheen: 0.4 },
  darkFabric: { kind: 'fabric', name: 'მუქი ნაცრისფერი ბალიშები / ცილინდრული ბალიში', fabric: { base: '#5c5955', seed: 22, weave: 2 }, sheen: 0.5 },
  leafPillow: { kind: 'fabric', name: 'ნაცრისფერი ბალიში (ფოთლოვანი ნახატი — გამარტივებული)', fabric: { base: '#c9cbc7', seed: 23, weave: 2 }, sheen: 0.3 },
  outdoorGrey:{ kind: 'fabric', name: 'გარე ქსოვილი — ნაცრისფერი ბალიშები (ტერასა)', fabric: { base: '#a39e96', seed: 24, weave: 2.6 }, sheen: 0.2 },
  // ნაწნავი
  paperCord:  { kind: 'woven', name: 'ქაღალდის თოკი — სასადილო სკამების საჯდომი', woven: { base: '#c9b48e', dark: '#8a7656', strand: 7 }, r: 0.85 },
  rattan:     { kind: 'woven', name: 'რატანი — ტერასის სავარძლები', woven: { base: '#b98d5c', dark: '#6e4f30', strand: 14, size: [220, 220] }, r: 0.8 },
  ropeDark:   { kind: 'woven', name: 'მუქი თოკი — ტერასის სასადილო სკამები', woven: { base: '#5a554f', dark: '#1f1d1b', strand: 18, size: [260, 260] }, r: 0.85 },
  // შეღებილი ფასადები (მქრქალი)
  white:      { kind: 'paint', name: 'თეთრი მქრქალი ფასადი', color: '#efede9', r: 0.55 },
  cream:      { kind: 'paint', name: 'კრემისფერი ზედაპირი (TV-კონსოლის ფილა)', color: '#ece6dc', r: 0.3 },
  greigeF3:   { kind: 'paint', name: 'ღია ბეჟ-ნაცრისფერი მქრქალი — შესასვლელის კარადა F3', color: '#d7cdc3', r: 0.6 },
  taupeF4:    { kind: 'paint', name: 'ნაცრისფერ-იასამნისფერი მქრქალი — კარადა F4', color: '#a59e9c', r: 0.6 },
  taupeBath:  { kind: 'paint', name: 'ნაცრისფერ-ტაუპი მქრქალი — აბაზანის კარადები F6, F7', color: '#8b837e', r: 0.55 },
  darkDrum:   { kind: 'paint', name: 'მუქი ანთრაციტ-ყავისფერი — მრგვალი ტუმბოები 02', color: '#4a4440', r: 0.5 },
  solidWhite: { kind: 'paint', name: 'თეთრი Solid Surface (ნიჟარის ზედაპირი 04)', color: '#f4f3f0', r: 0.3 },
  ceramic:    { kind: 'paint', name: 'სანტექნიკის ფაიანსი', color: '#f8f8f6', r: 0.12 },
  shadow:     { kind: 'paint', name: 'ჩრდილის ღარი / შავი პროფილი (Gola)', color: '#262423', r: 0.6 },
  // ლითონი, მინა, ეკრანი, LED
  alu:        { kind: 'metal', name: 'დამუშავებული ალუმინი (სახელურები F4)', color: '#c9c9c7', r: 0.35, m: 1 },
  steel:      { kind: 'metal', name: 'უჟანგავი ფოლადი (ღუმელები, ონკანები)', color: '#bdbcb8', r: 0.3, m: 1 },
  nickel:     { kind: 'metal', name: 'ნიკელი / ქრომი (ონკანები, საკიდები)', color: '#d3d1cc', r: 0.18, m: 1 },
  blackMetal: { kind: 'metal', name: 'შავი მქრქალი ლითონი', color: '#1f1f20', r: 0.45, m: 0.6 },
  blackGlass: { kind: 'paint', name: 'შავი მინა (ეკრანი, გაზქურა, ღუმელის კარი)', color: '#0d0d0e', r: 0.06, m: 0.2 },
  sinkBlack:  { kind: 'paint', name: 'შავი გრანიტის ნიჟარა', color: '#232222', r: 0.35 },
  glass:      { kind: 'glass', name: 'გამჭვირვალე მინა', color: '#d6e4e8', r: 0.04, opacity: 0.22 },
  mirror:     { kind: 'metal', name: 'სარკე', color: '#dfe6e8', r: 0.05, m: 0.75 },
  led:        { kind: 'emissive', name: 'LED ლენტი (თბილი)', color: '#ffd9a8', emissive: '#ffc887', ei: 1.6 },
};

const texCache = new Map();
function texKey(key, def) { return def.kind === 'fabric' ? `fabric_${def.fabric.weave}_${def.fabric.boucle || 0}` : key; }
function textureSet(key, def) {
  const tk = texKey(key, def);
  if (texCache.has(tk)) return texCache.get(tk);
  let t = null;
  if (def.kind === 'wood') t = woodTextures({ ...def.wood, name: key });
  else if (def.kind === 'marble') t = marbleTextures({ ...def.marble, name: key });
  else if (def.kind === 'fabric') t = fabricTextures({ ...def.fabric, name: tk });
  else if (def.kind === 'woven') t = wovenTextures({ ...def.woven, name: key });
  texCache.set(tk, t);
  return t;
}
const matCache = new Map();
export function fmat(key) {
  if (matCache.has(key)) return matCache.get(key);
  const d = FMAT[key];
  if (!d) throw new Error('უცნობი მასალა: ' + key);
  const t = textureSet(key, d);
  let m;
  if (d.kind === 'fabric') {
    m = new THREE.MeshPhysicalMaterial({ roughness: 0.92, sheen: d.sheen ?? 0.3, sheenRoughness: d.sheenRough ?? 0.7, sheenColor: new THREE.Color('#ffffff') });
  } else {
    m = new THREE.MeshStandardMaterial({ roughness: d.r ?? 0.6, metalness: d.m ?? 0 });
  }
  m.name = key;
  if (t) {
    m.map = t.map;
    if (t.normalMap) { m.normalMap = t.normalMap; m.normalScale = new THREE.Vector2(t.normalScale, t.normalScale); }
  } else m.color = new THREE.Color(d.color);
  if (d.kind === 'fabric') { m.color = new THREE.Color(d.fabric.base); m.sheenColor = new THREE.Color(d.fabric.base).lerp(new THREE.Color('#ffffff'), 0.25); }
  if (d.kind === 'woven') m.side = THREE.DoubleSide;
  if (d.kind === 'glass') { m.transparent = true; m.opacity = d.opacity; m.depthWrite = false; m.side = THREE.DoubleSide; }
  if (d.kind === 'emissive') { m.color = new THREE.Color(d.color); m.emissive = new THREE.Color(d.emissive); m.emissiveIntensity = d.ei; }
  if (d.kind === 'metal') m.envMapIntensity = key === 'mirror' ? 3 : 2.2;
  m.userData = { description: d.name, texture: t ? 'პროცედურული ანალოგი (ორიგინალი ფაქტურა არ არის)' : undefined, texSize: t?.size };
  matCache.set(key, m);
  return m;
}
export const allFurnitureTextures = () => [...texCache.values()].filter(Boolean).flatMap((t) => [t.map, t.normalMap].filter(Boolean));

// ================================================================ UV — რეალური მასშტაბით, ბოჭკოს მიმართულებით
function hash(a, b) { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); }
function projectUV(geo, key, grain = 'x', seed = 0) {
  const t = textureSet(key, FMAT[key]);
  const [su, sv] = t?.size || [1000, 1000];
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = p.count;
  const uv = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  const ou = hash(seed, 1.7) * su, ov = hash(seed, 9.1) * sv; // შემთხვევითი წანაცვლება — გამეორება არ ჩანს
  const A = { x: 0, y: 1, z: 2 };
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nn.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    const dom = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
    const plane = [[2, 1], [0, 2], [0, 1]][dom];
    let [iu, iv] = plane;
    const gi = A[grain];
    if (gi === iv) [iu, iv] = [iv, iu];
    for (let k = 0; k < 3; k++) {
      const q = [p.getX(i + k), p.getY(i + k), p.getZ(i + k)];
      uv[(i + k) * 2] = (q[iu] + ou) / su;
      uv[(i + k) * 2 + 1] = (q[iv] + ov) / sv;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ================================================================ გეომეტრიის დამხმარეები (მმ)
function rrectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// ფილა მომრგვალებული კუთხეებით გეგმაში (w × d), სისქე t, კიდის რბილი ფაზა bev
function slabGeo(w, d, t, r, bev = 3) {
  const g = new THREE.ExtrudeGeometry(rrectShape(w, d, r), { depth: t - 2 * bev, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 16 });
  g.rotateX(-Math.PI / 2); // ფორმის Y → −Z, სიღრმე → +Y
  g.translate(0, bev, 0);
  return g; // ცენტრი XZ-ში, y 0…t
}
// რკალისებრი ზურგი (გეგმაში რკალი), სისქე th, კუთხე ang (გრადუსი), მიმართული −Z-ისკენ (ზურგი)
function arcBandGeo(R, th, ang, h, bev = 8) {
  const s = new THREE.Shape(), a0 = -Math.PI / 2 - (ang / 2) * DEG, a1 = -Math.PI / 2 + (ang / 2) * DEG;
  s.absarc(0, 0, R, a0, a1, false);
  s.absarc(0, 0, R - th, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 3, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bev, 0);
  // rotateX(−90°): შეიპის Y → −Z — რკალი −90°-ზე (ქვემოთ) ხდება +Z-ზე; ვაბრუნებთ, რომ ზურგი იყოს −Z-ზე
  g.rotateY(Math.PI);
  return g;
}
// რბილი ბალიში: კიდეებთან თხელდება (ნაკერი), ცენტრში სქელია
function pillowGeo(w, h, t, seg = 10) {
  let g = new THREE.BoxGeometry(2, 2, 2, seg, seg, 2);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const e = Math.max(Math.abs(x), Math.abs(y));
    const k = Math.max(0.18, 1 - Math.pow(e, 4));
    x *= 1 - 0.06 * Math.pow(Math.abs(y), 2); y *= 1 - 0.06 * Math.pow(Math.abs(x), 2); // კიდეები ოდნავ შეზნექილი
    p.setXYZ(i, x * w / 2, y * h / 2, z * k * t / 2);
  }
  g.computeVertexNormals();
  return g;
}
// გოგრისებრი მრგვალი ბალიში
function pumpkinGeo(R, lobes = 8, depth = 0.08) {
  const g = new THREE.SphereGeometry(R, 32, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const phi = Math.atan2(z, x), k = 1 - depth * Math.pow(Math.abs(Math.sin(phi * lobes / 2)), 0.6);
    p.setXYZ(i, x * k, y * 0.86, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// ================================================================ კრებული (ლოკალური მმ → მეშები)
class Kit {
  constructor() { this.by = new Map(); this.n = 0; }
  geo(mat, g, o = {}) {
    if (o.rot) { g.rotateX(o.rot[0] * DEG); g.rotateY(o.rot[1] * DEG); g.rotateZ(o.rot[2] * DEG); }
    if (o.at) g.translate(o.at[0], o.at[1], o.at[2]);
    const keep = o.nativeUV && g.attributes.uv;
    let q = g.index ? g.toNonIndexed() : g;
    if (!keep) q = projectUV(q, mat, o.grain || 'x', this.n++);
    else if (o.nativeUV) { const uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.nativeUV[0], uv.getY(i) * o.nativeUV[1]); }
    if (!this.by.has(mat)) this.by.set(mat, []);
    this.by.get(mat).push(q);
    return this;
  }
  // ყუთი: [x0,x1], [y0,y1], [z0,z1]
  box(mat, X, Y, Z, o = {}) {
    const g = new THREE.BoxGeometry(Math.abs(X[1] - X[0]), Math.abs(Y[1] - Y[0]), Math.abs(Z[1] - Z[0]));
    return this.geo(mat, g, { ...o, at: [(X[0] + X[1]) / 2, (Y[0] + Y[1]) / 2, (Z[0] + Z[1]) / 2], rot: o.rot });
  }
  rbox(mat, X, Y, Z, r, o = {}) {
    const w = Math.abs(X[1] - X[0]), h = Math.abs(Y[1] - Y[0]), d = Math.abs(Z[1] - Z[0]);
    const rr = Math.max(0.5, Math.min(r, w / 2 - 0.1, h / 2 - 0.1, d / 2 - 0.1));
    const g = new RoundedBoxGeometry(w, h, d, o.seg ?? 3, rr);
    return this.geo(mat, g, { ...o, at: [(X[0] + X[1]) / 2, (Y[0] + Y[1]) / 2, (Z[0] + Z[1]) / 2] });
  }
  cyl(mat, cx, cz, y0, y1, rTop, rBot = rTop, seg = 16, o = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, y1 - y0, seg);
    if (o.square) g.rotateY(Math.PI / 4);
    return this.geo(mat, g, { ...o, at: [cx, (y0 + y1) / 2, cz], grain: o.grain || 'y' });
  }
  tube(mat, pts, r, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'centripetal');
    const len = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(8, Math.round(len / 25)), r, o.radial ?? 10, false);
    const t = textureSet(mat, FMAT[mat]);
    const sz = t?.size || [1000, 1000];
    // კონცების დახურვა: პატარა სფეროები
    const ends = [curve.getPoint(0), curve.getPoint(1)].map((v) => new THREE.SphereGeometry(r, 10, 8).translate(v.x, v.y, v.z));
    this.geo(mat, g, { nativeUV: [len / sz[0], (2 * Math.PI * r) / sz[1]] });
    if (o.caps !== false) ends.forEach((e) => this.geo(mat, e, { grain: 'y' }));
    return this;
  }
  // ხის ღარიანი (ფლუტირებული) ფასადი: ნახევრადცილინდრები x0…x1 ზოლში
  flutes(mat, X, Y, z, pitch, r, o = {}) {
    for (let x = X[0] + pitch / 2; x <= X[1] - pitch / 2 + 0.1; x += pitch) {
      const g = new THREE.CylinderGeometry(r, r, Y[1] - Y[0], 10, 1, false, -Math.PI / 2, Math.PI); // ამობურცული მხარე +Z-ისკენ (z = r·cosθ ≥ 0)
      this.geo(mat, g, { at: [x, (Y[0] + Y[1]) / 2, z], grain: 'y' });
    }
    return this;
  }
  build(name) {
    const grp = new THREE.Group();
    for (const [k, list] of this.by) {
      let g = list.length === 1 ? list[0] : mergeGeometries(list.map((q) => { const c = q.clone(); for (const n of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(n)) c.deleteAttribute(n); if (!c.attributes.normal) c.computeVertexNormals(); return c; }), false);
      // ფეხების ბოლოები და კიდის ფაზები იატაკზე სწორდება (არაფერი ჩადის იატაკის ქვემოთ)
      const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) if (pa.getY(i) < 0) pa.setY(i, 0);
      g.scale(M, M, M);
      g = mergeVertices(g, 1e-5); // იდენტური წვეროების გაერთიანება (ნორმალები და UV-ები უცვლელია) — ფაილი მცირდება
      g.computeBoundingBox();
      const m = new THREE.Mesh(g, fmat(k));
      m.name = `${name}_${k}`;
      m.castShadow = FMAT[k].kind !== 'glass' && FMAT[k].kind !== 'emissive';
      m.receiveShadow = true;
      grp.add(m);
    }
    return grp;
  }
}

// ================================================================ საერთო დეტალები
function door(k, mat, X, Y, D, t = 18, gap = 3, o = {}) { return k.box(mat, [X[0] + gap / 2, X[1] - gap / 2], [Y[0] + gap / 2, Y[1] - gap / 2], [D - t, D], { grain: 'y', ...o }); }
function barHandle(k, mat, x, Y, D, w = 14, depth = 26) { k.box(mat, [x - w / 2, x + w / 2], Y, [D, D + depth], { grain: 'y' }); return k; }
function shelfCells(k, mat, X, Y, Z, rows, ledAt) {
  // ღია თაროები: გვერდები, ზურგი, თაროები; rows — [y, dividerFraction|null]
  k.box(mat, [X[0], X[1]], [Y[0], Y[1]], [Z[0], Z[0] + 12], { grain: 'y' });
  k.box(mat, [X[0], X[0] + 18], Y, Z, { grain: 'y' }); k.box(mat, [X[1] - 18, X[1]], Y, Z, { grain: 'y' });
  k.box(mat, [X[0] + 18, X[1] - 18], [Y[0], Y[0] + 60], Z); k.box(mat, [X[0] + 18, X[1] - 18], [Y[1] - 22, Y[1]], Z);
  let prev = Y[0] + 60;
  for (const [y, div] of rows) {
    k.box(mat, [X[0] + 18, X[1] - 18], [y, y + 22], Z);
    if (ledAt) k.box('led', [X[0] + 22, X[1] - 22], [y - 6, y], [Z[1] - 40, Z[1] - 30]);
    if (div != null) { const dx = X[0] + 18 + (X[1] - X[0] - 36) * div; k.box(mat, [dx - 9, dx + 9], [prev, y], Z, { grain: 'y' }); }
    prev = y + 22;
  }
}

// ================================================================ ნივთების ამგებები
const B = {};

// ---- კარადა (F3, F4, F5, F8): mods — ხედის თანმიმდევრობით; 'o' ღია თაროები, 'f' ღარიანი კარი
B.wardrobe = (k, f, L, D) => {
  const mods = f.mods.map((m) => (typeof m === 'number' ? { w: m } : { w: parseInt(m), open: m.endsWith('o'), flute: m.endsWith('f') }));
  const total = mods.reduce((s, m) => s + m.w, 0), sc = L / total;
  const H = f.h, plinth = f.plinth ?? 0;
  let x = 0;
  mods.forEach((m, i) => {
    const X = [x, x + m.w * sc]; x = X[1];
    if (m.w <= 25) { k.box(f.mat, X, [0, H], [0, D], { grain: 'y' }); return; }
    if (m.open) {
      shelfCells(k, f.inner || f.mat, X, [0, H], [0, D], f.shelves.map((y, j) => [y, f.dividers ? f.dividers[j] : null]), f.led);
      return;
    }
    k.box(f.mat, X, [plinth, H], [0, D - 18], { grain: 'y' });
    const desk = f.deskOver?.includes(i) ? f.desk : null;
    let spans = f.split ? [[plinth, f.split], [f.split, H]] : [[plinth, H]];
    if (desk) spans = [[plinth, desk[0]], [desk[1], H]];
    for (const Y of spans) {
      door(k, f.mat, X, Y, D, 18, 3);
      if (m.flute) k.flutes(f.mat, [X[0] + 4, X[1] - 4], [Y[0] + 3, Y[1] - 3], D, f.flutePitch || 26, (f.flutePitch || 26) * 0.42);
    }
  });
  if (plinth) k.box('shadow', [0, L], [0, plinth], [0, D - 40]);
  // F4: მაგიდის ფილა კარადის მოდულებზე გადადის (A.15 / რენდერი A03)
  if (f.deskOver) {
    let xx = 0; const edges = mods.map((m) => [xx, (xx += m.w * sc)]);
    const X = [edges[f.deskOver[0]][0] + 18, edges[f.deskOver[f.deskOver.length - 1]][1]];
    k.box('oakLight', X, [f.desk[0], f.desk[1]], [0, D + 2]);
  }
  // სახელურები: [მოდულის ინდექსი, 'L'|'R' (კარის რომელ კიდეზე), y0, y1]
  if (f.handles) {
    let xx = 0; const edges = mods.map((m) => [xx, (xx += m.w * sc)]);
    for (const [i, side, y0, y1] of f.handles) {
      const e = edges[i]; const hx = side === 'L' ? e[0] + 30 : e[1] - 30;
      barHandle(k, f.handleMat || 'alu', hx, [y0, y1], D, f.handleW || 14, f.handleD || 26);
    }
  }
};

// ---- F4-ის სამუშაო მაგიდა (ჩამოკიდებული, ორი უჯრით)
B.desk = (k, f, L, D) => {
  const [y0, y1] = f.y;
  k.box('oakLight', [0, L], [y1 - 40, y1], [0, D + 2]);
  k.box('oakLight', [0, L], [y0, y1 - 40], [0, D - 20]);
  let x = 0;
  for (const w of f.drawers) { door(k, 'oakLight', [x, x + w], [y0, y1 - 42], D + 2, 18, 3); x += w; }
};

// ---- რბილი სკამი (ვარდისფერი ხავერდი, შავი ლითონის ფეხები) — სამუშაო სკამი 02
B.tubChair = (k, f, L, D) => {
  const cx = L / 2, w = Math.min(L, 540), d = Math.min(D, 540), cz = D / 2;
  k.rbox(f.mat, [cx - w / 2 + 20, cx + w / 2 - 20], [430, 500], [cz - d / 2 + 30, cz + d / 2 - 10], 30, { seg: 4 });
  k.geo(f.mat, arcBandGeo(w / 2, 55, 230, 330, 14), { at: [cx, 470, cz + 10] });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.tube('blackMetal', [[cx + sx * 150, 425, cz + sz * 150], [cx + sx * 215, 0, cz + sz * 215]], 7, { caps: true });
  k.box('blackMetal', [cx - 160, cx + 160], [415, 428], [cz - 160, cz + 160]);
};

// ---- რბილი საწოლი მომრგვალებული სათავით (02); L — სიგანე, D — სიგრძე, z=0 სათავე
B.bedRound = (k, f, L, D) => {
  const fr = f.mat;
  k.rbox(fr, [0, L], [70, 370], [60, D], 110, { seg: 5 });                         // რბილი ჩარჩო
  for (const [x, z] of [[120, 200], [L - 120, 200], [120, D - 120], [L - 120, D - 120]]) k.cyl('walnut', x, z, 0, 75, 28, 24, 16);
  // სათავე: ვერტიკალური ფილა, ზედა კუთხეები მრგვალი
  const shape = new THREE.Shape(); const R = 300, W = L / 2, Hh = 1150;
  shape.moveTo(-W, 0); shape.lineTo(W, 0); shape.lineTo(W, Hh - R); shape.quadraticCurveTo(W, Hh, W - R, Hh); shape.lineTo(-W + R, Hh); shape.quadraticCurveTo(-W, Hh, -W, Hh - R); shape.lineTo(-W, 0);
  const hg = new THREE.ExtrudeGeometry(shape, { depth: 90, bevelEnabled: true, bevelThickness: 22, bevelSize: 22, bevelSegments: 4, curveSegments: 20 });
  k.geo(fr, hg, { at: [L / 2, 0, 22], grain: 'y' });
  k.rbox('linenWhite', [55, L - 55], [370, 590], [140, D - 40], 60, { seg: 4 });       // ლეიბი
  k.rbox('mauveVelvet', [35, L - 35], [585, 615], [D * 0.42, D + 10], 14, { seg: 3 });  // ხავერდის გადასაფარებელი
  k.box('mauveVelvet', [35, L - 35], [330, 615], [D + 2, D + 16]);                     // ჩამოშვებული ბოლო
  const pw = (L - 160) / 2;
  for (const x of [80 + pw / 2, L - 80 - pw / 2]) k.geo('linenWhite', pillowGeo(pw, 480, 170), { rot: [-62, 0, 0], at: [x, 760, 300] });
  for (const x of [200 + 220, L - 200 - 220]) k.geo('linenGreige', pillowGeo(440, 420, 150), { rot: [-70, 0, 0], at: [x, 720, 470] });
  const bol = new THREE.CylinderGeometry(70, 70, 560, 24); bol.rotateZ(Math.PI / 2);
  k.geo('darkFabric', bol, { at: [L / 2 + 260, 655, 600], grain: 'x' });
};

// ---- თეთრი საწოლი (05): მართკუთხა სათავე ჩარჩოთი
B.bedPanel = (k, f, L, D) => {
  k.rbox('whiteUphol', [0, L], [60, 380], [90, D], 30, { seg: 3 });
  k.box('shadow', [40, L - 40], [0, 60], [130, D - 40]);
  k.rbox('whiteUphol', [0, L], [0, 1080], [0, 90], 18, { seg: 3 });                  // სათავე
  k.rbox('whiteUphol', [40, L - 40], [420, 1020], [80, 110], 10, { seg: 2 });         // ჩაღრმავებული პანელის რელიეფი
  k.rbox('linenWhite', [40, L - 40], [380, 600], [120, D - 30], 60, { seg: 4 });
  k.rbox('linenWhite', [20, L - 20], [595, 640], [D * 0.3, D + 15], 18, { seg: 3 });
  k.rbox('blueThrow', [10, L - 10], [636, 652], [D * 0.62, D * 0.62 + 380], 6, { seg: 2 });
  k.box('blueThrow', [10, L - 10], [420, 652], [D + 10, D + 22]);
  const pw = (L - 160) / 2;
  for (const x of [80 + pw / 2, L - 80 - pw / 2]) k.geo('linenWhite', pillowGeo(pw, 500, 180), { rot: [-60, 0, 0], at: [x, 800, 280] });
  for (const x of [80 + pw / 2, L - 80 - pw / 2]) k.geo('linenWhite', pillowGeo(pw - 40, 460, 160), { rot: [-66, 0, 0], at: [x, 770, 400] });
  for (const x of [L / 2 - 420, L / 2 + 420]) k.geo('leafPillow', pillowGeo(440, 420, 140), { rot: [-72, 0, 0], at: [x, 760, 540] });
  k.geo('linenGreige', pillowGeo(420, 340, 130), { rot: [-74, 0, 0], at: [L / 2, 740, 570] });
};

// ---- ნაცრისფერი ხავერდის საწოლი (06)
B.bedVelvet = (k, f, L, D) => {
  k.rbox('greyVelvet', [0, L], [60, 380], [100, D], 40, { seg: 4 });
  k.box('shadow', [40, L - 40], [0, 60], [140, D - 40]);
  k.rbox('greyVelvet', [0, L], [0, 1060], [0, 100], 30, { seg: 4 });                 // სათავე
  k.rbox('duvetGrey', [30, L - 30], [380, 650], [130, D + 25], 70, { seg: 5 });       // სქელი საბანი
  for (let z = D * 0.3; z < D; z += 210) k.box('linenWhite', [40, L - 40], [646, 649], [z, z + 6]); // ნაქსოვი ხაზები
  const pw = (L - 140) / 2;
  for (const x of [70 + pw / 2, L - 70 - pw / 2]) k.geo('linenWhite', pillowGeo(pw, 480, 170), { rot: [-62, 0, 0], at: [x, 820, 260] });
  for (const x of [70 + pw / 2, L - 70 - pw / 2]) k.geo('brownVelvet', pillowGeo(pw - 120, 420, 150), { rot: [-68, 0, 0], at: [x, 790, 400] });
  k.geo('leafPillow', pillowGeo(520, 400, 140), { rot: [-74, 0, 0], at: [L / 2, 770, 520] });
};

// ---- ტუმბოები
B.drum = (k, f, L, D) => { // მრგვალი ტუმბო ღია ნიშით (02); ცენტრი — კონტურის ცენტრი
  const R = Math.min(L, D) / 2, cx = L / 2, cz = D / 2;
  const shell = new THREE.Shape();
  const a0 = (90 + f.open / 2) * DEG, a1 = (90 - f.open / 2 + 360) * DEG;
  shell.absarc(0, 0, R, a0, a1, false); shell.absarc(0, 0, R - 18, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(shell, { depth: f.h - 50, bevelEnabled: false, curveSegments: 40 });
  g.rotateX(-Math.PI / 2); g.rotateY((f.openYaw || 0) * DEG); g.translate(cx, 30, cz);
  k.geo('darkDrum', g, { grain: 'y' });
  k.cyl('darkDrum', cx, cz, 0, 30, R - 10, R - 10, 40);
  k.cyl('darkDrum', cx, cz, 250, 268, R - 18, R - 18, 40);
  k.cyl('marbleViola', cx, cz, f.h - 20, f.h, R + 10, R + 10, 48);
};
B.chest = (k, f, L, D) => { // თეთრი ტუმბო უჯრებით, ჩაღრმავებული სახელურებით
  const n = f.drawers, base = 30, H = f.h;
  k.box('white', [10, L - 10], [0, base], [20, D - 30]);
  k.box(f.mat, [0, L], [base, H], [0, D - 18]);
  const hh = (H - base) / n;
  for (let i = 0; i < n; i++) {
    const y0 = base + i * hh;
    door(k, f.mat, [0, L], [y0, y0 + hh], D, 18, 3, { grain: 'x' });
    k.box('shadow', [L / 2 - 50, L / 2 + 50], [y0 + hh - 28, y0 + hh - 16], [D - 2, D + 1]);
  }
};

// ---- სამზარეულო F1 (A.15 + რენდერი A01)
B.kitchen = (k, f, L, D) => {
  const mods = f.mods; let x = 0; const E = mods.map((w) => [x, (x += w)]);
  const tallA = E[0], tallB = E[E.length - 1]; // A — მარცხენა, B — მარჯვენა (ხედიდან)
  const oven = f.ovensRight ? tallB : tallA, fridge = f.ovensRight ? tallA : tallB;
  const top2 = f.topTier; // თეთრი ზედა რიგი (რენდერი)
  // ცოკოლი
  k.box('white', [0, L], [0, 100], [0, D - 60]);
  // მაღალი სვეტები 0…topTier
  for (const X of [tallA, tallB]) k.box('white', X, [100, top2], [0, D - 18]);
  door(k, 'white', fridge, [100, top2], D);
  // ღუმელის სვეტი: უჯრა, 2 ღუმელი, კარი
  door(k, 'white', oven, [100, f.ovens[0][0]], D);
  for (const [y0, y1] of f.ovens) {
    k.box('steel', [oven[0] + 6, oven[1] - 6], [y0 + 4, y1 - 4], [D - 22, D + 4], { grain: 'x' });
    k.box('blackGlass', [oven[0] + 60, oven[1] - 60], [y0 + 70, y1 - 140], [D + 4, D + 7]);
    k.box('steel', [oven[0] + 70, oven[1] - 70], [y1 - 95, y1 - 80], [D + 7, D + 35]);
    k.box('blackGlass', [oven[0] + 60, oven[1] - 60], [y1 - 60, y1 - 25], [D + 4, D + 6]);
  }
  door(k, 'white', oven, [f.ovens[1][1], top2], D);
  // ქვედა კარადები + Gola ჩაღრმავება + ზედაპირი
  const mid = [tallA[1], tallB[0]];
  k.box('white', mid, [100, f.base - f.top], [0, D - 70]);
  k.box('shadow', mid, [f.base - f.top - 45, f.base - f.top], [D - 70, D - 40]);
  E.slice(1, -1).forEach(([a, b], i) => {
    const w = b - a;
    if (w > 800) { door(k, 'white', [a, b], [100, 480], D - 20); door(k, 'white', [a, b], [490, f.base - f.top - 45], D - 20); k.box('shadow', [a, b], [480, 490], [D - 70, D - 40]); }
    else door(k, 'white', [a, b], [100, f.base - f.top - 45], D - 20);
  });
  k.box('stoneLight', mid, [f.base - f.top, f.base], [0, D]);
  k.box('shadow', mid, [f.base - f.top, f.base - f.top + 8], [D - 1, D + 1]);
  // ზურგი, LED, ზედა ხის კარადები, თეთრი ზედა რიგი
  k.box('stoneLight', mid, [f.base, f.base + 600], [0, 14]);
  k.box(f.upperMat, mid, [f.base + 600, top2], [0, f.upperDepth - 18], { grain: 'y' });
  for (const [a, b] of E.slice(1, -1)) {
    const n = b - a > 800 ? 2 : 1, w = (b - a) / n;
    for (let j = 0; j < n; j++) door(k, f.upperMat, [a + j * w, a + (j + 1) * w], [f.base + 600, top2], f.upperDepth, 18, 3, { grain: 'y' });
  }
  k.box('led', mid, [f.base + 596, f.base + 600], [f.upperDepth - 60, f.upperDepth - 40]);
  k.box('white', [0, L], [top2, f.h], [0, D - 18]);
  for (const [a, b] of E) {
    const n = b - a > 800 ? 2 : 1, w = (b - a) / n;
    for (let j = 0; j < n; j++) door(k, 'white', [a + j * w, a + (j + 1) * w], [top2, f.h], D);
  }
  // გაზქურა, ნიჟარა, ონკანი
  k.box('blackGlass', f.hob, [f.base, f.base + 5], [D - 560, D - 40]);
  const [s0, s1] = f.sink;
  k.box('sinkBlack', [s0, s1], [f.base - 2, f.base + 1], [D - 500, D - 80]);
  const tx = (s0 + s1) / 2;
  k.cyl('steel', tx, 80, f.base, f.base + 280, 16, 18, 16);
  k.tube('steel', [[tx, f.base + 270, 80], [tx, f.base + 330, 120], [tx, f.base + 300, 220], [tx, f.base + 230, 250]], 11);
};

// ---- სასადილო მაგიდა: მარმარილოს რბილი მართკუთხედი + 4 დახრილი მუხის ფეხი
B.diningTable = (k, f, L, D) => {
  const w = Math.max(L, D), d = Math.min(L, D), along = D > L;
  const top = slabGeo(w, d, 30, f.radius, 4);
  if (along) top.rotateY(Math.PI / 2);
  k.geo('marbleWhite', top, { at: [L / 2, f.h - 30, D / 2] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = (w / 2 - f.legInset[0]) * sx, lz = (d / 2 - f.legInset[1]) * sz;
    const [px, pz] = along ? [lz, lx] : [lx, lz];
    k.tube('oakNatural', [[L / 2 + px * 0.92, 0, D / 2 + pz * 0.92], [L / 2 + px, f.h - 32, D / 2 + pz]], 26, { radial: 4 });
  }
  const rail = along ? [[L / 2, f.h - 90, D / 2 - (w / 2 - f.legInset[0])], [L / 2, f.h - 90, D / 2 + (w / 2 - f.legInset[0])]] : [[L / 2 - (w / 2 - f.legInset[0]), f.h - 90, D / 2], [L / 2 + (w / 2 - f.legInset[0]), f.h - 90, D / 2]];
  k.tube('oakNatural', rail, 22, { radial: 4 });
};

// ---- „Wishbone“ ტიპის სკამი (მუხა + ქაღალდის თოკი); z=0 ზურგი
B.wishbone = (k, f, L, D) => {
  const sh = 440, top = 700;
  for (const x of [45, L - 45]) {
    k.tube('oakNatural', [[x, 0, D - 40], [x, sh, D - 45]], 16, { radial: 12 });                         // წინა ფეხები
    k.tube('oakNatural', [[x * 0.98 + (x < L / 2 ? 0 : 0), 0, 25], [x, sh - 20, 55], [x + (x < L / 2 ? 10 : -10), top - 40, 55]], 17, { radial: 12 }); // უკანა (მოხრილი)
    k.tube('oakNatural', [[x, 180, D - 45], [x, 180, 50]], 10, { radial: 8 });                         // გვერდითი ბოძი
  }
  k.tube('oakNatural', [[45, 230, D - 42], [L - 45, 230, D - 42]], 10, { radial: 8 });
  // მოხრილი ზედა სახელური-საზურგე (ნახევარწრე)
  const arc = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; arc.push([L / 2 - Math.cos(a) * (L / 2 - 50), top - 30 + Math.sin(a) * 18, 60 - Math.sin(a) * 85]); }
  arc.unshift([50, top - 45, 150]); arc.push([L - 50, top - 45, 150]);
  k.tube('oakNatural', arc, 15, { radial: 10 });
  // Y-ფორმის საზურგე
  k.box('oakNatural', [L / 2 - 30, L / 2 + 30], [sh, sh + 110], [45, 63], { grain: 'y', rot: [8, 0, 0] });
  k.box('oakNatural', [L / 2 - 48 - 22, L / 2 - 48 + 22], [sh + 95, top - 35], [26, 42], { grain: 'y', rot: [0, 0, 20] });
  k.box('oakNatural', [L / 2 + 48 - 22, L / 2 + 48 + 22], [sh + 95, top - 35], [26, 42], { grain: 'y', rot: [0, 0, -20] });
  // საჯდომი: ჩარჩო + ნაწნავი
  k.box('oakNatural', [40, L - 40], [sh - 30, sh], [40, D - 30]);
  k.box('paperCord', [55, L - 55], [sh - 2, sh + 12], [55, D - 45]);
};

// ---- რბილი სასადილო სკამი (ღია საზურგე, კაკლის ფეხები)
B.shellChair = (k, f, L, D) => {
  const cx = L / 2;
  for (const [x, z] of [[60, 60], [L - 60, 60], [60, D - 60], [L - 60, D - 60]]) k.tube('walnut', [[x + (x < cx ? -12 : 12), 0, z + (z < D / 2 ? -12 : 12)], [x, 430, z]], 16, { radial: 10 });
  k.rbox(f.mat, [25, L - 25], [430, 500], [40, D - 10], 30, { seg: 4 });
  k.geo(f.mat, arcBandGeo(L / 2 - 5, 50, 200, 250, 16), { at: [cx, 560, D / 2 + 20] });
  for (const x of [cx - 120, cx + 120]) k.tube('walnut', [[x, 495, 70], [x, 570, 55]], 12);
};

// ---- სავარძელი: კაკლის მოხრილი ჩარჩო, კრემისფერი ბალიშები, გოგრისებრი ბალიში
B.armchair = (k, f, L, D) => {
  const r = 19;
  for (const x of [38, L - 38]) {
    k.tube('walnut', [[x, 0, D - 70], [x, 430, D - 68], [x, 560, D - 80], [x, 600, D - 170], [x, 605, 360], [x, 595, 200], [x, 560, 120], [x, 300, 70], [x, 0, 40]], r, { radial: 12 });
    for (const z of [D - 190, D - 250]) k.tube('walnut', [[x, 330, z], [x, 598, z + 6]], 11, { radial: 8 });
    k.tube('walnut', [[x, 320, D - 70], [x, 320, 70]], 15, { radial: 10 });
  }
  k.tube('walnut', [[38, 320, D - 70], [L - 38, 320, D - 70]], 15, { radial: 10 });
  k.tube('walnut', [[38, 300, 75], [L - 38, 300, 75]], 15, { radial: 10 });
  for (const x of [80, L - 80]) k.tube('walnut', [[x, 300, 72], [x, 790, 20]], 16, { radial: 10 });
  k.tube('walnut', [[80, 780, 22], [L / 2, 790, 10], [L - 80, 780, 22]], 15, { radial: 10 });
  k.rbox(f.mat, [60, L - 60], [325, 485], [110, D - 25], 60, { seg: 5 });
  k.rbox(f.mat, [70, L - 70], [470, 880], [40, 220], 70, { seg: 5, rot: [-12, 0, 0] });
  k.geo(f.mat, pumpkinGeo(105, 8, 0.09), { at: [L - 190, 595, 300] });
};

// ---- დივანი (A.8: 2800 × 900; რენდერის რბილი მოდულური ფორმა)
B.sofa = (k, f, L, D) => {
  const arm = 220, back = 250, mat = f.mat;
  k.box('shadow', [40, L - 40], [0, 50], [40, D - 60]);
  k.rbox(mat, [0, L], [50, 270], [0, D], 70, { seg: 5 });                         // ცოკოლი
  k.rbox(mat, [0, L], [270, 760], [0, back], 110, { seg: 5 });                    // საზურგე
  k.rbox(mat, [0, arm], [270, 600], [0, D], 95, { seg: 5 });                      // სახელურები
  k.rbox(mat, [L - arm, L], [270, 600], [0, D], 95, { seg: 5 });
  const n = f.seats, w = (L - 2 * arm) / n;
  for (let i = 0; i < n; i++) k.rbox(mat, [arm + i * w + 5, arm + (i + 1) * w - 5], [260, 450], [back - 10, D + 15], 75, { seg: 5 });
  for (const [xf, col, s] of f.pillows) k.geo(col, pillowGeo(s, s, 160), { rot: [-74, (xf - 0.5) * 10, 0], at: [L * xf, 640, back + 70] });
  for (const xf of f.balls) k.geo('darkFabric', new THREE.SphereGeometry(105, 24, 16), { at: [L * xf, 555, back + 110] });
};

// ---- ჟურნალების მაგიდა: მარმარილო + კაკლის ფილებისგან აწყობილი საყრდენი
B.coffeeTable = (k, f, L, D) => {
  const top = slabGeo(L, D, 40, 25, 4);
  k.geo('marbleGold', top, { at: [L / 2, f.h - 40, D / 2] });
  for (const xc of [f.inset, L - f.inset]) for (const dx of [-32, 32]) k.rbox('walnut', [xc + dx - 28, xc + dx + 28], [0, f.h - 40], [D / 2 - 150, D / 2 + 150], 4, { grain: 'y' });
};

// ---- TV-ზონის კედლის პანელები (4 მუხის პანელი შავი ღარებით)
B.wallPanels = (k, f, L, D) => {
  const n = f.n, w = L / n;
  for (let i = 0; i < n; i++) k.box(f.mat, [i * w + (i ? 4 : 0), (i + 1) * w - (i < n - 1 ? 4 : 0)], [0, f.h], [0, D], { grain: 'y' });
  for (let i = 1; i < n; i++) k.box('shadow', [i * w - 4, i * w + 4], [0, f.h], [0, D - 6]);
  if (f.cove) k.box('led', [0, L], [f.h - 8, f.h], [D, D + 10]);
};

// ---- TV-კონსოლი F2 (კრემისფერი ფილა + მუხის უჯრები, LED ქვემოთ)
B.consoleF2 = (k, f, L, D) => {
  const [y0, y1] = f.y;
  k.box('cream', [0, L], [y1 - 40, y1], [0, D + 8]);
  k.box('shadow', [0, L], [y1 - 52, y1 - 40], [0, D - 12]);
  k.box('oakLight', [0, L], [y0, y1 - 52], [0, D - 18]);
  const w = L / f.drawers;
  for (let i = 0; i < f.drawers; i++) door(k, 'oakLight', [i * w, (i + 1) * w], [y0, y1 - 52], D, 18, 4, { grain: 'x' });
  k.box('led', [20, L - 20], [y0 - 4, y0], [D - 60, D - 40]);
};
B.shelf = (k, f, L, D) => { const [y0, y1] = f.y; k.box(f.mat, [0, L], [y0, y1], [0, D]); if (f.led) k.box('led', [10, L - 10], [y0 - 4, y0], [D - 40, D - 25]); };
B.tv = (k, f, L, D) => { const [y0, y1] = f.y; k.box('blackMetal', [0, L], [y0, y1], [0, D - 8]); k.box('blackGlass', [6, L - 6], [y0 + 6, y1 - 6], [D - 8, D]); };

// ---- F9: ლამელები, სკამი ხავერდის ბალიშით, სარკე, თარო
B.slats = (k, f, L, D) => { const pitch = (L - f.slat) / (f.n - 1); for (let i = 0; i < f.n; i++) k.box(f.mat, [i * pitch, i * pitch + f.slat], [0, f.h], [0, D], { grain: 'y' }); };
B.bench = (k, f, L, D) => {
  k.box('oakLight', [0, L], [f.y[0], f.y[1]], [0, D]);
  k.rbox('mauveVelvet', [10, L - 10], [f.y[1], f.y[1] + 55], [5, D - 5], 22, { seg: 4 });
  k.geo('mauveVelvet', pillowGeo(360, 380, 120), { rot: [-15, 0, 0], at: [L - 260, f.y[1] + 230, 90] });
};
B.mirror = (k, f, L, D) => {
  const [y0, y1] = f.y, w = L, h = y1 - y0;
  if (f.round) {
    const s = rrectShape(w, h, f.round);
    const g = new THREE.ExtrudeGeometry(s, { depth: 6, bevelEnabled: false, curveSegments: 16 }); g.translate(L / 2, y0 + h / 2, D - 6);
    k.geo('mirror', g);
    if (f.glow) { const gl = new THREE.ExtrudeGeometry(rrectShape(w + 30, h + 30, f.round + 15), { depth: 4, bevelEnabled: false, curveSegments: 16 }); gl.translate(L / 2, y0 + h / 2, 2); k.geo('led', gl); }
    return;
  }
  if (f.frame !== false) k.box('blackMetal', [0, L], [y0, y1], [0, D - 6]);
  k.box('mirror', [f.frame === false ? 0 : 5, f.frame === false ? L : L - 5], [y0 + (f.frame === false ? 0 : 5), y1 - (f.frame === false ? 0 : 5)], [D - 6, D]);
  if (f.glow) k.box('led', [-15, L + 15], [y0 - 15, y1 + 15], [0, 4]);
  if (f.ledBelow) k.box('led', [10, L - 10], [y0 - 4, y0], [Math.max(1, D - 30), D - 2]);
};

// ---- აბაზანა
B.vanityF6 = (k, f, L, D) => { // ტაუპის კარადა ზედა ღარით, მარმარილოს ზედაპირი, ჭურჭლისებრი ნიჟარა
  const [y0, y1] = f.y, t = 20;
  k.box(f.mat, [0, L], [y0, y1 - t - 40], [0, D - 18]);
  door(k, f.mat, [0, L / 2], [y0, y1 - t - 45], D, 18, 3, { grain: 'x' }); door(k, f.mat, [L / 2, L], [y0, y1 - t - 45], D, 18, 3, { grain: 'x' });
  k.box('shadow', [0, L], [y1 - t - 45, y1 - t], [0, D - 30]);
  k.box(f.mat, [0, L], [y1 - t - 45, y1 - t], [0, 30]);
  k.box('marbleViola', [0, L], [y1 - t, y1], [0, D]);
  basin(k, f.basin, y1, 130, 12);
  k.tube('nickel', [[f.basin[0] + f.basin[2] / 2, y1 + 290, 0], [f.basin[0] + f.basin[2] / 2, y1 + 290, 150], [f.basin[0] + f.basin[2] / 2, y1 + 260, 175]], 10);
};
function basin(k, [x, z, w, d], y, h, wall) { // ღრმა ჭურჭლისებრი ნიჟარა (ღრუ)
  k.rbox('ceramic', [x, x + w], [y, y + 12], [z, z + d], 6);
  k.rbox('ceramic', [x, x + wall], [y, y + h], [z, z + d], 5); k.rbox('ceramic', [x + w - wall, x + w], [y, y + h], [z, z + d], 5);
  k.rbox('ceramic', [x, x + w], [y, y + h], [z, z + wall], 5); k.rbox('ceramic', [x, x + w], [y, y + h], [z + d - wall, z + d], 5);
}
B.vanityF7 = (k, f, L, D) => { // ღარიანი კორპუსი + სქელი თეთრი ზედაპირი ჩაშენებული ნიჟარით
  const [y0, y1] = f.y, t = 120;
  k.box(f.mat, [0, L], [y0, y1 - t], [0, D - 18]);
  k.box(f.mat, [0, L], [y0, y1 - t], [D - 18, D - 8]);
  k.flutes(f.mat, [0, L], [y0 + 2, y1 - t - 2], D - 8, 30, 13);
  const [bx, bz, bw, bd] = f.basin;
  k.box('solidWhite', [0, L], [y1 - t, y1 - t + 25], [0, D + 6]);
  k.box('solidWhite', [0, bx], [y1 - t + 25, y1], [0, D + 6]); k.box('solidWhite', [bx + bw, L], [y1 - t + 25, y1], [0, D + 6]);
  k.box('solidWhite', [bx, bx + bw], [y1 - t + 25, y1], [0, bz]); k.box('solidWhite', [bx, bx + bw], [y1 - t + 25, y1], [bz + bd, D + 6]);
  k.rbox('solidWhite', [bx + 140, bx + 230], [y1 - t + 25, y1 - t + 29], [bz + bd / 2 - 50, bz + bd / 2 + 50], 2);
  k.cyl('nickel', bx + bw / 2, bz - 40, y1, y1 + 170, 14, 16, 14);
  k.tube('nickel', [[bx + bw / 2, y1 + 160, bz - 40], [bx + bw / 2, y1 + 175, bz + 40], [bx + bw / 2, y1 + 140, bz + 70]], 9);
};
B.instBox = (k, f, L, D) => { // ინსტალაციის ყუთი; niche — [x0,x1,y0,y1,depth]; plate — ჩამრეცხი ღილაკი
  if (f.niche) {
    const [nx0, nx1, ny0, ny1, nd] = f.niche;
    k.box(f.mat, [0, L], [0, ny0], [0, D]); k.box(f.mat, [0, L], [ny1, f.h], [0, D]);
    k.box(f.mat, [0, nx0], [ny0, ny1], [0, D]); k.box(f.mat, [nx1, L], [ny0, ny1], [0, D]);
    k.box(f.mat, [nx0, nx1], [ny0, ny1], [0, D - nd]);
  } else k.box(f.mat, [0, L], [0, f.h], [0, D]);
  if (f.ledge) k.box(f.mat, [0, L], [f.h - 20, f.h], [0, D + 30]);
  if (f.plate) k.rbox('white', [L / 2 - 120, L / 2 + 120], [f.plate - 80, f.plate + 80], [D, D + 8], 3);
};
B.wallCab = (k, f, L, D) => { const [y0, y1] = f.y; k.box(f.mat, [0, L], [y0, y1], [0, D - 18]); door(k, f.mat, [0, L], [y0, y1], D); if (f.ledBelow) k.box('led', [10, L - 10], [y0 - 4, y0], [D - 40, D - 20]); };
B.wc = (k, f, L, D) => { // ჩამოკიდებული უნიტაზი (მართკუთხა რბილი ფორმა)
  k.rbox('ceramic', [L / 2 - 175, L / 2 + 175], [180, 380], [0, D], 70, { seg: 5 });
  k.rbox('ceramic', [L / 2 - 180, L / 2 + 180], [380, 410], [10, D + 5], 60, { seg: 4 });
};
B.glass = (k, f, L, D) => {
  k.box('glass', [0, L], [0, f.h], [0, D]);
  for (const x of f.hinges || []) for (const y of [300, f.h - 300]) k.rbox('nickel', [x - 30, x + 30], [y - 30, y + 30], [-8, D + 8], 4);
  if (f.edge) k.box(f.edge, [L - 12, L], [0, f.h], [-2, D + 2]);
};
B.towel = (k, f, L, D) => { // თეთრი პირსახოცის საშრობი ბრტყელი ზოლებით
  const [y0, y1] = f.y;
  for (const x of [20, L - 20]) k.box('white', [x - 15, x + 15], [y0, y1], [D - 30, D]);
  for (let y = y0 + 60; y < y1 - 40; y += f.gap || 90) k.box('white', [10, L - 10], [y, y + 22], [D - 45, D - 25]);
  for (const y of [y0 + 50, y1 - 50]) k.cyl('white', 20, D / 2, y, y + 1, 12);
};

// ---- F7 (06): მუხის კარადა ღია განყოფილებით და თეთრი გასაწევი კარებით მუხის ზოლით
B.slidingWardrobe = (k, f, L, D) => {
  const H = f.h, m = 'oakWarm';
  k.box(m, [0, 18], [0, H], [0, D], { grain: 'y' }); k.box(m, [L - 18, L], [0, H], [0, D], { grain: 'y' });
  k.box(m, [18, L - 18], [H - 18, H], [0, D]); k.box(m, [18, L - 18], [0, 60], [0, D - 60]);
  k.box(m, [18, L - 18], [0, H], [0, 12]);
  k.box(m, [18, L - 18], [1180, 1200], [12, D - 70]);
  k.box(m, [18, L - 18], [1950, 1970], [12, D - 70]);
  for (const y of [1120, 1890]) { const g = new THREE.CylinderGeometry(12, 12, L - 40, 12); g.rotateZ(Math.PI / 2); k.geo('nickel', g, { at: [L / 2, y, D / 2 - 40] }); }
  for (const [x0, z] of f.doors) {
    const X = [x0, x0 + f.doorW];
    k.box('white', X, [70, 900], [z - 20, z]); k.box('white', X, [1200, H - 25], [z - 20, z]);
    k.box('oakWarm', X, [900, 1200], [z - 20, z]);
    k.box('shadow', [X[0], X[0] + 4], [70, H - 25], [z - 21, z + 1]);
  }
};
B.dresser = (k, f, L, D) => { // კაკლის კომოდი მარმარილოს ზედაპირით, დახრილი ფეხები
  const [y0, y1] = f.y;
  for (const [x, z] of [[60, 60], [L - 60, 60], [60, D - 60], [L - 60, D - 60]]) k.tube('blackMetal', [[x + (x < L / 2 ? -15 : 15), 0, z + (z < D / 2 ? -10 : 10)], [x, y0, z]], 14, { radial: 8 });
  k.box('walnut', [0, L], [y0, y1 - 22], [0, D - 18]);
  const half = L / 2;
  for (const X of [[0, half / 2], [half / 2, half]]) { door(k, 'walnut', X, [y0, y1 - 22], D, 18, 3, { grain: 'y' }); k.box('shadow', [X[0] + 20, X[1] - 20], [y1 - 60, y1 - 50], [D - 2, D + 1]); }
  const hh = (y1 - 22 - y0) / 3;
  for (let i = 0; i < 3; i++) { const Y = [y0 + i * hh, y0 + (i + 1) * hh]; door(k, 'walnut', [half, L], Y, D, 18, 3); k.box('shadow', [half + 60, L - 60], [Y[1] - 30, Y[1] - 20], [D - 2, D + 1]); }
  k.box('marbleGold', [-5, L + 5], [y1 - 22, y1], [-5, D + 8]);
};

// ---- F8 ღია თაროები უკვე wardrobe-ში; საწოლის კედლის პანელი 05
B.headWall = (k, f, L, D) => { k.box(f.mat, [0, L], [0, f.h], [0, D], { grain: 'y' }); k.box('led', [5, L - 5], [f.h - 6, f.h], [D, D + 8]); };

// ---- ტერასა
B.outdoorSofa = (k, f, L, D) => {
  const arm = 70;
  for (const x of [0, L - arm]) {
    k.box('teak', [x, x + arm], [0, 620], [0, 45], { grain: 'y' }); k.box('teak', [x, x + arm], [0, 620], [D - 45, D], { grain: 'y' });
    k.box('teak', [x - 5, x + arm + 5], [600, 640], [0, D], { grain: 'z' });
    for (let y = 120; y < 560; y += 85) k.box('teak', [x + 12, x + arm - 12], [y, y + 40], [45, D - 45], { grain: 'z' });
  }
  k.box('teak', [arm, L - arm], [160, 200], [20, D - 20]);
  k.box('teak', [arm, L - arm], [200, 740], [0, 40], { grain: 'x' });
  const n = 2, w = (L - 2 * arm) / n;
  for (let i = 0; i < n; i++) {
    k.rbox(f.mat, [arm + i * w + 4, arm + (i + 1) * w - 4], [200, 340], [45, D - 10], 40, { seg: 4 });
    k.rbox(f.mat, [arm + i * w + 4, arm + (i + 1) * w - 4], [330, 760], [40, 190], 50, { seg: 4, rot: [-8, 0, 0] });
  }
  for (const [xf, col] of f.pillows) k.geo(col, pillowGeo(420, 400, 130), { rot: [-70, 0, 0], at: [L * xf, 520, 240] });
};
B.outdoorTable = (k, f, L, D) => {
  for (const x of [40, L - 40]) k.box('teak', [x - 35, x + 35], [0, f.h - 30], [30, D - 30], { grain: 'y' });
  const n = Math.floor(L / 95);
  for (let i = 0; i < n; i++) { const x = i * (L / n); k.box('teak', [x + 4, x + L / n - 4], [f.h - 30, f.h], [0, D], { grain: 'z' }); }
};
B.rattanChair = (k, f, L, D) => { // მრგვალი რატანის „ჯამი“ შავ ლითონის ფეხებზე, ზურგისკენ დახრილი
  const R = Math.min(L, D) / 2, cx = L / 2, cz = D / 2, base = 330;
  for (let i = 0; i < 4; i++) { const a = (45 + i * 90) * DEG; k.tube('blackMetal', [[cx + Math.cos(a) * R * 0.78, 0, cz + Math.sin(a) * R * 0.78], [cx + Math.cos(a) * R * 0.42, base + 40, cz + Math.sin(a) * R * 0.42]], 9); }
  k.geo('blackMetal', new THREE.TorusGeometry(R * 0.45, 9, 8, 40).rotateX(Math.PI / 2), { at: [cx, base + 40, cz] });
  const bowl = new THREE.SphereGeometry(R, 40, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); // ქვედა ნახევარსფერო
  bowl.scale(1, 0.62, 1); bowl.rotateX(-f.tilt * DEG); bowl.rotateY(f.yaw * DEG);
  k.geo('rattan', bowl, { at: [cx, base + R * 0.62, cz] });
  const rim = new THREE.TorusGeometry(R, 16, 8, 56).rotateX(Math.PI / 2); rim.rotateX(-f.tilt * DEG); rim.rotateY(f.yaw * DEG);
  k.geo('rattan', rim, { at: [cx, base + R * 0.62, cz] });
  const cush = new THREE.CylinderGeometry(R * 0.6, R * 0.62, 80, 32); cush.rotateX(-f.tilt * 0.6 * DEG); cush.rotateY(f.yaw * DEG);
  k.geo(f.mat, cush, { at: [cx, base + 120, cz] });
};
B.bistroTable = (k, f, L, D) => {
  const cx = L / 2, cz = D / 2;
  k.cyl('stoneLight', cx, cz, f.h - 25, f.h, f.d / 2, f.d / 2, 48);
  k.cyl('blackMetal', cx, cz, 60, f.h - 25, 30, 30, 16);
  k.cyl('blackMetal', cx, cz, 0, 25, 230, 240, 32);
};
B.ropeChair = (k, f, L, D) => {
  const cx = L / 2, cz = D / 2, yaw = f.yaw * DEG, s = 260;
  const P = (x, y, z) => [cx + x * Math.cos(yaw) - z * Math.sin(yaw), y, cz + x * Math.sin(yaw) + z * Math.cos(yaw)];
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) k.tube('blackMetal', [P(x * 0.9, 0, z * 0.9), P(x * 0.8, 440, z * 0.8)], 10);
  const seat = new THREE.CylinderGeometry(s * 0.95, s * 0.9, 30, 32); seat.rotateY(-yaw);
  k.geo('ropeDark', seat, { at: [cx, 450, cz] });
  const back = arcBandGeo(s * 0.98, 35, 200, 300, 6); back.rotateY(-yaw + Math.PI);
  k.geo('ropeDark', back, { at: [cx, 470, cz] });
};

// ================================================================ განთავსება და ინფორმაცია
const FACE_ROT = { y1: 0, x1: Math.PI / 2, y0: Math.PI, x0: -Math.PI / 2 };
export function placement(r, face = 'y1') {
  const [x0, y0, x1, y1] = r;
  const alongX = face === 'y0' || face === 'y1';
  const L = alongX ? x1 - x0 : y1 - y0, D = alongX ? y1 - y0 : x1 - x0;
  const origin = { y1: [x0, y0], x1: [x0, y1], y0: [x1, y1], x0: [x1, y0] }[face];
  return { L, D, origin, rotY: FACE_ROT[face] };
}
const KIND = {
  wardrobe: 'კარადა', desk: 'სამუშაო მაგიდა', tubChair: 'სკამი', bedRound: 'საწოლი', bedPanel: 'საწოლი', bedVelvet: 'საწოლი', drum: 'ტუმბო', chest: 'ტუმბო',
  kitchen: 'სამზარეულო', diningTable: 'მაგიდა', wishbone: 'სკამი', shellChair: 'სკამი', armchair: 'სავარძელი', sofa: 'დივანი', coffeeTable: 'მაგიდა',
  wallPanels: 'კედლის პანელი', consoleF2: 'TV-კონსოლი', shelf: 'თარო', tv: 'ტელევიზორი', slats: 'ღარიანი ტიხარი', bench: 'სკამი', mirror: 'სარკე',
  vanityF6: 'ნიჟარის კარადა', vanityF7: 'ნიჟარის კარადა', instBox: 'ინსტალაციის ყუთი', wallCab: 'ჩამოკიდებული კარადა', wc: 'უნიტაზი', glass: 'მინის ტიხარი',
  towel: 'პირსახოცის საშრობი', slidingWardrobe: 'კარადა', dresser: 'კომოდი', headWall: 'კედლის პანელი', outdoorSofa: 'ტერასის დივანი',
  outdoorTable: 'ტერასის მაგიდა', rattanChair: 'ტერასის სავარძელი', bistroTable: 'ტერასის მაგიდა', ropeChair: 'ტერასის სკამი',
};
export function buildFurnitureItem(f) {
  const { L, D, origin, rotY } = placement(f.r, f.face);
  const k = new Kit();
  B[f.type](k, f, L, D);
  const inner = k.build(f.id);
  const g = new THREE.Group();
  g.name = f.id;
  inner.name = f.id + '_geometry';
  inner.position.set(origin[0] * M, 0, origin[1] * M);
  inner.rotation.y = rotY;
  g.add(inner);
  // ინფორმაცია: რეალური ზომები აგებული გეომეტრიიდან (ლოკალურ ღერძებში)
  const bb = new THREE.Box3();
  inner.updateMatrixWorld(true);
  for (const m of inner.children) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix)); }
  const s = bb.getSize(new THREE.Vector3());
  const fmt = (v) => (v).toFixed(2);
  const st = f.st || {};
  const size = { 'სიგრძე': fmt(s.x), 'სიღრმე': fmt(s.z), 'სიმაღლე': fmt(s.y) };
  if (bb.min.y > 0.02) size['ქვედა ნიშნული'] = fmt(bb.min.y);
  const mats = [...new Set(inner.children.map((m) => m.material.userData.description))].filter((d) => d && !/LED|ჩრდილის/.test(d));
  g.userData.info = {
    code: f.code || f.id, kind: KIND[f.type], zone: f.zone ? (f.zone === 'T' ? 'ტერასა' : `ოთახი ${f.zone}`) : '', name: f.name, size,
    status: { 'სიგრძე': st.w || 'render', 'სიღრმე': st.d || 'render', 'სიმაღლე': st.h || 'assumed', 'ქვედა ნიშნული': st.h || 'assumed', 'მდებარეობა': st.pos || 'vec', 'ფორმა': st.shape || 'render', 'მასალა': 'render' },
    shape: f.ref ? `რენდერი ${f.ref}` : '', materials: mats, note: f.note, sheets: [...(f.sheets || []), ...(f.ref ? [`რენდერები ${f.ref}`] : [])],
  };
  return g;
}
