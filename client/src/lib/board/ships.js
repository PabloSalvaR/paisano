// Barcos de los puertos: tres modelos propios, inspirados en las referencias del desarrollador (prototipos/barco1-3) sin
// copiarlas: goleta (dos palos con cangrejas y foque), bergantín (velas cuadradas en el palo de proa y fardos) y chalupa (un palo
// con vela latina y barriles). Pocos polígonos y sin texturas: el casco es una malla propia con los colores en los vértices.
// Medidas locales como el barco anterior (unos 0.8 de largo, proa hacia +x); el puerto lo achica y lo mece.
import * as THREE from 'three';
import { col } from './util.js';
import { mesh } from './materials.js';

// Casco curvo: secciones a lo largo de x (popa −L/2, proa +L/2) con la borda que sube hacia proa, la proa en punta con la roda
// inclinada hacia adelante y una popa recta. De arriba abajo: franja de color bajo la borda (`band`), tablones de dos tonos (cada
// uno con sus propios vértices, así el borde entre tablones queda nítido) y obra viva más oscura.
function hullGeo(L, B, D, band) {
  var N = 16, pos = [], colors = [], idx = [];
  var wood = col(0x8b5a34), wood2 = col(0x7a4d2c), low = col(0x4e3220), stripe = col(band);
  // franjas en fracción de la altura de la borda: [arriba, abajo, color]; todas las secciones tienen las mismas, para unirlas
  var LEVELS = [[1, 0.8, stripe], [0.8, 0.62, wood], [0.62, 0.44, wood2], [0.44, 0.26, wood], [0.26, 0.08, wood2], [0.08, -0.3, low]];
  function halfBeam(u) { return B / 2 * (u < 0.62 ? 0.82 + 0.18 * Math.sin(u / 0.62 * Math.PI / 2) : Math.cos((u - 0.62) / 0.38 * Math.PI / 2)); }
  function top(u) { return D * (1 + 0.45 * Math.pow(u, 3) + 0.2 * Math.pow(1 - u, 3)); }
  function keel(u) { return -0.05 - 0.02 * Math.sin(u * Math.PI); }
  // la roda y el espejo se inclinan: arriba la proa avanza y la popa retrocede un poco
  function rake(u, h) { return (0.11 * Math.pow(u, 4) - 0.03 * Math.pow(1 - u, 4)) * h; }
  function ring(u) {
    var hb = halfBeam(u), t = top(u), k = keel(u), side = [];
    LEVELS.forEach(function (l) { side.push([t * l[0], l[2]], [t * l[1], l[2]]); });
    var pts = [], rel = function (y) { return Math.min(1, Math.max(0, (y - k) / (t - k))); }, width = function (y) { var h = rel(y); return 0.35 + 0.65 * Math.pow(Math.sin(h * Math.PI / 2), 0.55); };
    side.forEach(function (p) { pts.push([p[0], -hb * width(p[0]), p[1]]); });
    pts.push([k, 0, low]);
    side.slice().reverse().forEach(function (p) { pts.push([p[0], hb * width(p[0]), p[1]]); });
    return pts.map(function (p) { return [p[0], p[1], p[2], rel(p[0])]; });
  }
  var R = LEVELS.length * 4 + 1;
  for (var i = 0; i <= N; i++) {
    var u = i / N, x = -L / 2 + u * L;
    ring(u).forEach(function (p) { pos.push(x + rake(u, p[3]), p[0], p[1]); colors.push(p[2].r, p[2].g, p[2].b); });
  }
  for (i = 0; i < N; i++) for (var k = 0; k < R - 1; k++) {
    var a = i * R + k, b = a + R;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // espejo de popa: abanico desde el centro de la primera sección
  var c = pos.length / 3; pos.push(-L / 2 + rake(0, 0.5), D * 0.5, 0); colors.push(wood2.r, wood2.g, wood2.b);
  for (k = 0; k < R - 1; k++) idx.push(c, k + 1, k);
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // cubierta: una franja un poco más abajo de la borda, que sigue la curva del casco
  var dp = [], di = [];
  for (i = 0; i <= N; i++) {
    u = i / N; x = -L / 2 + u * L;
    var t = top(u), hb = halfBeam(u) * 0.93, y = t - 0.03, xr = x + rake(u, (y - keel(u)) / (t - keel(u)));
    dp.push(xr, y, -hb, xr, y, hb);
    if (i < N) di.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  var deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); deck.setIndex(di); deck.computeVertexNormals();
  return { hull: g, deck: deck, top: top, halfBeam: halfBeam };
}

// Vela: parche de cuatro esquinas (a, b, c, d en orden) apenas hinchado hacia `bulge` en el medio. Con c = d sale un triángulo.
function sailGeo(a, b, c, d, bulge) {
  var S = 6, pos = [], idx = [], P = function (p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]; };
  for (var i = 0; i <= S; i++) for (var j = 0; j <= S; j++) {
    var s = i / S, t = j / S, p = P(P(a, b, t), P(d, c, t), s), w = Math.sin(Math.PI * s) * Math.sin(Math.PI * t);
    pos.push(p[0] + bulge[0] * w, p[1] + bulge[1] * w, p[2] + bulge[2] * w);
  }
  for (i = 0; i < S; i++) for (j = 0; j < S; j++) { var k = i * (S + 1) + j; idx.push(k, k + S + 1, k + 1, k + 1, k + S + 1, k + S + 2); }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function createShips(M) {
  var MAT = {
    hull: M(0xffffff, 0.72, 0, { flat: true, env: 0.3 }),
    deck: M(0xa8804f, 0.85, 0, { env: 0.2 }),
    spar: M(0x6b4424, 0.7, 0, { env: 0.3 }),
    sail: M(0xf1e7cf, 0.9, 0, { env: 0.2 }),
    cargo: M(0xd9ccaa, 0.95, 0, { env: 0.1 }),
    barrel: M(0x7a5230, 0.8, 0, { env: 0.2 }),
    iron: M(0x2e2f33, 0.5, 0.5, { env: 0.5 })
  };
  MAT.hull.vertexColors = true; MAT.hull.side = THREE.DoubleSide; // el casco es abierto arriba (lo tapa la cubierta)
  MAT.sail.side = THREE.DoubleSide; MAT.deck.side = THREE.DoubleSide;
  var ROPE = new THREE.LineBasicMaterial({ color: 0x3b2e22, transparent: true, opacity: 0.75 });
  var L = 0.8, B = 0.26, D = 0.15;
  var HULLS = { dark: hullGeo(L, B, D, 0x2f2a26), red: hullGeo(L, B, D, 0xb3322a) };

  function spar(g, r, len, x, y, z, rz, rx) {
    var m = mesh(new THREE.CylinderGeometry(r, r, len, 6), MAT.spar); m.position.set(x, y, z);
    if (rz) m.rotation.z = rz; if (rx) m.rotation.x = rx;
    g.add(m); return m;
  }
  function ropes(g, pts) {
    var geo = new THREE.BufferGeometry().setFromPoints(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
    var l = new THREE.LineSegments(geo, ROPE); g.add(l);
  }
  function sail(g, a, b, c, d, bulge) { g.add(mesh(sailGeo(a, b, c, d, bulge), MAT.sail, true, true)); }
  function base(band) {
    var g = new THREE.Group(), h = HULLS[band];
    g.add(mesh(h.hull, MAT.hull)); g.add(mesh(h.deck, MAT.deck, false, true));
    return { g: g, h: h };
  }

  // Goleta: dos palos con cangrejas (vela de cuatro lados detrás de cada palo), foque en el bauprés, cabina a popa.
  function schooner() {
    var s = base('dark'), g = s.g, h = s.h, deckY = function (x) { return h.top((x + L / 2) / L) - 0.03; };
    [[-0.12, 0.62], [0.12, 0.72]].forEach(function (m) {
      var x = m[0], y0 = deckY(x), topY = y0 + m[1];
      spar(g, 0.011, m[1], x, y0 + m[1] / 2, 0);
      sail(g, [x - 0.01, y0 + 0.08, 0], [x - 0.01, topY - 0.1, 0], [x - 0.26, topY - 0.02, 0], [x - 0.26, y0 + 0.07, 0], [0, 0, 0.035]);
      spar(g, 0.006, 0.27, x - 0.135, y0 + 0.07, 0, Math.PI / 2); // botavara
      spar(g, 0.005, 0.27, x - 0.135, topY - 0.06, 0, Math.PI / 2 - 0.3); // pico de la cangreja
    });
    var bx = L / 2 - 0.02, by = deckY(bx) + 0.02;
    spar(g, 0.007, 0.26, bx + 0.1, by + 0.035, 0, -Math.PI / 2 + 0.28); // bauprés
    sail(g, [0.15, deckY(0.15) + 0.62, 0], [0.15, deckY(0.15) + 0.62, 0], [bx + 0.2, by + 0.07, 0], [0.17, deckY(0.17) + 0.08, 0], [0, 0, 0.03]); // foque
    var cab = mesh(new THREE.BoxGeometry(0.1, 0.045, 0.1), MAT.deck); cab.position.set(-0.3, deckY(-0.3) + 0.02, 0); g.add(cab);
    ropes(g, [[0.12, deckY(0.12) + 0.72, 0], [bx + 0.22, by + 0.07, 0], [-0.12, deckY(-0.12) + 0.62, 0], [-0.39, deckY(-0.39) + 0.03, 0],
      [0.12, deckY(0.12) + 0.6, 0], [0.12, deckY(0.12), 0.12], [0.12, deckY(0.12) + 0.6, 0], [0.12, deckY(0.12), -0.12]]);
    return g;
  }

  // Bergantín: palo de proa con dos velas cuadradas en sus vergas, palo mayor con cangreja, foque y fardos en cubierta.
  function brig() {
    var s = base('dark'), g = s.g, h = s.h, deckY = function (x) { return h.top((x + L / 2) / L) - 0.03; };
    var fx = 0.13, fy = deckY(fx), mx = -0.13, my = deckY(mx);
    spar(g, 0.012, 0.74, fx, fy + 0.37, 0);
    [[0.3, 0.24, 0.13], [0.52, 0.19, 0.1]].forEach(function (v) { // vergas y velas cuadradas (de abajo hacia arriba)
      var y = fy + v[0], w = v[1];
      spar(g, 0.006, w * 2 + 0.04, fx + 0.012, y + v[2], 0, 0, Math.PI / 2);
      sail(g, [fx + 0.015, y + v[2], -w], [fx + 0.015, y + v[2], w], [fx + 0.015, y + 0.005, w * 1.05], [fx + 0.015, y + 0.005, -w * 1.05], [0.04, 0, 0]);
    });
    spar(g, 0.011, 0.66, mx, my + 0.33, 0);
    sail(g, [mx - 0.01, my + 0.08, 0], [mx - 0.01, my + 0.56, 0], [mx - 0.25, my + 0.62, 0], [mx - 0.25, my + 0.07, 0], [0, 0, 0.035]);
    spar(g, 0.006, 0.26, mx - 0.13, my + 0.07, 0, Math.PI / 2);
    var bx = L / 2 - 0.02, by = deckY(bx) + 0.02;
    spar(g, 0.007, 0.26, bx + 0.1, by + 0.035, 0, -Math.PI / 2 + 0.28);
    sail(g, [fx + 0.02, fy + 0.66, 0], [fx + 0.02, fy + 0.66, 0], [bx + 0.2, by + 0.07, 0], [fx + 0.05, fy + 0.1, 0], [0, 0, 0.03]);
    [[-0.02, 0.05], [-0.28, -0.04]].forEach(function (p) { var b = mesh(new THREE.BoxGeometry(0.07, 0.04, 0.07), MAT.cargo); b.position.set(p[0], deckY(p[0]) + 0.02, p[1]); b.rotation.y = 0.3; g.add(b); });
    ropes(g, [[fx, fy + 0.74, 0], [bx + 0.22, by + 0.07, 0], [mx, my + 0.66, 0], [-0.39, deckY(-0.39) + 0.03, 0],
      [fx, fy + 0.6, 0], [fx - 0.03, fy, 0.12], [fx, fy + 0.6, 0], [fx - 0.03, fy, -0.12], [mx, my + 0.55, 0], [mx, my, 0.12], [mx, my + 0.55, 0], [mx, my, -0.12]]);
    return g;
  }

  // Chalupa: casco abierto con franja roja, un palo, vela latina en una entena larga en diagonal y barriles a bordo.
  function sloop() {
    var s = base('red'), g = s.g, h = s.h, deckY = function (x) { return h.top((x + L / 2) / L) - 0.03; };
    var mx = 0.06, my = deckY(mx);
    spar(g, 0.012, 0.5, mx, my + 0.25, 0);
    var y0 = [0.32, my + 0.1], y1 = [-0.3, my + 0.72]; // entena: baja en proa, alta en popa
    var len = Math.hypot(y1[0] - y0[0], y1[1] - y0[1]);
    spar(g, 0.007, len, (y0[0] + y1[0]) / 2, (y0[1] + y1[1]) / 2 + 0.01, 0.012, Math.atan2(y1[1] - y0[1], y1[0] - y0[0]) - Math.PI / 2);
    sail(g, [y0[0] - 0.01, y0[1] + 0.005, 0.012], [y1[0] + 0.02, y1[1] - 0.01, 0.012], [-0.22, my + 0.08, 0.012], [0.28, my + 0.08, 0.012], [0, 0, 0.04]);
    for (var i = 0; i < 3; i++) {
      var b = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8), MAT.barrel); b.position.set(-0.08 - i * 0.05, deckY(-0.1) + 0.02, i % 2 ? 0.04 : -0.03); g.add(b);
      var ring = mesh(new THREE.TorusGeometry(0.022, 0.003, 4, 10), MAT.iron, false, false); ring.rotation.x = Math.PI / 2; ring.position.copy(b.position); g.add(ring);
    }
    var crate = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), MAT.deck); crate.position.set(0.15, deckY(0.15) + 0.02, 0.03); g.add(crate);
    ropes(g, [[mx, my + 0.5, 0], [L / 2 - 0.02, deckY(L / 2 - 0.02) + 0.03, 0], [mx, my + 0.45, 0], [mx - 0.04, my, 0.12], [mx, my + 0.45, 0], [mx - 0.04, my, -0.12]]);
    return g;
  }

  var MAKERS = [schooner, brig, sloop];
  // `i`: el número de puerto; los tres modelos se reparten entre los 9 puertos
  return { makeShip: function (i) { return MAKERS[i % MAKERS.length](); } };
}
