// Fábrica de materiales, texturas y mallas de la escena, y materiales de las piezas de cada asiento.
import * as THREE from 'three';
import { col } from './util.js';

// `allMats` junta todos los materiales creados con M: la luz ajusta sus reflejos según el momento del día (ver lights.js).
export function createKit(renderer) {
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
    canvas.__tex = t; // para poder refrescarla si el lienzo se completa después (ver el 11 de bastos)
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repeatX) t.repeat.set(repeatX, repeatY || repeatX);
    return t;
  }
  return { M: M, tex: tex, allMats: allMats };
}

export function mesh(geo, mat, cast, receive) {
  var m = new THREE.Mesh(geo, mat);
  m.castShadow = cast !== false; m.receiveShadow = receive !== false;
  return m;
}

// Un material por asiento, en el orden de SEAT_COLORS. El color base queda guardado: la luz (lights.js) lo ajusta según
// día/atardecer/noche. Contra bots, players.js los reparte según el color elegido.
export function createPlayerMaterials(M) {
  return [0xc81e1e, 0x3b6fd6, 0xf0932b, 0xf1eee6].map(function (h) {
    var m = M(h, 0.38, 0.05, { env: 0.6 }), hsl = { h: 0, s: 0, l: 0 };
    m.userData.base = m.color.clone(); m.emissive = new THREE.Color(); m.emissiveIntensity = 0;
    // contorno: tono muy oscuro del propio color del jugador (no negro puro, que se ve como calcomanía)
    m.userData.base.getHSL(hsl);
    m.userData.outline = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hsl.h, hsl.s * 0.9, hsl.l * 0.08), side: THREE.BackSide });
    return m;
  });
}
