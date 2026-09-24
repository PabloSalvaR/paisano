// Casillas: el hexágono con su textura, el decorado de cada terreno (árboles, vacas, maíz, ladrillos, rocas), la ficha del
// número y el brillo de las casillas que salen en los dados.
import * as THREE from 'three';
import { DECOR_HEIGHT, HEX_R, SQ3, TERRAINS, TILE_TOP } from './constants.js';
import { col, makeCanvas } from './util.js';
import { mesh } from './materials.js';
import { terrainCanvas } from './textures.js';

function tileShape() {
  var s = new THREE.Shape(), r = HEX_R - 0.05;
  for (var i = 0; i < 6; i++) { var a = Math.PI / 2 + i * Math.PI / 3, x = r * Math.cos(a), y = r * Math.sin(a); if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  s.closePath();
  return s;
}

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

// ------------------------------------------------------------------ espacio libre en la casilla
// Cada objeto se trata como un círculo de radio `rad` que debe caber en la casilla sin pisar:
//  - la ficha del número (centro),
//  - los caminos (van sobre las aristas; mitad de su ancho = 0.0425, más 0.02 de aire),
//  - las casas y estancias (van en los vértices; la estancia ocupa ~0.26, más 0.02 de aire).
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

export function createTerrain(kit) {
  var M = kit.M, tex = kit.tex;
  var tileGeo = new THREE.ExtrudeGeometry(tileShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
  tileGeo.rotateX(-Math.PI / 2); tileGeo.translate(0, 0.05, 0);
  var tileSideMat = M(0x8a6f4d, 0.8, 0, { env: 0.3 });
  var tileMats = {}; // por terreno: [cara de arriba con su textura, costados]
  Object.keys(TERRAINS).forEach(function (k) {
    var t = tex(terrainCanvas(k)); t.repeat.set(0.52, 0.52); t.offset.set(0.5, 0.5);
    tileMats[k] = [M(0xffffff, 0.92, 0, { env: 0.25, map: t }), tileSideMat];
  });

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
    token: M(0xf3e6c4, 0.55)
  };
  MAT.cowBody.vertexColors = true; // las manchas van en el color de los vértices del cuerpo
  MAT.token.emissive = new THREE.Color(0xf3e6c4); MAT.token.emissiveIntensity = 0.35;

  // `trees`: lista donde se anotan los árboles, que el bucle mece con la brisa.
  function decorate(kind, rnd, trees) {
    var g = new THREE.Group(), i;
    if (kind === 'forest') {
      scatter(8, 0.15, 0.22, rnd).forEach(function (p) {
        // tronco + copa ancha de tres masas redondeadas (se lee como árbol, no como cono/montaña)
        var t = new THREE.Group(), s = 0.6 + rnd() * 0.22, m = mesh(G.trunk, MAT.trunk); m.position.y = 0.1; t.add(m);
        [[0, 0.27, 0, 0], [0.085, 0.23, 0.02, 1], [-0.06, 0.25, -0.06, 2]].forEach(function (c) {
          var b = mesh(G.crown[c[3]], MAT.leaf[Math.floor(rnd() * 3)]); b.position.set(c[0], c[1], c[2]); b.rotation.y = rnd() * 6; t.add(b);
        });
        t.scale.setScalar(s); t.rotation.y = rnd() * 6.28; t.position.set(p.x, 0, p.z); g.add(t);
        t.userData.swayPhase = rnd() * 6.2832; trees.push(t); // se mecen apenas en `frame()` (rotation.x/z, no tocan la orientación fija en Y)
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

  // Brillo de los bordes interiores del hexágono (se desvanece hacia el centro), para las casillas que salen en los dados.
  var GLOW_GEO = new THREE.PlaneGeometry(2, 2), glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    var c = makeCanvas(256, 256), ctx = c.getContext('2d'), k, w;
    function hexPath() { ctx.beginPath(); for (k = 0; k < 6; k++) { var a = Math.PI / 2 + k * Math.PI / 3; ctx[k ? 'lineTo' : 'moveTo'](128 + 118 * Math.cos(a), 128 - 118 * Math.sin(a)); } ctx.closePath(); }
    hexPath(); ctx.clip(); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,214,120,0.085)';
    for (w = 70; w >= 4; w -= 3) { ctx.lineWidth = w; hexPath(); ctx.stroke(); }
    glowTex = new THREE.CanvasTexture(c); glowTex.encoding = THREE.sRGBEncoding;
    return glowTex;
  }
  function makeGlow() {
    var g = new THREE.Mesh(GLOW_GEO, new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    g.rotation.x = -Math.PI / 2; g.position.y = TILE_TOP + 0.004; g.visible = false; g.renderOrder = 2;
    return g;
  }

  return { tileGeo: tileGeo, tileMats: tileMats, decorate: decorate, makeToken: makeToken, makeGlow: makeGlow };
}
