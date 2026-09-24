// Herramientas de desarrollo: la colocación al azar de la «Partida rápida» y el gancho de pruebas de ?debug.
import * as THREE from 'three';
import { topology } from '../../engine';
import { TILE_TOP } from './constants.js';

// Sorteo ponderado hacia el centro: un vértice pesa según cuántas casillas toca (1, 2 o 3) elevado a 4, así que casi siempre
// cae en el interior pero cualquiera puede salir; una arista pesa por los vértices que une.
export function pickCentral(list, isVertex) {
  var topo = topology();
  var w = list.map(function (id) {
    if (isVertex) return Math.pow(topo.vertices[id].tiles.length, 4);
    var e = topo.edges[id]; return Math.pow(topo.vertices[e.a].tiles.length + topo.vertices[e.b].tiles.length, 4);
  });
  var r = Math.random() * w.reduce(function (a, b) { return a + b; }, 0);
  for (var i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; }
  return list[list.length - 1];
}

// Gancho de pruebas: solo existe si la URL lleva ?debug. Permite armar situaciones (dar cartas, cambiar de fase) y saber
// dónde está cada cosa en pantalla para probar con clics reales. No forma parte del juego.
export function installDebugHook(ctx) {
  if (!/[?&]debug/.test(location.search)) return;
  var renderer = ctx.renderer, camera = ctx.camera, raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  window.__paisano = {
    pick: function (x, y) { var r = renderer.domElement.getBoundingClientRect(); pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); var h = raycaster.intersectObjects(ctx.map.markers().children, false)[0]; return { hit: h ? h.object.userData : null, ray: [raycaster.ray.origin.toArray(), raycaster.ray.direction.toArray()], pointer: pointer.toArray(), cam: camera.position.toArray(), marker19: ctx.map.markers().children.filter(function (c) { return c.userData.id === 19; }).map(function (c) { return c.matrixWorld.elements.slice(12, 15); }) }; },
    game: function () { return ctx.session.debugState ? ctx.session.debugState() : ctx.game; },
    profiles: function () { return ctx.session.debugProfiles ? ctx.session.debugProfiles() : []; }, // el perfil de cada bot (en la mesa no se muestra)
    busy: function () { return ctx.busy; },
    camera: camera, controls: ctx.controls, // para acercar la cámara a un adorno y revisarlo
    ships: function () { return ctx.map.ships().map(function (s) { return s.getWorldPosition(new THREE.Vector3()).toArray(); }); }, // dónde está cada barco (para acercar la cámara)

    legal: function () { return ctx.legal; },
    play: function (events) { ctx.replay.playEvents(events); }, // reproduce eventos sueltos (solo lo visual; al final se vuelve al estado real)
    tileVertices: function (t) { return topology().tiles[t].vertices; },
    mutate: function (fn) { if (!ctx.session.debugMutate) return; ctx.session.debugMutate(fn); ctx.pull(); ctx.map.syncPieces(); ctx.hud.applyView(); },
    screen: function (type, id) {
      var topo = topology(), p = new THREE.Vector3();
      if (type === 'vertex') p.set(ctx.map.vertices()[id].x, TILE_TOP + 0.05, ctx.map.vertices()[id].z);
      else if (type === 'edge') { var e = topo.edges[id]; p.set((ctx.map.vertices()[e.a].x + ctx.map.vertices()[e.b].x) / 2, TILE_TOP + 0.05, (ctx.map.vertices()[e.a].z + ctx.map.vertices()[e.b].z) / 2); }
      else p.set(ctx.map.tiles()[id].x, TILE_TOP + 0.06, ctx.map.tiles()[id].z);
      p.project(camera);
      var r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (0.5 - p.y * 0.5) * r.height };
    }
  };
}
