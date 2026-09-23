// Ilustraciones de las cartas, dibujadas a mano con canvas (arte propio, sin imágenes). Todo se dibuja en un lienzo de 128 × 200:
//   - drawBastos11: el naipe español de adorno de la mesa (caballero de bastos: jinete a caballo con una maza verde).
//   - drawDevCard: las cartas de desarrollo del juego (Gaucho, Acopio, Buena cosecha, Empedrado, Punto de victoria).
// Los dos llevan el estilo de las láminas de referencia: colores planos, contorno oscuro y figuras simples.
// `devCardURL` devuelve la carta como imagen (cacheada) para usarla en el panel «Mis cartas».

var OL = '#3a220b'; // contorno
var TAU = Math.PI * 2;

function path(x, pts) { x.beginPath(); pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.closePath(); }
function fillStroke(x, fill, stroke, lw) {
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 1.4; x.lineJoin = 'round'; x.stroke(); }
}
function poly(x, pts, fill, stroke, lw) { path(x, pts); fillStroke(x, fill, stroke === undefined ? OL : stroke, lw); }
function ell(x, cx, cy, rx, ry, rot, fill, stroke, lw) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU); fillStroke(x, fill, stroke === undefined ? OL : stroke, lw); }
function rrect(x, X, Y, W, H, r) {
  x.beginPath(); x.moveTo(X + r, Y); x.lineTo(X + W - r, Y); x.quadraticCurveTo(X + W, Y, X + W, Y + r); x.lineTo(X + W, Y + H - r);
  x.quadraticCurveTo(X + W, Y + H, X + W - r, Y + H); x.lineTo(X + r, Y + H); x.quadraticCurveTo(X, Y + H, X, Y + H - r); x.lineTo(X, Y + r); x.quadraticCurveTo(X, Y, X + r, Y);
  x.closePath();
}
function line(x, pts, color, lw) {
  x.beginPath(); pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); });
  x.strokeStyle = color; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke();
}

// ------------------------------------------------------------------ 11 de bastos (naipe español)
// El caballero de bastos, como en una baraja de verdad: jinete a caballo que sostiene un basto (una maza verde nudosa) con una mano,
// apoyado en el hombro; caballo claro al paso con una pata levantada, peto plateado con remaches, manta naranja con flecos dorados;
// gorro verde con pluma, coraza celeste con detalles azules, media verde y zapato rojo. El «11» va en las dos esquinas (la de abajo, al revés).
// Se dibuja en las proporciones de la lámina de referencia (210 × 320) y se escala al lienzo de 128 × 200.

