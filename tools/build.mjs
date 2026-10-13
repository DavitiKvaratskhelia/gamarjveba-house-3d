// აწყობს ერთ HTML ფაილს (dist/branch-viewer.html): three.js + კოდი + გეომეტრია ჩაშენებულია —
// ინტერნეტი და ლოკალური სერვერი არ სჭირდება.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = await build({
  entryPoints: [path.join(rootDir, 'src/viewer.js')],
  bundle: true, format: 'iife', minify: true, write: false, target: ['es2020'], legalComments: 'none', charset: 'utf8',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\/script');
const html = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf8').replace('<!--APP-->', () => `<script>\n${js}</script>`);
const out = path.join(rootDir, 'dist/branch-viewer.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`dist/branch-viewer.html — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
