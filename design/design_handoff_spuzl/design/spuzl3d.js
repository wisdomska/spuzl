// SPUZL 3D asset renderer: realistic Staunton chess pieces + extruded 3D game icons.
// Renders with three.js into an offscreen canvas and returns PNG data URLs (cached).
const T = 'https://esm.sh/three@0.160.0';
let libP, ctxP, queue = Promise.resolve();
const mem = new Map();
const blobMemo = new Map();
function asBlob(d) {
  if (!d || !d.startsWith('data:')) return d;
  if (blobMemo.has(d)) return blobMemo.get(d);
  const bin = atob(d.split(',')[1]); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u8], { type: 'image/png' })); blobMemo.set(d, url); return url;
}
const blobMap = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, asBlob(v)]));

function lib() {
  return libP ||= Promise.all([
    import(T),
    import(T + '/examples/jsm/loaders/SVGLoader.js'),
    import(T + '/examples/jsm/environments/RoomEnvironment.js'),
    import(T + '/examples/jsm/geometries/RoundedBoxGeometry.js')
  ]).then(([THREE, a, b, c]) => ({ THREE, SVGLoader: a.SVGLoader, RoomEnvironment: b.RoomEnvironment, RoundedBoxGeometry: c.RoundedBoxGeometry }));
}
function ctx() {
  return ctxP ||= lib().then(L => {
    const { THREE } = L;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new L.RoomEnvironment(renderer), 0.04).texture;
    return { ...L, renderer, canvas, env };
  });
}
function enqueue(fn) { const p = queue.then(fn); queue = p.catch(() => {}); return p; }
function cacheGet(k) { if (mem.has(k)) return mem.get(k); try { const v = sessionStorage.getItem('spz3d:' + k); if (v) { mem.set(k, v); return v; } } catch (e) {} return null; }
function cacheSet(k, v) { mem.set(k, v); try { sessionStorage.setItem('spz3d:' + k, v); } catch (e) {} }

function lights(THREE, scene, env) {
  scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(-2.5, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffeefc, 0.9); rim.position.set(2.5, 2.5, -3); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
}
function snap(C, size, alignBottom) {
  const { renderer, canvas } = C;
  const out = document.createElement('canvas'); out.width = out.height = size;
  const g = out.getContext('2d');
  if (!alignBottom) { g.drawImage(canvas, 0, 0); return out.toDataURL('image/png'); }
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = size;
  const tg = tmp.getContext('2d'); tg.drawImage(canvas, 0, 0);
  const d = tg.getImageData(0, 0, size, size).data;
  let bottom = size - 1;
  outer: for (let y = size - 1; y >= 0; y--) for (let x = 0; x < size; x++) if (d[(y * size + x) * 4 + 3] > 10) { bottom = y; break outer; }
  g.drawImage(tmp, 0, size - 2 - bottom);
  return out.toDataURL('image/png');
}

