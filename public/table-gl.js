import * as THREE from "/vendor/three.module.js";

(() => {
const cv = document.getElementById("ropegl"), host = document.getElementById("canvas");
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch { return; }   // no WebGL: the flat rope stays
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(1280, 820, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); host.classList.remove("gl-on"); });

// Match the CSS 3D camera exactly: perspective 1500px from (640, 8% of 820), table tilted about its own origin.
const PERSP = 1500, OX = 640, OY = .08 * 820;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
camera.position.set(OX, -OY, PERSP);
function setProjection() {
  const n = 5, f = 5000, k = n / PERSP;
  camera.projectionMatrix.makePerspective((0 - OX) * k, (1280 - OX) * k, OY * k, (OY - 820) * k, n, f);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
setProjection();
const tilt = parseFloat(getComputedStyle(host).getPropertyValue("--tilt")) || 50;
const TBL = { left: 110, top: 100, w: 1060, h: 680 }, ORG = { x: TBL.w * .5, y: TBL.h * .6 };
const table = new THREE.Group();
table.position.set(TBL.left + ORG.x, -(TBL.top + ORG.y), 0);
table.rotation.x = -tilt * Math.PI / 180;
scene.add(table);
const L = (u, v, z = 0) => new THREE.Vector3(u - ORG.x, -(v - ORG.y), z);     // table pixel coords -> 3D

// warm, low lamp light + an invisible plane that only catches the rope's shadow
scene.add(new THREE.HemisphereLight(0xffe2c0, 0x1a0e06, .55));
const lamp = new THREE.DirectionalLight(0xffd2a0, 1.6);
lamp.position.set(-220, 260, 700); lamp.castShadow = true;
lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -.0005;
Object.assign(lamp.shadow.camera, { left: -620, right: 620, top: 420, bottom: -420, near: 50, far: 1600 });
table.add(lamp); table.add(lamp.target);
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(TBL.w, TBL.h), new THREE.ShadowMaterial({ opacity: .55 }));
catcher.position.copy(L(TBL.w / 2, TBL.h / 2, .5)); catcher.receiveShadow = true; table.add(catcher);

// rope centreline from the same rim path the game already uses
const rim = document.getElementById("rimPath"), rimLen = rim.getTotalLength();
const R = 6.4, pts = [];
for (let d = 0; d <= rimLen; d += 6) { const q = rim.getPointAtLength(d); pts.push(L(q.x, q.y, R)); }
const base = new THREE.CatmullRomCurve3(pts, false, "centripetal");
const ropeLen = base.getLength(), UP = new THREE.Vector3(0, 0, 1);
class Strand extends THREE.Curve {
  constructor(phase, off) { super(); this.phase = phase; this.off = off; }
  getPoint(t, target = new THREE.Vector3()) {
    const p = base.getPointAt(t), tan = base.getTangentAt(t), n = new THREE.Vector3().crossVectors(tan, UP).normalize();
    const d = t * ropeLen, a = d / 30 * Math.PI * 2 + this.phase;
    const wob = Math.sin(d * .035) * 1.2 + Math.sin(d * .011 + 1) * 2;
    return target.copy(p).addScaledVector(n, Math.cos(a) * this.off + wob).addScaledVector(UP, Math.sin(a) * this.off);
  }
}
const tex = (c, repeat, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, 1); t.anisotropy = 8; return t; };
const fibre = (() => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d");
  x.fillStyle = "#b8925a"; x.fillRect(0, 0, 256, 64);
  for (let k = 0; k < 700; k++) { const y = Math.random() * 64, x0 = Math.random() * 256, len = 20 + Math.random() * 70;
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + len, y + (Math.random() - .5) * 6);
    x.strokeStyle = Math.random() > .5 ? `rgba(240,214,160,${.15 + Math.random() * .4})` : `rgba(70,44,18,${.15 + Math.random() * .45})`; x.lineWidth = .6 + Math.random() * 1.4; x.stroke(); }
  return c;
})();
const ropeMat = new THREE.MeshStandardMaterial({ map: tex(fibre, ropeLen / 16), bumpMap: tex(fibre, ropeLen / 16, false), bumpScale: .8, roughness: .95, color: 0xe6cfa6 });
const SEG = Math.round(ropeLen * .9), RAD = 8;
const parts = [0, 1, 2].map((k) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new Strand(k * Math.PI * 2 / 3, R * .55), SEG, R * .68, RAD, false), ropeMat); m.castShadow = true; table.add(m); return m; });
parts.push(new THREE.Mesh(new THREE.TubeGeometry(new Strand(0, 0), SEG, R * .8, RAD, false), new THREE.MeshStandardMaterial({ color: 0x3a2610, roughness: 1 })));
table.add(parts[3]);

