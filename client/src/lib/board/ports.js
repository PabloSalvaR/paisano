// Puertos: dos muelles desde la costa, el cartel chato entre ellos (3:1 o el dibujo del recurso) y un barco que se mece.
import * as THREE from 'three';
import { WATER_Y } from './constants.js';
import { makeCanvas } from './util.js';
import { mesh } from './materials.js';
import { segment } from './pieces.js';
import { createShips } from './ships.js';

// Barcos con más detalle (goleta, bergantín y chalupa, en ships.js). En prueba: con false vuelven los barcos simples de antes.
const DETAILED_SHIPS = true;

// Dibujos de los recursos para los carteles de puerto (legibles de lejos, sin texto).
const PORT_ICONS = {
  forest: function (ctx, x, y) {
    ctx.fillStyle = '#7a4e2a'; ctx.fillRect(x - 9, y + 8, 18, 40); ctx.strokeRect(x - 9, y + 8, 18, 40);
    ctx.fillStyle = '#3f8f45';
    [[-26, 6, 26], [26, 6, 26], [0, -16, 32]].forEach(function (c) { ctx.beginPath(); ctx.arc(x + c[0], y + c[1], c[2], 0, 6.2832); ctx.fill(); ctx.stroke(); });
  },
  hills: function (ctx, x, y) {
    ctx.fillStyle = '#c96a3b';
    [[-56, 6], [0, 6], [-28, -30]].forEach(function (b) { ctx.fillRect(x + b[0], y + b[1], 56, 34); ctx.strokeRect(x + b[0], y + b[1], 56, 34); });
  },
  pasture: function (ctx, x, y) {
    // misma cara que el banner de recursos (caja de 48 px, ×2.4, centrada en x,y)
    function el(cx, cy, rx, ry, rot, fill, line) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot * Math.PI / 180, 0, 6.2832); ctx.fill(); if (line) ctx.stroke(); }
    ctx.save(); ctx.translate(x - 57.6, y - 57.6); ctx.scale(2.4, 2.4); ctx.lineWidth = 2.3;
    ctx.strokeStyle = '#3b2a18';
    el(9, 14, 5, 2.8, -15, '#ffffff', true); el(39, 14, 5, 2.8, 15, '#ffffff', true);
    el(9, 14, 2.6, 1.2, -15, '#f3b8b0'); el(39, 14, 2.6, 1.2, 15, '#f3b8b0');
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(13, 9); ctx.quadraticCurveTo(24, 5, 35, 9); ctx.quadraticCurveTo(38, 20, 33, 32); ctx.quadraticCurveTo(30, 38, 24, 38); ctx.quadraticCurveTo(18, 38, 15, 32); ctx.quadraticCurveTo(10, 20, 13, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    el(29.5, 14, 5, 5.5, 0, '#2b2118');
    el(24, 32, 9.5, 7, 0, '#f3b8b0', true);
    el(18, 21, 2.2, 2.2, 0, '#2b2118'); el(30, 21, 2.2, 2.2, 0, '#2b2118'); el(20, 32, 1.4, 2, 0, '#2b2118'); el(28, 32, 1.4, 2, 0, '#2b2118');
    ctx.restore();
  },
  fields: function (ctx, x, y) {
    ctx.fillStyle = '#4c9a3f'; ctx.beginPath(); ctx.moveTo(x, y + 50); ctx.lineTo(x - 40, y - 8); ctx.lineTo(x - 8, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 50); ctx.lineTo(x + 40, y - 8); ctx.lineTo(x + 8, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(x, y - 8, 20, 46, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d19a1a'; for (var i = -1; i <= 1; i++) for (var j = -2; j <= 1; j++) { ctx.beginPath(); ctx.arc(x + i * 10, y - 4 + j * 16, 3.5, 0, 6.2832); ctx.fill(); }
  },
  mountains: function (ctx, x, y) {
    ctx.fillStyle = '#8d949c';
    ctx.beginPath(); ctx.moveTo(x - 56, y + 44); ctx.lineTo(x - 44, y - 6); ctx.lineTo(x - 8, y - 22); ctx.lineTo(x + 20, y - 4); ctx.lineTo(x + 28, y + 44); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a9b0b8'; ctx.beginPath(); ctx.moveTo(x + 6, y + 44); ctx.lineTo(x + 14, y + 12); ctx.lineTo(x + 40, y + 4); ctx.lineTo(x + 58, y + 26); ctx.lineTo(x + 56, y + 44); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
};
function portLabel(kind) {
  var c = makeCanvas(256, 256), ctx = c.getContext('2d');
  ctx.fillStyle = '#f6ecd4'; ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(128, 128, 122, 0, 6.2832); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b2118'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!kind) {
    // Centrado según el trazo real del texto (no según la caja de la fuente).
    ctx.font = 'bold 110px Georgia, "Times New Roman", serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var m = ctx.measureText('3:1');
    ctx.fillText('3:1', 128 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,128 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  }
  else {
    // Sin el "2:1": el recurso solo ya lo dice (y el reglamento explica la tasa), y así el dibujo ocupa mejor el círculo.
    ctx.strokeStyle = '#3b2a18'; ctx.lineWidth = 5; ctx.save(); ctx.translate(128, 128); ctx.scale(1.55, 1.55); PORT_ICONS[kind](ctx, 0, 0); ctx.restore();
  }
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}

export function createPorts(M) {
  var hullShape = new THREE.Shape();
  hullShape.moveTo(-0.34, 0.16); hullShape.lineTo(-0.24, 0); hullShape.lineTo(0.24, 0); hullShape.lineTo(0.42, 0.16); hullShape.closePath();
  var HULL = new THREE.ExtrudeGeometry(hullShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  HULL.translate(0, 0, -0.11);
  var sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(0.3, 0); sailShape.lineTo(0, 0.44); sailShape.closePath();
  var SAIL = new THREE.ExtrudeGeometry(sailShape, { depth: 0.012, bevelEnabled: false });
  var MAST = new THREE.CylinderGeometry(0.014, 0.014, 0.55, 6);
  // Plataforma chata del cartel de puerto (no un poste vertical): un disco bajo, como las fichas de número de las
  // casillas, para que se vea pegado al muelle visto desde arriba en vez de "flotando" como una bandera.
  var PORT_BASE = new THREE.CylinderGeometry(0.3, 0.32, 0.045, 24);
  var PORT_FACE = new THREE.CircleGeometry(0.27, 24);
  var MAT = { dock: M(0x8a5a2b, 0.8), hull: M(0x8b5a34, 0.6), sail: M(0xf4ecd8, 0.85) };
  var detailed = DETAILED_SHIPS ? createShips(M) : null;

  // `port`: el del motor; A y B, los vértices de su arista; `t`, la casilla de la costa. El barco se suma a `ships` (lo mece el bucle).
  function addPort(board, port, i, A, B, t, ships) {
    var mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
    var nx = mx - t.x, nz = mz - t.z, nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
    var P = { x: mx + nx * 1.1, z: mz + nz * 1.1 }, D = { x: mx + nx * 0.32, z: mz + nz * 0.32 }; // D bien pegado a la costa: la plataforma casi toca el borde
    // Los dos muelles no convergen en D (quedaban pegados entre sí de tan cerca): cada uno llega a un punto propio,
    // separado a los lados de D, así el cartel queda EN MEDIO de los dos (como en el juego de referencia).
    var tx = -nz, tz = nx, spread = 0.2;
    var Da = { x: D.x + tx * spread, z: D.z + tz * spread }, Db = { x: D.x - tx * spread, z: D.z - tz * spread };
    board.add(segment(A, Da, WATER_Y + 0.03, 0.05, 0.035, MAT.dock)); board.add(segment(B, Db, WATER_Y + 0.03, 0.05, 0.035, MAT.dock));
    var ship;
    if (detailed) ship = detailed.makeShip(i);
    else {
      ship = new THREE.Group(); ship.add(mesh(HULL, MAT.hull));
      var mast = mesh(MAST, MAT.dock); mast.position.set(0.02, 0.43, 0); ship.add(mast);
      var sail = mesh(SAIL, MAT.sail); sail.position.set(0.035, 0.2, -0.006); ship.add(sail);
    }
    ship.scale.setScalar(0.7);
    // El cartel va fijo entre los muelles, chato sobre el agua (no en el barco, para que no se mueva con las olas;
    // ni parado como una bandera, para que se vea pegado al muelle visto desde arriba, en celular).
    var plateBase = mesh(PORT_BASE, MAT.dock); plateBase.position.set(D.x, WATER_Y + 0.045, D.z); board.add(plateBase);
    var portTex = portLabel(port.resource);
    var lab = new THREE.Mesh(PORT_FACE, new THREE.MeshStandardMaterial({ map: portTex, emissive: 0xffffff, emissiveMap: portTex, emissiveIntensity: 0.4, roughness: 0.55, metalness: 0, envMapIntensity: 0.2 }));
    lab.rotation.x = -Math.PI / 2; lab.position.set(D.x, WATER_Y + 0.069, D.z); lab.receiveShadow = true; board.add(lab);
    ship.position.set(P.x, WATER_Y, P.z); ship.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x);
    ship.userData.phase = i * 1.3; ship.userData.baseY = WATER_Y - 0.02;
    board.add(ship); ships.push(ship);
  }
  return { addPort: addPort };
}