/* ---------- Chess pieces (Staunton, lathe-turned) ---------- */
const base = (br) => [[0, 0], [br, 0], [br, .035], [br + .012, .06], [br - .02, .09], [br - .02, .12], [br - .09, .16]];
const arc = (cy, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [Math.max(0, r * Math.cos(a)), cy + r * Math.sin(a)]; });
const PROFILES = {
  P: [...base(.38), [.19, .22], [.14, .34], [.12, .48], [.20, .52], [.21, .555], [.12, .58], ...arc(.72, .165, -1.15, Math.PI / 2)],
  R: [...base(.42), [.27, .22], [.23, .36], [.22, .62], [.30, .66], [.30, .70], [.27, .72], [.29, .78], [.295, .84], [.27, .855], [.2, .85], [.19, .80], [0, .79]],
  N: [...base(.42), [.26, .22], [.28, .26], [0, .27]],
  B: [...base(.40), [.20, .22], [.14, .40], [.12, .60], [.21, .64], [.21, .68], [.11, .71], [.15, .76], [.18, .84], [.18, .92], [.15, 1.0], [.10, 1.06], [.05, 1.10], [.03, 1.11], ...arc(1.15, .05, -1.17, Math.PI / 2, 6)],
  Q: [...base(.44), [.22, .22], [.15, .46], [.13, .74], [.23, .78], [.23, .82], [.14, .86], [.16, .95], [.21, 1.05], [.255, 1.13], [.235, 1.145], [.17, 1.10], [.13, 1.11], [.11, 1.16], [.06, 1.20], [0, 1.21]],
  K: [...base(.45), [.23, .22], [.16, .48], [.14, .80], [.25, .84], [.25, .88], [.15, .92], [.18, 1.0], [.24, 1.12], [.22, 1.16], [.13, 1.19], [.10, 1.22], [0, 1.23]]
};
function buildPiece(L, type, mat, white) {
  const { THREE } = L;
  const g = new THREE.Group();
  const sm = new THREE.SplineCurve(PROFILES[type].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(type === 'N' ? 40 : 160);
  sm.forEach(p => { p.x = Math.max(0, p.x); });
  sm[0].x = 0; sm[sm.length - 1].x = 0;
  const lathe = new THREE.LatheGeometry(sm, 96);
  if (type === 'Q') {
    const pa = lathe.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), r = Math.hypot(x, z);
      if (y > 1.02 && r > .15) { const w = Math.min(1, (y - 1.02) / .1); pa.setY(i, y + .05 * w * Math.cos(8 * Math.atan2(z, x))); }
    }
    lathe.computeVertexNormals();
  }
  const body = new THREE.Mesh(lathe, mat); body.castShadow = true;
  g.add(body);
  if (type === 'R') for (let i = 0; i < 5; i++) {
    const a0 = i * Math.PI * 2 / 5, a1 = a0 + Math.PI * 2 / 5 * .62;
    const sh = new THREE.Shape(); sh.absarc(0, 0, .29, a0, a1, false); sh.absarc(0, 0, .19, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .11, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 16 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.y = .84; g.add(m);
  }
  if (type === 'Q') {
    const top = new THREE.Mesh(new THREE.SphereGeometry(.065, 24, 16), mat); top.position.y = 1.27; g.add(top);
  }
  if (type === 'K') {
    const v = new THREE.Mesh(new THREE.BoxGeometry(.07, .28, .07), mat); v.position.y = 1.36; g.add(v);
    const h = new THREE.Mesh(new THREE.BoxGeometry(.21, .07, .07), mat); h.position.y = 1.40; g.add(h);
  }
  if (type === 'N') {
    const s = new THREE.Shape();
    s.moveTo(-.22, .26);
    s.splineThru([[-.25, .45], [-.22, .66], [-.14, .86], [-.06, .98], [-.01, 1.07], [.03, 1.11], [.06, 1.02], [.14, .96], [.24, .85], [.33, .72], [.36, .64], [.33, .58], [.24, .57], [.14, .60], [.08, .54], [.12, .42], [.22, .30], [.20, .26]].map(([x, y]) => new THREE.Vector2(x, y)));
    s.lineTo(-.22, .26);
    const geo = new THREE.ExtrudeGeometry(s, { depth: .2, bevelEnabled: true, bevelThickness: .045, bevelSize: .035, bevelSegments: 5, curveSegments: 32 });
    geo.translate(0, 0, -.1);
    const head = new THREE.Mesh(geo, mat);
    const eyeMat = new THREE.MeshStandardMaterial({ color: white ? 0x3a2d22 : 0x0a090d, roughness: .3 });
    [.15, -.15].forEach(z => { const e = new THREE.Mesh(new THREE.SphereGeometry(.028, 12, 8), eyeMat); e.position.set(.17, .84, z); head.add(e); });
    head.rotation.y = white ? -2.6 : -0.52;
    g.add(head);
  }
  return g;
}
export function pieces(size = 256) {
  const key = 'pieces-v3:' + size; const hit = cacheGet(key);
  if (hit) return Promise.resolve(blobMap(JSON.parse(hit)));
  return enqueue(async () => {
    const C = await ctx(); const { THREE, renderer } = C;
    renderer.setSize(size, size, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const matW = new THREE.MeshPhysicalMaterial({ color: 0xF1EEE8, roughness: .58, envMapIntensity: .7, sheen: .3, sheenRoughness: .8, sheenColor: 0xffffff });
    const matB = new THREE.MeshPhysicalMaterial({ color: 0x2B2931, roughness: .48, envMapIntensity: .8, clearcoat: .25, clearcoatRoughness: .4 });
    const cam = new THREE.PerspectiveCamera(25, 1, .1, 50); cam.position.set(0, 2.55, 4.3); cam.lookAt(0, .6, 0);
    const out = {};
    for (const side of ['w', 'b']) for (const t of ['K', 'Q', 'R', 'B', 'N', 'P']) {
      const scene = new THREE.Scene(); lights(THREE, scene, C.env);
      const sun = new THREE.DirectionalLight(0xffffff, .9); sun.position.set(-1.5, 4, 2); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 6; sun.shadow.bias = -.002;
      Object.assign(sun.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: .5, far: 10 }); sun.shadow.camera.updateProjectionMatrix(); scene.add(sun);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8494, .55));
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: .28 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const pc = buildPiece(C, t, side === 'w' ? matW : matB, side === 'w'); pc.traverse(o => { if (o.isMesh) o.castShadow = true; }); pc.rotation.y = t === 'N' ? 0 : .3;
      scene.add(pc);
      renderer.setClearColor(0x000000, 0); renderer.render(scene, cam);
      out[side + t] = snap(C, size, true);
    }
    cacheSet(key, JSON.stringify(out));
    return blobMap(out);
  });
}

