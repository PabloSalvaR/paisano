// Tablero 3D (three r128, JS plano). Nació de un prototipo HTML ya retirado del repo.
// Motor de reglas (TypeScript puro): decide todo. El tablero solo dibuja lo que la sesión le da (la vista del jugador) y le
// envía comandos; no aplica reglas ni conoce el estado completo.
//
// initBoard arma la escena y la interfaz con los módulos de esta carpeta y los conecta con un objeto compartido, `ctx`:
//   scene.js, lights.js, materials.js      renderer, cámara, luces y materiales
//   table.js, decor.js, textures.js        mesa, marco, mar y adornos (fijos)
//   map.js (terrain, ports, pieces)        el tablero de la partida: casillas, puertos, piezas y marcadores
//   input.js                               clics y toques sobre el tablero
//   hud.js, fx.js, dice.js, opening.js     interfaz de encima, sus animaciones, los dados y el sorteo de quién abre
//   replay.js                              comandos a la sesión y reproducción de los eventos
//   bar.js, debug.js                       barra de controles y herramientas de desarrollo
import * as THREE from 'three';
import { createAudio } from '../audio.js';
import { LocalSession } from '../session';
import { createScene } from './scene.js';
import { createKit, createPlayerMaterials } from './materials.js';
import { createLights } from './lights.js';
import { buildTable } from './table.js';
import { animateLantern, buildDecor } from './decor.js';
import { createPlayers } from './players.js';
import { createMap } from './map.js';
import { createFx } from './fx.js';
import { createDice } from './dice.js';
import { createHud } from './hud.js';
import { createOpening } from './opening.js';
import { createReplay } from './replay.js';
import { createInput } from './input.js';
import { createBar } from './bar.js';
import { installDebugHook, pickCentral } from './debug.js';
import { reduced } from './util.js';

export { MARKUP, SEAT_COLORS } from './markup.js';

