// Public Space Analysis · BLOK M (v4): analisis ruang publik dengan kerangka Place Diagram PPS
// Vendor open source: three.js (MIT), camera-controls (MIT), Apache ECharts (Apache-2.0), anime.js (MIT)
import * as THREE from 'three';
import CameraControls from './vendor/camera-controls.module.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import anime from './vendor/anime.es.js';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart, SunburstChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, MarkLineComponent, LegendComponent, PolarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([BarChart, LineChart, PieChart, ScatterChart, SunburstChart, PolarComponent, GridComponent, TooltipComponent, MarkLineComponent, LegendComponent, CanvasRenderer]);
CameraControls.install({ THREE });

const D = window.D3, V = window.DV2, A = window.ASET, O = window.DOSM, OS = O.stat, V4 = window.DV4;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const nf = (v, d = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const dec = (b64) => { const s = atob(b64); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
const dec8 = (b64) => new Int8Array(dec(b64).buffer);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqHP = matchMedia('(max-width: 767px), (max-height: 500px) and (max-width: 1000px)');
const mqTab = matchMedia('(min-width: 768px) and (max-width: 1199px) and (min-height: 501px)');
const LITE = /lite/.test(location.search) || mqHP.matches || (navigator.hardwareConcurrency || 8) <= 4;
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const muatSkrip = (src) => new Promise((ok, gagal) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = gagal; document.head.appendChild(el); });
const fmtJam = (h) => { h = ((h % 24) + 24) % 24; return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0'); };

const S = { rasioMRT: 3, kualitas: 'otomatis', lapis: 'ringkasan', jam: 16.5, doy: 80, arah: 'B', uref: 2.6, main: false, kecepatan: 1, fokus: true, varMode: 'lu', pohonSkenario: false, klbPakai: 0, tema: document.documentElement.dataset.tema || 'gelap', orang: true, kendaraan: true, mrt: true, label: true };
const EXT = D.meta.extent, EW = EXT[2] - EXT[0], EH = EXT[3] - EXT[1], CX = (EXT[0] + EXT[2]) / 2, CZ = (EXT[1] + EXT[3]) / 2;
const MPP = D.meta.mpp, ORI = D.meta.origin;
const tm = (x, y) => [(x - ORI[0]) * MPP, (y - ORI[1]) * MPP];

// =============================================================
//  Grid analisis (350 x 179 sel, 5,76 m)
// =============================================================
const GW = D.gmeta.gw, GH = D.gmeta.gh, CELL_M = 4 * MPP;
const GR = {}; for (const k in D.grid) GR[k] = dec(D.grid[k]);
for (const k in V.grid) GR[k] = dec(V.grid[k]);
GR.bising = dec(V4.bising_grid);   // v4: kebisingan dari jalan OSM + terminal + busway
const dv = (b, lo, hi) => (b ? lo + (b - 1) / 254 * (hi - lo) : NaN);
const val = {
  akses: (i) => GR.akses[i] / 255 * 15, iso: (i) => GR.iso[i] / 255 * 1600, walk: (i) => GR.walk[i] / 255 * 100,
  mix: (i) => GR.mix[i] / 255, panas: (i) => GR.panas[i] / 255, lu: (i) => GR.lu[i],
  bising: (i) => dv(GR.bising[i], 40, 85), svf: (i) => dv(GR.svf[i], 0, 1), fas: (i) => GR.fas[i], rth: (i) => dv(GR.rth[i], 0, 1000), dalam: (i) => GR.dalam[i],
};
const cellOf = (x, z) => { const i = Math.floor((x / MPP + ORI[0]) / 4), j = Math.floor((z / MPP + ORI[1]) / 4); return (i < 0 || j < 0 || i >= GW || j >= GH) ? -1 : j * GW + i; };
const cellXZ = (i) => [((i % GW) * 4 + 2 - ORI[0]) * MPP, (Math.floor(i / GW) * 4 + 2 - ORI[1]) * MPP];
const BND = V.batas; // poligon kawasan inti (meter)
const BC = [avg(BND.map((p) => p[0])), avg(BND.map((p) => p[1]))];
function dalamPoligon(x, z, P = BND) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; } return c; }
const ST = D.stat2d, VS = V.stat; Object.assign(VS, OS.ov); Object.assign(VS, V4.bising);   // akses dihitung ulang pada jaringan OSM

// =============================================================
//  Skor kelayakan (kawasan inti)
// =============================================================
const LIT = {
  tod: { jalurPed: [83, 13, 52], penyeberangan: [41, 8, 33], peneduh: [25, 13, 24], sepeda: [33, 15, 75], mukaBlok: [177, 223, 141], aspekCampuran: [57, 43, 71], aspekRamah: [37.5, 12.5, 25], aspekTransit: [100, 100, 100], jarakMRT: [443, 652, 948] },
};
const SK = {};
SK.akses = Math.round(avg([VS.akses5, VS.akses10, avg(LIT.tod.aspekTransit)]));
SK.walk = Math.round(avg([OS.pedshed800, VS.walk_rata, avg(LIT.tod.aspekRamah)]));   // pedshed dari graf jalan OSM
SK.variety = Math.round(avg([VS.mix_rata * 100, avg(LIT.tod.aspekCampuran)]));
SK.termal = Math.round(avg([100 - VS.panas_tinggi, avg(LIT.tod.peneduh) / 75 * 100]));
const W_AHP = { akses: .4932, walk: .32, termal: .106, variety: .0808 };
SK.total = Math.round(SK.akses * W_AHP.akses + SK.walk * W_AHP.walk + SK.termal * W_AHP.termal + SK.variety * W_AHP.variety);
SK.akustik = Math.round(100 - VS.fasad_lewat);
SK.fasilitas = Math.round(VS.fas_lengkap);
SK.rth = Math.round(VS.rth300);
SK.tumbuh = Math.round(100 * VS.blok_sisa / VS.blok_izin);
SK.tod = Math.round(100 * OS.itdp_s / OS.itdp_m);
SK.jaringan = Math.round(OS.pedshed400);
const kategori = (s) => s >= 75 ? ['Layak', '#1F7A4D'] : s >= 55 ? ['Layak bersyarat', '#B7791F'] : ['Perlu intervensi', '#A33A1A'];

// =============================================================
//  Renderer, kamera, kontrol, pascaproses
// =============================================================
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(LITE ? 1.5 : 2, devicePixelRatio));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene();
const TEMA3D = {
  gelap: { siang: '#17202B', malam: '#0A0E14', senja: '#2E2633', hemiG: '#1E2632', putih: '#DDE4EB', netral: '#9EA9B6', luar: [0.2, 0.24, 0.29], ring: '#E9EEF4', batas: '#3DD6C0', aksen: '#3DD6C0', jauh: '#141B24' },
  terang: { siang: '#EEF1F4', malam: '#1B2133', senja: '#F2D2B6', hemiG: '#D9D2C6', putih: '#F7F6F3', netral: '#E2DED8', luar: [0.925, 0.92, 0.91], ring: '#16202B', batas: '#0E9F8A', aksen: '#0E9F8A', jauh: '#E8EBEE' },
};
const LANGIT = { siang: new THREE.Color(), malam: new THREE.Color(), senja: new THREE.Color() };
function pasangLangit() { const t = TEMA3D.terang; LANGIT.siang.set(t.siang); LANGIT.malam.set(t.malam); LANGIT.senja.set(t.senja); }
pasangLangit();
scene.background = LANGIT.siang.clone(); scene.fog = new THREE.Fog(scene.background, 2000, 6000);
const camera = new THREE.PerspectiveCamera(16, 1, 5, 14000);
const cc = new CameraControls(camera, canvas);
cc.smoothTime = .55; cc.draggingSmoothTime = .12; cc.dollyToCursor = true; cc.maxPolarAngle = Math.PI * .47; cc.minDistance = 60; cc.maxDistance = 6500;
cc.setBoundary(new THREE.Box3(new THREE.Vector3(EXT[0], -10, EXT[1]), new THREE.Vector3(EXT[2], 400, EXT[3])));
let composer = null, bloom = null;
const KUAL = { orang: 1, kend: 1, label: 1 };
if (!LITE) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .2, .55, .82); composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) composer.setSize(w, h);
  charts.forEach((c) => c.resize());
}
addEventListener('resize', resize);

const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d2c6, .72); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 2048 : 4096, LITE ? 2048 : 4096); sun.shadow.bias = -0.0005; sun.shadow.normalBias = .6;
Object.assign(sun.shadow.camera, { left: -1150, right: 1150, top: 1150, bottom: -1150, near: 10, far: 5000 }); sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target); sun.target.position.set(CX, 0, CZ);

// =============================================================
//  Tanah, lapisan analisis, batas kawasan
// =============================================================
const TEX = {}; const loader = new THREE.TextureLoader();
const pasangTex = (k, src) => { TEX[k] = loader.load(src); TEX[k].colorSpace = THREE.SRGBColorSpace; TEX[k].anisotropy = 8; return TEX[k]; };
pasangTex('dasar', A.dasar);   // peta OSM & satelit dimuat saat dipilih
let petaDasar = 'dasar';
const texAktif = () => TEX[petaDasar] || TEX.dasar;
const groundMat = new THREE.MeshStandardMaterial({ map: texAktif(), roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(EW, EH), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(CX, 0, CZ); ground.receiveShadow = true; scene.add(ground);
const far = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshStandardMaterial({ color: TEMA3D.terang.jauh, roughness: 1 }));
far.rotation.x = -Math.PI / 2; far.position.set(CX, -.6, CZ); far.receiveShadow = true; scene.add(far);
const ov = document.createElement('canvas'); ov.width = GW; ov.height = GH; const octx = ov.getContext('2d'); const oimg = octx.createImageData(GW, GH);
const ovTex = new THREE.CanvasTexture(ov); ovTex.colorSpace = THREE.SRGBColorSpace;
const ovMat = new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, depthWrite: false, opacity: 0 });
const OVW = EW * (GW * 4 / 1400), OVH = EH * (GH * 4 / 717);
const ovMesh = new THREE.Mesh(new THREE.PlaneGeometry(OVW, OVH), ovMat); ovMesh.rotation.x = -Math.PI / 2; ovMesh.position.set(EXT[0] + OVW / 2, .25, EXT[1] + OVH / 2); ovMesh.renderOrder = 2; scene.add(ovMesh);
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(EW, EH), new THREE.ShadowMaterial({ opacity: .14 })); catcher.rotation.x = -Math.PI / 2; catcher.position.set(CX, .4, CZ); catcher.receiveShadow = true; catcher.renderOrder = 3; scene.add(catcher);
// pita batas kawasan dengan garis putus beranimasi
const U = { uGrow: { value: 0 }, uNight: { value: 0 }, uTime: { value: 0 }, uMix: { value: 1 }, uFocus: { value: 1 }, uLuar: { value: new THREE.Color().setRGB(...TEMA3D.terang.luar) } };
const batas = (() => {
  const path = new THREE.CurvePath(); const P = BND.map(([x, z]) => new THREE.Vector3(x, 1, z));
  for (let i = 0; i < P.length; i++) path.add(new THREE.LineCurve3(P[i], P[(i + 1) % P.length]));
  const g = new THREE.TubeGeometry(path, 600, 1.7, 6, true);
  const m = new THREE.MeshBasicMaterial({ color: TEMA3D.terang.batas, transparent: true, toneMapped: false });
  m.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vU;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvU = uv;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vU;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (fract(vU.x * 380.0 - uTime * 0.8) > 0.55) discard;'); };
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 4; scene.add(mesh); return mesh;
})();

// =============================================================
//  Bangunan
// =============================================================
const B = D.bld, PV = V.pv;
const LU_COL = { 3: '#C99A1E', 4: '#D9573A', 5: '#3E7FD0', 6: '#3F9A5E', 8: '#9A6BB8' };
const LU_NAMA = { 3: 'Hunian', 4: 'Komersial & jasa', 5: 'Pendidikan & publik', 6: 'Ruang hijau', 8: 'Fasilitas lain' };
const B_IN = new Uint8Array(B.length); V.dalam_bld.forEach((i) => B_IN[i] = 1);
let bGeo, bBid;
(function () {
  const pos = [], nor = [], bid = [], dist = [], top = [], inn = [];
  B.forEach((b, i) => {
    const s = new THREE.Shape();
    for (let k = 0; k < b.p.length; k += 2) { const x = b.p[k], y = -b.p[k + 1]; k ? s.lineTo(x, y) : s.moveTo(x, y); }
    const g = new THREE.ExtrudeGeometry(s, { depth: b.h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals();
    const P = ng.attributes.position.array, N = ng.attributes.normal.array; const d = Math.hypot(b.c[0] - BC[0], b.c[1] - BC[1]);
    for (let v = 0; v < P.length; v += 3) { pos.push(P[v], P[v + 1], P[v + 2]); nor.push(N[v], N[v + 1], N[v + 2]); bid.push(i); dist.push(d); top.push(b.h); inn.push(B_IN[i]); }
    g.dispose(); if (ng !== g) ng.dispose();
  });
  bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  bGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  bGeo.setAttribute('aPrev', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  bGeo.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  bGeo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  bGeo.setAttribute('aIn', new THREE.Float32BufferAttribute(inn, 1));
  bBid = new Int32Array(bid);
})();
const bMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82 });
bMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uGrow; uniform float uMix; uniform float uFocus; uniform vec3 uLuar; attribute float aDist; attribute float aTop; attribute float aIn; attribute vec3 aPrev; varying vec3 vWp; varying vec3 vN; varying float vTop;')
    .replace('#include <color_vertex>', `#include <color_vertex>
      vColor.rgb = mix(aPrev, color, uMix);
      vColor.rgb = mix(vColor.rgb, uLuar * (0.88 + 0.12 * step(0.5, normal.y)), (1.0 - aIn) * uFocus * 0.8);`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      float gr = clamp(uGrow * 2.3 - aDist / 800.0, 0.0, 1.0); gr = 1.0 - pow(1.0 - gr, 3.0); transformed.y *= max(gr, 0.002);`)
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vN = normal; vTop = aTop;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uNight; varying vec3 vWp; varying vec3 vN; varying float vTop;\nfloat h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (uNight > 0.01 && abs(vN.y) < 0.5) {
        float along = abs(vN.x) > 0.5 ? vWp.z : vWp.x;
        vec2 cell = vec2(floor(along / 3.2), floor(vWp.y / 3.6)); vec2 f = vec2(fract(along / 3.2), fract(vWp.y / 3.6));
        float win = step(0.25, f.x) * step(f.x, 0.75) * step(0.32, f.y) * step(f.y, 0.75);
        float lit = step(0.48, h21(cell + floor(vWp.xz / 40.0)));
        totalEmissiveRadiance += vec3(1.0, 0.7, 0.36) * win * lit * step(vWp.y, vTop - 1.0) * uNight * 1.1;
      }`);
};
const bMesh = new THREE.Mesh(bGeo, bMat); bMesh.castShadow = true; bMesh.receiveShadow = true; scene.add(bMesh);

const rampF = (stops) => { const SS = stops.map(([t, h]) => [t, hexRGB(h)]); return (t) => { t = clamp(t); for (let i = 1; i < SS.length; i++) if (t <= SS[i][0]) { const u = (t - SS[i - 1][0]) / (SS[i][0] - SS[i - 1][0]); return SS[i - 1][1].map((v, k) => lerp(v, SS[i][1][k], u)); } return SS[SS.length - 1][1]; }; };
const RAMP = {
  akses: [[0, '#1E4FB8'], [.33, '#5C8BE6'], [.66, '#BBD0F6'], [1, '#F4F1EC']],
  panas: [[0, '#2C9C9A'], [.3, '#BFE3D6'], [.5, '#F7EBC4'], [.72, '#F29A55'], [1, '#B8241C']],
  mix: [[0, '#F4F1EC'], [.4, '#D9CCF2'], [.7, '#A27FE0'], [1, '#5A2FA8']],
  angin: [[0, '#2E6BD9'], [.25, '#3FA8B8'], [.5, '#8CC56F'], [.75, '#F5BE4C'], [1, '#DB4B33']],
  bising: [[0, '#2E7D6B'], [.3, '#A7D49B'], [.55, '#F6E27A'], [.75, '#F29A55'], [1, '#9E1F1A']],
  svf: [[0, '#2B1A4A'], [.45, '#6E4FA0'], [.75, '#C8B6EA'], [1, '#F6F2EA']],
  fas: [[0, '#F4F1EC'], [.5, '#A9DCCB'], [.8, '#3FA092'], [1, '#0F5C52']],
  rth: [[0, '#1D7A47'], [.1, '#3F9A5E'], [.3, '#B9DDA9'], [.5, '#F4E3B8'], [1, '#E58F6B']],
  surya: [[0, '#E9E4DB'], [.4, '#F7D774'], [.75, '#F2A33A'], [1, '#D2561C']],
  sos: [[0, '#FBE9CF'], [.2, '#F6C177'], [.45, '#EE8A4A'], [.65, '#D5482E'], [.85, '#9E2149'], [1, '#5B1A5E']],
};
const F = {}; for (const k in RAMP) F[k] = rampF(RAMP[k]);
const grad = (st) => `linear-gradient(90deg,${st.map(([t, c]) => `${c} ${t * 100}%`).join(',')})`;
let warnaMode = '';
function warnaiBangunan(mode) {
  if (mode === warnaMode) return; warnaMode = mode;
  const C = bGeo.attributes.color.array, Pv = bGeo.attributes.aPrev.array, N = bGeo.attributes.normal.array;
  Pv.set(C); const T3 = TEMA3D.terang, c = new THREE.Color(), t = new THREE.Color('#F4F1EC'), ak = new THREE.Color(T3.aksen);
  let last = -1, r = 0, g = 0, b_ = 0;
  for (let v = 0, n = bBid.length; v < n; v++) {
    const i = bBid[v];
    if (i !== last) {
      last = i; const b = B[i];
      if (mode === 'fungsi') c.setRGB(...hexRGB(LU_COL[b.u] || '#bbbbbb')).lerp(t, .55);
      else if (mode === 'tinggi') { const k = clamp(Math.log(b.h / 3) / Math.log(60)); c.setRGB(lerp(.95, .76, k), lerp(.93, .27, k), lerp(.9, .12, k)); }
      else if (mode === 'putih') c.set(T3.putih);
      else c.set(T3.netral);
      if (b.n && (mode === 'fungsi' || mode === 'netral')) c.lerp(ak, .12);
      r = c.r; g = c.g; b_ = c.b;
    }
    const sh = N[v * 3 + 1] > .5 ? 1 : .9; C[v * 3] = r * sh; C[v * 3 + 1] = g * sh; C[v * 3 + 2] = b_ * sh;
  }
  bGeo.attributes.color.needsUpdate = true; bGeo.attributes.aPrev.needsUpdate = true;
  U.uMix.value = 0; anime({ targets: U.uMix, value: 1, duration: reduce ? 1 : 750, easing: 'easeInOutQuad' });
}
// sorotan
const selMat = new THREE.MeshBasicMaterial({ color: '#3DD6C0', transparent: true, opacity: .35 });
let selObj = null;
function sorot(i) {
  if (selObj) { scene.remove(selObj); selObj.traverse((o) => o.geometry && o.geometry.dispose()); selObj = null; }
  if (i == null) return;
  const b = B[i], s = new THREE.Shape(); for (let k = 0; k < b.p.length; k += 2) { const x = b.p[k], y = -b.p[k + 1]; k ? s.lineTo(x, y) : s.moveTo(x, y); }
  const g = new THREE.ExtrudeGeometry(s, { depth: b.h + .8, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
  selObj = new THREE.Group(); const m = new THREE.Mesh(g, selMat); const l = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: '#3DD6C0', toneMapped: false }));
  selObj.add(m, l); selObj.scale.y = .01; scene.add(selObj); anime({ targets: selObj.scale, y: 1, duration: 600, easing: 'easeOutElastic(1, .7)' });
}

// =============================================================
//  Pohon (vegetasi) + skenario pohon peneduh
// =============================================================
const T = D.trees;
const crownGeo = new THREE.IcosahedronGeometry(1, 1), trunkGeo = new THREE.CylinderGeometry(.18, .25, 1, 5);
const crownMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9, flatShading: true }), trunkMat = new THREE.MeshStandardMaterial({ color: '#8B7262', roughness: 1 });
function buatPohon(list, warna) {
  const cr = new THREE.InstancedMesh(crownGeo, crownMat, list.length), tr = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  list.forEach(([x, z, r], i) => { const h = r * 1.5; p.set(x, h, z); s.set(r, r * .85, r); m.compose(p, q, s); cr.setMatrixAt(i, m); c.setHSL(warna[0] + Math.random() * .05, warna[1], warna[2] + Math.random() * .1); cr.setColorAt(i, c); p.set(x, h * .45, z); s.set(1, h * .9, 1); m.compose(p, q, s); tr.setMatrixAt(i, m); });
  cr.castShadow = tr.castShadow = true; cr.receiveShadow = true; const g = new THREE.Group(); g.add(cr, tr); scene.add(g); return g;
}
const pohon = buatPohon(T, [.25, .32, .52]);

// =============================================================
//  MRT layang + kereta
// =============================================================
const mrtCurve = new THREE.CatmullRomCurve3([[549, -30], [548, 60], [546, 104], [541, 230], [532, 340], [523, 410], [515, 462], [508, 540], [501, 640], [496, 760]].map(([x, y]) => { const [a, b] = tm(x, y); return new THREE.Vector3(a, 11, b); }));
const MRT_L = mrtCurve.getLength();
(function () {
  const n = 160, deck = new THREE.InstancedMesh(new THREE.BoxGeometry(9.5, 1.8, 1), new THREE.MeshStandardMaterial({ color: '#D3CEC6', roughness: .8 }), n);
  const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.2, 1.4, 10, 8), new THREE.MeshStandardMaterial({ color: '#BDB7AE' }), Math.floor(MRT_L / 30));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) { const a = mrtCurve.getPointAt(i / n), b = mrtCurve.getPointAt((i + 1) / n); q.setFromAxisAngle(up, Math.atan2(b.x - a.x, b.z - a.z)); s.set(1, 1, a.distanceTo(b) + .6); m.compose(a.clone().add(b).multiplyScalar(.5), q, s); deck.setMatrixAt(i, m); }
  for (let i = 0; i < pil.count; i++) { const p = mrtCurve.getPointAt(i / pil.count); m.makeTranslation(p.x, 5, p.z); pil.setMatrixAt(i, m); }
  deck.castShadow = deck.receiveShadow = pil.castShadow = true; scene.add(deck, pil);
  for (const [x, y, len] of [[515, 462, 150], [546, 104, 140]]) {
    const [sx, sz] = tm(x, y); let bt = 0, bd = 1e9; for (let i = 0; i <= 200; i++) { const p = mrtCurve.getPointAt(i / 200); const d = (p.x - sx) ** 2 + (p.z - sz) ** 2; if (d < bd) { bd = d; bt = i / 200; } }
    const t = mrtCurve.getTangentAt(bt), g = new THREE.Group(); g.position.set(sx, 0, sz); g.rotation.y = Math.atan2(t.x, t.z);
    const mat = new THREE.MeshStandardMaterial({ color: '#E8E4DE' });
    const plat = new THREE.Mesh(new THREE.BoxGeometry(24, 2.4, len), mat); plat.position.y = 11.2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 1.2, len + 6), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .35 })); roof.position.y = 20.5;
    plat.castShadow = roof.castShadow = true; g.add(plat, roof);
    for (const cx of [-12, 12]) for (let zz = -len / 2 + 8; zz <= len / 2 - 8; zz += 24) { const col = new THREE.Mesh(new THREE.BoxGeometry(.8, 8, .8), mat); col.position.set(cx, 16, zz); g.add(col); }
    scene.add(g);
  }
})();
// Kereta Ratangga: 6 kereta x 20 m. Kecepatan operasi jalur layang 50 sampai 60 km/jam (detik.com),
// maks. desain 100 km/jam (Setkab). Headway 5 menit jam sibuk (07.00-09.00, 17.00-19.00), 10 menit di luar itu,
// operasi 05.00-24.00 (PT MRT Jakarta). Percepatan/perlambatan 0,9 m/s² dan henti 30 detik: asumsi tipikal metro.
const MRT = { vMaks: 60 / 3.6, a: .9, d: .9, henti: 30, panjang: 120 };
const sOf = (x, y) => { const [sx, sz] = tm(x, y); let bt = 0, bd = 1e12; for (let i = 0; i <= 400; i++) { const p = mrtCurve.getPointAt(i / 400); const d = (p.x - sx) ** 2 + (p.z - sz) ** 2; if (d < bd) { bd = d; bt = i / 400; } } return bt * MRT_L; };
const ST_MRT = [{ n: 'ASEAN', s: sOf(546, 104) }, { n: 'Blok M BCA', s: sOf(515, 462) }];
function profilKereta(arah) {
  // arah 0: ke Lebak Bulus (s naik, utara ke selatan); arah 1: ke Bundaran HI (s turun)
  const L = MRT_L + MRT.panjang, stop = ST_MRT.map((t) => arah ? L - t.s - MRT.panjang / 2 : t.s + MRT.panjang / 2).sort((a, b) => a - b);
  const ts = [0], ss = [0], tiba = {}; let t = 0, x = 0, v = MRT.vMaks, k = 0; const dt = .1;
  while (x < L) {
    const target = k < stop.length ? stop[k] : Infinity, sisa = target - x;
    if (sisa <= Math.max(.05, v * v / (2 * MRT.d)) && k < stop.length) { v = Math.max(0, v - MRT.d * dt); if (v === 0 || sisa < .05) { x = target; const nm = ST_MRT[arah ? stop.length - 1 - k : k].n; tiba[nm] = [t, t + MRT.henti]; for (let w = 0; w < MRT.henti; w += 1) { t += 1; ts.push(t); ss.push(x); } k++; v = 0; continue; } }
    else v = Math.min(MRT.vMaks, v + MRT.a * dt);
    x += v * dt; t += dt; ts.push(t); ss.push(Math.min(x, L));
  }
  return { ts, ss, T: t, L, tiba };
}
const PROF_K = [profilKereta(0), profilKereta(1)], OFF_ARAH = [0, 45];
const headway = (h) => (h < 5 || h >= 24) ? 0 : ((h >= 7 && h < 9) || (h >= 17 && h < 19)) ? 300 : 600;
const KERETA = [];
{
  const carGeo = new THREE.BoxGeometry(3, 3.6, 19.5); carGeo.translate(0, 1.8, 0);
  const carMat = new THREE.MeshStandardMaterial({ color: '#F4F6F8', roughness: .35 }), stMat = new THREE.MeshStandardMaterial({ color: '#2F6BD8', emissive: '#2F6BD8', emissiveIntensity: .35 });
  const kacaMat = new THREE.MeshStandardMaterial({ color: '#1C2A3A', roughness: .2, emissive: '#FFD9A0', emissiveIntensity: 0 });
  const stGeo = new THREE.BoxGeometry(3.05, .5, 19.6), kacaGeo = new THREE.BoxGeometry(3.08, 1.1, 17.5); kacaGeo.translate(0, 2.55, 0);
  for (let d = 0; d < 2; d++) for (let k = 0; k < 3; k++) { const grp = new THREE.Group(); for (let c = 0; c < 6; c++) { const cg = new THREE.Group(); const car = new THREE.Mesh(carGeo, carMat); car.castShadow = true; const st = new THREE.Mesh(stGeo, stMat); st.position.y = 1.4; cg.add(car, st, new THREE.Mesh(kacaGeo, kacaMat)); grp.add(cg); } grp.visible = false; scene.add(grp); KERETA.push({ grp, arah: d, slot: k }); }
  KERETA.kaca = kacaMat;
}
let tNyata = 0;
function posKereta(prof, t) { const { ts, ss } = prof; let lo = 0, hi = ts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m; else hi = m; } const u = (t - ts[lo]) / ((ts[hi] - ts[lo]) || 1); return lerp(ss[lo], ss[hi], clamp(u)); }
function langkahKereta(dt) {
  tNyata += dt * S.kecepatan; const H = headway(S.jam) / S.rasioMRT;
  KERETA.kaca.emissiveIntensity = U.uNight.value * 1.4;
  for (const k of KERETA) {
    const prof = PROF_K[k.arah]; k.grp.visible = false; if (!H || !S.mrt) continue;
    const off = OFF_ARAH[k.arah], n = Math.floor((tNyata - off) / H) - k.slot, t = tNyata - off - n * H;
    if (t < 0 || t > prof.T) continue;
    const kepala = posKereta(prof, t), dir = k.arah ? -1 : 1, lajur = k.arah ? 2.2 : -2.2; k.grp.visible = true;
    k.grp.children.forEach((car, ci) => {
      const sAbs = k.arah ? MRT_L - kepala + 10 + ci * 20.6 : kepala - MRT.panjang + (5 - ci) * 20.6 + 10, tt = sAbs / MRT_L;
      car.visible = tt > .002 && tt < .998; if (!car.visible) return;
      const p = mrtCurve.getPointAt(clamp(tt)), tg = mrtCurve.getTangentAt(clamp(tt)); car.position.set(p.x + lajur * tg.z, 11.9, p.z - lajur * tg.x); car.rotation.y = Math.atan2(tg.x, tg.z);
    });
  }
}
function statusMRT() {
  const H0 = headway(S.jam), H = H0 / S.rasioMRT; if (!H) return { teks: 'MRT tidak beroperasi pukul 00.00 sampai 05.00', henti: false };
  let best = null;
  for (const arah of [0, 1]) {
    const prof = PROF_K[arah], [ta, td] = prof.tiba['Blok M BCA'], off = OFF_ARAH[arah];
    for (let n = Math.floor((tNyata - off - td) / H); n < Math.floor((tNyata - off - td) / H) + 3; n++) {
      const a = off + n * H + ta, b = off + n * H + td;
      if (tNyata <= b) { const c = { arah, a, b, henti: tNyata >= a }; if (!best || (c.henti && !best.henti) || (!best.henti && c.a < best.a)) best = c; break; }
    }
  }
  const tujuan = best.arah ? 'Bundaran HI' : 'Lebak Bulus';
  if (best.henti) return { teks: `Kereta ke ${tujuan} <b>berhenti</b> di Blok M BCA · ${Math.ceil(best.b - tNyata)} dtk`, henti: true };
  const s = Math.max(0, Math.round(best.a - tNyata)); return { teks: `Ke ${tujuan} tiba di Blok M BCA <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b> · headway ${H0 / 60} mnt${S.rasioMRT > 1 ? ` (tampil 1:${S.rasioMRT})` : ''}`, henti: false };
}