/* ---------- 3D game icons: Phosphor glyph extruded on a glossy toy tile ---------- */
const svgCache = new Map();
function fetchSvg(name) {
  const n = name.replace(/^ph-/, '');
  if (!svgCache.has(n)) svgCache.set(n, fetch(`https://unpkg.com/@phosphor-icons/core@2.1.1/assets/bold/${n}-bold.svg`).then(r => { if (!r.ok) throw new Error('svg ' + n); return r.text(); }));
  return svgCache.get(n);
}
export function icon(name, color = '#B8F23A', size = 192) {
  const key = `icon:${name}:${color}:${size}`; const hit = cacheGet(key);
  if (hit) return Promise.resolve(asBlob(hit));
  return fetchSvg(name).then(svg => enqueue(async () => {
    const C = await ctx(); const { THREE, renderer, SVGLoader, RoundedBoxGeometry } = C;
    renderer.setSize(size, size, false);
    const scene = new THREE.Scene(); lights(THREE, scene, C.env);
    const tileCol = new THREE.Color(color);
    const lum = tileCol.r * .2126 + tileCol.g * .7152 + tileCol.b * .0722;
    const group = new THREE.Group();
    const tile = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.5, .42, 6, .34), new THREE.MeshPhysicalMaterial({ color: tileCol, roughness: .38, clearcoat: .7, clearcoatRoughness: .25 }));
    group.add(tile);
    const data = new SVGLoader().parse(svg);
    const shapes = data.paths.flatMap(p => SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 26, bevelEnabled: true, bevelThickness: 7, bevelSize: 5, bevelSegments: 4, curveSegments: 12 });
    geo.center();
    const glyph = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: lum < .05 ? 0xC9CCDD : 0x15162A, roughness: .3, clearcoat: 1, clearcoatRoughness: .12 }));
    const s = .0042; glyph.scale.set(s, -s, s); glyph.position.z = .21 + .07;
    group.add(glyph);
    group.rotation.set(-.32, .4, 0);
    scene.add(group);
    const cam = new THREE.PerspectiveCamera(30, 1, .1, 50); cam.position.set(0, 0, 4.0); cam.lookAt(0, 0, 0);
    renderer.setClearColor(0x000000, 0); renderer.render(scene, cam);
    const url = snap(C, size, false);
    geo.dispose();
    cacheSet(key, url);
    return asBlob(url);
  }));
}