// opts (en línea): { session, seats: [{ name, bot }], seed }. Sin `session` es partida local: opts.mode 'bots' (vos contra tres bots) o 'local' (los 4 en la pantalla).
export function initBoard(opts) {
  opts = opts || {};
  var online = !!opts.session;
  var unsubscribe = null; // baja de la suscripción a la sesión remota (se cierra en dispose)
  var errBox = document.getElementById('err');
  function fail(msg) { errBox.textContent = msg; errBox.hidden = false; }
  var raf = 0, ro = null, renderer = null, disposed = false;
  var audio = createAudio();
  function unlockAudio() { audio.unlock(); }
  // el navegador solo deja sonar tras un gesto: el primer clic o tecla arranca el ambiente
  var UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown']; // según el navegador, cuenta uno u otro como gesto
  UNLOCK_EVENTS.forEach(function (e) { document.addEventListener(e, unlockAudio, true); });
  try { main(); } catch (e) { console.error(e); fail('No se pudo iniciar la escena 3D: ' + e.message); }
  return function dispose() {
    disposed = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (unsubscribe) unsubscribe();
    audio.dispose(); UNLOCK_EVENTS.forEach(function (e) { document.removeEventListener(e, unlockAudio, true); });
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
  };

  function main() {
    var stage = document.getElementById('stage');
    var view = createScene(stage), scene = view.scene, camera = view.camera;
    renderer = view.renderer;
    var kit = createKit(renderer), PLAYERS = createPlayerMaterials(kit.M);
    var lights = createLights(scene, renderer, kit.allMats, PLAYERS);
    var waterTex = buildTable(scene, kit), lantern = buildDecor(scene, kit);
    var players = createPlayers(opts, online, PLAYERS);

    var ctx = {
      // Fijo mientras dura el tablero.
      opts: opts, online: online, stage: stage, audio: audio, renderer: renderer, scene: scene, camera: camera,
      controls: view.controls, rig: view.rig, lights: lights, kit: kit, PLAYERS: PLAYERS,
      withOthers: online || opts.mode === 'bots', // hay otros que juegan por su cuenta (bots o personas en línea), y vos sos siempre el mismo jugador; false: los 4 en la misma pantalla
      players: players, PLAYER_INFO: players.PLAYER_INFO, SEATS: players.SEATS,
      pull: pull,

      // La partida: la sesión (dueña del estado; hoy local o remota) y la última vista que dio.
      session: null,
      game: null, legal: [], me: 0, // partida visible, acciones legales y jugador que mira
      shown: null,     // lo que ya se dibujó del estado (piezas y ladrón); durante una reproducción de eventos va por detrás de `game`
      busy: false,     // corre una animación (dados, recursos volando): no se aceptan jugadas ni botones
      sending: false,  // se espera la respuesta de la sesión a un comando
      playing: false,  // se están reproduciendo eventos

      // Lo que muestra la interfaz. Durante una reproducción avanza al ritmo de las animaciones y al final se corrige con
      // el estado real (si algo quedó corrido, se arregla solo).
      VIEWER: 0,       // el jugador cuya mano muestra el banner (en la partida local, el de turno)
      turn: 0,         // el turno que se ve
      myHand: {},      // la mano de quien mira
      counts: [],      // cartas de cada jugador (de los demás solo se sabe cuántas)
      vps: [0, 0, 0, 0], vpCards: [0, 0, 0, 0], // puntos que se ven (los Puntos de victoria ajenos, recién al final) y esas cartas, las que se conocen
      devCounts: [0, 0, 0, 0], knights: [0, 0, 0, 0], roadLens: [0, 0, 0, 0], // cartas de desarrollo (cuántas, no cuáles), gauchos jugados y ruta propia
      awardRoad: { holder: null, length: 0 }, awardArmy: { holder: null, size: 0 }, // quién tiene cada reconocimiento
      openingOn: false, // se muestra el sorteo de quién abre (mientras, no se marca de quién es el turno)

      // Paneles y modos de la interfaz.
      buildMode: null,  // 'road' | 'settlement' | 'city' | null: qué se está por construir (en el turno normal)
      pendingCmd: null, // jugada de construcción a la espera del ✓ / ✕
      tradeUI: null,    // panel de comercio: { tab, give, get, offer } (null = cerrado)
      cardsUI: null,    // panel de cartas: { mode: 'hand' | 'monopoly' | 'plenty', res, picks } (null = cerrado)
      summaryUI: null, summaryShown: false, // resumen de fin de partida: abierto, y si ya se abrió una vez (no vuelve a abrirse solo)
      offerShown: null  // durante una reproducción, la oferta tal como se va viendo
    };
    ctx.map = createMap(ctx);
    ctx.fx = createFx(ctx);
    ctx.dice = createDice();
    ctx.hud = createHud(ctx);
    ctx.opening = createOpening(ctx);
    ctx.replay = createReplay(ctx);
    ctx.input = createInput(ctx);
    if (online) unsubscribe = ctx.replay.listen(opts.session);
    createBar(ctx, { newGame: newGame, quickGame: quickGame });
    installDebugHook(ctx);

    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(view.resize); ro.observe(stage); } else window.addEventListener('resize', view.resize);
    view.resize();

    // Trae la vista de la sesión: partida visible, acciones legales y quién mira.
    function pull() {
      var v = ctx.session.view(); ctx.game = v.game; ctx.legal = v.legal; ctx.me = v.me;
      ctx.shown = { vertexBuildings: ctx.game.vertexBuildings.slice(), edgeRoads: ctx.game.edgeRoads.slice(), robber: ctx.game.robber };
    }
    // Partida nueva (o la de la sala) y su tablero. El mapa lo decide el motor (game.map).
    function buildBoard(seed) {
      ctx.session = online ? opts.session : new LocalSession(ctx.PLAYER_INFO.slice(0, ctx.SEATS).map(function (p) { return p.name; }), seed, { firstPlayer: null, numberPlacement: opts.chaos ? 'random' : 'spiral' }, ctx.withOthers ? { bots: [false, true, true, true].slice(0, ctx.SEATS), profiles: 'board' } : {});
      pull();
      ctx.rig.setOrbit(false); ctx.opening.close(); ctx.input.clearHover(); ctx.busy = false; ctx.sending = false;
      ctx.map.build(seed);
      ctx.hud.resetPlayers();
      ctx.hud.refreshUi();
    }
    // Arranca la partida recién armada: muestra el sorteo (si lo hay y nadie jugó todavía) y después deja jugar a los bots que abran.
    function startGame() {
      var ph = ctx.game.phase;
      function go() { if (ctx.session.kick) ctx.session.kick().then(function (evs) { if (evs.length) ctx.replay.playEvents(evs); }); }
      if (!ctx.game.opening || ph.kind !== 'setup' || ph.step !== 0 || ph.part !== 'settlement' || reduced()) { go(); return; }
      ctx.opening.show(ctx.game.opening, ctx.game.turn, go);
    }
    function newGame() {
      ctx.dice.clear();
      if (!online && opts.mode === 'bots' && opts.name) { players.drawBots(); ctx.hud.renderSeatFaces(); } // partida nueva, bots nuevos
      buildBoard((Math.random() * 1e9) | 0);
      ctx.dice.resetStats();
      startGame();
    }
    // Solo desarrollo: mapa nuevo con la colocación inicial hecha al azar, listo para tirar.
    function quickGame() {
      ctx.dice.clear();
      buildBoard((Math.random() * 1e9) | 0);
      ctx.dice.resetStats();
      ctx.session.autoSetup(pickCentral); // la sesión juega la colocación con comandos legales; acá solo se elige dónde
      pull(); ctx.map.syncPieces(); ctx.hud.applyView();
      if (ctx.session.kick) ctx.session.kick().then(function (evs) { if (evs.length) ctx.replay.playEvents(evs); }); // si el primer turno es de un bot, que juegue
    }

    var debugSeed = /[?&]debug/.test(location.search) && /[?&]seed=(\d+)/.exec(location.search); // ?debug&seed=N: mapa fijo, para comparar capturas
    buildBoard(online ? (opts.seed || 1) : debugSeed ? +debugSeed[1] : (Date.now() & 0xffffff) | 1);
    lights.apply(1);
    startGame();

    // ------------------------------------------------------------------ bucle
    var clock = new THREE.Clock(), time = 0;
    function frame() {
      if (disposed) return; raf = requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05); time += dt;
      ctx.rig.update(dt);
      lights.apply(1 - Math.exp(-dt * 3.5));
      ctx.map.animate(dt, time, performance.now() / 1000);
      animateLantern(lantern, lights.lamps(), time);
      ctx.hud.placeConfirm();
      waterTex.offset.x = (time * 0.006) % 1; waterTex.offset.y = (time * 0.004) % 1;
      renderer.render(scene, camera);
    }
    frame();
  }
}
