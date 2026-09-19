// @ts-nocheck
/* eslint-disable */
// Portado del prototipo docs/prototipos/tablero-3d.html (three r128, JS plano).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const MARKUP = `
<div id="stage">
  <div class="vignette"></div>

  <header class="panel title">
    <h1>Paisano</h1>
    <p>Arrastra para rotar, usa la rueda o el pellizco para acercar y pasa el cursor sobre una casilla.</p>
    <p class="stats" id="stats">Cargando escena…</p>
  </header>

  <div class="panel hover" id="hover" hidden></div>
  <div class="dice" id="dice" hidden></div>

  <nav class="panel bar" aria-label="Controles del tablero">
    <div class="group">
      <button type="button" id="btnNew" class="primary">Nuevo mapa</button>
      <button type="button" id="btnDice" class="primary">Tirar dados</button>
    </div>
    <div class="group" role="group" aria-label="Luz">
      <button type="button" data-light="day" aria-pressed="true">Día</button>
      <button type="button" data-light="dusk" aria-pressed="false">Atardecer</button>
      <button type="button" data-light="night" aria-pressed="false">Noche</button>
    </div>
    <div class="group">
      <button type="button" id="btnPieces" aria-pressed="true">Piezas</button>
      <button type="button" id="btnSpin" aria-pressed="false">Girar solo</button>
    </div>
  </nav>

  <div class="err" id="err" hidden></div>