// both ends: twine binding and a frayed tuft of loose fibres
function ropeEnd(u, out) {
  const p = base.getPointAt(u), t = base.getTangentAt(u).multiplyScalar(out), side = new THREE.Vector3().crossVectors(t, UP).normalize();
  const twine = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: .85 }), g = new THREE.Group();
  const bands = [];
  for (let w = 0; w < 3; w++) { const band = new THREE.Mesh(new THREE.TorusGeometry(R + .8, 1.5, 8, 24), twine); band.position.copy(p).addScaledVector(t, -15 - w * 4); band.lookAt(band.position.clone().add(t)); band.castShadow = true; g.add(band); bands.push({ m: band, d: 15 + w * 4 }); }
  const N = 80, fg = new THREE.ConeGeometry(.65, 1, 4, 1); fg.translate(0, .5, 0);
  const tuft = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0xcfae78, roughness: .95 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let k = 0; k < N; k++) {
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * (R + 1);
    const o = p.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(UP, Math.sin(a) * r * .9).addScaledVector(t, -2);
    const dir = t.clone().addScaledVector(side, (Math.random() - .5) * 1.1).addScaledVector(UP, -Math.random() * .45 + Math.sin(a) * .25).normalize();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); sc.set(1, 12 + Math.random() * 26, 1); m.compose(o, q, sc); tuft.setMatrixAt(k, m);
    tuft.setColorAt(k, new THREE.Color().setHSL(.09 + Math.random() * .02, .45, .45 + Math.random() * .25));
  }
  tuft.castShadow = true; g.add(tuft); table.add(g); return { g, tuft, bands };
}
const startEnd = ropeEnd(0, -1), finishEnd = ropeEnd(1, 1);

