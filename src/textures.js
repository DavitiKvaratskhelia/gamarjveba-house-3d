// პროცედურული ფაქტურები (ხე, მარმარილო, ქსოვილი, ნაწნავი) — მხოლოდ JavaScript, DOM-ის გარეშე.
// ორიგინალი ფაქტურები PDF-ში არ არის: ესენი რენდერებთან მიახლოებული ანალოგებია (ფერი, ნახატის მასშტაბი,
// ბოჭკოს მიმართულება). ყოველი ფაქტურა დეტერმინისტულია (ფიქსირებული seed) — ყოველ ჩატვირთვაზე ერთნაირია.
// ფაქტურის ზომა რეალურ მმ-ში მოცემულია `size`-ით — UV-ები მოდელში ამ მასშტაბით ითვლება (გადაჭიმვის გარეშე).
import * as THREE from 'three';

// ---------------------------------------------------------------- ხმაური
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function makeNoise(seed, period) {
  // პერიოდული (tileable) value-noise: ბადე period × period (2-ის ხარისხი) — ფაქტურის კიდეები ერთმანეთს ერწყმის
  const r = rng(seed), P = period, MSK = P - 1, g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = xi & MSK, y0 = yi & MSK, x1 = (x0 + 1) & MSK, y1 = (y0 + 1) & MSK;
    const r0 = y0 * P, r1 = y1 * P;
    const a = g[r0 + x0], b = g[r0 + x1], c = g[r1 + x0], d = g[r1 + x1];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
// fbm ნორმირებულ კოორდინატებში (0…1) — ოქტავები მრავლდება მთელ რიცხვებზე, ამიტომ tileable რჩება
function fbm(noise, base, oct = 4) {
  return (u, v) => {
    let f = base, a = 0.5, s = 0;
    for (let o = 0; o < oct; o++) { s += a * noise(u * f, v * f); f *= 2; a *= 0.5; }
    return s / (1 - Math.pow(0.5, oct));
  };
}
// sRGB 0…1 პირდაპირ hex-იდან (THREE.Color წრფივ სივრცეში გადაიყვანდა — ფაქტურა კი sRGB-შია)
const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function dataTex(w, h, fill, { srgb = true, name } = {}) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fill(x / w, y / h), i = (y * w + x) * 4;
    data[i] = Math.round(clamp01(c[0]) * 255); data[i + 1] = Math.round(clamp01(c[1]) * 255); data[i + 2] = Math.round(clamp01(c[2]) * 255); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.name = name || '';
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.userData.mimeType = 'image/jpeg'; // GLB-ში JPEG (ფაილის ზომისთვის)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
// სიმაღლის ველიდან ნორმალების რუკა (Sobel), tileable
function normalFromHeight(w, h, H, strength, name) {
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  return dataTex(w, h, (u, v) => {
    const x = Math.round(u * w), y = Math.round(v * h);
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    return [nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5];
  }, { srgb: false, name });
}
function heightField(w, h, fn) { const H = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = fn(x / w, y / h); return H; }

// ---------------------------------------------------------------- ხე
// u — ბოჭკოს გასწვრივ. size: [გასწვრივ მმ, განივად მმ]. figure — „წლიური რგოლების“ რაოდენობა განივად.
export function woodTextures({ base, dark, light, seed = 1, figure = 26, contrast = 0.4, pores = 0.5, size = [2400, 600], w = 1024, h = 256, name = 'wood' }) {
  const n1 = makeNoise(seed, 64), n2 = makeNoise(seed + 7, 64), n3 = makeNoise(seed + 13, 256);
  const warp = fbm(n1, 2, 4), fine = fbm(n2, 8, 3);
  const B = hex(base), D = hex(dark), L = hex(light || base);
  const S = new Float32Array(w * h), Pr = new Float32Array(w * h), T = new Float32Array(w * h), H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, i = y * w + x;
    const wv = warp(u, v);
    // სწორი წვრილი ბოჭკო (რადიალური ჭრა): ხაზები u-ს გასწვრივ, მცირე ტალღით
    const vv = v + 0.006 * (wv - 0.5) + 0.002 * Math.sin(u * Math.PI * 2 * 2 + v * 7);
    const ring = 0.5 + 0.5 * Math.sin(vv * Math.PI * 2 * figure + 1.6 * wv);
    const ring2 = 0.5 + 0.5 * Math.sin(vv * Math.PI * 2 * figure * 2.7 + 3.1 * wv);
    S[i] = 0.65 * Math.pow(ring, 6) + 0.35 * Math.pow(ring2, 10);
    Pr[i] = n3(u * 256 * 2, v * 256 * 0.25) > 0.86 ? pores : 0;   // სიგრძივი ფორები
    T[i] = fine(u, v);
    H[i] = S[i] * 0.6 + Pr[i] * 0.8;
  }
  const map = dataTex(w, h, (u, v) => {
    const i = Math.round(v * h) % h * w + Math.round(u * w) % w;
    const c = mix(L, B, clamp01(0.25 + T[i] * 0.9));
    return mix(c, D, S[i] * contrast + Pr[i] * 0.25);
  }, { name: name + '_color' });
  const normalMap = normalFromHeight(w, h, H, 1.6, name + '_normal');
  return { map, normalMap, size, normalScale: 0.35 };
}

