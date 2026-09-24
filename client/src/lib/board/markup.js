// HTML de la interfaz que va encima del tablero (la página lo inserta antes de llamar a initBoard) y colores de los asientos.
import { HAND_KINDS, TERRAINS } from './constants.js';

// Íconos de los recursos: los del banner, que repiten los paneles de comercio, las ofertas y los recursos que vuelan.
export const RES_ICONS = {
  forest: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="21" y="28" width="6" height="14" fill="#7a4e2a"/><circle cx="14" cy="26" r="8" fill="#3f8f45"/><circle cx="34" cy="26" r="8" fill="#3f8f45"/><circle cx="24" cy="17" r="11" fill="#3f8f45"/></svg>',
  hills: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#c96a3b"><rect x="4" y="27" width="20" height="10"/><rect x="24" y="27" width="20" height="10"/><rect x="14" y="16" width="20" height="10"/></g></svg>',
  pasture: '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="9" cy="14" rx="5" ry="2.8" transform="rotate(-15 9 14)" fill="#fff"/><ellipse cx="39" cy="14" rx="5" ry="2.8" transform="rotate(15 39 14)" fill="#fff"/><g fill="#f3b8b0" stroke="none"><ellipse cx="9" cy="14" rx="2.6" ry="1.2" transform="rotate(-15 9 14)"/><ellipse cx="39" cy="14" rx="2.6" ry="1.2" transform="rotate(15 39 14)"/></g><path d="M13 9 Q24 5 35 9 Q38 20 33 32 Q30 38 24 38 Q18 38 15 32 Q10 20 13 9Z" fill="#fff"/><ellipse cx="29.5" cy="14" rx="5" ry="5.5" fill="#2b2118" stroke="none"/><ellipse cx="24" cy="32" rx="9.5" ry="7" fill="#f3b8b0"/><g fill="#2b2118" stroke="none"><circle cx="18" cy="21" r="2.2"/><circle cx="30" cy="21" r="2.2"/><ellipse cx="20" cy="32" rx="1.4" ry="2"/><ellipse cx="28" cy="32" rx="1.4" ry="2"/></g></svg>',
  fields: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#4c9a3f"><path d="M24 43 L8 21 L20 32Z"/><path d="M24 43 L40 21 L28 32Z"/></g><ellipse cx="24" cy="22" rx="7" ry="16" fill="#f2c230"/><g stroke="#d9a52a" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M17.5 12 Q24 14.3 30.5 12"/><path d="M17 18 Q24 20.4 31 18"/><path d="M17 24 Q24 26.4 31 24"/><path d="M17.3 30 Q24 32.3 30.7 30"/></g><path d="M24 4 L22.5 9 M24 4 L24 10 M24 4 L25.5 9" stroke="#5a9c4a" stroke-width="1.5" stroke-linecap="round"/></svg>',
  mountains: '<svg viewBox="0 0 48 48" aria-hidden="true"><polygon points="4,41 10,20 22,11 20,41" fill="#9aa1a8"/><polygon points="22,11 32,20 35,41 20,41" fill="#767d85"/><polygon points="20,41 25,28 37,25 34,41" fill="#b7bec5"/><polygon points="37,25 45,32 44,41 34,41" fill="#8d949c"/><path d="M13 33 L17 26 L15 22" stroke="#6b7178" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/><path d="M28 35 L31 30 L29 27" stroke="#8f959b" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/></svg>'
};

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
    <button type="button" id="btnTrade" aria-pressed="false" title="Comerciar con el banco (4:1, o mejor con puertos) o con otros jugadores">
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11h20M19 5l6 6-6 6M27 21H7M13 15l-6 6 6 6"/></svg>
      <span>Comerciar</span><span class="cost"></span>
    </button>
    <button type="button" id="btnCards" aria-pressed="false" title="Tus cartas de desarrollo">
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="4" y="7" width="15" height="21" rx="3" transform="rotate(-12 11 17)"/><rect x="13" y="5" width="15" height="21" rx="3" transform="rotate(8 20 15)"/></svg>
      <span>Mis cartas</span><span class="cost"><b id="cardsN"></b></span>
    </button>
  </section>

  <!-- Botón único de turno: dados antes de tirar; flecha hacia el próximo jugador después. Lo arma hud.js -->
  <button type="button" class="panel turn-btn" id="btnTurn" hidden></button>

  <!-- Descartar (con un 7) o elegir a quién robarle: se arma desde hud.js -->
  <section class="panel dialog" id="dialog" role="dialog" aria-live="polite" hidden></section>
  <section class="panel dialog opening" id="opening" role="status" aria-live="polite" hidden></section>

  <!-- Estadística de tiradas: una barra vertical por total (2 a 12) con la cantidad de veces que salió -->
  <section class="panel stats" id="stats" aria-label="Estadística de tiradas" hidden>
    <h2>Estadística <span id="statsN"></span></h2>
    <div class="chart" id="chart"></div>
  </section>

  <!-- Puestos de los jugadores y recursos de quien mira (los números los pone hud.js con el estado de la partida) -->
  <aside class="panel seats" id="seats" aria-label="Jugadores"></aside>
  <section class="panel hand" aria-label="Recursos del jugador 1">
    <div class="who" id="who"></div>
${HAND_KINDS.map((k) => `    <div class="res" style="--c:${TERRAINS[k].ui}" title="${TERRAINS[k].res}" data-res="${k}">
      ${RES_ICONS[k]}
      <b>0</b>
    </div>`).join('\n')}
  </section>

  <button type="button" class="panel menu-btn" id="btnMenu" aria-label="Menú" aria-controls="bar" aria-expanded="false">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  </button>
  <nav class="panel bar" id="bar" aria-label="Controles del tablero">
    <!-- Solo se ve en celular (ver .bar-logo): en pantallas anchas el logo ya está fijo en .title. -->
    <div class="bar-logo">
      <h2 class="logo"><span class="sr-only">Paisano</span></h2>
      <p class="tagline">Piedra y camino</p>
    </div>
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

// Color y texto de cada asiento: fijos por posición (así las piezas del tablero se distinguen siempre igual). El asiento
// `id` es estable (no cambia si el orden del arreglo cambia): lo usa el selector de color de la partida contra bots
// para guardar la elección en localStorage. Por defecto (sin elegir todavía) 0 (rojo) es el de la persona; el selector
// de personaje del menú también usa ese color fijo para la muestra, así se ve igual que en la mesa.
export const SEAT_COLORS = [
  { id: 'red', css: '#c81e1e', text: '#ffffff' },
  { id: 'blue', css: '#3b6fd6', text: '#ffffff' },
  { id: 'orange', css: '#f0932b', text: '#2b1a05' },
  { id: 'white', css: '#f1eee6', text: '#2b2216' }
];
