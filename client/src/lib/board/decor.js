// Objetos gauchos sobre la mesa (fuera del marco): mate con bombilla, pava de hierro, mazo de cartas españolas, facón y
// farol. Puro adorno: se ven al alejar la cámara. Las texturas usan semillas fijas, así se ven siempre igual.
import * as THREE from 'three';
import { drawBastos11 } from '../cardart';
import { col, makeCanvas, mulberry32 } from './util.js';
import { mesh } from './materials.js';

// Piel de calabaza: marrón con manchas suaves, vetas finas, puntitos y rayones de uso. Las manchas se repiten a los lados
// para que la costura de la vuelta no se note.
function gourdCanvas() {
  var W = 512, H = 256, c = makeCanvas(W, H), x = c.getContext('2d'), rnd = mulberry32(11), i, k;
  x.fillStyle = '#7c5127'; x.fillRect(0, 0, W, H);
  for (i = 0; i < 260; i++) {
    var bx = rnd() * W, by = rnd() * H, br = 8 + rnd() * 46, dark = rnd() < 0.55;
    for (k = -1; k <= 1; k++) {
      var g = x.createRadialGradient(bx + k * W, by, 0, bx + k * W, by, br);
      g.addColorStop(0, dark ? 'rgba(70,40,14,' + (0.1 + rnd() * 0.16) + ')' : 'rgba(190,130,70,' + (0.08 + rnd() * 0.12) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(bx + k * W - br, by - br, br * 2, br * 2);
    }
  }
  for (i = 0; i < 5200; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(50,28,10,' + (0.1 + rnd() * 0.2) + ')' : 'rgba(210,160,100,' + (0.08 + rnd() * 0.14) + ')'; x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.6, 1 + rnd() * 1.6); }
  x.lineCap = 'round';
  for (i = 0; i < 46; i++) { // vetas y rayones de tanto uso
    var sx = rnd() * W, sy = rnd() * H, len = 14 + rnd() * 60, an = rnd() * Math.PI;
    x.strokeStyle = rnd() < 0.6 ? 'rgba(45,25,8,' + (0.12 + rnd() * 0.16) + ')' : 'rgba(215,165,105,' + (0.1 + rnd() * 0.1) + ')'; x.lineWidth = 0.6 + rnd() * 1.1;
    x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + Math.cos(an) * len * 0.5 + rnd() * 6, sy + Math.sin(an) * len * 0.5 + rnd() * 6, sx + Math.cos(an) * len, sy + Math.sin(an) * len); x.stroke();
  }
  return c;
}

// Yerba vista de arriba: fondo oscuro (los huecos entre hojas) cubierto de hojuelas irregulares, de verde oliva a marrón,
// con algún palito claro. El mismo lienzo sirve de relieve para que cada hojuela tenga su borde.
function yerbaCanvas() {
  var S = 512, c = makeCanvas(S, S), x = c.getContext('2d'), rnd = mulberry32(23), i;
  x.fillStyle = '#48561a'; x.fillRect(0, 0, S, S);
  var pal = ['#6f8231', '#7f9038', '#5d6f24', '#8d9a43', '#4d5e1c', '#93a04a', '#6a5a2c', '#7a6a34', '#a3ac5c', '#566a20'];
  for (i = 0; i < 6200; i++) {
    var px = rnd() * S, py = rnd() * S, len = 3 + rnd() * rnd() * 16, wid = 1.6 + rnd() * 3.4, an = rnd() * Math.PI, stem = rnd() < 0.06;
    x.save(); x.translate(px, py); x.rotate(an);
    if (stem) { x.fillStyle = 'rgba(190,180,110,.9)'; x.fillRect(-len * 0.7, -0.7, len * 1.4, 1.4); }
    else {
      x.beginPath(); x.moveTo(-len / 2, 0); x.quadraticCurveTo(-len * 0.15, -wid, len / 2, -wid * 0.2 * (rnd() - 0.3)); x.quadraticCurveTo(len * 0.1, wid * 0.9, -len / 2, 0); x.closePath();
      x.fillStyle = pal[(rnd() * pal.length) | 0]; x.fill();
      x.strokeStyle = 'rgba(25,32,8,.55)'; x.lineWidth = 0.6; x.stroke();
      if (len > 8) { x.strokeStyle = 'rgba(200,205,120,.28)'; x.beginPath(); x.moveTo(-len * 0.4, 0); x.lineTo(len * 0.4, 0); x.stroke(); } // nervadura
    }
    x.restore();
  }
  for (i = 0; i < 900; i++) { x.fillStyle = 'rgba(' + (150 + rnd() * 50 | 0) + ',' + (155 + rnd() * 40 | 0) + ',' + (80 + rnd() * 40 | 0) + ',.55)'; x.fillRect(rnd() * S, rnd() * S, 1, 1); } // polvillo
  return c;
}

// Baraja española: frente con palo (oro, copa, espada, basto) y dorso a rombos.
function cardFaceCanvas(suit, num) {
  if (suit === 'bastos' && num === 11) { // el caballero: lámina propia, más grande para que se vea nítida (cardart.js)
    var big = makeCanvas(512, 800), bx = big.getContext('2d'); bx.scale(4, 4); drawBastos11(bx); // el dibujo propio queda de respaldo
    var img = new Image(); // la lámina definitiva (public/cartas/11-de-bastos.png) reemplaza al dibujo cuando termina de cargar
    img.onload = function () {
      bx.setTransform(1, 0, 0, 1, 0, 0); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
      bx.drawImage(img, 0, 0, big.width, big.height);
      if (big.__tex) big.__tex.needsUpdate = true;
    };
    img.src = '/cartas/11-de-bastos.png';
    return big;
  }
  var c = makeCanvas(128, 200), x = c.getContext('2d');
  x.fillStyle = '#f4ead2'; x.fillRect(0, 0, 128, 200);
  x.strokeStyle = '#7a5a2a'; x.lineWidth = 4; x.strokeRect(6, 6, 116, 188);
  x.fillStyle = '#3a2a16'; x.font = 'bold 26px Georgia, serif'; x.textAlign = 'left'; x.fillText(String(num), 14, 36);
  x.textAlign = 'right'; x.fillText(String(num), 114, 188);
  x.save(); x.translate(64, 100); x.lineWidth = 3;
  if (suit === 'oros') {
    x.fillStyle = '#e2b33c'; x.strokeStyle = '#8a5f10'; x.beginPath(); x.arc(0, 0, 38, 0, 6.2832); x.fill(); x.stroke();
    x.beginPath(); x.arc(0, 0, 24, 0, 6.2832); x.stroke(); x.fillStyle = '#f3d77a'; x.beginPath(); x.arc(0, 0, 12, 0, 6.2832); x.fill(); x.stroke();
  } else if (suit === 'copas') {
    x.fillStyle = '#c23b3b'; x.strokeStyle = '#5a1414';
    x.beginPath(); x.moveTo(-34, -40); x.lineTo(34, -40); x.quadraticCurveTo(30, 12, 0, 14); x.quadraticCurveTo(-30, 12, -34, -40); x.fill(); x.stroke();
    x.fillRect(-5, 14, 10, 32); x.strokeRect(-5, 14, 10, 32);
    x.beginPath(); x.ellipse(0, 50, 26, 8, 0, 0, 6.2832); x.fill(); x.stroke();
  } else if (suit === 'espadas') {
    x.fillStyle = '#cfd6dd'; x.strokeStyle = '#2b3138';
    x.beginPath(); x.moveTo(0, -70); x.lineTo(11, -46); x.lineTo(9, 30); x.lineTo(-9, 30); x.lineTo(-11, -46); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#c9a23a'; x.fillRect(-30, 30, 60, 10); x.strokeRect(-30, 30, 60, 10);
    x.fillStyle = '#5a3a1e'; x.fillRect(-6, 40, 12, 28); x.strokeRect(-6, 40, 12, 28);
  } else {
    x.rotate(-0.5); x.fillStyle = '#7a4a1e'; x.strokeStyle = '#3a220b';
    x.beginPath(); x.moveTo(-14, -66); x.lineTo(14, -66); x.lineTo(20, 40); x.quadraticCurveTo(0, 70, -20, 40); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#3f8f45'; x.beginPath(); x.arc(-22, -14, 10, 0, 6.2832); x.arc(22, 6, 10, 0, 6.2832); x.fill();
  }
  x.restore();
  return c;
}
function cardBackCanvas() {
  var c = makeCanvas(128, 200), x = c.getContext('2d');
  x.fillStyle = '#8f2a2a'; x.fillRect(0, 0, 128, 200);
  x.strokeStyle = '#e8d6a0'; x.lineWidth = 2;
  for (var i = -200; i < 260; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 200, 200); x.moveTo(i + 200, 0); x.lineTo(i, 200); x.stroke(); }
  x.lineWidth = 8; x.strokeStyle = '#f4ead2'; x.strokeRect(4, 4, 120, 192);
  return c;
}