/** Miembro cónico (pata, brazo): sigue los puntos `pts` con el grosor `ws` en cada uno. */
function limb(x, pts, ws, fill, stroke, lw) {
  var L = [], R = [];
  for (var i = 0; i < pts.length; i++) {
    var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, w = ws[i] / 2;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  path(x, L.concat(R.reverse())); fillStroke(x, fill, stroke, lw);
}

export function drawBastos11(x) {
  var H = '#ece9e0', HS = '#cfcabc', LN = '#3b3832', GOLD = '#e0a51e', SKIN = '#f3cda8';
  x.save(); x.scale(128 / 210, 200 / 320);
  // papel, borde fino y números
  x.fillStyle = '#fcfaf3'; x.fillRect(0, 0, 210, 320);
  x.strokeStyle = '#d9d2bd'; x.lineWidth = 2.5; x.strokeRect(5, 5, 200, 310);
  x.fillStyle = '#233f86'; x.font = 'bold 27px Georgia, serif'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  x.fillText('11', 15, 40);
  x.save(); x.translate(195, 282); x.rotate(Math.PI); x.fillText('11', 0, 0); x.restore();

  ell(x, 102, 292, 86, 7, 0, 'rgba(70,55,30,.16)', null); // sombra en el suelo

  // cola larga y suelta
  x.beginPath(); x.moveTo(42, 158); x.bezierCurveTo(14, 170, 6, 212, 20, 250); x.bezierCurveTo(22, 226, 30, 206, 50, 192); x.bezierCurveTo(44, 182, 42, 170, 42, 158); x.closePath();
  fillStroke(x, '#cbc6b8', LN, 1.6);
  [[[36, 176], [22, 206], [24, 236]], [[40, 182], [30, 208], [30, 230]]].forEach(function (c) { x.beginPath(); x.moveTo(c[0][0], c[0][1]); x.quadraticCurveTo(c[1][0], c[1][1], c[2][0], c[2][1]); x.strokeStyle = '#a8a394'; x.lineWidth = 1.3; x.stroke(); });

  // patas del lado lejano (más oscuras)
  limb(x, [[90, 200], [94, 238], [102, 268]], [20, 11, 8], HS, LN, 1.6);
  poly(x, [[96, 266], [108, 266], [110, 275], [94, 275]], '#7d6f5d', LN, 1.4);
  limb(x, [[120, 204], [122, 240], [120, 268]], [18, 10, 8], HS, LN, 1.6);
  poly(x, [[114, 266], [127, 266], [129, 275], [113, 275]], '#7d6f5d', LN, 1.4);

  // cuerpo
  x.beginPath(); x.moveTo(36, 172); x.bezierCurveTo(38, 144, 80, 132, 114, 136); x.bezierCurveTo(142, 138, 158, 152, 162, 174); x.bezierCurveTo(164, 198, 142, 220, 104, 222); x.bezierCurveTo(68, 224, 34, 206, 36, 172); x.closePath();
  fillStroke(x, H, LN, 1.8);
  x.beginPath(); x.moveTo(44, 196); x.bezierCurveTo(70, 220, 120, 226, 152, 200); x.bezierCurveTo(146, 224, 100, 232, 64, 222); x.closePath(); x.fillStyle = HS; x.fill(); // panza en sombra
  ell(x, 52, 168, 12, 22, 0.3, '#f8f6ef', null); // brillo en la grupa

  // pata trasera cercana
  limb(x, [[66, 196], [60, 236], [58, 268]], [32, 15, 9], H, LN, 1.7);
  poly(x, [[51, 266], [65, 266], [68, 275], [49, 275]], '#7d6f5d', LN, 1.4);
  // pata delantera apoyada
  limb(x, [[132, 200], [136, 238], [134, 268]], [24, 12, 9], H, LN, 1.7);
  poly(x, [[127, 266], [141, 266], [143, 275], [125, 275]], '#7d6f5d', LN, 1.4);
  // pata delantera levantada (rodilla al frente y caña doblada hacia atrás)
  limb(x, [[152, 194], [178, 206], [172, 228], [154, 240]], [22, 13, 10, 9], H, LN, 1.7);
  poly(x, [[142, 236], [156, 238], [157, 248], [141, 246]], '#7d6f5d', LN, 1.4);

  // cuello, cabeza, crin
  x.beginPath(); x.moveTo(130, 152); x.bezierCurveTo(138, 122, 150, 92, 166, 72); x.lineTo(188, 88); x.bezierCurveTo(178, 112, 172, 142, 160, 172); x.closePath();
  fillStroke(x, H, LN, 1.8);
  x.beginPath(); x.moveTo(164, 70); x.bezierCurveTo(178, 64, 196, 84, 199, 106); x.bezierCurveTo(200, 116, 192, 120, 185, 115); x.bezierCurveTo(176, 112, 168, 102, 160, 92); x.closePath();
  fillStroke(x, H, LN, 1.8);
  ell(x, 194, 112, 6, 5, 0.5, '#d9cfc0', LN, 1.3); ell(x, 196, 109, 1.3, 1.1, 0, LN, null); // hocico y nariz
  poly(x, [[163, 70], [167, 50], [174, 70]], HS, LN, 1.4); poly(x, [[166, 68], [168, 56], [171, 68]], '#e6b9a0', null); // oreja
  ell(x, 179, 84, 2.6, 2.6, 0, LN, null); ell(x, 178.4, 83.4, 0.8, 0.8, 0, '#fff', null); // ojo
  x.beginPath(); x.moveTo(126, 152); x.bezierCurveTo(134, 118, 146, 88, 160, 68); x.bezierCurveTo(150, 92, 146, 118, 146, 152); x.closePath(); fillStroke(x, '#b9b5a8', LN, 1.4); // crin
  [[140, 120, 146, 96], [136, 132, 142, 110], [150, 96, 154, 80]].forEach(function (m) { line(x, [[m[0], m[1]], [m[2], m[3]]], '#8f8b7e', 1.2); });

  // arnés: cabezada y riendas rojas, peto plateado con remaches
  line(x, [[176, 86], [188, 108]], '#b0281f', 2.4); line(x, [[170, 96], [186, 112]], '#b0281f', 2.4); line(x, [[162, 92], [180, 88]], '#b0281f', 2);
  line(x, [[190, 112], [160, 110], [128, 112]], '#b0281f', 2.4); // riendas hasta la mano del jinete
  x.beginPath(); x.moveTo(142, 154); x.bezierCurveTo(158, 150, 172, 160, 170, 178); x.bezierCurveTo(168, 196, 152, 200, 142, 194); x.closePath(); fillStroke(x, '#bfc2c6', LN, 1.6);
  [[150, 162], [160, 168], [154, 176], [163, 182], [151, 188]].forEach(function (r) { ell(x, r[0], r[1], 2.2, 2.2, 0, '#7d8085', LN, 0.8); });
  line(x, [[134, 156], [164, 152]], '#b0281f', 3);

  // manta naranja con doble borde y flecos dorados
  x.beginPath(); x.moveTo(56, 152); x.bezierCurveTo(80, 138, 118, 140, 142, 152); x.lineTo(148, 208); x.bezierCurveTo(120, 216, 84, 216, 54, 208); x.closePath();
  fillStroke(x, '#d6521b', '#6f200a', 1.8);
  x.beginPath(); x.moveTo(62, 160); x.bezierCurveTo(82, 148, 116, 148, 138, 160); x.lineTo(142, 200); x.bezierCurveTo(118, 208, 84, 208, 60, 200); x.closePath(); x.strokeStyle = GOLD; x.lineWidth = 2.4; x.stroke();
  x.beginPath(); x.moveTo(67, 168); x.bezierCurveTo(84, 158, 114, 158, 133, 168); x.lineTo(136, 194); x.bezierCurveTo(116, 200, 86, 200, 65, 194); x.closePath(); x.fillStyle = '#b53a10'; x.fill();
  poly(x, [[100, 172], [112, 182], [100, 192], [88, 182]], GOLD, '#6f200a', 1.2); poly(x, [[100, 178], [106, 182], [100, 186], [94, 182]], '#d6521b', null);
  x.strokeStyle = GOLD; x.lineWidth = 1.8; x.lineCap = 'round';
  for (var f = 0; f < 22; f++) { var fx = 55 + f * 4.4, fy = 208 - Math.sin(f / 21 * Math.PI) * 0; x.beginPath(); x.moveTo(fx, fy + (f < 11 ? -f * 0.15 : 0)); x.lineTo(fx - 0.8, fy + 11); x.stroke(); }
  x.beginPath(); x.moveTo(54, 208); x.bezierCurveTo(84, 216, 120, 216, 148, 208); x.strokeStyle = GOLD; x.lineWidth = 2.4; x.stroke();

  // jinete (un poco más chico que el caballo, como en la lámina)
  x.save(); x.translate(100, 142); x.scale(0.9, 0.9); x.translate(-100, -142);
  // media verde con el zapato rojo
  limb(x, [[100, 140], [110, 162], [104, 188]], [26, 16, 12], '#4d9d3b', LN, 1.6);
  line(x, [[100, 150], [104, 176]], '#3a7d2b', 1.4);
  poly(x, [[94, 186], [112, 184], [120, 196], [106, 202], [92, 198]], '#c4302b', LN, 1.5);
  // torso: coraza celeste, panel azul con rombos, cinturón dorado y faldón
  x.beginPath(); x.moveTo(74, 72); x.bezierCurveTo(90, 64, 112, 64, 128, 72); x.lineTo(126, 128); x.lineTo(132, 146); x.bezierCurveTo(112, 152, 92, 152, 72, 146); x.lineTo(78, 128); x.closePath();
  fillStroke(x, '#8bb9e2', LN, 1.7);
  x.beginPath(); x.moveTo(86, 76); x.lineTo(114, 76); x.lineTo(118, 118); x.lineTo(82, 118); x.closePath(); fillStroke(x, '#3a66ae', LN, 1.4);
  [[100, 90], [100, 106]].forEach(function (d) { poly(x, [[d[0], d[1] - 7], [d[0] + 7, d[1]], [d[0], d[1] + 7], [d[0] - 7, d[1]]], '#e8eef8', LN, 0.9); });
  poly(x, [[78, 122], [124, 122], [126, 132], [76, 132]], GOLD, LN, 1.3);
  for (var k = 0; k < 9; k++) line(x, [[80 + k * 5.4, 132], [78 + k * 5.6, 146]], '#7aa7d2', 1.2); // pliegues del faldón
  poly(x, [[88, 70], [100, 82], [112, 70], [106, 66], [94, 66]], '#f4f0e4', LN, 1.2); // cuello blanco
  // brazo derecho (a la derecha de la lámina) con la rienda
  x.beginPath(); x.moveTo(126, 70); x.bezierCurveTo(139, 74, 147, 92, 143, 103); x.bezierCurveTo(141, 109, 135, 113, 129, 112); x.lineTo(122, 104); x.bezierCurveTo(126, 98, 124, 90, 120, 82); x.closePath(); fillStroke(x, '#8bb9e2', LN, 1.6);
  line(x, [[132, 80], [137, 96]], '#6fa2d6', 1.3);
  ell(x, 128, 113, 7, 6, 0, SKIN, LN, 1.3);

  // brazo izquierdo: sube desde el hombro, el codo atrás y el antebrazo hacia la maza
  x.beginPath(); x.moveTo(74, 70); x.bezierCurveTo(63, 74, 57, 92, 59, 102); x.bezierCurveTo(61, 110, 68, 116, 77, 118); x.lineTo(89, 112); x.bezierCurveTo(85, 104, 85, 96, 89, 84); x.bezierCurveTo(91, 78, 91, 74, 86, 70); x.closePath(); fillStroke(x, '#8bb9e2', LN, 1.6);
  line(x, [[66, 82], [66, 100]], '#6fa2d6', 1.3); // pliegue de la manga
  // el basto: maza verde nudosa, casi vertical, apoyada en el hombro y sujeta por la mano
  x.save(); x.translate(56, 8); x.rotate(-0.219); x.scale(1.32, 1.06); // grueso y largo, como en la lámina
  x.beginPath(); x.moveTo(-4.5, 112); x.lineTo(4.5, 112); x.bezierCurveTo(8, 90, 15, 62, 16, 34); x.bezierCurveTo(17, 8, 9, -4, 0, -4); x.bezierCurveTo(-9, -4, -17, 8, -16, 34); x.bezierCurveTo(-15, 62, -8, 90, -4.5, 112); x.closePath();
  fillStroke(x, '#72b82f', '#245a14', 2);
  x.beginPath(); x.moveTo(-10, 100); x.bezierCurveTo(-13, 66, -12, 30, -10, 12); x.bezierCurveTo(-8, 2, -3, -1, 1, -1); x.bezierCurveTo(-6, 20, -6, 66, -4, 104); x.closePath(); x.fillStyle = '#a9de5a'; x.fill(); // luz
  x.beginPath(); x.moveTo(5, 100); x.bezierCurveTo(10, 70, 14, 46, 14, 30); x.bezierCurveTo(15, 50, 12, 80, 8, 108); x.closePath(); x.fillStyle = '#4a8f22'; x.fill(); // sombra
  [[8, 8, 4.2], [-4, 24, 3.6], [10, 40, 4.4], [-8, 54, 3.4], [6, 72, 3.6], [-2, 88, 2.8]].forEach(function (n) { ell(x, n[0], n[1], n[2], n[2] * 0.75, 0.3, '#3f8a1e', '#245a14', 1); ell(x, n[0] - 0.8, n[1] - 0.8, n[2] * 0.4, n[2] * 0.3, 0, '#9ad24c', null); });
  x.restore();
  // mano cerrada sobre el basto: cuatro dedos y el pulgar
  ell(x, 78, 110, 9, 8, 0.2, SKIN, LN, 1.4);
  [[72, 106], [76, 109], [80, 112], [84, 114]].forEach(function (d) { x.beginPath(); x.arc(d[0], d[1], 2.6, 0, TAU); fillStroke(x, SKIN, LN, 0.9); });
  ell(x, 71, 116, 3.4, 5, 0.5, SKIN, LN, 1);

  // cabeza: cabello rubio ondulado, cara joven, gorro verde con pluma
  ell(x, 100, 52, 13.5, 15, 0, SKIN, LN, 1.6);
  [[88, 49, 5.5], [87, 57, 5], [112, 49, 5.2], [113, 57, 4.8]].forEach(function (c) { x.beginPath(); x.arc(c[0], c[1], c[2], 0, TAU); fillStroke(x, '#dfb257', LN, 1.2); });
  ell(x, 94, 52, 1.8, 2, 0, LN, null); ell(x, 106, 52, 1.8, 2, 0, LN, null);
  line(x, [[90, 47], [98, 46]], '#8a5a24', 1.4); line(x, [[102, 46], [110, 47]], '#8a5a24', 1.4);
  line(x, [[100, 54], [99, 60]], '#c48a68', 1.1); x.beginPath(); x.moveTo(95, 65); x.quadraticCurveTo(100, 68, 106, 65); x.strokeStyle = '#b0523a'; x.lineWidth = 1.5; x.stroke();
  x.beginPath(); x.moveTo(83, 46); x.bezierCurveTo(84, 28, 100, 20, 116, 30); x.bezierCurveTo(120, 36, 118, 42, 116, 46); x.bezierCurveTo(106, 40, 94, 40, 83, 46); x.closePath(); fillStroke(x, '#5aa63d', LN, 1.6);
  x.beginPath(); x.moveTo(83, 46); x.bezierCurveTo(94, 40, 106, 40, 116, 46); x.lineTo(116, 50); x.bezierCurveTo(106, 44, 94, 44, 83, 50); x.closePath(); fillStroke(x, '#3f8a2e', LN, 1.2);
  x.beginPath(); x.moveTo(108, 28); x.bezierCurveTo(112, 10, 128, 4, 138, 12); x.bezierCurveTo(130, 12, 122, 18, 118, 34); x.closePath(); fillStroke(x, '#e0552a', LN, 1.3); // pluma
  [[114, 22, 126, 14], [116, 28, 128, 20]].forEach(function (b) { line(x, [[b[0], b[1]], [b[2], b[3]]], '#f08a3c', 1.2); });
  x.restore(); // fin del jinete
  x.restore();
}

// ------------------------------------------------------------------ cartas de desarrollo
var KIND_STYLE = {
  knight: { title: 'GAUCHO', accent: '#b23a2e' },
  monopoly: { title: 'ACOPIO', accent: '#9a6a2a' },
  yearOfPlenty: { title: 'BUENA COSECHA', accent: '#b98a1c' },
  roadBuilding: { title: 'EMPEDRADO', accent: '#3a6ea5' },
  victoryPoint: { title: 'PUNTO DE VICTORIA', accent: '#3e7d3a' },
  // reconocimientos (no son cartas del mazo): se dibujan en una placa cuadrada, ver drawAward
  longestRoad: { title: 'RUTA MÁS LARGA', accent: '#a8741c' },
  largestArmy: { title: 'MILICIA MÁS GRANDE', accent: '#a8741c' }
};

// Marco común: papel crema, ventana de ilustración (recortada) y cinta con el nombre.
function frame(x, kind, art) {
  var st = KIND_STYLE[kind];
  rrect(x, 2, 2, 124, 196, 10); fillStroke(x, '#f3e6c4', '#5b3d1a', 3);
  rrect(x, 7, 7, 114, 186, 7); x.strokeStyle = '#c9a23a'; x.lineWidth = 1.2; x.stroke();
  x.save(); rrect(x, 12, 12, 104, 142, 4); x.clip(); art(x); x.restore();
  rrect(x, 12, 12, 104, 142, 4); x.strokeStyle = OL; x.lineWidth = 2; x.stroke();
  rrect(x, 10, 160, 108, 30, 7); fillStroke(x, st.accent, OL, 2);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  var size = 15; x.font = 'bold ' + size + 'px Georgia, serif';
  while (x.measureText(st.title).width > 94 && size > 8) { size--; x.font = 'bold ' + size + 'px Georgia, serif'; }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillText(st.title, 65, 176.5);
  x.fillStyle = '#fbf2d8'; x.fillText(st.title, 64, 175.5);
}

// Gaucho: de frente, con vincha roja, chaqueta azul, faja, bombachas bordó y botas; sable en una mano, sombrero en la otra y el caballo atrás.
function gauchoArt(x) {
  var sky = x.createLinearGradient(0, 12, 0, 110); sky.addColorStop(0, '#efd9a8'); sky.addColorStop(1, '#f8eed2');
  x.fillStyle = sky; x.fillRect(12, 12, 104, 100);
  x.fillStyle = '#d5b37a'; x.fillRect(12, 106, 104, 48);
  x.fillStyle = '#c29a5c'; x.fillRect(12, 122, 104, 32);
  ell(x, 90, 20, 12, 12, 0, 'rgba(255,240,200,.7)', null);
  // caballo atrás, a la derecha
  poly(x, [[84, 122], [88, 88], [97, 68], [108, 60], [118, 66], [118, 122]], '#85705f', OL, 1.4);
  poly(x, [[98, 64], [110, 56], [120, 62], [120, 82], [108, 86]], '#85705f', OL, 1.4);
  poly(x, [[104, 57], [107, 47], [111, 56]], '#6f5b4b', OL, 1);
  ell(x, 111, 65, 1.5, 1.5, 0, OL, null);
  x.beginPath(); x.moveTo(90, 86); x.bezierCurveTo(92, 70, 98, 62, 104, 58); x.bezierCurveTo(100, 72, 97, 84, 96, 100); x.closePath(); fillStroke(x, '#3b2c22', OL, 1);
  line(x, [[106, 84], [116, 80]], '#e0b53c', 1.6); line(x, [[100, 72], [112, 70]], '#e0b53c', 1.4); line(x, [[97, 84], [93, 118]], '#e0b53c', 1.6);
  // botas
  poly(x, [[33, 128], [47, 128], [48, 150], [56, 152], [56, 155], [32, 155]], '#1e1c1c', OL, 1.2);
  poly(x, [[54, 128], [68, 128], [69, 150], [77, 152], [77, 155], [53, 155]], '#1e1c1c', OL, 1.2);
  line(x, [[35, 138], [39, 141], [36, 144], [41, 147]], '#f1ede2', 1.2); line(x, [[57, 138], [61, 141], [58, 144], [63, 147]], '#f1ede2', 1.2);
  // bombachas bordó anchas con cinta oscura abajo
  poly(x, [[30, 97], [72, 97], [78, 130], [55, 133], [51, 112], [47, 133], [24, 130]], '#7a3f4a', OL, 1.4);
  poly(x, [[25, 124], [47, 127], [47, 132], [24, 129]], '#3f1f27', null);
  poly(x, [[56, 127], [77, 124], [78, 129], [56, 132]], '#3f1f27', null);
  line(x, [[30, 100], [27, 124]], '#a35a66', 1.3); line(x, [[72, 100], [76, 124]], '#a35a66', 1.3);
  // sable en la mano izquierda (del que mira)
  path(x, [[23, 60], [30, 58], [26, 92], [18, 90]]); fillStroke(x, '#2f3f86', OL, 1.3);
  x.beginPath(); x.moveTo(20, 90); x.bezierCurveTo(6, 108, 8, 134, 16, 152); x.strokeStyle = '#1e1c1c'; x.lineWidth = 3; x.lineCap = 'round'; x.stroke();
  line(x, [[15, 88], [25, 92]], '#d9b04a', 3);
  ell(x, 21, 92, 4.4, 4, 0, '#e0b48f', OL, 1.2);
  // chaqueta azul con botones, faja y facón
  poly(x, [[28, 56], [74, 56], [78, 96], [24, 96]], '#2f3f86', OL, 1.5);
  poly(x, [[44, 56], [58, 56], [51, 62]], '#f1ede2', OL, 1);
  [66, 72, 78, 84].forEach(function (yy) { ell(x, 51, yy, 1.7, 1.7, 0, '#f1e6c0', OL, 0.7); });
  poly(x, [[25, 90], [77, 90], [77, 100], [25, 100]], '#5a3a22', OL, 1.3);
  poly(x, [[38, 92], [46, 89], [48, 93], [40, 97]], '#d9b04a', OL, 1);
  // brazo derecho con el sombrero
  path(x, [[72, 58], [80, 62], [83, 92], [75, 93]]); fillStroke(x, '#2f3f86', OL, 1.3);
  ell(x, 80, 96, 4.4, 4, 0, '#e0b48f', OL, 1.2);
  ell(x, 92, 104, 10, 6.4, 0.5, '#8a5a3b', OL, 1.3); ell(x, 92, 103, 5.5, 3.2, 0.5, '#5a3a22', null);
  // cabeza: barba blanca, bigote, vincha roja con nudo
  ell(x, 51, 43, 11, 12, 0, '#e0b48f', OL, 1.4);
  poly(x, [[41, 46], [61, 46], [59, 58], [51, 62], [43, 58]], '#ece8de', OL, 1.2);
  x.beginPath(); x.moveTo(44, 48); x.quadraticCurveTo(51, 52, 58, 48); x.strokeStyle = '#d5d0c4'; x.lineWidth = 2.4; x.stroke();
  ell(x, 47, 42, 1.3, 1.3, 0, OL, null); ell(x, 56, 42, 1.3, 1.3, 0, OL, null);
  poly(x, [[39, 36], [63, 36], [63, 32], [39, 32]], '#c0332b', OL, 1.2);
  poly(x, [[62, 32], [70, 30], [67, 37], [63, 36]], '#c0332b', OL, 1);
  path(x, [[40, 32], [63, 32], [60, 26], [43, 26]]); fillStroke(x, '#c0332b', OL, 1);
}

// Acopio: sacos de arpillera atados (sin maíz: la carta sirve para cualquier recurso).
function acopioArt(x) {
  var wall = x.createLinearGradient(0, 12, 0, 154); wall.addColorStop(0, '#e9d3a3'); wall.addColorStop(1, '#c9a56a');
  x.fillStyle = wall; x.fillRect(12, 12, 104, 142);
  x.fillStyle = '#9c7a48'; x.fillRect(12, 128, 104, 26);
  x.fillStyle = 'rgba(70,45,15,.25)'; for (var i = 0; i < 6; i++) x.fillRect(12, 32 + i * 18, 104, 1.5); // tablas del fondo
  function sack(cx, cy, w, h, tone) {
    x.beginPath(); x.moveTo(cx - w * 0.5, cy + h * 0.5); x.bezierCurveTo(cx - w * 0.65, cy, cx - w * 0.4, cy - h * 0.3, cx - w * 0.16, cy - h * 0.38);
    x.lineTo(cx + w * 0.16, cy - h * 0.38); x.bezierCurveTo(cx + w * 0.4, cy - h * 0.3, cx + w * 0.65, cy, cx + w * 0.5, cy + h * 0.5); x.closePath(); fillStroke(x, tone, OL, 1.6);
    poly(x, [[cx - w * 0.2, cy - h * 0.38], [cx + w * 0.2, cy - h * 0.38], [cx + w * 0.3, cy - h * 0.62], [cx + w * 0.08, cy - h * 0.5], [cx - w * 0.08, cy - h * 0.66], [cx - w * 0.28, cy - h * 0.56]], tone, OL, 1.4);
    line(x, [[cx - w * 0.22, cy - h * 0.36], [cx + w * 0.22, cy - h * 0.36]], '#7a2f1f', 2.2); // atadura
    x.strokeStyle = 'rgba(70,45,15,.35)'; x.lineWidth = 1; for (var k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(cx + k * w * 0.16, cy - h * 0.2); x.lineTo(cx + k * w * 0.2, cy + h * 0.45); x.stroke(); }
  }
  sack(38, 104, 40, 52, '#cdae78');
  sack(88, 108, 44, 56, '#d8bc86');
  sack(62, 88, 50, 62, '#e0c690');
}

// Buena cosecha: sol grande sobre un campo dorado, con espigas y maíz al frente.
function cosechaArt(x) {
  var sky = x.createLinearGradient(0, 12, 0, 100); sky.addColorStop(0, '#f8dc8a'); sky.addColorStop(1, '#fbeec3');
  x.fillStyle = sky; x.fillRect(12, 12, 104, 100);
  var cx = 64, cy = 44;
  for (var r = 0; r < 14; r++) { var a = r * TAU / 14; poly(x, [[cx + Math.cos(a - 0.09) * 20, cy + Math.sin(a - 0.09) * 20], [cx + Math.cos(a) * 34, cy + Math.sin(a) * 34], [cx + Math.cos(a + 0.09) * 20, cy + Math.sin(a + 0.09) * 20]], '#f2a23a', null); }
  ell(x, cx, cy, 19, 19, 0, '#f6c343', OL, 1.6);
  x.fillStyle = '#e3b54a'; x.fillRect(12, 84, 104, 28);
  x.fillStyle = '#d29a30'; x.fillRect(12, 104, 104, 50);
  x.strokeStyle = 'rgba(120,70,10,.35)'; x.lineWidth = 1.4;
  for (var f = 0; f < 5; f++) { x.beginPath(); x.moveTo(12, 108 + f * 9); x.lineTo(116, 106 + f * 9); x.stroke(); }
  function wheat(px, py, h, lean) {
    line(x, [[px, py], [px + lean * 0.5, py - h * 0.5], [px + lean, py - h]], '#7a8a2a', 2);
    for (var i = 0; i < 6; i++) {
      var ty = py - h + i * 5.5, tx = px + lean * (1 - i * 0.05);
      ell(x, tx - 3.2, ty, 2.2, 4.4, -0.5, '#f0c93a', OL, 0.9); ell(x, tx + 3.2, ty + 1, 2.2, 4.4, 0.5, '#f0c93a', OL, 0.9);
    }
    ell(x, px + lean, py - h - 4, 2.2, 5, 0, '#f0c93a', OL, 0.9);
  }
  wheat(28, 152, 62, -4); wheat(50, 154, 76, 3); wheat(78, 154, 70, -2); wheat(100, 152, 60, 5);
  // maíz al frente
  ell(x, 64, 140, 8, 16, 0.15, '#f2c230', OL, 1.4);
  for (var rr = -10; rr <= 10; rr += 4) for (var q = -4; q <= 4; q += 4) ell(x, 64 + q, 140 + rr, 1.1, 1.1, 0, '#c99a12', null);
  poly(x, [[54, 128], [60, 152], [66, 134]], '#5aa03e', OL, 1.1); poly(x, [[74, 128], [68, 152], [62, 134]], '#4f9d3f', OL, 1.1);
}

// Empedrado: una obra, de día (distinta de la Ruta más larga, que es un atardecer). Adoquines ya puestos en primer plano, tierra
// sin pavimentar hacia el horizonte, un peón arrodillado poniendo un adoquín y otro de pie con el pisón; pila de piedras al costado.
function empedradoArt(x) {
  var HZ = 80;
  var sky = x.createLinearGradient(0, 12, 0, HZ); sky.addColorStop(0, '#7fb6e6'); sky.addColorStop(1, '#e6f0ee');
  x.fillStyle = sky; x.fillRect(12, 12, 104, HZ - 12);
  ell(x, 32, 30, 13, 5, 0, '#ffffff', null); ell(x, 44, 27, 10, 5, 0, '#ffffff', null); ell(x, 94, 40, 12, 4.5, 0, '#ffffff', null);
  poly(x, [[12, HZ + 1], [36, HZ - 5], [60, HZ - 1], [88, HZ - 6], [116, HZ - 2], [116, HZ + 2], [12, HZ + 2]], '#8fb85a', null);
  x.fillStyle = '#79ac48'; x.fillRect(12, HZ, 104, 154 - HZ);
  // el camino en perspectiva: bordes rectos hacia el punto de fuga
  function L(y) { return 62 - 44 * (y - HZ) / 74; }
  function R(y) { return 66 + 44 * (y - HZ) / 74; }
  var EDGE = 116; // hasta acá llegan los adoquines; más allá, tierra
  poly(x, [[L(HZ), HZ], [R(HZ), HZ], [R(154), 154], [L(154), 154]], '#c9a46a', OL, 1.3);
  poly(x, [[L(EDGE), EDGE], [R(EDGE), EDGE], [R(154), 154], [L(154), 154]], '#6f6a60', null); // junta oscura entre adoquines
  // hileras de adoquines: cada vez más altas hacia adelante, trabadas (media piedra corrida en hileras alternas)
  var rows = [EDGE, 121.5, 128, 135.5, 144, 154], TONES = ['#b3ada0', '#a39d90', '#bdb7aa', '#9d978a'];
  for (var r = 0; r < rows.length - 1; r++) {
    var y0 = rows[r] + 0.6, y1 = rows[r + 1] - 0.6, n = 7, shift = r % 2 ? 0.5 : 0;
    for (var c = -1; c < n; c++) {
      var a = Math.max(0, (c + shift) / n), b = Math.min(1, (c + 1 + shift) / n);
      if (b <= a) continue;
      var xa0 = L(y0) + (R(y0) - L(y0)) * a, xb0 = L(y0) + (R(y0) - L(y0)) * b, xa1 = L(y1) + (R(y1) - L(y1)) * a, xb1 = L(y1) + (R(y1) - L(y1)) * b, g = 0.5 + r * 0.12;
      poly(x, [[xa0 + g, y0], [xb0 - g, y0], [xb1 - g, y1], [xa1 + g, y1]], TONES[(r * 3 + c + 4) % 4], null);
    }
  }
  line(x, [[L(EDGE), EDGE], [L(154), 154]], OL, 1.3); line(x, [[R(EDGE), EDGE], [R(154), 154]], OL, 1.3);
  // adoquines sueltos en la tierra, por poner
  [[52, 112, 2.6], [70, 110, 2.2], [60, 106, 1.8]].forEach(function (d) { poly(x, [[d[0] - d[2], d[1]], [d[0] + d[2], d[1]], [d[0] + d[2] * 0.8, d[1] - d[2] * 0.8], [d[0] - d[2] * 0.8, d[1] - d[2] * 0.8]], '#b3ada0', OL, 0.6); });
  // pila de adoquines al costado izquierdo
  [[20, 132], [27, 132], [34, 132], [23.5, 127], [30.5, 127], [27, 122]].forEach(function (p) {
    rrect(x, p[0] - 3.4, p[1] - 4.4, 6.8, 4.4, 1); fillStroke(x, '#aaa498', OL, 0.8);
    line(x, [[p[0] - 2.6, p[1] - 3.6], [p[0] + 2.4, p[1] - 3.6]], 'rgba(255,255,255,.35)', 0.8);
  });
  var SKIN = '#e0b48f';
  // peón arrodillado en el borde de lo pavimentado, inclinado hacia adelante, con un adoquín en la mano
  poly(x, [[34, 117], [44, 117], [44, 120], [33, 120]], '#4a3a2c', OL, 1); // pierna apoyada (canilla en el suelo)
  poly(x, [[32, 120], [35, 120], [35, 117], [31, 117]], '#1e1c1c', OL, 0.8); // alpargata
  poly(x, [[42, 118], [47, 118], [47, 108], [42, 106]], '#4a3a2c', OL, 1); // muslo de la otra pierna, rodilla arriba
  poly(x, [[45, 118], [50, 118], [50, 121], [45, 121]], '#1e1c1c', OL, 0.8);
  poly(x, [[35, 116], [41, 104], [49, 97], [53, 102], [44, 112], [40, 117]], '#f1ede2', OL, 1.2); // camisa, espalda arqueada
  line(x, [[37, 116], [42, 107]], '#b23a2e', 2); // faja
  poly(x, [[50, 100], [53, 99], [55, 111], [52, 112]], '#f1ede2', OL, 1); // brazo que baja
  rrect(x, 51, 111, 6, 4, 1); fillStroke(x, '#b3ada0', OL, 0.8); // el adoquín
  ell(x, 53, 96, 4, 4.2, 0, SKIN, OL, 1.1);
  ell(x, 52, 92.8, 4.6, 2, -0.3, '#2f3f6a', OL, 0.9); ell(x, 51.2, 91.4, 1, 0.8, 0, '#2f3f6a', OL, 0.6); // boina
  ell(x, 55.6, 96.4, 0.9, 0.9, 0, OL, null);
  // peón de pie con el pisón (mango largo y taco de madera), del otro lado
  var MX = 82;
  line(x, [[MX - 2.5, 114], [MX - 3, 101]], '#4a3a2c', 4); line(x, [[MX + 2.5, 114], [MX + 3, 101]], '#4a3a2c', 4); // piernas
  poly(x, [[MX - 5.5, 114], [MX - 0.5, 114], [MX - 0.5, 116.5], [MX - 6, 116.5]], '#1e1c1c', OL, 0.8); poly(x, [[MX + 0.5, 114], [MX + 5.5, 114], [MX + 6, 116.5], [MX + 0.5, 116.5]], '#1e1c1c', OL, 0.8);
  poly(x, [[MX - 6, 102], [MX + 6, 102], [MX + 5, 84], [MX - 5, 84]], '#c9562f', OL, 1.2); // camisa
  line(x, [[MX - 6, 100], [MX + 6, 100]], '#5a3a22', 1.6); // cinto
  line(x, [[MX + 12, 76], [MX + 12, 110]], '#8a5a34', 2.2); // mango del pisón
  poly(x, [[MX + 8.5, 108], [MX + 15.5, 108], [MX + 15.5, 115], [MX + 8.5, 115]], '#6b4a2a', OL, 1); // taco
  poly(x, [[MX + 3, 86], [MX + 6, 85], [MX + 12, 88], [MX + 11, 91]], '#c9562f', OL, 1); // brazos al mango
  poly(x, [[MX + 3, 92], [MX + 6, 91], [MX + 12, 95], [MX + 11, 98]], '#c9562f', OL, 1);
  ell(x, MX + 12, 89.5, 1.6, 1.6, 0, SKIN, OL, 0.7); ell(x, MX + 12, 96.5, 1.6, 1.6, 0, SKIN, OL, 0.7);
  ell(x, MX, 80, 4, 4.2, 0, SKIN, OL, 1.1);
  ell(x, MX, 76.6, 8, 1.8, 0, '#d9b35a', OL, 0.9); poly(x, [[MX - 4, 76.6], [MX + 4, 76.6], [MX + 3.2, 72.4], [MX - 3.2, 72.4]], '#d9b35a', OL, 0.9); // sombrero de paja
  line(x, [[MX - 4, 75.6], [MX + 4, 75.6]], '#8a2f1e', 1);
  ell(x, MX + 1.8, 80.4, 0.9, 0.9, 0, OL, null);
}

// Punto de victoria: casco con techo de tejas, ombú, alambrado y un sol brillante sobre un cielo de atardecer.
function estanciaArt(x) {
  var sky = x.createLinearGradient(0, 12, 0, 110); sky.addColorStop(0, '#f2a15a'); sky.addColorStop(0.55, '#f7cf8a'); sky.addColorStop(1, '#fbe9bd');
  x.fillStyle = sky; x.fillRect(12, 12, 104, 100);
  // sol brillante: halo, rayos largos y disco con brillo, sobre la casa
  var glow = x.createRadialGradient(64, 42, 4, 64, 42, 80); glow.addColorStop(0, 'rgba(255,250,200,.95)'); glow.addColorStop(0.35, 'rgba(255,214,110,.6)'); glow.addColorStop(1, 'rgba(255,170,70,0)');
  x.fillStyle = glow; x.fillRect(12, 12, 104, 100);
  for (var k = 0; k < 16; k++) {
    var ang = k * Math.PI / 8, long = k % 2 ? 34 : 50, w = 0.09;
    x.beginPath(); x.moveTo(64 + Math.cos(ang - w) * 17, 42 + Math.sin(ang - w) * 17); x.lineTo(64 + Math.cos(ang) * long, 42 + Math.sin(ang) * long); x.lineTo(64 + Math.cos(ang + w) * 17, 42 + Math.sin(ang + w) * 17); x.closePath();
    x.fillStyle = k % 2 ? 'rgba(255,236,150,.75)' : 'rgba(255,248,205,.9)'; x.fill();
  }
  var disc = x.createRadialGradient(60, 38, 2, 64, 42, 17); disc.addColorStop(0, '#fffbe0'); disc.addColorStop(0.6, '#ffe27a'); disc.addColorStop(1, '#f7b731');
  ell(x, 64, 42, 16, 16, 0, disc, '#c9821a', 1.5);
  x.fillStyle = '#6f9d3e'; x.fillRect(12, 104, 104, 50); x.fillStyle = '#5b8a34'; poly(x, [[12, 108], [50, 100], [90, 108], [116, 102], [116, 112], [12, 114]], '#5f9137', null);
  // ombú: tronco ancho y copa amplia
  poly(x, [[22, 118], [30, 94], [34, 94], [42, 118]], '#6b4a2a', OL, 1.3);
  ell(x, 22, 84, 20, 15, 0, '#3f8a3a', OL, 1.5); ell(x, 40, 80, 17, 13, 0, '#4a9a42', OL, 1.4); ell(x, 30, 72, 15, 11, 0, '#57a84c', OL, 1.3);
  // casa
  poly(x, [[54, 104], [108, 104], [108, 80], [54, 80]], '#f4ecdc', OL, 1.6);
  poly(x, [[50, 82], [64, 62], [98, 62], [112, 82]], '#c4523a', OL, 1.6);
  for (var t = 0; t < 4; t++) line(x, [[56 + t * 12, 82 - t * 1], [62 + t * 9, 64]], '#8a2f1e', 1);
  poly(x, [[62, 104], [62, 90], [72, 90], [72, 104]], '#7a5a34', OL, 1.2);
  poly(x, [[80, 96], [80, 86], [90, 86], [90, 96]], '#8fc3ea', OL, 1.2); line(x, [[85, 86], [85, 96]], OL, 1); line(x, [[80, 91], [90, 91]], OL, 1);
  poly(x, [[94, 62], [98, 62], [98, 52], [94, 52]], '#8a5a3a', OL, 1);
  // alambrado
  for (var p = 0; p < 6; p++) poly(x, [[14 + p * 20, 124], [17 + p * 20, 124], [17 + p * 20, 108], [14 + p * 20, 108]], '#7a5a34', OL, 1);
  line(x, [[14, 112], [116, 112]], '#3a3a3a', 1); line(x, [[14, 118], [116, 118]], '#3a3a3a', 1);
  x.fillStyle = 'rgba(40,60,20,.25)'; x.fillRect(12, 138, 104, 16);
}

// Ruta más larga: al atardecer, un camino de tierra que se pierde en el horizonte justo donde se pone el sol. El gaucho va
// por el carril izquierdo hacia allá (de espaldas, apenas de tres cuartos) y por el otro carril viene una carreta de bueyes de
// frente: camino transitado. Cardones a los costados (fuera de la ventana de una carta: se ven en la placa, más ancha).
function rutaArt(x) {
  var HZ = 94; // línea del horizonte (y punto de fuga del camino)
  var sky = x.createLinearGradient(0, 12, 0, HZ); sky.addColorStop(0, '#d9604a'); sky.addColorStop(0.45, '#f29a5c'); sky.addColorStop(1, '#fcd98e');
  x.fillStyle = sky; x.fillRect(-60, 12, 248, HZ - 12);
  var glow = x.createRadialGradient(64, HZ, 4, 64, HZ, 60); glow.addColorStop(0, 'rgba(255,245,190,.95)'); glow.addColorStop(0.4, 'rgba(255,210,120,.45)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
  x.fillStyle = glow; x.fillRect(-60, 12, 248, HZ - 12);
  ell(x, 64, HZ, 15, 15, 0, '#ffe7a0', null); // el sol, a medio poner donde muere el camino
  ell(x, 30, 34, 14, 3, 0, 'rgba(255,214,170,.7)', null); ell(x, 96, 46, 12, 2.6, 0, 'rgba(255,214,170,.65)', null); // nubes finas
  poly(x, [[-60, HZ - 4], [-30, HZ - 1], [0, HZ - 5], [12, HZ - 2], [30, HZ - 6], [46, HZ - 3], [58, HZ], [70, HZ], [84, HZ - 5], [102, HZ - 2], [116, HZ - 4], [140, HZ - 1], [188, HZ - 5], [188, HZ + 2], [-60, HZ + 2]], '#8a5a5a', null); // lomas lejanas
  var ground = x.createLinearGradient(0, HZ, 0, 154); ground.addColorStop(0, '#9c7a3e'); ground.addColorStop(1, '#5e4a26');
  x.fillStyle = ground; x.fillRect(-60, HZ, 248, 154 - HZ);
  // el camino: bien abierto abajo (sale por los dos costados) y un punto en el horizonte, con la huella clara en el medio
  poly(x, [[62, HZ], [66, HZ], [142, 154], [-14, 154]], '#c49a5e', OL, 1.4);
  poly(x, [[63.4, HZ + 1], [64.6, HZ + 1], [80, 154], [48, 154]], '#dcb67a', null);
  // postes del alambrado junto al borde derecho, cada vez más chicos
  [[143, 152, 16], [111, 126, 9], [88, 108, 5], [75, 99, 3]].forEach(function (p) { poly(x, [[p[0], p[1]], [p[0] + p[2] * 0.3, p[1]], [p[0] + p[2] * 0.3, p[1] - p[2] * 1.6], [p[0], p[1] - p[2] * 1.6]], '#4a3320', null); });
  line(x, [[145, 138], [112, 118], [89, 103], [76, 96.5]], 'rgba(40,28,18,.7)', 0.8);
  // cardones (cactus del norte): uno grande a la izquierda y uno chico a la derecha, con brazos y costillas
  function cardon(cx, base, h, w) {
    var CG = '#3d5a2c', RIB = 'rgba(20,35,15,.45)';
    rrect(x, cx - w / 2, base - h, w, h, w / 2); fillStroke(x, CG, OL, 1.1);
    [[-1, 0.55, 0.35], [1, 0.4, 0.45]].forEach(function (a) { // brazos: salen de costado y suben
      var ay = base - h * a[1], ax = cx + a[0] * w * 0.5, tip = ax + a[0] * w * 1.1, top = ay - h * a[2];
      x.beginPath(); x.moveTo(ax, ay); x.lineTo(tip, ay); x.lineTo(tip, top); x.strokeStyle = OL; x.lineWidth = w * 0.72 + 2.2; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke();
      x.strokeStyle = CG; x.lineWidth = w * 0.72; x.stroke();
    });
    line(x, [[cx, base - h + w * 0.4], [cx, base - 1]], RIB, 0.8); line(x, [[cx - w * 0.25, base - h + w * 0.6], [cx - w * 0.25, base - 1]], RIB, 0.6);
    line(x, [[cx + w * 0.25, base - h + w * 0.6], [cx + w * 0.25, base - 1]], RIB, 0.6);
    ell(x, cx, base, w * 1.4, w * 0.25, 0, 'rgba(40,25,10,.3)', null);
  }
  cardon(128, 116, 18, 3.4);
  cardon(-12, 136, 46, 8);
  // la carreta, de frente por el carril derecho: el toldo y las ruedas de canto atrás, los dos bueyes con el yugo adelante.
  // Coordenadas propias: (0, 0) es el suelo en el medio; `k` la achica según la distancia.
  function carreta(cx, by, k) {
    x.save(); x.translate(cx, by); x.scale(k, k);
    ell(x, 0, 0.5, 12, 1.6, 0, 'rgba(40,25,10,.35)', null);
    ell(x, -9, -7, 1.5, 7, 0, '#5a3a22', OL, 0.6); ell(x, 9, -7, 1.5, 7, 0, '#5a3a22', OL, 0.6); // ruedas de canto
    poly(x, [[-8, -11], [8, -11], [8, -6], [-8, -6]], '#8a5a34', OL, 0.6); // caja
    x.beginPath(); x.moveTo(-8.5, -11); x.bezierCurveTo(-8, -24, 8, -24, 8.5, -11); x.closePath(); fillStroke(x, '#e8d5a8', OL, 0.7); // toldo de cuero
    ell(x, 0, -14, 4.2, 4, 0, '#4a3020', null); // la abertura del toldo
    [[-4.6, '#7a5234'], [4.6, '#8a5e3a']].forEach(function (b) { // bueyes de frente
      var o = b[0];
      line(x, [[o - 2, -2.5], [o - 2, 0]], OL, 1.1); line(x, [[o + 2, -2.5], [o + 2, 0]], OL, 1.1);
      ell(x, o, -5.5, 4, 4.6, 0, b[1], OL, 0.6);
      ell(x, o, -4.2, 2.5, 3, 0, b[1], OL, 0.5);
      ell(x, o, -2.4, 1.7, 1.1, 0, '#c9a07a', OL, 0.4); // hocico
      line(x, [[o - 1.6, -6.6], [o - 3.6, -8.8]], '#efe4c8', 0.8); line(x, [[o + 1.6, -6.6], [o + 3.6, -8.8]], '#efe4c8', 0.8); // cuernos
    });
    line(x, [[-9, -7], [9, -7]], '#5a3a22', 1.4); // yugo
    x.restore();
  }
  carreta(81, 119, 1.2);
  // el gaucho, de espaldas, yendo hacia el horizonte por el carril izquierdo; apenas de tres cuartos (la cabeza del caballo
  // asoma a la derecha)
  var HORSE = '#4a2f1f', DARK = '#2e1c12';
  ell(x, 50, 147, 16, 3, 0, 'rgba(40,25,10,.35)', null); // sombra
  line(x, [[44, 132], [43, 146]], DARK, 4.2); line(x, [[56, 132], [57, 146]], DARK, 4.2); // patas traseras
  ell(x, 43, 146.4, 2.6, 1.2, 0, '#1c120c', null); ell(x, 57, 146.4, 2.6, 1.2, 0, '#1c120c', null); // cascos
  poly(x, [[50, 110], [55, 111], [60, 99], [57, 96], [53, 99]], HORSE, OL, 1.1); // cuello
  poly(x, [[55.5, 97], [56.5, 92.5], [58, 96.5]], HORSE, OL, 0.9); poly(x, [[58.5, 97.5], [60.5, 93.5], [61, 98]], HORSE, OL, 0.9); // orejas
  ell(x, 50, 124, 12.5, 10.5, 0, HORSE, OL, 1.3); // ancas
  line(x, [[50, 115], [50, 131]], DARK, 1); // la división de las ancas
  x.beginPath(); x.moveTo(50, 117); x.bezierCurveTo(47, 125, 53, 132, 50, 141); x.strokeStyle = DARK; x.lineWidth = 4; x.lineCap = 'round'; x.stroke(); // cola
  // piernas del jinete a cada lado, con botas y estribos
  poly(x, [[39, 113], [43, 113], [40, 127], [36, 127]], '#2b2b33', OL, 0.9); poly(x, [[57, 113], [61, 113], [64, 127], [60, 127]], '#2b2b33', OL, 0.9);
  poly(x, [[35, 127], [41, 127], [41, 130], [34, 130]], '#1c1c1c', OL, 0.8); poly(x, [[59, 127], [65, 127], [66, 130], [59, 130]], '#1c1c1c', OL, 0.8);
  // poncho visto de atrás, con la guarda, cabeza y sombrero
  poly(x, [[38, 116], [62, 116], [56, 99], [44, 99]], '#9b2f22', OL, 1.2);
  line(x, [[39, 113], [61, 113]], '#e0b04a', 1.3); line(x, [[50, 100], [50, 115]], 'rgba(60,15,10,.35)', 0.8);
  ell(x, 50, 96, 3.6, 3.8, 0, '#2a1a12', OL, 0.9); // nuca con pelo
  ell(x, 50, 92.8, 8.5, 2, 0, DARK, OL, 0.8); // ala del sombrero
  poly(x, [[46, 92.8], [54, 92.8], [53, 87.6], [47, 87.6]], DARK, OL, 0.8);
  // borde de luz del sol de frente: sobre el sombrero, los hombros y el lomo
  line(x, [[47, 87.8], [53, 87.8]], 'rgba(255,200,120,.7)', 1); line(x, [[45, 99.5], [55, 99.5]], 'rgba(255,190,110,.6)', 1);
  x.beginPath(); x.arc(50, 124, 12, Math.PI * 1.15, Math.PI * 1.85); x.strokeStyle = 'rgba(255,190,110,.5)'; x.lineWidth = 1.1; x.stroke();
}

// Milicia más grande: tres tacuaras con banderolas rojas contra el atardecer y un facón cruzado al frente.
function miliciaArt(x) {
  var sky = x.createLinearGradient(0, 12, 0, 112); sky.addColorStop(0, '#e98a4a'); sky.addColorStop(0.6, '#f6c77f'); sky.addColorStop(1, '#fbe6b5');
  x.fillStyle = sky; x.fillRect(-60, 12, 248, 100);
  ell(x, 64, 104, 26, 26, 0, 'rgba(255,236,160,.8)', null);
  x.fillStyle = '#8a7a3e'; x.fillRect(-60, 104, 248, 50);
  x.fillStyle = '#6f6330'; x.fillRect(-60, 128, 248, 26);
  // tacuaras (lanzas de caña) en abanico, con moharra de hierro y banderola roja
  [[40, 150, 30, 18, -0.28], [64, 152, 64, 14, 0], [88, 150, 98, 18, 0.28]].forEach(function (l) {
    var bx = l[0], by = l[1], tx = l[2], ty = l[3];
    line(x, [[bx, by], [tx, ty]], '#6b4a2a', 3.2);
    var dx = (tx - bx) / Math.hypot(tx - bx, ty - by), dy = (ty - by) / Math.hypot(tx - bx, ty - by);
    poly(x, [[tx - dy * 3, ty + dx * 3], [tx + dx * 12, ty + dy * 12], [tx + dy * 3, ty - dx * 3]], '#c9ccd2', OL, 1.1);
    var fx = tx - dx * 4, fy = ty - dy * 4, side = l[4] < 0 ? -1 : 1;
    poly(x, [[fx, fy], [fx - dx * 20, fy - dy * 20], [fx + side * 24 - dx * 8, fy + 4 - dy * 8]], '#c0332b', OL, 1.1);
  });
  // facón cruzado al frente: hoja, guarda de plata y cabo con virola
  x.save(); x.translate(64, 122); x.rotate(-0.35);
  poly(x, [[-6, -4], [34, -4], [44, 0], [34, 4], [-6, 4]], '#dfe3e8', OL, 1.4);
  line(x, [[-4, -1], [36, -1]], '#ffffff', 1);
  poly(x, [[-9, -10], [-5, -10], [-5, 10], [-9, 10]], '#d9b04a', OL, 1.2);
  poly(x, [[-30, -5], [-9, -5], [-9, 5], [-30, 5]], '#3b2a1c', OL, 1.2);
  poly(x, [[-34, -6], [-29, -6], [-29, 6], [-34, 6]], '#d9b04a', OL, 1.1);
  x.restore();
}

var ARTS = { knight: gauchoArt, monopoly: acopioArt, yearOfPlenty: cosechaArt, roadBuilding: empedradoArt, victoryPoint: estanciaArt, longestRoad: rutaArt, largestArmy: miliciaArt };

/** Dibuja la carta de desarrollo `kind` completa (marco, ilustración y nombre) en un lienzo de 128 × 200. */
export function drawDevCard(x, kind) { frame(x, kind, ARTS[kind]); }

// Placa de un reconocimiento (Ruta más larga, Milicia más grande): cuadrada y con filete dorado doble, para que no se
// confunda con una carta del mazo. La lámina es la misma (pensada para la ventana de 104 × 142 de una carta), achicada
// para que entre entera a lo alto y centrada; sus fondos son más anchos, así llenan los costados de la ventana apaisada.
var AW = 168;
function drawAward(x, kind) {
  var st = KIND_STYLE[kind], k = 0.8;
  rrect(x, 2, 2, AW - 4, AW - 4, 12); fillStroke(x, '#f3e6c4', '#5b3d1a', 3);
  rrect(x, 3.5, 3.5, AW - 7, AW - 7, 11); x.strokeStyle = '#e8c65a'; x.lineWidth = 1.4; x.stroke();
  rrect(x, 7, 7, AW - 14, AW - 14, 9); x.strokeStyle = '#c9a23a'; x.lineWidth = 3; x.stroke();
  x.save(); rrect(x, 12, 12, AW - 24, 114, 5); x.clip();
  x.translate(12 + (AW - 24 - 104 * k) / 2 - 12 * k, 12 - 12 * k); x.scale(k, k); ARTS[kind](x);
  x.restore();
  rrect(x, 12, 12, AW - 24, 114, 5); x.strokeStyle = OL; x.lineWidth = 2; x.stroke();
  rrect(x, 10, 132, AW - 20, 28, 7); fillStroke(x, st.accent, OL, 2);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  var size = 16; x.font = 'bold ' + size + 'px Georgia, serif';
  while (x.measureText(st.title).width > AW - 56 && size > 8) { size--; x.font = 'bold ' + size + 'px Georgia, serif'; }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillText(st.title, AW / 2 + 1, 147);
  x.fillStyle = '#fbf2d8'; x.fillText(st.title, AW / 2, 146);
  [22, AW - 22].forEach(function (cx) { // estrellitas doradas a los lados del nombre
    x.beginPath();
    for (var i = 0; i < 10; i++) { var r = i % 2 ? 2.4 : 5.6, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(cx + Math.cos(a) * r, 146 + Math.sin(a) * r); }
    x.closePath(); x.fillStyle = '#f2c230'; x.fill(); x.strokeStyle = OL; x.lineWidth = 0.8; x.stroke();
  });
}
var awardUrls = {};
/** La placa de un reconocimiento como imagen (data URL, 336 × 336), cacheada por tipo. */
export function awardURL(kind) {
  if (awardUrls[kind]) return awardUrls[kind];
  var c = document.createElement('canvas'); c.width = c.height = AW * 2;
  var x = c.getContext('2d'); x.scale(2, 2); drawAward(x, kind);
  awardUrls[kind] = c.toDataURL('image/png');
  return awardUrls[kind];
}

var urls = {};
/** La carta como imagen (data URL, 256 × 400 para verse nítida), cacheada por tipo. */
export function devCardURL(kind) {
  if (urls[kind]) return urls[kind];
  var c = document.createElement('canvas'); c.width = 256; c.height = 400;
  var x = c.getContext('2d'); x.scale(2, 2); drawDevCard(x, kind);
  urls[kind] = c.toDataURL('image/png');
  return urls[kind];
}
