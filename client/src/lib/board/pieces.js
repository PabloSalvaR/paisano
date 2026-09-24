// Piezas de los jugadores (casas, estancias y caminos) y el ladrón.
import * as THREE from 'three';
import { OUTLINE_T } from './constants.js';
import { mesh } from './materials.js';

// Contorno de las piezas: copia apenas más grande dibujada solo por las caras traseras, que asoma como un borde
// fino alrededor de la silueta y separa la pieza de cualquier terreno.
export function outlineFor(geo, x, mat) {
  geo.computeBoundingBox();
  var b = geo.boundingBox, o = new THREE.Mesh(geo, mat);
  o.scale.set(1 + 2 * OUTLINE_T / (b.max.x - b.min.x), 1 + 2 * OUTLINE_T / (b.max.y - b.min.y), 1 + 2 * OUTLINE_T / (b.max.z - b.min.z));
  o.position.set(x || 0, -OUTLINE_T, 0);
  return o;
}

// Caja entre dos puntos del tablero (caminos, muelles y marcadores de camino).
export function segment(a, b, y, thick, height, mat) {
  var dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
  var m = mesh(new THREE.BoxGeometry(len, height, thick), mat);
  m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
  m.rotation.y = -Math.atan2(dz, dx);
  return m;
}

function houseGeo(w, h, d, roof) {
  var s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(0, h + roof); s.lineTo(-w / 2, h); s.closePath();
  var g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  g.translate(0, 0, -d / 2);
  return g;
}

export function createPieces(M) {
  var HOUSE = houseGeo(0.24, 0.16, 0.2, 0.12);
  var CITY_HALL = houseGeo(0.3, 0.13, 0.22, 0.09), CITY_TOWER = houseGeo(0.15, 0.27, 0.17, 0.1);
  var robberMat = M(0x24272d, 0.3, 0.35, { env: 0.8 });
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
    var g = new THREE.Group(); g.add(mesh(robberGeo, robberMat));
    var h = mesh(headGeo, robberMat); h.position.y = 0.31; g.add(h);
    g.scale.setScalar(1.25); // un poco más grande que el resto de las piezas, para que se lo note en el tablero
    return g;
  }
  return { makeSettlement: makeSettlement, makeCity: makeCity, makeRobber: makeRobber };
}