// =============================================================
//  Label 3D
// =============================================================
const LBL = [], lblRoot = $('#labels');
const PRIO = { zona: 5, transit: 4, landmark: 3, tempat: 2, ring: 1 };
function label(html, x, y, z, kelas, grup, extra = {}) { const el = document.createElement('div'); el.className = 'lbl ' + kelas; el.innerHTML = html; lblRoot.appendChild(el); const o = { el, p: new THREE.Vector3(x, y, z), grup, prio: PRIO[grup] || 0, w: 0, h: 0, ...extra }; LBL.push(o); return o; }
for (const t of D.transit.filter((t) => !t.kecil)) label(`<i class="pin ${t.jenis === 'MRT' ? 'mrt' : 'tj'}"></i>${t.nama}`, t.m[0], t.jenis === 'MRT' ? 18 : 4, t.m[1], 'transit', 'transit', { hp: t.jenis === 'MRT' });
B.forEach((b, i) => { if (b.lm) { const o = label(`<b>${b.n}</b><span>${b.f} lantai · ±${Math.round(b.h)} m</span>`, b.c[0], b.h + 6, b.c[1], 'landmark', 'landmark', { hp: true, bid: i }); o.el.onclick = () => pilihBangunan(i, true); } });
for (const [n, x, y] of [['Taman Literasi', 548, 352], ['M Bloc Space', 548, 228], ['Little Tokyo', 585, 432], ['Taman Sepeda', 715, 578]]) { const [mx, mz] = tm(x, y); label(n, mx, 3, mz, 'tempat', 'tempat'); }
const zonaLbl = label(`Kawasan inti Blok M · ${nf(VS.luas_ha, 0)} ha`, BND[3][0] - 30, 6, BND[3][1] - 20, 'zona', 'zona', { hp: true });
const ring = new THREE.Group(); for (const r of [400, 800]) { const m = new THREE.Mesh(new THREE.RingGeometry(r - 1.6, r + 1.6, 160), new THREE.MeshBasicMaterial({ color: TEMA3D.terang.ring, transparent: true, opacity: r === 400 ? .5 : .32, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .6; ring.add(m); } scene.add(ring);
label('<b>400 m</b>', 283, 2, -283, 'ring', 'ring'); label('<b>800 m</b>', 566, 2, -320, 'ring', 'ring');
const vtmp = new THREE.Vector3();
let ZONA_UI = [], zonaT = 0;
function ukurZonaUI() {
  // persegi elemen UI yang menutupi peta: label di bawahnya disembunyikan
  ZONA_UI = ['#brand', '#alat', '#rel', '#panel', '#dok', '#legenda', '#info', '#cerita', '#sheet', '#navbawah', '#kompas'].map((q) => $(q)).filter((e) => e && !e.hidden && e.offsetParent !== null && getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
}
function updateLabels() {
  const w = innerWidth, h = innerHeight, hp = mqHP.matches, now = performance.now();
  if (now - zonaT > 400) { ukurZonaUI(); zonaT = now; }
  const tampil = [];
  for (const o of LBL) {
    vtmp.copy(o.p); if (o.grup === 'landmark') vtmp.y *= clamp(U.uGrow.value * 1.2); vtmp.project(camera);
    o.vis = !o.sembunyi && S.label && (!hp || o.hp) && vtmp.z < 1 && Math.abs(vtmp.x) < 1.02 && Math.abs(vtmp.y) < 1.02;
    if (!o.vis) { if (o.el.style.display !== 'none') o.el.style.display = 'none'; continue; }
    o.sx = (vtmp.x * .5 + .5) * w; o.sy = (-vtmp.y * .5 + .5) * h; o.dz = vtmp.z;
    if (!o.w) { o.el.style.display = ''; o.w = o.el.offsetWidth; o.h = o.el.offsetHeight; }
    tampil.push(o);
  }
  tampil.sort((a, b) => b.prio - a.prio || a.dz - b.dz);
  const taruh = [];
  for (const o of tampil) {
    // kotak label di layar (sesuai jangkar CSS tiap jenis)
    let x0 = o.sx, y0 = o.sy;
    if (o.grup === 'landmark') { x0 -= o.w / 2; y0 -= 44; } else if (o.grup === 'transit') { x0 -= 11; y0 -= 11; } else { x0 -= o.w / 2; y0 -= o.h / 2; }
    const r = [x0 - 3, y0 - 3, x0 + o.w + 3, y0 + o.h + 3];
    const tabrak = taruh.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) || ZONA_UI.some((q) => r[0] < q.right && r[2] > q.left && r[1] < q.bottom && r[3] > q.top);
    o.el.style.display = ''; o.el.classList.toggle('redup', tabrak);
    if (!tabrak) taruh.push(r);
    o.el.style.transform = `translate(${o.sx}px,${o.sy}px)`;
  }
}

// =============================================================
//  Matahari (NOAA) dan siang-malam
// =============================================================
const LAT = D.meta.lat, LON = D.meta.lon;
function posisiMatahari(doy, jam) {
  const g = 2 * Math.PI / 365 * (doy - 1 + (jam - 12) / 24);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = jam * 60 + eqt + 4 * LON - 420, ha = (tst / 4 - 180) * Math.PI / 180, la = LAT * Math.PI / 180;
  const el = Math.PI / 2 - Math.acos(clamp(Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha), -1, 1));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la)) + Math.PI;
  return { el, az, elDeg: el * 180 / Math.PI, azDeg: (az * 180 / Math.PI) % 360 };
}
let SUN = posisiMatahari(80, 16.5);
const suhuUdara = (h) => 25.3 + 7.6 * Math.pow(clamp(Math.sin(Math.PI * (h - 6.2) / 15.6)), 1.25) + (h > 21 ? -.4 * (h - 21) : 0);
const radiasi = (h) => clamp(Math.sin(Math.PI * (h - 6) / 12.4));
function setMatahari() {
  SUN = posisiMatahari(S.doy, S.jam); const el = Math.max(SUN.el, -.3);
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(SUN.az), Math.sin(el), -Math.cos(el) * Math.cos(SUN.az)).normalize();
  sun.position.copy(dir).multiplyScalar(2500).add(sun.target.position);
  const siang = clamp(SUN.elDeg / 25 + .15), senja = clamp(1 - Math.abs(SUN.elDeg - 4) / 10) * (SUN.elDeg > -6 ? 1 : 0);
  sun.intensity = 2.5 * clamp(SUN.elDeg / 12);
  sun.color.setRGB(1, lerp(.72, 1, clamp(SUN.elDeg / 25)), lerp(.5, .96, clamp(SUN.elDeg / 25)));
  hemi.intensity = lerp(.55, .72, siang) ; hemi.color.set(siang > .3 ? '#ffffff' : '#a9b8e0'); hemi.groundColor.set(siang > .3 ? TEMA3D.terang.hemiG : '#3a3550');
  const bg = LANGIT.malam.clone().lerp(LANGIT.siang, siang).lerp(LANGIT.senja, senja * .45);
  scene.background.copy(bg); scene.fog.color.copy(bg); far.material.color.copy(bg).multiplyScalar(.96);
  U.uNight.value = clamp(-SUN.elDeg / 6 + .25);
  if (bloom) bloom.strength = lerp(.12, .85, U.uNight.value);
  document.body.classList.toggle('malam', SUN.elDeg < -2);
}

// =============================================================
//  Peta tinggi & teduhan jalur
// =============================================================
const HC = 3, HW = Math.ceil(EW / HC), HH = Math.ceil(EH / HC);
const hmap = new Float32Array(HW * HH);
{
  const c = document.createElement('canvas'); c.width = HW; c.height = HH; const x = c.getContext('2d');
  for (const i of B.map((b, i) => i).sort((a, b) => B[a].h - B[b].h)) { const b = B[i]; x.fillStyle = `rgb(${Math.min(255, Math.round(b.h))},0,0)`; x.beginPath(); for (let k = 0; k < b.p.length; k += 2) { const px = (b.p[k] - EXT[0]) / HC, pz = (b.p[k + 1] - EXT[1]) / HC; k ? x.lineTo(px, pz) : x.moveTo(px, pz); } x.fill(); }
  const d = x.getImageData(0, 0, HW, HH).data; for (let i = 0; i < HW * HH; i++) hmap[i] = d[i * 4];
}
function tanamDiPeta(list, map) { for (const [tx, tz, r] of list) { const cx = Math.round((tx - EXT[0]) / HC), cz = Math.round((tz - EXT[1]) / HC), rr = Math.ceil(r / HC); for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) { if (i * i + j * j > rr * rr) continue; const k = (cz + j) * HW + cx + i; if (k >= 0 && k < map.length) map[k] = Math.max(map[k], r * 1.6); } } }
tanamDiPeta(T, hmap);
const JALAN = []; for (let i = 0; i < GW * GH; i++) if (GR.lu[i] === 1 && GR.dalam[i]) JALAN.push(cellXZ(i));
// skenario: pohon peneduh di tepi jalur dalam kawasan inti yang belum teduh
const POHON_BARU = (() => {
  const out = [], ada = (x, z) => { const i = Math.floor((x - EXT[0]) / HC), j = Math.floor((z - EXT[1]) / HC); return hmap[j * HW + i] > 2; };
  for (const [x, z] of JALAN) {
    if (ada(x, z)) continue;
    let dekat = false; for (const [ox, oz] of out) if ((ox - x) ** 2 + (oz - z) ** 2 < 11 * 11) { dekat = true; break; } if (dekat) continue;
    let tepi = false; for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) { const i = cellOf(x + dx, z + dz); if (i >= 0 && GR.lu[i] !== 1) tepi = true; } if (!tepi) continue;
    out.push([x + (Math.random() - .5) * 2, z + (Math.random() - .5) * 2, 3.6 + Math.random()]);
  }
  return out;
})();
const hmapSken = hmap.slice(); tanamDiPeta(POHON_BARU, hmapSken);
const pohonBaru = buatPohon(POHON_BARU, [.3, .45, .45]); pohonBaru.visible = false; pohonBaru.scale.y = .01;
function persenTeduh(doy, jam, map = hmap) {
  const s = posisiMatahari(doy, jam); if (s.elDeg <= 0) return null;
  const tanE = Math.tan(s.el), sx = Math.sin(s.az), sz = -Math.cos(s.az); let t = 0;
  for (const [x, z] of JALAN) {
    for (let d = 3; d < 900; d += 3) { const i = Math.floor((x + sx * d - EXT[0]) / HC), j = Math.floor((z + sz * d - EXT[1]) / HC); if (i < 0 || j < 0 || i >= HW || j >= HH) break; const need = d * tanE + 1.5; if (need > 175) break; if (map[j * HW + i] > need) { t++; break; } }
  }
  return 100 * t / JALAN.length;
}
const teduhCache = {};
function kurvaTeduh(doy, map, key) { const k = doy + key; if (!teduhCache[k]) { teduhCache[k] = []; for (let h = 6; h <= 18; h += .5) teduhCache[k].push([h, persenTeduh(doy, h, map)]); } return teduhCache[k]; }

// =============================================================
//  Angin (medan LBM steady + partikel)
// =============================================================
// medan angin (±0,8 MB) dimuat saat lensa angin dibuka; statistik ringkas sudah ada di data utama
let WD = null, WNX = 0, WNY = 0, WCS = 6, WSOL = null, anginMuat = null; const WF = {};
function pasangAngin(w) {
  WD = w; WNX = w.nx; WNY = w.ny; WCS = w.cs; for (const k in w.dirs) WF[k] = { u: dec8(w.dirs[k].u), v: dec8(w.dirs[k].v) };
  const p = dec(w.solid); WSOL = new Uint8Array(WNX * WNY); for (let i = 0; i < WSOL.length; i++) WSOL[i] = (p[i >> 3] >> (7 - (i & 7))) & 1;
  for (let i = 0; i < NP; i++) respawn(i); for (const k in statAnginCache) delete statAnginCache[k];
}
function muatAngin() { if (WD) return Promise.resolve(); return anginMuat || (anginMuat = muatSkrip('data_angin.js').then(() => pasangAngin(window.DANGIN))); }
function anginDi(x, z, f) {
  if (!WD || !f) return null;
  const gx = (x - EXT[0]) / WCS - .5, gz = (z - EXT[1]) / WCS - .5, i = Math.floor(gx), j = Math.floor(gz);
  if (i < 0 || j < 0 || i >= WNX - 1 || j >= WNY - 1) return null; const fx = gx - i, fz = gz - j, k = j * WNX + i, s = WD.scale;
  return [((f.u[k] * (1 - fx) + f.u[k + 1] * fx) * (1 - fz) + (f.u[k + WNX] * (1 - fx) + f.u[k + WNX + 1] * fx) * fz) / s, ((f.v[k] * (1 - fx) + f.v[k + 1] * fx) * (1 - fz) + (f.v[k + WNX] * (1 - fx) + f.v[k + WNX + 1] * fx) * fz) / s, WSOL[k]];
}
const ARAH = { B: 'Barat · monsun barat (Des sampai Mar)', BL: 'Barat laut · peralihan (Okt sampai Nov)', U: 'Utara · angin laut siang', T: 'Timur · monsun timur (Jun sampai Agu)', TG: 'Tenggara · kemarau (Agu sampai Sep)' };
const NP = LITE ? 2500 : 6000, TRAIL = 10;
const pPos = new Float32Array(NP * 2), pAge = new Float32Array(NP), pHist = new Float32Array(NP * TRAIL * 2);
const wGeo = new THREE.BufferGeometry(), wPos = new Float32Array(NP * (TRAIL - 1) * 6), wCol = new Float32Array(NP * (TRAIL - 1) * 8);
wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3)); wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 4));
const wLines = new THREE.LineSegments(wGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
wLines.frustumCulled = false; wLines.visible = false; wLines.renderOrder = 5; scene.add(wLines);
const hGeo = new THREE.BufferGeometry(), hPos = new Float32Array(NP * 3), hCol = new Float32Array(NP * 3);
hGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3)); hGeo.setAttribute('color', new THREE.BufferAttribute(hCol, 3));
wLines.add(Object.assign(new THREE.Points(hGeo, new THREE.PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false })), { frustumCulled: false }));
function respawn(i) { let x, z; for (let t = 0; t < 20; t++) { x = BC[0] + (Math.random() - .5) * 1500; z = BC[1] + (Math.random() - .5) * 1000; const w = anginDi(x, z, WF[S.arah]); if (w && !w[2]) break; } pPos[i * 2] = x; pPos[i * 2 + 1] = z; pAge[i] = Math.random() * 120; for (let k = 0; k < TRAIL; k++) { pHist[(i * TRAIL + k) * 2] = x; pHist[(i * TRAIL + k) * 2 + 1] = z; } }
function langkahAngin(dt) {
  if (!WD) return;
  const f = WF[S.arah], Ur = S.uref * .78, sp = dt * 95; let p = 0, c = 0;
  for (let i = 0; i < NP; i++) {
    let x = pPos[i * 2], z = pPos[i * 2 + 1]; const w = anginDi(x, z, f);
    if (!w || w[2] || (pAge[i] -= dt * 10) < 0) { respawn(i); continue; }
    const ms = Math.hypot(w[0], w[1]) * Ur; x += w[0] * Ur * sp; z += w[1] * Ur * sp; pPos[i * 2] = x; pPos[i * 2 + 1] = z;
    const b = i * TRAIL * 2; pHist.copyWithin(b + 2, b, b + (TRAIL - 1) * 2); pHist[b] = x; pHist[b + 1] = z;
    const col = F.angin(ms / 4), y = 2.2 + (i % 7) * .9;
    hPos[i * 3] = x; hPos[i * 3 + 1] = y; hPos[i * 3 + 2] = z; hCol[i * 3] = col[0]; hCol[i * 3 + 1] = col[1]; hCol[i * 3 + 2] = col[2];
    for (let k = 0; k < TRAIL - 1; k++) {
      wPos[p++] = pHist[b + k * 2]; wPos[p++] = y; wPos[p++] = pHist[b + k * 2 + 1]; wPos[p++] = pHist[b + k * 2 + 2]; wPos[p++] = y; wPos[p++] = pHist[b + k * 2 + 3];
      const a0 = (1 - k / (TRAIL - 1)) * .9, a1 = (1 - (k + 1) / (TRAIL - 1)) * .9;
      wCol[c++] = col[0]; wCol[c++] = col[1]; wCol[c++] = col[2]; wCol[c++] = a0; wCol[c++] = col[0]; wCol[c++] = col[1]; wCol[c++] = col[2]; wCol[c++] = a1;
    }
  }
  wGeo.setDrawRange(0, p / 3); wGeo.attributes.position.needsUpdate = wGeo.attributes.color.needsUpdate = hGeo.attributes.position.needsUpdate = hGeo.attributes.color.needsUpdate = true;
}
const statAnginCache = {};
function statAngin(arah = S.arah) {
  if (!WD) return D.angin_stat[arah];
  const k = arah + S.uref; if (statAnginCache[k]) return statAnginCache[k];
  const f = WF[arah], Ur = S.uref * .78; let n = 0, st = 0, ny = 0, kc = 0, sum = 0;
  for (const [x, z] of JALAN) { const w = anginDi(x, z, f); if (!w || w[2]) continue; const ms = Math.hypot(w[0], w[1]) * Ur; n++; sum += ms; if (ms < .3) st++; else if (ms < 4) ny++; else kc++; }
  return statAnginCache[k] = { rata: sum / n, stag: 100 * st / n, nyaman: 100 * ny / n, kencang: 100 * kc / n };
}
SK.angin = Math.round(statAngin('B').nyaman);

