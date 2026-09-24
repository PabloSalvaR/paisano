// Utilidades sin estado: azar con semilla, colores, lienzos y preferencias del navegador.
import * as THREE from 'three';

// Números pseudoaleatorios con semilla (mulberry32): la misma semilla da siempre la misma secuencia.
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Mezcla en el lugar con Math.random (para lo que no tiene que repetirse, como el sorteo de los bots).
export function shuffleAny(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
export function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
export function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
export function sumOf(o) { var n = 0; for (var k in o) n += o[k]; return n; }
export function pressed(btn, on) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