// Hoja del facón vista de arriba (textura de la chapa plana: u = largo, v = ancho, con el filo abajo y el lomo arriba):
// acero liso y opaco, filo fino y más claro (afilado), lomo algo más oscuro, algunas manchas grises y unas pocas grietas finas. Sin óxido.
function faconCanvas() {
  var W = 1024, H = 160, c = makeCanvas(W, H), x = c.getContext('2d'), rnd = mulberry32(31), i, k;
  var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8f979f'); g.addColorStop(0.3, '#b7bec6'); g.addColorStop(0.8, '#c6ccd3'); g.addColorStop(1, '#dde2e7');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (i = 0; i < 1100; i++) { // rayitas de afilado y de uso, en el sentido de la hoja
    var y = rnd() * H, len = 30 + rnd() * 260, sx = rnd() * W;
    x.strokeStyle = rnd() < 0.5 ? 'rgba(235,240,245,' + (0.05 + rnd() * 0.1) + ')' : 'rgba(50,58,68,' + (0.05 + rnd() * 0.1) + ')'; x.lineWidth = 0.5 + rnd() * 0.8;
    x.beginPath(); x.moveTo(sx, y); x.lineTo(sx + len, y + (rnd() - 0.5) * 1.4); x.stroke();
  }
  // pátina: zonas más oscuras y apagadas, sobre todo hacia el lomo y la base
  for (i = 0; i < 40; i++) {
    var px = rnd() * W, py = rnd() * H * 0.8, pr = 20 + rnd() * 80, pg = x.createRadialGradient(px, py, 0, px, py, pr);
    pg.addColorStop(0, 'rgba(60,64,60,' + (0.1 + rnd() * 0.14) + ')'); pg.addColorStop(1, 'rgba(60,64,60,0)');
    x.fillStyle = pg; x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  // manchas: zonas grisáceas y opacas, suaves (de uso, no de óxido)
  for (i = 0; i < 26; i++) {
    var rx = rnd() * W, ry = rnd() * H * 0.85, rr = 10 + rnd() * 50, rg = x.createRadialGradient(rx, ry, 0, rx, ry, rr);
    rg.addColorStop(0, 'rgba(84,88,86,' + (0.12 + rnd() * 0.16) + ')'); rg.addColorStop(1, 'rgba(84,88,86,0)');
    x.fillStyle = rg; x.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
  }
  for (i = 0; i < 110; i++) { x.fillStyle = 'rgba(62,64,64,' + (0.25 + rnd() * 0.3) + ')'; x.beginPath(); x.arc(rnd() * W, rnd() * H * 0.9, 0.5 + rnd() * 1.1, 0, Math.PI * 2); x.fill(); } // puntitos de uso
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (i = 0; i < 10; i++) { // grietas finas: cortas y quebradas, con un reflejo claro al lado
    var cx0 = rnd() * W * 0.9, cy0 = H * (0.12 + rnd() * 0.65), pts = [[cx0, cy0]], n = 4 + (rnd() * 5 | 0);
    for (k = 1; k <= n; k++) pts.push([pts[k - 1][0] + 4 + rnd() * 10, pts[k - 1][1] + (rnd() - 0.5) * 8]);
    x.strokeStyle = 'rgba(40,44,48,.7)'; x.lineWidth = 0.9; x.beginPath(); pts.forEach(function (q, j) { if (j) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); }); x.stroke();
    x.strokeStyle = 'rgba(240,244,248,.45)'; x.lineWidth = 0.6; x.beginPath(); pts.forEach(function (q, j) { if (j) x.lineTo(q[0], q[1] + 1.2); else x.moveTo(q[0], q[1] + 1.2); }); x.stroke();
  }
  var edgeG = x.createLinearGradient(0, H * 0.86, 0, H); edgeG.addColorStop(0, 'rgba(255,255,255,0)'); edgeG.addColorStop(0.6, 'rgba(250,252,255,.7)'); edgeG.addColorStop(1, 'rgba(200,208,216,.9)');
  x.fillStyle = edgeG; x.fillRect(0, H * 0.86, W, H * 0.14); // filo: franja fina y brillante (es lo que está afilado y no se oxida)
  x.fillStyle = 'rgba(45,52,60,.6)'; x.fillRect(0, H - 1.5, W, 1.5);
  x.fillStyle = 'rgba(50,56,62,.45)'; x.fillRect(0, 0, W, H * 0.05); // lomo
  for (i = 0; i < 14; i++) { x.fillStyle = 'rgba(60,44,32,.75)'; x.fillRect(rnd() * W, H - 5 - rnd() * 3, 2 + rnd() * 5, 4); } // mellitas en el filo
  return c;
}

