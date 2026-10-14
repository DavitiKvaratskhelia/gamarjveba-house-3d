// გამარჯვების სახლი — განათების სისტემა სანახავში: სინათლის წყაროები, ჩამრთველები, სიკაშკაშე, გეგმის ნიშნულები.
//
// • სინათლის წყაროები (SpotLight) — ცალკე ჯგუფი სცენაში (GLB-ში არ შედის); თითო სანათზე ერთი წყარო
//   (ორთავიანი / ორმაგი სანათის ელემენტები ერთ წყაროდ ერთიანდება — ნაკადი ჯამდება).
// • ხილვადობა (კორპუსები + გეგმის ნიშნულები) და შუქი (წყაროები + მანათობელი ზედაპირი) — ერთმანეთისგან დამოუკიდებელია.
// • გამორთვისას წყარო სცენიდან არ იღება (მხოლოდ ინტენსივობა = 0) — შეიდერები თავიდან არ კომპილირდება.
import * as THREE from 'three';
import { GROUPS, lightRGB, CEILING } from './lighting.js';
import { lensMaterials } from './lighting-model.js';

const M = 0.001, DEG = Math.PI / 180;
// ვიზუალური მასშტაბი: სცენის განათება (მზე, ცა) ფოტომეტრიული არ არის, ამიტომ lm × SCALE = three.js-ის power.
// შერჩეულია ისე, რომ სანათის ლაქა იატაკზე მკაფიოდ ჩანდეს, მაგრამ არ „იწვოდეს“ (ვიზუალური, არა ფოტომეტრიული).
export const SCALE = 0.06;

// ---- შეიდერი: SpotLight-ების ციკლი three.js-ში „იშლება“ (unroll) — 50 წყაროზე ყველა მასალის შეიდერი დიდდება და
// კომპილაცია (განსაკუთრებით Windows/ANGLE-ზე) წამობით გრძელდება. სანათები ჩრდილს / ტექსტურას არ იყენებენ, ამიტომ
// ასეთ შემთხვევაში ციკლი რჩება ჩვეულებრივ ციკლად (WebGL2 ამას უშვებს); სხვა შემთხვევაში — ორიგინალი კოდი.
{
  const src = THREE.ShaderChunk.lights_fragment_begin;
  const a = src.indexOf('#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )');
  const b = src.indexOf('#pragma unroll_loop_end', a);
  const e = src.indexOf('#endif', b) + '#endif'.length;
  if (a >= 0 && b > a && !src.includes('__SPOT_LOOP_PATCH__')) {
    const original = src.slice(a, e);
    const simple = `// __SPOT_LOOP_PATCH__
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct ) && ( NUM_SPOT_LIGHT_SHADOWS == 0 ) && ( NUM_SPOT_LIGHT_MAPS == 0 )
	SpotLight spotLight;
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		// ადრეული გამოტოვება: გამორთული წყარო / წერტილი კონუსის ან მოქმედების რადიუსის გარეთ — BRDF არ ითვლება
		// (შედეგი იგივეა: ასეთ წერტილში getSpotLightInfo ფერს 0-ს აძლევს)
		if ( spotLight.color.r + spotLight.color.g + spotLight.color.b <= 0.0 ) continue;
		vec3 sv = spotLight.position - geometryPosition;
		float sd = length( sv );
		if ( spotLight.distance > 0.0 && sd >= spotLight.distance ) continue;
		if ( dot( sv / sd, spotLight.direction ) <= spotLight.coneCos ) continue;
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
#else
${original}
#endif`;
    THREE.ShaderChunk.lights_fragment_begin = src.slice(0, a) + simple + src.slice(e);
  }
}