// fire: additive particles rising off the table, smoke, and a flickering light on the rope
const sprite = (stops) => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const FN = 520, SN = 60;
const fGeo = new THREE.BufferGeometry(), fPos = new Float32Array(FN * 3), fCol = new Float32Array(FN * 3);
fGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3)); fGeo.setAttribute("color", new THREE.BufferAttribute(fCol, 3));
const fire = new THREE.Points(fGeo, new THREE.PointsMaterial({ size: 19, map: sprite([[0, "rgba(255,255,255,1)"], [.35, "rgba(255,255,255,.55)"], [1, "rgba(255,255,255,0)"]]), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
fire.frustumCulled = false; table.add(fire);
const sGeo = new THREE.BufferGeometry(), sPos = new Float32Array(SN * 3); sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
const smoke = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 44, map: sprite([[0, "rgba(150,140,130,.22)"], [1, "rgba(150,140,130,0)"]]), transparent: true, depthWrite: false, color: 0x8a8078 }));
smoke.frustumCulled = false; table.add(smoke);
const flameLight = new THREE.PointLight(0xff8a3a, 0, 260, 1.4); table.add(flameLight);
const fp = Array.from({ length: FN }, () => ({ life: 1, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
fPos.fill(1e6); for (let k = 0; k < FN; k++) fPos[k * 3 + 2] = 0;
const sp = Array.from({ length: SN }, () => ({ life: 1, max: 1, x: 0, y: 0, z: 0, vz: 0 }));
sPos.fill(1e6); for (let k = 0; k < SN; k++) sPos[k * 3 + 2] = 0;
function stepFire(dt, at, hurry, on) {
  let spawn = on ? (hurry ? 1300 : 950) * dt : 0;
  const t = performance.now() / 1000;
  fp.forEach((p, k) => {
    p.life += dt;
    if (p.life >= p.max && spawn > 0) {
      spawn--; p.life = 0; p.max = .22 + Math.random() * .38;
      const a = Math.random() * 6.283, r = Math.random() * 5.5;
      p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; p.z = 1;
      p.vx = (Math.random() - .5) * 12; p.vy = (Math.random() - .5) * 12; p.vz = (40 + Math.random() * 50) * (hurry ? 1.3 : 1);
    }
    const u = p.life / p.max;
    if (u >= 1) { fPos[k * 3] = 1e6; fPos[k * 3 + 1] = 1e6; fPos[k * 3 + 2] = 0; fCol[k * 3] = fCol[k * 3 + 1] = fCol[k * 3 + 2] = 0; return; }
    p.vx += -p.x * 4 * dt + Math.sin(t * 9 + k) * 6 * dt; p.vy += -p.y * 4 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    fPos[k * 3] = at.x + p.x; fPos[k * 3 + 1] = at.y + p.y; fPos[k * 3 + 2] = at.z + p.z;
    const fade = (1 - u) * (u < .1 ? u / .1 : 1);
    const c = u < .12 ? [1, .95, .8] : u < .35 ? [1, .72, .3] : u < .65 ? [1, .42, .1] : [.7, .14, .03];
    fCol[k * 3] = c[0] * fade; fCol[k * 3 + 1] = c[1] * fade; fCol[k * 3 + 2] = c[2] * fade;
  });
  fGeo.attributes.position.needsUpdate = fGeo.attributes.color.needsUpdate = true;
  let sSpawn = on ? 22 * dt : 0;
  sp.forEach((p, k) => {
    p.life += dt;
    if (p.life >= p.max && sSpawn > 0) { sSpawn--; p.life = 0; p.max = 1.6 + Math.random(); p.x = (Math.random() - .5) * 10; p.y = (Math.random() - .5) * 10; p.z = 35; p.vz = 30 + Math.random() * 20; }
    if (p.life >= p.max) { sPos[k * 3] = 1e6; sPos[k * 3 + 1] = 1e6; sPos[k * 3 + 2] = 0; return; }
    p.z += p.vz * dt; p.x += Math.sin(t + k) * 5 * dt;
    sPos[k * 3] = at.x + p.x; sPos[k * 3 + 1] = at.y + p.y; sPos[k * 3 + 2] = at.z + p.z;
  });
  sGeo.attributes.position.needsUpdate = true;
  flameLight.position.set(at.x, at.y, at.z + 22);
  flameLight.intensity = on ? 2.4 + Math.sin(t * 23) * .35 + Math.sin(t * 37) * .3 + Math.random() * .3 : 0;
}

let last = performance.now();
function frame(now) {
  try {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const f = window.__fuse || { on: false, p: 0, hurry: false };
    for (const m of parts) { m.visible = f.on; m.geometry.setDrawRange(Math.floor(Math.max(0, f.p || 0) * SEG) * RAD * 6, Infinity); }
    const burnedPx = Math.max(0, f.p || 0) * ropeLen;
    startEnd.g.visible = f.on; finishEnd.g.visible = f.on && f.p < .999;
    startEnd.tuft.visible = burnedPx < 2;
    for (const b of startEnd.bands) b.m.visible = burnedPx < b.d - 1;
    const fp01 = Math.max(0, Math.min(.9999, f.p || 0));
    const at = base.getPointAt(fp01).setZ(R + 1);
    stepFire(dt, at, f.hurry, f.on && f.p < 1);
    renderer.render(scene, camera);
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
host.classList.add("gl-on");
requestAnimationFrame(frame);
})();

(() => {
const cv = document.getElementById("goldgl"), host = document.getElementById("canvas");
let r;
try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch { return; }   // no WebGL: the flat frames stay
r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(1280, 820, false); r.setClearColor(0, 0);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(0, 1280, 0, -820, -2000, 2000);           // screen pixels, y up

// warm studio around the gold, so it has something to reflect: a lamp overhead, ember glow below, dark room
const pm = new THREE.PMREMGenerator(r);
const room = new THREE.Scene();
room.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x120a05, side: THREE.BackSide })));
const panel = (col, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m); };
panel(0xfff0d0, -14, 30, 18, 26, 12); panel(0xffb060, 26, 8, 20, 10, 30); panel(0x5a2a10, 0, -30, 10, 60, 20); panel(0xffe0b0, 0, 10, -40, 30, 10);
scene.environment = pm.fromScene(room, .02).texture;
const key = new THREE.DirectionalLight(0xffe2b8, 1.4); key.position.set(-400, 600, 900); scene.add(key);
scene.add(new THREE.AmbientLight(0x2a1a0e, .6));