// =============================================================
//  Heatmap sosial (kolom heksagon)
// =============================================================
const g2 = (h, m, s) => Math.exp(-(((h - m + 36) % 24 - 12) ** 2) / (2 * s * s));
const PROFIL = {
  kuliner: (h) => .03 + .9 * g2(h, 12.5, 1.3) + g2(h, 19.3, 1.9) + .35 * g2(h, 16, 1.5) + .25 * g2(h, 22.5, 1.2),
  belanja: (h) => .02 + .8 * g2(h, 13, 1.8) + g2(h, 17.5, 2.2), akomodasi: (h) => .25 + .3 * g2(h, 8, 2) + .4 * g2(h, 20, 2.5),
  jasa: (h) => .02 + g2(h, 10, 1.8) + .7 * g2(h, 14, 1.6), kesehatan: (h) => .05 + .9 * g2(h, 10, 2) + .7 * g2(h, 18, 2),
  ibadah: (h) => .05 + .5 * g2(h, 4.7, .5) + g2(h, 12, .6) + .6 * g2(h, 15.2, .5) + .9 * g2(h, 18, .5) + .7 * g2(h, 19.2, .5),
  mrt: (h) => .05 * (h >= 5 ? 1 : 0) + .9 * g2(h, 7.6, 1) + .45 * g2(h, 12.5, 2.5) + g2(h, 17.8, 1.2) + .4 * g2(h, 20.5, 1.5),
  hub: (h) => .02 + .5 * g2(h, 12.5, 1.6) + .9 * g2(h, 17.5, 1.8) + g2(h, 20, 2),
};
const PN = {}; for (const k in PROFIL) { let s = 0; for (let h = 0; h < 24; h++) s += PROFIL[k](h); PN[k] = (h) => PROFIL[k](h) / s; }
const KAT = D.poi_cat, BOBOT = { kuliner: 1.6, belanja: 1.2, akomodasi: .45, jasa: .7, kesehatan: .5, ibadah: .6 };
const ANCHOR = [
  { n: 'Stasiun MRT Blok M BCA', xy: [515, 462], v: 17858, p: 'mrt', src: 'PT MRT Jakarta, Des 2025: 553.599 pelanggan/bulan' },
  { n: 'Blok M Hub', xy: [600, 375], v: 25000, p: 'hub', src: 'Katadata 2026: rata-rata 25.000 kunjungan/hari' },
  { n: 'M Bloc Space', xy: [548, 228], v: 6000, p: 'hub', src: 'Latip dkk. 2024' },
  { n: 'Taman Literasi', xy: [548, 352], v: 400, p: 'hub', src: 'Ramadhan dkk. 2025' },
];
const TOTAL_KAWASAN = 80000, sumA = ANCHOR.reduce((s, a) => s + a.v, 0), sumW = D.poi.reduce((s, p) => s + BOBOT[KAT[p[2]]], 0);
const SUMBER = D.poi.map((p) => [p[0], p[1], (TOTAL_KAWASAN - sumA) * BOBOT[KAT[p[2]]] / sumW, KAT[p[2]]]).concat(ANCHOR.map((a) => [...tm(...a.xy), a.v, a.p]));
const totalJam = (h) => SUMBER.reduce((s, [, , v, p]) => s + v * PN[p](h), 0);
const HR = 26, HEX = [];
{ const dx = HR * Math.sqrt(3), dz = HR * 1.5; let row = 0; for (let z = EXT[1] + HR; z < EXT[3]; z += dz, row++) for (let x = EXT[0] + HR + (row % 2 ? dx / 2 : 0); x < EXT[2]; x += dx) HEX.push({ x, z, v: new Float32Array(24) }); }
for (const [x, z, harian, prof] of SUMBER) { const ws = []; let tot = 0; for (const hx of HEX) { const d2 = (hx.x - x) ** 2 + (hx.z - z) ** 2; if (d2 > (HR * 3.2) ** 2) continue; const w = Math.exp(-d2 / (2 * (HR * 1.1) ** 2)); ws.push([hx, w]); tot += w; } for (const [hx, w] of ws) for (let h = 0; h < 24; h++) hx.v[h] += harian * PN[prof](h) * w / tot; }
const HEXA = HEX.filter((h) => h.v.reduce((a, b) => a + b, 0) > 40);
const hexGeo = new THREE.CylinderGeometry(HR * .93, HR * .93, 1, 6); hexGeo.translate(0, .5, 0); hexGeo.rotateY(Math.PI / 6);
const hexMat = new THREE.MeshStandardMaterial({ roughness: .5, transparent: true, opacity: .93 });
hexMat.onBeforeCompile = (sh) => { sh.uniforms.uNight = U.uNight; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * (0.15 + 0.75 * uNight);\n#endif'); };
const hexMesh = new THREE.InstancedMesh(hexGeo, hexMat, HEXA.length); hexMesh.visible = false; scene.add(hexMesh);
const hexMax = Math.max(...HEXA.map((h) => Math.max(...h.v))), hexNow = new Float32Array(HEXA.length);
let sosGrow = 0;
function updateHex() {
  const h0 = Math.floor(S.jam) % 24, h1 = (h0 + 1) % 24, f = S.jam % 1, m = new THREE.Matrix4(), c = new THREE.Color();
  HEXA.forEach((hx, i) => { const v = lerp(hx.v[h0], hx.v[h1], f); hexNow[i] = v; const t = Math.sqrt(v / hexMax); m.makeScale(1, Math.max(.6, t * 480 * sosGrow), 1); m.setPosition(hx.x, 0, hx.z); hexMesh.setMatrixAt(i, m); c.setRGB(...F.sos(t)); hexMesh.setColorAt(i, c); });
  hexMesh.instanceMatrix.needsUpdate = true; if (hexMesh.instanceColor) hexMesh.instanceColor.needsUpdate = true;
}

// =============================================================
//  Manusia: figur berjalan, berkelompok, duduk, menunggu (kepadatan mengikuti model kunjungan per jam)
// =============================================================
const SKALA_ORANG = 1.8;      // diperbesar agar terbaca dari kamera kawasan
const NH = LITE ? 600 : 1200;
const orangGeo = (() => {
  const parts = [], add = (g, part, kind) => { const n = g.attributes.position.count; g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1)); g.setAttribute('aKind', new THREE.Float32BufferAttribute(new Float32Array(n).fill(kind), 1)); parts.push(g.index ? g.toNonIndexed() : g); };
  const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  add(box(.15, .84, .17, -.1, .42, 0), 1, 1); add(box(.15, .84, .17, .1, .42, 0), 2, 1);       // kaki
  add(box(.42, .6, .24, 0, 1.15, 0), 0, 0);                                                    // badan
  add(box(.1, .6, .12, -.27, 1.13, 0), 3, 0); add(box(.1, .6, .12, .27, 1.13, 0), 4, 0);       // lengan
  const kepala = new THREE.IcosahedronGeometry(.14, 1); kepala.translate(0, 1.6, 0); add(kepala, 0, 2);
  const keys = ['position', 'normal', 'aPart', 'aKind'], out = new THREE.BufferGeometry();
  for (const k of keys) { const arr = []; parts.forEach((g) => arr.push(...g.attributes[k].array)); out.setAttribute(k, new THREE.Float32BufferAttribute(arr, k === 'position' || k === 'normal' ? 3 : 1)); }
  out.scale(SKALA_ORANG, SKALA_ORANG, SKALA_ORANG); return out;
})();
const aBaju = new THREE.InstancedBufferAttribute(new Float32Array(NH * 3), 3), aCelana = new THREE.InstancedBufferAttribute(new Float32Array(NH * 3), 3), aKulit = new THREE.InstancedBufferAttribute(new Float32Array(NH * 3), 3), aAnim = new THREE.InstancedBufferAttribute(new Float32Array(NH * 4), 4);
orangGeo.setAttribute('aBaju', aBaju); orangGeo.setAttribute('aCelana', aCelana); orangGeo.setAttribute('aKulit', aKulit); orangGeo.setAttribute('aAnim', aAnim);
const orangMat = new THREE.MeshStandardMaterial({ roughness: .8 });
orangMat.onBeforeCompile = (sh) => {
  sh.uniforms.uTime = U.uTime;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
    uniform float uTime; attribute float aPart; attribute float aKind; attribute vec3 aBaju; attribute vec3 aCelana; attribute vec3 aKulit; attribute vec4 aAnim; varying vec3 vWarna;
    mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      // aAnim: x fase, y langkah (0 diam, 1 jalan), z keadaan (0 jalan/berdiri, 1 duduk), w isyarat
      float S_ = ${SKALA_ORANG.toFixed(2)}, ph = uTime * 7.2 * (0.85 + aAnim.y * 0.25) + aAnim.x;
      float ayun = sin(ph) * 0.55 * aAnim.y, duduk = aAnim.z;
      float sudut = 0.0; float piv = 0.86 * S_;
      if (aPart > .5 && aPart < 2.5) { sudut = (aPart < 1.5 ? ayun : -ayun) - duduk * 1.45; }
      if (aPart > 2.5) { piv = 1.42 * S_; sudut = (aPart < 3.5 ? -ayun : ayun) * .8 + aAnim.w * sin(uTime * 2.3 + aAnim.x) * (aPart < 3.5 ? .5 : 0.) - duduk * .35; }
      mat3 R = rotX(sudut); objectNormal = R * objectNormal;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y -= piv; transformed = R * transformed; transformed.y += piv;
      transformed.y += abs(sin(ph)) * 0.05 * aAnim.y - duduk * 0.42 * S_;
      vWarna = aKind < .5 ? aBaju : aKind < 1.5 ? aCelana : aKulit;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWarna;').replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vWarna, opacity );');
};
const orang = new THREE.InstancedMesh(orangGeo, orangMat, NH); orang.frustumCulled = false; orang.castShadow = true; scene.add(orang);
const agents = orang;   // kompatibel dengan kode lensa lama
const BAJU = ['#F1F3F5', '#2B2F36', '#3E6FD8', '#E0574A', '#F2C14E', '#4BAE84', '#8E6BD1', '#E77FA8', '#2F9BB3', '#C9B79C', '#5A6472', '#F08A4B'];
const CELANA = ['#2C3440', '#3A4A6B', '#1F232A', '#6B5B4B', '#8A939E', '#46505C'];
const KULIT = ['#C99A73', '#B9855E', '#D8A982', '#A8754F', '#E0B48E'];
{ const c = new THREE.Color(); for (let i = 0; i < NH; i++) { c.set(BAJU[i % BAJU.length]).offsetHSL(0, 0, (Math.random() - .5) * .08); aBaju.setXYZ(i, c.r, c.g, c.b); c.set(CELANA[(i * 7) % CELANA.length]); aCelana.setXYZ(i, c.r, c.g, c.b); c.set(KULIT[(i * 3) % KULIT.length]); aKulit.setXYZ(i, c.r, c.g, c.b); aAnim.setXYZW(i, Math.random() * 6.28, 1, 0, 0); } }
// jaringan trotoar dari ruas OSM: titik ujung dihubungkan agar pejalan berjalan menerus
const LEBAR_JALAN = [10.5, 8, 6, 4, 3.2, .6];
const PATHS = O.seg.map((g, gi) => { const pts = []; for (let k = 0; k < g.p.length; k += 2) pts.push([g.p[k], g.p[k + 1]]); const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, L: cum[cum.length - 1], c: g.c, gi }; }).filter((p) => p.L > 6);
const UJUNG = new Map(); const kunci = (x, z) => Math.round(x / 3) + ',' + Math.round(z / 3);
PATHS.forEach((p, i) => { for (const [e, end] of [[p.pts[0], 0], [p.pts[p.pts.length - 1], 1]]) { const k = kunci(...e); if (!UJUNG.has(k)) UJUNG.set(k, []); UJUNG.get(k).push([i, end]); } });
const posPath = (p, d, sisi) => { let j = 1; while (j < p.cum.length - 1 && p.cum[j] < d) j++; const a = p.pts[j - 1], b = p.pts[j], l = (p.cum[j] - p.cum[j - 1]) || 1, u = clamp((d - p.cum[j - 1]) / l); const dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l, off = sisi * (LEBAR_JALAN[p.c] / 2 + .9); return [lerp(a[0], b[0], u) + dz * off, lerp(a[1], b[1], u) - dx * off, dx, dz]; };
// sumber kepadatan: POI & jangkar terukur, berbobot profil jam
const pathTerdekat = (x, z) => { let bi = 0, bd = 1e12; PATHS.forEach((p, i) => { if (p.c === 0) return; const m = p.pts[(p.pts.length / 2) | 0]; const d = (m[0] - x) ** 2 + (m[1] - z) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
let SUMBER_PATH = null;
const SPOT = V4.spot, PROF_SPOT = { taman: (h) => .15 + g2(h, 7, 1.2) * .7 + g2(h, 16.8, 1.8), plaza: (h) => .1 + .6 * g2(h, 13, 2) + g2(h, 19.8, 2.2), kuliner: (h) => .05 + .8 * g2(h, 12.4, 1.3) + g2(h, 19.6, 2), halte: (h) => (h >= 5 ? .1 : 0) + g2(h, 7.6, 1.1) + .9 * g2(h, 17.8, 1.4) };
const OR = Array.from({ length: NH }, (_, i) => ({ mode: 'off', p: null, d: 0, v: 1.1 + Math.random() * .45, arah: 1, sisi: Math.random() < .5 ? 1 : -1, x: 0, z: 0, rot: 0, aktif: false }));
const mOrang = new THREE.Matrix4(), qOrang = new THREE.Quaternion(), sOrang = new THREE.Vector3(1, 1, 1), pOrang = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0), nol = new THREE.Matrix4().makeScale(0, 0, 0);
let orangT = -10, jamOrang = -1;
function aturOrang() {
  // bagi figur: 58% berjalan, 26% berkelompok, 10% duduk, 6% menunggu angkutan
  if (!SUMBER_PATH) SUMBER_PATH = SUMBER.map(([x, z]) => pathTerdekat(x, z));
  const h = S.jam % 24, tot = totalJam(Math.floor(h)), N = Math.round(NH * KUAL.orang * clamp(.04 + .96 * tot / tjPuncak));
  const wS = SUMBER.map(([, , v, p]) => v * PN[p](Math.floor(h))), sumS = wS.reduce((a, b) => a + b, 0);
  const pilihSumber = () => { let r = Math.random() * sumS; for (let i = 0; i < wS.length; i++) { r -= wS[i]; if (r <= 0) return i; } return 0; };
  const wSpot = SPOT.map((s) => (PROF_SPOT[s.j] || PROF_SPOT.plaza)(h) * (s.r + 6)), sumSp = wSpot.reduce((a, b) => a + b, 0);
  const pilihSpot = (jenis) => { let r = Math.random() * sumSp; for (let i = 0; i < SPOT.length; i++) { r -= wSpot[i]; if (r <= 0 && (!jenis || SPOT[i].j === jenis)) return SPOT[i]; } return SPOT.find((s) => !jenis || s.j === jenis) || SPOT[0]; };
  let i = 0;
  const nJalan = Math.round(N * .58), nGrup = Math.round(N * .26), nDuduk = Math.round(N * .1);
  for (; i < nJalan; i++) { const o = OR[i]; if (o.mode !== 'jalan') { o.mode = 'jalan'; o.p = PATHS[SUMBER_PATH[pilihSumber()]]; o.d = Math.random() * o.p.L; o.arah = Math.random() < .5 ? 1 : -1; } aAnim.setY(i, 1); aAnim.setZ(i, 0); aAnim.setW(i, 0); }
  while (i < nJalan + nGrup) { const sp = pilihSpot(), n = 2 + ((Math.random() * 4) | 0), a0 = Math.random() * 6.28, rr = Math.random() * sp.r, cx = sp.c[0] + Math.cos(a0) * rr, cz = sp.c[1] + Math.sin(a0) * rr;
    for (let k = 0; k < n && i < nJalan + nGrup; k++, i++) { const o = OR[i], a = a0 + k / n * 6.28, rad = .55 + n * .12; o.mode = 'grup'; o.x = cx + Math.cos(a) * rad * SKALA_ORANG; o.z = cz + Math.sin(a) * rad * SKALA_ORANG; o.rot = Math.atan2(cx - o.x, cz - o.z); aAnim.setY(i, 0); aAnim.setZ(i, 0); aAnim.setW(i, Math.random() < .5 ? 1 : 0); } }
  for (; i < nJalan + nGrup + nDuduk; i++) { const o = OR[i], sp = pilihSpot(Math.random() < .7 ? 'taman' : null), a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * sp.r; o.mode = 'duduk'; o.x = sp.c[0] + Math.cos(a) * r; o.z = sp.c[1] + Math.sin(a) * r; o.rot = Math.random() * 6.28; aAnim.setY(i, 0); aAnim.setZ(i, 1); aAnim.setW(i, 0); }
  const halte = D.transit;
  for (; i < N; i++) { const o = OR[i], t = halte[(Math.random() * halte.length) | 0]; o.mode = 'tunggu'; o.x = t.m[0] + (Math.random() - .5) * 9; o.z = t.m[1] + (Math.random() - .5) * 9; o.rot = Math.random() * 6.28; aAnim.setY(i, 0); aAnim.setZ(i, 0); aAnim.setW(i, Math.random() < .2 ? 1 : 0); }
  for (; i < NH; i++) OR[i].mode = 'off';
  aAnim.needsUpdate = true; orang.userData.n = N;
  for (let k = 0; k < NH; k++) if (OR[k].mode !== 'jalan' && OR[k].mode !== 'off') { pOrang.set(OR[k].x, .02, OR[k].z); qOrang.setFromAxisAngle(yAxis, OR[k].rot); mOrang.compose(pOrang, qOrang, sOrang); orang.setMatrixAt(k, mOrang); } else if (OR[k].mode === 'off') orang.setMatrixAt(k, nol);
  orang.instanceMatrix.needsUpdate = true;
}
const tjPuncak = Math.max(...Array.from({ length: 24 }, (_, h) => totalJam(h)));
function langkahAgen(dt) {
  const jamI = Math.floor(S.jam * 2); if (jamI !== jamOrang) { jamOrang = jamI; aturOrang(); }
  const lang = dt * S.kecepatan;
  for (let i = 0; i < NH; i++) {
    const o = OR[i]; if (o.mode !== 'jalan') continue;
    o.d += o.v * lang * o.arah;
    if (o.d < 0 || o.d > o.p.L) {
      // lanjut ke ruas yang tersambung di ujung, hindari putar balik bila ada pilihan
      const ujung = o.d < 0 ? o.p.pts[0] : o.p.pts[o.p.pts.length - 1], cabang = (UJUNG.get(kunci(...ujung)) || []).filter(([j]) => PATHS[j] !== o.p);
      if (cabang.length) { const [j, end] = cabang[(Math.random() * cabang.length) | 0]; o.p = PATHS[j]; o.arah = end ? -1 : 1; o.d = end ? o.p.L : 0; }
      else { o.arah *= -1; o.d = clamp(o.d, 0, o.p.L); }
    }
    const [x, z, dx, dz] = posPath(o.p, o.d, o.sisi);
    pOrang.set(x, .02, z); qOrang.setFromAxisAngle(yAxis, Math.atan2(dx * o.arah, dz * o.arah)); mOrang.compose(pOrang, qOrang, sOrang); orang.setMatrixAt(i, mOrang);
  }
  orang.instanceMatrix.needsUpdate = true;
}

// =============================================================
//  Kendaraan: mobil, sepeda motor, bus kota, bus TransJakarta (lajur kiri, arah oneway OSM)
// =============================================================
const RUTE = V4.rute.filter((r) => r.p.length >= 4).map((r) => { const pts = [], kls = r.c || ''; for (let k = 0; k < r.p.length; k += 2) pts.push([r.p[k], r.p[k + 1]]); const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, L: cum[cum.length - 1], k: r.k, t: r.t, kls }; });
const RUTE_UMUM = RUTE.filter((r) => r.k === 'umum'), RUTE_TJ = RUTE.filter((r) => r.k === 'tj'), RUTE_TERM = RUTE_UMUM.filter((r) => r.t);
const JENIS_K = {
  mobil: { n: LITE ? 110 : 220, ukur: [1.8, 1.45, 4.4], v: 1, warna: ['#E9ECEF', '#2B2F36', '#9AA3AD', '#C0392B', '#2F5D8A', '#F2F2F2', '#556070', '#B9A88C'] },
  motor: { n: LITE ? 150 : 320, ukur: [.75, 1.55, 1.95], v: 1.1, warna: ['#1F232A', '#C0392B', '#2F5D8A', '#E9ECEF', '#3D7D4F'] },
  bus: { n: 22, ukur: [2.5, 3.2, 12], v: .8, warna: ['#E46B3C', '#F2F2F2', '#3B8F6A'] },
  tj: { n: 18, ukur: [2.55, 3.35, 12], v: .9, warna: ['#2459C8', '#2F6BD8'] },
};
const lalin = (h) => .12 + .55 * g2(h, 7.6, 1.2) + .35 * g2(h, 12.5, 2.2) + .62 * g2(h, 17.9, 1.5) + .38 * g2(h, 20.6, 1.6) - .1 * g2(h, 2.5, 1.6);
const lalinMaks = Math.max(...Array.from({ length: 48 }, (_, k) => lalin(k / 2)));
const KEND = {};
for (const [jenis, J] of Object.entries(JENIS_K)) {
  let geo;
  if (jenis === 'motor') { geo = new THREE.BoxGeometry(.5, .75, 1.9); geo.translate(0, .55, 0); const r = new THREE.BoxGeometry(.45, .7, .4); r.translate(0, 1.2, -.1); geo = mergeKotak([geo, r]); }
  else if (jenis === 'mobil') { const b = new THREE.BoxGeometry(1.8, .8, 4.4); b.translate(0, .55, 0); const k = new THREE.BoxGeometry(1.6, .6, 2.3); k.translate(0, 1.2, -.2); geo = mergeKotak([b, k]); }
  else { geo = new THREE.BoxGeometry(J.ukur[0], J.ukur[1], J.ukur[2]); geo.translate(0, J.ukur[1] / 2 + .3, 0); }
  const mat = new THREE.MeshStandardMaterial({ roughness: .45, metalness: .1 });
  const im = new THREE.InstancedMesh(geo, mat, J.n); im.castShadow = jenis !== 'motor'; im.frustumCulled = false; scene.add(im);
  const c = new THREE.Color(); for (let i = 0; i < J.n; i++) { im.setColorAt(i, c.set(J.warna[i % J.warna.length])); im.setMatrixAt(i, nol); }
  KEND[jenis] = { im, J, list: Array.from({ length: J.n }, () => ({ aktif: false, r: null, d: 0, lajur: 0, v: 0 })) };
}
function mergeKotak(gs) { const out = new THREE.BufferGeometry(), pos = [], nor = []; gs.forEach((g) => { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); }); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return out; }
// lampu depan & belakang (terlihat malam, ikut bloom)
const NL = Object.values(KEND).reduce((s, k) => s + k.J.n, 0);
const lampuGeo = new THREE.BufferGeometry(), lampuPos = new Float32Array(NL * 6), lampuCol = new Float32Array(NL * 6);
lampuGeo.setAttribute('position', new THREE.BufferAttribute(lampuPos, 3)); lampuGeo.setAttribute('color', new THREE.BufferAttribute(lampuCol, 3));
const lampu = new THREE.Points(lampuGeo, new THREE.PointsMaterial({ size: 3.2, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#fff'); g.addColorStop(.4, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })(), vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
lampu.frustumCulled = false; scene.add(lampu);
const mK = new THREE.Matrix4(), qK = new THREE.Quaternion(), pK = new THREE.Vector3(), sK = new THREE.Vector3(1, 1, 1);
const sibuk = (h) => ((h >= 6.8 && h < 9.3) || (h >= 16.5 && h < 19.8)) ? .42 : (h >= 22 || h < 5) ? 1.15 : .8;
// kelas per titik rute: 0 arteri, 1 kolektor, 2 tersier, 3 lokal/servis bernama, 4 busway, 5 servis terminal
const LAJUR = [[1.8, 3.2], [1.7, 3.0], [1.6, 0], [1.25, 0], [1.6, 0], [1.4, 0]], KEC_KELAS = [1, .9, .75, .55, 1, .4];
const LALIN = { orang: 0, mobil: 0, motor: 0, bus: 0 };
function langkahKendaraan(dt) {
  const h = S.jam % 24, frak = clamp(lalin(h) / lalinMaks), lang = dt * S.kecepatan, kec = sibuk(h); let L = 0;
  for (const [jenis, K] of Object.entries(KEND)) {
    // bus & TransJakarta: lebih rapat di jam sibuk (headway pendek), jarang di luar jam operasi
    const fBus = h >= 5 && h < 23 ? clamp(.35 + .65 * frak) : .08;
    const target = Math.round(K.J.n * KUAL.kend * (jenis === 'tj' || jenis === 'bus' ? fBus : frak));
    K.aktifN = S.kendaraan ? target : 0;
    K.list.forEach((v, i) => {
      if (i >= target || !S.kendaraan) { if (v.aktif) { v.aktif = false; K.im.setMatrixAt(i, nol); } return; }
      if (!v.aktif || v.d > v.r.L) {
        const pool = jenis === 'tj' ? RUTE_TJ : jenis === 'bus' && RUTE_TERM.length && Math.random() < .6 ? RUTE_TERM : RUTE_UMUM;
        v.r = pool[(Math.random() * pool.length) | 0]; v.d = v.aktif ? 0 : Math.random() * v.r.L; v.aktif = true;
        v.lajurKe = Math.random() < .5 ? 0 : 1; v.motor = jenis === 'motor' ? .5 + Math.random() * 1.2 : 0; v.v = (8 + Math.random() * 4) * K.J.v;
      }
      const p = v.r; let j = 1; while (j < p.cum.length - 1 && p.cum[j] < v.d) j++;
      const kl = +(p.kls[j] || 3), LJ = LAJUR[kl] || LAJUR[3]; v.lajur = LJ[0] + v.lajurKe * LJ[1] + v.motor * (kl <= 1 ? 1 : .4);
      v.d += v.v * kec * KEC_KELAS[kl] * lang;
      const a = p.pts[j - 1], b = p.pts[j], l = (p.cum[j] - p.cum[j - 1]) || 1, u = clamp((v.d - p.cum[j - 1]) / l), dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
      // lalu lintas Indonesia di lajur kiri: geser ke kiri arah jalan
      const x = lerp(a[0], b[0], u) + dz * v.lajur, z = lerp(a[1], b[1], u) - dx * v.lajur;
      pK.set(x, 0, z); qK.setFromAxisAngle(yAxis, Math.atan2(dx, dz)); mK.compose(pK, qK, sK); K.im.setMatrixAt(i, mK);
      if (U.uNight.value > .15) { const hl = K.J.ukur[2] / 2; lampuPos.set([x + dx * hl, .9, z + dz * hl, x - dx * hl, .9, z - dz * hl], L * 6); lampuCol.set([1, .95, .82, 1, .18, .12], L * 6); L++; }
    });
    K.im.instanceMatrix.needsUpdate = true;
  }
  LALIN.mobil = KEND.mobil.aktifN; LALIN.motor = KEND.motor.aktifN; LALIN.bus = KEND.bus.aktifN + KEND.tj.aktifN;
  lampuGeo.setDrawRange(0, L * 2); lampu.material.opacity = clamp(U.uNight.value * 1.3); lampuGeo.attributes.position.needsUpdate = lampuGeo.attributes.color.needsUpdate = true;
}

// =============================================================
//  v3: jaringan jalan OSM (isokron nyata), blok Spacematrix, simpang
// =============================================================
const JUM = { uR: { value: 0 }, uMode: { value: 0 } };
const LEBAR = [11, 9, 7.5, 5.5, 4, 3.2];
const jarGeo = (() => {
  const pos = [], dd = [], cl = [], aa = [];
  O.seg.forEach((g, gi) => {
    const p = g.p, n = p.length / 2; if (n < 2) return; const akt = V4.aktif[gi] || 0;
    const cum = [0]; for (let k = 1; k < n; k++) cum.push(cum[k - 1] + Math.hypot(p[2 * k] - p[2 * k - 2], p[2 * k + 1] - p[2 * k - 1]));
    const L = cum[n - 1], w = LEBAR[g.c] / 2, dAt = (t) => Math.min(g.d[0] + t, g.d[1] + (L - t));
    for (let k = 0; k < n - 1; k++) {
      const x0 = p[2 * k], z0 = p[2 * k + 1], x1 = p[2 * k + 2], z1 = p[2 * k + 3], l = Math.hypot(x1 - x0, z1 - z0) || 1;
      const nx = -(z1 - z0) / l * w, nz = (x1 - x0) / l * w, a = dAt(cum[k]), b = dAt(cum[k + 1]);
      const q = [[x0 + nx, z0 + nz, a], [x0 - nx, z0 - nz, a], [x1 + nx, z1 + nz, b], [x1 - nx, z1 - nz, b]];
      for (const i of [0, 1, 2, 2, 1, 3]) { pos.push(q[i][0], .75 + g.c * .01, q[i][1]); dd.push(q[i][2]); cl.push(g.c); aa.push(akt); }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aD', new THREE.Float32BufferAttribute(dd, 1)); geo.setAttribute('aC', new THREE.Float32BufferAttribute(cl, 1)); geo.setAttribute('aA', new THREE.Float32BufferAttribute(aa, 1));
  return geo;
})();
const jarMat = new THREE.ShaderMaterial({
  uniforms: { ...JUM, uNight: U.uNight, uTime: U.uTime }, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  vertexShader: 'attribute float aD; attribute float aC; attribute float aA; varying float vD; varying float vC; varying float vA; void main(){ vD = aD; vC = aC; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uR; uniform float uMode; uniform float uNight; uniform float uTime; varying float vD; varying float vC; varying float vA;
    vec3 ramp(float m){ vec3 a = vec3(.05,.55,.36), b = vec3(.95,.78,.2), c = vec3(.86,.27,.17), d = vec3(.45,.2,.42);
      return m < 5. ? mix(a, b, m / 5.) : m < 10. ? mix(b, c, (m - 5.) / 5.) : mix(c, d, clamp((m - 10.) / 10., 0., 1.)); }
    void main(){
      float m = vD / 80.0; vec3 col = ramp(m);
      if (uMode > .5 && uMode < 1.5) col = vC < .5 ? vec3(.84,.27,.2) : vC < 1.5 ? vec3(.92,.55,.18) : vC < 2.5 ? vec3(.93,.75,.25) : vC < 3.5 ? vec3(.55,.55,.6) : vC < 4.5 ? vec3(.7,.7,.72) : vec3(.12,.6,.42);
      float on = uMode > .5 ? 1. : step(vD, uR);
      float front = uMode > .5 ? 0. : smoothstep(40., 0., uR - vD) * on;
      float pulse = uMode > .5 ? 0. : .18 * sin(vD * .06 - uTime * 3.0) * on;
      float a = mix(.1, .92, on);
      if (vD > 9000. && uMode < .5) { col = vec3(.5); a = .25; }
      if (uMode > 1.5) { col = mix(vec3(.45,.5,.58), vec3(.98,.47,.68), vA); a = mix(.32, .96, vA); pulse = .14 * vA * sin(uTime * 2.2 + vD * .015); }
      gl_FragColor = vec4(col * (1.0 + pulse) + front * vec3(1.6, 1.5, 1.2), a + front * .08);
    }`,
});
const jarMesh = new THREE.Mesh(jarGeo, jarMat); jarMesh.visible = false; jarMesh.renderOrder = 3; scene.add(jarMesh);
let jarT0 = 0;

const TIPE_COL = { 'Tinggi': '#7A2E8E', 'Menengah padat': '#D9573A', 'Menengah renggang': '#E79A54', 'Rendah padat': '#C99A1E', 'Rendah renggang': '#E6CF84', 'Ruang terbuka': '#3F9A5E' };
const kelCol = (k) => k < 250 ? '#1F9A62' : k < 400 ? '#E0A21F' : '#C2441F';
const blokGrp = new THREE.Group(); blokGrp.visible = false; scene.add(blokGrp);
O.blok.forEach((b, k) => {
  const sh = new THREE.Shape(); for (let i = 0; i < b.p.length; i += 2) { const x = b.p[i], y = -b.p[i + 1]; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#888', transparent: true, opacity: .55, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  m.position.y = .55; m.renderOrder = 2;
  const pts = []; for (let i = 0; i < b.p.length; i += 2) pts.push(new THREE.Vector3(b.p[i], 1.2, b.p[i + 1])); pts.push(pts[0].clone());
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1F1F1F', transparent: true, opacity: .55, toneMapped: false }));
  const grp = new THREE.Group(); grp.add(m, ln); grp.userData = { k, cx: avg(b.p.filter((_, i) => i % 2 === 0)), cz: avg(b.p.filter((_, i) => i % 2 === 1)) }; blokGrp.add(grp);
});
function warnaiBlok(mode) {
  blokGrp.children.forEach((g) => { const b = O.blok[g.userData.k], c = mode === 'tod' ? (b.n ? kelCol(b.kel) : '#9A948C') : TIPE_COL[b.t]; g.children[0].material.color.set(c); g.children[0].material.opacity = mode === 'tod' && !b.n ? .18 : .55; });
}
function sorotBlok(k) {
  blokGrp.children.forEach((g) => { const on = g.userData.k === k; g.children[1].material.opacity = on ? 1 : .55; g.children[1].material.color.set(on ? '#000' : '#1F1F1F'); g.children[0].material.opacity = k == null || on ? .62 : .25; });
}
const simpang = new THREE.InstancedMesh(new THREE.CylinderGeometry(3.2, 3.2, 1.6, 18), new THREE.MeshBasicMaterial({ color: '#13806E', toneMapped: false }), OS.simpang.length);
OS.simpang.forEach(([x, z], i) => simpang.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 1.6, z)));
simpang.visible = false; scene.add(simpang);
const halte = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.4, 2.4, 5, 12), new THREE.MeshBasicMaterial({ color: '#2F6BD8', toneMapped: false }), D.transit.length);
D.transit.forEach((t, i) => halte.setMatrixAt(i, new THREE.Matrix4().makeTranslation(t.m[0], 2.5, t.m[1])));
halte.visible = false; scene.add(halte);

// =============================================================
//  Selubung intensitas (KLB izin) per blok
// =============================================================
const BLOK = V.blok;
const selubung = new THREE.Group(); selubung.visible = false; scene.add(selubung);
const envMat = new THREE.MeshStandardMaterial({ color: '#C2441F', transparent: true, opacity: .2, depthWrite: false, roughness: .4, emissive: '#C2441F', emissiveIntensity: .15 });
const envLine = new THREE.LineBasicMaterial({ color: '#C2441F', transparent: true, opacity: .8, toneMapped: false });
BLOK.forEach((bl, k) => {
  const cx = avg(bl.p.filter((_, i) => i % 2 === 0)), cz = avg(bl.p.filter((_, i) => i % 2 === 1)), sc = Math.sqrt(bl.kdb);
  const s = new THREE.Shape(); for (let i = 0; i < bl.p.length; i += 2) { const x = cx + (bl.p[i] - cx) * sc, y = -(cz + (bl.p[i + 1] - cz) * sc); i ? s.lineTo(x, y) : s.moveTo(x, y); }
  const g = new THREE.ExtrudeGeometry(s, { depth: bl.h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, envMat), new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), envLine)); grp.userData = { k, cx, cz }; grp.scale.y = .001; selubung.add(grp);
});
function setPemanfaatan(pct) {
  S.klbPakai = pct;
  selubung.children.forEach((g) => anime({ targets: g.scale, y: Math.max(.001, pct / 100), duration: 700, easing: 'easeOutCubic' }));
}

// =============================================================
//  Lapisan tanah per lensa
// =============================================================
let isoR = 0, isoT0 = 0;
function gambarOverlay() {
  const d = oimg.data, n = GW * GH, L = LENSA[S.lapis].overlay === 'variety' ? S.varMode : LENSA[S.lapis].overlay, rad = radiasi(S.jam), Ur = S.uref * .78, f = WF[S.arah];
  for (let i = 0; i < n; i++) {
    let c = null, a = 0; const lu = GR.lu[i];
    switch (L) {
      case 'akses': { const m = val.akses(i); c = F.akses(Math.floor(m / 2.5) * 2.5 / 15 + .04); a = .72; break; }
      case 'walk': { const iso = val.iso(i); if (iso <= isoR) { c = iso <= 400 ? [.13, .5, .34] : [.49, .77, .61]; a = .68; if (isoR - iso < 10) { c = [.05, .31, .19]; a = 1; } } else { c = [.6, .58, .55]; a = .22; } break; }
      case 'lu': if (LU_COL[lu]) { c = hexRGB(LU_COL[lu]); a = .55; } break;
      case 'mix': c = F.mix(val.mix(i)); a = .75; break;
      case 'termal': { const h = val.panas(i); c = F.panas(h * (.25 + .75 * rad) + (1 - rad) * .12); a = .72; break; }
      case 'angin': { const [x, z] = cellXZ(i); const w = anginDi(x, z, f); if (w && !w[2]) { c = F.angin(Math.hypot(w[0], w[1]) * Ur / 4); a = .5; } break; }
      case 'bising': { const v = val.bising(i); if (v === v) { c = F.bising((v - 45) / 35); a = .78; } break; }
      case 'fas': c = F.fas(val.fas(i) / 8); a = .72; break;
      case 'rth': { const v = val.rth(i); if (v === v) { c = F.rth(v / 600); a = .72; } if (lu === 6) { c = [.12, .48, .28]; a = .85; } break; }
    }
    const j = i * 4;
    if (c) { const fade = S.fokus && !GR.dalam[i] ? .35 : 1; d[j] = c[0] * 255; d[j + 1] = c[1] * 255; d[j + 2] = c[2] * 255; d[j + 3] = a * 255 * fade; } else d[j + 3] = 0;
  }
  octx.putImageData(oimg, 0, 0); ovTex.needsUpdate = true;
}
function nilaiProbe(i) {
  const L = rep3d(), lu = GR.lu[i], fungsi = LU_NAMA[lu] || 'Jalan';
  const zona = GR.dalam[i] ? 'kawasan inti' : 'luar kawasan inti';
  const head = `<span class="tg">${fungsi} · ${zona}</span><br>`;
  switch (L) {
    case 'akses': return head + `<b>${nf(val.akses(i), 1)} menit</b> jalan ke transit`;
    case 'walk': return head + `<b>${nf(val.iso(i), 0)} m</b> (${nf(val.iso(i) / 80, 0)} menit) jalan dari MRT Blok M`;
    case 'variety': return head + `Indeks campuran <b>${nf(val.mix(i), 2)}</b>`;
    case 'termal': { const h = val.panas(i); return head + `Indeks panas <b>${nf(h * 100, 0)}/100</b> · rasa ≈${nf(suhuUdara(S.jam) + radiasi(S.jam) * (h * 9 - 1.5), 1)} °C`; }
    case 'angin': { const [x, z] = cellXZ(i); const w = anginDi(x, z, WF[S.arah]); return head + (w && !w[2] ? `<b>${nf(Math.hypot(w[0], w[1]) * S.uref * .78, 2)} m/s</b> di level pejalan` : 'Di dalam bangunan'); }
    case 'bising': { const v = val.bising(i), bk = ({ 3: 55, 5: 60, 6: 50, 8: 55 })[lu] || 70; return head + (v === v ? `<b>≈${nf(v, 0)} dB(A)</b> siang · baku ${bk} ${v > bk ? '(melewati)' : '✓'}` : 'Di dalam bangunan'); }
    case 'fasilitas': return head + `<b>${val.fas(i)} dari ${VS.n_kat}</b> jenis fasilitas ≤10 menit`;
    case 'rth': { const v = val.rth(i); return head + `<b>${nf(v, 0)} m</b> jalan ke ruang hijau ${v <= 300 ? '✓' : '(> 300 m)'}`; }
    default: return head + `${nf(val.akses(i), 1)} mnt ke transit · bising ≈${nf(val.bising(i) || 0, 0)} dB`;
  }
}


// =============================================================
//  Place Diagram (Project for Public Spaces): 4 atribut kunci, kualitas tak berwujud, pengukuran
// =============================================================
const ATR = {
  akses: { nama: 'Akses & Keterhubungan', pendek: 'Akses', en: 'Access & Linkages', tanya: 'Apakah tempat mudah dicapai, terhubung dengan sekitarnya, dan nyaman dijalani?',
    intang: ['Kontinuitas', 'Kedekatan', 'Terhubung', 'Mudah dibaca', 'Bisa dijalani', 'Praktis', 'Mudah diakses'], ukur: ['Data lalu lintas', 'Pembagian moda', 'Penggunaan transit', 'Aktivitas pejalan kaki', 'Pola penggunaan parkir'] },
  nyaman: { nama: 'Kenyamanan & Citra', pendek: 'Nyaman', en: 'Comfort & Image', tanya: 'Apakah tempat terasa nyaman, aman, bersih, dan berkesan baik?',
    intang: ['Aman', 'Menawan', 'Bersejarah', 'Atraktif', 'Spiritual', 'Bisa diduduki', 'Bisa dijalani', 'Hijau', 'Bersih'], ukur: ['Statistik kriminalitas', 'Tingkat kebersihan', 'Kondisi bangunan', 'Data lingkungan'] },
  guna: { nama: 'Kegunaan & Aktivitas', pendek: 'Guna', en: 'Uses & Activities', tanya: 'Adakah alasan untuk datang, berlama-lama, dan kembali lagi?',
    intang: ['Menyenangkan', 'Aktif', 'Vital', 'Khas', 'Nyata', 'Bermanfaat', 'Lokal', 'Merayakan', 'Berkelanjutan'], ukur: ['Nilai properti', 'Tingkat sewa', 'Pola guna lahan', 'Penjualan ritel', 'Kepemilikan usaha lokal'] },
  sosial: { nama: 'Sosiabilitas', pendek: 'Sosial', en: 'Sociability', tanya: 'Apakah orang bertemu, berinteraksi, dan merasa memiliki tempat ini?',
    intang: ['Beragam', 'Peduli', 'Kooperatif', 'Bertetangga', 'Bangga', 'Ramah', 'Interaktif', 'Menyambut'], ukur: ['Jumlah perempuan, anak & lansia', 'Jejaring sosial', 'Kerelawanan', 'Penggunaan malam', 'Kehidupan jalan'] },
};
const WARNA_ATR = { gelap: { akses: '#72AEFF', nyaman: '#52D69E', guna: '#F6BC5C', sosial: '#F384AE', ringkasan: '#3DD6C0' }, terang: { akses: '#3B82E6', nyaman: '#16A870', guna: '#D9931A', sosial: '#D9497F', ringkasan: '#0E9F8A' } };
const warnaAtr = (k) => WARNA_ATR[S.tema][k] || WARNA_ATR[S.tema].ringkasan;
const PPS = {};
function hitungPPS() {
  const sk = (v, acuan) => Math.round(clamp(v / acuan) * 100);
  // keragaman POI (Shannon, 6 kategori) di kawasan inti
  const n = [0, 0, 0, 0, 0, 0]; D.poi.forEach((p) => { if (dalamPoligon(p[0], p[1])) n[p[2]]++; }); const tN = n.reduce((a, b) => a + b, 0);
  const H = -n.filter((x) => x).reduce((a, x) => a + x / tN * Math.log(x / tN), 0) / Math.log(6);
  const jam = Array.from({ length: 24 }, (_, h) => totalJam(h)), mx = Math.max(...jam), tot = jam.reduce((a, b) => a + b, 0);
  const sepanjang = 100 * jam.slice(6, 24).filter((v) => v >= mx * .25).length / 18, malam = 100 * jam.slice(18, 24).reduce((a, b) => a + b, 0) / tot;
  const kunjHa = 80000 / VS.luas_ha, ketiga = (VS.fas5.kuliner + VS.fas5['ruang hijau']) / 2;
  const t = LIT.tod;
  PPS.ind = {
    akses: [
      { n: 'Kawasan ≤ 5 menit ke angkutan massal', v: VS.akses5, u: '%', s: sk(VS.akses5, 100), acuan: 'Acuan 100%: setiap titik dekat MRT, BRT atau terminal (ITDP)', lensa: 'akses', ukur: 'Penggunaan transit', j: 'ukur' },
      { n: 'Pedshed 800 m dari MRT', v: OS.pedshed800, u: '%', s: sk(OS.pedshed800, 70), acuan: 'Skor = nilai ÷ 70% (ambang "baik", Porta & Renne 2005)', lensa: 'walk', ukur: 'Aktivitas pejalan kaki', j: 'ukur' },
      { n: 'Jalur pedestrian layak', v: avg(t.jalurPed), u: '%', s: sk(avg(t.jalurPed), 80), acuan: 'Audit 3 blok TOD (Gifarry dkk. 2022), standar 80%', lensa: 'walk', ukur: 'Aktivitas pejalan kaki', j: 'audit' },
      { n: 'Penyeberangan layak', v: avg(t.penyeberangan), u: '%', s: sk(avg(t.penyeberangan), 90), acuan: 'Audit 3 blok TOD, standar 90%', lensa: 'walk', ukur: 'Data lalu lintas', j: 'audit' },
      { n: 'Kepadatan persimpangan', v: OS.dens_simpang, u: '/km²', s: sk(OS.dens_simpang, 120), acuan: 'ITDP TOD Standard: ≥ 120 persimpangan/km²', lensa: 'tod', ukur: 'Kontinuitas (tambahan)', j: 'ukur' },
      { n: 'Blok berkeliling < 400 m', v: OS.blok400, u: '%', s: sk(OS.blok400, 90), acuan: 'ITDP: ≥ 90% blok', lensa: 'tod', ukur: 'Kontinuitas (tambahan)', j: 'ukur' },
    ],
    nyaman: [
      { n: 'Jalur berpeneduh', v: avg(t.peneduh), u: '%', s: sk(avg(t.peneduh), 75), acuan: 'Audit 3 blok TOD, standar 75%', lensa: 'termal', ukur: 'Data lingkungan', j: 'audit' },
      { n: 'Area tanpa indeks panas tinggi', v: 100 - VS.panas_tinggi, u: '%', s: sk(100 - VS.panas_tinggi, 100), acuan: 'Estimasi dari vegetasi & permukaan kedap', lensa: 'termal', ukur: 'Data lingkungan', j: 'model' },
      { n: 'Jalur angin nyaman (monsun barat)', v: SK.angin, u: '%', s: sk(SK.angin, 100), acuan: 'Kecepatan 0,3 sampai 4 m/s di level pejalan (CFD 2D)', lensa: 'angin', ukur: 'Data lingkungan', j: 'model' },
      { n: 'Ruang luar ≤ 70 dB(A)', v: 100 - VS.bising_70, u: '%', s: sk(100 - VS.bising_70, 100), acuan: 'Baku mutu perdagangan & jasa 70 dB(A), KepMenLH 48/1996', lensa: 'bising', ukur: 'Data lingkungan', j: 'model' },
      { n: 'Bangunan ≤ 300 m dari ruang hijau', v: VS.rth300, u: '%', s: sk(VS.rth300, 100), acuan: 'WHO Urban Green Spaces (2016)', lensa: 'rth', ukur: 'Data lingkungan', j: 'ukur' },
      { n: 'Porsi ruang hijau', v: VS.lu['Ruang hijau'], u: '%', s: sk(VS.lu['Ruang hijau'], 30), acuan: 'UU 26/2007: RTH 30% wilayah kota', lensa: 'rth', ukur: 'Data lingkungan', j: 'ukur' },
    ],
    guna: [
      { n: 'Indeks campuran guna lahan', v: VS.mix_rata * 100, u: '/100', s: sk(VS.mix_rata, 1), acuan: 'Entropi Shannon 5 fungsi, radius 150 m', lensa: 'variety', ukur: 'Pola guna lahan', j: 'ukur' },
      { n: 'Keragaman jenis usaha (POI)', v: H * 100, u: '/100', s: sk(H, 1), acuan: `Entropi ${tN} POI OSM dalam 6 kategori`, lensa: 'variety', ukur: 'Penjualan ritel (proksi)', j: 'ukur' },
      { n: 'Hunian dalam campuran', v: VS.lu['Hunian'], u: '%', s: sk(VS.lu['Hunian'], 15), acuan: 'Standar keragaman hunian 15 sampai 85% (audit TOD)', lensa: 'variety', ukur: 'Pola guna lahan', j: 'ukur' },
      { n: 'Area ≥ 7 dari 8 fasilitas ≤ 10 menit', v: VS.fas_lengkap, u: '%', s: sk(VS.fas_lengkap, 100), acuan: 'Konsep kota 10 menit (800 m jalan kaki)', lensa: 'fasilitas', ukur: 'Pola guna lahan', j: 'ukur' },
      { n: 'Hidup sepanjang hari', v: sepanjang, u: '% jam', s: sk(sepanjang, 100), acuan: 'Jam 06.00 sampai 24.00 dengan kunjungan ≥ 25% puncak (model)', lensa: 'sosial', ukur: 'Penggunaan sepanjang hari', j: 'model' },
    ],
    sosial: [
      { n: 'Muka aktif jalan', v: V4.muka, u: '%', s: sk(V4.muka, 100), acuan: 'Panjang jalan berbatasan toko/jasa ≤ 22 m atau bangunan komersial', lensa: 'muka', ukur: 'Kehidupan jalan', j: 'ukur' },
      { n: 'Kunjungan malam (18.00 sampai 24.00)', v: malam, u: '%', s: sk(malam, 35), acuan: 'Porsi kunjungan harian; skor penuh pada 35% (asumsi studi)', lensa: 'sosial', ukur: 'Penggunaan malam', j: 'model' },
      { n: 'Tempat berkumpul ≤ 5 menit', v: ketiga, u: '%', s: sk(ketiga, 100), acuan: 'Area dekat kuliner dan taman (tempat ketiga)', lensa: 'fasilitas', ukur: 'Jejaring sosial (proksi)', j: 'ukur' },
      { n: 'Kepadatan kunjungan', v: kunjHa, u: '/ha/hari', s: sk(kunjHa, 250), acuan: 'ITDP 6.2: ≥ 25.000 orang/km² (250/ha)', lensa: 'sosial', ukur: 'Kehidupan jalan', j: 'model' },
    ],
  };
  for (const k in ATR) { const L = PPS.ind[k]; PPS[k] = { skor: Math.round(avg(L.map((x) => x.s))), n: L.length }; }
  PPS.total = Math.round(avg(Object.keys(ATR).map((k) => PPS[k].skor)));
  PPS.ahp = { akses: Math.round((SK.akses * W_AHP.akses + SK.walk * W_AHP.walk) / (W_AHP.akses + W_AHP.walk)), nyaman: SK.termal, guna: SK.variety, sosial: null };
  PPS.malam = malam; PPS.sepanjang = sepanjang;
}
hitungPPS();

// =============================================================
//  Konfigurasi lensa
// =============================================================
const IK = {
  pakses: '<path d="M4 18l5-5 4 3 7-8"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="8" r="1.6"/>',
  pnyaman: '<path d="M12 21c-4-2.5-7-6-7-10a7 7 0 0 1 14 0c0 4-3 7.5-7 10z"/><path d="M9 11l2 2 4-4"/>',
  pguna: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10"/>',
  psosial: '<circle cx="8" cy="9" r="2.6"/><circle cx="16" cy="9" r="2.6"/><path d="M3.5 19c.6-2.8 2.4-4.3 4.5-4.3s3.9 1.5 4.5 4.3M11.5 19c.6-2.8 2.4-4.3 4.5-4.3s3.9 1.5 4.5 4.3"/>',
  muka: '<path d="M3 20h18M4 20V9l4-3 4 3v11M12 20V11h8v9"/><path d="M6 13h2M15 14h2M15 17h2"/>',
  ringkasan: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  akses: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/>',
  walk: '<circle cx="13" cy="4" r="1.6"/><path d="M10 21l2-6-3-3 1.5-5 3.5 3 3 1M8 10l2-3"/>',
  variety: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  termal: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  angin: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  sosial: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 6 2 6 5"/>',
  bising: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  svf: '<path d="M3 20V10l4-2v12M10 20V5l4-2v17M17 20v-8l4-2v10M2 20h20"/>',
  fasilitas: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rth: '<path d="M12 22v-6M7 16h10l-5-13z"/>',
  surya: '<path d="M3 18l3-10h12l3 10zM5 13h14M10 8l-1 10M14 8l1 10M12 2v3"/>',
  intensitas: '<path d="M4 21V9l5-3v15M9 21V3l6 3v15M15 21v-9l5 2v7M2 21h20"/>',
  jaringan: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="12" cy="10" r="1.6"/><path d="M6.6 7.2l4 2M17.4 7.2l-4 2M12 11.6V16"/>',
  morfologi: '<path d="M3 21h18M5 21V11h4v10M10 21V6h4v15M15 21v-7h4v7"/><path d="M3 3l18 0" stroke-dasharray="2 2"/>',
  tod: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M14 17h6M17 14v6"/>',
};
const LENSA = {
  ringkasan: { nama: 'Ringkasan', sub: 'Place Diagram & skor AHP', grup: 'ringkasan', bangunan: 'fungsi', overlay: null, skor: () => PPS.total },
  pakses: { nama: 'Akses & Keterhubungan', sub: 'ringkasan atribut', grup: 'akses', induk: true, tiru: 'akses', bangunan: 'netral', overlay: 'akses', skor: () => PPS.akses.skor },
  akses: { nama: 'Akses transit', sub: 'menit ke MRT, BRT, terminal', grup: 'akses', bangunan: 'netral', overlay: 'akses', skor: () => SK.akses },
  walk: { nama: 'Walkability', sub: 'isokron jaringan jalan nyata', grup: 'akses', bangunan: 'putih', overlay: null, skor: () => SK.walk },
  tod: { nama: 'Konektivitas blok', sub: 'indikator ITDP terukur', grup: 'akses', bangunan: 'netral', overlay: null, skor: () => SK.tod },
  pnyaman: { nama: 'Kenyamanan & Citra', sub: 'ringkasan atribut', grup: 'nyaman', induk: true, tiru: 'termal', bangunan: 'putih', overlay: 'termal', skor: () => PPS.nyaman.skor },
  termal: { nama: 'Termal & bayangan', sub: 'matahari aktual', grup: 'nyaman', bangunan: 'putih', overlay: 'termal', skor: () => SK.termal },
  angin: { nama: 'Angin', sub: 'CFD Lattice-Boltzmann', grup: 'nyaman', bangunan: 'putih', overlay: 'angin', skor: () => SK.angin },
  bising: { nama: 'Kebisingan', sub: 'jalan, busway, terminal', grup: 'nyaman', bangunan: 'netral', overlay: 'bising', skor: () => SK.akustik },
  rth: { nama: 'Ruang hijau 300 m', sub: 'akses taman', grup: 'nyaman', bangunan: 'netral', overlay: 'rth', skor: () => SK.rth },
  pguna: { nama: 'Kegunaan & Aktivitas', sub: 'ringkasan atribut', grup: 'guna', induk: true, tiru: 'variety', bangunan: 'fungsi', overlay: 'variety', skor: () => PPS.guna.skor },
  variety: { nama: 'Keragaman fungsi', sub: 'campuran guna lahan', grup: 'guna', bangunan: 'fungsi', overlay: 'variety', skor: () => SK.variety },
  fasilitas: { nama: 'Kota 10 menit', sub: 'kelengkapan fasilitas', grup: 'guna', bangunan: 'netral', overlay: 'fas', skor: () => SK.fasilitas },
  morfologi: { nama: 'Bentuk & kepadatan', sub: 'Spacematrix GSI × FSI', grup: 'guna', bangunan: 'tinggi', overlay: null, skor: () => nf(OS.fsi, 1) },
  psosial: { nama: 'Sosiabilitas', sub: 'ringkasan atribut', grup: 'sosial', induk: true, tiru: 'sosial', bangunan: 'netral', overlay: null, skor: () => PPS.sosial.skor },
  sosial: { nama: 'Keramaian per jam', sub: 'model kunjungan terkalibrasi', grup: 'sosial', bangunan: 'netral', overlay: null, skor: () => '80k' },
  muka: { nama: 'Muka aktif jalan', sub: 'kehidupan jalan', grup: 'sosial', bangunan: 'fungsi', overlay: null, skor: () => Math.round(V4.muka) },
};
const INDUK = { ringkasan: 'ringkasan', akses: 'pakses', nyaman: 'pnyaman', guna: 'pguna', sosial: 'psosial' };
const rep3d = (id = S.lapis) => LENSA[id].tiru || id;
function warnaiLensa() { for (const id in LENSA) LENSA[id].warna = warnaAtr(LENSA[id].grup); }
warnaiLensa();
SK.akustik = Math.round(100 - VS.fasad_lewat);

// =============================================================
//  ECharts
// =============================================================
const charts = [];
function tema() { charts.forEach((c) => { const o = c.getOption && c.__opt; if (o) c.setOption(gayaChart(o), true); }); }
function warnaTeks() { return S.tema === 'gelap' ? '#C3CCD7' : '#3D4958'; }
function gayaChart(opt) {
  const t = warnaTeks(), g = S.tema === 'gelap' ? 'rgba(255,255,255,.07)' : '#E6EAF0', F_ = "'Plus Jakarta Sans',system-ui,sans-serif";
  const ax = (a) => a && [].concat(a).map((x) => ({ axisLine: { lineStyle: { color: g } }, axisTick: { show: false }, splitLine: { lineStyle: { color: g } }, ...x, axisLabel: { color: t, fontFamily: F_, fontWeight: 600, fontSize: 10.5, ...(x.axisLabel || {}) }, nameTextStyle: { color: t, fontFamily: F_, fontWeight: 700, fontSize: 10.5, ...(x.nameTextStyle || {}) } }));
  return { animationDuration: 900, animationEasing: 'cubicOut', textStyle: { fontFamily: F_ }, tooltip: { trigger: 'axis', backgroundColor: S.tema === 'gelap' ? '#E9EEF4' : '#16202B', borderWidth: 0, textStyle: { color: S.tema === 'gelap' ? '#0E131A' : '#fff', fontFamily: F_, fontWeight: 600, fontSize: 12 }, ...(opt.tooltip || {}) }, ...opt, xAxis: ax(opt.xAxis), yAxis: ax(opt.yAxis), grid: { left: 8, right: 14, top: 22, bottom: 6, containLabel: true, ...(opt.grid || {}) } };
}
function buatChart(el, opt, onClick) {
  const c = echarts.init(el, null, { renderer: 'canvas' }); c.__opt = opt; c.setOption(gayaChart(opt)); if (onClick) c.on('click', onClick); charts.push(c); return c;
}
function bersihChart() { while (charts.length) charts.pop().dispose(); }

// =============================================================
//  Panel per lensa
// =============================================================
const kpi = (n, lbl, suf = '', d = 0, st = '') => `<div class="kpi ${st}"><b><span data-n="${typeof n === 'number' ? n : ''}" data-d="${d}">${typeof n === 'number' ? '0' : n}</span><small>${suf}</small></b><span>${lbl}</span></div>`;
const chartBox = (id, judul, ket = '', kelas = '') => `<div class="chart-box"><h3>${judul}<span>${ket}</span></h3><div class="chart ${kelas}" id="${id}"></div></div>`;
const temuan = (list) => `<ul class="temuan">${list.map(([t, s]) => `<li><i class="${t === 'r' ? 'rk' : ''}">${t === 'r' ? '→' : '!'}</i><span>${s}</span></li>`).join('')}</ul>`;
const head = (id, judul, lede) => `<div class="panel-kepala"><span class="eyebrow"><i></i>${LENSA[id].grup === 'ringkasan' ? 'Kawasan inti Blok M' : ATR[LENSA[id].grup].nama}${LENSA[id].induk ? '' : ' · ' + LENSA[id].nama}</span><button class="btn-metode" type="button" data-metode="${id}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>Metodologi</button></div><h2>${judul}</h2><p class="lede">${lede}</p>`;
const LU_C = ['#C99A1E', '#D9573A', '#3E7FD0', '#3F9A5E', '#9A6BB8'];
function panelAtribut(k) {
  const A_ = ATR[k], L = PPS.ind[k], id = 'p' + k, c = warnaAtr(k), proksi = new Set(L.map((x) => x.ukur));
  const [kat] = kategori(PPS[k].skor);
  return { html: `${head(id, `${A_.nama}: ${PPS[k].skor}/100`, `<b>${A_.tanya}</b> Skor atribut adalah rata-rata ${L.length} indikator terukur di bawah, masing-masing dinormalkan ke acuannya (0 sampai 100).`)}
    <div class="kpi-grid">${kpi(PPS[k].skor, 'skor atribut PPS · ' + kat.toLowerCase(), '/100', 0, PPS[k].skor >= 55 ? 'status-ok' : 'status-no')}${PPS.ahp[k] != null ? kpi(PPS.ahp[k], 'skor AHP setara (hasil saat ini)', '/100') : kpi('Tidak ada', 'padanan di skor AHP')}</div>
    <div class="subjudul">Indikator terukur</div>
    ${L.map((x) => `<div class="ind"><b>${x.n}</b><span class="nil">${nf(x.v, x.v < 10 && x.u !== '%' ? 2 : 0)}${x.u.startsWith('/') || x.u.startsWith('%') ? '' : ' '}${x.u} · <span style="color:${c}">${x.s}</span></span><span class="bar"><i style="width:${x.s}%;background:${c}"></i></span><small>${x.acuan} · <span class="tag ${x.j === 'model' ? 'model' : 'ukur'}">${x.j === 'model' ? 'MODEL' : x.j === 'audit' ? 'AUDIT' : 'TERUKUR'}</span> · <a href="#${x.lensa}">buka lensa ${LENSA[x.lensa].nama.toLowerCase()} ›</a></small></div>`).join('')}
    <div class="subjudul">Kualitas tak berwujud (cincin tengah)</div><div class="chipset">${A_.intang.map((t) => `<span>${t}</span>`).join('')}</div>
    <div class="subjudul">Pengukuran PPS (cincin luar)</div><div class="chipset">${A_.ukur.map((t) => `<span class="${proksi.has(t) ? '' : 'belum'}">${t}${proksi.has(t) ? '' : ' · perlu survei'}</span>`).join('')}</div>
    <p class="sumber">Kualitas tak berwujud dinilai lewat observasi dan Place Game PPS bersama warga, jadi tidak diberi skor di sini. Pengukuran bertanda "perlu survei" belum punya data terbuka untuk Blok M.</p>`,
    charts: null };
}
const PANEL = {
  pakses: () => panelAtribut('akses'), pnyaman: () => panelAtribut('nyaman'), pguna: () => panelAtribut('guna'), psosial: () => panelAtribut('sosial'),
  ringkasan() {
    const [kP] = kategori(PPS.total), [kA] = kategori(SK.total), ks = Object.keys(ATR);
    const lemah = ks.reduce((a, b) => PPS[b].skor < PPS[a].skor ? b : a), kuat = ks.reduce((a, b) => PPS[b].skor > PPS[a].skor ? b : a);
    const semua = ks.flatMap((k) => PPS.ind[k].map((x) => ({ ...x, k }))), terendah = semua.sort((a, b) => a.s - b.s).slice(0, 3);
    return { html: `${head('ringkasan', 'Ruang publik Blok M di Place Diagram', `Kawasan inti (${nf(VS.luas_ha, 0)} ha) dinilai dengan empat atribut <b>Project for Public Spaces</b>, lalu dibandingkan dengan <b>skor kelayakan AHP</b> hasil studi sebelumnya. Klik cincin diagram untuk membuka atribut atau indikatornya.`)}
      <div class="banding"><div style="box-shadow:0 0 0 1.5px var(--aksen) inset"><em style="color:var(--aksen)">Place Diagram PPS</em><b><span data-n="${PPS.total}" data-d="0">0</span><small style="font-size:14px;color:var(--redam)">/100</small></b><span>${kP} · rata-rata 4 atribut, ${semua.length} indikator terukur</span></div>
        <div><em style="color:var(--redam)">Kelayakan AHP (hasil saat ini)</em><b><span data-n="${SK.total}" data-d="0">0</span><small style="font-size:14px;color:var(--redam)">/100</small></b><span>${kA} · 4 parameter, bobot pemangku kepentingan</span></div></div>
      ${chartBox('c1', 'Place Diagram kawasan inti', 'cincin dalam: atribut · luar: indikator', 'tinggi')}
      ${chartBox('c2', 'Skor per atribut: PPS dan AHP setara', 'sosiabilitas tidak ada di AHP')}
      ${temuan([['!', `Atribut terlemah: <b>${ATR[lemah].nama}</b> (${PPS[lemah].skor}). Indikator terendah: ${terendah.map((x) => `${x.n.toLowerCase()} (${x.s})`).join(', ')}.`], ['r', `Atribut terkuat: <b>${ATR[kuat].nama}</b> (${PPS[kuat].skor}).`], ['!', `PPS ${PPS.total > SK.total ? 'lebih tinggi' : 'lebih rendah'} ${Math.abs(PPS.total - SK.total)} poin dari AHP karena AHP memberi bobot 49% pada akses transit, sedangkan PPS menimbang empat atribut setara dan menambah sosiabilitas.`]])}
      <p class="sumber">Kerangka: Project for Public Spaces, <i>What Makes a Successful Place?</i> (Place Diagram). Skor AHP: Gifarry, Dwi Ari &amp; Firdausiyah (2022). Pengukuran PPS yang belum tersedia (misal kriminalitas, kebersihan, komposisi pengunjung) ditandai "perlu survei" di tiap atribut.</p>`,
      charts: () => {
        const data = ks.map((k) => ({ name: ATR[k].pendek, value: PPS.ind[k].length, id: 'p' + k, itemStyle: { color: warnaAtr(k) },
          children: PPS.ind[k].map((x) => ({ name: x.n, value: 1, id: x.lensa, nilai: x.s, itemStyle: { color: warnaAtr(k), opacity: .25 + .75 * x.s / 100 } })) }));
        buatChart($('#c1'), { tooltip: { trigger: 'item', formatter: (p) => p.data.nilai != null ? `${p.name}<br><b>${p.data.nilai}/100</b>` : `${ATR[p.data.id.slice(1)].nama}<br><b>${PPS[p.data.id.slice(1)].skor}/100</b>` },
          series: [{ type: 'sunburst', data, radius: ['22%', '96%'], sort: null, nodeClick: false, itemStyle: { borderColor: S.tema === 'gelap' ? '#1D2733' : '#F4F6F9', borderWidth: 2, borderRadius: 4 },
            levels: [{}, { r0: '22%', r: '52%', label: { rotate: 0, fontWeight: 800, fontSize: 11, color: '#0E131A', formatter: (p) => p.name + '\n' + PPS[p.data.id.slice(1)].skor } }, { r0: '54%', r: '96%', label: { show: false } }] },
            { type: 'pie', radius: [0, '20%'], silent: true, label: { position: 'center', formatter: () => `{a|${PPS.total}}\n{b|PPS}`, rich: { a: { fontSize: 20, fontWeight: 800, color: warnaTeks() }, b: { fontSize: 10, fontWeight: 700, color: warnaTeks() } } }, data: [{ value: 1, itemStyle: { color: 'transparent' } }] }] },
          (e) => { const id = e.data && e.data.id; if (id && LENSA[id]) location.hash = id; });
        buatChart($('#c2'), { legend: { top: 0, right: 0, textStyle: { color: warnaTeks(), fontWeight: 600, fontSize: 10.5 } }, grid: { top: 30 }, xAxis: { type: 'category', data: ks.map((k) => ATR[k].pendek) }, yAxis: { type: 'value', max: 100 },
          series: [{ name: 'PPS', type: 'bar', barGap: '18%', data: ks.map((k) => ({ value: PPS[k].skor, itemStyle: { color: warnaAtr(k), borderRadius: [5, 5, 0, 0] } })), label: { show: true, position: 'top', fontWeight: 800, color: warnaTeks(), fontSize: 11 } },
            { name: 'AHP setara', type: 'bar', data: ks.map((k) => PPS.ahp[k] == null ? null : { value: PPS.ahp[k], itemStyle: { color: S.tema === 'gelap' ? 'rgba(233,238,244,.28)' : 'rgba(22,32,43,.22)', borderRadius: [5, 5, 0, 0] } }), label: { show: true, position: 'top', fontWeight: 700, color: warnaTeks(), fontSize: 10.5 } }] },
          (e) => { location.hash = 'p' + ks[e.dataIndex]; });
      },
    };
  },
  akses() {
    return { html: `${head('akses', 'Simpul transit terpadat Jakarta Selatan', `<b>${nf(VS.akses5, 0)}%</b> kawasan inti cukup ≤5 menit jalan kaki ke MRT, terminal, atau halte TransJakarta; ${nf(VS.akses10, 0)}% ≤10 menit.`)}
      <div class="kpi-grid">${kpi(VS.akses_rata, 'rata-rata menit jalan ke transit', ' mnt', 1)}${kpi(VS.akses5, 'area ≤5 menit', '%', 0, 'status-ok')}${kpi(553599, 'pelanggan MRT Blok M BCA, Des 2025')}${kpi(2, 'peringkat stasiun MRT terpadat')}</div>
      ${chartBox('c1', 'Sebaran waktu jalan ke transit', 'porsi area, menit')}
      ${temuan([['!', 'Moda harian Jakarta masih didominasi motor (68,3%); angkutan umum 18,45%.'], ['r', 'Skybridge Terminal sampai Stasiun MRT (revitalisasi 2025) memangkas jalan memutar di sisi timur.']])}
      <p class="sumber">Jarak jaringan jalan (Dijkstra), 80 m/menit. Ridership: PT MRT Jakarta via Media Asuransi (2026); moda: DPRD DKI dalam Manurung (2025).</p>`,
      charts: () => { const h = VS.akses_hist, t = h.reduce((a, b) => a + b, 0); return buatChart($('#c1'), { xAxis: { type: 'category', data: h.map((_, i) => String(i + 1)), name: 'menit' }, yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } }, series: [{ type: 'bar', data: h.map((v, i) => ({ value: +(100 * v / t).toFixed(1), itemStyle: { color: i < 5 ? '#2F6BD8' : i < 10 ? '#8FB0EE' : '#D5DDF0', borderRadius: [4, 4, 0, 0] } })), barCategoryGap: '18%', markLine: { symbol: 'none', label: { formatter: '{b}', color: warnaTeks(), fontWeight: 800 }, lineStyle: { color: '#1F1F1F', type: 'dashed' }, data: [{ xAxis: '5', name: '5 mnt' }, { xAxis: '10', name: '10 mnt' }] } }] }); },
    };
  },
  walk() {
    const t = LIT.tod, o = OS.orientasi, lab = o.map((_, i) => i * 10);
    const tab = [['Persimpangan', nf(OS.dens_simpang, 0) + '/km²', '≥ 120 (ITDP)'], ['Kelurusan rute', nf(OS.circuity, 2), '< 1,3 ideal'], ['Indeks konektivitas', nf(OS.konektivitas, 2), '> 1,6 baik'], ['Ujung buntu', nf(OS.dead_end, 0) + '%', 'makin kecil makin baik'], ['Penyeberangan terpetakan', nf(OS.dens_penyeberangan, 0) + '/km²', OS.penyeberangan + ' titik'], ['Jalur khusus pejalan', nf(OS.ped_km, 1) + ' km', nf(OS.ped_dens, 1) + ' km/km²']];
    return { html: `${head('walk', 'Jangkauan jalan kaki yang nyata', `Gelombang merambat dari ${OS.pintu} pintu MRT Blok M BCA di sepanjang <b>${nf(O.seg.length, 0)} ruas jalan OpenStreetMap</b>. Dalam radius 400 m, hanya <b>${nf(OS.pedshed400, 0)}%</b> area benar-benar terjangkau 400 m berjalan; di 800 m, <b>${nf(OS.pedshed800, 0)}%</b>.`)}
      <div class="kpi-grid">${kpi(OS.pedshed400, 'pedshed 400 m (±5 menit)', '%', 0, OS.pedshed400 >= 60 ? 'status-ok' : 'status-no')}${kpi(OS.pedshed800, 'pedshed 800 m (±10 menit)', '%', 0, OS.pedshed800 >= 70 ? 'status-ok' : 'status-no')}${kpi(avg(t.jalurPed), 'jalur pedestrian layak (audit)', '%', 0, 'status-no')}${kpi(VS.walk_rata, 'skor walkability rata-rata', '', 0)}</div>
      <div class="skenario"><h4>▶ Gelombang isokron</h4><p>Warna = menit berjalan dari pintu MRT (80 m/menit).</p><div class="toggle"><button class="tb" id="jar-ulang" type="button">Putar ulang</button><button class="tb" id="jar-kelas" type="button">Warna kelas jalan</button></div></div>
      ${chartBox('c1', 'Audit kualitas jalur (rata-rata 3 blok TOD)', 'garis = standar')}
      ${chartBox('c2', 'Orientasi jalan (Boeing, 2019)', 'panjang ruas per arah')}
      <div class="chart-box"><h3>Metrik jaringan kawasan inti<span>OSMnx</span></h3><table class="tabel">${tab.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</table></div>
      ${temuan([['!', `Rute rata-rata ${nf((OS.circuity - 1) * 100, 0)}% lebih jauh dari garis lurus karena blok besar dan arteri bermedian.`], ['!', 'Penyeberangan layak hanya 8 sampai 41% (standar 90%).'], ['r', 'Tembusan pejalan di blok Melawai dan penyeberangan sebidang di Jl. Sultan Iskandarsyah memperluas jangkauan 400 m.']])}
      <p class="sumber">Graf jalan kaki OSMnx (ekstrak OSM 3 Nov 2026); audit jalur: Gifarry dkk. (2022), Varlencia &amp; Asharhani (2025). Pedshed acuan: &gt;50% cukup, &gt;70% baik.</p>`,
      charts: () => {
        const it = [['Jalur pedestrian', avg(t.jalurPed), 80], ['Penyeberangan', avg(t.penyeberangan), 90], ['Peneduh', avg(t.peneduh), 75], ['Jalur sepeda', avg(t.sepeda), 100], ['Pedshed 800 m', OS.pedshed800, 70]];
        buatChart($('#c1'), { grid: { left: 4 }, xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', data: it.map((x) => x[0]), inverse: true }, series: [{ type: 'bar', data: it.map(([, v, s_]) => ({ value: +v.toFixed(1), itemStyle: { color: v >= s_ ? LENSA.walk.warna : (S.tema === 'gelap' ? '#56606C' : '#B9C0C9'), borderRadius: [0, 4, 4, 0] } })), barWidth: 12, label: { show: true, position: 'right', formatter: '{c}%', fontWeight: 800, color: warnaTeks() } }, { type: 'scatter', data: it.map((x) => x[2]), symbol: 'rect', symbolSize: [3, 20], itemStyle: { color: warnaTeks() }, tooltip: { show: false } }] });
        buatChart($('#c2'), { polar: { radius: ['8%', '78%'] }, angleAxis: { type: 'category', data: lab, startAngle: 95, clockwise: true, axisLabel: { interval: 0, formatter: (v) => ({ 0: 'U', 90: 'T', 180: 'S', 270: 'B' })[v] || '', fontWeight: 800 }, axisTick: { show: false } }, radiusAxis: { show: false }, tooltip: { formatter: (p) => p.name + '°: ' + nf(p.value * 100, 1) + '%' }, series: [{ type: 'bar', coordinateSystem: 'polar', data: o, barCategoryGap: '4%', itemStyle: { color: LENSA.walk.warna, borderRadius: 2 } }] });
      },
      after: () => { $('#jar-ulang').onclick = () => { JUM.uMode.value = 0; jarT0 = performance.now(); renderLegenda(); }; $('#jar-kelas').onclick = () => { JUM.uMode.value = JUM.uMode.value > .5 ? 0 : 1; renderLegenda(); }; },
    };
  },
  muka() {
    const seg = O.seg.map((g, i) => ({ g, a: V4.aktif[i], i })).filter((x) => x.g.n && x.g.n !== 'nan' && x.g.n !== 'None');
    const perJalan = {}; seg.forEach(({ g, a }) => { const L = g.p.length / 2; const k = g.n; perJalan[k] = perJalan[k] || [0, 0]; perJalan[k][0] += a * L; perJalan[k][1] += L; });
    const top = Object.entries(perJalan).filter(([, v]) => v[1] > 12).map(([k, v]) => [k, 100 * v[0] / v[1], v[1]]).sort((a, b) => b[1] - a[1]);
    const pilih = [...top.slice(0, 5), ...top.slice(-3)];
    return { html: `${head('muka', 'Separuh jalan kawasan inti hidup', `<b>${nf(V4.muka, 0)}%</b> panjang jalan kawasan inti berbatasan langsung dengan toko, kuliner, atau jasa. Muka aktif adalah ukuran PPS untuk <b>kehidupan jalan</b>: jalan yang dibatasi etalase lebih banyak disinggahi dan terasa aman.`)}
      <div class="kpi-grid">${kpi(V4.muka, 'panjang jalan bermuka aktif', '%', 0, V4.muka >= 50 ? 'status-ok' : 'status-no')}${kpi(OS.mutu.poi, 'POI di kawasan inti')}</div>
      ${chartBox('c1', 'Jalan paling dan paling tidak aktif', '% panjang bermuka aktif')}
      ${temuan([['r', 'Koridor Melawai dan Little Tokyo paling hidup: kandidat jalan berbagi (shared street) di akhir pekan.'], ['!', 'Sisi arteri dan sekitar terminal didominasi dinding buta dan parkir: tambahkan kios atau fasad transparan di lantai dasar.']])}
      <p class="sumber">Titik sampel tiap 6 m di sepanjang ruas OSM; dinilai aktif bila ada POI (toko, kuliner, jasa) dalam 22 m atau bangunan komersial dalam 10 m. Tidak membedakan jam buka; validasi dengan survei muka bangunan.</p>`,
      charts: () => buatChart($('#c1'), { grid: { left: 4 }, xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', inverse: true, data: pilih.map((x) => x[0].replace('Jalan ', 'Jl. ')), axisLabel: { width: 130, overflow: 'truncate' } }, tooltip: { valueFormatter: (v) => nf(v, 0) + '%' },
        series: [{ type: 'bar', barWidth: 11, data: pilih.map((x) => ({ value: +x[1].toFixed(1), itemStyle: { color: LENSA.muka.warna, opacity: .35 + .65 * x[1] / 100, borderRadius: [0, 4, 4, 0] } })) }] }),
    };
  },
  variety() {
    const lu = VS.lu;
    return { html: `${head('variety', 'Komersial mendominasi inti kawasan', `<b>${nf(lu['Komersial & jasa'], 0)}%</b> lahan kawasan inti komersial; hunian hanya ${nf(lu['Hunian'], 0)}%. Indeks campuran rata-rata <b>${nf(VS.mix_rata, 2)}</b>.`)}
      <div class="seg" id="seg-var"><button data-v="lu" class="${S.varMode === 'lu' ? 'on' : ''}">Guna lahan</button><button data-v="mix" class="${S.varMode === 'mix' ? 'on' : ''}">Indeks campuran</button></div>
      ${chartBox('c1', 'Komposisi guna lahan kawasan inti')}
      ${temuan([['!', 'Keragaman hunian:nonhunian Blok 2 hanya 5% (standar 15 sampai 85%).'], ['r', 'Hunian vertikal TOD (Pergub 103/2021, subzona R.7 sekitar MRT) menghidupkan kawasan di luar jam komersial.']])}
      <p class="sumber">Landuse OpenStreetMap; entropi Shannon 150 m. Audit: Gifarry dkk. (2022).</p>`,
      charts: () => buatChart($('#c1'), { tooltip: { trigger: 'item', formatter: '{b}: {c}%' }, series: [{ type: 'pie', radius: ['48%', '76%'], center: ['50%', '52%'], padAngle: 2, itemStyle: { borderRadius: 6 }, label: { color: warnaTeks(), fontWeight: 800, fontSize: 11, formatter: '{b}\n{c}%' }, data: Object.entries(lu).map(([k, v], i) => ({ name: k, value: v, itemStyle: { color: LU_C[i] } })) }] }),
      after: () => $$('#seg-var button').forEach((b) => b.onclick = () => { S.varMode = b.dataset.v; $$('#seg-var button').forEach((x) => x.classList.toggle('on', x === b)); gambarOverlay(); renderLegenda(); }),
    };
  },
  termal() {
    const now = persenTeduh(S.doy, S.jam), sk = S.pohonSkenario ? persenTeduh(S.doy, S.jam, hmapSken) : null;
    return { html: `${head('termal', 'Jalur pejalan masih terpanggang', `Matahari dihitung untuk lintang Blok M. Pukul <b>${fmtJam(S.jam)}</b>, ${now == null ? 'matahari sudah terbenam' : `<b>${nf(now, 0)}%</b> jalur pejalan kawasan inti ternaungi bangunan atau pohon`}.`)}
      <div class="kpi-grid">${kpi(SUN.elDeg > 0 ? SUN.elDeg : 0, 'elevasi matahari', '°')}${kpi(suhuUdara(S.jam), 'suhu udara tipikal (asumsi)', ' °C', 1)}${kpi(VS.panas_tinggi, 'area indeks panas tinggi', '%', 0, 'status-no')}${kpi(25, 'jalur berpeneduh terbaik (standar 75%)', '%', 0, 'status-no')}</div>
      ${chartBox('c1', 'Jalur ternaungi sepanjang hari', 'klik grafik untuk pindah jam')}
      <div class="skenario"><h4>🌳 Skenario: pohon peneduh</h4><p>Tanam ${POHON_BARU.length} pohon di tepi jalur kawasan inti yang belum teduh, lalu hitung ulang bayangan.</p>
        <label class="toggle">Aktifkan skenario<span class="sw"><input type="checkbox" id="sk-pohon" ${S.pohonSkenario ? 'checked' : ''}><span></span></span></label>
        ${sk != null ? `<span class="delta">▲ ${nf(sk - now, 0)} poin teduhan pukul ${fmtJam(S.jam)}</span>` : ''}</div>
      <p class="sumber">Ray-marching dari ${JALAN.length} titik jalan ke arah matahari terhadap peta tinggi bangunan dan tajuk pohon (citra satelit). Indeks panas: estimasi, lihat Metodologi.</p>`,
      charts: () => { const a = kurvaTeduh(S.doy, hmap, 'e'), s = S.pohonSkenario ? kurvaTeduh(S.doy, hmapSken, 's') : null;
        return buatChart($('#c1'), { legend: s ? { top: 0, right: 0, textStyle: { color: warnaTeks(), fontWeight: 700, fontSize: 10.5 } } : undefined, grid: { top: s ? 30 : 22 }, xAxis: { type: 'value', min: 6, max: 18, interval: 2, axisLabel: { formatter: (v) => String(v).padStart(2, '0') + ':00' } }, yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
          tooltip: { valueFormatter: (v) => v == null ? 'malam' : nf(v, 0) + '%' },
          series: [{ name: 'Eksisting', type: 'line', smooth: true, showSymbol: false, data: a, lineStyle: { width: 2.5, color: '#E4572E' }, areaStyle: { color: 'rgba(228,87,46,.12)' }, markLine: { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: '#1F1F1F', type: 'dashed' }, data: [{ xAxis: clamp(S.jam, 6, 18) }] } },
            ...(s ? [{ name: 'Dengan pohon', type: 'line', smooth: true, showSymbol: false, data: s, lineStyle: { width: 2.5, color: '#2E9A6A' } }] : [])] },
          null).getZr().on('click', function (e) { const c = charts[charts.length - 1]; const p = c.convertFromPixel({ seriesIndex: 0 }, [e.offsetX, e.offsetY]); if (p) { berhenti(); animJam(clamp(p[0], 6, 18)); } }); },
      after: () => { const el = $('#sk-pohon'); if (el) el.onchange = () => setSkenarioPohon(el.checked); },
    };
  },
  angin() {
    const a = statAngin();
    return { html: `${head('angin', 'Angin melemah di antara blok padat', `Medan aliran 2D <b>Lattice-Boltzmann</b> (D2Q9, sel 6 m). Arah: <b>${ARAH[S.arah]}</b>.`)}
      <label style="display:block;margin-top:10px;font:700 12px var(--font)">Arah angin <select id="arah" style="width:100%;margin-top:4px">${Object.entries(ARAH).map(([k, v]) => `<option value="${k}" ${k === S.arah ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label style="display:block;margin-top:8px;font:700 12px var(--font)">Angin referensi 10 m: <span id="uref-v">${nf(S.uref, 1)} m/s</span><input type="range" class="rentang" id="uref" min="0.8" max="5" step="0.1" value="${S.uref}"></label>
      <div class="kpi-grid">${kpi(a.rata, 'rata-rata di jalur kawasan inti', ' m/s', 2)}${kpi(a.stag, 'jalur udara stagnan (<0,3 m/s)', '%', 0, 'status-no')}${kpi(a.nyaman, 'jalur angin nyaman', '%', 0, 'status-ok')}${kpi(a.kencang, 'jalur berangin kencang', '%')}</div>
      ${chartBox('c1', 'Kenyamanan angin per arah musim', 'porsi jalur')}
      <p class="sumber">Pola monsun Jakarta: barat Okt sampai Mar, timur Apr sampai Sep (BMKG; BRIN 2013 sampai 2022). Model 2D untuk penyaringan awal, bukan pengganti CFD 3D.</p>`,
      charts: () => { const ks = Object.keys(ARAH), d = ks.map((k) => statAngin(k)); const ser = [['Stagnan', 'stag', '#2E6BD9'], ['Nyaman', 'nyaman', '#8CC56F'], ['Kencang', 'kencang', '#DB4B33']].map(([n, f, c]) => ({ name: n, type: 'bar', stack: 'a', data: d.map((x) => +x[f].toFixed(1)), itemStyle: { color: c }, barWidth: 20 }));
        return buatChart($('#c1'), { legend: { top: 0, right: 0, textStyle: { color: warnaTeks(), fontWeight: 700, fontSize: 10.5 } }, grid: { top: 30 }, xAxis: { type: 'category', data: ['Barat', 'Barat laut', 'Utara', 'Timur', 'Tenggara'] }, yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } }, series: ser }, (e) => { const k = ks[e.dataIndex]; if (k) { S.arah = k; gambarOverlay(); renderPanel(); } }); },
      after: () => { $('#arah').onchange = (e) => { S.arah = e.target.value; gambarOverlay(); renderPanel(); }; $('#uref').oninput = (e) => { S.uref = +e.target.value; $('#uref-v').textContent = nf(S.uref, 1) + ' m/s'; gambarOverlay(); clearTimeout(window.__u); window.__u = setTimeout(renderPanel, 250); }; },
    };
  },
  bising() {
    const fp = VS.fasad_per_fungsi, nmF = { 3: 'Hunian (55)', 4: 'Komersial & jasa (70)', 5: 'Publik & pemerintahan (60)', 8: 'Ibadah (55)' };
    return { html: `${head('bising', 'Arteri dan terminal mengepung inti kawasan', `Rata-rata <b>${nf(VS.bising_rata, 0)} dB(A)</b> di ruang luar kawasan inti. <b>${nf(VS.bising_70, 0)}%</b> area melewati 70 dB(A). Area <b>Terminal Bus Blok M</b> rata-rata <b>${nf(VS.bising_terminal, 0)} dB(A)</b>, sebanding dengan pengukuran di terminal Jakarta lain (71,6 dB(A) di Pinang Ranti).`)}
      <div class="kpi-grid">${kpi(VS.bising_rata, 'rata-rata ruang luar', ' dB(A)')}${kpi(VS.bising_70, 'area > 70 dB(A)', '%', 0, 'status-no')}${kpi(VS.bising_terminal, 'rata-rata area terminal', ' dB(A)', 0, 'status-no')}${kpi(VS.fasad_lewat, 'fasad melewati baku mutu fungsinya', '%', 0, 'status-no')}</div>
      ${chartBox('c1', 'Sebaran tingkat kebisingan', 'porsi area ruang luar')}
      ${chartBox('c2', 'Fasad melewati baku mutu per fungsi', 'jumlah bangunan')}
      ${temuan([['!', 'Fasad di Jl. Panglima Polim, Sultan Iskandarsyah, Melawai Raya, dan sekeliling terminal paling terpapar.'], ['!', 'Semua hunian dan rumah ibadah di kawasan inti berada di atas baku 55 dB(A): butuh peredam di fasad atau jendela.'], ['r', 'Lorong dalam blok 10 sampai 20 dB lebih tenang: potensi ruang duduk dan nongkrong.']])}
      <p class="sumber">Estimasi indikatif dari jaringan jalan OSM vektor: Leq siang pada 7,5 m arteri 76, kolektor 73, tersier 69, busway 71, jalan servis bernama 64, lokal 61, MRT layang 66 dB(A); area terminal sebagai sumber bidang. Atenuasi jarak geodesik dan difraksi Maekawa. Baku mutu KepMenLH 48/1996 dan KepGub DKI 551/2001. Validasi dengan sound level meter.</p>`,
      charts: () => { const h = VS.bising_hist, t = h.reduce((a, b) => a + b, 0);
        buatChart($('#c1'), { xAxis: { type: 'category', data: h.map((_, i) => (40 + i * 5) + '-' + (45 + i * 5)), name: 'dB(A)', axisLabel: { interval: 0, rotate: 35 } }, yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } }, series: [{ type: 'bar', barCategoryGap: '12%', data: h.map((v, i) => ({ value: +(100 * v / t).toFixed(1), itemStyle: { color: `rgb(${F.bising((i * 5 - 2.5) / 40).map((x) => x * 255).join(',')})`, borderRadius: [4, 4, 0, 0] } })), markLine: { symbol: 'none', label: { formatter: '70 dB', color: warnaTeks(), fontWeight: 800 }, lineStyle: { color: warnaTeks(), type: 'dashed' }, data: [{ xAxis: '70-75' }] } }] });
        const ks = Object.keys(fp); buatChart($('#c2'), { legend: { top: 0, right: 0, textStyle: { color: warnaTeks(), fontWeight: 600, fontSize: 10.5 } }, grid: { top: 30, left: 4 }, xAxis: { type: 'value' }, yAxis: { type: 'category', inverse: true, data: ks.map((k) => nmF[k]) },
          series: [{ name: 'Melewati', type: 'bar', stack: 'a', barWidth: 12, data: ks.map((k) => fp[k][0]), itemStyle: { color: S.tema === 'gelap' ? '#FF8E7E' : '#DE503A' } }, { name: 'Memenuhi', type: 'bar', stack: 'a', data: ks.map((k) => fp[k][1] - fp[k][0]), itemStyle: { color: S.tema === 'gelap' ? '#3A4552' : '#D3DAE3', borderRadius: [0, 4, 4, 0] } }] }); },
    };
  },
  sosial() {
    const tj = totalJam(Math.floor(S.jam) % 24); let top = 0; HEXA.forEach((_, i) => { if (hexNow[i] > hexNow[top]) top = i; });
    return { html: `${head('sosial', 'Puncak keramaian menjelang malam', `Kolom = estimasi kunjungan per jam per heksagon (radius ${HR} m) dari ${D.poi.length} POI OpenStreetMap dikali profil jam buka, dipatok ke data terukur.`)}
      <div class="kpi-grid">${kpi(Math.round(tj / 100) * 100, 'estimasi kunjungan pukul ' + fmtJam(S.jam))}${kpi(Math.round((hexNow[top] || 0) / 10) * 10, 'kunjungan/jam di heksagon terpadat')}${kpi(80000, 'total kalibrasi per hari')}${kpi(145855, 'rekor Blok M Hub, malam tahun baru 2026')}</div>
      ${chartBox('c1', 'Ritme kunjungan kawasan', 'klik untuk pindah jam')}
      <p class="sumber">${ANCHOR.map((a) => `${a.n}: ${a.src}`).join(' · ')} · Total ±80.000/hari: Dirut PT MRT Jakarta (investortrust.id, 2026). Profil jam = model, bukan data ponsel.</p>`,
      charts: () => buatChart($('#c1'), { xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')) }, yAxis: { type: 'value', axisLabel: { formatter: (v) => nf(v / 1000, 0) + 'k' } }, tooltip: { valueFormatter: (v) => nf(v, 0) + ' kunjungan' },
        series: [{ type: 'bar', data: Array.from({ length: 24 }, (_, h) => ({ value: Math.round(totalJam(h)), itemStyle: { color: Math.floor(S.jam) % 24 === h ? '#9E2149' : `rgb(${F.sos(Math.sqrt(totalJam(h) / totalJam(19.3))).map((x) => x * 255).join(',')})`, borderRadius: [4, 4, 0, 0] } })), barCategoryGap: '14%' }] }, (e) => { berhenti(); animJam(e.dataIndex + .5); }),
    };
  },
  fasilitas() {
    const fk = VS.fas_kat, f5 = VS.fas5, ks = Object.keys(fk);
    return { html: `${head('fasilitas', 'Hampir semua kebutuhan dalam 10 menit', `<b>${nf(VS.fas_lengkap, 0)}%</b> kawasan inti menjangkau minimal ${VS.n_kat - 1} dari ${VS.n_kat} jenis fasilitas dalam 10 menit (800 m) jalan kaki.`)}
      <div class="kpi-grid">${kpi(VS.fas_rata, 'rata-rata jenis fasilitas terjangkau', ' / ' + VS.n_kat, 1)}${kpi(VS.fas_lengkap, 'area hampir lengkap', '%', 0, 'status-ok')}</div>
      ${chartBox('c1', 'Jangkauan per jenis fasilitas', '5 vs 10 menit')}
      ${temuan([['!', 'Fasilitas kesehatan paling jarang: ' + nf(f5['kesehatan'], 0) + '% area terjangkau dalam 5 menit.'], ['r', 'Konsep kota 10 menit sudah terpenuhi; fokus pada kualitas rute, bukan menambah fasilitas.']])}
      <p class="sumber">Jarak jaringan jalan ke POI OpenStreetMap, transit, dan taman ≥0,15 ha.</p>`,
      charts: () => buatChart($('#c1'), { legend: { top: 0, right: 0, textStyle: { color: warnaTeks(), fontWeight: 700, fontSize: 10.5 } }, grid: { top: 30, left: 4 }, xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', data: ks.map((k) => k[0].toUpperCase() + k.slice(1)), inverse: true },
        series: [{ name: '≤5 menit', type: 'bar', data: ks.map((k) => f5[k]), itemStyle: { color: '#13806E', borderRadius: [0, 4, 4, 0] }, barWidth: 7 }, { name: '≤10 menit', type: 'bar', data: ks.map((k) => fk[k]), itemStyle: { color: '#A9DCCB', borderRadius: [0, 4, 4, 0] }, barWidth: 7 }] }),
    };
  },
  rth() {
    return { html: `${head('rth', 'Taman dekat, tapi kecil', `<b>${nf(VS.rth300, 0)}%</b> bangunan kawasan inti berada ≤300 m jalan kaki dari ruang hijau (acuan WHO). Ruang hijau hanya <b>${nf(VS.lu['Ruang hijau'], 1)}%</b> lahan.`)}
      <div class="kpi-grid">${kpi(VS.rth300, 'bangunan ≤300 m dari taman', '%', 0, 'status-ok')}${kpi(VS.lu['Ruang hijau'], 'porsi ruang hijau kawasan inti', '%', 1, 'status-no')}${kpi(5.2, 'RTH Jakarta 2023 (target 30%)', '%', 1)}${kpi(400, 'pengunjung Taman Literasi per hari')}</div>
      ${chartBox('c1', 'Jarak jalan kaki ke ruang hijau', 'porsi area')}
      ${temuan([['r', 'Perluas hijau di atap Terminal dan Mal Blok M (21.263 m²) terhubung dengan Taman Literasi.']])}
      <p class="sumber">Ramadhan, Nugroho &amp; Agumsari (2025); WHO Urban Green Spaces (2016): akses 300 m.</p>`,
      charts: () => { const h = VS.rth_hist, t = h.reduce((a, b) => a + b, 0); return buatChart($('#c1'), { xAxis: { type: 'category', data: h.map((_, i) => i === 9 ? '>900' : (i * 100) + ''), name: 'm' }, yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } }, series: [{ type: 'bar', barCategoryGap: '12%', data: h.map((v, i) => ({ value: +(100 * v / t).toFixed(1), itemStyle: { color: i < 3 ? '#3F9A5E' : '#E5B88F', borderRadius: [4, 4, 0, 0] } })), markLine: { symbol: 'none', label: { formatter: '300 m', fontWeight: 800, color: warnaTeks() }, lineStyle: { color: '#1F1F1F', type: 'dashed' }, data: [{ xAxis: '300' }] } }] }); },
    };
  },
  morfologi() {
    const bl = O.blok.map((b, k) => ({ ...b, k })).filter((b) => b.n > 0);
    const garis = [1, 3, 5, 7, 10].map((l) => ({ type: 'line', data: [[0, 0], [Math.min(1, 9 / l), Math.min(9, l)]], symbol: 'none', silent: true, lineStyle: { color: '#9A948C', type: 'dashed', width: 1 }, endLabel: { show: true, formatter: 'L=' + l, fontSize: 10, color: warnaTeks() } }));
    return { html: `${head('morfologi', 'Kepadatan bentuk per blok', `Spacematrix (Berghauser Pont &amp; Haupt, 2010) membaca tiap blok dari <b>GSI</b> (tapak/luas blok), <b>FSI</b> (luas lantai/luas blok) dan <b>L</b> (jumlah lantai rata-rata). Blok kawasan inti rata-rata GSI <b>${nf(OS.gsi, 2)}</b>, FSI <b>${nf(OS.fsi, 2)}</b>.`)}
      <div class="kpi-grid">${kpi(OS.fsi, 'FSI rata-rata blok (≈ KLB)', '', 2)}${kpi(OS.gsi * 100, 'GSI rata-rata (≈ KDB)', '%', 0)}${kpi(bl.length, 'blok terbangun dari graf jalan')}${kpi(OS.mutu.lantai_osm, 'bangunan dengan tag lantai OSM', '%', 0, 'status-no')}</div>
      ${chartBox('c1', 'Spacematrix blok kawasan inti', 'klik titik untuk terbang')}
      ${temuan([['!', 'Sebagian besar blok Melawai sudah padat tapak (GSI tinggi) tapi rendah: ciri ruko 2 sampai 4 lantai. Pertumbuhan wajar ke atas, bukan melebar.'], ['r', `Blok dengan GSI tinggi dan L rendah adalah kandidat peremajaan vertikal TOD (cek KLB izin per persil di RDTR).`]])}
      <p class="sumber">Blok dibentuk dari poligonisasi graf jalan OSM (jalan bernama + jalur pejalan). Luas lantai = tapak × lantai; lantai dari tag building:levels OSM bila ada (${nf(OS.mutu.lantai_osm, 0)}% bangunan kawasan inti), selain itu estimasi tipologi. Kategori tipe disederhanakan.</p>`,
      charts: () => buatChart($('#c1'), { grid: { left: 40, right: 34, bottom: 34, top: 12 }, xAxis: { type: 'value', name: 'GSI', nameLocation: 'middle', nameGap: 22, min: 0, max: 1 }, yAxis: { type: 'value', name: 'FSI', nameLocation: 'middle', nameGap: 26, min: 0, max: 9 }, tooltip: { formatter: (p) => p.seriesType === 'scatter' ? `Blok ${p.data[3] + 1}<br>GSI ${nf(p.data[0], 2)} · FSI ${nf(p.data[1], 2)}<br>${p.data[2]}` : '' },
        series: [...garis, { type: 'scatter', data: bl.map((b) => [b.gsi, b.fsi, b.t, b.k, b.a]), symbolSize: (d) => 8 + Math.sqrt(d[4]) / 9, itemStyle: { color: (p) => TIPE_COL[p.data[2]], borderColor: '#fff', borderWidth: 1.2, opacity: .92 } }] },
        (e) => { if (e.seriesType !== 'scatter') return; const g = blokGrp.children[e.data[3]].userData; sorotBlok(e.data[3]); terbangKe(g.cx, g.cz, 420); }),
    };
  },
  tod() {
    const I = O.itdp;
    return { html: `${head('tod', `${OS.itdp_s} dari ${OS.itdp_m} poin terukur`, `Tujuh indikator ITDP TOD Standard yang <b>bisa dihitung dari OSM</b>. Indikator lain (kualitas trotoar, frekuensi layanan, parkir, hunian terjangkau) perlu survei lapangan, jadi tidak dinilai di sini.`)}
      <div class="kpi-grid">${kpi(SK.tod, 'capaian indikator terukur', '%', 0, SK.tod >= 70 ? 'status-ok' : 'status-no')}${kpi(OS.dens_simpang, 'persimpangan per km²', '', 0, 'status-ok')}${kpi(OS.blok_med, 'median keliling blok', ' m', 0, 'status-no')}${kpi(OS.tr500, 'kawasan ≤500 m ke halte', '%', 0, 'status-ok')}</div>
      ${chartBox('c1', 'Poin per indikator', 'poin / maksimum')}
      ${temuan([['!', `<b>Blok terlalu besar</b>: hanya ${nf(OS.blok250, 0)}% blok berkeliling &lt;250 m dan ${nf(OS.blok400, 0)}% &lt;400 m. Di peta, blok merah adalah kandidat tembusan pejalan.`], ['r', `Kepadatan persimpangan ${nf(OS.dens_simpang, 0)}/km² dan akses halte sudah memenuhi ambang tertinggi.`]])}
      <p class="sumber">Ambang indikator dari rangkuman ITDP TOD Standard di repositori Urban-Design-Skills (Abhinav Bhardwaj). Cocokkan dengan dokumen resmi ITDP TOD Standard 3.0 sebelum dipakai sebagai penilaian formal. Ini bukan sertifikasi.</p>`,
      charts: () => buatChart($('#c1'), { grid: { left: 4, right: 24, top: 6, bottom: 4, containLabel: true }, xAxis: { type: 'value', max: 5, splitNumber: 5 }, yAxis: { type: 'category', inverse: true, data: I.map((i) => i.k + ' ' + ({ '1.2': 'Blok < 250 m', '3.1': 'Kepadatan simpang', '3.2': 'Blok < 400 m', '3.3': 'Kelurusan rute', '3.4': 'Konektivitas', '4.1': 'Halte ≤ 500 m', '5.1': 'Campuran guna' })[i.k]), axisLabel: { color: warnaTeks(), fontWeight: 700, fontSize: 11 } },
        tooltip: { formatter: (p) => { const i = I[p.dataIndex]; return `<b>${i.p} ${i.k}</b> ${i.n}<br>Nilai: ${String(i.v).replace('.', ',')} ${i.u}<br>Poin: ${i.s} dari ${i.m}`; } },
        series: [{ type: 'bar', data: I.map((i) => i.m), barWidth: 12, barGap: '-100%', itemStyle: { color: 'rgba(120,115,108,.18)', borderRadius: 4 }, silent: true },
          { type: 'bar', data: I.map((i) => i.s), barWidth: 12, itemStyle: { color: (p) => I[p.dataIndex].s / I[p.dataIndex].m >= .6 ? '#13806E' : I[p.dataIndex].s ? '#E0A21F' : '#C2441F', borderRadius: 4 }, label: { show: true, position: 'right', formatter: (p) => I[p.dataIndex].s + '/' + I[p.dataIndex].m, fontWeight: 800, color: warnaTeks() } }] }),
    };
  },

};

let panelAktif = null;
function wadahPanel() { return mqHP.matches ? $('#panel-hp') : $('#panel-isi'); }
function renderPanel() {
  bersihChart(); const el = wadahPanel(); (mqHP.matches ? $('#panel-isi') : $('#panel-hp')).innerHTML = '';
  const P = PANEL[S.lapis](); el.innerHTML = P.html; panelAktif = P;
  el.scrollTop = 0;
  requestAnimationFrame(() => { if (panelAktif !== P) return; if (P.charts) P.charts(); if (P.after) P.after(); hitungAngka(el); });
  if (!reduce) anime({ targets: el.children, opacity: [0, 1], translateY: [12, 0], delay: anime.stagger(45), duration: 520, easing: 'easeOutCubic' });
  setTimeout(() => [...el.children].forEach((c) => { c.style.opacity = ''; c.style.transform = ''; }), 1400);
}
function hitungAngka(root) {
  $$('[data-n]', root).forEach((s) => { if (!s.dataset.n) return; const tgt = +s.dataset.n, d = +s.dataset.d, o = { v: 0 }; anime({ targets: o, v: tgt, duration: reduce ? 1 : 1100, easing: 'easeOutExpo', update: () => s.textContent = nf(o.v, d) }); setTimeout(() => s.textContent = nf(tgt, d), 1400); });
}
let renderTimer = 0;
function renderPanelLembut() { clearTimeout(renderTimer); renderTimer = setTimeout(renderPanel, 300); }

function renderLegenda() {
  const L = rep3d(), mode = LENSA[S.lapis].overlay === 'variety' ? S.varMode : (LENSA[S.lapis].overlay || L); let h = '';
  const sk = (st, kiri, kanan, tengah = '') => `<div class="sk" style="background:${grad(st)}"></div><div class="tk"><span>${kiri}</span>${tengah ? `<span>${tengah}</span>` : ''}<span>${kanan}</span></div>`;
  const li = (c, t) => `<div class="li"><i style="background:${c}"></i>${t}</div>`;
  switch (mode) {
    case 'akses': h = '<b>Menit jalan ke transit</b>' + sk(RAMP.akses, '0', '15+', '7,5'); break;
    case 'walk': case 'jaringan': h = JUM.uMode.value > .5 ? '<b>Kelas jalan (OSM)</b>' + li('#D6452F', 'arteri primer') + li('#EB8C2E', 'sekunder') + li('#EDBF40', 'tersier') + li('#8C8C99', 'lokal & servis') + li('#1F9A6B', 'jalur pejalan') : '<b>Menit jalan kaki dari MRT</b>' + sk([[0, '#0D8C5C'], [.25, '#F2C733'], [.5, '#DB452B'], [1, '#73336B']], '0', '20+', '10'); break;
    case 'muka': h = '<b>Muka aktif jalan</b>' + sk([[0, '#737F94'], [1, '#FA78AD']], 'dinding buta', 'etalase menerus'); break;
    case 'lu': case 'ringkasan': h = '<b>Fungsi bangunan</b>' + Object.entries(LU_NAMA).map(([k, n]) => li(LU_COL[k], n)).join(''); break;
    case 'mix': h = '<b>Indeks campuran</b>' + sk(RAMP.mix, '1 fungsi', 'merata'); break;
    case 'termal': h = '<b>Indeks panas permukaan</b>' + sk(RAMP.panas, 'sejuk', 'panas') + li('#555', 'bayangan aktual'); break;
    case 'angin': h = '<b>Angin pejalan (m/s)</b>' + sk(RAMP.angin, '0', '4+', '2'); break;
    case 'bising': h = '<b>Kebisingan siang dB(A)</b>' + sk(RAMP.bising, '45', '85', '70') + li('#9E1F1A', 'area terminal & arteri'); break;
    case 'fas': h = '<b>Jenis fasilitas ≤10 menit</b>' + sk(RAMP.fas, '0', '8', '4'); break;
    case 'rth': h = '<b>Jarak ke ruang hijau</b>' + sk(RAMP.rth, '0 m', '600+ m', '300'); break;
    case 'sosial': h = '<b>Kunjungan per jam</b>' + sk(RAMP.sos, 'sepi', nf(Math.round(hexMax / 10) * 10) + '+'); break;
    case 'morfologi': h = '<b>Tipe Spacematrix</b>' + Object.entries(TIPE_COL).map(([k, c]) => li(c, k)).join(''); break;
    case 'tod': h = '<b>Keliling blok (ITDP)</b>' + li('#1F9A62', '&lt;250 m') + li('#E0A21F', '250 sampai 400 m') + li('#C2441F', '&gt;400 m (superblok)') + li('#13806E', 'persimpangan') + li('#2F6BD8', 'halte & stasiun'); break;
  }
  $('#legenda').innerHTML = h; $('#legenda-hp').innerHTML = mqHP.matches && h ? `<div class="legenda-isi">${h}</div>` : '';
}

// =============================================================
//  Ganti lensa
// =============================================================
function setLapis(id, kamera = true) {
  if (!LENSA[id]) id = 'ringkasan';
  const L = LENSA[id], lama = S.lapis; S.lapis = id; const R = rep3d(id);
  document.documentElement.style.setProperty('--c', L.warna);
  tandaiNavigasi();
  warnaiBangunan(L.bangunan);
  if (L.overlay) { gambarOverlay(); anime({ targets: ovMat, opacity: [0, 1], duration: 650, easing: 'easeOutQuad' }); }
  else anime({ targets: ovMat, opacity: 0, duration: 400, easing: 'easeOutQuad' });
  catcher.material.opacity = L.overlay ? .3 : .14;
  wLines.visible = R === 'angin'; if (R === 'angin' && !WD) muatAngin().then(() => { if (rep3d() === 'angin') { gambarOverlay(); renderPanel(); } }); hexMesh.visible = R === 'sosial'; sosGrow = 0; if (R === 'sosial') updateHex();
  selubung.visible = false;
  jarMesh.visible = R === 'walk' || R === 'muka'; if (jarMesh.visible) { JUM.uMode.value = R === 'muka' ? 2 : 0; jarT0 = performance.now(); }
  blokGrp.visible = R === 'morfologi' || R === 'tod'; if (blokGrp.visible) { warnaiBlok(R); sorotBlok(null); }
  simpang.visible = R === 'tod'; halte.visible = ['tod', 'walk', 'akses'].includes(R);
  orang.visible = S.orang;
  bMat.transparent = R === 'sosial'; bMat.opacity = R === 'sosial' ? .32 : 1; bMat.needsUpdate = true;
  ring.visible = ['walk', 'akses', 'ringkasan'].includes(R);
  pohonBaru.visible = R === 'termal' && S.pohonSkenario;
  for (const o of LBL) o.sembunyi = (o.grup === 'transit' && !['ringkasan', 'akses', 'walk', 'sosial', 'fasilitas', 'tod'].includes(R)) || (o.grup === 'ring' && !ring.visible) || (o.grup === 'zona' && !S.fokus);
  renderPanel(); renderLegenda();
  if (kamera && !cerita.aktif) { if (R === 'termal' && !S.main) animJam(13.5); if (R === 'sosial' && !S.main && (S.jam < 16 || S.jam > 21.5)) animJam(19.5); }
}
function setSkenarioPohon(on) {
  S.pohonSkenario = on; pohonBaru.visible = on && S.lapis === 'termal';
  anime({ targets: pohonBaru.scale, y: on ? [0.01, 1] : 0.01, duration: on ? 1100 : 300, easing: on ? 'easeOutElastic(1,.6)' : 'easeInQuad' });
  renderPanel();
}

// =============================================================
//  Kamera & tampilan
// =============================================================
// sudut pandang jalan: di atas as Jl. Melawai Raya, menghadap sepanjang jalan (bebas bangunan & pohon)
const JALAN_V = (() => { const pts = []; O.seg.forEach((g) => { if (g.n === 'Jalan Melawai Raya') for (let k = 0; k < g.p.length; k += 2) pts.push([g.p[k], g.p[k + 1]]); }); if (pts.length < 2) return { pos: [120, 34, 175], tgt: [420, 20, 30] };
  const cx = avg(pts.map((p) => p[0])), cz = avg(pts.map((p) => p[1])); let a = 0, b = 0, c = 0; pts.forEach(([x, z]) => { a += (x - cx) ** 2; b += (x - cx) * (z - cz); c += (z - cz) ** 2; });
  const th = .5 * Math.atan2(2 * b, a - c), dx = Math.cos(th), dz = Math.sin(th); return { pos: [cx - dx * 170, 17, cz - dz * 170], tgt: [cx + dx * 230, 2, cz + dz * 230] }; })();
const VIEWS = {
  iso: { nama: 'Isometrik', fov: 16, off: [1500, 1280, 1500], ikon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>' },
  persp: { nama: 'Perspektif', fov: 42, off: [560, 380, 640], ikon: '<path d="M3 19l6-12h6l6 12z"/><path d="M9 7l-1 12M15 7l1 12"/>' },
  burung: { nama: 'Mata burung', fov: 34, off: [-620, 360, 520], ikon: '<path d="M3 12c3-4 6-4 9 0 3-4 6-4 9 0"/><path d="M12 12v6"/>' },
  atas: { nama: 'Atas', fov: 30, off: [0, 1500, 1], ikon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>' },
  jalan: { nama: 'Jalan', fov: 50, pos: JALAN_V.pos, tgt: JALAN_V.tgt, ikon: '<circle cx="12" cy="5" r="2"/><path d="M12 7v7M9 21l3-7 3 7M8 11h8"/>' },
};
function setView(nama, transisi = true) {
  const v = VIEWS[nama]; S.view = nama; $$('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === nama)); const bv = $('#b-view'); if (bv) bv.innerHTML = ikonSvg(v.ikon);
  const portrait = innerWidth / innerHeight < 1, k = portrait ? 2.1 : 1;
  const tgt = v.tgt || [BC[0], 0, BC[1]], pos = v.pos || [tgt[0] + v.off[0] * k, v.off[1] * k, tgt[2] + v.off[2] * k];
  anime({ targets: camera, fov: v.fov, duration: transisi && !reduce ? 1400 : 1, easing: 'easeInOutCubic', update: () => camera.updateProjectionMatrix() });
  cc.setLookAt(...pos, ...tgt, transisi && !reduce);
}
function terbangKe(x, z, jarak = 360) {
  const az = cc.azimuthAngle; cc.setLookAt(x + Math.sin(az) * jarak * .8, jarak * .7, z + Math.cos(az) * jarak * .8, x, 0, z, true);
  if (camera.fov < 30) anime({ targets: camera, fov: 38, duration: 1200, easing: 'easeInOutCubic', update: () => camera.updateProjectionMatrix() });
}

// =============================================================
//  Interaksi: probe & pilih bangunan
// =============================================================
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
let downXY = null, probeT = 0;
function setRay(e) { mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera); }
canvas.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; cerita.stop(); });
canvas.addEventListener('pointerup', (e) => { if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 6) return; klik(e); });
canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || e.buttons) { $('#probe').classList.remove('on'); return; } const now = performance.now(); if (now - probeT < 40) return; probeT = now; probe(e); });
canvas.addEventListener('pointerleave', () => $('#probe').classList.remove('on'));
function probe(e, tap = false) {
  setRay(e); const hb = ray.intersectObject(bMesh, false)[0]; const pr = $('#probe');
  if (hb) { const b = B[bBid[hb.faceIndex * 3]]; pr.innerHTML = `<b>${b.n || LU_NAMA[b.u]}</b><br><span class="tg">${b.f} lantai · ±${Math.round(b.h)} m</span>`; }
  else { if (!ray.ray.intersectPlane(planeY, hitP)) return pr.classList.remove('on'); const i = cellOf(hitP.x, hitP.z); if (i < 0) return pr.classList.remove('on'); pr.innerHTML = nilaiProbe(i); }
  pr.style.left = Math.min(innerWidth - 250, e.clientX) + 'px'; pr.style.top = e.clientY + 'px'; pr.classList.add('on');
  if (tap) { clearTimeout(probe.t); probe.t = setTimeout(() => pr.classList.remove('on'), 2600); }
}
function klik(e) {
  setRay(e); const hb = ray.intersectObject(bMesh, false)[0];
  if (hb) pilihBangunan(bBid[hb.faceIndex * 3]); else { tutupInfo(); if (e.pointerType !== 'mouse') probe(e, true); }
}
function tutupInfo() { $('#info').hidden = true; sorot(null); }
function pilihBangunan(i, terbang = false) {
  const b = B[i]; sorot(i); if (terbang) terbangKe(b.c[0], b.c[1], Math.max(260, b.h * 4));
  const gi = cellOf(b.c[0], b.c[1]); let bis = NaN;
  for (let r = 1; r < 6 && bis !== bis; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const k = gi + dj * GW + di; const v = val.bising(k); if (v === v && (bis !== bis || v > bis)) bis = v; }
  const inti = B_IN[i];
  $('#info').hidden = false;
  $('#info').innerHTML = `<button class="x" aria-label="Tutup">✕</button><span class="pill" style="background:${LU_COL[b.u]}2e;color:${LU_COL[b.u]}">${LU_NAMA[b.u]}${inti ? ' · kawasan inti' : ''}</span>
    <h3>${b.n || 'Bangunan #' + (i + 1)}</h3><p class="lede" style="font-size:12px">Tinggi: ${b.s}${b.osm ? ` · <a href="https://www.openstreetmap.org/${b.osm}" target="_blank" rel="noopener">lihat di OSM</a>` : ''}</p>
    <div class="kpi-grid">${kpi(b.f, 'lantai')}${kpi(Math.round(b.h), 'tinggi', ' m')}${kpi(b.a, 'luas tapak', ' m²')}${kpi(Math.round(b.a * b.f * .85), 'est. luas lantai', ' m²')}${kpi(bis === bis ? Math.round(bis) : '-', 'bising fasad', ' dB(A)', 0, bis > (({ 3: 55, 5: 60, 8: 55 })[b.u] || 70) ? 'status-no' : 'status-ok')}${kpi(({ 3: 55, 5: 60, 8: 55 })[b.u] || 70, 'baku mutu fungsinya', ' dB(A)')}</div>
    <p class="sumber">±${nf(val.akses(gi), 1)} menit jalan ke transit · indeks panas ${nf(val.panas(gi) * 100, 0)}/100</p>`;
  $('#info .x').onclick = tutupInfo; hitungAngka($('#info'));
}

// =============================================================
//  Waktu
// =============================================================
function setJam(h) {
  S.jam = h; $('#slider').value = h; $('#jam').textContent = fmtJam(h); setMatahari();
  $('#jam-info').textContent = SUN.elDeg > 0 ? `Matahari ${nf(SUN.elDeg, 0)}° · ${nf(suhuUdara(h), 1)} °C` : 'Malam · lampu kota menyala';
  if (rep3d() === 'termal') { gambarOverlay(); renderPanelLembut(); }
  if (rep3d() === 'sosial') { updateHex(); if (S.lapis === 'sosial') renderPanelLembut(); }
}
function animJam(tgt) { const o = { h: S.jam }; anime({ targets: o, h: tgt, duration: reduce ? 1 : 1500, easing: 'easeInOutCubic', update: () => setJam(o.h) }); }
function berhenti() { S.main = false; $('#main').classList.remove('on'); $('#ikon-main').innerHTML = '<path d="M6 4l14 8-14 8z"/>'; }
function gambarRitme() {
  let d = '', mx = 0; const vals = []; for (let h = 5; h <= 24; h += .25) { const v = totalJam(Math.floor(h) % 24); vals.push(v); mx = Math.max(mx, v); }
  vals.forEach((v, i) => d += (i ? 'L' : 'M') + (i / (vals.length - 1) * 300).toFixed(1) + ' ' + (34 - v / mx * 30).toFixed(1));
  let ss = ''; for (let h = 5; h <= 24; h += .5) { const e = posisiMatahari(S.doy, h).elDeg; if (e > 0) ss += `<rect x="${((h - 5) / 19 * 300).toFixed(1)}" y="0" width="${(.5 / 19 * 300).toFixed(1)}" height="36" fill="#F6C177" opacity="${(.06 + e / 90 * .2).toFixed(2)}"/>`; }
  $('#ritme').innerHTML = ss + `<path d="${d}L300 36L0 36Z" fill="var(--c)" opacity=".16"/><path d="${d}" fill="none" stroke="var(--c)" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`;
}

// =============================================================
//  Tur cerita
// =============================================================
const CERITA = [
  { l: 'ringkasan', v: 'iso', j: 16.5, t: 'Ruang publik Blok M di Place Diagram', p: `Empat atribut Project for Public Spaces menghasilkan skor ${PPS.total || '…'}; skor kelayakan AHP hasil studi sebelumnya ${SK.total}. Keduanya dibaca berdampingan.` },
  { l: 'akses', v: 'persp', j: 8, t: 'Simpul transit terpadat', p: `Stasiun MRT Blok M BCA melayani 553.599 pelanggan pada Desember 2025. ${nf(VS.akses5, 0)}% kawasan inti cukup 5 menit jalan kaki ke angkutan massal. Kereta berhenti 30 detik di stasiun.` },
  { l: 'walk', v: 'iso', j: 9, t: 'Jangkauan jalan kaki yang nyata', p: `Gelombang merambat dari pintu MRT di sepanjang jalan OpenStreetMap. Hanya ${nf(OS.pedshed400, 0)}% lingkaran 400 m benar-benar terjangkau; selisihnya adalah jalan memutar.` },
  { l: 'tod', v: 'atas', j: 10, t: 'Blok yang terlalu besar', p: `Median keliling blok ${nf(OS.blok_med, 0)} m. Standar TOD menyarankan di bawah 250 m: blok merah adalah kandidat tembusan pejalan.` },
  { l: 'termal', v: 'burung', j: 13.5, t: 'Siang yang terik', p: 'Bayangan dihitung dari posisi matahari aktual. Hanya sebagian kecil jalur yang ternaungi saat tengah hari; skenario pohon peneduh ada di panel.' },
  { l: 'bising', v: 'burung', j: 17, t: 'Arteri dan terminal yang bising', p: `Area Terminal Bus Blok M rata-rata ${nf(VS.bising_terminal, 0)} dB(A). ${nf(VS.fasad_lewat, 0)}% fasad kawasan inti melewati baku mutu fungsinya.` },
  { l: 'sosial', v: 'burung', j: 19.5, t: 'Blok M hidup di malam hari', p: 'Kolom dan figur orang mengikuti perkiraan kunjungan per jam yang dipatok ke 80.000 pengunjung/hari. Puncaknya menjelang pukul 19.00 sampai 20.00.' },
  { l: 'muka', v: 'burung', j: 19.8, t: 'Jalan yang dibatasi etalase', p: `${nf(V4.muka, 0)}% panjang jalan kawasan inti bermuka aktif. Koridor Melawai paling hidup, sisi arteri paling sepi.` },
];
const cerita = {
  aktif: false, i: 0, t: 0,
  mulai() { this.aktif = true; this.i = 0; $('#b-tur').classList.add('on'); this.tampil(); },
  stop() { if (!this.aktif) return; this.aktif = false; clearTimeout(this.t); $('#cerita').hidden = true; $('#b-tur').classList.remove('on'); },
  tampil() {
    const s = CERITA[this.i], dur = 8000; clearTimeout(this.t);
    location.hash = s.l; setLapis(s.l, false); setView(s.v); berhenti(); animJam(s.j);
    const el = $('#cerita'); el.hidden = false; el.style.setProperty('--d', dur + 'ms');
    el.innerHTML = `<span class="langkah">Tur cerita · ${this.i + 1} dari ${CERITA.length}</span><h3>${s.t}</h3><p>${s.p}</p>
      <div class="nav"><div class="titik">${CERITA.map((_, k) => `<i class="${k < this.i ? 'lewat' : k === this.i ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn" id="c-prev" type="button" ${this.i ? '' : 'disabled'}>‹</button><button class="btn primer" id="c-next" type="button">${this.i === CERITA.length - 1 ? 'Selesai' : 'Lanjut ›'}</button><button class="btn" id="c-x" type="button" aria-label="Tutup tur">✕</button></div>`;
    $('#c-prev').onclick = () => { this.i = Math.max(0, this.i - 1); this.tampil(); };
    $('#c-next').onclick = () => this.lanjut(); $('#c-x').onclick = () => this.stop();
    this.t = setTimeout(() => this.lanjut(), dur);
  },
  lanjut() { if (this.i >= CERITA.length - 1) { this.stop(); setLapis('ringkasan'); location.hash = 'ringkasan'; setView('iso'); return; } this.i++; this.tampil(); },
};

// =============================================================
//  Lembar bawah (HP)
// =============================================================
const sheet = {
  el: $('#sheet'), state: 'peek',
  set(s) { this.state = s; this.el.classList.remove('half', 'full'); if (s !== 'peek') this.el.classList.add(s); setTimeout(() => charts.forEach((c) => c.resize()), 560); },
  init() {
    let y0 = 0, t0 = 0, base = 0, drag = false; const g = $('#pegangan'), el = this.el;
    const H = () => el.getBoundingClientRect().height;
    const PEEK = () => parseFloat(getComputedStyle(el).getPropertyValue('--peek')) || 182;
    const pos = () => ({ peek: H() - PEEK(), half: H() * .45, full: 0 }[this.state]);
    const start = (e) => { drag = true; y0 = e.clientY; t0 = performance.now(); base = pos(); el.classList.add('seret'); g.setPointerCapture(e.pointerId); };
    const move = (e) => { if (!drag) return; const y = clamp(base + e.clientY - y0, 0, H() - 120); el.style.transform = `translateY(${y}px)`; };
    const end = (e) => { if (!drag) return; drag = false; el.classList.remove('seret'); el.style.transform = ''; const dy = e.clientY - y0, v = dy / (performance.now() - t0); const y = base + dy; const order = ['full', 'half', 'peek'];
      let s; if (Math.abs(v) > .5) s = v < 0 ? (this.state === 'peek' ? 'half' : 'full') : (this.state === 'full' ? 'half' : 'peek'); else { const c = { full: 0, half: H() * .45, peek: H() - PEEK() }; s = order.reduce((a, b) => Math.abs(c[b] - y) < Math.abs(c[a] - y) ? b : a); }
      if (Math.abs(dy) < 6) s = this.state === 'peek' ? 'half' : 'peek'; this.set(s); };
    g.addEventListener('pointerdown', start); g.addEventListener('pointermove', move); g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  },
};

// =============================================================
//  UI: rel atribut, navigasi bawah, menu bertingkat, panduan, metodologi
// =============================================================
const ikonSvg = (p, w = 18) => `<svg class="i" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IK_ATR = { ringkasan: IK.ringkasan, akses: IK.pakses, nyaman: IK.pnyaman, guna: IK.pguna, sosial: IK.psosial };
const CHEV = '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
function tombolLensa(id) {
  const L = LENSA[id];
  return `<button class="lensa${L.induk ? ' induk' : ''}" data-l="${id}" data-tip="${L.nama}" style="--k:${L.warna}" type="button"><i>${ikonSvg(IK[id], 17)}</i><span>${L.nama}<small>${L.sub}</small></span><b class="skor">${L.skor()}</b><span class="info-btn" role="button" data-metode="${id}" title="Metodologi ${L.nama}">i</span></button>`;
}
let grupChips = '';
function bangunNavigasi() {
  let h = tombolLensa('ringkasan');
  for (const k in ATR) {
    const anak = Object.keys(LENSA).filter((id) => LENSA[id].grup === k && !LENSA[id].induk);
    h += `<div class="atr" data-atr="${k}" style="--k:${warnaAtr(k)}"><button class="atr-kepala" type="button" data-l="p${k}" data-tip="${ATR[k].nama}"><i></i><span>${ATR[k].nama}<small>${ATR[k].en} · ${anak.length} lensa</small></span><b class="skor">${PPS[k].skor}</b>${CHEV}</button><div class="atr-isi"><div>${anak.map(tombolLensa).join('')}</div></div></div>`;
  }
  $('#rel').innerHTML = h;
  $('#navbawah').innerHTML = Object.keys(INDUK).map((k) => `<button type="button" data-nav="${k}" style="--k:${warnaAtr(k)}">${ikonSvg(IK_ATR[k], 21)}<span>${k === 'ringkasan' ? 'Ringkasan' : ATR[k].pendek}</span></button>`).join('');
  grupChips = ''; tandaiNavigasi();
}
function tandaiNavigasi() {
  const L = LENSA[S.lapis], g = L.grup;
  $$('[data-l]').forEach((b) => b.classList.toggle('on', b.dataset.l === S.lapis));
  $$('.atr').forEach((a) => { if (a.dataset.atr === g) a.classList.remove('lipat'); });
  $$('[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === g));
  if (grupChips !== g) {
    grupChips = g; const ids = g === 'ringkasan' ? ['ringkasan', 'pakses', 'pnyaman', 'pguna', 'psosial'] : Object.keys(LENSA).filter((id) => LENSA[id].grup === g);
    $('#chips').innerHTML = ids.map(tombolLensa).join('');
    $$('#chips [data-l]').forEach((b) => b.classList.toggle('on', b.dataset.l === S.lapis));
  }
  const chip = $(`#chips [data-l="${S.lapis}"]`); if (chip && mqHP.matches) chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  const aktif = $(`#rel [data-l="${S.lapis}"]`); if (aktif && !mqHP.matches) aktif.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ---------- tema, peta dasar, fokus ----------
function setTema(t) {
  S.tema = t; document.documentElement.dataset.tema = t; simpan('psa-tema', t);
  document.querySelector('meta[name=theme-color]').content = t === 'gelap' ? '#0E131A' : '#EEF2F6';
  warnaiLensa(); document.documentElement.style.setProperty('--c', LENSA[S.lapis].warna);
  bangunNavigasi(); gambarRitme(); renderPanel(); renderLegenda(); LBL.forEach((o) => o.w = 0);
}
function setPeta(k) {
  const pakai = () => { petaDasar = k; groundMat.map = texAktif(); groundMat.needsUpdate = true; };
  if (TEX[k]) return pakai();
  muatSkrip(`aset_${k}.js`).then(() => { pasangTex(k, window['ASET_' + k.toUpperCase()]); pakai(); }).catch(() => {});
}
function setFokus(on) { S.fokus = on; anime({ targets: U.uFocus, value: on ? 1 : 0, duration: 600, easing: 'easeInOutQuad' }); if (LENSA[S.lapis].overlay) gambarOverlay(); batas.visible = on; zonaLbl.sembunyi = !on; }

// ---------- menu bertingkat: Menu > Submenu > Opsi ----------
const MI = {
  tampil: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/>', lapis: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', waktu: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  jelajah: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', bantu: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.5"/>', tentang: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 10h6M9 14h6M9 18h4"/>',
};
const LOK = [['MRT Blok M BCA', ...tm(515, 462)], ['Terminal Bus Blok M', ...tm(600, 375)], ['Blok M Square', ...tm(712, 452)], ['Plaza Blok M', ...tm(452, 425)], ['Taman Literasi', ...tm(548, 352)], ['M Bloc Space', ...tm(548, 228)], ['Little Tokyo (Melawai)', ...tm(585, 432)], ['Pasaraya & Menara Sentraya', ...tm(900, 470)]];
const MENU = () => ({ judul: 'Menu', item: [
  { ik: MI.tampil, t: 'Tampilan', sub: 'Tema, peta dasar, label', ke: () => ({ judul: 'Tampilan', item: [
    { label: 'Tema antarmuka' }, { t: 'Gelap', radio: () => S.tema === 'gelap', aksi: () => setTema('gelap') }, { t: 'Terang', radio: () => S.tema === 'terang', aksi: () => setTema('terang') },
    { label: 'Peta dasar' }, ...[['dasar', 'Minimal'], ['peta', 'Peta OSM'], ['satelit', 'Satelit']].map(([k, t]) => ({ t, radio: () => petaDasar === k, aksi: () => setPeta(k) })),
    { label: 'Peta' }, { t: 'Fokus kawasan inti', sub: 'redupkan bangunan di luar batas', saklar: () => S.fokus, aksi: () => setFokus(!S.fokus) }, { t: 'Label tempat', saklar: () => S.label, aksi: () => { S.label = !S.label; } }] }) },
  { ik: MI.lapis, t: 'Lapisan 3D', sub: 'Orang, kendaraan, MRT, pohon', ke: () => ({ judul: 'Lapisan 3D', item: [
    { t: 'Orang', sub: 'berjalan, berkumpul, duduk, menunggu', saklar: () => S.orang, aksi: () => { S.orang = !S.orang; orang.visible = S.orang; } },
    { t: 'Kendaraan', sub: 'mobil, motor, bus, TransJakarta', saklar: () => S.kendaraan, aksi: () => { S.kendaraan = !S.kendaraan; lampu.visible = S.kendaraan; } },
    { t: 'Kereta MRT', sub: 'kecepatan nyata, berhenti di stasiun', saklar: () => S.mrt, aksi: () => { S.mrt = !S.mrt; } },
    { label: 'Jadwal MRT (rasio waktu tampil)' }, ...[[1, '1:1 · asli', 'headway 5/10 menit'], [2, '1:2', 'kereta tampil 2× lebih sering'], [3, '1:3 · bawaan', 'tiap ±1,7 menit saat jam sibuk']].map(([r, t, sub]) => ({ t, sub, radio: () => S.rasioMRT === r, aksi: () => { S.rasioMRT = r; } })),
    { t: 'Pohon', saklar: () => pohon.visible, aksi: () => { pohon.visible = !pohon.visible; } },
    { label: 'Kualitas grafis' }, ...[['otomatis', 'Otomatis', 'turun sendiri bila perangkat berat'], ['tinggi', 'Tinggi', 'bayangan halus, efek cahaya malam'], ['hemat', 'Hemat', 'lebih ringan untuk HP & laptop lama']].map(([k, t, sub]) => ({ t, sub, radio: () => S.kualitas === k, aksi: () => terapkanKualitas(k) }))] }) },
  { ik: MI.waktu, t: 'Waktu', sub: 'Jam, tanggal, kecepatan', ke: () => ({ judul: 'Waktu', item: [
    { label: 'Lompat ke' }, ...[['Pagi', 7.5, 'jam sibuk berangkat'], ['Siang', 12.5, 'matahari tertinggi'], ['Sore', 17.8, 'jam sibuk pulang'], ['Malam', 20, 'puncak keramaian']].map(([t, j, sub]) => ({ t: `${t} · ${fmtJam(j)}`, sub, aksi: () => { berhenti(); animJam(j); } })),
    { label: 'Tanggal (posisi matahari)' }, ...[[80, '21 Maret'], [172, '21 Juni'], [264, '21 September'], [355, '21 Desember']].map(([d, t]) => ({ t, radio: () => S.doy === d, aksi: () => { S.doy = d; setJam(S.jam); gambarRitme(); if (rep3d() === 'termal') renderPanel(); } })),
    { label: 'Kecepatan simulasi' }, ...[[.5, '0,5×'], [1, '1× (waktu nyata untuk orang, kendaraan, MRT)'], [3, '3×']].map(([v, t]) => ({ t, radio: () => S.kecepatan === v, aksi: () => { S.kecepatan = v; } }))] }) },
  { ik: MI.jelajah, t: 'Jelajah', sub: 'Lokasi penting, tur cerita', ke: () => ({ judul: 'Jelajah', item: [
    { t: 'Terbang ke lokasi', sub: `${LOK.length} tempat penting`, ke: () => ({ judul: 'Terbang ke lokasi', item: LOK.map(([n, x, z]) => ({ t: n, aksi: () => { tutupMenu(); cerita.stop(); terbangKe(x, z, 320); } })) }) },
    { t: 'Tur cerita', sub: `${CERITA.length} langkah, kamera otomatis`, aksi: () => { tutupMenu(); cerita.mulai(); } }] }) },
  { ik: MI.bantu, t: 'Bantuan', sub: 'Panduan singkat, pintasan', ke: () => ({ judul: 'Bantuan', item: [
    { t: 'Panduan singkat', sub: '4 langkah memakai peta', aksi: () => { tutupMenu(); bukaPanduan(); } },
    { t: 'Pintasan keyboard & remote', sub: 'untuk desktop dan TV', aksi: () => { tutupMenu(); bukaPintasan(); } }] }) },
  { ik: MI.tentang, t: 'Tentang', sub: 'Metodologi, data, lisensi', ke: () => ({ judul: 'Tentang', item: [
    { t: 'Metodologi & sumber', sub: 'kerangka PPS, model, validasi', aksi: () => { tutupMenu(); bukaMetode('kerangka'); } },
    { t: 'Data & lisensi', sub: 'OSM, citra, sumber terukur', aksi: () => { tutupMenu(); bukaMetode('data'); } },
    { t: 'Dashboard 2D', sub: 'radius 800 m dari MRT', href: '2d/' }] }) },
] });
let menuStack = [];
function renderMenu(arah = 0) {
  const lv = menuStack[menuStack.length - 1], jejak = menuStack.slice(0, -1).map((m) => m.judul).join(' › ');
  const btn = (it, i) => {
    if (it.label) return `<div class="menu-label">${it.label}</div>`;
    const kanan = it.ke ? `<span class="panah">${ikonSvg('<path d="M9 6l6 6-6 6"/>', 16)}</span>` : it.radio ? `<span class="cek">${it.radio() ? '✓' : ''}</span>` : it.saklar ? '<span class="sakelar"></span>' : '';
    const on = (it.radio && it.radio()) || (it.saklar && it.saklar());
    const kiri = it.ik ? `<span class="ik">${ikonSvg(it.ik, 16)}</span>` : '<span></span>';
    return it.href ? `<a class="mi" href="${it.href}" style="text-decoration:none">${kiri}<span>${it.t}<small>${it.sub || ''}</small></span><span class="panah">↗</span></a>` : `<button class="mi${on ? ' on' : ''}" type="button" data-mi="${i}">${kiri}<span>${it.t}${it.sub ? `<small>${it.sub}</small>` : ''}</span>${kanan}</button>`;
  };
  $('#menu').innerHTML = `<div class="menu-kepala">${menuStack.length > 1 ? `<button class="tb kotak" id="menu-balik" type="button" aria-label="Kembali">${ikonSvg('<path d="M15 6l-6 6 6 6"/>', 16)}</button>` : ''}<h3>${jejak ? `<span class="jejak">${jejak}</span>` : ''}${lv.judul}</h3></div><div class="menu-level">${lv.item.map(btn).join('')}</div>`;
  if (arah && !reduce) anime({ targets: '#menu .menu-level, #menu .menu-kepala h3', translateX: [arah * 36, 0], opacity: [0, 1], duration: 380, easing: 'easeOutCubic' });
  $$('#menu [data-mi]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); const it = lv.item[+b.dataset.mi]; if (it.ke) { menuStack.push(it.ke()); renderMenu(1); } else { it.aksi(); if (menuStack.length && !$('#menu').hidden) { menuStack[menuStack.length - 1] = (menuStack.length === 1 ? MENU() : menuStack[menuStack.length - 1]); renderMenu(0); } } });
  const bb = $('#menu-balik'); if (bb) bb.onclick = (e) => { e.stopPropagation(); menuStack.pop(); renderMenu(-1); };
  const pertama = $('#menu .mi'); if (pertama && document.body.classList.contains('tv')) pertama.focus();
}
function bukaMenu() { const m = $('#menu'); menuStack = [MENU()]; renderMenu(0); m.hidden = false; m.classList.remove('buka'); void m.offsetWidth; m.classList.add('buka'); $('#b-menu').setAttribute('aria-expanded', 'true'); if (!reduce) anime({ targets: '#menu .mi', translateY: [8, 0], opacity: [0, 1], delay: anime.stagger(35), duration: 360, easing: 'easeOutCubic' }); }
function tutupMenu() { $('#menu').hidden = true; $('#b-menu').setAttribute('aria-expanded', 'false'); const vp = $('#view-pop'); if (vp) vp.hidden = true; }

// ---------- panduan singkat ----------
function bukaPanduan() {
  const hp = mqHP.matches, tab = mqTab.matches;
  $('#isi-panduan').innerHTML = `<h2 id="pd-j">Panduan singkat · <span>Public Space Analysis</span></h2>
    <p class="lede">Peta 3D ini menilai ruang publik kawasan inti Blok M (${nf(VS.luas_ha, 0)} ha) dengan <b>Place Diagram</b> dari Project for Public Spaces, lalu membandingkannya dengan <b>skor kelayakan AHP</b> hasil studi sebelumnya.</p>
    <div class="langkah-grid">
      <div class="lk"><i>${ikonSvg(IK.pakses, 20)}</i><em>LANGKAH 1</em><b>Pilih atribut</b><span>${hp ? 'Ketuk tab di bawah' : 'Pilih di panel kiri'}: Akses, Kenyamanan, Kegunaan, Sosiabilitas. Tiap atribut berisi beberapa lensa.</span></div>
      <div class="lk"><i>${ikonSvg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', 20)}</i><em>LANGKAH 2</em><b>Baca panel</b><span>Skor, grafik, dan temuan. Tombol <b>Metodologi</b> di tiap lensa menjelaskan cara ukur, asumsi, dan sumbernya.</span></div>
      <div class="lk"><i>${ikonSvg(MI.waktu, 20)}</i><em>LANGKAH 3</em><b>Geser waktu</b><span>Bayangan, keramaian orang, kendaraan, dan jadwal MRT berubah mengikuti jam di ${hp ? 'lembar bawah' : 'dok bawah'}.</span></div>
      <div class="lk"><i>${ikonSvg('<path d="M9 11V5a2 2 0 1 1 4 0v6M13 10a2 2 0 1 1 4 0v4a6 6 0 0 1-12 0v-2a2 2 0 1 1 4 0"/>', 20)}</i><em>LANGKAH 4</em><b>Sentuh peta</b><span>${hp ? 'Ketuk' : 'Klik'} bangunan untuk kartu info, atau tanah untuk nilai di titik itu.</span></div>
    </div>
    <div class="gestur">
      <div><b>${hp || tab ? 'Layar sentuh' : 'Mouse'}</b>${hp || tab ? 'Satu jari: putar. Dua jari: zoom dan geser.' : 'Seret: putar. Klik kanan: geser. Gulir: zoom.'}</div>
      <div><b>Sudut pandang</b>${hp ? 'Tombol kubus di kanan atas: isometrik, perspektif, mata burung, atas, jalan.' : 'Toolbar atas: isometrik, perspektif, mata burung, atas, jalan.'}</div>
      <div><b>Keyboard / remote TV</b>Panah atas/bawah: lensa. Kiri/kanan: sudut pandang. OK: metodologi. M: menu.</div>
    </div>
    <div class="aksi"><button class="btn" id="pd-jelajah" type="button">Jelajah sendiri</button><button class="btn primer" id="pd-tur" type="button">${ikonSvg('<path d="M7 4.5v15l12-7.5z"/>', 14)}Mulai tur cerita</button></div>`;
  $('#panduan').hidden = false;
  $('#pd-jelajah').onclick = () => { $('#panduan').hidden = true; simpan('psa-panduan', 1); };
  $('#pd-tur').onclick = () => { $('#panduan').hidden = true; simpan('psa-panduan', 1); cerita.mulai(); };
}
function bukaPintasan() {
  const r = [['↑ / ↓', 'lensa sebelum / berikutnya'], ['← / →', 'sudut pandang sebelum / berikutnya'], ['Enter / OK', 'buka metodologi lensa aktif'], ['1 sampai 5', 'Ringkasan, Akses, Nyaman, Guna, Sosial'], ['Spasi', 'putar / jeda siklus 24 jam'], ['M', 'menu'], ['T', 'ganti tema gelap / terang'], ['?', 'panduan singkat'], ['Esc', 'tutup dialog']];
  $('#isi-pintasan').innerHTML = `<h2>Pintasan keyboard &amp; remote</h2><p class="lede" style="margin-top:6px">Di TV, tombol arah pada remote bekerja seperti tombol panah.</p><table><tr><th>Tombol</th><th>Fungsi</th></tr>${r.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('')}</table>`;
  $('#pintasan').hidden = false;
}

// ---------- metodologi: global (tab) dan per lensa ----------
function bukaMetode(tab = 'kerangka') {
  const T = Object.keys(METODE);
  $('#tab-metode').innerHTML = T.map((k) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${METODE[k].t}</button>`).join('');
  $('#isi-metode').innerHTML = METODE[tab].h();
  $$('#tab-metode [data-tab]').forEach((b) => b.onclick = () => bukaMetode(b.dataset.tab));
  $('#modal').hidden = false;
}
function bukaMetodeLensa(id) {
  const L = LENSA[id], M = METODE_L[id] || {}, grup = L.grup, c = warnaAtr(grup);
  const indTabel = (k) => `<table><tr><th>Indikator</th><th>Nilai</th><th>Skor</th><th>Acuan</th></tr>${PPS.ind[k].map((x) => `<tr><td>${x.n} <span class="tag ${x.j === 'model' ? 'model' : 'ukur'}">${x.j === 'model' ? 'MODEL' : x.j === 'audit' ? 'AUDIT' : 'TERUKUR'}</span></td><td>${nf(x.v, x.v < 10 && x.u !== '%' ? 2 : 0)} ${x.u}</td><td><b>${x.s}</b></td><td>${x.acuan}</td></tr>`).join('')}</table>`;
  const sec = (judul, isi) => isi ? `<h3 style="--k:${c}"><i></i>${judul}</h3>${isi}` : '';
  const lst = (a) => a && a.length ? `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>` : '';
  $('#isi-metode-l').innerHTML = `<span class="eyebrow" style="--c:${c}"><i></i>${grup === 'ringkasan' ? 'Ringkasan' : ATR[grup].nama} · metodologi</span><h2 style="margin-top:6px">${L.nama}</h2>
    ${sec('Apa yang diukur', M.tujuan ? `<p>${M.tujuan}</p>` : '')}
    ${sec('Kaitan dengan Place Diagram PPS', M.pps ? `<p>${M.pps}</p>` : '')}
    ${sec('Indikator & rumus', (L.induk ? indTabel(grup) + '<p>Skor indikator = min(1, nilai ÷ acuan) × 100. Skor atribut = rata-rata skor indikator. Skor PPS total = rata-rata empat atribut (bobot setara, sesuai Place Diagram yang tidak memberi bobot).</p>' : '') + (M.rumus ? `<div class="rumus">${M.rumus}</div>` : '') + lst(M.ukur))}
    ${sec('Data & sumber', lst(M.data))}
    ${sec('Asumsi', lst(M.asumsi))}
    ${sec('Batasan & cara validasi', lst(M.batas))}
    ${sec('Rujukan', lst(M.ref))}`;
  $('#metode-l').hidden = false;
}

// ---------- pasang semua kontrol ----------
function bangunUI() {
  bangunNavigasi();
  // sudut pandang hanya di toolbar atas (HP: tombol tarik-turun)
  $('#grup-view').innerHTML = Object.entries(VIEWS).map(([k, v]) => `<button class="tb" data-view="${k}" type="button" title="${v.nama}">${ikonSvg(v.ikon, 16)}<span>${v.nama}</span></button>`).join('');
  $('#view-pop').innerHTML = Object.entries(VIEWS).map(([k, v]) => `<button class="tb" data-view="${k}" type="button">${ikonSvg(v.ikon, 16)}${v.nama}</button>`).join('');
  $$('[data-view]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); cerita.stop(); setView(b.dataset.view); $('#view-pop').hidden = true; });
  $('#b-view').onclick = (e) => { e.stopPropagation(); const p = $('#view-pop'); p.hidden = !p.hidden; $('#menu').hidden = true; };
  // navigasi lensa (delegasi): tombol metodologi, lipat atribut, pilih lensa
  document.addEventListener('click', (e) => {
    const m = e.target.closest('[data-metode]'); if (m) { e.preventDefault(); e.stopPropagation(); bukaMetodeLensa(m.dataset.metode); return; }
    const ch = e.target.closest('.chev'); if (ch && !mqTab.matches) { e.stopPropagation(); ch.closest('.atr').classList.toggle('lipat'); return; }
    const n = e.target.closest('[data-nav]'); if (n) { cerita.stop(); location.hash = INDUK[n.dataset.nav]; if (sheet.state === 'peek') sheet.set('half'); return; }
    const l = e.target.closest('[data-l]'); if (l) { cerita.stop(); location.hash = l.dataset.l; if (mqHP.matches && sheet.state === 'peek') sheet.set('half'); return; }
    if (!e.target.closest('#menu') && !e.target.closest('#b-menu') && !e.target.closest('#view-dd')) tutupMenu();
  });
  $('#b-menu').onclick = (e) => { e.stopPropagation(); $('#menu').hidden ? bukaMenu() : tutupMenu(); };
  $('#b-tur').onclick = () => { tutupMenu(); cerita.aktif ? cerita.stop() : cerita.mulai(); };
  $$('.overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('.tutup')) o.hidden = true; }));
  $('#panel-toggle').onclick = () => { document.body.classList.toggle('panel-tutup'); $('#panel-toggle svg').style.transform = document.body.classList.contains('panel-tutup') ? 'rotate(180deg)' : ''; setTimeout(() => { charts.forEach((c) => c.resize()); zonaT = 0; }, 550); };
  $('#slider').oninput = (e) => { berhenti(); setJam(+e.target.value); };
  $('#main').onclick = () => { S.main = !S.main; $('#main').classList.toggle('on', S.main); $('#ikon-main').innerHTML = S.main ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4.5v15l12-7.5z"/>'; };
  $('#kompas').onclick = () => cc.rotateAzimuthTo(0, true);
  // keyboard & remote TV
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $$('.overlay').forEach((o) => o.hidden = true); tutupMenu(); tutupInfo(); cerita.stop(); return; }
    if (e.target.matches('input,select,textarea')) return;
    const diMenu = e.target.closest && e.target.closest('#menu');
    if (diMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const it = $$('#menu .mi'), i = it.indexOf(document.activeElement); (it[(i + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length] || it[0]).focus(); return; }
    if (diMenu && e.key === 'ArrowLeft') { const b = $('#menu-balik'); if (b) b.click(); return; }
    if (diMenu || e.target.closest && e.target.closest('.overlay:not([hidden])')) return;
    const ids = Object.keys(LENSA), vs = Object.keys(VIEWS);
    if (e.key.startsWith('Arrow')) { document.body.classList.add('tv'); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') location.hash = ids[(ids.indexOf(S.lapis) + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length];
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') setView(vs[(vs.indexOf(S.view) + (e.key === 'ArrowRight' ? 1 : -1) + vs.length) % vs.length]);
    if (e.key === 'Enter' && (e.target === document.body || e.target === canvas)) bukaMetodeLensa(S.lapis);
    if (/^[1-5]$/.test(e.key)) location.hash = INDUK[Object.keys(INDUK)[+e.key - 1]];
    if (e.key === ' ') { e.preventDefault(); $('#main').click(); }
    if (e.key === 'm' || e.key === 'M') $('#menu').hidden ? bukaMenu() : tutupMenu();
    if (e.key === 't' || e.key === 'T') setTema(S.tema === 'gelap' ? 'terang' : 'gelap');
    if (e.key === '?') bukaPanduan();
  });
  sheet.init();
  const pasangDok = () => { if (mqHP.matches) $('#slot-dok').appendChild($('#dok')); else document.body.appendChild($('#dok')); grupChips = ''; tandaiNavigasi(); renderPanel(); renderLegenda(); zonaT = 0; };
  mqHP.addEventListener('change', pasangDok); mqTab.addEventListener('change', () => { zonaT = 0; }); pasangDok();
}
function simpan(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
function baca(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

const REF = {
  pps: 'Project for Public Spaces (PPS). What Makes a Successful Place? (Place Diagram). pps.org/article/grplacefeat',
  pps10: 'Project for Public Spaces (2012). Placemaking and the Future of Cities. UN-Habitat & PPS.',
  gifarry: 'Gifarry, Dwi Ari & Firdausiyah (2022). Penerapan Kawasan Berorientasi Transit di Kawasan Transit Blok M. Jurnal Tata Kota dan Daerah 14(2).',
  boeing19: 'Boeing, G. (2019). Urban spatial order: street network orientation, configuration, and entropy. Applied Network Science 4(67).',
  boeing25: 'Boeing, G. (2025). Modeling and Analyzing Urban Networks and Amenities with OSMnx. Geographical Analysis.',
  itdp: 'ITDP (2017). TOD Standard 3.0. Ambang dirangkum dari repositori Urban-Design-Skills (Abhinav Bhardwaj).',
  oua: 'open-urban-analysis (dzakybd): metode metrik jaringan & akses dari OSM. github.com/dzakybd/open-urban-analysis',
  porta: 'Porta, S. & Renne, J. L. (2005). Linking urban design to sustainability: formal indicators of social urban sustainability field research in Perth. Urban Design International 10.',
  bp: 'Berghauser Pont, M. & Haupt, P. (2010). Spacematrix: Space, Density and Urban Form. NAi Publishers.',
  kmlh: 'KepMenLH No. 48/1996 tentang Baku Tingkat Kebisingan; KepGub DKI Jakarta No. 551/2001.',
  pinang: 'Studi kebisingan Terminal Pinang Ranti, Jakarta Timur (Jurnal Urban Environment & Technology, Univ. Trisakti): 71,6 dB(A) di tengah terminal.',
  bulupitu: 'Studi intensitas suara Terminal Bulupitu, Purwokerto (Poltekkes Kemenkes Semarang): 65,5 sampai 73,8 dB(A).',
  who: 'WHO Regional Office for Europe (2016). Urban Green Spaces and Health: a review of evidence. Akses ruang hijau ≤ 300 m.',
  uu26: 'UU No. 26/2007 tentang Penataan Ruang: RTH minimal 30% wilayah kota.',
  ramadhan: 'Ramadhan, Nugroho & Agumsari (2025). Optimalisasi RTH di Kawasan Blok M. JDLBI 2(1).',
  mrt: 'PT MRT Jakarta: 553.599 pelanggan Stasiun Blok M BCA (Des 2025); headway 5 menit jam sibuk, 10 menit di luar jam sibuk (investortrust.id, Nov 2025); operasi 05.00 sampai 24.00 (Setkab).',
  mrtv: 'Kecepatan Ratangga 50 sampai 60 km/jam di jalur layang (detik.com, 2019); maks. desain 100 km/jam jalur layang (Setkab).',
  noaa: 'NOAA Solar Calculator (algoritma posisi matahari, Spencer 1971).',
  bmkg: 'BMKG; BRIN (2013 sampai 2022): pola monsun barat dan timur Jakarta.',
  lbm: 'Krüger, T. dkk. (2017). The Lattice Boltzmann Method: Principles and Practice. Springer.',
  gehl: 'Gehl, J. (2010). Cities for People. Island Press. (muka aktif, tepi lembut)',
  katadata: 'Katadata (2026): Blok M Hub rata-rata 25.000 kunjungan per hari; investortrust.id (2026): ±80.000 pengunjung kawasan per hari.',
  osm: 'Peta © kontributor OpenStreetMap, lisensi ODbL. Ekstrak API v0.6, 3 November 2026.',
};
const METODE = {
  kerangka: { t: 'Kerangka', h: () => `
    <p>Analisis berfokus pada <b>kawasan inti Blok M</b> (${nf(VS.luas_ha, 1)} ha) yang dibatasi Jl. Bulungan, Jl. Palatehan (termasuk M Bloc), Jl. Sultan Iskandarsyah, dan Jl. Melawai Raya. Bangunan di luar batas tampil sebagai konteks.</p>
    <h3><i></i>Place Diagram Project for Public Spaces</h3>
    <p>PPS menilai ruang publik dengan tiga cincin: <b>atribut kunci</b> (dalam), <b>kualitas tak berwujud</b> (tengah), dan <b>data terukur</b> (luar). Empat atribut kunci: Akses &amp; Keterhubungan, Kenyamanan &amp; Citra, Kegunaan &amp; Aktivitas, Sosiabilitas.</p>
    <p>Adaptasi di studi ini:</p><ol>
      <li>Setiap atribut diisi <b>indikator terukur</b> dari data terbuka (OSM, audit lapangan terbit, data operator) dan model. Tiap indikator diberi label TERUKUR, AUDIT, atau MODEL agar kekuatan datanya jelas.</li>
      <li>Nilai dinormalkan ke acuan standar: <span class="rumus" style="display:inline-block;padding:2px 8px">skor = min(1, nilai ÷ acuan) × 100</span>. Acuan ditulis di setiap indikator.</li>
      <li>Skor atribut = rata-rata indikatornya; skor PPS = rata-rata empat atribut dengan <b>bobot setara</b>, karena Place Diagram tidak memberi bobot.</li>
      <li>Kualitas tak berwujud (misal "ramah", "menawan") <b>tidak diberi skor</b>: PPS menilainya lewat observasi dan Place Game bersama warga.</li>
      <li>Pengukuran PPS yang belum punya data terbuka untuk Blok M (kriminalitas, kebersihan, kondisi bangunan, nilai properti, komposisi perempuan/anak/lansia, kerelawanan) ditandai <span class="tag survei">PERLU SURVEI</span>.</li></ol>
    <h3><i></i>Pembanding: skor kelayakan AHP (hasil saat ini)</h3>
    <p>Empat parameter studi kelayakan (aksesibilitas, walkability, variety function, kenyamanan termal) digabung dengan bobot AHP pemangku kepentingan TOD Blok M: angkutan umum 0,493, pejalan kaki 0,320, kenyamanan 0,106, intensitas 0,081 (Gifarry dkk., 2022). Untuk perbandingan per atribut: Akses ↔ rata-rata berbobot aksesibilitas &amp; walkability, Kenyamanan ↔ termal, Kegunaan ↔ variety function. Sosiabilitas tidak punya padanan di AHP.</p>
    <h3><i></i>Kategori skor</h3><table><tr><th>Skor</th><th>PPS</th><th>AHP</th></tr><tr><td>≥ 75</td><td>Tempat berhasil</td><td>Layak</td></tr><tr><td>55 sampai 74</td><td>Bersyarat, perlu perbaikan terarah</td><td>Layak bersyarat</td></tr><tr><td>&lt; 55</td><td>Perlu intervensi</td><td>Perlu intervensi</td></tr></table>` },
  data: { t: 'Data', h: () => `
    <h3><i></i>OpenStreetMap vektor</h3><ul>
      <li>${B.length.toLocaleString('id')} tapak bangunan, ${O.seg.length.toLocaleString('id')} ruas jalan kaki, ${V4.rute.length} rute kendaraan dari graf jalan berarah, ${D.poi.length} POI, ${D.transit.length} halte/stasiun. Diunduh dari API OSM v0.6 pada 3 November 2026 (Overpass tidak dapat diakses), dibaca dengan OSMnx 2.1.</li>
      <li>Registrasi ke peta dasar: korelasi silang jaringan jalan, skala 0,982, rotasi 0,25°, geser (4, −6) px.</li>
      <li>Koreksi: Jl. Melawai I sampai IX bertag <i>access=private</i> diperlakukan sebagai jalan umum.</li>
      <li>Kelengkapan di kawasan inti: ${nf(OS.mutu.lantai_osm, 0)}% bangunan bertag lantai, ${nf(OS.mutu.bernama, 0)}% bernama, ${nf(OS.mutu.trotoar, 0)}% jalan bertag trotoar, ${OS.mutu.poi} POI.</li></ul>
    <h3><i></i>Data terukur & audit</h3><ul>
      <li>Audit kualitas jalur 3 blok TOD (jalur pedestrian, penyeberangan, peneduh, sepeda): Gifarry dkk. (2022).</li>
      <li>Ridership MRT, headway, jam operasi: PT MRT Jakarta. Kunjungan kawasan: Katadata, investortrust.id (2026).</li>
      <li>Tinggi landmark: sumber publik (detik.com, Kontan, Setkab). Lainnya tag OSM atau estimasi tipologi.</li>
      <li>Vegetasi: indeks kehijauan (ExG) citra satelit Google Earth di folder proyek.</li></ul>
    <h3><i></i>Lisensi</h3><ul><li>${REF.osm}</li><li>Citra satelit Google Earth hanya untuk analisis; periksa ketentuan Google sebelum dipublikasikan.</li><li>Perangkat lunak: OSMnx (MIT), NetworkX, momepy, shapely (BSD), three.js, camera-controls, anime.js (MIT), Apache ECharts (Apache-2.0).</li></ul>` },
  model: { t: 'Model', h: () => `
    <table><tr><th>Analisis</th><th>Metode</th><th>Jenis</th></tr>
      <tr><td>Akses transit</td><td>Jarak jaringan (NetworkX, Dijkstra) ke MRT, halte BRT, terminal; 80 m/menit</td><td><span class="tag ukur">TERUKUR</span></td></tr>
      <tr><td>Walkability</td><td>Pedshed jaringan 400/800 m dari ${OS.pintu} pintu MRT; metrik OSMnx</td><td><span class="tag ukur">TERUKUR</span></td></tr>
      <tr><td>Kebisingan</td><td>Sumber garis per kelas jalan + bidang terminal; jarak geodesik + difraksi Maekawa</td><td><span class="tag model">MODEL</span></td></tr>
      <tr><td>Termal</td><td>Posisi matahari NOAA, ray-marching bayangan; indeks panas dari vegetasi & permukaan kedap</td><td><span class="tag model">MODEL</span></td></tr>
      <tr><td>Angin</td><td>CFD 2D Lattice-Boltzmann D2Q9, sel 6 m, 5 arah monsun</td><td><span class="tag model">MODEL</span></td></tr>
      <tr><td>Keramaian</td><td>POI × profil jam, dipatok ke data terukur (total ±80.000/hari)</td><td><span class="tag model">MODEL</span></td></tr>
      <tr><td>Muka aktif</td><td>Sampel 6 m sepanjang ruas; POI ≤ 22 m atau bangunan komersial ≤ 10 m</td><td><span class="tag ukur">TERUKUR</span></td></tr></table>
    <h3><i></i>Simulasi visual (bukan data hitungan)</h3><ul>
      <li><b>Orang</b>: ${NH.toLocaleString('id')} figur maksimum. Jumlah aktif mengikuti model kunjungan per jam; 58% berjalan di trotoar ruas OSM (1,1 sampai 1,55 m/s), 26% berkelompok di titik aktivitas, 10% duduk di taman, 6% menunggu di halte. Figur diperbesar 1,35× agar terbaca.</li>
      <li><b>Kendaraan</b>: mobil, motor, bus kota, TransJakarta pada ${V4.rute.length} rute acak di graf jalan berarah (arah oneway OSM), lajur kiri. Volume mengikuti profil lalu lintas tipikal Jakarta (puncak 07.00 sampai 09.00 dan 17.00 sampai 19.00), kecepatan turun ±60% saat jam sibuk. Ilustrasi, bukan hasil hitung lalu lintas.</li>
      <li><b>MRT</b>: kinematika ${MRT.vMaks * 3.6} km/jam maks., percepatan & perlambatan ${MRT.a} m/s², henti ${MRT.henti} detik di Blok M BCA dan ASEAN, headway 5/10 menit, operasi 05.00 sampai 24.00. Bergerak dalam waktu nyata (×1).</li></ul>` },
  validasi: { t: 'Validasi & batasan', h: () => `
    <h3><i></i>Pemeriksaan silang</h3><ul>
      <li>Jarak model MRT Blok M BCA ke tepi Pasaraya ±980 m; audit Gifarry dkk. 948 m (selisih 3%).</li>
      <li>Kebisingan rata-rata area Terminal Blok M ${nf(VS.bising_terminal, 0)} dB(A); pengukuran di terminal Jakarta lain 71,6 dB(A) (Pinang Ranti) dan 65,5 sampai 73,8 dB(A) (Bulupitu). Model sedikit lebih tinggi karena terminal Blok M diapit arteri dan busway.</li>
      <li>Registrasi OSM: jaringan jalan OSM menumpuk dengan peta dasar setelah koreksi skala 1,8%.</li></ul>
    <h3><i></i>Batasan utama</h3><ul>
      <li>Kebisingan, indeks panas, angin, dan keramaian adalah model. Gunakan untuk membandingkan lokasi, bukan angka absolut.</li>
      <li>OSM hanya mencatat yang dipetakan: celah fasilitas atau trotoar bisa berarti belum dipetakan.</li>
      <li>Kualitas tak berwujud PPS dan pengukuran sosial belum diamati di lapangan.</li></ul>
    <h3><i></i>Survei lanjutan yang disarankan</h3><ol>
      <li><b>Place Game PPS</b> bersama pengunjung, pedagang, dan pengelola untuk menilai kualitas tak berwujud.</li>
      <li><b>Behavior mapping</b> dan hitung pejalan (pagi, siang, malam; hari kerja dan akhir pekan), termasuk porsi perempuan, anak, dan lansia.</li>
      <li><b>Sound level meter</b> 10 menit Leq di 15 titik: terminal, arteri, lorong blok, taman.</li>
      <li>Audit trotoar dan muka bangunan per segmen; data kriminalitas dan kebersihan dari Pemkot Jakarta Selatan.</li></ol>` },
  referensi: { t: 'Referensi', h: () => `<ol>${Object.values(REF).map((r) => `<li>${r}</li>`).join('')}<li>Pergub DKI Jakarta No. 103/2021 tentang Penataan Ruang Kawasan Kebayoran Baru.</li><li>Latip dkk. (2024); Varlencia &amp; Asharhani (2025); Manurung (2025).</li></ol>` },
};
const MI_PPS = (k) => `Atribut <b>${ATR[k].nama}</b> (${ATR[k].en}). Pertanyaan kunci PPS: ${ATR[k].tanya}`;
const METODE_L = {
  ringkasan: { tujuan: 'Merangkum kualitas ruang publik kawasan inti dalam Place Diagram PPS dan membandingkannya dengan skor kelayakan AHP hasil studi sebelumnya.',
    pps: 'Cincin dalam diagram = 4 atribut kunci, cincin luar = indikator terukur tiap atribut. Warna lebih pekat = skor lebih tinggi.',
    rumus: 'skor indikator = min(1, nilai ÷ acuan) × 100\nskor atribut   = rata-rata skor indikator\nskor PPS       = rata-rata 4 atribut (bobot setara)\nskor AHP       = 0,4932·akses + 0,320·walk + 0,106·termal + 0,0808·variety',
    data: ['Semua indikator dari lensa di bawahnya; lihat tab Data di Metodologi & sumber.'], asumsi: ['Bobot setara antar atribut PPS (diagram PPS tidak memberi bobot).'],
    batas: ['Skor PPS hanya memuat yang terukur; kualitas tak berwujud dan beberapa pengukuran sosial belum dinilai.'], ref: [REF.pps, REF.gifarry] },
  pakses: { tujuan: 'Seberapa mudah kawasan dicapai dan ditembus pejalan, dari stasiun dan halte ke setiap sudut.', pps: MI_PPS('akses'), data: ['Graf jalan OSM, posisi stasiun/halte OSM, audit Gifarry dkk. (2022).'], batas: ['Data lalu lintas, pembagian moda, dan pola parkir belum tersedia terbuka.'], ref: [REF.pps, REF.itdp, REF.porta, REF.gifarry] },
  pnyaman: { tujuan: 'Kenyamanan fisik ruang luar: panas, angin, bising, dan akses hijau.', pps: MI_PPS('nyaman'), data: ['Model termal, CFD angin, model kebisingan, graf jalan ke taman.'], batas: ['Statistik kriminalitas, kebersihan, dan kondisi bangunan perlu survei.'], ref: [REF.pps, REF.kmlh, REF.who, REF.uu26] },
  pguna: { tujuan: 'Keragaman alasan orang datang: campuran fungsi, jenis usaha, fasilitas, dan waktu aktif.', pps: MI_PPS('guna'), data: ['Guna lahan & POI OSM, model kunjungan per jam.'], batas: ['Nilai properti, tingkat sewa, penjualan ritel, dan kepemilikan usaha lokal belum tersedia.'], ref: [REF.pps, REF.gifarry] },
  psosial: { tujuan: 'Peluang orang bertemu dan berinteraksi: kehidupan jalan, kegiatan malam, tempat berkumpul.', pps: MI_PPS('sosial'), data: ['Muka aktif dari POI & bangunan OSM, model kunjungan terkalibrasi.'], batas: ['Jumlah perempuan, anak & lansia, jejaring sosial, dan kerelawanan butuh observasi lapangan.'], ref: [REF.pps, REF.gehl, REF.katadata] },
  akses: { tujuan: 'Waktu jalan kaki dari setiap titik kawasan ke angkutan massal terdekat (MRT, halte BRT TransJakarta, terminal).', pps: 'Akses & Keterhubungan: pengukuran "penggunaan transit" dan kualitas "kedekatan".',
    rumus: 'menit(titik) = (jarak ke jaringan + jarak jaringan ke stasiun/halte terdekat) ÷ 80 m/menit',
    ukur: [`Kawasan ≤ 5 menit: ${nf(VS.akses5, 0)}%; ≤ 10 menit: ${nf(VS.akses10, 0)}%.`], data: ['Graf jalan kaki OSM (OSMnx), 6 simpul angkutan massal utama dari OSM.'],
    asumsi: ['Kecepatan jalan 4,8 km/jam; tanpa waktu tunggu menyeberang dan tanpa tangga.', 'Halte bus biasa tidak dihitung sebagai angkutan massal.'],
    batas: ['Penyeberangan yang tidak dipetakan dianggap tidak ada.'], ref: [REF.boeing25, REF.oua, REF.mrt] },
  walk: { tujuan: 'Jangkauan nyata berjalan kaki dari pintu MRT di jaringan jalan, dibanding jangkauan garis lurus (pedshed).', pps: 'Akses & Keterhubungan: "aktivitas pejalan kaki", kualitas "bisa dijalani" dan "kontinuitas".',
    rumus: 'pedshed(R) = luas area dengan jarak jaringan ≤ R ÷ luas lingkaran radius R\nkelurusan rute = rata-rata (jarak jaringan ÷ jarak lurus), 300 pasang acak',
    ukur: [`Pedshed 400 m ${nf(OS.pedshed400, 0)}%, 800 m ${nf(OS.pedshed800, 0)}%.`, `Kelurusan rute ${nf(OS.circuity, 2)}; persimpangan ${nf(OS.dens_simpang, 0)}/km².`, 'Audit jalur: rata-rata 3 blok TOD (Gifarry dkk.).'],
    data: ['Graf jalan kaki OSM, 7 pintu MRT (railway=subway_entrance).'], asumsi: ['Persimpangan dikonsolidasi dalam radius 10 m.', 'Pedshed acuan: > 50% cukup, > 70% baik.'],
    batas: ['Tidak memodelkan lebar trotoar, kemiringan, atau hambatan sementara (PKL, parkir liar).'], ref: [REF.porta, REF.boeing19, REF.boeing25, REF.gifarry] },
  tod: { tujuan: 'Kehalusan jaringan blok untuk pejalan: ukuran blok, kepadatan persimpangan, dan keterhubungan.', pps: 'Akses & Keterhubungan: kualitas "terhubung" dan "kontinuitas".',
    rumus: 'blok = poligon tertutup graf jalan (jalan bernama + jalur pejalan)\npoin ITDP per indikator mengikuti ambang TOD Standard',
    ukur: [`${OS.itdp_s} dari ${OS.itdp_m} poin pada 7 indikator terukur.`, `Median keliling blok ${nf(OS.blok_med, 0)} m.`], data: ['Graf jalan OSM, bangunan OSM.'],
    asumsi: ['Pulau lalu lintas dan median (< 3.000 m² tanpa bangunan) bukan blok.'], batas: ['Bukan penilaian resmi ITDP; indikator lapangan (kualitas trotoar, frekuensi, parkir) tidak dinilai.'], ref: [REF.itdp, REF.boeing25] },
  termal: { tujuan: 'Paparan matahari dan panas di jalur pejalan sepanjang hari, serta efek skenario pohon peneduh.', pps: 'Kenyamanan & Citra: "data lingkungan", kualitas "bisa dijalani" dan "hijau".',
    rumus: 'teduh(titik, jam) = sinar ke arah matahari terhalang bangunan atau tajuk pohon (ray-marching 3 m)\nindeks panas = f(kehijauan ExG, permukaan kedap, jarak ke bangunan)',
    data: ['Posisi matahari NOAA untuk lintang Blok M; peta tinggi bangunan; tajuk pohon dari citra satelit.'], asumsi: ['Suhu udara tipikal harian, bukan data stasiun.'],
    batas: ['Indeks panas adalah indikator relatif, bukan suhu permukaan terukur. Validasi dengan termometer inframerah atau citra Landsat.'], ref: [REF.noaa, REF.gifarry] },
  angin: { tujuan: 'Pola angin di level pejalan di antara bangunan untuk 5 arah musiman.', pps: 'Kenyamanan & Citra: "data lingkungan".',
    rumus: 'CFD Lattice-Boltzmann D2Q9, sel 6 m, τ = 0,56, 2.600 iterasi\nnyaman: 0,3 sampai 4 m/s di level pejalan',
    data: ['Tapak bangunan OSM sebagai rintangan padat.'], asumsi: ['Aliran 2D steady; kecepatan referensi 10 m dapat diatur.'], batas: ['Penyaringan awal; bukan pengganti CFD 3D atau uji terowongan angin.'], ref: [REF.lbm, REF.bmkg] },
  bising: { tujuan: 'Tingkat kebisingan siang di ruang luar dan di fasad, dibanding baku mutu menurut fungsi bangunan.', pps: 'Kenyamanan & Citra: "data lingkungan", kualitas "nyaman" dan "bisa diduduki".',
    rumus: 'L = Lref − 10·log10(d ÷ 7,5) − A_difraksi\nA_difraksi = min(20, 10·log10(3 + 40·δ ÷ λ)),  λ = 0,68 m (500 Hz)\nLtotal = 10·log10(Σ 10^(L/10))',
    ukur: ['Lref pada 7,5 m: arteri 76, kolektor 73, tersier 69, busway 71, jalan servis bernama 64, lokal 61, servis 55, MRT layang 66 dB(A).', `Area Terminal Bus Blok M sebagai sumber bidang; hasil rata-rata ${nf(VS.bising_terminal, 0)} dB(A).`, 'Baku mutu: hunian & ibadah 55, publik & pemerintahan 60, perdagangan & jasa 70 dB(A).'],
    data: ['Jaringan jalan OSM vektor berkelas, poligon terminal OSM, lintasan MRT layang.'], asumsi: ['Leq siang tipikal; tidak membedakan jam.', 'd = jarak geodesik lewat ruang terbuka; δ = selisih lintasan terhadap garis lurus.'],
    batas: ['Indikatif. Validasi dengan sound level meter (Leq 10 menit) di terminal, arteri, dan lorong blok.'], ref: [REF.kmlh, REF.pinang, REF.bulupitu] },
  rth: { tujuan: 'Kedekatan bangunan ke ruang hijau dan porsi ruang hijau kawasan.', pps: 'Kenyamanan & Citra: kualitas "hijau".',
    rumus: 'jarak jaringan bangunan ke taman ≥ 0,15 ha; akses baik bila ≤ 300 m', data: ['Taman OSM dan peta dasar.'], asumsi: ['Taman < 0,15 ha tidak dihitung.'], batas: ['Tidak menilai kualitas atau keterbukaan taman.'], ref: [REF.who, REF.uu26, REF.ramadhan] },
  variety: { tujuan: 'Campuran fungsi lahan di sekitar setiap titik.', pps: 'Kegunaan & Aktivitas: pengukuran "pola guna lahan".',
    rumus: 'indeks campuran = −Σ p_i·ln(p_i) ÷ ln(5), 5 fungsi, radius 150 m', data: ['Guna lahan OSM; audit keragaman hunian (Gifarry dkk.).'], batas: ['Guna lahan lantai atas tidak tercatat di OSM.'], ref: [REF.gifarry] },
  fasilitas: { tujuan: 'Jumlah jenis fasilitas harian yang terjangkau 10 menit berjalan.', pps: 'Kegunaan & Aktivitas: kualitas "bermanfaat".',
    rumus: 'jenis terjangkau = Σ [jarak jaringan ke fasilitas jenis k ≤ 800 m], 8 jenis', data: ['POI OSM 6 kategori, transit, taman ≥ 0,15 ha.'], batas: ['Fasilitas yang tidak dipetakan dianggap tidak ada.'], ref: [REF.oua] },
  morfologi: { tujuan: 'Bentuk dan kepadatan tiap blok sebagai dasar intensitas aktivitas.', pps: 'Kegunaan & Aktivitas: pola guna lahan dan intensitas.',
    rumus: 'GSI = luas tapak ÷ luas blok;  FSI = luas lantai ÷ luas blok;  L = FSI ÷ GSI', data: ['Tapak & lantai bangunan OSM, blok dari graf jalan.'], asumsi: ['Lantai tanpa tag OSM: estimasi tipologi.'], batas: [`Hanya ${nf(OS.mutu.lantai_osm, 0)}% bangunan bertag lantai.`], ref: [REF.bp] },
  sosial: { tujuan: 'Perkiraan jumlah kunjungan per jam per heksagon (radius 26 m).', pps: 'Sosiabilitas: "penggunaan malam" dan "kehidupan jalan".',
    rumus: 'kunjungan(hex, jam) = Σ_POI bobot_kategori × profil_jam(kategori) × kernel Gauss\ndipatok: MRT 17.858/hari, Blok M Hub 25.000/hari, M Bloc 6.000/hari, total ±80.000/hari',
    data: ['POI OSM, ridership MRT, data kunjungan publik.'], asumsi: ['Profil jam buka per kategori usaha (model).'], batas: ['Bukan data ponsel atau hitungan pejalan. Validasi dengan hitung pejalan pada beberapa jam.'], ref: [REF.mrt, REF.katadata] },
  muka: { tujuan: 'Porsi panjang jalan yang dibatasi etalase toko, kuliner, atau jasa: ukuran kehidupan jalan.', pps: 'Sosiabilitas: pengukuran "kehidupan jalan" (street life).',
    rumus: 'aktif(titik) = ada POI ≤ 22 m atau bangunan komersial ≤ 10 m\nmuka aktif ruas = titik aktif ÷ semua titik (sampel 6 m)', ukur: [`Kawasan inti: ${nf(V4.muka, 0)}% panjang jalan.`],
    data: ['POI dan bangunan OSM; ruas jalan OSM.'], asumsi: ['Semua POI dianggap buka; tidak membedakan sisi jalan.'], batas: ['Validasi dengan survei muka bangunan (transparansi, jumlah pintu per 100 m).'], ref: [REF.gehl, REF.pps] },
};

// =============================================================
//  Loop
// =============================================================
const clock = new THREE.Clock(); let t0 = performance.now(), simMenit = 0;
const azTmp = new THREE.Vector3();
// pemantau FPS: mode otomatis turun ke "hemat" bila perangkat berat
let fpsT = 0, fpsN = 0, fpsCek = 0;
function ukurFps(dt) {
  if (S.kualitas !== 'otomatis' || fpsCek > 2) return; fpsT += dt; fpsN++;
  if (fpsT > 4) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; fpsCek++; if (fps < 32 && KUAL.mode !== 'hemat') terapkanKualitas('hemat', true); }
}
function terapkanKualitas(lv, otomatis = false) {
  if (!otomatis) S.kualitas = lv; simpan('psa-kualitas', lv);
  const hemat = lv === 'hemat' || (lv === 'otomatis' && LITE); KUAL.mode = hemat ? 'hemat' : 'tinggi';
  renderer.setPixelRatio(Math.min(hemat ? 1 : 2, devicePixelRatio)); renderer.shadowMap.type = hemat ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  sun.shadow.mapSize.set(hemat ? 1024 : 4096, hemat ? 1024 : 4096); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  KUAL.orang = hemat ? .55 : 1; KUAL.kend = hemat ? .5 : 1; KUAL.label = hemat ? 2 : 1; jamOrang = -1; resize();
}
function loop() {
  const dt = Math.min(.05, clock.getDelta()), el = (performance.now() - t0) / 1000;
  U.uGrow.value = reduce ? 1 : clamp(el / 3); U.uTime.value = el;
  if (S.main) { let h = S.jam + dt * .9 * S.kecepatan; if (h > 24) h = 5; setJam(h); }
  cc.update(dt);
  const cd = cc.distance; scene.fog.near = cd * 1.2; scene.fog.far = cd * 3.4;
  $('#utara').style.transform = `rotate(${cc.azimuthAngle * 180 / Math.PI}deg)`;
  if (jarMesh.visible) { const t = (performance.now() - jarT0) / 1000; JUM.uR.value = t < 5.5 ? 1700 * (1 - Math.pow(1 - clamp(t / 5.5), 2.2)) : 1700; }
  if (rep3d() === 'sosial' && sosGrow < 1) { sosGrow = Math.min(1, sosGrow + dt * .8); updateHex(); }
  if (wLines.visible) langkahAngin(dt);
  if (orang.visible) langkahAgen(dt);
  langkahKereta(dt); langkahKendaraan(dt);
  if (el - (loop.mrtT || 0) > .5) { loop.mrtT = el; const st = statusMRT(), mc = $('#mrt-chip'); mc.innerHTML = `<i></i><span>${st.teks}</span>`; mc.classList.toggle('henti', st.henti);
    const lc = $('#lalin-chip'); if (lc) lc.innerHTML = `<span>👥 <b>${nf(S.orang ? (orang.userData.n || 0) : 0)}</b> orang</span><span>🚗 <b>${nf(LALIN.mobil + LALIN.motor)}</b> kendaraan</span><span>🚌 <b>${nf(LALIN.bus)}</b> bus</span>`; }
  // bloom hanya berguna saat malam: siang hari render langsung (lebih ringan)
  if (composer && U.uNight.value > .05) composer.render(); else renderer.render(scene, camera);
  ukurFps(dt);
  if ((loop.n = (loop.n || 0) + 1) % KUAL.label === 0) updateLabels();
  requestAnimationFrame(loop);
}

// =============================================================
//  Mulai
// =============================================================
resize(); bangunUI();
camera.position.set(BC[0] + 2600, 2300, BC[1] + 2600); cc.setLookAt(BC[0] + 2600, 2300, BC[1] + 2600, BC[0], 0, BC[1], false);
setMatahari(); gambarRitme();
setLapis(location.hash.slice(1) || 'ringkasan', false);
setJam(S.jam);
addEventListener('hashchange', () => setLapis(location.hash.slice(1)));
setTimeout(() => setView('iso'), 200);
requestAnimationFrame(() => $('#memuat').classList.add('hilang'));
if (!baca('psa-panduan') && !/notour/.test(location.search)) setTimeout(bukaPanduan, 2400);
if (S.tema !== 'terang') setTema(S.tema);
{ const k = baca('psa-kualitas'); if (k) S.kualitas = k; terapkanKualitas(S.kualitas); }
loop();
window.__bm = { S, setLapis, setView, setJam, cc, camera, cerita, sheet, pilihBangunan, setSkenarioPohon, renderer, setTema, bukaMenu, bukaMetodeLensa, bukaPanduan, PPS, statusMRT, orang, KEND };