// Arma los adornos y los apoya sobre la mesa. Devuelve el farol, que el bucle enciende de noche (ver animateLantern).
export function buildDecor(scene, kit) {
  var M = kit.M, tex = kit.tex, lantern = null;
  function place(g, x, z, rotY) { g.position.set(x, 0, z); g.rotation.y = rotY || 0; scene.add(g); return g; }

  function makeMate() {
    var g = new THREE.Group(), rnd = mulberry32(5), i;
    var gTex = tex(gourdCanvas(), 1, 1);
    var gourd = M(0xffffff, 0.62, 0, { env: 0.4, map: gTex });
    var silver = M(0xd3d8de, 0.32, 0.9, { env: 1.0 }), gold = M(0xc9a15a, 0.3, 0.9, { env: 0.9 });
    // Calabaza: pie chico, panza redonda y cuello más cerrado. La boca queda dentro de la virola de metal (sube hasta y = 0.52).
    var prof = [[0, 0], [0.13, 0], [0.15, 0.02], [0.163, 0.06], [0.2, 0.09], [0.265, 0.15], [0.318, 0.23], [0.34, 0.31], [0.335, 0.39], [0.305, 0.46], [0.268, 0.52],
      [0.25, 0.52], [0.238, 0.46], [0.246, 0.36], [0.215, 0.26], [0.13, 0.19], [0, 0.18]]; // afuera hacia arriba, y después la pared interior
    g.add(mesh(new THREE.LatheGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40), gourd));
    // Virola: banda ancha de acero cepillado en la boca, con el borde enrollado hacia adentro, y un aro fino en la base.
    var band = [[0.268, 0.49], [0.276, 0.5], [0.277, 0.62], [0.271, 0.636], [0.258, 0.64], [0.247, 0.632], [0.246, 0.5]];
    var bandM = mesh(new THREE.LatheGeometry(band.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40), silver); bandM.material.side = THREE.DoubleSide; g.add(bandM);
    var seam = mesh(new THREE.TorusGeometry(0.276, 0.005, 6, 40), M(0x3a3d42, 0.5, 0.6, { env: 0.4 })); seam.rotation.x = Math.PI / 2; seam.position.y = 0.492; g.add(seam);
    var base = mesh(new THREE.TorusGeometry(0.157, 0.02, 8, 32), silver); base.rotation.x = Math.PI / 2; base.position.y = 0.035; g.add(base);

    // Yerba: MISMA montañita de antes. Alta del lado contrario a la bombilla (+x), baja junto a ella (-x), con el pozo casi al medio
    // (más oscuro y húmedo) pegado al caño. Ahora con textura de hojuelas, relieve y hojuelas sueltas en 3D para el borde.
    var YR = 0.246, YB = 0.52, YT = 0.595, PX = -0.1, PIT = 0.095;           // radio, altura junto a la bombilla, altura del lado alto y profundidad del pozo
    function ySurf(vx, vz) {
      var pd = Math.exp(-Math.pow(Math.hypot(vx - PX, vz) / 0.105, 2));
      var bump = 0.006 * Math.sin(vx * 61 + vz * 23) * Math.cos(vz * 47 - vx * 17) + 0.004 * Math.sin(vx * 113 - vz * 89);
      return YB + (YT - YB) * (vx + YR) / (2 * YR) - PIT * pd + bump * (1 - 0.6 * pd);
    }
    var yR = [], ri;
    for (ri = 0; ri <= 16; ri++) yR.push(new THREE.Vector2(YR * (1 - ri / 16), 0)); // de afuera hacia el centro: normales hacia arriba
    var yGeo = new THREE.LatheGeometry(yR, 48), yp = yGeo.attributes.position, yc = [], yuv = [];
    var dry = col(0xe6e6c4), wet = col(0x7c8a54);
    for (var vi = 0; vi < yp.count; vi++) {
      var vx = yp.getX(vi), vz = yp.getZ(vi);
      var pd = Math.exp(-Math.pow(Math.hypot(vx - PX, vz) / 0.105, 2));
      yp.setY(vi, ySurf(vx, vz));
      var cc = dry.clone().lerp(wet, Math.min(1, pd * 1.4)); yc.push(cc.r, cc.g, cc.b); // el pozo se ve más húmedo y oscuro
      yuv.push(vx / (2 * YR) * 0.92 + 0.5, vz / (2 * YR) * 0.92 + 0.5);
    }
    yGeo.setAttribute('color', new THREE.Float32BufferAttribute(yc, 3)); yGeo.setAttribute('uv', new THREE.Float32BufferAttribute(yuv, 2)); yGeo.computeVertexNormals();
    var yTex = tex(yerbaCanvas(), 1, 1);
    var yMat = M(0xffffff, 0.95, 0, { env: 0.1, map: yTex }); yMat.vertexColors = true;
    yMat.bumpMap = yTex; yMat.bumpScale = 1.4;
    g.add(mesh(yGeo, yMat, false, true));
    // hojuelas sueltas: chiquitas y planas, en cualquier ángulo; hacen que el borde y la silueta se vean de grano y no de pasta
    var N = 1300, flakeGeo = new THREE.BoxGeometry(0.014, 0.0014, 0.006);
    var flakeMat = M(0xffffff, 0.9, 0, { env: 0.1 });
    var flakes = new THREE.InstancedMesh(flakeGeo, flakeMat, N), dm = new THREE.Object3D(), fp = [0x4f5f26, 0x5b6c2e, 0x445320, 0x66743a, 0x3a481a, 0x54462a, 0x74803f], fc = new THREE.Color();
    for (i = 0; i < N; i++) {
      var a = rnd() * Math.PI * 2, r = (YR - 0.006) * Math.sqrt(rnd()), fx = Math.cos(a) * r, fz = Math.sin(a) * r, s = 0.6 + rnd() * 0.9;
      dm.position.set(fx, ySurf(fx, fz) + 0.002, fz);
      dm.rotation.set((rnd() - 0.5) * 0.9, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.9);
      dm.scale.set(s, 1, s * (0.7 + rnd() * 0.6)); dm.updateMatrix();
      flakes.setMatrixAt(i, dm.matrix); flakes.setColorAt(i, fc.copy(col(fp[(rnd() * fp.length) | 0])));
    }
    flakes.castShadow = false; flakes.receiveShadow = false; g.add(flakes);

    // Bombilla: caño de acero curvado arriba con la boquilla aplastada, tres aros dorados y el filtro abajo, dentro del pozo.
    var b = new THREE.Group();
    var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.006, 0.2, 0), new THREE.Vector3(-0.018, 0.4, 0), new THREE.Vector3(-0.04, 0.55, 0), new THREE.Vector3(-0.085, 0.635, 0), new THREE.Vector3(-0.125, 0.66, 0)]);
    b.add(mesh(new THREE.TubeGeometry(curve, 36, 0.0125, 10, false), silver));
    var filter = mesh(new THREE.SphereGeometry(0.043, 14, 10), silver); filter.scale.set(1, 0.62, 1); b.add(filter);
    var neck = mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.05, 12), silver); neck.position.y = 0.04; b.add(neck);
    [0.5, 0.526, 0.552].forEach(function (t) { // aros: perpendiculares al caño en ese punto
      var u = t / 0.66, pt = curve.getPointAt(Math.min(0.99, u)), tg = curve.getTangentAt(Math.min(0.99, u));
      var ring = mesh(new THREE.TorusGeometry(0.0155, 0.0045, 6, 14), gold); ring.position.copy(pt);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg); b.add(ring);
    });
    var tip = curve.getPointAt(1), tipDir = curve.getTangentAt(1);
    var mouth = mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.035, 10), silver); mouth.scale.set(1.5, 1, 0.55); // boquilla aplastada
    mouth.position.copy(tip).addScaledVector(tipDir, 0.012); mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir); b.add(mouth);
    b.position.set(PX - 0.005, 0.315, 0); b.rotation.z = 0.14; // apoyada contra la pared de la calabaza, inclinada hacia -x; el pico curva hacia afuera
    g.add(b);
    return g;
  }

  function makePava() {
    var g = new THREE.Group();
    var iron = M(0x2a2a2f, 0.55, 0.55, { env: 0.6 });
    var prof = [[0, 0], [0.48, 0], [0.62, 0.08], [0.67, 0.28], [0.6, 0.52], [0.42, 0.7], [0.3, 0.76], [0.3, 0.8], [0, 0.8]];
    g.add(mesh(new THREE.LatheGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 28), iron));
    var lid = mesh(new THREE.SphereGeometry(0.29, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron); lid.scale.y = 0.55; lid.position.y = 0.78; g.add(lid);
    var knob = mesh(new THREE.SphereGeometry(0.06, 10, 8), iron); knob.position.y = 0.96; g.add(knob);
    var spoutGeo = new THREE.CylinderGeometry(0.06, 0.12, 0.8, 12); spoutGeo.translate(0, 0.4, 0);
    var spout = mesh(spoutGeo, iron); spout.position.set(0.5, 0.2, 0); spout.rotation.z = -1.0; g.add(spout);
    var arch = mesh(new THREE.TorusGeometry(0.56, 0.035, 8, 26, Math.PI), iron); arch.rotation.y = Math.PI / 2; arch.position.y = 0.6; g.add(arch);
    var grip = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), M(0x5a3a1e, 0.8, 0, { env: 0.2 })); grip.rotation.x = Math.PI / 2; grip.position.y = 1.16; g.add(grip);
    return g;
  }

  function makeCards() {
    var g = new THREE.Group(), CW = 0.9, CL = 1.4, cream = M(0xf4ead2, 0.7, 0, { env: 0.2 });
    var deck = mesh(new THREE.BoxGeometry(CW, 0.3, CL), [cream, cream, M(0xffffff, 0.7, 0, { env: 0.2, map: tex(cardBackCanvas()) }), cream, cream, cream]);
    deck.position.set(0.55, 0.15, 0.3); deck.rotation.y = 0.2; g.add(deck);
    var hand = [['espadas', 1], ['oros', 7], ['copas', 12], ['bastos', 11]];
    hand.forEach(function (h, i) {
      var f = new THREE.Group();
      var card = mesh(new THREE.BoxGeometry(CW, 0.02, CL), [cream, cream, M(0xffffff, 0.7, 0, { env: 0.2, map: tex(cardFaceCanvas(h[0], h[1])) }), cream, cream, cream]);
      card.position.set(0, 0.011 + i * 0.024, -0.6);
      f.add(card); f.position.set(-0.75, 0, 0.9); f.rotation.y = (i - 1.5) * 0.3;
      g.add(f);
    });
    return g;
  }

  function makeFacon() {
    var g = new THREE.Group();
    var bTex = tex(faconCanvas(), 1 / 1.78, 1 / 0.17); bTex.offset.set(0, 0.5); // v = 0 en el filo (y = -0.085) y 1 en el lomo
    var steel = M(0xffffff, 0.5, 0.7, { env: 0.8, map: bTex }), brass = M(0xc9a23a, 0.35, 0.8, { env: 0.8 }), wood = M(0x4a2c17, 0.7, 0, { env: 0.25 });
    var s = new THREE.Shape();
    s.moveTo(0, -0.085); s.lineTo(1.1, -0.085); s.quadraticCurveTo(1.5, -0.07, 1.78, 0.03); s.quadraticCurveTo(1.55, 0.075, 1.35, 0.085); s.lineTo(0, 0.085); s.closePath(); // filo recto que sube a la punta y lomo con contrafilo
    var bladeGeo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }); // chapa plana y fina: el filo, las manchas y las grietas van pintados en la textura
    bladeGeo.rotateX(-Math.PI / 2);
    var blade = mesh(bladeGeo, steel); blade.position.y = 0.057; g.add(blade); // centrada en el eje del mango
    // guarda: barra con las puntas redondeadas, y un tope de bronce sobre la hoja
    var guard = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), brass); guard.position.set(-0.02, 0.06, 0); g.add(guard);
    [-0.2, 0.2].forEach(function (pz) { var e = mesh(new THREE.SphereGeometry(0.038, 12, 10), brass); e.position.set(-0.02, 0.06, pz); g.add(e); });
    var stop = mesh(new THREE.BoxGeometry(0.05, 0.07, 0.15), brass); stop.position.set(0.03, 0.065, 0); g.add(stop);
    // empuñadura: madera oscura y cuatro anillos de bronce
    var hGeo = new THREE.CylinderGeometry(0.052, 0.07, 0.78, 14); hGeo.rotateZ(Math.PI / 2);
    var handle = mesh(hGeo, wood); handle.position.set(-0.43, 0.07, 0); g.add(handle);
    [-0.16, -0.32, -0.54, -0.72].forEach(function (px) {
      var ring = mesh(new THREE.TorusGeometry(px < -0.5 ? 0.068 : 0.059, 0.011, 6, 16), brass); ring.rotation.y = Math.PI / 2; ring.position.set(px, 0.07, 0); g.add(ring);
    });
    var pommel = mesh(new THREE.SphereGeometry(0.085, 14, 10), brass); pommel.position.set(-0.84, 0.07, 0); g.add(pommel);
    return g;
  }

  // Farol de campo: base y tapa de hierro, depósito de kerosén, tubo de vidrio con llama y jaula de alambre.
  // De noche (y algo al atardecer) la llama se enciende: crece, titila y alumbra la mesa (ver `frame`).
  function makeLantern() {
    var g = new THREE.Group();
    var iron = M(0x2a2a2f, 0.55, 0.55, { env: 0.6 }), brass = M(0xb08a3a, 0.4, 0.8, { env: 0.8 });
    var glass = M(0xcfe8f0, 0.1, 0, { env: 0.9 }); glass.transparent = true; glass.opacity = 0.3; glass.depthWrite = false; glass.side = THREE.DoubleSide;
    var foot = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.08, 20), iron); foot.position.y = 0.04; g.add(foot);
    var tank = mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.17, 20), brass); tank.position.y = 0.165; g.add(tank);
    var knob = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), brass); knob.rotation.z = Math.PI / 2; knob.position.set(0.3, 0.17, 0); g.add(knob);
    var gl = [[0.16, 0.25], [0.24, 0.4], [0.27, 0.6], [0.2, 0.85], [0.17, 1.0]];
    g.add(mesh(new THREE.LatheGeometry(gl.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 20), glass, false, false));
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + Math.PI / 4, bar = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.78, 6), iron);
      bar.position.set(Math.cos(a) * 0.255, 0.63, Math.sin(a) * 0.255); g.add(bar);
    }
    var cap = mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.1, 20), iron); cap.position.y = 1.03; g.add(cap);
    var dome = mesh(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron); dome.scale.y = 0.55; dome.position.y = 1.08; g.add(dome);
    var vent = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), iron); vent.position.y = 1.23; g.add(vent);
    var ring = mesh(new THREE.TorusGeometry(0.13, 0.017, 6, 20), iron); ring.position.y = 1.32; g.add(ring);
    var wick = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 6), M(0x1b1712, 0.9, 0, { env: 0.1 })); wick.position.y = 0.32; g.add(wick);
    var flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffc85a, fog: false }));
    flame.position.y = 0.42; g.add(flame);
    var halo = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    halo.position.y = 0.43; g.add(halo);
    var glow = new THREE.PointLight(col(0xffa848), 0, 7, 2); glow.position.y = 0.5; g.add(glow);
    g.userData = { flame: flame, halo: halo, glow: glow };
    lantern = g;
    return g;
  }

  // Apoyados en los lados inclinados del marco (apotema exterior ≈ 6.06), donde el hexágono deja hueco arriba y abajo:
  // pava y mate (arriba izq.) a ~0.65 del borde; farol (arriba der.), cartas (abajo der.) y facón (abajo izq.).
  // Cada uno va girado para quedar paralelo al lado que toca.
  place(makeLantern(), 6.12, -3.54, 0);
  place(makePava(), -6.39, -3.69, 1.047);
  place(makeMate(), -6.74, -2.45, 0.5236); // al lado de la pava, a su izquierda, sobre el mismo lado del marco
  place(makeCards(), 6.72, 3.88, -2.094);
  place(makeFacon(), -6.4, 3.25, -1.047);
  return lantern;
}

// Farol: la llama se enciende con la noche (`lamps`: 0 de día, 0.35 al atardecer, 1.25 de noche) y titila.
export function animateLantern(lantern, lamps, time) {
  if (!lantern) return;
  var LL = Math.max(0, Math.min(1, lamps / 1.25)), lu = lantern.userData;
  var fk = 1 + 0.10 * Math.sin(time * 13) + 0.07 * Math.sin(time * 23 + 1.3) + 0.05 * Math.sin(time * 37 + 0.4);
  var fs = 0.3 + 0.7 * LL;
  lu.flame.visible = lu.halo.visible = LL > 0.02;
  lu.flame.scale.set(fs * (1 + 0.06 * Math.sin(time * 17)), 1.7 * fs * fk, fs);
  lu.flame.position.x = Math.sin(time * 9 + 0.5) * 0.008 * LL;
  lu.halo.scale.set(fs * fk, 1.5 * fs * fk, fs * fk); lu.halo.material.opacity = 0.24 * LL * fk;
  lu.glow.intensity = 1.1 * LL * fk;
}