const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc46a, metalness: 1, roughness: .26, clearcoat: .4, clearcoatRoughness: .3, envMapIntensity: 1.2 });
const darkGold = new THREE.MeshPhysicalMaterial({ color: 0xc89040, metalness: 1, roughness: .42, envMapIntensity: .9 });
const thread = new THREE.MeshStandardMaterial({ color: 0xe8bd6a, metalness: .55, roughness: .55, envMapIntensity: .7 });
const UPV = new THREE.Vector3(0, 1, 0);
function rod(a, b, ra, rb, mat, seg = 32) {           // a cylinder between two points, tapering ra -> rb
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, len, seg, 1), mat);
  m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(UPV, d.normalize()); return m;
}
function knob(p, rad) {                               // ball end: sphere on a collar
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(rad, 40, 28), gold); g.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(rad * .62, rad * .16, 12, 32), darkGold); ring.rotation.y = Math.PI / 2; g.add(ring);
  g.position.copy(p); return g;
}
function finial(p, s) {                               // pole top: onion bulb with a spike, turned on a lathe
  const pts = [[0, 0], [4.2, .4], [4.8, 1.6], [3.2, 2.6], [5.6, 5.4], [7.4, 9.6], [6.4, 13.6], [3.6, 16.4], [1.6, 18.6], [1, 21], [.4, 25], [0, 27]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), gold); m.position.copy(p); return m;
}
function tassel(s) {                                  // cord, knot, bulb and a skirt of gold threads that swings
  const g = new THREE.Group();
  const cordLen = 108 * s;
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(.8 * s, -cordLen * .5, 1.5 * s), new THREE.Vector3(0, -cordLen, 0)]), 40, 1.1 * s, 8), thread);
  g.add(cord);
  const head = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [3.2, -.6], [4.4, -2.6], [3, -5], [2.2, -6.2], [3.6, -7.6], [4.2, -9.4], [0, -9.8]].map(([x, y]) => new THREE.Vector2(x * s, y * s)), 32), gold);
  head.position.y = -cordLen; g.add(head);
  const N = 46, strand = new THREE.CylinderGeometry(.42 * s, .3 * s, 20 * s, 5); strand.translate(0, -10 * s, 0);
  const skirt = new THREE.InstancedMesh(strand, thread, N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < N; k++) {
    const a = k / N * Math.PI * 2, rr = 3.4 * s;
    e.set(Math.sin(a) * .18, 0, -Math.cos(a) * .18); q.setFromEuler(e);
    m.compose(new THREE.Vector3(Math.cos(a) * rr, -cordLen - 9 * s, Math.sin(a) * rr), q, new THREE.Vector3(1, .85 + Math.random() * .3, 1)); skirt.setMatrixAt(k, m);
  }
  g.add(skirt);
  return g;
}

