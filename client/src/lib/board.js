// @ts-nocheck
/* eslint-disable */
// Tablero 3D (three r128, JS plano). Nació de un prototipo HTML ya retirado del repo.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const MARKUP = `
<div id="stage">
  <div class="vignette"></div>

  <header class="panel title">
    <h1 class="logo"><span class="sr-only">Paisano</span></h1>
    <p class="tagline">Hacé tu tierra.</p>
  </header>

  <div class="panel hover" id="hover" hidden></div>
  <div class="dice" id="dice" role="status" aria-live="polite" hidden></div>

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
    // Arranca con el tablero bien encuadrado y una inclinación de ~30° respecto de la vertical (a distancia ~17) para que
    // se note el 3D antes de mover nada. El norte del tablero queda hacia arriba de la pantalla.
    camera.position.set(0, 14.9, 8.5);

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 30;
    controls.minPolarAngle = 0; // permite volver a la vista cenital; se puede inclinar hasta maxPolarAngle
    controls.maxPolarAngle = 1.3;

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
      // Piezas de jugador: pieceK = luminosidad (1 = color pleno), pieceS = saturación (1 = la del color pleno),
      // pieceEm = brillo propio (emisivo). De día son más intensas y profundas, de noche se iluminan, para que
      // siempre contrasten con el tablero.
      day:   { bg: 0xb9c9cf, sun: 0xfff2dc, sunI: 1.25, sunPos: [7, 13, 6],    sky: 0xdcecff, ground: 0x8f7a5c, hemiI: 0.62, env: 1.0,  exp: 1.05, lamps: 0,    pieceK: 0.72, pieceS: 1.3,  pieceEm: 0 },
      dusk:  { bg: 0x4a3040, sun: 0xff9a55, sunI: 1.55, sunPos: [-11, 4.6, 6], sky: 0xffb98a, ground: 0x4a3350, hemiI: 0.45, env: 0.6,  exp: 1.05, lamps: 0.35, pieceK: 0.9,  pieceS: 1.12, pieceEm: 0.22 },
      night: { bg: 0x090e1d, sun: 0x9fb6ff, sunI: 0.6,  sunPos: [-6, 12, 4],   sky: 0x3a4a8a, ground: 0x1a1a2a, hemiI: 0.4,  env: 0.28, exp: 1.0,  lamps: 1.25, pieceK: 1.0,  pieceS: 1.0,  pieceEm: 0.65 }
    };
    function presetState(p) {
      return {
        bg: col(p.bg), sun: col(p.sun), sunI: p.sunI, sunPos: new THREE.Vector3(p.sunPos[0], p.sunPos[1], p.sunPos[2]),
        sky: col(p.sky), ground: col(p.ground), hemiI: p.hemiI, env: p.env, exp: p.exp, lamps: p.lamps, pieceK: p.pieceK, pieceS: p.pieceS, pieceEm: p.pieceEm
      };
    }
    var cur = presetState(PRESETS.day), tar = presetState(PRESETS.day);
    var lastEnv = -1, pieceHSL = { h: 0, s: 0, l: 0 };
    function applyLight(k) {
      cur.bg.lerp(tar.bg, k); cur.sun.lerp(tar.sun, k); cur.sky.lerp(tar.sky, k); cur.ground.lerp(tar.ground, k);
      cur.sunPos.lerp(tar.sunPos, k);
      cur.sunI += (tar.sunI - cur.sunI) * k; cur.hemiI += (tar.hemiI - cur.hemiI) * k;
      cur.env += (tar.env - cur.env) * k; cur.exp += (tar.exp - cur.exp) * k; cur.lamps += (tar.lamps - cur.lamps) * k;
      cur.pieceK += (tar.pieceK - cur.pieceK) * k; cur.pieceS += (tar.pieceS - cur.pieceS) * k; cur.pieceEm += (tar.pieceEm - cur.pieceEm) * k;
      for (var pi = 0; pi < PLAYERS.length; pi++) {
        var pm = PLAYERS[pi];
        pm.userData.base.getHSL(pieceHSL);
        pm.color.setHSL(pieceHSL.h, Math.min(1, pieceHSL.s * cur.pieceS), pieceHSL.l * cur.pieceK);
        pm.emissive.copy(pm.userData.base); pm.emissiveIntensity = cur.pieceEm;
      }
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
      // Fondo de un solo color (el promedio del degradado anterior). La textura se repite cada 4.2 unidades sobre el mar:
      // un degradado no encaja consigo mismo y dejaba costuras visibles en forma de "bloques".
      ctx.fillStyle = '#2881b3'; ctx.fillRect(0, 0, w, w);
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
      pasture:   { name: 'Llano',     res: 'Vaca',   ui: '#a7d15c' },
      fields:    { name: 'Campo',     res: 'Maíz',    ui: '#e8bf45' },
      hills:     { name: 'Barro',     res: 'Ladrillo', ui: '#c96a3b' },
      mountains: { name: 'Cantera',   res: 'Piedra',  ui: '#8d949c' },
      desert:    { name: 'Desierto',  res: 'Nada',    ui: '#e3c78d' }
    };
    var tileSideMat = M(0x8a6f4d, 0.8, 0, { env: 0.3 });
    Object.keys(TERRAINS).forEach(function (k) {
      var t = tex(terrainCanvas(k)); t.repeat.set(0.52, 0.52); t.offset.set(0.5, 0.5);
      TERRAINS[k].mats = [M(0xffffff, 0.92, 0, { env: 0.25, map: t }), tileSideMat];
    });

    // Cuerpo de vaca: elipsoide de pocos polígonos con las manchas pintadas por cara (color de vértice),
    // así las manchas quedan a ras de la superficie y no sobresalen. `patches` = [dirX, dirY, dirZ, cosRadio].
    function cowBodyGeo(patches) {
      var g = new THREE.IcosahedronGeometry(1, 2), pos = g.attributes.position, n = pos.count, colors = new Float32Array(n * 3);
      var white = col(0xf6f3ea), dark = col(0x2b2723), dirs = patches.map(function (p) { var v = new THREE.Vector3(p[0], p[1], p[2]).normalize(); return { v: v, c: p[3] }; });
      var cen = new THREE.Vector3(), a = new THREE.Vector3();
      for (var f = 0; f < n; f += 3) {
        cen.set(0, 0, 0);
        for (var k = 0; k < 3; k++) cen.add(a.fromBufferAttribute(pos, f + k));
        cen.normalize();
        var isDark = dirs.some(function (d) { return cen.dot(d.v) > d.c; }), c = isDark ? dark : white;
        for (var k2 = 0; k2 < 3; k2++) { colors[(f + k2) * 3] = c.r; colors[(f + k2) * 3 + 1] = c.g; colors[(f + k2) * 3 + 2] = c.b; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.scale(0.125, 0.07, 0.068);
      return g;
    }

    // Roca: icosaedro de pocos polígonos con cada vértice desplazado un poco hacia dentro o hacia fuera.
    // El desplazamiento depende de la posición del vértice (no del orden), así los vértices compartidos
    // se mueven igual y la roca no se abre. Queda algo achatada, como una piedra apoyada en el suelo.
    function rockGeo(seed, radius) {
      var g = new THREE.IcosahedronGeometry(radius, 1), pos = g.attributes.position, v = new THREE.Vector3();
      function h(a, b, c) { var x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + seed * 19.19) * 43758.5453; return x - Math.floor(x); }
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        var k = h(Math.round(v.x * 20), Math.round(v.y * 20), Math.round(v.z * 20));
        v.multiplyScalar(radius * (0.8 + 0.34 * k));
        pos.setXYZ(i, v.x, v.y * 0.85, v.z);
      }
      g.computeVertexNormals();
      return g;
    }

    var G = {
      // árbol de copa ancha (estilo ombú): tronco grueso y copa hecha de tres masas redondeadas
      trunk: new THREE.CylinderGeometry(0.04, 0.06, 0.2, 6),
      crown: [new THREE.IcosahedronGeometry(0.13, 1), new THREE.IcosahedronGeometry(0.095, 1), new THREE.IcosahedronGeometry(0.085, 1)],
      // vaca
      cowBody: [
        cowBodyGeo([[-0.3, 0.8, 0.5, 0.8], [0.5, 0.6, -0.6, 0.82], [-0.8, 0.3, -0.4, 0.86]]),
        cowBodyGeo([[0.1, 0.9, -0.4, 0.78], [-0.6, 0.4, 0.7, 0.84], [0.7, 0.2, 0.6, 0.88]]),
        cowBodyGeo([[-0.2, 0.7, -0.7, 0.8], [0.6, 0.7, 0.4, 0.82], [-0.9, 0.1, 0.3, 0.88]])
      ],
      cowHead: new THREE.IcosahedronGeometry(0.052, 1),
      cowMuzzle: new THREE.IcosahedronGeometry(0.034, 1),
      cowLeg: new THREE.CylinderGeometry(0.017, 0.013, 0.07, 6),
      cowEar: new THREE.IcosahedronGeometry(0.02, 0),
      cowHorn: new THREE.ConeGeometry(0.009, 0.038, 4),
      cowTail: new THREE.CylinderGeometry(0.008, 0.008, 0.075, 4),
      cowTuft: new THREE.IcosahedronGeometry(0.016, 0),
      // planta de maíz (se instancia): tallo, dos hojas, choclo y penacho
      cornStalk: new THREE.CylinderGeometry(0.013, 0.02, 0.22, 5),
      cornLeafA: new THREE.ConeGeometry(0.028, 0.15, 4),
      cornLeafB: new THREE.ConeGeometry(0.028, 0.15, 4),
      cornCob: new THREE.CylinderGeometry(0.022, 0.015, 0.09, 6),
      cornTassel: new THREE.ConeGeometry(0.016, 0.06, 4),
      brick: new THREE.BoxGeometry(0.15, 0.07, 0.075),
      mound: new THREE.SphereGeometry(0.2, 12, 8),
      // rocas: masas irregulares de pocos polígonos (3 grandes + 2 chicas), no conos
      rockBig: [rockGeo(1, 0.19), rockGeo(2, 0.19), rockGeo(3, 0.19)],
      rockSmall: [rockGeo(4, 0.08), rockGeo(5, 0.08)],
      tokenBase: new THREE.CylinderGeometry(0.315, 0.335, 0.05, 32),
      tokenFace: new THREE.CircleGeometry(0.28, 32)
    };
    G.mound.scale(1, 0.4, 1);
    G.cowHead.scale(1.15, 0.95, 0.9); G.cowMuzzle.scale(0.8, 0.85, 1.1); G.cowEar.scale(1, 0.5, 1.3);
    G.cowLeg.translate(0, 0.035, 0); G.cowHorn.translate(0, 0.019, 0); G.cowTail.translate(0, -0.0375, 0);
    // las partes del maíz se hornean en su posición para poder instanciarlas con la misma matriz
    G.cornStalk.translate(0, 0.11, 0);
    G.cornLeafA.translate(0, 0.075, 0); G.cornLeafA.rotateZ(-0.9); G.cornLeafA.translate(0, 0.1, 0);
    G.cornLeafB.translate(0, 0.075, 0); G.cornLeafB.rotateZ(0.9); G.cornLeafB.rotateY(Math.PI / 2); G.cornLeafB.translate(0, 0.13, 0);
    G.cornCob.translate(0, 0.045, 0); G.cornCob.rotateZ(-0.55); G.cornCob.translate(0.014, 0.14, 0);
    G.cornTassel.translate(0, 0.25, 0);
    var MAT = {
      trunk: M(0x6b4a2b, 0.9), leaf: [M(0x2f7d3a, 0.85, 0, { flat: true }), M(0x3b9046, 0.85, 0, { flat: true }), M(0x4aa050, 0.85, 0, { flat: true })],
      cowWhite: M(0xf6f3ea, 0.9, 0, { flat: true }), dark: M(0x2b2723, 0.7, 0, { flat: true }), cowMuzzle: M(0xe6a9a0, 0.8, 0, { flat: true }), cowHorn: M(0xe9dfc4, 0.7, 0, { flat: true }),
      cowBody: M(0xffffff, 0.9, 0, { flat: true }),
      cornStalk: M(0x5c9a3c, 0.85), cornLeaf: M(0x6fb04a, 0.8, 0, { flat: true }), cornCob: M(0xf2c53d, 0.6), cornTassel: M(0xc9a23a, 0.85),
      brick: M(0xb8452a, 0.75), mound: M(0xa9552d, 0.9),
      rock: M(0x7d848c, 0.85, 0, { flat: true }), rock2: M(0x9aa1a9, 0.85, 0, { flat: true }),
      token: M(0xf3e6c4, 0.55), robber: M(0x24272d, 0.3, 0.35, { env: 0.8 }),
      dock: M(0x8a5a2b, 0.8), hull: M(0x8b5a34, 0.6), sail: M(0xf4ecd8, 0.85), road: null
    };
    MAT.cowBody.vertexColors = true; // las manchas van en el color de los vértices del cuerpo
    MAT.token.emissive = new THREE.Color(0xf3e6c4); MAT.token.emissiveIntensity = 0.35;
    var PLAYERS = [0xd94141, 0x3b6fd6, 0xf0932b, 0xf1eee6].map(function (h) {
      var m = M(h, 0.38, 0.05, { env: 0.6 }), hsl = { h: 0, s: 0, l: 0 };
      // color base guardado: applyLight() lo ajusta (intensidad y brillo propio) según día/atardecer/noche
      m.userData.base = m.color.clone(); m.emissive = new THREE.Color(); m.emissiveIntensity = 0;
      // contorno: tono muy oscuro del propio color del jugador (no negro puro, que se ve como calcomanía)
      m.userData.base.getHSL(hsl);
      m.userData.outline = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hsl.h, hsl.s * 0.9, hsl.l * 0.08), side: THREE.BackSide });
      return m;
    });
    // Contorno de las piezas: copia apenas más grande dibujada solo por las caras traseras, que asoma como un borde
    // fino alrededor de la silueta y separa la pieza de cualquier terreno. Si se cambia el grosor, revisar
    // EDGE_CLEAR y VERT_CLEAR del decorado (espacio reservado alrededor de caminos y esquinas).
    var OUTLINE_T = 0.008;
    function outlineFor(geo, x, mat) {
      geo.computeBoundingBox();
      var b = geo.boundingBox, o = new THREE.Mesh(geo, mat);
      o.scale.set(1 + 2 * OUTLINE_T / (b.max.x - b.min.x), 1 + 2 * OUTLINE_T / (b.max.y - b.min.y), 1 + 2 * OUTLINE_T / (b.max.z - b.min.z));
      o.position.set(x || 0, -OUTLINE_T, 0);
      return o;
    }

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
    function makeSettlement(mat) { var g = new THREE.Group(); g.add(mesh(HOUSE, mat)); g.add(outlineFor(HOUSE, 0, mat.userData.outline)); return g; }
    function makeCity(mat) {
      var g = new THREE.Group(), a = mesh(CITY_HALL, mat), b = mesh(CITY_TOWER, mat);
      a.position.x = -0.07; b.position.x = 0.14; g.add(a); g.add(b);
      g.add(outlineFor(CITY_HALL, -0.07, mat.userData.outline)); g.add(outlineFor(CITY_TOWER, 0.14, mat.userData.outline));
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
    // Cada objeto se trata como un círculo de radio `rad` que debe caber en la casilla sin pisar:
    //  - la ficha del número (centro),
    //  - los caminos (van sobre las aristas; mitad de su ancho = 0.0425, más 0.02 de aire),
    //  - los poblados y ciudades (van en los vértices; la ciudad ocupa ~0.26, más 0.02 de aire).
    var TOKEN_R = 0.335, EDGE_CLEAR = 0.0625, VERT_CLEAR = 0.28;
    var TILE_VERTS = [[0, 1], [0, -1], [SQ3 / 2, 0.5], [SQ3 / 2, -0.5], [-SQ3 / 2, 0.5], [-SQ3 / 2, -0.5]];
    function fitsTile(x, z, rad) {
      // distancia del punto al borde de la casilla (apotema = √3/2 con circunradio 1)
      var edge = Math.min(SQ3 / 2 - Math.abs(x), (1 - (Math.abs(z) + Math.abs(x) / SQ3)) / 1.1547);
      if (edge < rad + EDGE_CLEAR) return false;
      for (var i = 0; i < 6; i++) if (Math.hypot(x - TILE_VERTS[i][0], z - TILE_VERTS[i][1]) < rad + VERT_CLEAR) return false;
      return Math.hypot(x, z) >= TOKEN_R + rad + 0.03;
    }
    // `avoid` (opcional): puntos ya ocupados por otros objetos, a los que hay que respetar `avoidDist`.
    function scatter(n, rad, minDist, rnd, avoid, avoidDist) {
      var pts = [], tries = 0, rmin = TOKEN_R + rad + 0.03;
      while (pts.length < n && tries++ < 400) {
        var a = rnd() * 6.2832, r = rmin + rnd() * (1 - rmin), x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (!fitsTile(x, z, rad)) continue;
        var ok = true;
        for (var i = 0; i < pts.length; i++) if (Math.hypot(pts[i].x - x, pts[i].z - z) < minDist) { ok = false; break; }
        if (ok && avoid) for (var j = 0; j < avoid.length; j++) if (Math.hypot(avoid[j].x - x, avoid[j].z - z) < avoidDist) { ok = false; break; }
        if (ok) pts.push({ x: x, z: z });
      }
      return pts;
    }
    function decorate(kind, rnd) {
      var g = new THREE.Group(), i, p, pts, o;
      if (kind === 'forest') {
        scatter(8, 0.15, 0.22, rnd).forEach(function (p) {
          // tronco + copa ancha de tres masas redondeadas (se lee como árbol, no como cono/montaña)
          var t = new THREE.Group(), s = 0.6 + rnd() * 0.22, m = mesh(G.trunk, MAT.trunk); m.position.y = 0.1; t.add(m);
          [[0, 0.27, 0, 0], [0.085, 0.23, 0.02, 1], [-0.06, 0.25, -0.06, 2]].forEach(function (c) {
            var b = mesh(G.crown[c[3]], MAT.leaf[Math.floor(rnd() * 3)]); b.position.set(c[0], c[1], c[2]); b.rotation.y = rnd() * 6; t.add(b);
          });
          t.scale.setScalar(s); t.rotation.y = rnd() * 6.28; t.position.set(p.x, 0, p.z); g.add(t);
        });
      } else if (kind === 'pasture') {
        scatter(4, 0.19, 0.36, rnd).forEach(function (p) {
          // vaca redondeada y robusta: cuerpo con manchas pintadas (3 variantes), cabeza al frente (+x), hocico, orejas, cuernos, patas y cola.
          // `c` desplaza la vaca 0.03 hacia atrás para que el pivote quede en el centro de su silueta (~0.18 de radio).
          var s = new THREE.Group(), c = new THREE.Group(); c.position.x = -0.03; s.add(c);
          var b = mesh(G.cowBody[Math.floor(rnd() * 3)], MAT.cowBody); b.position.y = 0.11; c.add(b);
          var h = mesh(G.cowHead, MAT.cowWhite); h.position.set(0.14, 0.14, 0); c.add(h);
          var mz = mesh(G.cowMuzzle, MAT.cowMuzzle); mz.position.set(0.185, 0.125, 0); c.add(mz);
          [-1, 1].forEach(function (sd) {
            var ear = mesh(G.cowEar, MAT.dark); ear.position.set(0.125, 0.172, sd * 0.058); c.add(ear);
            var horn = mesh(G.cowHorn, MAT.cowHorn); horn.position.set(0.135, 0.19, sd * 0.03); horn.rotation.x = sd * 0.5; c.add(horn);
          });
          [[-0.075, -0.04], [-0.075, 0.04], [0.075, -0.04], [0.075, 0.04]].forEach(function (l) { var leg = mesh(G.cowLeg, MAT.cowWhite); leg.position.set(l[0], 0, l[1]); c.add(leg); });
          var tail = mesh(G.cowTail, MAT.dark); tail.position.set(-0.128, 0.15, 0); tail.rotation.z = 0.2; c.add(tail);
          var tuft = mesh(G.cowTuft, MAT.dark); tuft.position.set(-0.136, 0.07, 0); c.add(tuft);
          s.rotation.y = rnd() * 6.28; s.position.set(p.x, 0, p.z); s.scale.setScalar(0.85 + rnd() * 0.15); g.add(s);
        });
      } else if (kind === 'fields') {
        var mats = [], n = 0, tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
        // plantas de maíz en filas; cada una gira al azar para que los choclos miren a distintos lados
        for (var x = -0.66; x <= 0.67; x += 0.12) for (var z = -0.72; z <= 0.72; z += 0.1) {
          if (!fitsTile(x, z, 0.14)) continue; // 0.14 = alcance de las hojas de una planta
          e.set((rnd() - 0.5) * 0.12, rnd() * 6.28, (rnd() - 0.5) * 0.12); q.setFromEuler(e);
          var s = 0.85 + rnd() * 0.3; sc.set(s, s, s); ps.set(x + (rnd() - 0.5) * 0.03, 0, z + (rnd() - 0.5) * 0.03);
          tmpM.compose(ps, q, sc); mats.push(tmpM.clone()); n++;
        }
        [[G.cornStalk, MAT.cornStalk], [G.cornLeafA, MAT.cornLeaf], [G.cornLeafB, MAT.cornLeaf], [G.cornCob, MAT.cornCob], [G.cornTassel, MAT.cornTassel]].forEach(function (pair) {
          var im = new THREE.InstancedMesh(pair[0], pair[1], n);
          for (i = 0; i < n; i++) im.setMatrixAt(i, mats[i]);
          im.castShadow = false; im.receiveShadow = true; g.add(im);
        });
      } else if (kind === 'hills') {
        var piles = scatter(3, 0.175, 0.4, rnd);
        piles.forEach(function (p) {
          var pile = new THREE.Group(), rows = [3, 2, 1];
          rows.forEach(function (cnt, li) {
            for (var k = 0; k < cnt; k++) { var b = mesh(G.brick, MAT.brick); b.position.set((k - (cnt - 1) / 2) * 0.16, 0.035 + li * 0.07, 0); b.rotation.y = (rnd() - 0.5) * 0.15; pile.add(b); }
          });
          pile.rotation.y = rnd() * 6.28; pile.position.set(p.x, 0, p.z); pile.scale.setScalar(0.7); g.add(pile);
        });
        // los montículos esquivan las pilas para no pisarse
        scatter(3, 0.13, 0.3, rnd, piles, 0.32).forEach(function (p) { var m = mesh(G.mound, MAT.mound); m.position.set(p.x, 0, p.z); m.scale.setScalar(0.4 + rnd() * 0.25); g.add(m); });
      } else if (kind === 'mountains') {
        // rocas grandes irregulares y, entre ellas, rocas chicas; ninguna pisa la ficha ni se pisan entre sí
        var bigs = scatter(3, 0.185, 0.45, rnd);
        bigs.forEach(function (p, idx) {
          var s = 0.65 + rnd() * 0.2, b = mesh(G.rockBig[Math.floor(rnd() * 3)], idx % 2 ? MAT.rock2 : MAT.rock);
          b.position.set(p.x, 0.11 * s, p.z); b.rotation.y = rnd() * 6.28; b.scale.set(s, s * (0.9 + rnd() * 0.3), s); g.add(b);
        });
        scatter(4, 0.09, 0.22, rnd, bigs, 0.28).forEach(function (p) {
          var s = 0.5 + rnd() * 0.4, b = mesh(G.rockSmall[Math.floor(rnd() * 2)], rnd() > 0.5 ? MAT.rock : MAT.rock2);
          b.position.set(p.x, 0.045 * s, p.z); b.rotation.y = rnd() * 6.28; b.scale.setScalar(s); g.add(b);
        });
      }
      // El desierto no lleva decorado: solo el ladrón, que arranca ahí.
      g.scale.y = DECOR_HEIGHT;
      g.position.y = TILE_TOP;
      return g;
    }

    // Cifras "de altura de mayúscula" (lining): todos los números miden lo mismo de alto. Georgia usa cifras
    // old-style donde el 0, 1 y 2 son bajitos y el 6 y 8 altos, y por eso 10, 11 y 12 se veían mucho más chicos.
    var TOKEN_FONT = '"Times New Roman", Times, "Liberation Serif", serif', TOKEN_MAX_W = 66, tokenSize = 0;
    function tokenFontSize(ctx) {
      // un solo tamaño para TODAS las fichas: el que hace que entre el número más ancho (10, 11, 12) en TOKEN_MAX_W
      if (!tokenSize) {
        var wmax = 1;
        ctx.font = 'bold 100px ' + TOKEN_FONT;
        for (var n = 2; n <= 12; n++) { var m = ctx.measureText(String(n)); wmax = Math.max(wmax, m.actualBoundingBoxLeft + m.actualBoundingBoxRight); }
        tokenSize = Math.min(84, Math.floor(100 * TOKEN_MAX_W / wmax));
      }
      return tokenSize;
    }
    function tokenTexture(n) {
      var c = makeCanvas(128, 128), ctx = c.getContext('2d'), red = (n === 6 || n === 8);
      ctx.fillStyle = '#fff3d2'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#3b2a18'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(64, 64, 60, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = red ? '#b3261e' : '#2b2118';
      // Mismo tamaño de letra y misma altura de bloque para todos los números; solo cambia el centrado horizontal
      // (según el trazo real del número) y la cantidad de puntos, que se centran en el círculo.
      var label = String(n), size = tokenFontSize(ctx), m, w, capH;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = 'bold ' + size + 'px ' + TOKEN_FONT;
      capH = ctx.measureText('0').actualBoundingBoxAscent; m = ctx.measureText(label);
      w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      var dots = 6 - Math.abs(7 - n), dotR = 5.6, dotStep = 14, gap = 8;
      var top = 64 - (capH + gap + dotR * 2) / 2;
      ctx.fillText(label, 64 - w / 2 + m.actualBoundingBoxLeft, top + capH);
      var sx = 64 - (dots - 1) * dotStep / 2, dy = top + capH + gap + dotR;
      for (var i = 0; i < dots; i++) { ctx.beginPath(); ctx.arc(sx + i * dotStep, dy, dotR, 0, 6.2832); ctx.fill(); }
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      return t;
    }
    var tokenTexCache = {};
    function makeToken(n) {
      var g = new THREE.Group(); g.add(mesh(G.tokenBase, MAT.token)); g.children[0].position.y = 0.025;
      if (!tokenTexCache[n]) { var tt = tokenTexture(n); tokenTexCache[n] = new THREE.MeshStandardMaterial({ map: tt, emissive: 0xffffff, emissiveMap: tt, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0, envMapIntensity: 0.2 }); }
      var f = new THREE.Mesh(G.tokenFace, tokenTexCache[n]); f.rotation.x = -Math.PI / 2; f.position.y = 0.052; f.receiveShadow = true;
      // La ficha va al ras de la casilla: su borde queda 4 milésimas sobre la cara superior
      // (no coincide exacto para evitar z-fighting) y el resto del disco queda enterrado.
      g.add(f); g.position.y = TILE_TOP - 0.046;
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

    var PORT_RES = { forest: 'Madera', hills: 'Ladrillo', pasture: 'Vaca', fields: 'Maíz', mountains: 'Piedra' };
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
        // Reglas de reparto: dos casillas vecinas no pueden llevar (1) los números "rojos" 6 y 8 juntos
        // ni (2) el mismo número. Con azar puro, ~81 % de los mapas rompían la regla (2); con este filtro se
        // necesitan ~5 intentos por mapa en promedio.
        ok = true;
        for (var a = 0; a < list.length && ok; a++) {
          if (!list[a].num) continue;
          for (var d = 0; d < 6 && ok; d++) {
            for (var b = 0; b < list.length; b++) {
              if (list[b].q !== list[a].q + NB[d][0] || list[b].r !== list[a].r + NB[d][1] || !list[b].num) continue;
              var redPair = (list[a].num === 6 || list[a].num === 8) && (list[b].num === 6 || list[b].num === 8);
              if (redPair || list[a].num === list[b].num) ok = false;
            }
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
        var edgeLine = segment(a, b, TILE_TOP + 0.045, 0.085 + 2 * OUTLINE_T, 0.07 + 2 * OUTLINE_T, PLAYERS[p].userData.outline);
        edgeLine.castShadow = false; edgeLine.receiveShadow = false; piecesGroup.add(edgeLine);
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

    // ------------------------------------------------------------------ dados (modal con dados 3D de CSS)
    // Cada dado es un cubo de 6 caras con puntos. Para mostrar la cara `v` de frente hay que girar el cubo:
    //   [rotateX, rotateY] en grados; las caras opuestas suman 7 (1-6, 2-5, 3-4).
    var DIE_FACES = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
    var DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    var DIE_LAYOUT = [[1, 'front'], [6, 'back'], [3, 'right'], [4, 'left'], [2, 'top'], [5, 'bottom']];
    var DIE_TILT = 'rotateX(-22deg) rotateY(-28deg)'; // leve inclinación fija para que se vean el techo y un costado
    function buildDie() {
      var el = document.createElement('div'), cube = document.createElement('div');
      el.className = 'die'; el.setAttribute('aria-hidden', 'true'); cube.className = 'cube'; el.appendChild(cube);
      DIE_LAYOUT.forEach(function (f) {
        var face = document.createElement('div'); face.className = 'face ' + f[1] + (f[0] === 1 ? ' one' : '');
        for (var i = 0; i < 9; i++) { var c = document.createElement('span'); if (DIE_PIPS[f[0]].indexOf(i) >= 0) c.className = 'on'; face.appendChild(c); }
        cube.appendChild(face);
      });
      cube.style.transform = DIE_TILT;
      return { el: el, cube: cube, cx: 0, cy: 0 };
    }
    // Gira el dado hasta dejar la cara `v` de frente, sumando vueltas completas (mínimo ~1.5) desde donde estaba.
    function spinDie(die, v, animate) {
      var f = DIE_FACES[v];
      die.cx = f[0] + 360 * Math.ceil((die.cx + 540 - f[0]) / 360 + Math.floor(Math.random() * 2));
      die.cy = f[1] + 360 * Math.ceil((die.cy + 540 - f[1]) / 360 + Math.floor(Math.random() * 2));
      die.cube.style.transition = animate ? 'transform 1.15s cubic-bezier(.15,.75,.25,1)' : 'none';
      die.cube.style.transform = DIE_TILT + ' rotateX(' + die.cx + 'deg) rotateY(' + die.cy + 'deg)';
      die.el.classList.remove('hop'); void die.el.offsetWidth; if (animate) die.el.classList.add('hop');
    }
    var diceBox = document.getElementById('dice'), diceTimer = null, diceBusy = false, btnDice = document.getElementById('btnDice');
    diceBox.innerHTML = '<div class="dice-row"></div><b></b>';
    var diceRow = diceBox.firstChild, diceSum = diceRow.nextSibling;
    var dieA = buildDie(), dieB = buildDie(); diceRow.appendChild(dieA.el); diceRow.appendChild(dieB.el);
    function rollDice() {
      if (diceBusy) return;
      diceBusy = true; btnDice.disabled = true;
      var a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6), s = a + b;
      var animate = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      clearTimeout(diceTimer);
      diceSum.textContent = '';
      diceBox.hidden = false;
      spinDie(dieA, a, animate); spinDie(dieB, b, animate);
      // el resultado (solo el total) y el efecto sobre el tablero aparecen cuando los dados terminan de caer
      diceTimer = setTimeout(function () {
        diceSum.textContent = s;
        if (s === 7) robberPulse = 1;
        else tiles.forEach(function (t) { if (t.num === s) t.pulse = 1; });
        diceBusy = false; btnDice.disabled = false;
        diceTimer = setTimeout(function () { diceBox.hidden = true; }, 3200);
      }, animate ? 1250 : 0);
    }

    function pressed(btn, on) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    document.getElementById('btnNew').addEventListener('click', function () { buildBoard((Math.random() * 1e9) | 0); });
    btnDice.addEventListener('click', rollDice);
    var lightBtns = Array.prototype.slice.call(document.querySelectorAll('[data-light]'));
    lightBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        tar = presetState(PRESETS[b.getAttribute('data-light')]);
        lightBtns.forEach(function (o) { pressed(o, o === b); });
      });
    });
    var btnPieces = document.getElementById('btnPieces');
    btnPieces.addEventListener('click', function () { showPieces = !showPieces; pressed(btnPieces, showPieces); if (piecesGroup) piecesGroup.visible = showPieces; });

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
    var clock = new THREE.Clock(), time = 0;
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
    }
    frame();
  }
}