// ---------------------------------------------------------------- მარმარილო / ქვა
// veins — ძარღვების ფერი, density — სიხშირე, gold — მეორე (თბილი) ძარღვის ფერი
export function marbleTextures({ base, vein, vein2, seed = 3, density = 2.2, width = 0.06, cloud = 0.08, size = [1200, 1200], N = 768, name = 'marble' }) {
  const n1 = makeNoise(seed, 32), n2 = makeNoise(seed + 5, 32), n3 = makeNoise(seed + 11, 128);
  const w1 = fbm(n1, 2, 4), w2 = fbm(n2, 3, 4), c1 = fbm(n3, 4, 3);
  const Bc = hex(base), V = hex(vein), V2 = hex(vein2 || vein);
  const map = dataTex(N, N, (u, v) => {
    // ძარღვები: დამახინჯებული დიაგონალური ზოლების ვიწრო „ქედები“ + წვრილი განშტოებები
    const t = (u + v * 0.6) * density + 2.4 * w1(u, v);
    const main = Math.pow(1 - Math.abs(Math.sin(t * Math.PI)), 1 / width) ;
    const t3 = (v * 1.3 - u * 0.4) * density * 0.8 + 2.9 * w2(v, u);
    const soft = Math.pow(1 - Math.abs(Math.sin(t3 * Math.PI)), 1 / width * 0.6) * 0.35;   // მკრთალი ფართო ძარღვები
    const t2 = (u * 1.7 - v) * density * 1.9 + 3.4 * w2(u, v);
    const thin = Math.pow(1 - Math.abs(Math.sin(t2 * Math.PI)), 1 / width * 2.2) * 0.7 * clamp01(w1(u * 2, v * 2) * 1.8 - 0.4);
    let c = mix(Bc, [Bc[0] * 0.95, Bc[1] * 0.95, Bc[2] * 0.96], (c1(u, v) - 0.3) * cloud * 6);
    c = mix(c, V2, clamp01(soft));
    c = mix(c, V, clamp01(main * 0.85));
    c = mix(c, V2, clamp01(thin));
    return c;
  }, { name: name + '_color' });
  return { map, size, normalMap: null };
}

// ---------------------------------------------------------------- ქსოვილი
// weave — ქსოვის ბიჯი (მმ), boucle — მარყუჟიანი ზედაპირი, velvet — გლუვი (დაბალი რელიეფი)
// ფაქტურა ნეიტრალურია (≈თეთრი) — ფერს აძლევს მასალის color, ამიტომ ერთი ფაქტურა რამდენიმე ქსოვილს ემსახურება
export function fabricTextures({ seed = 5, weave = 2.2, boucle = 0, variation = 0.06, size = [300, 300], N = 512, name = 'fabric' }) {
  const n1 = makeNoise(seed, 64), n2 = makeNoise(seed + 3, 256);
  const lo = fbm(n1, 3, 4);
  const cells = size[0] / weave; // ძაფების რაოდენობა ფაქტურაზე
  const B = [1, 1, 1];
  const hgt = (u, v) => {
    const wx = Math.sin(u * Math.PI * 2 * cells), wy = Math.sin(v * Math.PI * 2 * cells);
    const tw = (Math.floor(u * cells) + Math.floor(v * cells)) % 2 ? wx : wy; // ტილოს ქსოვა
    const b = boucle ? Math.pow(n2(u * 256, v * 256), 2) * boucle : 0;
    return 0.5 + 0.25 * tw * (1 - boucle) + b;
  };
  const H = heightField(N, N, hgt);
  const map = dataTex(N, N, (u, v) => {
    const k = 1 + (lo(u, v) - 0.5) * variation * 2 + (H[Math.floor(v * N) * N + Math.floor(u * N)] - 0.5) * 0.12;
    return [B[0] * k, B[1] * k, B[2] * k];
  }, { name: name + '_color' });
  const normalMap = normalFromHeight(N, N, H, boucle ? 2.2 : 1.2, name + '_normal');
  return { map, normalMap, size, normalScale: boucle ? 0.9 : 0.5 };
}

// ---------------------------------------------------------------- ნაწნავი (ქაღალდის თოკი, რატანი, თოკი)
export function wovenTextures({ base, dark, seed = 9, strand = 8, size = [160, 160], N = 256, name = 'woven' }) {
  const n = makeNoise(seed, 64);
  const cells = size[0] / strand;
  const B = hex(base), D = hex(dark);
  const hgt = (u, v) => {
    const cu = u * cells, cv = v * cells;
    const iu = Math.floor(cu), iv = Math.floor(cv), fu = cu - iu, fv = cv - iv;
    const over = (iu + iv) % 2 === 0;
    const across = over ? Math.sin(fv * Math.PI) : Math.sin(fu * Math.PI);
    return 0.25 + 0.75 * across * (0.9 + 0.1 * n(u * 64, v * 64));
  };
  const H = heightField(N, N, hgt);
  const map = dataTex(N, N, (u, v) => mix(D, B, clamp01(H[Math.floor(v * N) * N + Math.floor(u * N)])), { name: name + '_color' });
  const normalMap = normalFromHeight(N, N, H, 2.5, name + '_normal');
  return { map, normalMap, size, normalScale: 1.0 };
}