const flags = [];
function build() {
  for (const f of flags) scene.remove(f.group); flags.length = 0;
  const cr = host.getBoundingClientRect(), sc = cr.width / 1280;
  for (const id of ["flagE", "flagA"]) {
    const el = document.getElementById(id), A = {};
    el.querySelectorAll(".anc").forEach((n) => { const b = n.getBoundingClientRect(); A[n.dataset.a] = new THREE.Vector3((b.x - cr.x) / sc, -(b.y - cr.y) / sc, 0); });
    const sL = A.barL.distanceTo(A.barL2) / 12, sR = A.barR.distanceTo(A.barR2) / 12, sM = (sL + sR) / 2;  // local size at each end (perspective)
    if (!(sL > .05 && sR > .05)) throw new Error("flag not laid out yet");
    const g = new THREE.Group();
    // crossbar with ball ends, and the rings holding the cloth
    g.add(rod(A.barL, A.barR, 6 * sL, 6 * sR, gold, 40));
    g.add(knob(A.barL, 10 * sL), knob(A.barR, 10 * sR));
    const axis = new THREE.Vector3().subVectors(A.barR, A.barL).normalize();
    for (const k of [1, 2, 3, 4, 5]) {
      const p = A["ring" + k], s = sL + (sR - sL) * ((p.x - A.barL.x) / (A.barR.x - A.barL.x || 1));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7.6 * s, 1.6 * s, 14, 36), darkGold);
      ring.position.copy(p).add(new THREE.Vector3(0, -3.6 * s, 4 * s)); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis); g.add(ring);
    }
    // the pole: above the bar to the finial, and below the banner's point
    g.add(rod(A.poleTop, A.rodMid, 5.4 * sM, 5.6 * sM, gold));
    g.add(finial(A.poleTop.clone().add(new THREE.Vector3(0, 0, -2)), sM * .95));
    g.add(rod(A.tip.clone().add(new THREE.Vector3(0, 8 * sM, -6)), A.poleBot, 5.8 * sM, 6.4 * sM, gold));
    const collar = rod(A.tip.clone().add(new THREE.Vector3(0, -4 * sM, -6)), A.tip.clone().add(new THREE.Vector3(0, -12 * sM, -6)), 8 * sM, 8 * sM, darkGold); g.add(collar);
    // tassels hanging from both ends of the bar
    const tl = tassel(sL), tr = tassel(sR);
    tl.position.copy(A.barL).add(new THREE.Vector3(0, -8 * sL, 6)); tr.position.copy(A.barR).add(new THREE.Vector3(0, -8 * sR, 6));
    g.add(tl, tr);
    scene.add(g);
    flags.push({ group: g, tl, tr, phase: id === "flagE" ? 0 : 1.7 });
  }
}
let built = false;
function frame(now) {
  try {
    if (!built) {
      const hr = host.getBoundingClientRect(), fr = document.getElementById("flagE").getBoundingClientRect();
      if (hr.width > 50 && fr.width > 10 && !document.getElementById("game").hidden) {   // only measure once the table is on screen
        build(); built = true; host.classList.add("gold-on");
      }
    }
    const t = now / 1000;
    for (const f of flags) {
      f.tl.rotation.z = Math.sin(t * 1.25 + f.phase) * .05; f.tl.rotation.x = Math.sin(t * .9 + f.phase) * .04;
      f.tr.rotation.z = Math.sin(t * 1.25 + f.phase + 2.3) * .05; f.tr.rotation.x = Math.sin(t * .9 + f.phase + 1) * .04;
    }
    r.render(scene, cam);
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { built = false; }, 150); });
window.__goldRebuild = () => { built = false; };
document.fonts && document.fonts.ready.then(() => { built = false; });
requestAnimationFrame(frame);
})();