// Mesa, marco y mar: lo fijo que rodea al tablero. Se arma una sola vez.
import * as THREE from 'three';
import { RC, WATER_Y } from './constants.js';
import { mesh } from './materials.js';
import { waterCanvas, woodCanvas } from './textures.js';

function hexPath(P, r) {
  var p = new P();
  for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3, x = r * Math.cos(a), y = r * Math.sin(a); if (i) p.lineTo(x, y); else p.moveTo(x, y); }
  p.closePath();
  return p;
}

// Devuelve la textura del mar, que el bucle desplaza despacio para que el agua se mueva.
export function buildTable(scene, kit) {
  var M = kit.M, tex = kit.tex;
  var table = mesh(new THREE.PlaneGeometry(140, 140), M(0xffffff, 0.75, 0, { env: 0.2, map: tex(woodCanvas('#6a4a2e', '#3f2a17', '#8c6a45', 11), 14, 14) }), false, true);
  table.rotation.x = -Math.PI / 2; table.position.y = -0.01;
  scene.add(table);

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
  return waterTex;
}
