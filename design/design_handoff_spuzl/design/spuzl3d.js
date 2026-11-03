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

/* ---------- Chess pieces (Staunton, lathe-turned, tournament style) ----------
 * Every piece shares one camera and one framing, so sizes stay true to each other and each sprite drops straight
 * into its square: the base centre sits at 50% across and FOOT of the way down, the king's cross just clears the top.
 * Chunky proportions, glossy lacquer and a soft contact shadow straight below, in the spirit of the big online
 * boards' 3D sets. Both knights face left. */
const SQUAT = 1.3; // widen every piece so it reads at 40 px
/** Small pieces grow a touch so a pawn still reads at a glance (the big online sets do the same). */
const GROW = { P: 1.14, N: 1.04, B: 1.04, R: 1.02 };
const base = (br) => [[0, 0], [br, 0], [br, .03], [br + .015, .05], [br + .01, .075], [br - .025, .095], [br - .03, .12], [br - .055, .135], [br - .1, .17]];
const arc = (cy, r, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [Math.max(0, r * Math.cos(a)), cy + r * Math.sin(a)]; });
const PROFILES = {
  P: [...base(.36), [.22, .2], [.16, .3], [.13, .42], [.125, .47], [.21, .5], [.22, .525], [.2, .55], [.12, .565], ...arc(.7, .155, -1.1, Math.PI / 2)],
  R: [...base(.41), [.28, .21], [.245, .32], [.225, .52], [.235, .6], [.3, .63], [.31, .665], [.27, .69], [.275, .72], [.3, .76], [.305, .86], [.29, .87], [.2, .865], [.19, .82], [0, .81]],
  N: [...base(.41), [.29, .2], [.3, .245], [.27, .27], [0, .275]],
  B: [...base(.39), [.24, .2], [.17, .32], [.13, .5], [.12, .62], [.22, .655], [.23, .68], [.21, .705], [.12, .72], [.15, .77], [.185, .84], [.19, .9], [.17, .97], [.12, 1.03], [.06, 1.07], [.035, 1.085], ...arc(1.13, .055, -1.2, Math.PI / 2, 8)],
  Q: [...base(.43), [.26, .2], [.18, .34], [.14, .55], [.13, .74], [.24, .775], [.25, .805], [.22, .83], [.14, .845], [.16, .92], [.21, 1.02], [.26, 1.1], [.265, 1.12], [.24, 1.135], [.17, 1.105], [.13, 1.115], [.11, 1.16], [.06, 1.19], [0, 1.2]],
  K: [...base(.44), [.27, .2], [.19, .34], [.15, .55], [.14, .79], [.26, .825], [.27, .855], [.24, .88], [.15, .895], [.17, .96], [.23, 1.08], [.245, 1.11], [.22, 1.14], [.14, 1.16], [.11, 1.2], [0, 1.21]]
};
function buildPiece(L, type, mats, white) {
  const { THREE, RoundedBoxGeometry } = L;
  const mat = mats.body;
  const g = new THREE.Group();
  const sm = new THREE.SplineCurve(PROFILES[type].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(type === 'N' ? 48 : 200);
  sm.forEach(p => { p.x = Math.max(0, p.x); });
  sm[0].x = 0; sm[sm.length - 1].x = 0;
  const lathe = new THREE.LatheGeometry(sm, 128);
  if (type === 'Q') {
    // Coronet points around the crown rim.
    const pa = lathe.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), r = Math.hypot(x, z);
      if (y > 1.0 && r > .16) { const w = Math.min(1, (y - 1.0) / .1); pa.setY(i, y + .06 * w * Math.max(0, Math.cos(9 * Math.atan2(z, x)))); }
    }
    lathe.computeVertexNormals();
  }
  g.add(new THREE.Mesh(lathe, mat));
  // A felt pad under every piece.
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(PROFILES[type][1][0] - .01, PROFILES[type][1][0] - .01, .012, 64), mats.felt);
  felt.position.y = .004; g.add(felt);
  if (type === 'R') for (let i = 0; i < 6; i++) {
    const a0 = i * Math.PI * 2 / 6 + .2, a1 = a0 + Math.PI * 2 / 6 * .64;
    const sh = new THREE.Shape(); sh.absarc(0, 0, .305, a0, a1, false); sh.absarc(0, 0, .2, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .1, bevelEnabled: true, bevelThickness: .014, bevelSize: .012, bevelSegments: 4, curveSegments: 20 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.y = .855; g.add(m);
  }
  if (type === 'B') {
    // Mitre slit, cut on the diagonal.
    const slit = new THREE.Mesh(new THREE.BoxGeometry(.022, .16, .42), mats.groove);
    slit.position.set(.04, .93, 0); slit.rotation.z = -.55; slit.rotation.y = -.5; g.add(slit);
  }
  if (type === 'Q') {
    const top = new THREE.Mesh(new THREE.SphereGeometry(.07, 32, 20), mat); top.position.y = 1.25; g.add(top);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .06, 24), mat); neck.position.y = 1.2; g.add(neck);
  }
  if (type === 'K') {
    const v = new THREE.Mesh(new RoundedBoxGeometry(.085, .3, .085, 3, .02), mat); v.position.y = 1.35; g.add(v);
    const h = new THREE.Mesh(new RoundedBoxGeometry(.23, .085, .085, 3, .02), mat); h.position.y = 1.39; g.add(h);
  }
  if (type === 'N') {
    // Horse head in profile (muzzle on +x), extruded thick with a deep bevel, mane along the back, two ears.
    const s = new THREE.Shape();
    const P = [[-.26, .27], [-.285, .45], [-.255, .62], [-.195, .78], [-.125, .92], [-.075, 1.05], [-.03, 1.17], [.025, 1.08], [.075, 1.02], [.16, .95],
      [.25, .865], [.33, .775], [.4, .69], [.415, .635], [.385, .585], [.3, .572], [.235, .6], [.17, .6], [.115, .56], [.1, .48], [.14, .4], [.21, .33], [.25, .29], [.22, .27]];
    s.moveTo(P[0][0], P[0][1]);
    s.splineThru(P.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
    s.lineTo(P[0][0], P[0][1]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: .17, bevelEnabled: true, bevelThickness: .06, bevelSize: .04, bevelSegments: 8, curveSegments: 64 });
    geo.translate(0, 0, -.085);
    const head = new THREE.Group();
    head.add(new THREE.Mesh(geo, mat));
    const mane = new THREE.Mesh(new THREE.CapsuleGeometry(.05, .5, 6, 16), mat);
    mane.position.set(-.21, .72, 0); mane.rotation.z = -.4; mane.scale.set(1, 1, 1.9); head.add(mane);
    const eye = new THREE.MeshPhysicalMaterial({ color: white ? 0x2a1d14 : 0x050507, roughness: .15, clearcoat: 1 });
    [.17, -.17].forEach(z => { const e = new THREE.Mesh(new THREE.SphereGeometry(.03, 16, 12), eye); e.position.set(.16, .87, z * .95); head.add(e); });
    [.16, -.16].forEach(z => { const n = new THREE.Mesh(new THREE.SphereGeometry(.022, 12, 8), mats.groove); n.position.set(.39, .655, z * .6); head.add(n); });
    // Muzzle on the left of the picture, turned a little toward the viewer.
    head.rotation.y = Math.PI - .45;
    g.add(head);
  }
  const k = GROW[type] || 1;
  g.scale.set(SQUAT * k, k, SQUAT * k);
  return g;
}
/** Where the base centre lands in every sprite (fraction of the height from the top). */
export const PIECE_FOOT = .8;
function contactShadow(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.45, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function pieces(size = 256) {
  const key = 'pieces-v4:' + size; const hit = cacheGet(key);
  if (hit) return Promise.resolve(blobMap(JSON.parse(hit)));
  return enqueue(async () => {
    const C = await ctx(); const { THREE, renderer } = C;
    renderer.setSize(size, size, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const W = {
      body: new THREE.MeshPhysicalMaterial({ color: 0xE2CFAE, roughness: .4, envMapIntensity: .75, clearcoat: .8, clearcoatRoughness: .18 }),
      groove: new THREE.MeshStandardMaterial({ color: 0x8C7F6E, roughness: .6 }),
      felt: new THREE.MeshStandardMaterial({ color: 0x2E5A3A, roughness: 1 }),
    };
    const B = {
      body: new THREE.MeshPhysicalMaterial({ color: 0x1B171F, roughness: .34, envMapIntensity: .65, clearcoat: 1, clearcoatRoughness: .1 }),
      groove: new THREE.MeshStandardMaterial({ color: 0x050407, roughness: .7 }),
      felt: new THREE.MeshStandardMaterial({ color: 0x2E5A3A, roughness: 1 }),
    };
    const shadowTex = contactShadow(THREE);
    // One camera for every piece: about 24 degrees above the board, looking at the middle of a king.
    const cam = new THREE.PerspectiveCamera(20.5, 1, .1, 50);
    const el = 26 * Math.PI / 180, dist = 5.2;
    cam.position.set(0, .7 + dist * Math.sin(el), dist * Math.cos(el)); cam.lookAt(0, .7, 0);
    // Shift the view so the base centre lands at PIECE_FOOT of the height.
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(0, 0, 0).project(cam);
    cam.setViewOffset(size, size, 0, ((1 - v.y) / 2 - PIECE_FOOT) * size, size, size); cam.updateProjectionMatrix();
    const out = {};
    for (const side of ['w', 'b']) for (const t of ['K', 'Q', 'R', 'B', 'N', 'P']) {
      const scene = new THREE.Scene(); scene.environment = C.env;
      const sun = new THREE.DirectionalLight(0xfff6ea, 2.4); sun.position.set(-1.4, 6, 2.4); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 8; sun.shadow.bias = -.0015; sun.shadow.normalBias = .01;
      Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1.6, bottom: -.2, near: .5, far: 12 }); sun.shadow.camera.updateProjectionMatrix();
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xdfe6ff, .55); fill.position.set(3, 2, 2.5); scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, side === 'b' ? 1.8 : 1.0); rim.position.set(1.5, 3, -3.5); scene.add(rim);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5066, side === 'b' ? .6 : .25));
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: .16 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const r = PROFILES[t][1][0] * SQUAT * (GROW[t] || 1) * 1.45;
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.y = .001; scene.add(blob);
      const pc = buildPiece(C, t, side === 'w' ? W : B, side === 'w');
      pc.traverse(o => { if (o.isMesh) o.castShadow = true; });
      pc.rotation.y = t === 'N' ? 0 : .35;
      scene.add(pc);
      renderer.setClearColor(0x000000, 0); renderer.render(scene, cam);
      out[side + t] = snap(C, size, false);
    }
    cam.clearViewOffset();
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