export function setupLighting({ scene, renderer, lighting, helpers, onChange, getMode }) {
  const KEYS = Object.keys(GROUPS);
  const state = Object.fromEntries(KEYS.map((k) => [k, { visible: true, on: true, level: 1 }]));
  const color = Object.fromEntries(KEYS.map((k) => { const [r, g, b] = lightRGB(GROUPS[k].cct); return [k, new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace)]; }));

  // ---- წყაროები: თითო სანათზე ერთი (ელემენტების ცენტრი, ნაკადი — ჯამი)
  const byFixture = new Map();
  for (const em of lighting.emitters) {
    const k = em.group + ':' + em.fixture;
    if (!byFixture.has(k)) byFixture.set(k, { group: em.group, zone: em.zone, pts: [] });
    byFixture.get(k).pts.push(em);
  }
  let sources = [...byFixture.values()].map((f) => {
    const n = f.pts.length, x = f.pts.reduce((s, p) => s + p.x, 0) / n, y = f.pts.reduce((s, p) => s + p.y, 0) / n, z = f.pts.reduce((s, p) => s + p.z, 0) / n;
    return { group: f.group, zone: f.zone, x, y, z, lumen: GROUPS[f.group].lumen * n, spread: 0 };
  });
  // სუსტ GPU-ზე (ფრაგმენტის uniform-ების მცირე ლიმიტი) ახლო წყაროები ერთიანდება (ნაკადი იგივეა)
  const gl = renderer.getContext();
  const budget = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 1024;
  const forced = +new URLSearchParams(location.search).get('lights') || 0; // ?lights=N — წყაროების ლიმიტი (ტესტი / სუსტი GPU)
  // სენსორულ (მობილურ) მოწყობილობაზე — მაქს. 24 წყარო (GPU-ს დატვირთვა): კორპუსები, პოზიციები და ნიშნულები უცვლელია,
  // ერთიანდება მხოლოდ ახლო წყაროების შუქი (ნაკადის ჯამი იგივეა). ?lights=50 — სრული რაოდენობა ნებისმიერ მოწყობილობაზე.
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
  const maxLights = forced || Math.min(touch ? 24 : Infinity, Math.max(8, Math.floor((budget - 260) / 7)));
  let simplified = false;
  if (sources.length > maxLights) {
    simplified = true;
    const out = [];
    // კლასტერი — მხოლოდ ერთი ჯგუფისა და ერთი ოთახის (ზონის) ფარგლებში: შუქი კედელს არ „გადაკვეთს“
    const bins = [...new Set(sources.map((s) => s.group + '|' + s.zone))];
    for (const bin of bins) {
      const k = bin.split('|')[0];
      const src = sources.filter((s) => s.group + '|' + s.zone === bin);
      const n = Math.max(1, Math.round(maxLights * src.length / sources.length));
      let cs = src.filter((_, i) => i % Math.ceil(src.length / n) === 0).slice(0, n).map((s) => ({ x: s.x, z: s.z }));
      let asg = [];
      for (let it = 0; it < 10; it++) {
        asg = src.map((s) => { let bi = 0, bd = Infinity; cs.forEach((c, i) => { const d = (c.x - s.x) ** 2 + (c.z - s.z) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; });
        cs = cs.map((c, i) => { const m = src.filter((_, j) => asg[j] === i); return m.length ? { x: m.reduce((a, q) => a + q.x, 0) / m.length, z: m.reduce((a, q) => a + q.z, 0) / m.length } : c; });
      }
      cs.forEach((c, i) => { const m = src.filter((_, j) => asg[j] === i); if (!m.length) return; out.push({ group: k, x: c.x, y: m[0].y, z: c.z, lumen: m.reduce((a, q) => a + q.lumen, 0), spread: Math.max(...m.map((q) => Math.hypot(q.x - c.x, q.z - c.z))) }); });
    }
    sources = out;
  }
  const rig = new THREE.Group();
  rig.name = 'ceiling light sources (viewer only)';
  scene.add(rig);
  for (const s of sources) {
    const g = GROUPS[s.group];
    const half = (g.beam / 2) * DEG;
    const extra = s.spread ? Math.atan2(s.spread * M, s.y * M) : 0;
    const l = new THREE.SpotLight(color[s.group], 0, 9, Math.min(1.3, half * 1.35 + extra), 0.5, 2);
    l.position.set(s.x * M, s.y * M, s.z * M);
    l.target.position.set(s.x * M, 0, s.z * M);
    l.castShadow = false;
    l.userData = { group: s.group, lumen: s.lumen };
    rig.add(l, l.target);
  }

  // ---- გეგმის ნიშნულები (მხოლოდ Plan რეჟიმში; იმალება განათების ჯგუფთან ერთად)
  const marks = new THREE.Group();
  marks.name = 'lighting plan marks (viewer only)';
  helpers.add(marks);
  const markGroups = {};
  for (const k of KEYS) {
    const pts = [];
    for (const m of lighting.marks.filter((q) => q.group === k)) {
      const y = (CEILING + 40) * M, cx = m.x * M, cz = m.z * M;
      if (m.kind === 'single' || m.kind === 'spot') {
        const r = Math.max(m.w, m.l, 160) / 2 * M + 0.04, n = 24;
        for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; pts.push(cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r); }
      } else {
        const hw = m.w / 2 * M + 0.04, hl = m.l / 2 * M + 0.04;
        const c = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
        for (let i = 0; i < 4; i++) { const [a, b] = [c[i], c[(i + 1) % 4]]; pts.push(cx + a[0], y, cz + a[1], cx + b[0], y, cz + b[1]); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: GROUPS[k].color, depthTest: false, transparent: true, opacity: 0.95 }));
    line.renderOrder = 16;
    line.name = `plan marks ${k}`;
    line.userData.noPick = true;
    marks.add(line);
    markGroups[k] = line;
  }

  // ---- მდგომარეობის გამოყენება
  function apply() {
    const plan = getMode() === 'plan';
    for (const k of KEYS) {
      const s = state[k];
      lighting.sub[k].visible = s.visible;
      markGroups[k].visible = s.visible && plan;
      const lm = lensMaterials[k];
      lm.emissive.copy(color[k]);
      lm.emissiveIntensity = s.on ? 0.6 + 1.6 * Math.min(s.level, 2) : 0;
      lm.color.set(s.on ? '#f6f4ef' : '#9a9894');
    }
    for (const l of rig.children) {
      if (!l.isSpotLight) continue;
      const s = state[l.userData.group];
      l.power = s.on ? l.userData.lumen * SCALE * s.level : 0;
    }
    syncUi();
    onChange();
  }

  // ---- ინტერფეისი (გენერირდება GROUPS-იდან)
  const host = document.getElementById('lt-groups');
  host.innerHTML = KEYS.map((k) => `
    <div class="lrow" data-lg="${k}">
      <div class="lhead"><i class="sw" style="background:${GROUPS[k].color}"></i><span>${GROUPS[k].label}</span></div>
      <div class="lctl">
        <button type="button" class="mini" data-act="vis" aria-pressed="true" aria-label="${GROUPS[k].short} — ჩვენება / დამალვა" title="ჩვენება / დამალვა"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button type="button" class="mini" data-act="on" aria-pressed="true" aria-label="${GROUPS[k].short} — შუქის ჩართვა / გამორთვა" title="შუქი"><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg></button>
        <label class="lvl"><span class="sr">${GROUPS[k].short} — სიკაშკაშე</span><input type="range" min="0" max="200" step="5" value="100" aria-label="${GROUPS[k].short} — სიკაშკაშე (%)"><output>100%</output></label>
      </div>
    </div>`).join('');
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const k = b.closest('[data-lg]').dataset.lg;
    if (b.dataset.act === 'vis') state[k].visible = !state[k].visible; else state[k].on = !state[k].on;
    apply();
  });
  host.addEventListener('input', (e) => {
    if (e.target.type !== 'range') return;
    const k = e.target.closest('[data-lg]').dataset.lg;
    state[k].level = +e.target.value / 100;
    apply();
  });
  const pressed = (vals) => (vals.every(Boolean) ? 'true' : vals.some(Boolean) ? 'mixed' : 'false');
  const showBtn = document.getElementById('lt-show'), onBtn = document.getElementById('lt-on');
  // საერთო ჩამრთველი: თუ ყველა ჩართულია — ყველას გამორთავს, სხვა შემთხვევაში (მათ შორის შერეული) — ყველას ჩართავს
  showBtn.addEventListener('click', () => { const all = KEYS.every((k) => state[k].visible); KEYS.forEach((k) => { state[k].visible = !all; }); apply(); });
  onBtn.addEventListener('click', () => { const all = KEYS.every((k) => state[k].on); KEYS.forEach((k) => { state[k].on = !all; }); apply(); });
  function syncUi() {
    showBtn.setAttribute('aria-pressed', pressed(KEYS.map((k) => state[k].visible)));
    onBtn.setAttribute('aria-pressed', pressed(KEYS.map((k) => state[k].on)));
    for (const k of KEYS) {
      const row = host.querySelector(`[data-lg="${k}"]`);
      row.querySelector('[data-act="vis"]').setAttribute('aria-pressed', String(state[k].visible));
      row.querySelector('[data-act="on"]').setAttribute('aria-pressed', String(state[k].on));
      const r = row.querySelector('input'); if (+r.value !== Math.round(state[k].level * 100)) r.value = Math.round(state[k].level * 100);
      row.querySelector('output').textContent = `${Math.round(state[k].level * 100)}%`;
      row.classList.toggle('off', !state[k].on);
      row.classList.toggle('hidden-g', !state[k].visible);
    }
  }
  apply();
  return {
    state, rig, marks, apply, simplified, sources: sources.length,
    set(k, patch) { Object.assign(state[k], patch); apply(); },
    setAll(patch) { KEYS.forEach((k) => Object.assign(state[k], patch)); apply(); },
  };
}
