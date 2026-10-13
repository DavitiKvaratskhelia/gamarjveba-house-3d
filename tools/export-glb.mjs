// აგებს მოდელს Node-ში, ინახავს dist/branch-model.glb-ს, შემდეგ ხელახლა კითხულობს ფაილს და ამოწმებს
// ჯგუფებს, ზომებს და მასშტაბს.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildModel } from '../src/model.js';

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
const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
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
  ['W-S3', 'სამხრეთის კედელი 5.80 × 0.30'], ['W-W1', 'დასავლეთის კედელი 0.30 × 6.60'], ['P-12', 'ტიხარი 3.90 × 0.10'],
  ['C-02', 'სვეტი 0.30 × 0.30'], ['F1', 'სამზარეულო 3.87 × 3.00'], ['F4', 'კარადა 2.70 × 0.60 × 3.00'], ['F8', 'კარადა 3.32 × 0.60 × 3.00'],
  ['BED-02', 'საწოლი 2.10 × 1.90'], ['SF-01', 'დივანი 2.80 × 0.90'], ['TB-01', 'მაგიდა 1.60 × 0.80'], ['F9', 'ტიხარი 2.20 × 3.00'],
  ['Floor_01', 'მისაღები'], ['Roof', 'სახურავი 16.30 × 11.10'],
];
for (const [n, label] of checks) {
  const o = find(n);
  if (!o) { console.log('  ✗ ვერ მოიძებნა:', n); continue; }
  const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
  console.log(`  ${n.padEnd(9)} ${label.padEnd(30)} → X ${s.x.toFixed(3)} · Y ${s.y.toFixed(3)} · Z ${s.z.toFixed(3)}`);
}
console.log('extras (F4):', JSON.stringify(find('F4').userData.info).slice(0, 140) + '…');
