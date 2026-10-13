// აგებს მოდელს Node-ში, ინახავს dist/branch-model.glb-ს, შემდეგ ხელახლა კითხულობს ფაილს და ამოწმებს
// ჯგუფებს, ზომებს და მასშტაბს.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildModel } from '../src/model.js';
import { WALLS } from '../src/config.js';
import { FURNITURE } from '../src/furniture-data.js';
import { createCanvas, ImageData as NapiImageData } from '@napi-rs/canvas';

// ფაქტურების PNG-ად ჩასაწერად Node-ში საჭიროა canvas (ბრაუზერში — ჩაშენებულია)
globalThis.ImageData ??= NapiImageData;
globalThis.OffscreenCanvas ??= class {
  constructor(w, h) { this._c = createCanvas(w, h); }
  get width() { return this._c.width; } set width(v) { this._c.width = v; }
  get height() { return this._c.height; } set height(v) { this._c.height = v; }
  getContext(t, o) { return this._c.getContext(t, o); }
  async convertToBlob({ type = 'image/png' } = {}) { return new Blob([await this._c.encode(type === 'image/jpeg' ? 'jpeg' : 'png')], { type }); }
};

// GLTFExporter იყენებს FileReader-ს — Node-ში არ არსებობს
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onloadend?.(); }); }
};

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/branch-model.glb');
const { root } = buildModel();
const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(glb));
console.log(`GLB: ${out} (${(glb.byteLength / 1024).toFixed(0)} KB)`);

