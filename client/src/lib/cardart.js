// Ilustraciones de las cartas, dibujadas a mano con canvas (arte propio, sin imágenes). Todo se dibuja en un lienzo de 128 × 200:
//   - drawBastos11: el naipe español de adorno de la mesa (caballero de bastos: jinete a caballo con una maza verde).
//   - drawDevCard: las cartas de desarrollo del juego (Gaucho, Acopio, Buena cosecha, Vialidad, Punto de victoria).
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
  roadBuilding: { title: 'VIALIDAD', accent: '#3a6ea5' },
  victoryPoint: { title: 'PUNTO DE VICTORIA', accent: '#3e7d3a' }
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

// Acopio: sacos de arpillera atados, con maíz y granos sueltos.
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
  // mazorcas de maíz
  [[24, 134, -0.5], [100, 136, 0.6], [64, 140, 1.5]].forEach(function (c) {
    x.save(); x.translate(c[0], c[1]); x.rotate(c[2]);
    ell(x, 0, 0, 5, 12, 0, '#f2c230', OL, 1.2);
    for (var r = -7; r <= 7; r += 4) for (var q = -2; q <= 2; q += 4) ell(x, q, r, 1, 1, 0, '#c99a12', null);
    poly(x, [[-4, 6], [0, 18], [5, 6]], '#5aa03e', OL, 1);
    x.restore();
  });
  for (var g = 0; g < 26; g++) ell(x, 26 + ((g * 37) % 76), 144 + ((g * 11) % 9), 1.3, 1, 0, '#f0c93a', null); // granos
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

// Vialidad: un camino de tierra que se pierde en el horizonte, con postes y alambrado, y un cartel de madera.
function vialidadArt(x) {
  var sky = x.createLinearGradient(0, 12, 0, 90); sky.addColorStop(0, '#8fc3ea'); sky.addColorStop(1, '#e8f1f0');
  x.fillStyle = sky; x.fillRect(12, 12, 104, 88);
  ell(x, 30, 32, 14, 6, 0, '#ffffff', null); ell(x, 44, 28, 12, 6, 0, '#ffffff', null); ell(x, 92, 42, 13, 5, 0, '#ffffff', null);
  x.fillStyle = '#7fb04a'; x.fillRect(12, 86, 104, 68);
  x.fillStyle = '#5f9a3a'; poly(x, [[12, 90], [40, 78], [70, 88], [100, 76], [116, 84], [116, 92], [12, 96]], '#6aa640', null);
  poly(x, [[58, 88], [70, 88], [112, 154], [16, 154]], '#d3ab6a', OL, 1.6); // camino
  poly(x, [[62, 96], [66, 96], [70, 108], [58, 108]], '#e6c68a', null);
  [[64, 104, 7], [64, 122, 11], [64, 144, 16]].forEach(function (d) { poly(x, [[d[0] - d[2] * 0.15, d[1]], [d[0] + d[2] * 0.15, d[1]], [d[0] + d[2] * 0.22, d[1] + d[2] * 0.7], [d[0] - d[2] * 0.22, d[1] + d[2] * 0.7]], '#f3e6c4', null); });
  // postes con alambre a los costados
  [[56, 90, 5], [46, 100, 8], [30, 118, 12], [14, 146, 18]].forEach(function (p) { poly(x, [[p[0], p[1]], [p[0] + p[2] * 0.4, p[1]], [p[0] + p[2] * 0.4, p[1] - p[2] * 1.5], [p[0], p[1] - p[2] * 1.5]], '#7a5a34', OL, 1.1); });
  [[72, 90, 5], [82, 100, 8], [98, 118, 12], [112, 146, 18]].forEach(function (p) { poly(x, [[p[0], p[1]], [p[0] + p[2] * 0.4, p[1]], [p[0] + p[2] * 0.4, p[1] - p[2] * 1.5], [p[0], p[1] - p[2] * 1.5]], '#7a5a34', OL, 1.1); });
  line(x, [[56, 84], [46, 88], [30, 100], [14, 122]], '#3a3a3a', 1); line(x, [[58, 87], [48, 93], [32, 107], [16, 130]], '#3a3a3a', 1);
  line(x, [[74, 84], [84, 88], [100, 100], [114, 122]], '#3a3a3a', 1); line(x, [[72, 87], [82, 93], [98, 107], [112, 130]], '#3a3a3a', 1);
  // cartel
  poly(x, [[62, 60], [66, 60], [66, 90], [62, 90]], '#7a5a34', OL, 1.2);
  poly(x, [[46, 44], [84, 44], [90, 51], [84, 58], [46, 58]], '#d9b26a', OL, 1.5);
  x.fillStyle = OL; x.font = 'bold 9px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('RUTA', 65, 51.5);
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

var ARTS = { knight: gauchoArt, monopoly: acopioArt, yearOfPlenty: cosechaArt, roadBuilding: vialidadArt, victoryPoint: estanciaArt };

/** Dibuja la carta de desarrollo `kind` completa (marco, ilustración y nombre) en un lienzo de 128 × 200. */
export function drawDevCard(x, kind) { frame(x, kind, ARTS[kind]); }

var urls = {};
/** La carta como imagen (data URL, 256 × 400 para verse nítida), cacheada por tipo. */
export function devCardURL(kind) {
  if (urls[kind]) return urls[kind];
  var c = document.createElement('canvas'); c.width = 256; c.height = 400;
  var x = c.getContext('2d'); x.scale(2, 2); drawDevCard(x, kind);
  urls[kind] = c.toDataURL('image/png');
  return urls[kind];
}
