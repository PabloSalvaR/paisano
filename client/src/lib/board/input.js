// Puntero sobre el tablero: el cartel del terreno que está debajo y los toques sobre los marcadores de jugada legal.
import * as THREE from 'three';
import { TERRAINS } from './constants.js';

export function createInput(ctx) {
  var renderer = ctx.renderer, camera = ctx.camera;
  var raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), hoverTile = null;
  var hoverBox = document.getElementById('hover');
  function setHover(t) {
    if (t === hoverTile) return;
    hoverTile = t;
    if (!t) { hoverBox.hidden = true; return; }
    var T = TERRAINS[t.kind];
    hoverBox.innerHTML = '<strong></strong><span></span>';
    hoverBox.firstChild.textContent = T.name + (t.num ? ' · ' + t.num : '');
    hoverBox.lastChild.textContent = t.num ? 'Produce ' + T.res.toLowerCase() : 'No produce nada';
    hoverBox.hidden = false;
  }
  renderer.domElement.addEventListener('pointermove', function (e) {
    if (e.buttons) { setHover(null); return; }
    var r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    var hit = raycaster.intersectObjects(ctx.map.tileMeshes(), false)[0];
    setHover(hit ? hit.object.userData.tile : null);
  });
  renderer.domElement.addEventListener('pointerleave', function () { setHover(null); });

  // Clic (o toque) sobre un marcador de jugada legal. Si el puntero se movió, era un arrastre de la cámara y no cuenta.
  var downAt = null;
  renderer.domElement.addEventListener('pointerdown', function (e) { downAt = e.isPrimary ? { x: e.clientX, y: e.clientY } : null; });
  renderer.domElement.addEventListener('pointerup', function (e) {
    var d = downAt; downAt = null;
    if (!d || !e.isPrimary || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || ctx.busy || !ctx.map.markers() || !ctx.map.markers().children.length) return;
    var r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    var hit = raycaster.intersectObjects(ctx.map.markers().children, false)[0];
    if (!hit) return;
    var cmd = commandFromMarker(hit.object.userData);
    if (cmd.type === 'moveRobber') ctx.replay.dispatch(cmd); else ctx.hud.askConfirm(cmd);
  });

  // El comando que corresponde al marcador tocado.
  function commandFromMarker(m) {
    var p = ctx.game.turn, setup = ctx.game.phase.kind === 'setup';
    if (m.type === 'tile') return { type: 'moveRobber', player: p, tile: m.id };
    if (m.type === 'vertex') return { type: setup ? 'placeSettlement' : ctx.buildMode === 'city' ? 'buildCity' : 'buildSettlement', player: p, vertex: m.id };
    return { type: setup ? 'placeRoad' : 'buildRoad', player: p, edge: m.id };
  }

  return { clearHover: function () { setHover(null); } };
}
