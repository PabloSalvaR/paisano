// Barra de controles del tablero (y su menú en el celular): mapa nuevo, salir, partida rápida de desarrollo, sonido, luz,
// cámara y estadística.
import { pressed } from './util.js';

// `actions`: { newGame, quickGame }, que arman la partida desde index.js.
export function createBar(ctx, actions) {
  var audio = ctx.audio, stage = ctx.stage;
  document.getElementById('btnNew').addEventListener('click', actions.newGame);
  document.getElementById('btnLeave').addEventListener('click', function () { window.location.assign('/'); });
  if (ctx.online) document.getElementById('btnNew').hidden = true; // en una sala no hay mapa nuevo: la partida es de todos
  // Solo desarrollo: salta la colocación inicial. Mapa nuevo, casas y caminos al azar (por el motor, con comandos legales) y listo para tirar.
  // Se ve con `npm run dev` o con ?debug en la URL; en producción no existe.
  var btnQuick = document.getElementById('btnQuick');
  if (!ctx.online && (process.env.NODE_ENV !== 'production' || /[?&]debug/.test(location.search))) btnQuick.hidden = false;
  btnQuick.addEventListener('click', actions.quickGame);
  var statsEl = document.getElementById('stats');
  var btnStats = document.getElementById('btnStats');
  btnStats.addEventListener('click', function () { statsEl.hidden = !statsEl.hidden; pressed(btnStats, !statsEl.hidden); });
  var lightBtns = Array.prototype.slice.call(document.querySelectorAll('[data-light]'));
  lightBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      ctx.lights.setPreset(b.getAttribute('data-light'));
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
  document.getElementById('btnCenter').addEventListener('click', ctx.rig.goHome);
}