</div>
`;

export function initBoard() {
  var errBox = document.getElementById('err');
  function fail(msg) { errBox.textContent = msg; errBox.hidden = false; }
  var raf = 0, ro = null, renderer = null, disposed = false;
  try { main(); } catch (e) { console.error(e); fail('No se pudo iniciar la escena 3D: ' + e.message); }
  return function dispose() {
    disposed = true; cancelAnimationFrame(raf); if (ro) ro.disconnect();
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
  };

  function main() {
    // ------------------------------------------------------------------ constantes
    var SQ3 = Math.sqrt(3);
    var TILE_TOP = 0.4;      // altura de la cara superior de las casillas
    var DECOR_HEIGHT = 0.5;  // escala vertical del decorado (para no tapar fichas ni piezas)
    var DICE_BOUNCE = 0.06;  // altura del salto de las casillas al salir su número
    var WATER_Y = 0.16;      // nivel del mar
    var RC = 6.4;            // radio del marco (hexágono grande, vértices en ±x)
    var stage = document.getElementById('stage');

    // ------------------------------------------------------------------ utilidades
    function mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function shuffle(arr, rnd) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
    function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

    // ------------------------------------------------------------------ renderer / escena
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    stage.insertBefore(renderer.domElement, stage.firstChild);

    var scene = new THREE.Scene();
    scene.background = col(0xb9c9cf);
    scene.fog = new THREE.Fog(col(0xb9c9cf), 24, 70);

    var camera = new THREE.PerspectiveCamera(35, 1, 0.5, 200);
    camera.position.set(0, 14.5, 12.5);

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 30;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.3;
    controls.autoRotateSpeed = 0.7;

    // ------------------------------------------------------------------ materiales
    var allMats = [];
    function M(hex, rough, metal, opts) {
      opts = opts || {};
      var env = opts.env !== undefined ? opts.env : 0.35;
      var p = { color: col(hex), roughness: rough === undefined ? 0.7 : rough, metalness: metal || 0 };
      if (opts.flat) p.flatShading = true;
      if (opts.map) { p.map = opts.map; p.color = new THREE.Color(0xffffff); }
      var m = new THREE.MeshStandardMaterial(p);
      m.userData.env = env; m.envMapIntensity = env;
      allMats.push(m);
      return m;
    }
    function tex(canvas, repeatX, repeatY) {
      var t = new THREE.CanvasTexture(canvas);
      t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (repeatX) t.repeat.set(repeatX, repeatY || repeatX);
      return t;
    }
    function mesh(geo, mat, cast, receive) {
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = cast !== false; m.receiveShadow = receive !== false;
      return m;
    }

    // ------------------------------------------------------------------ mapa de entorno (reflejos suaves)
    try {
      var envScene = new THREE.Scene();
      var skyGeo = new THREE.SphereGeometry(50, 24, 16);
      var pos = skyGeo.attributes.position, colors = [];
      var cTop = col(0xcfe4ff), cMid = col(0xf5efe4), cBot = col(0x76674f), tmp = new THREE.Color();
      for (var i = 0; i < pos.count; i++) {
        var y = pos.getY(i) / 50;
        if (y > 0) tmp.copy(cMid).lerp(cTop, Math.pow(y, 0.6)); else tmp.copy(cMid).lerp(cBot, Math.min(1, -y * 1.6));
        colors.push(tmp.r, tmp.g, tmp.b);
      }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      var pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(envScene).texture;
      pm.dispose();
    } catch (e) { console.warn('Sin mapa de entorno:', e.message); }

    // ------------------------------------------------------------------ luces
    var hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.6);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    var lampA = new THREE.PointLight(col(0xffb56b), 0, 16, 2); lampA.position.set(-4.5, 2.6, 3);
    var lampB = new THREE.PointLight(col(0xffb56b), 0, 16, 2); lampB.position.set(4.5, 2.6, -3);
    scene.add(lampA); scene.add(lampB);

    var PRESETS = {
      day:   { bg: 0xb9c9cf, sun: 0xfff2dc, sunI: 1.25, sunPos: [7, 13, 6],    sky: 0xdcecff, ground: 0x8f7a5c, hemiI: 0.62, env: 1.0,  exp: 1.05, lamps: 0 },
      dusk:  { bg: 0x4a3040, sun: 0xff9a55, sunI: 1.55, sunPos: [-11, 4.6, 6], sky: 0xffb98a, ground: 0x4a3350, hemiI: 0.45, env: 0.6,  exp: 1.05, lamps: 0.35 },
      night: { bg: 0x090e1d, sun: 0x9fb6ff, sunI: 0.6,  sunPos: [-6, 12, 4],   sky: 0x3a4a8a, ground: 0x1a1a2a, hemiI: 0.4,  env: 0.28, exp: 1.0,  lamps: 1.25 }
    };
    function presetState(p) {
      return {
        bg: col(p.bg), sun: col(p.sun), sunI: p.sunI, sunPos: new THREE.Vector3(p.sunPos[0], p.sunPos[1], p.sunPos[2]),
        sky: col(p.sky), ground: col(p.ground), hemiI: p.hemiI, env: p.env, exp: p.exp, lamps: p.lamps
      };
    }
    var cur = presetState(PRESETS.day), tar = presetState(PRESETS.day);
    var lastEnv = -1;
    function applyLight(k) {
      cur.bg.lerp(tar.bg, k); cur.sun.lerp(tar.sun, k); cur.sky.lerp(tar.sky, k); cur.ground.lerp(tar.ground, k);
      cur.sunPos.lerp(tar.sunPos, k);
      cur.sunI += (tar.sunI - cur.sunI) * k; cur.hemiI += (tar.hemiI - cur.hemiI) * k;
      cur.env += (tar.env - cur.env) * k; cur.exp += (tar.exp - cur.exp) * k; cur.lamps += (tar.lamps - cur.lamps) * k;
      scene.background.copy(cur.bg); scene.fog.color.copy(cur.bg);
      sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(cur.sunPos);
      hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.ground); hemi.intensity = cur.hemiI;
      lampA.intensity = lampB.intensity = cur.lamps;
      renderer.toneMappingExposure = cur.exp;
      if (Math.abs(cur.env - lastEnv) > 0.002) {
        lastEnv = cur.env;
        for (var i = 0; i < allMats.length; i++) allMats[i].envMapIntensity = allMats[i].userData.env * cur.env;
      }
    }

    // ------------------------------------------------------------------ texturas procedurales
    function blobs(ctx, w, h, n, cols, rmin, rmax, alpha, r) {
      for (var i = 0; i < n; i++) {
        ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.beginPath();
        var rr = rmin + r() * (rmax - rmin);
        ctx.ellipse(r() * w, r() * h, rr, rr * (0.55 + r() * 0.4), r() * 3.14, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function terrainCanvas(kind) {
      var w = 256, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(kind.length * 977 + 13), i, y, x;
      var base = { forest: '#3f8f45', pasture: '#a7d15c', fields: '#e8bf45', hills: '#c96a3b', mountains: '#8d949c', desert: '#e3c78d' }[kind];
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, w);
      if (kind === 'forest') blobs(ctx, w, w, 420, ['#2f7a3a', '#4aa050', '#357f3f', '#5cb05a'], 3, 14, 0.5, r);
      if (kind === 'pasture') blobs(ctx, w, w, 420, ['#95c44c', '#b8e06c', '#8bbb45', '#c6e98a'], 3, 16, 0.5, r);
      if (kind === 'fields') {
        for (i = 0; i < 26; i++) { ctx.fillStyle = i % 2 ? '#d9ab30' : '#f2cf64'; ctx.globalAlpha = 0.55; ctx.fillRect(0, i * 10, w, 5); }
        ctx.globalAlpha = 1; blobs(ctx, w, w, 200, ['#e0b23a', '#f6d777'], 2, 9, 0.35, r);
      }
      if (kind === 'hills') {
        for (i = 0; i < 22; i++) { ctx.strokeStyle = i % 2 ? '#b25428' : '#dc8355'; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.beginPath(); y = i * 12 + 6; ctx.moveTo(0, y); for (x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 26 + i) * 3); ctx.stroke(); }
        ctx.globalAlpha = 1; blobs(ctx, w, w, 260, ['#b85a30', '#d9794a', '#a9502c'], 2, 10, 0.4, r);
      }
      if (kind === 'mountains') blobs(ctx, w, w, 480, ['#7b828b', '#9fa6ae', '#6f757d', '#b3b9c0'], 2, 12, 0.5, r);
      if (kind === 'desert') {
        for (i = 0; i < 20; i++) { ctx.strokeStyle = i % 2 ? '#d2b16c' : '#f0dcaa'; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.beginPath(); y = i * 13 + 7; ctx.moveTo(0, y); for (x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x / 20 + i * 1.7) * 4); ctx.stroke(); }
        ctx.globalAlpha = 1; blobs(ctx, w, w, 220, ['#d8b97a', '#efd9a3', '#cfae6e'], 2, 9, 0.35, r);
      }
      return c;
    }
    function woodCanvas(base, dark, light, seed) {
      var w = 512, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(seed), i, x;
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, w);
      for (i = 0; i < 260; i++) {
        var y = r() * w, amp = 1 + r() * 4, ph = r() * 6, f = Math.floor(1 + r() * 3);
        ctx.strokeStyle = r() > 0.5 ? dark : light; ctx.globalAlpha = 0.08 + r() * 0.22; ctx.lineWidth = 0.6 + r() * 2.4;
        ctx.beginPath(); ctx.moveTo(0, y);
        for (x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / w * 6.2832 * f + ph) * amp);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return c;
    }
    function waterCanvas() {
      var w = 512, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(4242), i, x;
      var g = ctx.createLinearGradient(0, 0, w, w); g.addColorStop(0, '#2d8bbd'); g.addColorStop(1, '#2377a8');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
      for (i = 0; i < 110; i++) {
        var y0 = r() * w, amp = 3 + r() * 7, f = Math.floor(2 + r() * 3), ph = r() * 6, len = 90 + r() * 200, x0 = r() * w;
        ctx.strokeStyle = r() > 0.45 ? '#a6dcf0' : '#1c6494';
        ctx.globalAlpha = 0.16 + r() * 0.22; ctx.lineWidth = 1.5 + r() * 2.5; ctx.lineCap = 'round';
        for (var dy = -w; dy <= w; dy += w) for (var dx = -w; dx <= w; dx += w) {
          ctx.beginPath();
          for (x = 0; x <= len; x += 10) {
            var px = x0 + x + dx, py = y0 + dy + Math.sin((x0 + x) / w * 6.2832 * f + ph) * amp;
            if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      return c;
    }

    // ------------------------------------------------------------------ mesa, marco y mar (estáticos)
    var table = mesh(new THREE.PlaneGeometry(140, 140), M(0xffffff, 0.75, 0, { env: 0.2, map: tex(woodCanvas('#6a4a2e', '#3f2a17', '#8c6a45', 11), 14, 14) }), false, true);
    table.rotation.x = -Math.PI / 2; table.position.y = -0.01;
    scene.add(table);

    function hexPath(P, r) {
      var p = new P();
      for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3, x = r * Math.cos(a), y = r * Math.sin(a); if (i) p.lineTo(x, y); else p.moveTo(x, y); }
      p.closePath();
      return p;
    }
    var frameShape = hexPath(THREE.Shape, RC + 0.55);
    frameShape.holes.push(hexPath(THREE.Path, RC));
    var frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    frameGeo.rotateX(-Math.PI / 2); frameGeo.translate(0, 0.04, 0);
    var woodFrame = mesh(frameGeo, M(0xffffff, 0.55, 0, { env: 0.4, map: tex(woodCanvas('#b98a55', '#7c552a', '#d9b27a', 5), 0.18, 0.18) }));
    scene.add(woodFrame);

    var waterTex = tex(waterCanvas(), 1 / 4.2, 1 / 4.2);
    var waterGeo = new THREE.ShapeGeometry(hexPath(THREE.Shape, RC + 0.05));
    waterGeo.rotateX(-Math.PI / 2);
    var water = mesh(waterGeo, M(0xffffff, 0.3, 0.1, { env: 1.1, map: waterTex }), false, true);
    water.position.y = WATER_Y;
    scene.add(water);

    // ------------------------------------------------------------------ geometrías y materiales compartidos
    var HEX_R = 1;           // = circunradio de la grilla: las casillas se tocan (la bisel deja la línea divisoria)
    function tileShape() {
      var s = new THREE.Shape(), r = HEX_R - 0.05;
      for (var i = 0; i < 6; i++) { var a = Math.PI / 2 + i * Math.PI / 3, x = r * Math.cos(a), y = r * Math.sin(a); if (i) s.lineTo(x, y); else s.moveTo(x, y); }
      s.closePath();
      return s;
    }
    var tileGeo = new THREE.ExtrudeGeometry(tileShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
    tileGeo.rotateX(-Math.PI / 2); tileGeo.translate(0, 0.05, 0);

    var TERRAINS = {
      forest:    { name: 'Bosque',    res: 'Madera',  ui: '#3f8f45' },
      pasture:   { name: 'Pradera',   res: 'Lana',    ui: '#a7d15c' },
      fields:    { name: 'Campo',     res: 'Trigo',   ui: '#e8bf45' },
      hills:     { name: 'Colina',    res: 'Ladrillo', ui: '#c96a3b' },
      mountains: { name: 'Montaña',   res: 'Mineral', ui: '#8d949c' },
      desert:    { name: 'Desierto',  res: 'Nada',    ui: '#e3c78d' }
    };
    var tileSideMat = M(0x8a6f4d, 0.8, 0, { env: 0.3 });
    Object.keys(TERRAINS).forEach(function (k) {
      var t = tex(terrainCanvas(k)); t.repeat.set(0.52, 0.52); t.offset.set(0.5, 0.5);
      TERRAINS[k].mats = [M(0xffffff, 0.92, 0, { env: 0.25, map: t }), tileSideMat];
    });

    var G = {
      trunk: new THREE.CylinderGeometry(0.035, 0.05, 0.14, 6),
      cone: [new THREE.ConeGeometry(0.2, 0.27, 7), new THREE.ConeGeometry(0.16, 0.25, 7), new THREE.ConeGeometry(0.115, 0.23, 7)],
      sheepBody: new THREE.IcosahedronGeometry(0.09, 1),
      sheepHead: new THREE.IcosahedronGeometry(0.045, 0),
      stalk: new THREE.CylinderGeometry(0.007, 0.013, 0.2, 4),
      ear: new THREE.CylinderGeometry(0.02, 0.012, 0.08, 5),
      brick: new THREE.BoxGeometry(0.15, 0.07, 0.075),
      mound: new THREE.SphereGeometry(0.2, 12, 8),
      rockCone: [], snow: [],
      dune: new THREE.SphereGeometry(0.3, 14, 8),
      cactus: new THREE.CylinderGeometry(0.045, 0.05, 0.28, 8),
      arm: new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8),
      boulder: new THREE.DodecahedronGeometry(0.07, 0),
      tokenBase: new THREE.CylinderGeometry(0.315, 0.335, 0.05, 32),
      tokenFace: new THREE.CircleGeometry(0.28, 32)
    };
    G.stalk.translate(0, 0.1, 0); G.ear.translate(0, 0.235, 0);
    G.mound.scale(1, 0.4, 1); G.dune.scale(1, 0.24, 1);
    var MAT = {
      trunk: M(0x6b4a2b, 0.9), leaf: [M(0x2f7d3a, 0.85, 0, { flat: true }), M(0x3b9046, 0.85, 0, { flat: true }), M(0x276c33, 0.85, 0, { flat: true })],
      wool: M(0xf6f3ea, 0.95, 0, { flat: true }), dark: M(0x33302c, 0.6, 0, { flat: true }),
      stalk: M(0xd8b13c, 0.85), ear: M(0xf0c94e, 0.7),
      brick: M(0xb8452a, 0.75), mound: M(0xa9552d, 0.9),
      rock: M(0x7d848c, 0.85, 0, { flat: true }), rock2: M(0x9aa1a9, 0.85, 0, { flat: true }), snow: M(0xf3f6fa, 0.7, 0, { flat: true }),
      dune: M(0xd9bc82, 0.95), cactus: M(0x4d8f4a, 0.8),
      token: M(0xf3e6c4, 0.55), robber: M(0x24272d, 0.3, 0.35, { env: 0.8 }),
      dock: M(0x8a5a2b, 0.8), hull: M(0x8b5a34, 0.6), sail: M(0xf4ecd8, 0.85), road: null
    };
    MAT.snow.polygonOffset = true; MAT.snow.polygonOffsetFactor = -2; MAT.snow.polygonOffsetUnits = -2;
    MAT.token.emissive = new THREE.Color(0xf3e6c4); MAT.token.emissiveIntensity = 0.35;
    var PLAYERS = [0xd94141, 0x3b6fd6, 0xf0932b, 0xf1eee6].map(function (h) { return M(h, 0.38, 0.05, { env: 0.6 }); });

    // ------------------------------------------------------------------ piezas (casas, ciudades, caminos, ladrón)
    function houseGeo(w, h, d, roof) {
      var s = new THREE.Shape();
      s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(0, h + roof); s.lineTo(-w / 2, h); s.closePath();
      var g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
      g.translate(0, 0, -d / 2);
      return g;
    }
    var HOUSE = houseGeo(0.24, 0.16, 0.2, 0.12);
    var CITY_HALL = houseGeo(0.3, 0.13, 0.22, 0.09), CITY_TOWER = houseGeo(0.15, 0.27, 0.17, 0.1);
    function makeSettlement(mat) { var g = new THREE.Group(); g.add(mesh(HOUSE, mat)); return g; }
    function makeCity(mat) {
      var g = new THREE.Group(), a = mesh(CITY_HALL, mat), b = mesh(CITY_TOWER, mat);
      a.position.x = -0.07; b.position.x = 0.14; g.add(a); g.add(b);
      return g;
    }
    var robberGeo = new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.13, 0.03], [0.09, 0.06], [0.055, 0.13], [0.05, 0.22], [0.075, 0.25], [0, 0.25]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 20);
    var headGeo = new THREE.SphereGeometry(0.075, 16, 12);
    function makeRobber() {
      var g = new THREE.Group(); g.add(mesh(robberGeo, MAT.robber));
      var h = mesh(headGeo, MAT.robber); h.position.y = 0.31; g.add(h);
      return g;
    }
    function segment(a, b, y, thick, height, mat) {
      var dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      var m = mesh(new THREE.BoxGeometry(len, height, thick), mat);
      m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      return m;
    }

    // ------------------------------------------------------------------ decoración por terreno
    function insideHex(x, z, r) { return Math.abs(x) <= SQ3 / 2 * r && Math.abs(z) + Math.abs(x) / SQ3 <= r; }
    // Distancia mínima al centro para que un objeto de radio `rad` no pise la ficha del número.
    var TOKEN_R = 0.335;
    function clear(rad) { return TOKEN_R + rad + 0.03; }
    function scatter(n, rmin, minDist, rnd) {
      var pts = [], tries = 0;
      while (pts.length < n && tries++ < 400) {
        var a = rnd() * 6.2832, r = rmin + rnd() * (0.85 - rmin), x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (!insideHex(x, z, 0.78)) continue;
        var ok = true;
        for (var i = 0; i < pts.length; i++) if (Math.hypot(pts[i].x - x, pts[i].z - z) < minDist) { ok = false; break; }
        if (ok) pts.push({ x: x, z: z });
      }
      return pts;
    }
    function decorate(kind, rnd) {
      var g = new THREE.Group(), i, p, pts, o;
      if (kind === 'forest') {
        scatter(8, clear(0.18), 0.24, rnd).forEach(function (p) {
          var t = new THREE.Group(), s = 0.6 + rnd() * 0.3, m = mesh(G.trunk, MAT.trunk); m.position.y = 0.07; t.add(m);
          for (var i = 0; i < 3; i++) { var c = mesh(G.cone[i], MAT.leaf[Math.floor(rnd() * 3)]); c.position.y = 0.16 + i * 0.13; t.add(c); }
          t.scale.setScalar(s); t.rotation.y = rnd() * 6.28; t.position.set(p.x, 0, p.z); g.add(t);
        });
      } else if (kind === 'pasture') {
        scatter(6, clear(0.165), 0.3, rnd).forEach(function (p) {
          var s = new THREE.Group(), b = mesh(G.sheepBody, MAT.wool); b.scale.set(1.25, 1, 1); b.position.y = 0.1; s.add(b);
          var h = mesh(G.sheepHead, MAT.dark); h.position.set(0.12, 0.115, 0); s.add(h);
          [[-0.05, -0.05], [-0.05, 0.05], [0.05, -0.05], [0.05, 0.05]].forEach(function (l) { var leg = mesh(G.stalk, MAT.dark); leg.scale.set(2, 0.45, 2); leg.position.set(l[0], 0, l[1]); s.add(leg); });
          s.rotation.y = rnd() * 6.28; s.position.set(p.x, 0, p.z); s.scale.setScalar(0.8 + rnd() * 0.2); g.add(s);
        });
      } else if (kind === 'fields') {
        var mats = [], n = 0, tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
        for (var x = -0.66; x <= 0.67; x += 0.115) for (var z = -0.72; z <= 0.72; z += 0.085) {
          if (!insideHex(x, z, 0.8) || Math.hypot(x, z) < TOKEN_R + 0.07) continue;
          e.set((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25); q.setFromEuler(e);
          var s = 0.85 + rnd() * 0.4; sc.set(1, s, 1); ps.set(x + (rnd() - 0.5) * 0.03, 0, z + (rnd() - 0.5) * 0.03);
          tmpM.compose(ps, q, sc); mats.push(tmpM.clone()); n++;
        }
        var st = new THREE.InstancedMesh(G.stalk, MAT.stalk, n), ea = new THREE.InstancedMesh(G.ear, MAT.ear, n);
        for (i = 0; i < n; i++) { st.setMatrixAt(i, mats[i]); ea.setMatrixAt(i, mats[i]); }
        st.castShadow = false; ea.castShadow = false; st.receiveShadow = true; ea.receiveShadow = true;
        g.add(st); g.add(ea);
      } else if (kind === 'hills') {
        scatter(3, clear(0.2), 0.4, rnd).forEach(function (p) {
          var pile = new THREE.Group(), rows = [3, 2, 1];
          rows.forEach(function (cnt, li) {
            for (var k = 0; k < cnt; k++) { var b = mesh(G.brick, MAT.brick); b.position.set((k - (cnt - 1) / 2) * 0.16, 0.035 + li * 0.07, 0); b.rotation.y = (rnd() - 0.5) * 0.15; pile.add(b); }
          });
          pile.rotation.y = rnd() * 6.28; pile.position.set(p.x, 0, p.z); pile.scale.setScalar(0.8); g.add(pile);
        });
        scatter(3, clear(0.15), 0.35, rnd).forEach(function (p) { var m = mesh(G.mound, MAT.mound); m.position.set(p.x, 0, p.z); m.scale.setScalar(0.45 + rnd() * 0.3); g.add(m); });
      } else if (kind === 'mountains') {
        scatter(4, clear(0.24), 0.42, rnd).forEach(function (p, idx) {
          var R = 0.16 + rnd() * 0.08, H = 0.5 + rnd() * 0.28, cone = mesh(new THREE.ConeGeometry(R, H, 5), idx % 2 ? MAT.rock2 : MAT.rock);
          cone.position.set(p.x, H / 2, p.z); cone.rotation.y = rnd() * 6;
          // El casquete tiene la misma pendiente que la roca: si coinciden exactamente, las caras
          // se pelean por la profundidad (z-fighting) y la nieve titila. Se agranda un 8 % sobre el mismo ápice.
          var Hc = H * 0.35 * 1.08, cap = mesh(new THREE.ConeGeometry(R * 0.35 * 1.08, Hc, 5), MAT.snow);
          cap.position.set(p.x, H + 0.004 - Hc / 2, p.z); cap.rotation.y = cone.rotation.y;
          g.add(cone); g.add(cap);
        });
        scatter(3, clear(0.09), 0.3, rnd).forEach(function (p) { var b = mesh(G.boulder, MAT.rock); b.position.set(p.x, 0.04, p.z); b.scale.setScalar(0.6 + rnd() * 0.7); g.add(b); });
      } else if (kind === 'desert') {
        scatter(3, 0.42, 0.45, rnd).forEach(function (p) { var d = mesh(G.dune, MAT.dune); d.position.set(p.x, 0, p.z); d.scale.setScalar(0.7 + rnd() * 0.5); d.rotation.y = rnd() * 6; g.add(d); });
        scatter(2, 0.5, 0.5, rnd).forEach(function (p) {
          var c = new THREE.Group(), b = mesh(G.cactus, MAT.cactus); b.position.y = 0.14; c.add(b);
          var a1 = mesh(G.arm, MAT.cactus); a1.position.set(-0.07, 0.17, 0); a1.rotation.z = 0.6; c.add(a1);
          var a2 = mesh(G.arm, MAT.cactus); a2.position.set(0.07, 0.13, 0); a2.rotation.z = -0.6; c.add(a2);
          c.position.set(p.x, 0, p.z); c.rotation.y = rnd() * 6; g.add(c);
        });
      }
      g.scale.y = DECOR_HEIGHT;
      g.position.y = TILE_TOP;
      return g;
    }

    function tokenTexture(n) {
      var c = makeCanvas(128, 128), ctx = c.getContext('2d'), red = (n === 6 || n === 8);
      ctx.fillStyle = '#fff3d2'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#3b2a18'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(64, 64, 58, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = red ? '#b3261e' : '#2b2118';
      // Se mide el trazo real del número (no la caja de la tipografía) y se centra el bloque
      // número + puntos en el círculo, tanto en horizontal como en vertical.
      var label = String(n), size = n >= 10 ? 74 : 88, m, w, maxW = 76;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold ' + size + 'px Georgia, "Times New Roman", serif'; m = ctx.measureText(label);
      w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      if (w > maxW) { size = Math.floor(size * maxW / w); ctx.font = 'bold ' + size + 'px Georgia, "Times New Roman", serif'; m = ctx.measureText(label); w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight; }
      var dots = 6 - Math.abs(7 - n), dotR = 6, dotStep = 15, gap = 9;
      var numH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, top = 64 - (numH + gap + dotR * 2) / 2;
      ctx.fillText(label, 64 - w / 2 + m.actualBoundingBoxLeft, top + m.actualBoundingBoxAscent);
      var sx = 64 - (dots - 1) * dotStep / 2, dy = top + numH + gap + dotR;
      for (var i = 0; i < dots; i++) { ctx.beginPath(); ctx.arc(sx + i * dotStep, dy, dotR, 0, 6.2832); ctx.fill(); }
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      return t;
    }
    var tokenTexCache = {};
    function makeToken(n) {
      var g = new THREE.Group(); g.add(mesh(G.tokenBase, MAT.token)); g.children[0].position.y = 0.025;
      if (!tokenTexCache[n]) { var tt = tokenTexture(n); tokenTexCache[n] = new THREE.MeshStandardMaterial({ map: tt, emissive: 0xffffff, emissiveMap: tt, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0, envMapIntensity: 0.2 }); }
      var f = new THREE.Mesh(G.tokenFace, tokenTexCache[n]); f.rotation.x = -Math.PI / 2; f.position.y = 0.052; f.receiveShadow = true;
      g.add(f); g.position.y = TILE_TOP;
      return g;
    }

    // ------------------------------------------------------------------ puertos
    var hullShape = new THREE.Shape();
    hullShape.moveTo(-0.34, 0.16); hullShape.lineTo(-0.24, 0); hullShape.lineTo(0.24, 0); hullShape.lineTo(0.42, 0.16); hullShape.closePath();
    var HULL = new THREE.ExtrudeGeometry(hullShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    HULL.translate(0, 0, -0.11);
    var sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(0.3, 0); sailShape.lineTo(0, 0.44); sailShape.closePath();
    var SAIL = new THREE.ExtrudeGeometry(sailShape, { depth: 0.012, bevelEnabled: false });
    var MAST = new THREE.CylinderGeometry(0.014, 0.014, 0.55, 6);

    var PORT_RES = { forest: 'Madera', hills: 'Ladrillo', pasture: 'Lana', fields: 'Trigo', mountains: 'Mineral' };
    function portLabel(kind) {
      var c = makeCanvas(256, 128), ctx = c.getContext('2d');
      var strip = kind ? TERRAINS[kind].ui : '#d9d2c3', txt = kind ? PORT_RES[kind] : 'Cualquiera';
      ctx.fillStyle = '#f6ecd4'; ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(18, 4); ctx.lineTo(238, 4); ctx.quadraticCurveTo(252, 4, 252, 18); ctx.lineTo(252, 110); ctx.quadraticCurveTo(252, 124, 238, 124); ctx.lineTo(18, 124); ctx.quadraticCurveTo(4, 124, 4, 110); ctx.lineTo(4, 18); ctx.quadraticCurveTo(4, 4, 18, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = strip; ctx.fillRect(10, 82, 236, 36);
      ctx.fillStyle = '#2b2118'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 56px Georgia, "Times New Roman", serif'; ctx.fillText(kind ? '2:1' : '3:1', 128, 40);
      ctx.font = 'bold 24px "Nunito Sans", Arial, sans-serif'; ctx.fillStyle = (kind === 'forest' || kind === 'hills' || kind === 'mountains') ? '#ffffff' : '#2b2118';
      ctx.fillText(txt, 128, 101);
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      return t;
    }

    // ------------------------------------------------------------------ tablero
    var board = null, tiles = [], tileMeshes = [], ships = [], robber = null, robberBase = 0, robberPulse = 0, piecesGroup = null;
    var showPieces = true;
    var NB = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

    function makeMapData(rnd) {
      var coords = [], q, r;
      for (q = -2; q <= 2; q++) for (r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) coords.push({ q: q, r: r });
      var kinds = [];
      [['forest', 4], ['pasture', 4], ['fields', 4], ['hills', 3], ['mountains', 3], ['desert', 1]].forEach(function (p) { for (var i = 0; i < p[1]; i++) kinds.push(p[0]); });
      shuffle(kinds, rnd);
      var base = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12], nums, ok, tries = 0, list;
      do {
        nums = shuffle(base.slice(), rnd); var ni = 0;
        list = coords.map(function (c, i) { return { q: c.q, r: c.r, kind: kinds[i], num: kinds[i] === 'desert' ? 0 : nums[ni++] }; });
        ok = true;
        for (var a = 0; a < list.length && ok; a++) {
          if (list[a].num !== 6 && list[a].num !== 8) continue;
          for (var d = 0; d < 6; d++) {
            for (var b = 0; b < list.length; b++) if (list[b].q === list[a].q + NB[d][0] && list[b].r === list[a].r + NB[d][1] && (list[b].num === 6 || list[b].num === 8)) ok = false;
          }
        }
      } while (!ok && ++tries < 600);
      return list;
    }

    function buildBoard(seed) {
      if (board) scene.remove(board);
      var rnd = mulberry32(seed);
      board = new THREE.Group(); scene.add(board);
      tiles = []; tileMeshes = []; ships = []; robber = null; hoverTile = null;

      // casillas
      makeMapData(rnd).forEach(function (d) {
        var t = { q: d.q, r: d.r, kind: d.kind, num: d.num, x: SQ3 * (d.q + d.r / 2), z: 1.5 * d.r, pulse: 0 };
        t.group = new THREE.Group(); t.group.position.set(t.x, 0, t.z);
        t.mesh = mesh(tileGeo, TERRAINS[d.kind].mats); t.group.add(t.mesh); t.mesh.userData.tile = t;
        t.group.add(decorate(d.kind, mulberry32(Math.floor(rnd() * 1e9))));
        if (d.num) { t.token = makeToken(d.num); t.group.add(t.token); }
        board.add(t.group); tiles.push(t); tileMeshes.push(t.mesh);
      });

      // vértices y aristas
      var vertices = [], vmap = {}, edges = {};
      function vid(x, z) {
        var k = Math.round(x * 50) + ',' + Math.round(z * 50);
        if (vmap[k] === undefined) { vmap[k] = vertices.length; vertices.push({ x: x, z: z, tiles: [], nb: [] }); }
        return vmap[k];
      }
      tiles.forEach(function (t) {
        var c = [];
        for (var k = 0; k < 6; k++) { var a = Math.PI / 2 + k * Math.PI / 3; c.push(vid(t.x + Math.cos(a), t.z - Math.sin(a))); }
        c.forEach(function (i) { vertices[i].tiles.push(t); });
        for (var k2 = 0; k2 < 6; k2++) {
          var A = c[k2], B = c[(k2 + 1) % 6], key = Math.min(A, B) + '_' + Math.max(A, B);
          if (!edges[key]) { edges[key] = { a: A, b: B, tiles: [] }; if (vertices[A].nb.indexOf(B) < 0) vertices[A].nb.push(B); if (vertices[B].nb.indexOf(A) < 0) vertices[B].nb.push(A); }
          edges[key].tiles.push(t);
        }
      });

      // puertos (9, patrón de separación 3-3-4)
      var coast = Object.keys(edges).map(function (k) { return edges[k]; }).filter(function (e) { return e.tiles.length === 1; });
      coast.forEach(function (e) { e.mx = (vertices[e.a].x + vertices[e.b].x) / 2; e.mz = (vertices[e.a].z + vertices[e.b].z) / 2; e.ang = Math.atan2(e.mz, e.mx); });
      coast.sort(function (p, q) { return p.ang - q.ang; });
      var kinds = shuffle([null, null, null, null, 'forest', 'hills', 'pasture', 'fields', 'mountains'], rnd);
      [0, 3, 6, 10, 13, 16, 20, 23, 26].forEach(function (idx, i) {
        var e = coast[idx % coast.length], t = e.tiles[0], nx = e.mx - t.x, nz = e.mz - t.z, nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
        var A = vertices[e.a], B = vertices[e.b], P = { x: e.mx + nx * 1.1, z: e.mz + nz * 1.1 }, D = { x: e.mx + nx * 0.55, z: e.mz + nz * 0.55 };
        board.add(segment(A, D, WATER_Y + 0.03, 0.05, 0.035, MAT.dock)); board.add(segment(B, D, WATER_Y + 0.03, 0.05, 0.035, MAT.dock));
        var ship = new THREE.Group(); ship.add(mesh(HULL, MAT.hull));
        var mast = mesh(MAST, MAT.dock); mast.position.set(0.02, 0.43, 0); ship.add(mast);
        var sail = mesh(SAIL, MAT.sail); sail.position.set(0.035, 0.2, -0.006); ship.add(sail);
        var lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: portLabel(kinds[i]), transparent: true }));
        lab.scale.set(0.95, 0.475, 1); lab.position.set(0, 1.02, 0); ship.add(lab);
        ship.position.set(P.x, WATER_Y, P.z); ship.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x);
        ship.userData.phase = i * 1.3; ship.userData.baseY = WATER_Y - 0.02;
        board.add(ship); ships.push(ship);
      });

      // ladrón en el desierto
      var desert = tiles.filter(function (t) { return t.kind === 'desert'; })[0];
      robber = makeRobber(); robber.position.set(0.05, TILE_TOP, 0.03); robberBase = TILE_TOP; robberPulse = 0;
      desert.group.add(robber);

      // piezas de ejemplo
      piecesGroup = new THREE.Group(); piecesGroup.visible = showPieces; board.add(piecesGroup);
      placePieces(vertices, edges, rnd);
    }

    function placePieces(vertices, edges, rnd) {
      var occ = {}, used = {}, order = shuffle(vertices.map(function (v, i) { return i; }).filter(function (i) { return vertices[i].tiles.length >= 2; }), rnd);
      var settl = [[], [], [], []], roads = [[], [], [], []], p, round, i, ek;
      function key(a, b) { return Math.min(a, b) + '_' + Math.max(a, b); }
      function free(i) { return occ[i] === undefined && !vertices[i].nb.some(function (j) { return occ[j] !== undefined; }); }
      for (round = 0; round < 2; round++) for (p = 0; p < 4; p++) {
        var pick = order.filter(free)[0];
        if (pick === undefined) continue;
        occ[pick] = { p: p, city: false }; settl[p].push(pick);
      }
      function addRoad(p, a, b) { ek = key(a, b); if (used[ek] || !edges[ek]) return false; used[ek] = true; roads[p].push([a, b]); return true; }
      for (p = 0; p < 4; p++) settl[p].forEach(function (s) {
        var nb = shuffle(vertices[s].nb.slice(), rnd);
        for (var k = 0; k < nb.length; k++) if (addRoad(p, s, nb[k])) break;
      });
      for (p = 0; p < 4; p++) for (var extra = 0; extra < 2; extra++) {
        var pool = roads[p].slice(); if (!pool.length) continue;
        var rd = pool[Math.floor(rnd() * pool.length)], end = rnd() > 0.5 ? rd[0] : rd[1];
        var nb2 = shuffle(vertices[end].nb.slice(), rnd);
        for (var k2 = 0; k2 < nb2.length; k2++) { if (occ[nb2[k2]] !== undefined && occ[nb2[k2]].p !== p) continue; if (addRoad(p, end, nb2[k2])) break; }
      }
      if (settl[0].length) occ[settl[0][0]].city = true;
      if (settl[1].length > 1) occ[settl[1][1]].city = true;

      for (p = 0; p < 4; p++) roads[p].forEach(function (r) {
        var A = vertices[r[0]], B = vertices[r[1]], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
        var ux = dx / L, uz = dz / L, a = { x: A.x + ux * 0.2, z: A.z + uz * 0.2 }, b = { x: B.x - ux * 0.2, z: B.z - uz * 0.2 };
        piecesGroup.add(segment(a, b, TILE_TOP + 0.045, 0.085, 0.07, PLAYERS[p]));
      });
      Object.keys(occ).forEach(function (vi) {
        var o = occ[vi], v = vertices[vi], m = o.city ? makeCity(PLAYERS[o.p]) : makeSettlement(PLAYERS[o.p]);
        m.position.set(v.x, TILE_TOP, v.z); m.rotation.y = Math.floor(rnd() * 6) * Math.PI / 3 + Math.PI / 6;
        piecesGroup.add(m);
      });
    }

    // ------------------------------------------------------------------ interacción
    var raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), hoverTile = null;
    var hoverBox = document.getElementById('hover');
    function setHover(t) {
      if (t === hoverTile) return;
      hoverTile = t;
      if (!t) { hoverBox.hidden = true; return; }
      var T = TERRAINS[t.kind];
      hoverBox.innerHTML = '<strong></strong><span></span>';
      hoverBox.firstChild.textContent = T.name + (t.num ? ' · ' + t.num : '');
      hoverBox.lastChild.textContent = t.num ? 'Produce ' + T.res.toLowerCase() : 'No produce nada';
      hoverBox.hidden = false;
    }
    renderer.domElement.addEventListener('pointermove', function (e) {
      if (e.buttons) { setHover(null); return; }
      var r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      var hit = raycaster.intersectObjects(tileMeshes, false)[0];
      setHover(hit ? hit.object.userData.tile : null);
    });
    renderer.domElement.addEventListener('pointerleave', function () { setHover(null); });

    var diceBox = document.getElementById('dice'), diceTimer = null;
    function rollDice() {
      var a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6), s = a + b, kinds = [];
      diceBox.innerHTML = '<b></b><span></span>';
      diceBox.firstChild.textContent = a + ' + ' + b + ' = ' + s;
      if (s === 7) { robberPulse = 1; diceBox.lastChild.textContent = 'Sale el 7: se mueve el ladrón'; }
      else {
        tiles.forEach(function (t) { if (t.num === s) { t.pulse = 1; if (kinds.indexOf(TERRAINS[t.kind].res) < 0) kinds.push(TERRAINS[t.kind].res); } });
        diceBox.lastChild.textContent = kinds.length ? 'Producen: ' + kinds.join(', ') : 'Ninguna casilla produce';
      }
      diceBox.hidden = false;
      clearTimeout(diceTimer); diceTimer = setTimeout(function () { diceBox.hidden = true; }, 3200);
    }

    function pressed(btn, on) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    document.getElementById('btnNew').addEventListener('click', function () { buildBoard((Math.random() * 1e9) | 0); });
    document.getElementById('btnDice').addEventListener('click', rollDice);
    var lightBtns = Array.prototype.slice.call(document.querySelectorAll('[data-light]'));
    lightBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        tar = presetState(PRESETS[b.getAttribute('data-light')]);
        lightBtns.forEach(function (o) { pressed(o, o === b); });
      });
    });
    var btnPieces = document.getElementById('btnPieces');
    btnPieces.addEventListener('click', function () { showPieces = !showPieces; pressed(btnPieces, showPieces); if (piecesGroup) piecesGroup.visible = showPieces; });
    var btnSpin = document.getElementById('btnSpin');
    btnSpin.addEventListener('click', function () { controls.autoRotate = !controls.autoRotate; pressed(btnSpin, controls.autoRotate); });

    // ------------------------------------------------------------------ tamaño
    function resize() {
      var w = stage.clientWidth || 800, h = stage.clientHeight || 600, aspect = w / h;
      renderer.setSize(w, h, false);
      camera.aspect = aspect;
      camera.fov = aspect < 0.75 ? 58 : aspect < 1.1 ? 46 : 35;
      camera.updateProjectionMatrix();
    }
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(resize); ro.observe(stage); } else window.addEventListener('resize', resize);
    resize();

    // ------------------------------------------------------------------ bucle
    buildBoard((Date.now() & 0xffffff) | 1);
    applyLight(1);
    var clock = new THREE.Clock(), time = 0, frames = 0, acc = 0, statsEl = document.getElementById('stats');
    function frame() {
      if (disposed) return; raf = requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05); time += dt;
      controls.update();
      applyLight(1 - Math.exp(-dt * 3.5));

      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i], bounce = 0;
        if (t.pulse > 0) { t.pulse = Math.max(0, t.pulse - dt / 1.8); bounce = Math.abs(Math.sin((1 - t.pulse) * Math.PI * 2.5)) * DICE_BOUNCE * t.pulse; }
        t.group.position.y = bounce;
      }
      if (robber) {
        if (robberPulse > 0) { robberPulse = Math.max(0, robberPulse - dt / 1.6); robber.position.y = robberBase + Math.abs(Math.sin((1 - robberPulse) * Math.PI * 3)) * 0.35 * robberPulse; }
        else robber.position.y = robberBase;
      }
      for (var s = 0; s < ships.length; s++) {
        var sh = ships[s], ph = sh.userData.phase;
        sh.position.y = sh.userData.baseY + Math.sin(time * 1.4 + ph) * 0.025 + 0.02;
        sh.rotation.z = Math.sin(time * 1.1 + ph) * 0.05;
      }
      waterTex.offset.x = (time * 0.006) % 1; waterTex.offset.y = (time * 0.004) % 1;

      renderer.render(scene, camera);
      frames++; acc += dt;
      if (acc >= 0.6) {
        var inf = renderer.info.render;
        statsEl.textContent = Math.round(frames / acc) + ' FPS · ' + inf.calls + ' draw calls · ' + Math.round(inf.triangles / 1000) + 'k triángulos';
        frames = 0; acc = 0;
      }
    }
    frame();
  }
}
