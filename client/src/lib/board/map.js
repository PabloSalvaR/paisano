// El tablero sobre la mesa: casillas con su decorado, puertos, ladrón, piezas de los jugadores, la pieza a confirmar y los
// marcadores de jugada legal. Dibuja lo ya mostrado del estado (`ctx.shown`) y lo que permite el motor (`ctx.legal`).
import * as THREE from 'three';
import { topology } from '../../engine';
import { DICE_BOUNCE, OUTLINE_T, TILE_TOP } from './constants.js';
import { col, mulberry32 } from './util.js';
import { mesh } from './materials.js';
import { createTerrain } from './terrain.js';
import { createPorts } from './ports.js';
import { createPieces, segment } from './pieces.js';

export const DROP_MS = 380; // lo que tarda en bajar la pieza confirmada

export function createMap(ctx) {
  var scene = ctx.scene, camera = ctx.camera, stage = ctx.stage, PLAYERS = ctx.PLAYERS, PLAYER_INFO = ctx.PLAYER_INFO;
  var terrain = createTerrain(ctx.kit), ports = createPorts(ctx.kit.M), pieces = createPieces(ctx.kit.M);
  var makeSettlement = pieces.makeSettlement, makeCity = pieces.makeCity;
  var board = null, tiles = [], tileMeshes = [], ships = [], trees = [], robber = null, robberBase = 0, robberPulse = 0, robberTile = -1;
  var piecesGroup = null, markersGroup = null, ghostGroup = null;
  var vertices = []; // vértices del motor con su posición 3D; el id es el del motor

  // Arma el tablero del mapa de la partida (ctx.game.map, con los mismos ids que el motor); `seed` decide el decorado de
  // cada casilla. Arranca sin piezas: aparecen a medida que se juega.
  function build(seed) {
    var game = ctx.game, rnd = mulberry32(seed), topo = topology();
    if (board) scene.remove(board);
    board = new THREE.Group(); scene.add(board);
    tiles = []; tileMeshes = []; ships = []; trees = []; robber = null; pieceSeen = {};

    // casillas (mismo orden e ids que las del motor)
    topo.tiles.forEach(function (et) {
      var kind = game.map.terrains[et.id], num = game.map.numbers[et.id];
      var t = { id: et.id, q: et.q, r: et.r, kind: kind, num: num, x: et.x, z: et.z, pulse: 0 };
      t.group = new THREE.Group(); t.group.position.set(t.x, 0, t.z);
      t.mesh = mesh(terrain.tileGeo, terrain.tileMats[kind]); t.group.add(t.mesh); t.mesh.userData.tile = t;
      t.group.add(terrain.decorate(kind, mulberry32(Math.floor(rnd() * 1e9)), trees));
      if (num) {
        t.token = terrain.makeToken(num); t.tokenBase = t.token.position.y; t.group.add(t.token);
        t.glow = terrain.makeGlow(); t.group.add(t.glow);
      }
      board.add(t.group); tiles.push(t); tileMeshes.push(t.mesh);
    });

    // vértices del motor con su posición 3D (el id es el del estado de la partida)
    vertices = topo.vertices.map(function (v) { return { x: v.x, z: v.z, tiles: v.tiles.map(function (i) { return tiles[i]; }), nb: v.neighbors }; });

    // puertos: los reparte el motor (9 sobre la costa); acá solo se dibujan
    game.map.ports.forEach(function (port, i) {
      var e = topo.edges[port.edge];
      ports.addPort(board, port, i, vertices[e.a], vertices[e.b], tiles[port.tile], ships);
    });

    // ladrón en el desierto
    robber = pieces.makeRobber(); robber.position.set(0.05, TILE_TOP, 0.03); robberBase = TILE_TOP; robberPulse = 0;
    tiles[game.robber].group.add(robber); robberTile = game.robber;

    piecesGroup = new THREE.Group(); board.add(piecesGroup);
    markersGroup = new THREE.Group(); board.add(markersGroup);
    ghostGroup = new THREE.Group(); board.add(ghostGroup);
    syncPieces();
  }

  // Dibuja las piezas del estado del motor (caminos, casas y estancias). Las que son nuevas "brotan" con una animación corta.
  var pieceSeen = {};
  function syncPieces() {
    while (piecesGroup.children.length) {
      var old = piecesGroup.children[0]; piecesGroup.remove(old);
      if (old.geometry && old.geometry.type === 'BoxGeometry') old.geometry.dispose(); // los caminos crean su propia geometría
    }
    var topo = topology(), now = performance.now() / 1000;
    function born(o, key) { if (!pieceSeen[key]) { pieceSeen[key] = true; o.userData.born = now; o.scale.setScalar(0.001); } }
    ctx.shown.edgeRoads.forEach(function (p, eid) {
      if (p === null) return;
      var e = topo.edges[eid], A = vertices[e.a], B = vertices[e.b], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
      var ux = dx / L, uz = dz / L, a = { x: A.x + ux * 0.2, z: A.z + uz * 0.2 }, b = { x: B.x - ux * 0.2, z: B.z - uz * 0.2 };
      var road = segment(a, b, TILE_TOP + 0.045, 0.085, 0.07, PLAYERS[p]);
      var edgeLine = segment(a, b, TILE_TOP + 0.045, 0.085 + 2 * OUTLINE_T, 0.07 + 2 * OUTLINE_T, PLAYERS[p].userData.outline);
      edgeLine.castShadow = false; edgeLine.receiveShadow = false;
      born(road, 'e' + eid); born(edgeLine, 'e' + eid);
      piecesGroup.add(road); piecesGroup.add(edgeLine);
    });
    ctx.shown.vertexBuildings.forEach(function (bd, vid) {
      if (!bd) return;
      var v = vertices[vid], m = bd.city ? makeCity(PLAYERS[bd.player]) : makeSettlement(PLAYERS[bd.player]);
      m.position.set(v.x, TILE_TOP, v.z); m.rotation.y = ((vid * 5) % 6) * Math.PI / 3 + Math.PI / 6;
      born(m, 'v' + vid + (bd.city ? 'c' : 's'));
      piecesGroup.add(m);
    });
  }

  // Vista previa de la pieza pendiente de confirmar: la misma pieza del jugador, opaca y con el color exacto del jugador.
  function showGhost(cmd) {
    clearGhost();
    var base = PLAYERS[cmd.player], topo = topology();
    var mat = base; // el material real del jugador: mismo color, sin aclarar
    var g;
    if (cmd.edge !== undefined) {
      var e = topo.edges[cmd.edge], A = vertices[e.a], B = vertices[e.b], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      g = segment({ x: A.x + ux * 0.2, z: A.z + uz * 0.2 }, { x: B.x - ux * 0.2, z: B.z - uz * 0.2 }, TILE_TOP + 0.045, 0.085, 0.07, mat);
    } else {
      var v = vertices[cmd.vertex];
      g = cmd.type === 'buildCity' ? makeCity(mat) : makeSettlement(mat);
      g.position.set(v.x, TILE_TOP, v.z); g.rotation.y = ((cmd.vertex * 5) % 6) * Math.PI / 3 + Math.PI / 6;
    }
    g.traverse(function (o) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 4; });
    g.userData.baseY = g.position.y; g.userData.baseRot = g.rotation.y;
          ghostGroup.add(g);
  }
  // La pieza pendiente flota sobre su lugar dando vueltas en el eje Y; al confirmar baja, frena el giro hasta quedar
  // alineada y recién entonces se construye la real (sin animación de brote: ya llegó).
  var GHOST_HOVER = 0.55;
  function animateGhost(now) {
    var g = ghostGroup && ghostGroup.children[0]; if (!g) return;
    var u = g.userData;
    if (!u.drop) { g.position.y = u.baseY + GHOST_HOVER + 0.05 * Math.sin(now * 3); g.rotation.y = u.baseRot + now * 2.4; return; }
    var k = Math.min(1, (now - u.drop.t0) * 1000 / DROP_MS);
    g.position.y = u.baseY + u.drop.h * (1 - k * k);
    g.rotation.y = u.baseRot + u.drop.a0 + (u.drop.a1 - u.drop.a0) * (1 - (1 - k) * (1 - k));
  }
  var confirmPos = new THREE.Vector3();
  function screenPoint(x, y, z) {
    confirmPos.set(x, y, z); board.localToWorld(confirmPos); confirmPos.project(camera);
    return { x: (confirmPos.x + 1) / 2 * stage.clientWidth, y: (1 - confirmPos.y) / 2 * stage.clientHeight };
  }
  // Dónde está en pantalla la pieza a confirmar: arriba (`top`, con lugar para que flote) y en su lugar del tablero (`bot`).
  function ghostAnchors() {
    var g = ghostGroup && ghostGroup.children[0]; if (!g) return null;
    var u = g.userData;
    return { top: screenPoint(g.position.x, u.baseY + GHOST_HOVER + 0.4, g.position.z), bot: screenPoint(g.position.x, u.baseY, g.position.z) };
  }
  // Arranca la bajada de la pieza confirmada (dura DROP_MS). Devuelve false si no hay pieza que bajar.
  function dropGhost() {
    var g = ghostGroup && ghostGroup.children[0]; if (!g) return false;
    var u = g.userData, a0 = (g.rotation.y - u.baseRot) % (2 * Math.PI), a1 = 2 * Math.PI * (a0 > 4 ? 2 : 1);
    u.drop = { t0: performance.now() / 1000, h: g.position.y - u.baseY, a0: a0, a1: a1 };
    return true;
  }
  // La pieza ya se vio llegar: al construirse, no vuelve a brotar.
  function markSeen(key) { pieceSeen[key] = true; }
  function clearGhost() {
    if (!ghostGroup) return;
    while (ghostGroup.children.length) {
      var g = ghostGroup.children[0]; ghostGroup.remove(g);
      if (g.geometry && g.geometry.type === 'BoxGeometry') g.geometry.dispose();
    }
  }

  // Marcadores de las jugadas legales del jugador de turno (vértices para la casa, aristas para el camino).
  // Salen de legalActions del motor: el cliente no decide qué es legal.
  var markerMat = null, hitMat = new THREE.MeshBasicMaterial({ visible: false });
  function refreshMarkers() {
    while (markersGroup.children.length) {
      var c = markersGroup.children[0]; markersGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      c.children.forEach(function (k) { if (k.geometry) k.geometry.dispose(); });
    }
    if (markerMat) { markerMat.dispose(); markerMat = null; }
    if (ctx.busy || !ctx.game) return;
    var acts = ctx.legal, topo = topology(), y = TILE_TOP + 0.05;
    markerMat = new THREE.MeshBasicMaterial({ color: col(PLAYER_INFO[ctx.game.turn].css), transparent: true, opacity: 0.6, depthWrite: false, fog: false });
    var ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    function vertexMarker(vid) {
      // cada marcador tiene un área de toque invisible más grande que el disco que se ve (cómoda en el celular)
      var v = vertices[vid], m = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), hitMat);
      m.rotation.x = -Math.PI / 2; m.position.set(v.x, y, v.z); m.userData = { type: 'vertex', id: vid };
      var disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), markerMat); disc.position.z = 0.001; disc.renderOrder = 3; m.add(disc);
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.17, 20), ringMat); ring.position.z = 0.002; ring.renderOrder = 3; m.add(ring);
      markersGroup.add(m);
    }
    function edgeMarker(eid) {
      var e = topo.edges[eid], A = vertices[e.a], B = vertices[e.b], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      // Lo que se ve tiene el mismo largo y ancho que el camino ya construido (ver syncPieces), para que al confirmar no cambie
      // de forma. El área de toque es aparte, invisible y mucho más ancha (0.32 contra 0.085): un camino es fino y costaba apuntarle.
      var m = segment({ x: A.x + ux * 0.18, z: A.z + uz * 0.18 }, { x: B.x - ux * 0.18, z: B.z - uz * 0.18 }, y, 0.32, 0.06, hitMat);
      m.castShadow = false; m.receiveShadow = false; m.userData = { type: 'edge', id: eid };
      var bar = mesh(new THREE.BoxGeometry(L - 0.4, 0.03, 0.085), markerMat);
      bar.castShadow = false; bar.receiveShadow = false; bar.renderOrder = 3; m.add(bar);
      markersGroup.add(m);
    }
    function tileMarker(tid) {
      // anillo alrededor de la ficha (para no taparla) y un área de toque del tamaño de la casilla
      var t = tiles[tid], m = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12), hitMat);
      m.rotation.x = -Math.PI / 2; m.position.set(t.x, TILE_TOP + 0.06, t.z); m.userData = { type: 'tile', id: tid };
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.7, 32), markerMat); ring.position.z = 0.001; ring.renderOrder = 3; m.add(ring);
      var edge = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.74, 32), ringMat); edge.position.z = 0.002; edge.renderOrder = 3; m.add(edge);
      markersGroup.add(m);
    }
    acts.forEach(function (a) {
      if (a.type === 'placeSettlement' || (a.type === 'buildSettlement' && ctx.buildMode === 'settlement') || (a.type === 'buildCity' && ctx.buildMode === 'city')) a.vertices.forEach(vertexMarker);
      if (a.type === 'placeRoad' || (a.type === 'buildRoad' && (ctx.buildMode === 'road' || ctx.game.phase.kind === 'roadBuilding'))) a.edges.forEach(edgeMarker);
      if (a.type === 'moveRobber') a.tiles.forEach(tileMarker);
    });
    markersGroup.updateMatrixWorld(true); // que se puedan tocar de inmediato, sin esperar al próximo cuadro
  }

  // El ladrón se dibuja sobre la casilla del estado (con un saltito al llegar). Fuera del desierto va corrido hacia adelante
  // para no tapar la ficha del número.
  function syncRobber() {
    if (!robber || robberTile === ctx.shown.robber) return;
    var t = tiles[ctx.shown.robber];
    robberTile = ctx.shown.robber;
    t.group.add(robber);
    robber.position.x = t.kind === 'desert' ? 0.05 : 0; robber.position.z = t.kind === 'desert' ? 0.03 : 0.5;
    robberPulse = 1;
  }
  function robberJump() { robberPulse = 1; } // con un 7
  function pulseNumber(n) { tiles.forEach(function (t) { if (t.num === n) t.pulse = 1; }); } // las casillas del número que salió

  // Un cuadro: fichas que saltan y brillan con los dados, el ladrón que salta al llegar, barcos que se mecen, árboles con
  // brisa, marcadores que laten, la pieza a confirmar y las piezas nuevas que brotan.
  function animate(dt, time, nowS) {
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i], bounce = 0;
      if (t.pulse > 0) { t.pulse = Math.max(0, t.pulse - dt / 1.8); bounce = Math.abs(Math.sin((1 - t.pulse) * Math.PI * 2.5)) * DICE_BOUNCE * t.pulse; }
      if (t.token) t.token.position.y = t.tokenBase + bounce;
      if (t.glow) { t.glow.visible = t.pulse > 0; t.glow.material.opacity = Math.min(1, t.pulse * 2.5) * 0.5; }
    }
    if (robber) {
      if (robberPulse > 0) { robberPulse = Math.max(0, robberPulse - dt / 1.6); robber.position.y = robberBase + Math.abs(Math.sin((1 - robberPulse) * Math.PI * 3)) * 0.35 * robberPulse; }
      else robber.position.y = robberBase;
    }
    for (var s = 0; s < ships.length; s++) {
      var sh = ships[s], ph = sh.userData.phase;
      sh.position.y = sh.userData.baseY + Math.sin(time * 1.4 + ph) * 0.025 + 0.02;
      sh.rotation.z = Math.sin(time * 1.1 + ph) * 0.05;
    }
    // árboles: brisa apenas perceptible (dos senos de distinta frecuencia, como el titileo del farol) para que no se muevan todos igual
    for (var tr = 0; tr < trees.length; tr++) {
      var tg = trees[tr], tph = tg.userData.swayPhase;
      tg.rotation.z = Math.sin(time * 0.7 + tph) * 0.025 + Math.sin(time * 1.7 + tph * 1.3) * 0.01;
      tg.rotation.x = Math.sin(time * 0.55 + tph * 1.6) * 0.015;
    }
    // marcadores de jugada legal: laten suave
    if (markerMat) markerMat.opacity = 0.5 + 0.2 * Math.sin(time * 4);
    animateGhost(nowS);
    // piezas nuevas: brotan con un pequeño rebote
    for (var pc = 0; pc < piecesGroup.children.length; pc++) {
      var pm = piecesGroup.children[pc], born = pm.userData.born;
      if (born === undefined) continue;
      var u = Math.min(1, (nowS - born) / 0.35), sc = u >= 1 ? 1 : Math.max(0.001, 1 - Math.pow(1 - u, 3) * Math.cos(u * 9));
      pm.scale.setScalar(sc); if (u >= 1) pm.userData.born = undefined;
    }
  }

  return {
    build: build, syncPieces: syncPieces, syncRobber: syncRobber, refreshMarkers: refreshMarkers, animate: animate,
    showGhost: showGhost, clearGhost: clearGhost, ghostAnchors: ghostAnchors, dropGhost: dropGhost, markSeen: markSeen,
    robberJump: robberJump, pulseNumber: pulseNumber,
    tiles: function () { return tiles; }, vertices: function () { return vertices; }, ships: function () { return ships; },
    tileMeshes: function () { return tileMeshes; }, markers: function () { return markersGroup; }
  };
}
