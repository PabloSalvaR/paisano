// Luces de la escena y sus tres momentos (día, atardecer, noche), con transición suave entre uno y otro.
import * as THREE from 'three';
import { col } from './util.js';

const PRESETS = {
  // Piezas de jugador: pieceK = luminosidad (1 = color pleno), pieceS = saturación (1 = la del color pleno),
  // pieceEm = brillo propio (emisivo). De día son más intensas y profundas, de noche se iluminan, para que
  // siempre contrasten con el tablero.
  day:   { bg: 0xb9c9cf, sun: 0xfff2dc, sunI: 1.05, sunPos: [7, 13, 6],    sky: 0xdcecff, ground: 0x8f7a5c, hemiI: 0.52, env: 0.9,  exp: 0.9, lamps: 0,    pieceK: 0.72, pieceS: 1.3,  pieceEm: 0 },
  dusk:  { bg: 0x4a3040, sun: 0xff9a55, sunI: 1.55, sunPos: [-11, 4.6, 6], sky: 0xffb98a, ground: 0x4a3350, hemiI: 0.45, env: 0.6,  exp: 1.05, lamps: 0.35, pieceK: 0.9,  pieceS: 1.12, pieceEm: 0.22 },
  night: { bg: 0x090e1d, sun: 0x9fb6ff, sunI: 0.6,  sunPos: [-6, 12, 4],   sky: 0x3a4a8a, ground: 0x1a1a2a, hemiI: 0.4,  env: 0.28, exp: 1.0,  lamps: 1.25, pieceK: 1.0,  pieceS: 1.0,  pieceEm: 0.65 }
};
function presetState(p) {
  return {
    bg: col(p.bg), sun: col(p.sun), sunI: p.sunI, sunPos: new THREE.Vector3(p.sunPos[0], p.sunPos[1], p.sunPos[2]),
    sky: col(p.sky), ground: col(p.ground), hemiI: p.hemiI, env: p.env, exp: p.exp, lamps: p.lamps, pieceK: p.pieceK, pieceS: p.pieceS, pieceEm: p.pieceEm
  };
}

// `players`: materiales de las piezas (su color se ajusta a cada momento); `allMats`: todos los materiales (reflejos).
export function createLights(scene, renderer, allMats, players) {
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

  var cur = presetState(PRESETS.day), tar = presetState(PRESETS.day);
  var lastEnv = -1, pieceHSL = { h: 0, s: 0, l: 0 };
  function applyLight(k) {
    cur.bg.lerp(tar.bg, k); cur.sun.lerp(tar.sun, k); cur.sky.lerp(tar.sky, k); cur.ground.lerp(tar.ground, k);
    cur.sunPos.lerp(tar.sunPos, k);
    cur.sunI += (tar.sunI - cur.sunI) * k; cur.hemiI += (tar.hemiI - cur.hemiI) * k;
    cur.env += (tar.env - cur.env) * k; cur.exp += (tar.exp - cur.exp) * k; cur.lamps += (tar.lamps - cur.lamps) * k;
    cur.pieceK += (tar.pieceK - cur.pieceK) * k; cur.pieceS += (tar.pieceS - cur.pieceS) * k; cur.pieceEm += (tar.pieceEm - cur.pieceEm) * k;
    for (var pi = 0; pi < players.length; pi++) {
      var pm = players[pi];
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

  return {
    apply: applyLight, // acerca la luz actual a la elegida (k = 1: en el acto)
    setPreset: function (name) { tar = presetState(PRESETS[name]); },
    lamps: function () { return cur.lamps; } // 0 de día, 0.35 al atardecer, 1.25 de noche (el farol se enciende con esto)
  };
}
