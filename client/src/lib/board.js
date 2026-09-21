// @ts-nocheck
/* eslint-disable */
// Tablero 3D (three r128, JS plano). Nació de un prototipo HTML ya retirado del repo.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createAudio } from './audio.js';
// Motor de reglas (TypeScript puro): decide todo. Este archivo solo dibuja lo que la sesión le da (la vista del jugador)
// y le envía comandos; no aplica reglas ni conoce el estado completo. `topology` es geometría fija del tablero.
import { topology } from '../engine';
import { LocalSession } from './session';
import { drawBastos11, devCardURL } from './cardart';

export const MARKUP = `
<div id="stage">
  <div class="vignette"></div>

  <header class="panel title">
    <h1 class="logo"><span class="sr-only">Paisano</span></h1>
    <p class="tagline">Piedra y camino</p>
  </header>

  <div class="panel hover" id="hover" hidden></div>
  <div class="dice" id="dice" role="status" aria-live="polite" hidden></div>

  <!-- Qué toca hacer ahora (y errores de jugada) -->
  <div class="panel status" id="status" role="status" aria-live="polite"></div>

  <!-- Construir: cada botón activa el modo y muestra en el tablero dónde se puede. Costos como puntos de color del recurso. -->
  <section class="panel build" id="build" aria-label="Construir" hidden>
    <button type="button" data-build="road" title="Camino: 1 madera + 1 ladrillo">
      <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="12" width="26" height="8" rx="2" transform="rotate(-25 16 16)" fill="currentColor"/></svg>
      <span>Camino</span><span class="cost"><i style="--c:#3f8f45"></i><i style="--c:#c96a3b"></i></span>
    </button>
    <button type="button" data-build="settlement" title="Casa: 1 madera + 1 ladrillo + 1 vaca + 1 maíz">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 28V15L16 5l10 10v13z" fill="currentColor"/></svg>
      <span>Casa</span><span class="cost"><i style="--c:#3f8f45"></i><i style="--c:#c96a3b"></i><i style="--c:#a7d15c"></i><i style="--c:#e8bf45"></i></span>
    </button>
    <button type="button" data-build="city" title="Estancia: 2 maíz + 3 piedras (mejora una casa)">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 28V17l7-6 7 6v11zM17 28V12l6-8 6 8v16z" fill="currentColor"/></svg>
      <span>Estancia</span><span class="cost"><i style="--c:#e8bf45"></i><i style="--c:#e8bf45"></i><i style="--c:#8d949c"></i><i style="--c:#8d949c"></i><i style="--c:#8d949c"></i></span>
    </button>
    <button type="button" id="btnDev" title="Carta de desarrollo: 1 vaca + 1 maíz + 1 piedra">
      <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="3" width="18" height="26" rx="3.5" fill="none" stroke="currentColor" stroke-width="2.4" transform="rotate(-6 16 16)"/><polygon points="16,9 17.7,13.2 22,13.6 18.8,16.4 19.8,20.7 16,18.4 12.2,20.7 13.2,16.4 10,13.6 14.3,13.2" fill="currentColor" transform="rotate(-6 16 16)"/></svg>
      <span>Carta</span><span class="cost"><i style="--c:#a7d15c"></i><i style="--c:#e8bf45"></i><i style="--c:#8d949c"></i></span>
    </button>
    <button type="button" id="btnTrade" aria-pressed="false" title="Comerciar con el banco (4:1, o mejor con puertos)">
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11h20M19 5l6 6-6 6M27 21H7M13 15l-6 6 6 6"/></svg>
      <span>Comerciar</span><span class="cost"></span>
    </button>
    <button type="button" id="btnCards" aria-pressed="false" title="Tus cartas de desarrollo">
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="4" y="7" width="15" height="21" rx="3" transform="rotate(-12 11 17)"/><rect x="13" y="5" width="15" height="21" rx="3" transform="rotate(8 20 15)"/></svg>
      <span>Mis cartas</span><span class="cost"><b id="cardsN"></b></span>
    </button>
  </section>

  <!-- Botón único de turno: dados antes de tirar; flecha hacia el próximo jugador después. Lo arma board.js -->
  <button type="button" class="panel turn-btn" id="btnTurn" hidden></button>

  <!-- Descartar (con un 7) o elegir a quién robarle: se arma desde board.js -->
  <section class="panel dialog" id="dialog" role="dialog" aria-live="polite" hidden></section>

  <!-- Estadística de tiradas: una barra vertical por total (2 a 12) con la cantidad de veces que salió -->
  <section class="panel stats" id="stats" aria-label="Estadística de tiradas" hidden>
    <h2>Estadística <span id="statsN"></span></h2>
    <div class="chart" id="chart"></div>
  </section>

  <!-- Recursos del jugador (por ahora solo maqueta con cifras fijas; después se conecta al estado de la partida) -->
  <aside class="panel seats" id="seats" aria-label="Jugadores"></aside>
  <section class="panel hand" aria-label="Recursos del jugador 1">
    <div class="who" id="who"></div>
    <div class="res" style="--c:#3f8f45" title="Madera" data-res="forest">
      <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="21" y="28" width="6" height="14" fill="#7a4e2a"/><circle cx="14" cy="26" r="8" fill="#3f8f45"/><circle cx="34" cy="26" r="8" fill="#3f8f45"/><circle cx="24" cy="17" r="11" fill="#3f8f45"/></svg>
      <b>3</b>
    </div>
    <div class="res" style="--c:#c96a3b" title="Ladrillo" data-res="hills">
      <svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#c96a3b"><rect x="4" y="27" width="20" height="10"/><rect x="24" y="27" width="20" height="10"/><rect x="14" y="16" width="20" height="10"/></g></svg>
      <b>2</b>
    </div>
    <div class="res" style="--c:#a7d15c" title="Vaca" data-res="pasture">
      <svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="9" cy="14" rx="5" ry="2.8" transform="rotate(-15 9 14)" fill="#fff"/><ellipse cx="39" cy="14" rx="5" ry="2.8" transform="rotate(15 39 14)" fill="#fff"/><g fill="#f3b8b0" stroke="none"><ellipse cx="9" cy="14" rx="2.6" ry="1.2" transform="rotate(-15 9 14)"/><ellipse cx="39" cy="14" rx="2.6" ry="1.2" transform="rotate(15 39 14)"/></g><path d="M13 9 Q24 5 35 9 Q38 20 33 32 Q30 38 24 38 Q18 38 15 32 Q10 20 13 9Z" fill="#fff"/><ellipse cx="29.5" cy="14" rx="5" ry="5.5" fill="#2b2118" stroke="none"/><ellipse cx="24" cy="32" rx="9.5" ry="7" fill="#f3b8b0"/><g fill="#2b2118" stroke="none"><circle cx="18" cy="21" r="2.2"/><circle cx="30" cy="21" r="2.2"/><ellipse cx="20" cy="32" rx="1.4" ry="2"/><ellipse cx="28" cy="32" rx="1.4" ry="2"/></g></svg>
      <b>0</b>
    </div>
    <div class="res" style="--c:#e8bf45" title="Maíz" data-res="fields">
      <svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#4c9a3f"><path d="M24 43 L8 21 L20 32Z"/><path d="M24 43 L40 21 L28 32Z"/></g><ellipse cx="24" cy="22" rx="7" ry="16" fill="#f2c230"/></svg>
      <b>4</b>
    </div>
    <div class="res" style="--c:#8d949c" title="Piedra" data-res="mountains">
      <svg viewBox="0 0 48 48" aria-hidden="true"><polygon points="4,41 10,20 22,11 32,20 35,41" fill="#8d949c"/><polygon points="20,41 25,28 37,25 45,32 44,41" fill="#a9b0b8"/></svg>
      <b>1</b>
    </div>
  </section>

  <button type="button" class="panel menu-btn" id="btnMenu" aria-label="Menú" aria-controls="bar" aria-expanded="false">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  </button>
  <nav class="panel bar" id="bar" aria-label="Controles del tablero">
    <div class="group">
      <button type="button" id="btnNew" class="primary">Nuevo mapa</button>
      <button type="button" id="btnLeave" class="primary" title="Volver al menú (en una sala, la partida sigue: podés volver con el mismo link)">Salir al menú</button>
      <button type="button" id="btnQuick" class="primary" hidden title="Solo desarrollo: mapa nuevo con la colocación inicial hecha al azar, listo para tirar los dados">Partida rápida · dev</button>
    </div>
    <div class="group" role="group" aria-label="Sonido">
      <div class="vol">
        <button type="button" id="btnMute" class="mute" aria-label="Silenciar" aria-pressed="false">
          <svg id="volIcon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>
            <path class="w1" d="M16 9.5a3.5 3.5 0 0 1 0 5"/>
            <path class="w2" d="M18.5 7a7 7 0 0 1 0 10"/>
            <path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/>
          </svg>
        </button>
        <input type="range" id="volume" min="0" max="100" step="1" aria-label="Volumen">
      </div>
      <button type="button" id="btnAmbient" aria-pressed="true">Ambiente</button>
    </div>
    <div class="group" role="group" aria-label="Luz">
      <button type="button" data-light="day" aria-pressed="true">Día</button>
      <button type="button" data-light="dusk" aria-pressed="false">Atardecer</button>
      <button type="button" data-light="night" aria-pressed="false">Noche</button>
    </div>
    <div class="group">
      <button type="button" id="btnCenter" title="Volver a la vista por defecto">Centrar cámara</button>
      <button type="button" id="btnStats" aria-pressed="false" aria-controls="stats">Estadística</button>
    </div>
  </nav>

  <div class="err" id="err" hidden></div>
</div>
`;

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
    // ------------------------------------------------------------------ constantes
    var SQ3 = Math.sqrt(3);
    var TILE_TOP = 0.4;      // altura de la cara superior de las casillas
    var DECOR_HEIGHT = 0.38; // escala vertical del decorado (para no tapar fichas ni piezas)
    var DICE_BOUNCE = 0.12;  // altura del salto de la ficha al salir su número
    var WATER_Y = 0.16;      // nivel del mar
    var RC = 6.4;            // radio del marco (hexágono grande, vértices en ±x)
    var stage = document.getElementById('stage');

    // ------------------------------------------------------------------ utilidades
    function mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function shuffle(arr, rnd) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
    function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

    // ------------------------------------------------------------------ renderer / escena
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    stage.insertBefore(renderer.domElement, stage.firstChild);

    var scene = new THREE.Scene();
    scene.background = col(0xb9c9cf);
    scene.fog = new THREE.Fog(col(0xb9c9cf), 24, 70);

    var camera = new THREE.PerspectiveCamera(35, 1, 0.5, 200);
    // Arranca con el tablero bien encuadrado y una inclinación de ~30° respecto de la vertical (a distancia ~17) para que
    // se note el 3D antes de mover nada. El norte del tablero queda hacia arriba de la pantalla.
    camera.position.set(0, 14.9, 8.5);

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 30;
    controls.minPolarAngle = 0; // permite volver a la vista cenital; se puede inclinar hasta maxPolarAngle
    controls.maxPolarAngle = 1.3;
    // vista por defecto (botón "Centrar"): vuelve con una transición suave; si el usuario toca la cámara se cancela
    var HOME_POS = camera.position.clone(), HOME_TARGET = controls.target.clone(), homing = false;
    controls.addEventListener('start', function () { homing = false; });
    // Fin de la partida: la cámara gira sola, muy despacio y cambiando de altura y de distancia. Si el usuario toca el tablero se
    // detiene y retoma a los pocos segundos. Con una partida nueva (o cualquier estado no terminado) vuelve a la vista de siempre.
    var orbit = { on: false, resumeAt: 0, t: 0 }, orbitSph = new THREE.Spherical(), orbitOff = new THREE.Vector3();
    function setOrbit(on) {
      if (orbit.on === on) return;
      orbit.on = on; orbit.t = 0; orbit.resumeAt = 0;
      homing = !on; // al cortarla, la cámara vuelve suavemente a la vista inicial
    }
    controls.addEventListener('start', function () { orbit.resumeAt = Infinity; });
    controls.addEventListener('end', function () { orbit.resumeAt = performance.now() + 6000; });

    // ------------------------------------------------------------------ materiales
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
    function mesh(geo, mat, cast, receive) {
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = cast !== false; m.receiveShadow = receive !== false;
      return m;
    }

    // ------------------------------------------------------------------ mapa de entorno (reflejos suaves)
    try {
      var envScene = new THREE.Scene();
      var skyGeo = new THREE.SphereGeometry(50, 24, 16);
      var pos = skyGeo.attributes.position, colors = [];
      var cTop = col(0xcfe4ff), cMid = col(0xf5efe4), cBot = col(0x76674f), tmp = new THREE.Color();
      for (var i = 0; i < pos.count; i++) {
        var y = pos.getY(i) / 50;
        if (y > 0) tmp.copy(cMid).lerp(cTop, Math.pow(y, 0.6)); else tmp.copy(cMid).lerp(cBot, Math.min(1, -y * 1.6));
        colors.push(tmp.r, tmp.g, tmp.b);
      }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      var pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(envScene).texture;
      pm.dispose();
    } catch (e) { console.warn('Sin mapa de entorno:', e.message); }

    // ------------------------------------------------------------------ luces
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

    var PRESETS = {
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
    var cur = presetState(PRESETS.day), tar = presetState(PRESETS.day);
    var lastEnv = -1, pieceHSL = { h: 0, s: 0, l: 0 };
    function applyLight(k) {
      cur.bg.lerp(tar.bg, k); cur.sun.lerp(tar.sun, k); cur.sky.lerp(tar.sky, k); cur.ground.lerp(tar.ground, k);
      cur.sunPos.lerp(tar.sunPos, k);
      cur.sunI += (tar.sunI - cur.sunI) * k; cur.hemiI += (tar.hemiI - cur.hemiI) * k;
      cur.env += (tar.env - cur.env) * k; cur.exp += (tar.exp - cur.exp) * k; cur.lamps += (tar.lamps - cur.lamps) * k;
      cur.pieceK += (tar.pieceK - cur.pieceK) * k; cur.pieceS += (tar.pieceS - cur.pieceS) * k; cur.pieceEm += (tar.pieceEm - cur.pieceEm) * k;
      for (var pi = 0; pi < PLAYERS.length; pi++) {
        var pm = PLAYERS[pi];
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

    // ------------------------------------------------------------------ texturas procedurales
    function blobs(ctx, w, h, n, cols, rmin, rmax, alpha, r) {
      for (var i = 0; i < n; i++) {
        ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.beginPath();
        var rr = rmin + r() * (rmax - rmin);
        ctx.ellipse(r() * w, r() * h, rr, rr * (0.55 + r() * 0.4), r() * 3.14, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function terrainCanvas(kind) {
      var w = 256, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(kind.length * 977 + 13), i, y, x;
      var base = { forest: '#3f8f45', pasture: '#a7d15c', fields: '#e8bf45', hills: '#c96a3b', mountains: '#8d949c', desert: '#e3c78d' }[kind];
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, w);
      if (kind === 'forest') blobs(ctx, w, w, 420, ['#2f7a3a', '#4aa050', '#357f3f', '#5cb05a'], 3, 14, 0.5, r);
      if (kind === 'pasture') blobs(ctx, w, w, 420, ['#95c44c', '#b8e06c', '#8bbb45', '#c6e98a'], 3, 16, 0.5, r);
      if (kind === 'fields') {
        for (i = 0; i < 26; i++) { ctx.fillStyle = i % 2 ? '#d9ab30' : '#f2cf64'; ctx.globalAlpha = 0.55; ctx.fillRect(0, i * 10, w, 5); }
        ctx.globalAlpha = 1; blobs(ctx, w, w, 200, ['#e0b23a', '#f6d777'], 2, 9, 0.35, r);
      }
      if (kind === 'hills') {
        for (i = 0; i < 22; i++) { ctx.strokeStyle = i % 2 ? '#b25428' : '#dc8355'; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.beginPath(); y = i * 12 + 6; ctx.moveTo(0, y); for (x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 26 + i) * 3); ctx.stroke(); }
        ctx.globalAlpha = 1; blobs(ctx, w, w, 260, ['#b85a30', '#d9794a', '#a9502c'], 2, 10, 0.4, r);
      }
      if (kind === 'mountains') blobs(ctx, w, w, 480, ['#7b828b', '#9fa6ae', '#6f757d', '#b3b9c0'], 2, 12, 0.5, r);
      if (kind === 'desert') {
        for (i = 0; i < 20; i++) { ctx.strokeStyle = i % 2 ? '#d2b16c' : '#f0dcaa'; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.beginPath(); y = i * 13 + 7; ctx.moveTo(0, y); for (x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x / 20 + i * 1.7) * 4); ctx.stroke(); }
        ctx.globalAlpha = 1; blobs(ctx, w, w, 220, ['#d8b97a', '#efd9a3', '#cfae6e'], 2, 9, 0.35, r);
      }
      return c;
    }
    function woodCanvas(base, dark, light, seed) {
      var w = 512, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(seed), i, x;
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, w);
      for (i = 0; i < 260; i++) {
        var y = r() * w, amp = 1 + r() * 4, ph = r() * 6, f = Math.floor(1 + r() * 3);
        ctx.strokeStyle = r() > 0.5 ? dark : light; ctx.globalAlpha = 0.08 + r() * 0.22; ctx.lineWidth = 0.6 + r() * 2.4;
        ctx.beginPath(); ctx.moveTo(0, y);
        for (x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / w * 6.2832 * f + ph) * amp);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return c;
    }
    function waterCanvas() {
      var w = 512, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(4242), i, x;
      // Fondo de un solo color (el promedio del degradado anterior). La textura se repite cada 4.2 unidades sobre el mar:
      // un degradado no encaja consigo mismo y dejaba costuras visibles en forma de "bloques".
      ctx.fillStyle = '#2881b3'; ctx.fillRect(0, 0, w, w);
      for (i = 0; i < 110; i++) {
        var y0 = r() * w, amp = 3 + r() * 7, f = Math.floor(2 + r() * 3), ph = r() * 6, len = 90 + r() * 200, x0 = r() * w;
        ctx.strokeStyle = r() > 0.45 ? '#a6dcf0' : '#1c6494';
        ctx.globalAlpha = 0.16 + r() * 0.22; ctx.lineWidth = 1.5 + r() * 2.5; ctx.lineCap = 'round';
        for (var dy = -w; dy <= w; dy += w) for (var dx = -w; dx <= w; dx += w) {
          ctx.beginPath();
          for (x = 0; x <= len; x += 10) {
            var px = x0 + x + dx, py = y0 + dy + Math.sin((x0 + x) / w * 6.2832 * f + ph) * amp;
            if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      return c;
    }

    // ------------------------------------------------------------------ mesa, marco y mar (estáticos)
    var table = mesh(new THREE.PlaneGeometry(140, 140), M(0xffffff, 0.75, 0, { env: 0.2, map: tex(woodCanvas('#6a4a2e', '#3f2a17', '#8c6a45', 11), 14, 14) }), false, true);
    table.rotation.x = -Math.PI / 2; table.position.y = -0.01;
    scene.add(table);

    function hexPath(P, r) {
      var p = new P();
      for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3, x = r * Math.cos(a), y = r * Math.sin(a); if (i) p.lineTo(x, y); else p.moveTo(x, y); }
      p.closePath();
      return p;
    }
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

    // ------------------------------------------------------------------ objetos gauchos sobre la mesa (fuera del marco)
    // Puro adorno: mate con bombilla, pava de hierro, mazo de cartas españolas y facón. Se ven al alejar la cámara.
    function place(g, x, z, rotY) { g.position.set(x, 0, z); g.rotation.y = rotY || 0; scene.add(g); return g; }

    // Números pseudoaleatorios con semilla: el mate se ve siempre igual (las texturas y las hojuelas no cambian entre cargas).
    function seeded(seed) { var a = seed | 0; return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

    // Piel de calabaza: marrón con manchas suaves, vetas finas, puntitos y rayones de uso. Las manchas se repiten a los lados
    // para que la costura de la vuelta no se note.
    function gourdCanvas() {
      var W = 512, H = 256, c = makeCanvas(W, H), x = c.getContext('2d'), rnd = seeded(11), i, k;
      x.fillStyle = '#7c5127'; x.fillRect(0, 0, W, H);
      for (i = 0; i < 260; i++) {
        var bx = rnd() * W, by = rnd() * H, br = 8 + rnd() * 46, dark = rnd() < 0.55;
        for (k = -1; k <= 1; k++) {
          var g = x.createRadialGradient(bx + k * W, by, 0, bx + k * W, by, br);
          g.addColorStop(0, dark ? 'rgba(70,40,14,' + (0.1 + rnd() * 0.16) + ')' : 'rgba(190,130,70,' + (0.08 + rnd() * 0.12) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g; x.fillRect(bx + k * W - br, by - br, br * 2, br * 2);
        }
      }
      for (i = 0; i < 5200; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(50,28,10,' + (0.1 + rnd() * 0.2) + ')' : 'rgba(210,160,100,' + (0.08 + rnd() * 0.14) + ')'; x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.6, 1 + rnd() * 1.6); }
      x.lineCap = 'round';
      for (i = 0; i < 46; i++) { // vetas y rayones de tanto uso
        var sx = rnd() * W, sy = rnd() * H, len = 14 + rnd() * 60, an = rnd() * Math.PI;
        x.strokeStyle = rnd() < 0.6 ? 'rgba(45,25,8,' + (0.12 + rnd() * 0.16) + ')' : 'rgba(215,165,105,' + (0.1 + rnd() * 0.1) + ')'; x.lineWidth = 0.6 + rnd() * 1.1;
        x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + Math.cos(an) * len * 0.5 + rnd() * 6, sy + Math.sin(an) * len * 0.5 + rnd() * 6, sx + Math.cos(an) * len, sy + Math.sin(an) * len); x.stroke();
      }
      return c;
    }

    // Yerba vista de arriba: fondo oscuro (los huecos entre hojas) cubierto de hojuelas irregulares, de verde oliva a marrón,
    // con algún palito claro. El mismo lienzo sirve de relieve para que cada hojuela tenga su borde.
    function yerbaCanvas() {
      var S = 512, c = makeCanvas(S, S), x = c.getContext('2d'), rnd = seeded(23), i;
      x.fillStyle = '#48561a'; x.fillRect(0, 0, S, S);
      var pal = ['#6f8231', '#7f9038', '#5d6f24', '#8d9a43', '#4d5e1c', '#93a04a', '#6a5a2c', '#7a6a34', '#a3ac5c', '#566a20'];
      for (i = 0; i < 6200; i++) {
        var px = rnd() * S, py = rnd() * S, len = 3 + rnd() * rnd() * 16, wid = 1.6 + rnd() * 3.4, an = rnd() * Math.PI, stem = rnd() < 0.06;
        x.save(); x.translate(px, py); x.rotate(an);
        if (stem) { x.fillStyle = 'rgba(190,180,110,.9)'; x.fillRect(-len * 0.7, -0.7, len * 1.4, 1.4); }
        else {
          x.beginPath(); x.moveTo(-len / 2, 0); x.quadraticCurveTo(-len * 0.15, -wid, len / 2, -wid * 0.2 * (rnd() - 0.3)); x.quadraticCurveTo(len * 0.1, wid * 0.9, -len / 2, 0); x.closePath();
          x.fillStyle = pal[(rnd() * pal.length) | 0]; x.fill();
          x.strokeStyle = 'rgba(25,32,8,.55)'; x.lineWidth = 0.6; x.stroke();
          if (len > 8) { x.strokeStyle = 'rgba(200,205,120,.28)'; x.beginPath(); x.moveTo(-len * 0.4, 0); x.lineTo(len * 0.4, 0); x.stroke(); } // nervadura
        }
        x.restore();
      }
      for (i = 0; i < 900; i++) { x.fillStyle = 'rgba(' + (150 + rnd() * 50 | 0) + ',' + (155 + rnd() * 40 | 0) + ',' + (80 + rnd() * 40 | 0) + ',.55)'; x.fillRect(rnd() * S, rnd() * S, 1, 1); } // polvillo
      return c;
    }

    function makeMate() {
      var g = new THREE.Group(), rnd = seeded(5), i;
      var gTex = tex(gourdCanvas(), 1, 1);
      var gourd = M(0xffffff, 0.62, 0, { env: 0.4, map: gTex });
      var silver = M(0xd3d8de, 0.32, 0.9, { env: 1.0 }), gold = M(0xc9a15a, 0.3, 0.9, { env: 0.9 });
      // Calabaza: pie chico, panza redonda y cuello más cerrado. La boca queda dentro de la virola de metal (sube hasta y = 0.52).
      var prof = [[0, 0], [0.13, 0], [0.15, 0.02], [0.163, 0.06], [0.2, 0.09], [0.265, 0.15], [0.318, 0.23], [0.34, 0.31], [0.335, 0.39], [0.305, 0.46], [0.268, 0.52],
        [0.25, 0.52], [0.238, 0.46], [0.246, 0.36], [0.215, 0.26], [0.13, 0.19], [0, 0.18]]; // afuera hacia arriba, y después la pared interior
      g.add(mesh(new THREE.LatheGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40), gourd));
      // Virola: banda ancha de acero cepillado en la boca, con el borde enrollado hacia adentro, y un aro fino en la base.
      var band = [[0.268, 0.49], [0.276, 0.5], [0.277, 0.62], [0.271, 0.636], [0.258, 0.64], [0.247, 0.632], [0.246, 0.5]];
      var bandM = mesh(new THREE.LatheGeometry(band.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40), silver); bandM.material.side = THREE.DoubleSide; g.add(bandM);
      var seam = mesh(new THREE.TorusGeometry(0.276, 0.005, 6, 40), M(0x3a3d42, 0.5, 0.6, { env: 0.4 })); seam.rotation.x = Math.PI / 2; seam.position.y = 0.492; g.add(seam);
      var base = mesh(new THREE.TorusGeometry(0.157, 0.02, 8, 32), silver); base.rotation.x = Math.PI / 2; base.position.y = 0.035; g.add(base);

      // Yerba: MISMA montañita de antes. Alta del lado contrario a la bombilla (+x), baja junto a ella (-x), con el pozo casi al medio
      // (más oscuro y húmedo) pegado al caño. Ahora con textura de hojuelas, relieve y hojuelas sueltas en 3D para el borde.
      var YR = 0.246, YB = 0.52, YT = 0.595, PX = -0.1, PIT = 0.095;           // radio, altura junto a la bombilla, altura del lado alto y profundidad del pozo
      function ySurf(vx, vz) {
        var pd = Math.exp(-Math.pow(Math.hypot(vx - PX, vz) / 0.105, 2));
        var bump = 0.006 * Math.sin(vx * 61 + vz * 23) * Math.cos(vz * 47 - vx * 17) + 0.004 * Math.sin(vx * 113 - vz * 89);
        return YB + (YT - YB) * (vx + YR) / (2 * YR) - PIT * pd + bump * (1 - 0.6 * pd);
      }
      var yR = [], ri;
      for (ri = 0; ri <= 16; ri++) yR.push(new THREE.Vector2(YR * (1 - ri / 16), 0)); // de afuera hacia el centro: normales hacia arriba
      var yGeo = new THREE.LatheGeometry(yR, 48), yp = yGeo.attributes.position, yc = [], yuv = [];
      var dry = col(0xe6e6c4), wet = col(0x7c8a54);
      for (var vi = 0; vi < yp.count; vi++) {
        var vx = yp.getX(vi), vz = yp.getZ(vi);
        var pd = Math.exp(-Math.pow(Math.hypot(vx - PX, vz) / 0.105, 2));
        yp.setY(vi, ySurf(vx, vz));
        var cc = dry.clone().lerp(wet, Math.min(1, pd * 1.4)); yc.push(cc.r, cc.g, cc.b); // el pozo se ve más húmedo y oscuro
        yuv.push(vx / (2 * YR) * 0.92 + 0.5, vz / (2 * YR) * 0.92 + 0.5);
      }
      yGeo.setAttribute('color', new THREE.Float32BufferAttribute(yc, 3)); yGeo.setAttribute('uv', new THREE.Float32BufferAttribute(yuv, 2)); yGeo.computeVertexNormals();
      var yTex = tex(yerbaCanvas(), 1, 1);
      var yMat = M(0xffffff, 0.95, 0, { env: 0.1, map: yTex }); yMat.vertexColors = true;
      yMat.bumpMap = yTex; yMat.bumpScale = 1.4;
      g.add(mesh(yGeo, yMat, false, true));
      // hojuelas sueltas: chiquitas y planas, en cualquier ángulo; hacen que el borde y la silueta se vean de grano y no de pasta
      var N = 1300, flakeGeo = new THREE.BoxGeometry(0.014, 0.0014, 0.006);
      var flakeMat = M(0xffffff, 0.9, 0, { env: 0.1 });
      var flakes = new THREE.InstancedMesh(flakeGeo, flakeMat, N), dm = new THREE.Object3D(), fp = [0x4f5f26, 0x5b6c2e, 0x445320, 0x66743a, 0x3a481a, 0x54462a, 0x74803f], fc = new THREE.Color();
      for (i = 0; i < N; i++) {
        var a = rnd() * Math.PI * 2, r = (YR - 0.006) * Math.sqrt(rnd()), fx = Math.cos(a) * r, fz = Math.sin(a) * r, s = 0.6 + rnd() * 0.9;
        dm.position.set(fx, ySurf(fx, fz) + 0.002, fz);
        dm.rotation.set((rnd() - 0.5) * 0.9, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.9);
        dm.scale.set(s, 1, s * (0.7 + rnd() * 0.6)); dm.updateMatrix();
        flakes.setMatrixAt(i, dm.matrix); flakes.setColorAt(i, fc.copy(col(fp[(rnd() * fp.length) | 0])));
      }
      flakes.castShadow = false; flakes.receiveShadow = false; g.add(flakes);

      // Bombilla: caño de acero curvado arriba con la boquilla aplastada, tres aros dorados y el filtro abajo, dentro del pozo.
      var b = new THREE.Group();
      var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.006, 0.2, 0), new THREE.Vector3(-0.018, 0.4, 0), new THREE.Vector3(-0.04, 0.55, 0), new THREE.Vector3(-0.085, 0.635, 0), new THREE.Vector3(-0.125, 0.66, 0)]);
      b.add(mesh(new THREE.TubeGeometry(curve, 36, 0.0125, 10, false), silver));
      var filter = mesh(new THREE.SphereGeometry(0.043, 14, 10), silver); filter.scale.set(1, 0.62, 1); b.add(filter);
      var neck = mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.05, 12), silver); neck.position.y = 0.04; b.add(neck);
      [0.5, 0.526, 0.552].forEach(function (t) { // aros: perpendiculares al caño en ese punto
        var u = t / 0.66, pt = curve.getPointAt(Math.min(0.99, u)), tg = curve.getTangentAt(Math.min(0.99, u));
        var ring = mesh(new THREE.TorusGeometry(0.0155, 0.0045, 6, 14), gold); ring.position.copy(pt);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg); b.add(ring);
      });
      var tip = curve.getPointAt(1), tipDir = curve.getTangentAt(1);
      var mouth = mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.035, 10), silver); mouth.scale.set(1.5, 1, 0.55); // boquilla aplastada
      mouth.position.copy(tip).addScaledVector(tipDir, 0.012); mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir); b.add(mouth);
      b.position.set(PX - 0.005, 0.315, 0); b.rotation.z = 0.14; // apoyada contra la pared de la calabaza, inclinada hacia -x; el pico curva hacia afuera
      g.add(b);
      return g;
    }

    function makePava() {
      var g = new THREE.Group();
      var iron = M(0x2a2a2f, 0.55, 0.55, { env: 0.6 });
      var prof = [[0, 0], [0.48, 0], [0.62, 0.08], [0.67, 0.28], [0.6, 0.52], [0.42, 0.7], [0.3, 0.76], [0.3, 0.8], [0, 0.8]];
      g.add(mesh(new THREE.LatheGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 28), iron));
      var lid = mesh(new THREE.SphereGeometry(0.29, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron); lid.scale.y = 0.55; lid.position.y = 0.78; g.add(lid);
      var knob = mesh(new THREE.SphereGeometry(0.06, 10, 8), iron); knob.position.y = 0.96; g.add(knob);
      var spoutGeo = new THREE.CylinderGeometry(0.06, 0.12, 0.8, 12); spoutGeo.translate(0, 0.4, 0);
      var spout = mesh(spoutGeo, iron); spout.position.set(0.5, 0.2, 0); spout.rotation.z = -1.0; g.add(spout);
      var arch = mesh(new THREE.TorusGeometry(0.56, 0.035, 8, 26, Math.PI), iron); arch.rotation.y = Math.PI / 2; arch.position.y = 0.6; g.add(arch);
      var grip = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), M(0x5a3a1e, 0.8, 0, { env: 0.2 })); grip.rotation.x = Math.PI / 2; grip.position.y = 1.16; g.add(grip);
      return g;
    }

    // Baraja española: frente con palo (oro, copa, espada, basto) y dorso a rombos.
    function cardFaceCanvas(suit, num) {
      if (suit === 'bastos' && num === 11) { // el caballero: lámina propia, más grande para que se vea nítida (cardart.js)
        var big = makeCanvas(512, 800), bx = big.getContext('2d'); bx.scale(4, 4); drawBastos11(bx); // el dibujo propio queda de respaldo
        var img = new Image(); // la lámina definitiva (public/cartas/11-de-bastos.png) reemplaza al dibujo cuando termina de cargar
        img.onload = function () {
          bx.setTransform(1, 0, 0, 1, 0, 0); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
          bx.drawImage(img, 0, 0, big.width, big.height);
          if (big.__tex) big.__tex.needsUpdate = true;
        };
        img.src = '/cartas/11-de-bastos.png';
        return big;
      }
      var c = makeCanvas(128, 200), x = c.getContext('2d');
      x.fillStyle = '#f4ead2'; x.fillRect(0, 0, 128, 200);
      x.strokeStyle = '#7a5a2a'; x.lineWidth = 4; x.strokeRect(6, 6, 116, 188);
      x.fillStyle = '#3a2a16'; x.font = 'bold 26px Georgia, serif'; x.textAlign = 'left'; x.fillText(String(num), 14, 36);
      x.textAlign = 'right'; x.fillText(String(num), 114, 188);
      x.save(); x.translate(64, 100); x.lineWidth = 3;
      if (suit === 'oros') {
        x.fillStyle = '#e2b33c'; x.strokeStyle = '#8a5f10'; x.beginPath(); x.arc(0, 0, 38, 0, 6.2832); x.fill(); x.stroke();
        x.beginPath(); x.arc(0, 0, 24, 0, 6.2832); x.stroke(); x.fillStyle = '#f3d77a'; x.beginPath(); x.arc(0, 0, 12, 0, 6.2832); x.fill(); x.stroke();
      } else if (suit === 'copas') {
        x.fillStyle = '#c23b3b'; x.strokeStyle = '#5a1414';
        x.beginPath(); x.moveTo(-34, -40); x.lineTo(34, -40); x.quadraticCurveTo(30, 12, 0, 14); x.quadraticCurveTo(-30, 12, -34, -40); x.fill(); x.stroke();
        x.fillRect(-5, 14, 10, 32); x.strokeRect(-5, 14, 10, 32);
        x.beginPath(); x.ellipse(0, 50, 26, 8, 0, 0, 6.2832); x.fill(); x.stroke();
      } else if (suit === 'espadas') {
        x.fillStyle = '#cfd6dd'; x.strokeStyle = '#2b3138';
        x.beginPath(); x.moveTo(0, -70); x.lineTo(11, -46); x.lineTo(9, 30); x.lineTo(-9, 30); x.lineTo(-11, -46); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#c9a23a'; x.fillRect(-30, 30, 60, 10); x.strokeRect(-30, 30, 60, 10);
        x.fillStyle = '#5a3a1e'; x.fillRect(-6, 40, 12, 28); x.strokeRect(-6, 40, 12, 28);
      } else {
        x.rotate(-0.5); x.fillStyle = '#7a4a1e'; x.strokeStyle = '#3a220b';
        x.beginPath(); x.moveTo(-14, -66); x.lineTo(14, -66); x.lineTo(20, 40); x.quadraticCurveTo(0, 70, -20, 40); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#3f8f45'; x.beginPath(); x.arc(-22, -14, 10, 0, 6.2832); x.arc(22, 6, 10, 0, 6.2832); x.fill();
      }
      x.restore();
      return c;
    }
    function cardBackCanvas() {
      var c = makeCanvas(128, 200), x = c.getContext('2d');
      x.fillStyle = '#8f2a2a'; x.fillRect(0, 0, 128, 200);
      x.strokeStyle = '#e8d6a0'; x.lineWidth = 2;
      for (var i = -200; i < 260; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 200, 200); x.moveTo(i + 200, 0); x.lineTo(i, 200); x.stroke(); }
      x.lineWidth = 8; x.strokeStyle = '#f4ead2'; x.strokeRect(4, 4, 120, 192);
      return c;
    }
    function makeCards() {
      var g = new THREE.Group(), CW = 0.9, CL = 1.4, cream = M(0xf4ead2, 0.7, 0, { env: 0.2 });
      var deck = mesh(new THREE.BoxGeometry(CW, 0.3, CL), [cream, cream, M(0xffffff, 0.7, 0, { env: 0.2, map: tex(cardBackCanvas()) }), cream, cream, cream]);
      deck.position.set(0.55, 0.15, 0.3); deck.rotation.y = 0.2; g.add(deck);
      var hand = [['espadas', 1], ['oros', 7], ['copas', 12], ['bastos', 11]];
      hand.forEach(function (h, i) {
        var f = new THREE.Group();
        var card = mesh(new THREE.BoxGeometry(CW, 0.02, CL), [cream, cream, M(0xffffff, 0.7, 0, { env: 0.2, map: tex(cardFaceCanvas(h[0], h[1])) }), cream, cream, cream]);
        card.position.set(0, 0.011 + i * 0.024, -0.6);
        f.add(card); f.position.set(-0.75, 0, 0.9); f.rotation.y = (i - 1.5) * 0.3;
        g.add(f);
      });
      return g;
    }

    // Hoja del facón vista de arriba (textura de la chapa plana: u = largo, v = ancho, con el filo abajo y el lomo arriba):
    // acero liso y opaco, filo fino y más claro (afilado), lomo algo más oscuro, algunas manchas grises y unas pocas grietas finas. Sin óxido.
    function faconCanvas() {
      var W = 1024, H = 160, c = makeCanvas(W, H), x = c.getContext('2d'), rnd = seeded(31), i, k;
      var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8f979f'); g.addColorStop(0.3, '#b7bec6'); g.addColorStop(0.8, '#c6ccd3'); g.addColorStop(1, '#dde2e7');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      for (i = 0; i < 1100; i++) { // rayitas de afilado y de uso, en el sentido de la hoja
        var y = rnd() * H, len = 30 + rnd() * 260, sx = rnd() * W;
        x.strokeStyle = rnd() < 0.5 ? 'rgba(235,240,245,' + (0.05 + rnd() * 0.1) + ')' : 'rgba(50,58,68,' + (0.05 + rnd() * 0.1) + ')'; x.lineWidth = 0.5 + rnd() * 0.8;
        x.beginPath(); x.moveTo(sx, y); x.lineTo(sx + len, y + (rnd() - 0.5) * 1.4); x.stroke();
      }
      // pátina: zonas más oscuras y apagadas, sobre todo hacia el lomo y la base
      for (i = 0; i < 40; i++) {
        var px = rnd() * W, py = rnd() * H * 0.8, pr = 20 + rnd() * 80, pg = x.createRadialGradient(px, py, 0, px, py, pr);
        pg.addColorStop(0, 'rgba(60,64,60,' + (0.1 + rnd() * 0.14) + ')'); pg.addColorStop(1, 'rgba(60,64,60,0)');
        x.fillStyle = pg; x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
      // manchas: zonas grisáceas y opacas, suaves (de uso, no de óxido)
      for (i = 0; i < 26; i++) {
        var rx = rnd() * W, ry = rnd() * H * 0.85, rr = 10 + rnd() * 50, rg = x.createRadialGradient(rx, ry, 0, rx, ry, rr);
        rg.addColorStop(0, 'rgba(84,88,86,' + (0.12 + rnd() * 0.16) + ')'); rg.addColorStop(1, 'rgba(84,88,86,0)');
        x.fillStyle = rg; x.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
      }
      for (i = 0; i < 110; i++) { x.fillStyle = 'rgba(62,64,64,' + (0.25 + rnd() * 0.3) + ')'; x.beginPath(); x.arc(rnd() * W, rnd() * H * 0.9, 0.5 + rnd() * 1.1, 0, Math.PI * 2); x.fill(); } // puntitos de uso
      x.lineCap = 'round'; x.lineJoin = 'round';
      for (i = 0; i < 10; i++) { // grietas finas: cortas y quebradas, con un reflejo claro al lado
        var cx0 = rnd() * W * 0.9, cy0 = H * (0.12 + rnd() * 0.65), pts = [[cx0, cy0]], n = 4 + (rnd() * 5 | 0);
        for (k = 1; k <= n; k++) pts.push([pts[k - 1][0] + 4 + rnd() * 10, pts[k - 1][1] + (rnd() - 0.5) * 8]);
        x.strokeStyle = 'rgba(40,44,48,.7)'; x.lineWidth = 0.9; x.beginPath(); pts.forEach(function (q, j) { if (j) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); }); x.stroke();
        x.strokeStyle = 'rgba(240,244,248,.45)'; x.lineWidth = 0.6; x.beginPath(); pts.forEach(function (q, j) { if (j) x.lineTo(q[0], q[1] + 1.2); else x.moveTo(q[0], q[1] + 1.2); }); x.stroke();
      }
      var edgeG = x.createLinearGradient(0, H * 0.86, 0, H); edgeG.addColorStop(0, 'rgba(255,255,255,0)'); edgeG.addColorStop(0.6, 'rgba(250,252,255,.7)'); edgeG.addColorStop(1, 'rgba(200,208,216,.9)');
      x.fillStyle = edgeG; x.fillRect(0, H * 0.86, W, H * 0.14); // filo: franja fina y brillante (es lo que está afilado y no se oxida)
      x.fillStyle = 'rgba(45,52,60,.6)'; x.fillRect(0, H - 1.5, W, 1.5);
      x.fillStyle = 'rgba(50,56,62,.45)'; x.fillRect(0, 0, W, H * 0.05); // lomo
      for (i = 0; i < 14; i++) { x.fillStyle = 'rgba(60,44,32,.75)'; x.fillRect(rnd() * W, H - 5 - rnd() * 3, 2 + rnd() * 5, 4); } // mellitas en el filo
      return c;
    }

    function makeFacon() {
      var g = new THREE.Group();
      var bTex = tex(faconCanvas(), 1 / 1.78, 1 / 0.17); bTex.offset.set(0, 0.5); // v = 0 en el filo (y = -0.085) y 1 en el lomo
      var steel = M(0xffffff, 0.5, 0.7, { env: 0.8, map: bTex }), brass = M(0xc9a23a, 0.35, 0.8, { env: 0.8 }), wood = M(0x4a2c17, 0.7, 0, { env: 0.25 });
      var s = new THREE.Shape();
      s.moveTo(0, -0.085); s.lineTo(1.1, -0.085); s.quadraticCurveTo(1.5, -0.07, 1.78, 0.03); s.quadraticCurveTo(1.55, 0.075, 1.35, 0.085); s.lineTo(0, 0.085); s.closePath(); // filo recto que sube a la punta y lomo con contrafilo
      var bladeGeo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }); // chapa plana y fina: el filo, las manchas y las grietas van pintados en la textura
      bladeGeo.rotateX(-Math.PI / 2);
      var blade = mesh(bladeGeo, steel); blade.position.y = 0.057; g.add(blade); // centrada en el eje del mango
      // guarda: barra con las puntas redondeadas, y un tope de bronce sobre la hoja
      var guard = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), brass); guard.position.set(-0.02, 0.06, 0); g.add(guard);
      [-0.2, 0.2].forEach(function (pz) { var e = mesh(new THREE.SphereGeometry(0.038, 12, 10), brass); e.position.set(-0.02, 0.06, pz); g.add(e); });
      var stop = mesh(new THREE.BoxGeometry(0.05, 0.07, 0.15), brass); stop.position.set(0.03, 0.065, 0); g.add(stop);
      // empuñadura: madera oscura y cuatro anillos de bronce
      var hGeo = new THREE.CylinderGeometry(0.052, 0.07, 0.78, 14); hGeo.rotateZ(Math.PI / 2);
      var handle = mesh(hGeo, wood); handle.position.set(-0.43, 0.07, 0); g.add(handle);
      [-0.16, -0.32, -0.54, -0.72].forEach(function (px) {
        var ring = mesh(new THREE.TorusGeometry(px < -0.5 ? 0.068 : 0.059, 0.011, 6, 16), brass); ring.rotation.y = Math.PI / 2; ring.position.set(px, 0.07, 0); g.add(ring);
      });
      var pommel = mesh(new THREE.SphereGeometry(0.085, 14, 10), brass); pommel.position.set(-0.84, 0.07, 0); g.add(pommel);
      return g;
    }

    // Farol de campo: base y tapa de hierro, depósito de kerosén, tubo de vidrio con llama y jaula de alambre.
    // De noche (y algo al atardecer) la llama se enciende: crece, titila y alumbra la mesa (ver `frame`).
    var lantern = null;
    function makeLantern() {
      var g = new THREE.Group();
      var iron = M(0x2a2a2f, 0.55, 0.55, { env: 0.6 }), brass = M(0xb08a3a, 0.4, 0.8, { env: 0.8 });
      var glass = M(0xcfe8f0, 0.1, 0, { env: 0.9 }); glass.transparent = true; glass.opacity = 0.3; glass.depthWrite = false; glass.side = THREE.DoubleSide;
      var foot = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.08, 20), iron); foot.position.y = 0.04; g.add(foot);
      var tank = mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.17, 20), brass); tank.position.y = 0.165; g.add(tank);
      var knob = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), brass); knob.rotation.z = Math.PI / 2; knob.position.set(0.3, 0.17, 0); g.add(knob);
      var gl = [[0.16, 0.25], [0.24, 0.4], [0.27, 0.6], [0.2, 0.85], [0.17, 1.0]];
      g.add(mesh(new THREE.LatheGeometry(gl.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 20), glass, false, false));
      for (var i = 0; i < 4; i++) {
        var a = i * Math.PI / 2 + Math.PI / 4, bar = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.78, 6), iron);
        bar.position.set(Math.cos(a) * 0.255, 0.63, Math.sin(a) * 0.255); g.add(bar);
      }
      var cap = mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.1, 20), iron); cap.position.y = 1.03; g.add(cap);
      var dome = mesh(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron); dome.scale.y = 0.55; dome.position.y = 1.08; g.add(dome);
      var vent = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), iron); vent.position.y = 1.23; g.add(vent);
      var ring = mesh(new THREE.TorusGeometry(0.13, 0.017, 6, 20), iron); ring.position.y = 1.32; g.add(ring);
      var wick = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 6), M(0x1b1712, 0.9, 0, { env: 0.1 })); wick.position.y = 0.32; g.add(wick);
      var flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffc85a, fog: false }));
      flame.position.y = 0.42; g.add(flame);
      var halo = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      halo.position.y = 0.43; g.add(halo);
      var glow = new THREE.PointLight(col(0xffa848), 0, 7, 2); glow.position.y = 0.5; g.add(glow);
      g.userData = { flame: flame, halo: halo, glow: glow };
      lantern = g;
      return g;
    }

    // Apoyados en los lados inclinados del marco (apotema exterior ≈ 6.06), donde el hexágono deja hueco arriba y abajo:
    // pava y mate (arriba izq.) a ~0.65 del borde; farol (arriba der.), cartas (abajo der.) y facón (abajo izq.).
    // Cada uno va girado para quedar paralelo al lado que toca.
    place(makeLantern(), 6.12, -3.54, 0);
    place(makePava(), -6.39, -3.69, 1.047);
    place(makeMate(), -6.74, -2.45, 0.5236); // al lado de la pava, a su izquierda, sobre el mismo lado del marco
    place(makeCards(), 6.72, 3.88, -2.094);
    place(makeFacon(), -6.4, 3.25, -1.047);

    // ------------------------------------------------------------------ geometrías y materiales compartidos
    var HEX_R = 1;           // = circunradio de la grilla: las casillas se tocan (la bisel deja la línea divisoria)
    function tileShape() {
      var s = new THREE.Shape(), r = HEX_R - 0.05;
      for (var i = 0; i < 6; i++) { var a = Math.PI / 2 + i * Math.PI / 3, x = r * Math.cos(a), y = r * Math.sin(a); if (i) s.lineTo(x, y); else s.moveTo(x, y); }
      s.closePath();
      return s;
    }
    var tileGeo = new THREE.ExtrudeGeometry(tileShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
    tileGeo.rotateX(-Math.PI / 2); tileGeo.translate(0, 0.05, 0);

    var TERRAINS = {
      forest:    { name: 'Bosque',    res: 'Madera',  ui: '#3f8f45' },
      pasture:   { name: 'Llano',     res: 'Vaca',   ui: '#a7d15c' },
      fields:    { name: 'Campo',     res: 'Maíz',    ui: '#e8bf45' },
      hills:     { name: 'Barro',     res: 'Ladrillo', ui: '#c96a3b' },
      mountains: { name: 'Cantera',   res: 'Piedra',  ui: '#8d949c' },
      desert:    { name: 'Desierto',  res: 'Nada',    ui: '#e3c78d' }
    };
    var tileSideMat = M(0x8a6f4d, 0.8, 0, { env: 0.3 });
    Object.keys(TERRAINS).forEach(function (k) {
      var t = tex(terrainCanvas(k)); t.repeat.set(0.52, 0.52); t.offset.set(0.5, 0.5);
      TERRAINS[k].mats = [M(0xffffff, 0.92, 0, { env: 0.25, map: t }), tileSideMat];
    });

    // Cuerpo de vaca: elipsoide de pocos polígonos con las manchas pintadas por cara (color de vértice),
    // así las manchas quedan a ras de la superficie y no sobresalen. `patches` = [dirX, dirY, dirZ, cosRadio].
    function cowBodyGeo(patches) {
      var g = new THREE.IcosahedronGeometry(1, 2), pos = g.attributes.position, n = pos.count, colors = new Float32Array(n * 3);
      var white = col(0xf6f3ea), dark = col(0x2b2723), dirs = patches.map(function (p) { var v = new THREE.Vector3(p[0], p[1], p[2]).normalize(); return { v: v, c: p[3] }; });
      var cen = new THREE.Vector3(), a = new THREE.Vector3();
      for (var f = 0; f < n; f += 3) {
        cen.set(0, 0, 0);
        for (var k = 0; k < 3; k++) cen.add(a.fromBufferAttribute(pos, f + k));
        cen.normalize();
        var isDark = dirs.some(function (d) { return cen.dot(d.v) > d.c; }), c = isDark ? dark : white;
        for (var k2 = 0; k2 < 3; k2++) { colors[(f + k2) * 3] = c.r; colors[(f + k2) * 3 + 1] = c.g; colors[(f + k2) * 3 + 2] = c.b; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.scale(0.125, 0.07, 0.068);
      return g;
    }

    // Roca: icosaedro de pocos polígonos con cada vértice desplazado un poco hacia dentro o hacia fuera.
    // El desplazamiento depende de la posición del vértice (no del orden), así los vértices compartidos
    // se mueven igual y la roca no se abre. Queda algo achatada, como una piedra apoyada en el suelo.
    function rockGeo(seed, radius) {
      var g = new THREE.IcosahedronGeometry(radius, 1), pos = g.attributes.position, v = new THREE.Vector3();
      function h(a, b, c) { var x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + seed * 19.19) * 43758.5453; return x - Math.floor(x); }
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        var k = h(Math.round(v.x * 20), Math.round(v.y * 20), Math.round(v.z * 20));
        v.multiplyScalar(radius * (0.8 + 0.34 * k));
        pos.setXYZ(i, v.x, v.y * 0.85, v.z);
      }
      g.computeVertexNormals();
      return g;
    }

    var G = {
      // árbol de copa ancha (estilo ombú): tronco grueso y copa hecha de tres masas redondeadas
      trunk: new THREE.CylinderGeometry(0.04, 0.06, 0.2, 6),
      crown: [new THREE.IcosahedronGeometry(0.13, 1), new THREE.IcosahedronGeometry(0.095, 1), new THREE.IcosahedronGeometry(0.085, 1)],
      // vaca
      cowBody: [
        cowBodyGeo([[-0.3, 0.8, 0.5, 0.8], [0.5, 0.6, -0.6, 0.82], [-0.8, 0.3, -0.4, 0.86]]),
        cowBodyGeo([[0.1, 0.9, -0.4, 0.78], [-0.6, 0.4, 0.7, 0.84], [0.7, 0.2, 0.6, 0.88]]),
        cowBodyGeo([[-0.2, 0.7, -0.7, 0.8], [0.6, 0.7, 0.4, 0.82], [-0.9, 0.1, 0.3, 0.88]])
      ],
      cowHead: new THREE.IcosahedronGeometry(0.052, 1),
      cowMuzzle: new THREE.IcosahedronGeometry(0.034, 1),
      cowLeg: new THREE.CylinderGeometry(0.017, 0.013, 0.07, 6),
      cowEar: new THREE.IcosahedronGeometry(0.02, 0),
      cowHorn: new THREE.ConeGeometry(0.009, 0.038, 4),
      cowTail: new THREE.CylinderGeometry(0.008, 0.008, 0.075, 4),
      cowTuft: new THREE.IcosahedronGeometry(0.016, 0),
      // planta de maíz (se instancia): tallo, dos hojas, choclo y penacho
      cornStalk: new THREE.CylinderGeometry(0.013, 0.02, 0.22, 5),
      cornLeafA: new THREE.ConeGeometry(0.028, 0.15, 4),
      cornLeafB: new THREE.ConeGeometry(0.028, 0.15, 4),
      cornCob: new THREE.CylinderGeometry(0.022, 0.015, 0.09, 6),
      cornTassel: new THREE.ConeGeometry(0.016, 0.06, 4),
      brick: new THREE.BoxGeometry(0.15, 0.07, 0.075),
      mound: new THREE.SphereGeometry(0.2, 12, 8),
      // rocas: masas irregulares de pocos polígonos (3 grandes + 2 chicas), no conos
      rockBig: [rockGeo(1, 0.19), rockGeo(2, 0.19), rockGeo(3, 0.19)],
      rockSmall: [rockGeo(4, 0.08), rockGeo(5, 0.08)],
      tokenBase: new THREE.CylinderGeometry(0.315, 0.335, 0.05, 32),
      tokenFace: new THREE.CircleGeometry(0.28, 32)
    };
    G.mound.scale(1, 0.4, 1);
    G.cowHead.scale(1.15, 0.95, 0.9); G.cowMuzzle.scale(0.8, 0.85, 1.1); G.cowEar.scale(1, 0.5, 1.3);
    G.cowLeg.translate(0, 0.035, 0); G.cowHorn.translate(0, 0.019, 0); G.cowTail.translate(0, -0.0375, 0);
    // las partes del maíz se hornean en su posición para poder instanciarlas con la misma matriz
    G.cornStalk.translate(0, 0.11, 0);
    G.cornLeafA.translate(0, 0.075, 0); G.cornLeafA.rotateZ(-0.9); G.cornLeafA.translate(0, 0.1, 0);
    G.cornLeafB.translate(0, 0.075, 0); G.cornLeafB.rotateZ(0.9); G.cornLeafB.rotateY(Math.PI / 2); G.cornLeafB.translate(0, 0.13, 0);
    G.cornCob.translate(0, 0.045, 0); G.cornCob.rotateZ(-0.55); G.cornCob.translate(0.014, 0.14, 0);
    G.cornTassel.translate(0, 0.25, 0);
    var MAT = {
      trunk: M(0x6b4a2b, 0.9), leaf: [M(0x2f7d3a, 0.85, 0, { flat: true }), M(0x3b9046, 0.85, 0, { flat: true }), M(0x4aa050, 0.85, 0, { flat: true })],
      cowWhite: M(0xf6f3ea, 0.9, 0, { flat: true }), dark: M(0x2b2723, 0.7, 0, { flat: true }), cowMuzzle: M(0xe6a9a0, 0.8, 0, { flat: true }), cowHorn: M(0xe9dfc4, 0.7, 0, { flat: true }),
      cowBody: M(0xffffff, 0.9, 0, { flat: true }),
      cornStalk: M(0x5c9a3c, 0.85), cornLeaf: M(0x6fb04a, 0.8, 0, { flat: true }), cornCob: M(0xf2c53d, 0.6), cornTassel: M(0xc9a23a, 0.85),
      brick: M(0xb8452a, 0.75), mound: M(0xa9552d, 0.9),
      rock: M(0x7d848c, 0.85, 0, { flat: true }), rock2: M(0x9aa1a9, 0.85, 0, { flat: true }),
      token: M(0xf3e6c4, 0.55), robber: M(0x24272d, 0.3, 0.35, { env: 0.8 }),
      dock: M(0x8a5a2b, 0.8), hull: M(0x8b5a34, 0.6), sail: M(0xf4ecd8, 0.85), road: null
    };
    MAT.cowBody.vertexColors = true; // las manchas van en el color de los vértices del cuerpo
    MAT.token.emissive = new THREE.Color(0xf3e6c4); MAT.token.emissiveIntensity = 0.35;
    var PLAYERS = [0xd94141, 0x3b6fd6, 0xf0932b, 0xf1eee6].map(function (h) {
      var m = M(h, 0.38, 0.05, { env: 0.6 }), hsl = { h: 0, s: 0, l: 0 };
      // color base guardado: applyLight() lo ajusta (intensidad y brillo propio) según día/atardecer/noche
      m.userData.base = m.color.clone(); m.emissive = new THREE.Color(); m.emissiveIntensity = 0;
      // contorno: tono muy oscuro del propio color del jugador (no negro puro, que se ve como calcomanía)
      m.userData.base.getHSL(hsl);
      m.userData.outline = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hsl.h, hsl.s * 0.9, hsl.l * 0.08), side: THREE.BackSide });
      return m;
    });
    // Contorno de las piezas: copia apenas más grande dibujada solo por las caras traseras, que asoma como un borde
    // fino alrededor de la silueta y separa la pieza de cualquier terreno. Si se cambia el grosor, revisar
    // EDGE_CLEAR y VERT_CLEAR del decorado (espacio reservado alrededor de caminos y esquinas).
    var OUTLINE_T = 0.008;
    function outlineFor(geo, x, mat) {
      geo.computeBoundingBox();
      var b = geo.boundingBox, o = new THREE.Mesh(geo, mat);
      o.scale.set(1 + 2 * OUTLINE_T / (b.max.x - b.min.x), 1 + 2 * OUTLINE_T / (b.max.y - b.min.y), 1 + 2 * OUTLINE_T / (b.max.z - b.min.z));
      o.position.set(x || 0, -OUTLINE_T, 0);
      return o;
    }

    // ------------------------------------------------------------------ piezas (casas, estancias, caminos, ladrón)
    function houseGeo(w, h, d, roof) {
      var s = new THREE.Shape();
      s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(0, h + roof); s.lineTo(-w / 2, h); s.closePath();
      var g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
      g.translate(0, 0, -d / 2);
      return g;
    }
    var HOUSE = houseGeo(0.24, 0.16, 0.2, 0.12);
    var CITY_HALL = houseGeo(0.3, 0.13, 0.22, 0.09), CITY_TOWER = houseGeo(0.15, 0.27, 0.17, 0.1);
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
      var g = new THREE.Group(); g.add(mesh(robberGeo, MAT.robber));
      var h = mesh(headGeo, MAT.robber); h.position.y = 0.31; g.add(h);
      return g;
    }
    function segment(a, b, y, thick, height, mat) {
      var dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      var m = mesh(new THREE.BoxGeometry(len, height, thick), mat);
      m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      return m;
    }

    // ------------------------------------------------------------------ decoración por terreno
    // Cada objeto se trata como un círculo de radio `rad` que debe caber en la casilla sin pisar:
    //  - la ficha del número (centro),
    //  - los caminos (van sobre las aristas; mitad de su ancho = 0.0425, más 0.02 de aire),
    //  - las casas y estancias (van en los vértices; la estancia ocupa ~0.26, más 0.02 de aire).
    var TOKEN_R = 0.335, EDGE_CLEAR = 0.0625, VERT_CLEAR = 0.28;
    var TILE_VERTS = [[0, 1], [0, -1], [SQ3 / 2, 0.5], [SQ3 / 2, -0.5], [-SQ3 / 2, 0.5], [-SQ3 / 2, -0.5]];
    function fitsTile(x, z, rad) {
      // distancia del punto al borde de la casilla (apotema = √3/2 con circunradio 1)
      var edge = Math.min(SQ3 / 2 - Math.abs(x), (1 - (Math.abs(z) + Math.abs(x) / SQ3)) / 1.1547);
      if (edge < rad + EDGE_CLEAR) return false;
      for (var i = 0; i < 6; i++) if (Math.hypot(x - TILE_VERTS[i][0], z - TILE_VERTS[i][1]) < rad + VERT_CLEAR) return false;
      return Math.hypot(x, z) >= TOKEN_R + rad + 0.03;
    }
    // `avoid` (opcional): puntos ya ocupados por otros objetos, a los que hay que respetar `avoidDist`.
    function scatter(n, rad, minDist, rnd, avoid, avoidDist) {
      var pts = [], tries = 0, rmin = TOKEN_R + rad + 0.03;
      while (pts.length < n && tries++ < 400) {
        var a = rnd() * 6.2832, r = rmin + rnd() * (1 - rmin), x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (!fitsTile(x, z, rad)) continue;
        var ok = true;
        for (var i = 0; i < pts.length; i++) if (Math.hypot(pts[i].x - x, pts[i].z - z) < minDist) { ok = false; break; }
        if (ok && avoid) for (var j = 0; j < avoid.length; j++) if (Math.hypot(avoid[j].x - x, avoid[j].z - z) < avoidDist) { ok = false; break; }
        if (ok) pts.push({ x: x, z: z });
      }
      return pts;
    }
    function decorate(kind, rnd) {
      var g = new THREE.Group(), i, p, pts, o;
      if (kind === 'forest') {
        scatter(8, 0.15, 0.22, rnd).forEach(function (p) {
          // tronco + copa ancha de tres masas redondeadas (se lee como árbol, no como cono/montaña)
          var t = new THREE.Group(), s = 0.6 + rnd() * 0.22, m = mesh(G.trunk, MAT.trunk); m.position.y = 0.1; t.add(m);
          [[0, 0.27, 0, 0], [0.085, 0.23, 0.02, 1], [-0.06, 0.25, -0.06, 2]].forEach(function (c) {
            var b = mesh(G.crown[c[3]], MAT.leaf[Math.floor(rnd() * 3)]); b.position.set(c[0], c[1], c[2]); b.rotation.y = rnd() * 6; t.add(b);
          });
          t.scale.setScalar(s); t.rotation.y = rnd() * 6.28; t.position.set(p.x, 0, p.z); g.add(t);
        });
      } else if (kind === 'pasture') {
        scatter(4, 0.19, 0.36, rnd).forEach(function (p) {
          // vaca redondeada y robusta: cuerpo con manchas pintadas (3 variantes), cabeza al frente (+x), hocico, orejas, cuernos, patas y cola.
          // `c` desplaza la vaca 0.03 hacia atrás para que el pivote quede en el centro de su silueta (~0.18 de radio).
          var s = new THREE.Group(), c = new THREE.Group(); c.position.x = -0.03; s.add(c);
          var b = mesh(G.cowBody[Math.floor(rnd() * 3)], MAT.cowBody); b.position.y = 0.11; c.add(b);
          var h = mesh(G.cowHead, MAT.cowWhite); h.position.set(0.14, 0.14, 0); c.add(h);
          var mz = mesh(G.cowMuzzle, MAT.cowMuzzle); mz.position.set(0.185, 0.125, 0); c.add(mz);
          [-1, 1].forEach(function (sd) {
            var ear = mesh(G.cowEar, MAT.dark); ear.position.set(0.125, 0.172, sd * 0.058); c.add(ear);
            var horn = mesh(G.cowHorn, MAT.cowHorn); horn.position.set(0.135, 0.19, sd * 0.03); horn.rotation.x = sd * 0.5; c.add(horn);
          });
          [[-0.075, -0.04], [-0.075, 0.04], [0.075, -0.04], [0.075, 0.04]].forEach(function (l) { var leg = mesh(G.cowLeg, MAT.cowWhite); leg.position.set(l[0], 0, l[1]); c.add(leg); });
          var tail = mesh(G.cowTail, MAT.dark); tail.position.set(-0.128, 0.15, 0); tail.rotation.z = 0.2; c.add(tail);
          var tuft = mesh(G.cowTuft, MAT.dark); tuft.position.set(-0.136, 0.07, 0); c.add(tuft);
          s.rotation.y = rnd() * 6.28; s.position.set(p.x, 0, p.z); s.scale.setScalar(0.85 + rnd() * 0.15); g.add(s);
        });
      } else if (kind === 'fields') {
        var mats = [], n = 0, tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
        // plantas de maíz en filas; cada una gira al azar para que los choclos miren a distintos lados
        for (var x = -0.66; x <= 0.67; x += 0.12) for (var z = -0.72; z <= 0.72; z += 0.1) {
          if (!fitsTile(x, z, 0.14)) continue; // 0.14 = alcance de las hojas de una planta
          e.set((rnd() - 0.5) * 0.12, rnd() * 6.28, (rnd() - 0.5) * 0.12); q.setFromEuler(e);
          var s = 0.85 + rnd() * 0.3; sc.set(s, s, s); ps.set(x + (rnd() - 0.5) * 0.03, 0, z + (rnd() - 0.5) * 0.03);
          tmpM.compose(ps, q, sc); mats.push(tmpM.clone()); n++;
        }
        [[G.cornStalk, MAT.cornStalk], [G.cornLeafA, MAT.cornLeaf], [G.cornLeafB, MAT.cornLeaf], [G.cornCob, MAT.cornCob], [G.cornTassel, MAT.cornTassel]].forEach(function (pair) {
          var im = new THREE.InstancedMesh(pair[0], pair[1], n);
          for (i = 0; i < n; i++) im.setMatrixAt(i, mats[i]);
          im.castShadow = false; im.receiveShadow = true; g.add(im);
        });
      } else if (kind === 'hills') {
        var piles = scatter(3, 0.175, 0.4, rnd);
        piles.forEach(function (p) {
          var pile = new THREE.Group(), rows = [3, 2, 1];
          rows.forEach(function (cnt, li) {
            for (var k = 0; k < cnt; k++) { var b = mesh(G.brick, MAT.brick); b.position.set((k - (cnt - 1) / 2) * 0.16, 0.035 + li * 0.07, 0); b.rotation.y = (rnd() - 0.5) * 0.15; pile.add(b); }
          });
          pile.rotation.y = rnd() * 6.28; pile.position.set(p.x, 0, p.z); pile.scale.setScalar(0.7); g.add(pile);
        });
        // los montículos esquivan las pilas para no pisarse
        scatter(3, 0.13, 0.3, rnd, piles, 0.32).forEach(function (p) { var m = mesh(G.mound, MAT.mound); m.position.set(p.x, 0, p.z); m.scale.setScalar(0.4 + rnd() * 0.25); g.add(m); });
      } else if (kind === 'mountains') {
        // rocas grandes irregulares y, entre ellas, rocas chicas; ninguna pisa la ficha ni se pisan entre sí
        var bigs = scatter(3, 0.185, 0.45, rnd);
        bigs.forEach(function (p, idx) {
          var s = 0.65 + rnd() * 0.2, b = mesh(G.rockBig[Math.floor(rnd() * 3)], idx % 2 ? MAT.rock2 : MAT.rock);
          b.position.set(p.x, 0.11 * s, p.z); b.rotation.y = rnd() * 6.28; b.scale.set(s, s * (0.9 + rnd() * 0.3), s); g.add(b);
        });
        scatter(4, 0.09, 0.22, rnd, bigs, 0.28).forEach(function (p) {
          var s = 0.5 + rnd() * 0.4, b = mesh(G.rockSmall[Math.floor(rnd() * 2)], rnd() > 0.5 ? MAT.rock : MAT.rock2);
          b.position.set(p.x, 0.045 * s, p.z); b.rotation.y = rnd() * 6.28; b.scale.setScalar(s); g.add(b);
        });
      }
      // El desierto no lleva decorado: solo el ladrón, que arranca ahí.
      g.scale.y = DECOR_HEIGHT;
      g.position.y = TILE_TOP;
      return g;
    }

    // Cifras "de altura de mayúscula" (lining): todos los números miden lo mismo de alto. Georgia usa cifras
    // old-style donde el 0, 1 y 2 son bajitos y el 6 y 8 altos, y por eso 10, 11 y 12 se veían mucho más chicos.
    var TOKEN_FONT = '"Times New Roman", Times, "Liberation Serif", serif', TOKEN_MAX_W = 66, tokenSize = 0;
    function tokenFontSize(ctx) {
      // un solo tamaño para TODAS las fichas: el que hace que entre el número más ancho (10, 11, 12) en TOKEN_MAX_W
      if (!tokenSize) {
        var wmax = 1;
        ctx.font = 'bold 100px ' + TOKEN_FONT;
        for (var n = 2; n <= 12; n++) { var m = ctx.measureText(String(n)); wmax = Math.max(wmax, m.actualBoundingBoxLeft + m.actualBoundingBoxRight); }
        tokenSize = Math.min(84, Math.floor(100 * TOKEN_MAX_W / wmax));
      }
      return tokenSize;
    }
    function tokenTexture(n) {
      var c = makeCanvas(128, 128), ctx = c.getContext('2d'), red = (n === 6 || n === 8);
      ctx.fillStyle = '#fff3d2'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#3b2a18'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(64, 64, 60, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = red ? '#b3261e' : '#2b2118';
      // Mismo tamaño de letra y misma altura de bloque para todos los números; solo cambia el centrado horizontal
      // (según el trazo real del número) y la cantidad de puntos, que se centran en el círculo.
      var label = String(n), size = tokenFontSize(ctx), m, w, capH;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = 'bold ' + size + 'px ' + TOKEN_FONT;
      capH = ctx.measureText('0').actualBoundingBoxAscent; m = ctx.measureText(label);
      w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      var dots = 6 - Math.abs(7 - n), dotR = 5.6, dotStep = 14, gap = 8;
      var top = 64 - (capH + gap + dotR * 2) / 2;
      ctx.fillText(label, 64 - w / 2 + m.actualBoundingBoxLeft, top + capH);
      var sx = 64 - (dots - 1) * dotStep / 2, dy = top + capH + gap + dotR;
      for (var i = 0; i < dots; i++) { ctx.beginPath(); ctx.arc(sx + i * dotStep, dy, dotR, 0, 6.2832); ctx.fill(); }
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      return t;
    }
    var tokenTexCache = {};
    function makeToken(n) {
      var g = new THREE.Group(); g.add(mesh(G.tokenBase, MAT.token)); g.children[0].position.y = 0.025;
      if (!tokenTexCache[n]) { var tt = tokenTexture(n); tokenTexCache[n] = new THREE.MeshStandardMaterial({ map: tt, emissive: 0xffffff, emissiveMap: tt, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0, envMapIntensity: 0.2 }); }
      var f = new THREE.Mesh(G.tokenFace, tokenTexCache[n]); f.rotation.x = -Math.PI / 2; f.position.y = 0.052; f.receiveShadow = true;
      // La ficha va al ras de la casilla: su borde queda 4 milésimas sobre la cara superior
      // (no coincide exacto para evitar z-fighting) y el resto del disco queda enterrado.
      g.add(f); g.position.y = TILE_TOP - 0.046;
      return g;
    }

    // Brillo de los bordes interiores del hexágono (se desvanece hacia el centro), para las casillas que salen en los dados.
    var GLOW_GEO = new THREE.PlaneGeometry(2, 2), glowTex = null;
    function glowTexture() {
      if (glowTex) return glowTex;
      var c = makeCanvas(256, 256), ctx = c.getContext('2d'), k, w;
      function hexPath() { ctx.beginPath(); for (k = 0; k < 6; k++) { var a = Math.PI / 2 + k * Math.PI / 3; ctx[k ? 'lineTo' : 'moveTo'](128 + 118 * Math.cos(a), 128 - 118 * Math.sin(a)); } ctx.closePath(); }
      hexPath(); ctx.clip(); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,214,120,0.085)';
      for (w = 70; w >= 4; w -= 3) { ctx.lineWidth = w; hexPath(); ctx.stroke(); }
      glowTex = new THREE.CanvasTexture(c); glowTex.encoding = THREE.sRGBEncoding;
      return glowTex;
    }

    // ------------------------------------------------------------------ puertos
    var hullShape = new THREE.Shape();
    hullShape.moveTo(-0.34, 0.16); hullShape.lineTo(-0.24, 0); hullShape.lineTo(0.24, 0); hullShape.lineTo(0.42, 0.16); hullShape.closePath();
    var HULL = new THREE.ExtrudeGeometry(hullShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    HULL.translate(0, 0, -0.11);
    var sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(0.3, 0); sailShape.lineTo(0, 0.44); sailShape.closePath();
    var SAIL = new THREE.ExtrudeGeometry(sailShape, { depth: 0.012, bevelEnabled: false });
    var MAST = new THREE.CylinderGeometry(0.014, 0.014, 0.55, 6);
    var POST = new THREE.CylinderGeometry(0.025, 0.03, 0.6, 6);

    // Dibujos de los recursos para los carteles de puerto (legibles de lejos, sin texto).
    var PORT_ICONS = {
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
        ctx.font = 'bold 96px Georgia, "Times New Roman", serif'; ctx.fillText('2:1', 128, 68);
        ctx.strokeStyle = '#3b2a18'; ctx.lineWidth = 5; ctx.save(); ctx.translate(128, 154); ctx.scale(0.85, 0.85); PORT_ICONS[kind](ctx, 0, 0); ctx.restore();
      }
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      return t;
    }

    // ------------------------------------------------------------------ tablero
    var board = null, tiles = [], tileMeshes = [], ships = [], robber = null, robberBase = 0, robberPulse = 0, piecesGroup = null, markersGroup = null, ghostGroup = null;
    var session = null; // GameSession: dueña de la partida (hoy local, después remota)
    var game = null, legal = [], me = 0; // última vista de la sesión: partida visible, acciones legales y jugador que mira
    var sending = false; // true mientras espera la respuesta de la sesión a un comando
    var withOthers = online || opts.mode === 'bots'; // hay otros que juegan por su cuenta (bots o personas en línea), y vos sos siempre el mismo jugador; false: los 4 en la misma pantalla
    var shown = null; // lo que ya se dibujó del estado (piezas y ladrón); durante una reproducción de eventos va por detrás de `game`
    function pull() {
      var v = session.view(); game = v.game; legal = v.legal; me = v.me;
      shown = { vertexBuildings: game.vertexBuildings.slice(), edgeRoads: game.edgeRoads.slice(), robber: game.robber };
    }
    var buildMode = null; // 'road' | 'settlement' | 'city' | null: qué se está por construir (en el turno normal)
    var robberTile = -1, discardSel = {}, dialogKey = ''; // casilla donde está dibujado el ladrón; selección del descarte
    var busy = false; // true mientras corre una animación (dados, recursos volando): no se aceptan jugadas ni botones
    var vertices = []; // vértices del motor con su posición 3D; el id es el del motor

    // El mapa lo decide el motor (game.map). Los nombres de terreno del motor coinciden con las claves de TERRAINS.
    function buildBoard(seed) {
      if (board) scene.remove(board);
      var rnd = mulberry32(seed);
      session = online ? opts.session : new LocalSession(PLAYER_INFO.map(function (p) { return p.name; }), seed, { firstPlayer: null }, withOthers ? { bots: [false, true, true, true] } : {}); pull();
      var topo = topology();
      board = new THREE.Group(); scene.add(board);
      setOrbit(false); tiles = []; tileMeshes = []; ships = []; robber = null; hoverTile = null; busy = false; sending = false; pieceSeen = {};

      // casillas (mismo orden e ids que las del motor)
      topo.tiles.forEach(function (et) {
        var kind = game.map.terrains[et.id], num = game.map.numbers[et.id];
        var t = { id: et.id, q: et.q, r: et.r, kind: kind, num: num, x: et.x, z: et.z, pulse: 0 };
        t.group = new THREE.Group(); t.group.position.set(t.x, 0, t.z);
        t.mesh = mesh(tileGeo, TERRAINS[kind].mats); t.group.add(t.mesh); t.mesh.userData.tile = t;
        t.group.add(decorate(kind, mulberry32(Math.floor(rnd() * 1e9))));
        if (num) {
          t.token = makeToken(num); t.tokenBase = t.token.position.y; t.group.add(t.token);
          t.glow = new THREE.Mesh(GLOW_GEO, new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
          t.glow.rotation.x = -Math.PI / 2; t.glow.position.y = TILE_TOP + 0.004; t.glow.visible = false; t.glow.renderOrder = 2; t.group.add(t.glow);
        }
        board.add(t.group); tiles.push(t); tileMeshes.push(t.mesh);
      });

      // vértices del motor con su posición 3D (el id es el del estado de la partida)
      vertices = topo.vertices.map(function (v) { return { x: v.x, z: v.z, tiles: v.tiles.map(function (i) { return tiles[i]; }), nb: v.neighbors }; });

      // puertos: los reparte el motor (9 sobre la costa); acá solo se dibujan
      game.map.ports.forEach(function (port, i) {
        var e = topo.edges[port.edge], t = tiles[port.tile];
        var A = vertices[e.a], B = vertices[e.b], mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
        var nx = mx - t.x, nz = mz - t.z, nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
        var P = { x: mx + nx * 1.1, z: mz + nz * 1.1 }, D = { x: mx + nx * 0.55, z: mz + nz * 0.55 };
        board.add(segment(A, D, WATER_Y + 0.03, 0.05, 0.035, MAT.dock)); board.add(segment(B, D, WATER_Y + 0.03, 0.05, 0.035, MAT.dock));
        var ship = new THREE.Group(); ship.add(mesh(HULL, MAT.hull));
        var mast = mesh(MAST, MAT.dock); mast.position.set(0.02, 0.43, 0); ship.add(mast);
        var sail = mesh(SAIL, MAT.sail); sail.position.set(0.035, 0.2, -0.006); ship.add(sail);
        ship.scale.setScalar(0.7);
        // El cartel va fijo en un poste del muelle (no en el barco), para que no se mueva con las olas.
        var post = mesh(POST, MAT.dock); post.position.set(D.x, WATER_Y + 0.3, D.z); board.add(post);
        var lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: portLabel(port.resource), transparent: true }));
        lab.scale.set(0.62, 0.62, 1); lab.position.set(D.x, WATER_Y + 0.68, D.z); board.add(lab);
        ship.position.set(P.x, WATER_Y, P.z); ship.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x);
        ship.userData.phase = i * 1.3; ship.userData.baseY = WATER_Y - 0.02;
        board.add(ship); ships.push(ship);
      });

      // ladrón en el desierto
      robber = makeRobber(); robber.position.set(0.05, TILE_TOP, 0.03); robberBase = TILE_TOP; robberPulse = 0;
      tiles[game.robber].group.add(robber); robberTile = game.robber;

      // el tablero arranca vacío: las piezas aparecen a medida que se juega
      piecesGroup = new THREE.Group(); board.add(piecesGroup);
      markersGroup = new THREE.Group(); board.add(markersGroup);
      ghostGroup = new THREE.Group(); board.add(ghostGroup);
      syncPieces();
      resetPlayers();
      refreshUi();
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
      shown.edgeRoads.forEach(function (p, eid) {
        if (p === null) return;
        var e = topo.edges[eid], A = vertices[e.a], B = vertices[e.b], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
        var ux = dx / L, uz = dz / L, a = { x: A.x + ux * 0.2, z: A.z + uz * 0.2 }, b = { x: B.x - ux * 0.2, z: B.z - uz * 0.2 };
        var road = segment(a, b, TILE_TOP + 0.045, 0.085, 0.07, PLAYERS[p]);
        var edgeLine = segment(a, b, TILE_TOP + 0.045, 0.085 + 2 * OUTLINE_T, 0.07 + 2 * OUTLINE_T, PLAYERS[p].userData.outline);
        edgeLine.castShadow = false; edgeLine.receiveShadow = false;
        born(road, 'e' + eid); born(edgeLine, 'e' + eid);
        piecesGroup.add(road); piecesGroup.add(edgeLine);
      });
      shown.vertexBuildings.forEach(function (bd, vid) {
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
    var GHOST_HOVER = 0.55, DROP_MS = 380;
    function animateGhost(now) {
      var g = ghostGroup && ghostGroup.children[0]; if (!g) return;
      var u = g.userData;
      if (!u.drop) { g.position.y = u.baseY + GHOST_HOVER + 0.05 * Math.sin(now * 3); g.rotation.y = u.baseRot + now * 2.4; return; }
      var k = Math.min(1, (now - u.drop.t0) * 1000 / DROP_MS);
      g.position.y = u.baseY + u.drop.h * (1 - k * k);
      g.rotation.y = u.baseRot + u.drop.a0 + (u.drop.a1 - u.drop.a0) * (1 - (1 - k) * (1 - k));
    }
    // Modal de confirmación pegado a la pieza: arriba de ella si entra en pantalla, si no abajo (y si ninguno entra, del lado con más lugar).
    // Se recalcula en cada cuadro porque la cámara orbita.
    var confirmPos = new THREE.Vector3();
    function screenPoint(x, y, z) {
      confirmPos.set(x, y, z); board.localToWorld(confirmPos); confirmPos.project(camera);
      return { x: (confirmPos.x + 1) / 2 * stage.clientWidth, y: (1 - confirmPos.y) / 2 * stage.clientHeight };
    }
    function placeConfirm() {
      if (!pendingCmd || dialogEl.hidden || !dialogEl.classList.contains('confirm')) return;
      var top, bot, sr = stage.getBoundingClientRect();
      if (pendingCmd.type === 'buyDevCard') { // pegado al botón de la carta
        var br = btnDev.getBoundingClientRect(), cx = br.left - sr.left + br.width / 2;
        top = { x: cx, y: br.top - sr.top }; bot = { x: cx, y: br.bottom - sr.top };
      } else {
        var g = ghostGroup && ghostGroup.children[0]; if (!g) return;
        var u = g.userData;
        top = screenPoint(g.position.x, u.baseY + GHOST_HOVER + 0.4, g.position.z); bot = screenPoint(g.position.x, u.baseY, g.position.z);
      }
      var W = stage.clientWidth, H = stage.clientHeight, w = dialogEl.offsetWidth, h = dialogEl.offsetHeight, gap = 14, edge = 8;
      var fitsAbove = top.y - gap - h >= edge, fitsBelow = bot.y + gap + h <= H - edge;
      var above = fitsAbove || (!fitsBelow && top.y > H - bot.y);
      var y = above ? top.y - gap - h : bot.y + gap, x = (above ? top.x : bot.x) - w / 2;
      x = Math.max(edge, Math.min(W - w - edge, x)); y = Math.max(edge, Math.min(H - h - edge, y));
      var op = dialogEl.offsetParent, or = op ? op.getBoundingClientRect() : { left: 0, top: 0 };
      dialogEl.style.left = (sr.left - or.left + x) + 'px'; dialogEl.style.top = (sr.top - or.top + y) + 'px'; dialogEl.style.transform = 'none';
    }
    function confirmDrop(cmd) {
      if (cmd.type === 'buyDevCard') { dispatch(cmd); return; } // no hay pieza que apoyar: se compra directo
      var g = ghostGroup && ghostGroup.children[0];
      if (!g || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { dispatch(cmd); return; }
      var u = g.userData, a0 = (g.rotation.y - u.baseRot) % (2 * Math.PI), a1 = 2 * Math.PI * (a0 > 4 ? 2 : 1);
      u.drop = { t0: performance.now() / 1000, h: g.position.y - u.baseY, a0: a0, a1: a1 };
      busy = true; dialogEl.hidden = true;
      var key = cmd.edge !== undefined ? 'e' + cmd.edge : 'v' + cmd.vertex + (cmd.type === 'buildCity' ? 'c' : 's');
      setTimeout(function () { busy = false; pieceSeen[key] = true; dispatch(cmd); }, DROP_MS);
    }
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
      if (busy || !game) return;
      var acts = legal, topo = topology(), y = TILE_TOP + 0.05;
      markerMat = new THREE.MeshBasicMaterial({ color: col(PLAYER_INFO[game.turn].css), transparent: true, opacity: 0.6, depthWrite: false, fog: false });
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
        if (a.type === 'placeSettlement' || (a.type === 'buildSettlement' && buildMode === 'settlement') || (a.type === 'buildCity' && buildMode === 'city')) a.vertices.forEach(vertexMarker);
        if (a.type === 'placeRoad' || (a.type === 'buildRoad' && (buildMode === 'road' || game.phase.kind === 'roadBuilding'))) a.edges.forEach(edgeMarker);
        if (a.type === 'moveRobber') a.tiles.forEach(tileMarker);
      });
      markersGroup.updateMatrixWorld(true); // que se puedan tocar de inmediato, sin esperar al próximo cuadro
    }

    // ------------------------------------------------------------------ interacción
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
      var hit = raycaster.intersectObjects(tileMeshes, false)[0];
      setHover(hit ? hit.object.userData.tile : null);
    });
    renderer.domElement.addEventListener('pointerleave', function () { setHover(null); });

    // Clic (o toque) sobre un marcador de jugada legal. Si el puntero se movió, era un arrastre de la cámara y no cuenta.
    var downAt = null;
    renderer.domElement.addEventListener('pointerdown', function (e) { downAt = e.isPrimary ? { x: e.clientX, y: e.clientY } : null; });
    renderer.domElement.addEventListener('pointerup', function (e) {
      var d = downAt; downAt = null;
      if (!d || !e.isPrimary || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || busy || !markersGroup || !markersGroup.children.length) return;
      var r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      var hit = raycaster.intersectObjects(markersGroup.children, false)[0];
      if (!hit) return;
      var cmd = commandFromMarker(hit.object.userData);
      if (cmd.type === 'moveRobber') dispatch(cmd); else askConfirm(cmd);
    });

    // ------------------------------------------------------------------ dados (modal con dados 3D de CSS)
    // Cada dado es un cubo de 6 caras con puntos. Para mostrar la cara `v` de frente hay que girar el cubo:
    //   [rotateX, rotateY] en grados; las caras opuestas suman 7 (1-6, 2-5, 3-4).
    var DIE_FACES = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
    var DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    var DIE_LAYOUT = [[1, 'front'], [6, 'back'], [3, 'right'], [4, 'left'], [2, 'top'], [5, 'bottom']];
    var DIE_TILT = 'rotateX(-22deg) rotateY(-28deg)'; // leve inclinación fija para que se vean el techo y un costado
    function buildDie() {
      var el = document.createElement('div'), cube = document.createElement('div');
      el.className = 'die'; el.setAttribute('aria-hidden', 'true'); cube.className = 'cube'; el.appendChild(cube);
      // núcleo rojo liso: tapa los huecos de los vértices (las caras tienen esquinas redondeadas)
      DIE_LAYOUT.forEach(function (f) { var core = document.createElement('div'); core.className = 'core ' + f[1]; cube.appendChild(core); });
      DIE_LAYOUT.forEach(function (f) {
        var face = document.createElement('div'); face.className = 'face ' + f[1];
        for (var i = 0; i < 9; i++) { var c = document.createElement('span'); if (DIE_PIPS[f[0]].indexOf(i) >= 0) c.className = 'on'; face.appendChild(c); }
        cube.appendChild(face);
      });
      cube.style.transform = DIE_TILT;
      return { el: el, cube: cube, cx: 0, cy: 0 };
    }
    // Gira el dado hasta dejar la cara `v` de frente, sumando vueltas completas (mínimo ~1.5) desde donde estaba.
    function spinDie(die, v, animate) {
      var f = DIE_FACES[v];
      die.cx = f[0] + 360 * Math.ceil((die.cx + 540 - f[0]) / 360 + Math.floor(Math.random() * 2));
      die.cy = f[1] + 360 * Math.ceil((die.cy + 540 - f[1]) / 360 + Math.floor(Math.random() * 2));
      die.cube.style.transition = animate ? 'transform 1.15s cubic-bezier(.15,.75,.25,1)' : 'none';
      die.cube.style.transform = DIE_TILT + ' rotateX(' + die.cx + 'deg) rotateY(' + die.cy + 'deg)';
      die.el.classList.remove('hop'); void die.el.offsetWidth; if (animate) die.el.classList.add('hop');
    }
    var diceBox = document.getElementById('dice'), diceTimer = null, diceBusy = false;
    diceBox.innerHTML = '<div class="dice-row"></div><b></b>';
    var diceRow = diceBox.firstChild, diceSum = diceRow.nextSibling;
    var dieA = buildDie(), dieB = buildDie(); diceRow.appendChild(dieA.el); diceRow.appendChild(dieB.el);
    // Estadística: cuántas veces salió cada total (2 a 12). Se reinicia con "Nuevo mapa" (partida nueva).
    var rollCounts = {}, statsEl = document.getElementById('stats'), chartEl = document.getElementById('chart'), statsN = document.getElementById('statsN');
    var statBars = {}, PLOT_H = 130, BAR_STEP = 20;
    for (var sn = 2; sn <= 12; sn++) {
      var statCol = document.createElement('div'); statCol.className = 'col';
      statCol.innerHTML = '<div class="plot"><div class="fill"></div></div><span class="lbl">' + sn + '</span>';
      chartEl.appendChild(statCol); statBars[sn] = statCol.firstChild.firstChild; rollCounts[sn] = 0;
    }
    function updateStats() {
      var max = 1, total = 0, n;
      for (n = 2; n <= 12; n++) { max = Math.max(max, rollCounts[n]); total += rollCounts[n]; }
      // cada tirada agrega un escalón fijo a su barra; recién cuando la más alta llena el gráfico se achica el escalón de todas
      var step = Math.min(BAR_STEP, PLOT_H / max);
      for (n = 2; n <= 12; n++) {
        var c = rollCounts[n], bar = statBars[n];
        bar.textContent = c || '';
        bar.style.height = c ? Math.max(16, Math.round(c * step)) + 'px' : '0';
      }
      statsN.textContent = total ? '· ' + total + (total === 1 ? ' tirada' : ' tiradas') : '';
    }
    updateStats();
    // La tirada la decide el motor (servidor autoritativo); acá solo se anima (ver playEvents): la pantalla revela el resultado
    // cuando los dados terminan de caer, y mientras tanto los botones y marcadores quedan bloqueados (busy).
    function rollDice() {
      if (busy || !game || game.phase.kind !== 'roll') return;
      busy = true; // también cubre la espera de la respuesta de la sesión
      session.send({ type: 'rollDice', player: game.turn }).then(function (r) {
        if (!r.ok) { busy = false; showStatus(r.error.message, true); return; }
        playEvents(r.events);
      });
    }

    // Qué casilla le dio qué a quién en una tirada (para animar los iconos). El motor solo informa el total por jugador y
    // recurso; se reparte entre las casillas en el mismo orden, así que si el banco no alcanzó, se anima solo lo que se entregó.
    function rollJobs(state, total, gains) {
      var left = {}, jobs = [];
      gains.forEach(function (g) { var k = g.player + ':' + g.resource; left[k] = (left[k] || 0) + g.amount; });
      topology().tiles.forEach(function (et) {
        var terr = state.map.terrains[et.id];
        if (terr === 'desert' || state.map.numbers[et.id] !== total || state.robber === et.id) return;
        var per = {};
        et.vertices.forEach(function (vid) { var bd = state.vertexBuildings[vid]; if (bd) per[bd.player] = (per[bd.player] || 0) + (bd.city ? 2 : 1); });
        Object.keys(per).forEach(function (p) {
          var k = p + ':' + terr, n = Math.min(per[p], left[k] || 0);
          if (n > 0) { left[k] -= n; jobs.push({ t: tiles[et.id], p: +p, k: terr, n: n }); }
        });
      });
      return jobs;
    }


    // ------------------------------------------------------------------ jugadores y partida local
    // Partida local de 4 jugadores en el mismo navegador ("hot-seat"): el banner de recursos muestra la mano del jugador de turno
    // (VIEWER) con su color, y su puesto se resalta. Las manos y los puntos que se ven son un reflejo del estado del motor
    // (game); los iconos que vuelan hacia el banner actualizan `myHand` y `counts` a medida que llegan. Con multijugador, VIEWER será
    // siempre el jugador de este navegador y los nombres vendrán de la sala.
    var HAND_KINDS = ['forest', 'hills', 'pasture', 'fields', 'mountains'];
    // Cartas de desarrollo (nombres propios). Lo que se puede jugar y cuándo lo decide el motor (legalActions); acá solo se explica.
    var DEV_ORDER = ['knight', 'monopoly', 'yearOfPlenty', 'roadBuilding', 'victoryPoint'];
    var DEV = {
      knight: { name: 'Gaucho', desc: 'Mové el ladrón y robá una carta.', play: 'playKnight' },
      monopoly: { name: 'Acopio', desc: 'Elegí un recurso: todos te entregan el que tengan.', play: 'playMonopoly' },
      yearOfPlenty: { name: 'Buena cosecha', desc: 'Tomá 2 recursos del banco (o 1 si queda una sola carta).', play: 'playYearOfPlenty' },
      roadBuilding: { name: 'Vialidad', desc: 'Poné 2 caminos gratis.', play: 'playRoadBuilding' },
      victoryPoint: { name: 'Punto de victoria', desc: 'Vale 1 punto. Queda oculta hasta que ganes.', play: null }
    };
    var BADGE_ROAD = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="8" width="16" height="4.5" rx="1.5" transform="rotate(-25 10 10)" fill="currentColor"/></svg>';
    var BADGE_ARMY = '<svg viewBox="0 0 20 20" aria-hidden="true"><ellipse cx="10" cy="13.5" rx="8.5" ry="2.4" fill="currentColor"/><path d="M5 13.5c0-5 2-7.5 5-7.5s5 2.5 5 7.5z" fill="currentColor"/></svg>';
    var PLAYER_INFO = [
      { name: 'Tomás', css: '#d94141', text: '#ffffff', skin: '#f1c9a5', hair: '#5a3a22', hat: true },
      { name: 'Lucía', css: '#3b6fd6', text: '#ffffff', skin: '#c98f66', hair: '#2b2118', hat: false },
      { name: 'Mateo', css: '#f0932b', text: '#2b1a05', skin: '#8d5a3b', hair: '#2b2118', hat: true },
      { name: 'Sofía', css: '#f1eee6', text: '#2b2216', skin: '#f4d3b5', hair: '#a3402b', hat: false }
    ];
    if (online) opts.seats.forEach(function (st, i) { if (PLAYER_INFO[i]) PLAYER_INFO[i].name = st.name; }); // los nombres vienen de la sala
    function avatarSVG(p) {
      var i = PLAYER_INFO[p];
      return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#e7dfcc"/>' +
        '<path d="M5 40 Q8 28 20 28 Q32 28 35 40Z" fill="' + i.css + '" stroke="#3b2a18" stroke-width="1.5"/>' +
        '<circle cx="20" cy="18" r="8" fill="' + i.skin + '" stroke="#3b2a18" stroke-width="1.5"/>' +
        '<path d="M11.5 17 Q12 8 20 8 Q28 8 28.5 17 Q24 12 20 12 Q16 12 11.5 17Z" fill="' + i.hair + '"/>' +
        (i.hat ? '<ellipse cx="20" cy="10.5" rx="13" ry="3" fill="#2b2118"/><path d="M13 10.5 Q13 3 20 3 Q27 3 27 10.5Z" fill="#2b2118"/>' : '') +
        '<circle cx="17" cy="19" r="1" fill="#2b2118"/><circle cx="23" cy="19" r="1" fill="#2b2118"/></svg>';
    }
    var handEl = stage.querySelector('.hand'), whoEl = document.getElementById('who'), seatsEl = document.getElementById('seats');
    var STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1.5 12.6,7.2 18.8,7.8 14.1,12 15.5,18.2 10,15 4.5,18.2 5.9,12 1.2,7.8 7.4,7.2" fill="#f2c230" stroke="#7a5a10" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    var vps = [0, 0, 0, 0]; // puntos de victoria que se ven: casas, estancias y reconocimientos (los Puntos de victoria ajenos no se ven)
    var devCounts = [0, 0, 0, 0], knights = [0, 0, 0, 0], roadLens = [0, 0, 0, 0], awardRoad = { holder: null, length: 0 }, awardArmy = { holder: null, size: 0 }; // cartas de desarrollo por jugador (cuántas, no cuáles), caballeros jugados y quién tiene cada reconocimiento
    var myHand = {}, counts = [], turn = 0, VIEWER = 0; // myHand: la mano de quien mira; counts: cartas de cada jugador (de los demás solo se sabe cuántas); VIEWER: el jugador cuya mano muestra el banner (en la partida local, el de turno)
    seatsEl.innerHTML = PLAYER_INFO.map(function (pl, p) {
      return '<div class="seat" data-p="' + p + '" style="--pc:' + pl.css + '"><div class="av">' + avatarSVG(p) + '</div><span class="nm">' + pl.name + '</span>' +
        '<span class="vp" title="Puntos de victoria">' + STAR + '<b>0</b></span>' +
        '<span class="cnt"><svg viewBox="0 0 16 20" aria-hidden="true"><rect x="2" y="2" width="12" height="16" rx="2" fill="#f6ecd4" stroke="#5b4630" stroke-width="1.6"/></svg><b>0</b></span>' +
        '<span class="dv" title="Cartas de desarrollo" hidden><svg viewBox="0 0 16 20" aria-hidden="true"><rect x="2" y="2" width="12" height="16" rx="2" fill="#8f2a2a" stroke="#e8d6a0" stroke-width="1.6"/></svg><b>0</b></span>' +
        '<span class="aw"><span class="bdg road" title="Ruta más larga">' + BADGE_ROAD + '<b></b></span><span class="bdg army" title="Gauchos jugados">' + BADGE_ARMY + '<b></b></span></span></div>';
    }).join('');
    if (online) for (var si = opts.seats.length; si < seatsEl.children.length; si++) seatsEl.children[si].hidden = true; // partidas de 3: sin el 4.º puesto
    function handTotal(p) { return counts[p]; }
    function renderHand() {
      var pl = PLAYER_INFO[VIEWER];
      handEl.style.setProperty('--pc', pl.css); handEl.style.setProperty('--pt', pl.text);
      whoEl.innerHTML = '<div class="av">' + avatarSVG(VIEWER) + '</div><span class="nm">' + pl.name + '</span><span class="vp" title="Puntos de victoria">' + STAR + '<b>' + vps[VIEWER] + '</b></span>';
      HAND_KINDS.forEach(function (k) { handEl.querySelector('[data-res="' + k + '"] b').textContent = myHand[k]; });
    }
    function renderSeats() {
      Array.prototype.forEach.call(seatsEl.children, function (s, p) {
        s.classList.toggle('on', p === turn); s.querySelector('.cnt b').textContent = handTotal(p); s.querySelector('.vp b').textContent = vps[p];
        var dv = s.querySelector('.dv'), rd = s.querySelector('.bdg.road'), ar = s.querySelector('.bdg.army');
        dv.hidden = !devCounts[p]; dv.querySelector('b').textContent = devCounts[p];
        rd.classList.toggle('held', awardRoad.holder === p); rd.querySelector('b').textContent = roadLens[p]; rd.title = awardRoad.holder === p ? 'Tiene la Ruta más larga (' + roadLens[p] + ')' : 'Ruta más larga propia: ' + roadLens[p] + ' (hacen falta ' + game.config.longestRoadMin + ' y superar al resto)';
        ar.classList.toggle('held', awardArmy.holder === p); ar.querySelector('b').textContent = knights[p]; ar.title = awardArmy.holder === p ? 'Tiene la Montonera más grande (' + knights[p] + ' gauchos)' : 'Gauchos jugados: ' + knights[p] + ' (hacen falta ' + game.config.largestArmyMin + ' y superar al resto)';
      });
    }
    // Copia las manos y los puntos del estado del motor a lo que se ve en pantalla.
    function syncHands() {
      myHand = {}; HAND_KINDS.forEach(function (k) { myHand[k] = game.hand[k]; });
      counts = game.players.map(function (pl) { return pl.handCount; });
      vps = game.players.map(function (pl) { return pl.points; });
      devCounts = game.players.map(function (pl) { return pl.devCount; });
      knights = game.players.map(function (pl) { return pl.knights; });
      roadLens = game.players.map(function (pl) { return pl.roadLength; });
      awardRoad = { holder: game.longestRoad.holder, length: game.longestRoad.length };
      awardArmy = { holder: game.largestArmy.holder, size: game.largestArmy.size };
    }
    function resetPlayers() { VIEWER = me; turn = game.turn; syncHands(); renderHand(); renderSeats(); }
    // Pone la pantalla al día con el estado (banner del jugador de turno, puestos, ladrón, marcadores, botones y diálogos).
    function applyView() { VIEWER = me; turn = game.turn; syncHands(); renderHand(); renderSeats(); syncRobber(); refreshUi(); setOrbit(game.phase.kind === 'finished'); } // al recargar una partida terminada gira; con una nueva vuelve a la vista de siempre
    function refreshUi() { refreshMarkers(); updateControls(); renderDialog(); showStatus(statusText(), false); }

    // El ladrón se dibuja sobre la casilla del estado (con un saltito al llegar). Fuera del desierto va corrido hacia adelante
    // para no tapar la ficha del número.
    function syncRobber() {
      if (!robber || robberTile === shown.robber) return;
      var t = tiles[shown.robber];
      robberTile = shown.robber;
      t.group.add(robber);
      robber.position.x = t.kind === 'desert' ? 0.05 : 0; robber.position.z = t.kind === 'desert' ? 0.03 : 0.5;
      robberPulse = 1;
    }

    // Botón único de turno. Antes de tirar: dos dados. Después de tirar: flecha con el color de quien sigue.
    var btnTurn = document.getElementById('btnTurn'), btnDev = document.getElementById('btnDev'), btnTrade = document.getElementById('btnTrade'), btnCards = document.getElementById('btnCards'), cardsN = document.getElementById('cardsN');
    function dieSVG(x, y, rot, pips) {
      return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ' 13 13)"><rect width="26" height="26" rx="6" fill="#d94141" stroke="#7a1f1f" stroke-width="2"/>' +
        pips.map(function (i) { return '<circle cx="' + (6.5 + (i % 3) * 6.5) + '" cy="' + (6.5 + Math.floor(i / 3) * 6.5) + '" r="2.2" fill="#fff"/>'; }).join('') + '</g>';
    }
    var TURN_DICE = '<svg viewBox="0 0 64 48" aria-hidden="true">' + dieSVG(3, 14, -10, [0, 4, 8]) + dieSVG(35, 7, 9, [0, 2, 4, 6, 8]) + '</svg>';
    var TURN_ARROW = '<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h24M22 9.5 32.5 20 22 30.5"/></svg>';
    function updateTurnButton() {
      var ph = game.phase.kind, on = (ph === 'roll' || ph === 'main') && game.turn === me; // en línea, el botón de turno es solo de quien juega
      if (busy && !btnTurn.hidden) { btnTurn.disabled = true; return; } // durante la tirada (dados rodando, recursos volando) queda como estaba: con un 7 la fase cambia enseguida y el ícono desaparecería antes de ver el número
      btnTurn.hidden = !on;
      if (!on) { btnTurn.removeAttribute('data-key'); return; }
      btnTurn.disabled = busy;
      var next = (game.turn + 1) % game.players.length, key = ph + ':' + next;
      if (btnTurn.getAttribute('data-key') === key) return;
      btnTurn.setAttribute('data-key', key); btnTurn.setAttribute('data-mode', ph);
      var label;
      if (ph === 'roll') {
        btnTurn.innerHTML = TURN_DICE; label = 'Tirar dados';
      } else {
        var n = PLAYER_INFO[next];
        btnTurn.style.setProperty('--pc', n.css); btnTurn.style.setProperty('--pt', n.text);
        btnTurn.innerHTML = TURN_ARROW; label = 'Pasar el turno a ' + n.name;
      }
      btnTurn.setAttribute('aria-label', label); btnTurn.title = label;
    }
    // Carta de desarrollo: un botón más de la bandeja; se habilita en fase main si la mano alcanza para pagarla.
    function updateDevButton() {
      var can = !busy && game.turn === me && legal.some(function (a) { return a.type === 'buyDevCard'; }); // alcanza la mano y quedan cartas: lo dice el motor
      btnDev.disabled = !can;
      if (!can && pendingCmd && pendingCmd.type === 'buyDevCard') { pendingCmd = null; renderDialog(); }
    }
    function updateControls() {
      var ph = game.phase.kind, acts = legal, can = {};
      acts.forEach(function (a) { can[a.type] = true; });
      updateTurnButton(); updateDevButton();
      if (tradeUI && (busy || !can.bankTrade)) tradeUI = null; // ya no se puede comerciar (otra fase, o la mano no alcanza)
      btnTrade.disabled = busy || !can.bankTrade; pressed(btnTrade, !!tradeUI);
      var nDev = devTotal();
      if (cardsUI && (busy || nDev === 0)) cardsUI = null; // no hay nada que mostrar (o corre una animación)
      btnCards.disabled = busy || nDev === 0; pressed(btnCards, !!cardsUI); cardsN.textContent = nDev || '';
      buildEl.hidden = ph === 'setup' || ph === 'finished';
      if (!can[{ road: 'buildRoad', settlement: 'buildSettlement', city: 'buildCity' }[buildMode]]) buildMode = null; // ya no alcanza o no hay dónde
      Array.prototype.forEach.call(buildEl.querySelectorAll('[data-build]'), function (b) {
        var kind = b.getAttribute('data-build');
        b.disabled = busy || ph === 'roadBuilding' || !can[{ road: 'buildRoad', settlement: 'buildSettlement', city: 'buildCity' }[kind]]; // con Vialidad los caminos se ponen gratis, sin este botón
        pressed(b, buildMode === kind);
      });
    }

    function statusText() {
      // Si el que juega es quien mira (VIEWER) se le habla de vos; si no, se nombra a esa persona.
      var ph = game.phase, name = PLAYER_INFO[game.turn].name, me = game.turn === VIEWER;
      switch (ph.kind) {
        case 'setup': {
          var fase = ph.step < game.players.length ? 'fase 1, sentido horario' : 'fase 2, sentido antihorario';
          return (me ? 'Tu turno' : name) + ' · ' + fase + ': ' + (ph.part === 'settlement' ? (me ? 'tocá un punto para colocar tu casa' : 'coloca su casa') : (me ? 'tocá un camino junto a tu casa' : 'coloca su camino'));
        }
        case 'roll': return me ? 'Tu turno: jugá los dados' : 'Turno de ' + name;
        case 'main':
          if (buildMode) return me ? { road: 'Elegí dónde va el camino', settlement: 'Elegí dónde va la casa', city: 'Elegí qué casa mejorar' }[buildMode] : 'Turno de ' + name;
          return me ? 'Tu turno' : 'Turno de ' + name;
        case 'discard': return me ? 'Salió un 7: descartá ' + ph.queue[0].count + ' cartas' : name + ' descarta ' + ph.queue[0].count + ' cartas';
        case 'moveRobber': return me ? 'Mové el ladrón' : name + ' mueve el ladrón';
        case 'roadBuilding': return me ? 'Vialidad: elegí dónde va el camino gratis (' + (ph.left === 2 ? 'faltan 2' : 'falta 1') + ')' : name + ' pone caminos gratis';
        case 'steal': return me ? 'Elegí a quién robarle una carta' : name + ' elige a quién robarle';
        default: return ph.winner === VIEWER ? '¡Ganaste la partida con ' + vps[ph.winner] + ' puntos!' : '¡' + PLAYER_INFO[ph.winner].name + ' ganó la partida con ' + vps[ph.winner] + ' puntos!';
      }
    }
    var statusEl = document.getElementById('status'), statusTimer = null;
    // Muestra un mensaje. Los errores y avisos "temporales" vuelven solos al texto de siempre.
    function showStatus(text, isError, temporary, who) {
      clearTimeout(statusTimer);
      statusEl.innerHTML = '<i style="background:' + PLAYER_INFO[who !== undefined ? who : game.turn].css + '"></i><span></span>';
      statusEl.lastChild.textContent = text;
      statusEl.classList.toggle('error', !!isError);
      if (isError || temporary) statusTimer = setTimeout(function () { showStatus(statusText(), false); }, isError ? 2500 : 4000);
    }

    // Diálogo: descartar cartas (con un 7) o elegir a quién robarle. La selección se reinicia cuando cambia quién tiene que actuar.
    var dialogEl = document.getElementById('dialog'), buildEl = document.getElementById('build');
    function resIcon(k) { return handEl.querySelector('[data-res="' + k + '"] svg').outerHTML; }
    function renderDialog() {
      var ph = game.phase;
      if (pendingCmd && (busy || pendingCmd.player !== game.turn)) pendingCmd = null;
      stage.toggleAttribute('data-confirm', !!pendingCmd); // con una confirmación abierta, el texto de estado se oculta para no quedar debajo
      if (pendingCmd) {
        dialogKey = ''; if (pendingCmd.type === 'buyDevCard') clearGhost(); else showGhost(pendingCmd);
        dialogEl.className = 'panel dialog confirm';
        dialogEl.innerHTML = '<div class="yesno"><button type="button" class="no" data-cancel aria-label="Cancelar" title="Cancelar">✕</button><button type="button" class="yes" data-ok aria-label="Confirmar" title="Confirmar">✓</button></div>';
        dialogEl.hidden = false; placeConfirm();
        return;
      }
      clearGhost();
      dialogEl.className = 'panel dialog'; dialogEl.style.left = dialogEl.style.top = dialogEl.style.transform = '';
      if (tradeUI && !busy && ph.kind === 'main') { dialogKey = ''; renderTrade(); return; }
      if (cardsUI && !busy) { dialogKey = ''; renderCards(); return; }
      if (busy || game.turn !== me || (ph.kind !== 'discard' && ph.kind !== 'steal')) { dialogEl.hidden = true; dialogKey = ''; return; } // descartar y elegir víctima solo lo ve quien actúa
      var key = ph.kind + ':' + game.turn + ':' + (ph.kind === 'discard' ? ph.queue.length : ph.victims.join(','));
      if (key !== dialogKey) { dialogKey = key; discardSel = {}; }
      var html = '';
      if (ph.kind === 'discard') {
        var need = ph.queue[0].count, got = HAND_KINDS.reduce(function (a, k) { return a + (discardSel[k] || 0); }, 0);
        html = '<h3></h3><p>Elegidas ' + got + ' de ' + need + '</p><div class="rows">' + HAND_KINDS.filter(function (k) { return myHand[k] > 0; }).map(function (k) {
          return '<div class="row"><span class="ico">' + resIcon(k) + '</span><span class="nm">' + TERRAINS[k].res + '</span>' +
            '<button type="button" data-dec="' + k + '" aria-label="Menos ' + TERRAINS[k].res + '"' + ((discardSel[k] || 0) ? '' : ' disabled') + '>−</button>' +
            '<b>' + (discardSel[k] || 0) + ' / ' + myHand[k] + '</b>' +
            '<button type="button" data-inc="' + k + '" aria-label="Más ' + TERRAINS[k].res + '"' + ((discardSel[k] || 0) < myHand[k] && got < need ? '' : ' disabled') + '>+</button></div>';
        }).join('') + '</div><button type="button" class="primary" data-confirm' + (got === need ? '' : ' disabled') + '>Descartar</button>';
      } else {
        html = '<h3></h3><div class="victims">' + ph.victims.map(function (v) {
          var total = counts[v];
          return '<button type="button" class="victim" data-victim="' + v + '" style="--pc:' + PLAYER_INFO[v].css + '"><span class="av">' + avatarSVG(v) + '</span><span>' + PLAYER_INFO[v].name + '</span><small>' + total + ' cartas</small></button>';
        }).join('') + '</div>';
      }
      dialogEl.innerHTML = html;
      dialogEl.querySelector('h3').textContent = ph.kind === 'discard' ? 'Descartá ' + ph.queue[0].count + ' cartas' : '¿A quién le robás?';
      dialogEl.hidden = false;
    }
    // Comerciar con el banco: dos filas de fichas (doy / recibo). Lo que se puede entregar, la tasa y lo que se puede pedir salen de
    // la acción bankTrade de legalActions; acá no se calcula ninguna regla.
    var tradeUI = null; // { give, get } elegidos (null = panel cerrado)
    // Mis cartas: las cartas de desarrollo de la mano y, para Acopio y Buena cosecha, la elección de recursos. Qué se puede jugar y
    // cuándo lo dice el motor (legalActions); acá solo se explica por qué una carta no se puede jugar ahora.
    var cardsUI = null; // { mode: 'hand' | 'monopoly' | 'plenty', res, picks } (null = panel cerrado)
    function devTotal() { var n = 0; DEV_ORDER.forEach(function (k) { n += game.dev.hand[k]; }); return n; }
    function cardReason(k, can) {
      var d = game.dev, ph = game.phase.kind;
      if (!DEV[k].play) return '';
      if (game.turn !== me) return 'Esperá tu turno';
      if (d.hand[k] - d.fresh[k] <= 0) return 'La compraste en este turno: se juega desde el próximo';
      if (d.played) return 'Ya jugaste una carta en este turno';
      if (ph !== 'main' && ph !== 'roll') return 'Ahora no se puede jugar';
      if (!can[DEV[k].play]) return k === 'roadBuilding' ? 'No tenés dónde poner caminos' : k === 'yearOfPlenty' ? 'El banco casi no tiene cartas' : 'Ahora no se puede jugar';
      return '';
    }
    function resChips(enabled, selected, count) {
      return '<div class="pick">' + HAND_KINDS.map(function (k) {
        return '<button type="button" data-res="' + k + '" aria-pressed="' + (selected(k) ? 'true' : 'false') + '"' + (enabled(k) ? '' : ' disabled') +
          ' style="--c:' + handEl.querySelector('[data-res="' + k + '"]').style.getPropertyValue('--c') + '" title="' + TERRAINS[k].res + '"><span class="ico">' + resIcon(k) + '</span><small>' + (count(k) ? '×' + count(k) : '&nbsp;') + '</small></button>';
      }).join('') + '</div>';
    }
    function renderCards() {
      var can = {}, d = game.dev, html;
      legal.forEach(function (a) { can[a.type] = a; });
      dialogEl.className = 'panel dialog trade cards';
      function yesno(ok) { return '<div class="yesno"><button type="button" class="no" data-cancel aria-label="Volver" title="Volver">✕</button><button type="button" class="yes" data-ok aria-label="Confirmar" title="Confirmar"' + (ok ? '' : ' disabled') + '>✓</button></div>'; }
      if (cardsUI.mode === 'monopoly') {
        html = '<h3>Acopio</h3><p>¿Qué recurso querés que te entreguen?</p>' +
          resChips(function () { return true; }, function (k) { return cardsUI.res === k; }, function () { return 0; }) +
          '<div class="sum">' + (cardsUI.res ? 'Todos te dan su ' + TERRAINS[cardsUI.res].res.toLowerCase() : 'Elegí un recurso') + '</div>' + yesno(!!cardsUI.res);
      } else if (cardsUI.mode === 'plenty') {
        var avail = can.playYearOfPlenty ? can.playYearOfPlenty.resources : [], picks = cardsUI.picks, need = can.playYearOfPlenty ? can.playYearOfPlenty.count : 2;
        html = '<h3>Buena cosecha</h3><p>' + (need === 1 ? 'El banco solo tiene 1 carta: elegí 1 recurso.' : 'Elegí 2 recursos del banco.') + '</p>' +
          resChips(function (k) { return avail.indexOf(k) >= 0 && picks.length < need; }, function (k) { return picks.indexOf(k) >= 0; }, function (k) { return picks.filter(function (x) { return x === k; }).length; }) +
          '<div class="sum">' + (picks.length ? picks.map(function (k) { return TERRAINS[k].res; }).join(' + ') : (need === 1 ? 'Elegí 1 recurso' : 'Elegí 2 recursos')) + '</div>' +
          (picks.length ? '<button type="button" class="clear" data-clear>Borrar elección</button>' : '') + yesno(picks.length === need);
      } else {
        html = '<button type="button" class="x" data-close aria-label="Cerrar" title="Cerrar">✕</button><h3>Tus cartas</h3><p>Una por turno, y no la que compraste en este mismo turno.</p><div class="cardgrid">' +
          DEV_ORDER.filter(function (k) { return d.hand[k] > 0; }).map(function (k) {
            var reason = cardReason(k, can), fresh = d.fresh[k];
            return '<div class="dcard' + (reason ? ' off' : '') + '" title="' + DEV[k].desc + '"><div class="pic"><img src="' + devCardURL(k) + '" alt="' + DEV[k].name + '" draggable="false">' +
              '<span class="qty">×' + d.hand[k] + '</span>' + (fresh ? '<span class="new">' + (fresh > 1 ? fresh + ' nuevas' : 'nueva') + '</span>' : '') + '</div>' +
              (DEV[k].play ? '<button type="button" data-play="' + k + '"' + (reason ? ' disabled' : '') + '>Jugar</button>' : '') +
              '<small>' + (DEV[k].play ? DEV[k].desc : 'Punto oculto') + '</small></div>'; // sin explicar por qué no se puede jugar: la carta atenuada alcanza
          }).join('') + '</div>';
      }
      dialogEl.innerHTML = html;
      dialogEl.hidden = false;
    }
    function plentyNeed() { var a = legal.filter(function (x) { return x.type === 'playYearOfPlenty'; })[0]; return a ? a.count : 2; } // cuántas cartas pide Buena cosecha (2, o 1 si el banco casi no tiene)
    function tradeOptions() {
      var a = legal.filter(function (x) { return x.type === 'bankTrade'; })[0];
      return a ? a.trades : [];
    }
    function renderTrade() {
      var trades = tradeOptions(), byGive = {};
      trades.forEach(function (t) { byGive[t.give] = t; });
      if (tradeUI.give && !byGive[tradeUI.give]) tradeUI.give = tradeUI.get = null;
      if (tradeUI.get && (!tradeUI.give || byGive[tradeUI.give].get.indexOf(tradeUI.get) < 0)) tradeUI.get = null;
      var give = tradeUI.give && byGive[tradeUI.give];
      function chips(attr, sel, enabled, label) {
        return '<div class="pick">' + HAND_KINDS.map(function (k) {
          var on = enabled(k), lab = label(k);
          return '<button type="button" data-' + attr + '="' + k + '" aria-pressed="' + (sel === k ? 'true' : 'false') + '"' + (on ? '' : ' disabled') +
            ' style="--c:' + handEl.querySelector('[data-res="' + k + '"]').style.getPropertyValue('--c') + '" title="' + TERRAINS[k].res + '"><span class="ico">' + resIcon(k) + '</span><small>' + lab + '</small></button>';
        }).join('') + '</div>';
      }
      dialogEl.className = 'panel dialog trade';
      dialogEl.innerHTML = '<h3>Comerciar con el banco</h3><p>Doy</p>' +
        chips('give', tradeUI.give, function (k) { return !!byGive[k]; }, function (k) { return byGive[k] ? byGive[k].rate + ':1' : '&nbsp;'; }) +
        '<p>Recibo</p>' +
        chips('get', tradeUI.get, function (k) { return !!give && give.get.indexOf(k) >= 0; }, function () { return '1'; }) +
        '<div class="sum">' + (give && tradeUI.get ? give.rate + ' × ' + TERRAINS[tradeUI.give].res + ' → 1 × ' + TERRAINS[tradeUI.get].res : 'Elegí qué dar y qué recibir') + '</div>' +
        '<div class="yesno"' + (give && tradeUI.get ? '' : ' style="visibility:hidden"') + '><button type="button" class="no" data-cancel aria-label="Cancelar" title="Cancelar">✕</button><button type="button" class="yes" data-ok aria-label="Confirmar" title="Confirmar">✓</button></div>';
      dialogEl.hidden = false;
    }
    dialogEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled || busy) return;
      if (pendingCmd) {
        var cmd = pendingCmd; pendingCmd = null;
        if (b.hasAttribute('data-ok')) confirmDrop(cmd); else renderDialog();
        return;
      }
      if (cardsUI) {
        if (b.hasAttribute('data-close')) cardsUI = null;
        else if (b.hasAttribute('data-cancel')) cardsUI = cardsUI.mode === 'hand' ? null : { mode: 'hand', res: null, picks: [] };
        else if (b.hasAttribute('data-play')) {
          var dk = b.getAttribute('data-play');
          if (dk === 'monopoly') cardsUI = { mode: 'monopoly', res: null, picks: [] };
          else if (dk === 'yearOfPlenty') cardsUI = { mode: 'plenty', res: null, picks: [] };
          else { cardsUI = null; dispatch({ type: DEV[dk].play, player: game.turn }); return; } // Gaucho y Vialidad siguen sobre el tablero
        } else if (b.hasAttribute('data-res')) {
          var rk = b.getAttribute('data-res');
          if (cardsUI.mode === 'monopoly') cardsUI.res = rk; else if (cardsUI.picks.length < plentyNeed()) cardsUI.picks.push(rk);
        } else if (b.hasAttribute('data-clear')) cardsUI.picks = [];
        else if (b.hasAttribute('data-ok')) {
          var ui = cardsUI; cardsUI = null;
          dispatch(ui.mode === 'monopoly' ? { type: 'playMonopoly', player: game.turn, resource: ui.res } : { type: 'playYearOfPlenty', player: game.turn, resources: ui.picks.slice() });
          return;
        }
        refreshUi();
        return;
      }
      if (tradeUI) {
        if (b.hasAttribute('data-give')) tradeUI.give = b.getAttribute('data-give');
        else if (b.hasAttribute('data-get')) tradeUI.get = b.getAttribute('data-get');
        else if (b.hasAttribute('data-cancel')) { tradeUI = null; refreshUi(); return; }
        else if (b.hasAttribute('data-ok')) { dispatch({ type: 'bankTrade', player: game.turn, give: tradeUI.give, get: tradeUI.get }); return; }
        renderDialog();
        return;
      }
      var ph = game.phase;
      if (ph.kind === 'discard') {
        if (b.hasAttribute('data-inc')) discardSel[b.getAttribute('data-inc')] = (discardSel[b.getAttribute('data-inc')] || 0) + 1;
        else if (b.hasAttribute('data-dec')) discardSel[b.getAttribute('data-dec')] = (discardSel[b.getAttribute('data-dec')] || 0) - 1;
        else if (b.hasAttribute('data-confirm')) { dispatch({ type: 'discard', player: game.turn, cards: discardSel }); return; }
        renderDialog();
      } else if (ph.kind === 'steal' && b.hasAttribute('data-victim')) dispatch({ type: 'steal', player: game.turn, victim: +b.getAttribute('data-victim') });
    });

    // Envía un comando al motor: si lo acepta, actualiza el tablero; si no, muestra el error.
    // Jugada de construcción a la espera del ✓ / ✕ del jugador.
    var pendingCmd = null;
    function askConfirm(cmd) { pendingCmd = cmd; renderDialog(); }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (pendingCmd) { pendingCmd = null; renderDialog(); }
      else if (tradeUI) { tradeUI = null; refreshUi(); }
      else if (cardsUI) { cardsUI = cardsUI.mode === 'hand' ? null : { mode: 'hand', res: null, picks: [] }; refreshUi(); }
    });
    function dispatch(cmd) {
      if (sending) return;
      pendingCmd = null;
      sending = true;
      session.send(cmd).then(function (r) { sending = false; settle(cmd, r); });
    }
    // Respuesta de la sesión a un comando: la pantalla se pone al día (con animaciones) recién acá, no antes.
    function settle(cmd, r) {
      if (!r.ok) { showStatus(r.error.message, true); renderDialog(); return; }
      tradeUI = null; cardsUI = null; buildMode = null;
      if (cmd.type === 'buyDevCard') audio.card(); // la carta propia suena al comprarla (las de otros, al reproducir el evento)
      var landed = { placeRoad: 'road', buildRoad: 'road', placeSettlement: 'settlement', buildSettlement: 'settlement', buildCity: 'city' }[cmd.type];
      if (landed) audio.land(landed); // la pieza toca el tablero
      playEvents(r.events);
    }

    // En línea, lo que hacen los demás llega por la sesión (polling): se reproduce igual que lo propio, en orden.
    if (online) {
      unsubscribe = opts.session.subscribe(function (v, events) {
        if (!events.length) return;
        if (playing || busy || sending) queue.push(events); else playEvents(events);
      });
    }

    // ------------------------------------------------------------------ reproducción de eventos
    // Lo que pasó después de un comando (lo propio y, contra bots, lo de los demás) llega como una lista de eventos. Se
    // reproducen en orden, con pausas cortas cuando actúa otro jugador, para que se vea qué hizo cada uno. `game` (la vista)
    // recién se actualiza al final; mientras tanto `shown` es lo ya dibujado y `counts`, `myHand` y `vps` avanzan al ritmo
    // de la animación (al terminar se corrigen con el estado real: si algo quedó corrido, se arregla solo).
    function foreign(p) { return withOthers && p !== VIEWER; } // jugadas de otro: llevan pausa y sonido
    var BOT_GAP_MS = 2000; // «piensa» este rato antes de cada acción de otro, para que se pueda seguir lo que hace
    function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function sumOf(o) { var n = 0; for (var k in o) n += o[k]; return n; }
    var playing = false, queue = []; // queue: tandas de eventos de otros que llegaron mientras se reproducía otra
    function playEvents(events) {
      var animate = !reduced(), i = 0, note = null;
      playing = true;
      busy = true; refreshUi();
      function pause(cont, ms) { if (animate && ms > 0) setTimeout(cont, ms); else cont(); }
      // Antes de una acción de otro jugador: espera BOT_GAP_MS. `spent`: la acción abre con ResourcesSpent (construir); su pieza
      // llega justo después y no vuelve a esperar.
      function gap(p, cont, again) { if (!again && foreign(p)) return pause(cont, BOT_GAP_MS); return cont(); }
      function afterSpent(ev) { var prev = events[i - 2]; return !!prev && prev.type === 'ResourcesSpent' && prev.player === ev.player; }
      function take(type) { var e = events[i]; if (e && e.type === type) { i++; return e; } return null; }
      function next() {
        if (i >= events.length) {
          if (queue.length) { events = queue.shift(); i = 0; return next(); } // sigue con lo que llegó mientras tanto
          playing = false; busy = false; pull(); syncPieces(); applyView();
          if (note) showStatus(note.text, false, true, note.who); // el aviso del robo sobrevive al refresco
          return;
        }
        handle(events[i++], next);
      }
      // la tirada: dados rodando; el resultado y la producción aparecen cuando terminan de caer
      function rollAnim(ev, dist, cont) {
        var a = ev.dice[0], b = ev.dice[1], s = ev.total;
        clearTimeout(diceTimer);
        diceSum.textContent = '';
        diceBox.hidden = false;
        spinDie(dieA, a, animate); spinDie(dieB, b, animate);
        if (animate) audio.rollDice();
        diceTimer = setTimeout(function () {
          diceSum.textContent = s;
          rollCounts[s]++; updateStats();
          var dur = 0;
          if (s === 7) { robberPulse = 1; if (animate) audio.seven(); }
          else { tiles.forEach(function (t) { if (t.num === s) t.pulse = 1; }); dur = flyGains(rollJobs({ map: game.map, robber: shown.robber, vertexBuildings: shown.vertexBuildings }, s, dist ? dist.gains : []), animate); }
          diceTimer = setTimeout(function () { diceBox.hidden = true; }, 3200);
          setTimeout(cont, animate ? Math.max(dur, 900) : 0); // se sigue cuando terminan de llegar los recursos
        }, animate ? 1250 : 0);
      }
      function handle(ev, cont) {
        var p = ev.player;
        switch (ev.type) {
          case 'DiceRolled': return gap(p, function () { rollAnim(ev, take('ResourcesDistributed'), cont); });
          case 'SettlementBuilt': case 'CityBuilt': case 'RoadBuilt':
            return gap(p, function () { built(ev, cont); }, afterSpent(ev));
          case 'ResourcesSpent':
            return gap(p, function () {
              counts[p] -= sumOf(ev.cost);
              if (p === VIEWER) { for (var kc in ev.cost) myHand[kc] -= ev.cost[kc]; renderHand(); }
              renderSeats();
              cont();
            });
          case 'Discarded':
            return gap(p, function () {
              counts[p] -= sumOf(ev.cards);
              if (p === VIEWER) { for (var kd in ev.cards) myHand[kd] -= ev.cards[kd]; renderHand(); }
              renderSeats();
              if (foreign(p) && animate) pop(seatsEl.children[p], PLAYER_INFO[p].css);
              pause(cont, foreign(p) ? 550 : 0);
            });
          case 'RobberMoved':
            return gap(p, function () { shown.robber = ev.tile; syncRobber(); if (foreign(p) && animate) audio.robberMoved(); pause(cont, foreign(p) ? 800 : 0); });
          case 'BankTraded':
            return gap(p, function () {
              counts[p] += 1 - ev.giveCount; renderSeats();
              audio.trade();
              if (p === VIEWER) tradeFx(ev); else if (animate) pop(seatsEl.children[p], PLAYER_INFO[p].css);
              pause(cont, foreign(p) ? 600 : 0);
            });
          case 'DevCardBought':
            return gap(p, function () {
              devCounts[p]++; renderSeats();
              if (foreign(p)) audio.card();
              if (animate) pop(seatsEl.children[p], PLAYER_INFO[p].css);
              if (ev.kind) { showStatus('Compraste: ' + DEV[ev.kind].name, false, true, p); if (animate) revealCard(ev.kind); }
              else showStatus(PLAYER_INFO[p].name + ' compró una carta de desarrollo', false, true, p);
              pause(cont, foreign(p) ? 650 : 0);
            }, afterSpent(ev));
          case 'KnightPlayed':
            return gap(p, function () {
              devCounts[p] = Math.max(0, devCounts[p] - 1); knights[p]++; renderSeats();
              if (foreign(p)) audio.card();
              if (animate) pop(seatsEl.children[p], PLAYER_INFO[p].css);
              showStatus((p === VIEWER ? 'Jugaste un Gaucho' : PLAYER_INFO[p].name + ' jugó un Gaucho'), false, true, p);
              pause(cont, foreign(p) ? 900 : 0);
            });
          case 'MonopolyPlayed':
            return gap(p, function () {
              var total = 0, css = PLAYER_INFO[p].css;
              devCounts[p] = Math.max(0, devCounts[p] - 1);
              ev.taken.forEach(function (t) {
                total += t.amount; counts[t.player] -= t.amount;
                if (t.player === VIEWER) myHand[ev.resource] -= t.amount;
                if (animate) floatText(seatsEl.children[t.player], '−' + t.amount, PLAYER_INFO[t.player].css);
              });
              counts[p] += total; if (p === VIEWER) myHand[ev.resource] += total;
              renderSeats(); renderHand();
              if (foreign(p)) audio.card();
              if (animate) { pop(seatsEl.children[p], css); if (total) floatText(seatsEl.children[p], '+' + total, css); }
              showStatus((p === VIEWER ? 'Jugaste Acopio' : PLAYER_INFO[p].name + ' jugó Acopio') + ': ' + TERRAINS[ev.resource].res.toLowerCase() + (total ? ' (+' + total + ')' : ' (nadie tenía)'), false, true, p);
              pause(cont, 1100);
            });
          case 'YearOfPlentyPlayed':
            return gap(p, function () {
              devCounts[p] = Math.max(0, devCounts[p] - 1);
              ev.gains.forEach(function (g) {
                counts[g.player] += g.amount;
                if (g.player === VIEWER) myHand[g.resource] += g.amount;
              });
              renderSeats(); renderHand();
              if (foreign(p)) audio.card();
              if (animate) ev.gains.forEach(function (g) {
                var card = g.player === VIEWER ? handEl.querySelector('[data-res="' + g.resource + '"]') : seatsEl.children[g.player], col = g.player === VIEWER ? card.style.getPropertyValue('--c') : PLAYER_INFO[g.player].css;
                pop(card, col); floatText(card, '+' + g.amount, col);
              });
              showStatus((p === VIEWER ? 'Jugaste Buena cosecha' : PLAYER_INFO[p].name + ' jugó Buena cosecha'), false, true, p);
              pause(cont, 900);
            });
          case 'RoadBuildingPlayed':
            return gap(p, function () {
              devCounts[p] = Math.max(0, devCounts[p] - 1); renderSeats();
              if (foreign(p)) audio.card();
              if (animate) pop(seatsEl.children[p], PLAYER_INFO[p].css);
              showStatus((p === VIEWER ? 'Jugaste Vialidad' : PLAYER_INFO[p].name + ' jugó Vialidad') + ': 2 caminos gratis', false, true, p);
              pause(cont, foreign(p) ? 700 : 0);
            });
          case 'LongestRoadChanged': {
            var pts = game.config.awardPoints;
            awardRoad = { holder: ev.player, length: ev.length }; if (ev.player !== null) roadLens[ev.player] = ev.length;
            if (ev.from !== null) vps[ev.from] -= pts;
            if (ev.player !== null) vps[ev.player] += pts;
            renderSeats(); renderHand();
            if (animate && ev.player !== null) pop(seatsEl.children[ev.player], PLAYER_INFO[ev.player].css);
            showStatus(ev.player === null ? PLAYER_INFO[ev.from].name + ' perdió la Ruta más larga' : (ev.player === VIEWER ? 'Tenés' : PLAYER_INFO[ev.player].name + ' tiene') + ' la Ruta más larga (' + ev.length + ' caminos)', false, true, ev.player === null ? ev.from : ev.player);
            return pause(cont, 1000);
          }
          case 'LargestArmyChanged': {
            var apts = game.config.awardPoints;
            awardArmy = { holder: ev.player, size: ev.size };
            if (ev.from !== null) vps[ev.from] -= apts;
            vps[ev.player] += apts;
            renderSeats(); renderHand();
            if (animate) pop(seatsEl.children[ev.player], PLAYER_INFO[ev.player].css);
            showStatus((ev.player === VIEWER ? 'Tenés' : PLAYER_INFO[ev.player].name + ' tiene') + ' la Montonera más grande (' + ev.size + ' gauchos)', false, true, ev.player);
            return pause(cont, 1000);
          }
          case 'Stolen': return stolen(ev, cont);
          case 'GameWon': if (animate && ev.player === VIEWER) audio.victory(); setOrbit(true); return cont(); // solo suena si ganaste; el tablero empieza a girar en todos los casos
          case 'TurnChanged':
            turn = ev.player; renderSeats();
            if (withOthers) showStatus(ev.player === VIEWER ? 'Tu turno' : 'Turno de ' + PLAYER_INFO[ev.player].name, false, false, ev.player);
            return pause(cont, foreign(ev.player) ? 450 : 0);
          default: return cont(); // DiscardRequired, ResourcesDistributed suelto, GameWon: lo muestra el estado final
        }
      }
      function built(ev, cont) {
        var p = ev.player;
        {
            var kind = ev.type === 'RoadBuilt' ? 'road' : ev.type === 'CityBuilt' ? 'city' : 'settlement';
            if (kind === 'road') shown.edgeRoads[ev.edge] = p; else shown.vertexBuildings[ev.vertex] = { player: p, city: kind === 'city' };
            if (kind !== 'road') { vps[p] += 1; renderSeats(); if (p === VIEWER) renderHand(); }
            syncPieces();
            if (foreign(p)) audio.land(kind); // las propias ya sonaron al tocar
            var wait = foreign(p) ? 650 : 0;
            // la 2.ª casa de la colocación inicial cobra recursos: se animan desde las casillas que toca
            var got = kind === 'settlement' ? take('ResourcesDistributed') : null;
            if (got) {
              var jobs = [];
              topology().vertices[ev.vertex].tiles.forEach(function (tid) {
                var terr = game.map.terrains[tid];
                if (terr !== 'desert') jobs.push({ t: tiles[tid], p: p, k: terr, n: 1 });
              });
              wait = Math.max(wait, flyGains(jobs, animate));
            }
            return pause(cont, wait);
          }
      }
      function stolen(ev, cont) {
        if (ev.victim === VIEWER && animate) audio.robbed(); // la melodía es solo para quien perdió la carta
        if (ev.resource) { // los dos implicados ven qué carta fue
          note = { text: (ev.thief === VIEWER ? 'Le robaste ' : PLAYER_INFO[ev.thief].name + ' le robó ') + TERRAINS[ev.resource].res.toLowerCase() + ' a ' + PLAYER_INFO[ev.victim].name, who: ev.thief };
          showStatus(note.text, false, true, note.who);
          return pause(cont, flyGains([{ from: ev.victim, p: ev.thief, k: ev.resource, n: 1 }], animate));
        }
        note = { text: PLAYER_INFO[ev.thief].name + ' le robó una carta a ' + PLAYER_INFO[ev.victim].name, who: ev.thief }; // un tercero no ve cuál
        showStatus(note.text, false, true, note.who);
        counts[ev.victim] -= 1; counts[ev.thief] += 1; renderSeats();
        if (animate) { pop(seatsEl.children[ev.victim], PLAYER_INFO[ev.victim].css); pop(seatsEl.children[ev.thief], PLAYER_INFO[ev.thief].css); }
        return pause(cont, 700);
      }
      next();
    }
    function commandFromMarker(m) {
      var p = game.turn, setup = game.phase.kind === 'setup';
      if (m.type === 'tile') return { type: 'moveRobber', player: p, tile: m.id };
      if (m.type === 'vertex') return { type: setup ? 'placeSettlement' : buildMode === 'city' ? 'buildCity' : 'buildSettlement', player: p, vertex: m.id };
      return { type: setup ? 'placeRoad' : 'buildRoad', player: p, edge: m.id };
    }
    // Al comprar una carta se muestra un instante en el centro (solo quien la compró sabe cuál es).
    function revealCard(kind) {
      var img = document.createElement('img'); img.className = 'reveal'; img.src = devCardURL(kind); img.alt = DEV[kind].name; img.draggable = false;
      stage.appendChild(img);
      img.animate([
        { transform: 'translate(-50%,-30%) scale(.5) rotate(-8deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(2deg)', opacity: 1, offset: 0.22 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1, offset: 0.78 },
        { transform: 'translate(-50%,-80%) scale(.9) rotate(4deg)', opacity: 0 }
      ], { duration: 1700, easing: 'ease-out' }).onfinish = function () { img.remove(); };
    }
    function pop(el, color) {
      el.animate([{ transform: 'scale(1)', boxShadow: '0 0 0 0 transparent' }, { transform: 'scale(1.2)', boxShadow: '0 0 18px 5px ' + color, offset: 0.35 }, { transform: 'scale(1)', boxShadow: '0 0 0 0 transparent' }], { duration: 520, easing: 'ease-out' });
    }

    // Cifra (+n / −n) que sube y se desvanece sobre una tarjeta o un puesto.
    function floatText(target, text, color) {
      var el = document.createElement('span'); el.className = 'plus'; el.textContent = text; el.style.color = color; target.appendChild(el);
      el.animate([{ transform: 'translateY(6px) scale(.6)', opacity: 0 }, { transform: 'translateY(-4px) scale(1.25)', opacity: 1, offset: 0.12 }, { transform: 'translateY(-10px) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translateY(-28px) scale(1)', opacity: 0 }], { duration: 2200, easing: 'ease-out' }).onfinish = function () { el.remove(); };
    }
    // Comercio con el banco: la tarjeta que se entrega pierde cartas (−n) y la que se recibe gana una (+1). La mano ya está al día.
    function tradeFx(ev) {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var give = handEl.querySelector('[data-res="' + ev.give + '"]'), get = handEl.querySelector('[data-res="' + ev.get + '"]');
      pop(give, give.style.getPropertyValue('--c')); floatText(give, '−' + ev.giveCount, give.style.getPropertyValue('--c'));
      setTimeout(function () { pop(get, get.style.getPropertyValue('--c')); floatText(get, '+1', get.style.getPropertyValue('--c')); }, 350);
    }

    // Cada trabajo {t: casilla, p: jugador, k: recurso, n: cantidad} hace salir un icono de la casilla, con una insignia del color
    // del jugador, que vuela hasta su destino: la tarjeta del banner si es el jugador que se está mirando (VIEWER), o su puesto
    // (avatar) si es otro. Devuelve la duración total (ms).
    function flyGains(jobs, animate) {
      var sr = stage.getBoundingClientRect(), w = stage.clientWidth, h = stage.clientHeight;
      jobs.forEach(function (j, n) {
        var p = j.p, k = j.k, amount = j.n, mine = p === VIEWER, pl = PLAYER_INFO[p];
        var card = handEl.querySelector('[data-res="' + k + '"]'), seat = seatsEl.children[p];
        var target = mine ? card : seat, glow = mine ? card.style.getPropertyValue('--c') : pl.css;
        var gain = function () {
          if (mine) myHand[k] += amount;
          counts[p] += amount;
          if (mine) card.querySelector('b').textContent = myHand[k]; else seat.querySelector('.cnt b').textContent = handTotal(p);
          if (!animate) return;
          pop(target, glow); floatText(target, '+' + amount, mine ? card.style.getPropertyValue('--c') : pl.css);
        };
        if (!animate) { gain(); return; }
        var stolen = j.from !== undefined, delay = stolen ? 250 : 450 + n * 260, sx, sy;
        if (stolen) { // robo: sale del avatar de la víctima, que pierde la carta en el momento de partir
          var fs = seatsEl.children[j.from], fr = fs.querySelector('.av').getBoundingClientRect();
          sx = fr.left - sr.left + fr.width / 2; sy = fr.top - sr.top + fr.height / 2;
          setTimeout(function () { counts[j.from] -= 1; if (j.from === VIEWER) { myHand[k] -= 1; handEl.querySelector('[data-res="' + k + '"] b').textContent = myHand[k]; } fs.querySelector('.cnt b').textContent = handTotal(j.from); pop(fs, PLAYER_INFO[j.from].css); }, delay);
        } else {
          var v = new THREE.Vector3(j.t.x, TILE_TOP + 0.35, j.t.z).project(camera); sx = (v.x * 0.5 + 0.5) * w; sy = (0.5 - v.y * 0.5) * h;
        }
        var ar = (mine ? card.querySelector('svg') : seat.querySelector('.av')).getBoundingClientRect(), tx = ar.left - sr.left + ar.width / 2, ty = ar.top - sr.top + ar.height / 2;
        var fly = document.createElement('div'); fly.className = 'fly'; fly.style.background = PLAYER_INFO[stolen ? j.from : p].css; fly.appendChild(card.querySelector('svg').cloneNode(true)); stage.appendChild(fly);
        var at = function (x, y, sc) { return 'translate(' + (x - 20) + 'px,' + (y - 20) + 'px) scale(' + sc + ')'; };
        fly.animate([
          { transform: at(sx, sy, 0.4), opacity: 0 },
          { transform: at(sx, sy - 26, 1.3), opacity: 1, offset: 0.2 },
          { transform: at((sx + tx) / 2, Math.min(sy, ty) - 60, 1.1), opacity: 1, offset: 0.55 },
          { transform: at(tx, ty, 0.75), opacity: 1 }
        ], { duration: 1000, delay: delay, easing: 'ease-in-out', fill: 'both' }).onfinish = function () { fly.remove(); gain(); };
      });
      return animate && jobs.length ? 450 + (jobs.length - 1) * 260 + 1000 + 600 : 0;
    }

    function pressed(btn, on) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    function newGame() {
      buildBoard((Math.random() * 1e9) | 0);
      for (var n = 2; n <= 12; n++) rollCounts[n] = 0;
      updateStats();
    }
    document.getElementById('btnNew').addEventListener('click', newGame);
    document.getElementById('btnLeave').addEventListener('click', function () { window.location.assign('/'); });
    if (online) document.getElementById('btnNew').hidden = true; // en una sala no hay mapa nuevo: la partida es de todos
    // Solo desarrollo: salta la colocación inicial. Mapa nuevo, casas y caminos al azar (por el motor, con comandos legales) y listo para tirar.
    // Se ve con `npm run dev` o con ?debug en la URL; en producción no existe.
    var btnQuick = document.getElementById('btnQuick');
    if (!online && (process.env.NODE_ENV !== 'production' || /[?&]debug/.test(location.search))) btnQuick.hidden = false;
    // Sorteo ponderado hacia el centro: un vértice pesa según cuántas casillas toca (1, 2 o 3) elevado a 4, así que casi siempre
    // cae en el interior pero cualquiera puede salir; una arista pesa por los vértices que une.
    function pickCentral(list, isVertex) {
      var topo = topology();
      var w = list.map(function (id) {
        if (isVertex) return Math.pow(topo.vertices[id].tiles.length, 4);
        var e = topo.edges[id]; return Math.pow(topo.vertices[e.a].tiles.length + topo.vertices[e.b].tiles.length, 4);
      });
      var r = Math.random() * w.reduce(function (a, b) { return a + b; }, 0);
      for (var i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; }
      return list[list.length - 1];
    }
    btnQuick.addEventListener('click', function () {
      buildBoard((Math.random() * 1e9) | 0);
      for (var n = 2; n <= 12; n++) rollCounts[n] = 0;
      updateStats();
      session.autoSetup(pickCentral); // la sesión juega la colocación con comandos legales; acá solo se elige dónde
      pull(); syncPieces(); applyView();
    });
    var btnStats = document.getElementById('btnStats');
    btnStats.addEventListener('click', function () { statsEl.hidden = !statsEl.hidden; pressed(btnStats, !statsEl.hidden); });
    btnTurn.addEventListener('click', function () {
      if (busy || !game) return;
      if (game.phase.kind === 'roll') rollDice();
      else if (game.phase.kind === 'main') dispatch({ type: 'endTurn', player: game.turn });
    });
    btnDev.addEventListener('click', function () {
      if (busy || !game) return;
      cardsUI = null; tradeUI = null; buildMode = null;
      if (pendingCmd && pendingCmd.type === 'buyDevCard') { pendingCmd = null; renderDialog(); } else askConfirm({ type: 'buyDevCard', player: game.turn });
    });
    // los botones de construir activan (o desactivan) el modo: el tablero muestra dónde se puede
    buildEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-build]'); if (!b || b.disabled || busy) return;
      var kind = b.getAttribute('data-build'); buildMode = buildMode === kind ? null : kind; tradeUI = null; cardsUI = null; refreshUi();
    });
    // Comerciar: abre (o cierra) el panel; es excluyente con el modo de construir y con una confirmación abierta
    btnTrade.addEventListener('click', function () {
      if (busy || !game) return;
      pendingCmd = null; buildMode = null; cardsUI = null;
      tradeUI = tradeUI ? null : { give: null, get: null};
      refreshUi();
    });
    btnCards.addEventListener('click', function () {
      if (busy || !game) return;
      pendingCmd = null; buildMode = null; tradeUI = null;
      cardsUI = cardsUI ? null : { mode: 'hand', res: null, picks: [] };
      refreshUi();
    });
    var lightBtns = Array.prototype.slice.call(document.querySelectorAll('[data-light]'));
    lightBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        tar = presetState(PRESETS[b.getAttribute('data-light')]);
        lightBtns.forEach(function (o) { pressed(o, o === b); });
        audio.setAmbient(b.getAttribute('data-light'));
      });
    });
    var volume = document.getElementById('volume'), volIcon = document.getElementById('volIcon');
    var btnMute = document.getElementById('btnMute'), lastVolume = 0.5; // volumen al que vuelve el parlante al quitar el silencio
    function showVolume() {
      var muted = volume.value == 0;
      volIcon.setAttribute('data-level', muted ? 0 : volume.value < 50 ? 1 : 2);
      btnMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
      btnMute.setAttribute('aria-label', muted ? 'Quitar silencio' : 'Silenciar');
    }
    volume.value = Math.round(audio.getVolume() * 100); showVolume();
    if (volume.value > 0) lastVolume = volume.value / 100;
    volume.addEventListener('input', function () { audio.setVolume(volume.value / 100); if (volume.value > 0) lastVolume = volume.value / 100; showVolume(); });
    // el parlante es un botón: silencia en el acto y, al tocarlo de nuevo, vuelve al volumen anterior
    btnMute.addEventListener('click', function () {
      var v = volume.value == 0 ? lastVolume : 0;
      volume.value = Math.round(v * 100); audio.setVolume(v); showVolume();
    });
    var btnAmbient = document.getElementById('btnAmbient');
    pressed(btnAmbient, audio.isAmbientOn());
    btnAmbient.addEventListener('click', function () { audio.setAmbientOn(!audio.isAmbientOn()); pressed(btnAmbient, audio.isAmbientOn()); });
    // menú hamburguesa (solo visible en pantallas angostas; ver globals.css)
    var btnMenu = document.getElementById('btnMenu');
    function setMenu(open) { stage.classList.toggle('menu-open', open); btnMenu.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    btnMenu.addEventListener('click', function () { setMenu(!stage.classList.contains('menu-open')); });
    setMenu(window.innerWidth > 640); // abierto de arranque en pantallas anchas, cerrado en el móvil
    document.getElementById('btnCenter').addEventListener('click', function () { homing = true; });

    // ------------------------------------------------------------------ tamaño
    function resize() {
      var w = stage.clientWidth || 800, h = stage.clientHeight || 600, aspect = w / h;
      renderer.setSize(w, h, false);
      camera.aspect = aspect;
      camera.fov = aspect < 0.75 ? 58 : aspect < 1.1 ? 46 : 35;
      // El banner de recursos tapa la parte baja: se corre la imagen hacia arriba para que el tablero quede
      // centrado en el espacio libre sobre el banner (el cliente sigue viendo el mismo tablero, solo desplazado).
      var hand = stage.querySelector('.hand'), shift = 0;
      if (hand) shift = Math.max(0, Math.round((h - (hand.getBoundingClientRect().top - stage.getBoundingClientRect().top)) / 2));
      camera.setViewOffset(w, h, 0, shift, w, h);
      camera.updateProjectionMatrix();
    }
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(resize); ro.observe(stage); } else window.addEventListener('resize', resize);
    resize();

    // Gancho de pruebas: solo existe si la URL lleva ?debug. Permite armar situaciones (dar cartas, cambiar de fase) y saber
    // dónde está cada cosa en pantalla para probar con clics reales. No forma parte del juego.
    if (/[?&]debug/.test(location.search)) {
      window.__paisano = {
        pick: function (x, y) { var r = renderer.domElement.getBoundingClientRect(); pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); var h = raycaster.intersectObjects(markersGroup.children, false)[0]; return { hit: h ? h.object.userData : null, ray: [raycaster.ray.origin.toArray(), raycaster.ray.direction.toArray()], pointer: pointer.toArray(), cam: camera.position.toArray(), marker19: markersGroup.children.filter(function (c) { return c.userData.id === 19; }).map(function (c) { return c.matrixWorld.elements.slice(12, 15); }) }; },
        game: function () { return session.debugState ? session.debugState() : game; },
        busy: function () { return busy; },
        camera: camera, controls: controls, // para acercar la cámara a un adorno y revisarlo

        legal: function () { return legal; },
        tileVertices: function (t) { return topology().tiles[t].vertices; },
        mutate: function (fn) { if (!session.debugMutate) return; session.debugMutate(fn); pull(); syncPieces(); applyView(); },
        screen: function (type, id) {
          var topo = topology(), p = new THREE.Vector3();
          if (type === 'vertex') p.set(vertices[id].x, TILE_TOP + 0.05, vertices[id].z);
          else if (type === 'edge') { var e = topo.edges[id]; p.set((vertices[e.a].x + vertices[e.b].x) / 2, TILE_TOP + 0.05, (vertices[e.a].z + vertices[e.b].z) / 2); }
          else p.set(tiles[id].x, TILE_TOP + 0.06, tiles[id].z);
          p.project(camera);
          var r = renderer.domElement.getBoundingClientRect();
          return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (0.5 - p.y * 0.5) * r.height };
        }
      };
    }

    // ------------------------------------------------------------------ bucle
    buildBoard(online ? (opts.seed || 1) : (Date.now() & 0xffffff) | 1);
    applyLight(1);
    var clock = new THREE.Clock(), time = 0;
    function frame() {
      if (disposed) return; raf = requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05); time += dt;
      if (homing) {
        var k = 1 - Math.exp(-dt * 6);
        camera.position.lerp(HOME_POS, k); controls.target.lerp(HOME_TARGET, k);
        if (camera.position.distanceTo(HOME_POS) < 0.01) { camera.position.copy(HOME_POS); controls.target.copy(HOME_TARGET); homing = false; }
      }
      if (orbit.on && performance.now() >= orbit.resumeAt) {
        orbit.t += dt;
        orbitOff.copy(camera.position).sub(controls.target); orbitSph.setFromVector3(orbitOff);
        var ease = 1 - Math.exp(-dt * 0.8);
        orbitSph.theta += dt * 0.07;
        orbitSph.phi += (0.85 + 0.4 * Math.sin(orbit.t * 0.11) - orbitSph.phi) * ease;
        orbitSph.radius += (17 + 3 * Math.sin(orbit.t * 0.07 + 1) - orbitSph.radius) * ease;
        orbitOff.setFromSpherical(orbitSph); camera.position.copy(controls.target).add(orbitOff);
      }
      controls.update();
      applyLight(1 - Math.exp(-dt * 3.5));

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
      // farol: la llama se enciende con la noche (cur.lamps: 0 de día, 0.35 al atardecer, 1.25 de noche) y titila
      if (lantern) {
        var LL = Math.max(0, Math.min(1, cur.lamps / 1.25)), lu = lantern.userData;
        var fk = 1 + 0.10 * Math.sin(time * 13) + 0.07 * Math.sin(time * 23 + 1.3) + 0.05 * Math.sin(time * 37 + 0.4);
        var fs = 0.3 + 0.7 * LL;
        lu.flame.visible = lu.halo.visible = LL > 0.02;
        lu.flame.scale.set(fs * (1 + 0.06 * Math.sin(time * 17)), 1.7 * fs * fk, fs);
        lu.flame.position.x = Math.sin(time * 9 + 0.5) * 0.008 * LL;
        lu.halo.scale.set(fs * fk, 1.5 * fs * fk, fs * fk); lu.halo.material.opacity = 0.24 * LL * fk;
        lu.glow.intensity = 1.1 * LL * fk;
      }
      // marcadores de jugada legal: laten suave
      if (markerMat) markerMat.opacity = 0.5 + 0.2 * Math.sin(time * 4);
      // piezas nuevas: brotan con un pequeño rebote
      var nowS = performance.now() / 1000;
      animateGhost(nowS); placeConfirm();
      for (var pc = 0; pc < piecesGroup.children.length; pc++) {
        var pm = piecesGroup.children[pc], born = pm.userData.born;
        if (born === undefined) continue;
        var u = Math.min(1, (nowS - born) / 0.35), sc = u >= 1 ? 1 : Math.max(0.001, 1 - Math.pow(1 - u, 3) * Math.cos(u * 9));
        pm.scale.setScalar(sc); if (u >= 1) pm.userData.born = undefined;
      }
      waterTex.offset.x = (time * 0.006) % 1; waterTex.offset.y = (time * 0.004) % 1;

      renderer.render(scene, camera);
    }
    frame();
  }
}