// ---- შემოწმება: ფაილის ხელახლა წაკითხვა
const buf = fs.readFileSync(out);
function stripImages(b) { // შემოწმებისთვის: Node-ში PNG-ის დეკოდირება შეუძლებელია — ფაქტურების მითითებები დროებით ამოიღება
  const jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const info = { images: (json.images || []).length, textured: (json.materials || []).filter((m) => m.pbrMetallicRoughness?.baseColorTexture).length, normal: (json.materials || []).filter((m) => m.normalTexture).length, sheen: (json.materials || []).filter((m) => m.extensions?.KHR_materials_sheen).length };
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials || []) { if (m.pbrMetallicRoughness) delete m.pbrMetallicRoughness.baseColorTexture; delete m.normalTexture; if (m.extensions?.KHR_materials_sheen) { delete m.extensions.KHR_materials_sheen.sheenColorTexture; delete m.extensions.KHR_materials_sheen.sheenRoughnessTexture; } }
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const rest = b.subarray(20 + jl), head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + rest.length, 8); head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  return { glb: Buffer.concat([head, js, rest]), info };
}
const { glb: stripped, info: texInfo } = stripImages(buf);
console.log(`ფაქტურები GLB-ში: ${texInfo.images} სურათი, ${texInfo.textured} მასალა ფერის რუკით, ${texInfo.normal} ნორმალების რუკით, ${texInfo.sheen} ქსოვილის (sheen) მასალა`);
const gltf = await new GLTFLoader().parseAsync(stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength), '');
const scene = gltf.scene;
scene.updateMatrixWorld(true);
let meshes = 0, tris = 0;
const mats = new Set();
scene.traverse((o) => { if (o.isMesh) { meshes++; mats.add(o.material.name); const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
const box = new THREE.Box3().setFromObject(scene), sz = box.getSize(new THREE.Vector3());
const top = scene.children[0];
console.log('ძირეული ობიექტი:', top.name);
console.log('ჯგუფები:', top.children.map((c) => `${c.name} (${c.children.length})`).join(', '));
console.log(`მეშები: ${meshes}, სამკუთხედები: ${Math.round(tris)}, მასალები: ${mats.size}`);
console.log(`საზღვრები (მ): X ${box.min.x.toFixed(3)}…${box.max.x.toFixed(3)}, Y ${box.min.y.toFixed(3)}…${box.max.y.toFixed(3)}, Z ${box.min.z.toFixed(3)}…${box.max.z.toFixed(3)}`);
console.log(`ზომა (მ): ${sz.x.toFixed(2)} × ${sz.y.toFixed(2)} × ${sz.z.toFixed(2)}`);
const find = (n) => { let r = null; scene.traverse((o) => { if (!r && o.name === n) r = o; }); return r; };
const checks = [
  ['W-S3', 'სამხრეთის კედელი 5.80 × 0.30'], ['P-12', 'ტიხარი 3.90 × 0.10'], ['C-02', 'სვეტი 0.30 × 0.30'],
  ['F1', 'სამზარეულო 3.87 × 0.60 × 3.00'], ['F4', 'კარადა 2.70 × 0.60 × 3.00'], ['F8', 'კარადა 3.32 × 0.60 × 3.00'], ['F3', 'კარადა 1.47 × 0.70 × 3.00'],
  ['BED-02', 'საწოლი 1.90 × 2.10'], ['SF-01', 'დივანი 2.80 × 0.90'], ['TB-01', 'მაგიდა 0.80 × 1.60'], ['CT-01', 'მაგიდა 0.50 × 1.00'], ['F9', 'ტიხარი 2.20 × 3.00'], ['Roof', 'სახურავი 16.30 × 11.10'],
];
for (const [n, label] of checks) {
  const o = find(n);
  if (!o) { console.log('  ✗ ვერ მოიძებნა:', n); continue; }
  const s2 = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
  console.log(`  ${n.padEnd(9)} ${label.padEnd(30)} → X ${s2.x.toFixed(3)} · Y ${s2.y.toFixed(3)} · Z ${s2.z.toFixed(3)}`);
}

// ---- ავეჯის შემოწმება: კედლებში შეჭრა, ურთიერთგადაფარვა, იატაკიდან აწევა / ქვემოთ ჩასვლა, UV
const fur = top.children.find((c) => c.name === 'Furniture');
const boxes = fur.children.map((g) => ({ id: g.name, b: new THREE.Box3().setFromObject(g) }));
const T = 0.004; // 4 მმ ტოლერანსი (შეხება კედელთან / ერთმანეთთან)
const shrink = (b) => b.clone().expandByScalar(-T);
let wallHits = 0;
for (const { id, b } of boxes) for (const w of WALLS) {
  const wb = new THREE.Box3(new THREE.Vector3(w.r[0] / 1000, 0, w.r[1] / 1000), new THREE.Vector3(w.r[2] / 1000, 3, w.r[3] / 1000));
  if (shrink(b).intersectsBox(wb)) { wallHits++; console.log(`  ⚠ კედელში შეჭრა: ${id} ↔ ${w.id}`); }
}
// ნებადართული გადაფარვები (AABB-ის დონეზე; რეალური გეომეტრია არ იკვეთება):
// სკამები მაგიდის / სამუშაო მაგიდის ქვეშ, ერთი ნივთის ნაწილები (F2, F4, F6, F7, F9), TV კომოდის / კონსოლის თავზე,
// ინსტალაციის ყუთი F5-A-ს ქვეშ, WP-05-ის LED-ზოლი 2.75 მ სიმაღლეზეა (საწოლი და ტუმბოები < 1.1 მ)
const ALLOWED = new Set([
  ...['a', 'b', 'c', 'd', 'e', 'f'].map((x) => `CH-01${x}|TB-01`), 'CH-02|F4-desk', 'F4|F4-desk', 'F5-A|IB-03',
  'F2|F2-panel', 'F2-panel|F2-shelf', 'F2|TV-01', 'F2-panel|TV-01', 'F2-shelf|TV-01', 'F2|F2-shelf', 'TC-06|TV-06',
  'F9|F9-bench', 'F9|F9-mirror', 'F9|F9-shelf', 'F9-bench|F9-shelf', 'F9-mirror|F9-shelf', 'F6|F6-mirror', 'F7-mirror|F7-v',
  'BED-05|WP-05', 'IB-03|WC-03', 'NS-05a|WP-05', 'NS-05b|WP-05', ...[1, 2, 3, 4].map((i) => `BT-1|RP-${i}`),
]);
const allowed = (a, b) => ALLOWED.has([a, b].sort().join('|'));
let overl = 0;
for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
  const A = boxes[i], Bx = boxes[j];
  if (!shrink(A.b).intersectsBox(shrink(Bx.b)) || allowed(A.id, Bx.id)) continue;
  overl++; console.log(`  ⚠ გადაფარვა: ${A.id} ↔ ${Bx.id}`);
}
const floor = { T: 0 };
let flo = 0;
for (const { id, b } of boxes) {
  const f = FURNITURE.find((q) => q.id === id);
  const hung = f && ((f.y && f.y[0] > 0) || ['mirror', 'wallCab', 'shelf', 'tv', 'consoleF2', 'towel', 'wc', 'vanityF6', 'vanityF7', 'desk', 'bench'].includes(f.type));
  if (b.min.y < -0.0005) { flo++; console.log(`  ⚠ იატაკის ქვემოთ: ${id} ${b.min.y.toFixed(4)}`); }
  else if (!hung && b.min.y > 0.002) { flo++; console.log(`  ⚠ იატაკიდან აწეული: ${id} ${b.min.y.toFixed(4)}`); }
}
let noUV = 0; fur.traverse((o) => { if (o.isMesh && !o.geometry.attributes.uv) noUV++; });
console.log(`ავეჯი: ${boxes.length} ნივთი · კედელში შეჭრა: ${wallHits} · დაუშვებელი გადაფარვა: ${overl} · იატაკის პრობლემა: ${flo} · UV-ს გარეშე მეში: ${noUV}`);
