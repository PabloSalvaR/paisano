// Interfaz de encima del tablero: puestos, banner de recursos, botones de turno y de construir, texto de estado y los
// paneles (confirmar, descartar, robar, comerciar, cartas de desarrollo, oferta abierta y resumen final). Todo sale de la
// vista de la partida (`ctx.game`, `ctx.legal`) y de lo ya mostrado (`ctx.myHand`, `ctx.counts`, `ctx.vps`…); las
// jugadas se mandan con ctx.replay.dispatch. Es la parte que va a pasar a componentes de React (etapa 2 del refactor).
import { devCardURL } from '../cardart';
import { DEV, DEV_ORDER, HAND_KINDS, TERRAINS } from './constants.js';
import { dieSVG } from './dice.js';
import { DROP_MS } from './map.js';
import { RES_ICONS } from './markup.js';
import { pressed, reduced, sumOf } from './util.js';

const BADGE_ROAD = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="8" width="16" height="4.5" rx="1.5" transform="rotate(-25 10 10)" fill="currentColor"/></svg>';
const BADGE_ARMY = '<svg viewBox="0 0 20 20" aria-hidden="true"><g transform="rotate(-40 10 10)" fill="currentColor"><path d="M8 7.8H15.6Q18.6 8.4 19.6 10.4Q17.4 12.3 14.2 12.4H8Z"/><rect x="5.9" y="5.8" width="2.3" height="9" rx="1"/><rect x="0.8" y="8.6" width="5.4" height="3.6" rx="1.6"/></g></svg>'; // silueta de un facón: hoja con punta, guarda y mango
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1.5 12.6,7.2 18.8,7.8 14.1,12 15.5,18.2 10,15 4.5,18.2 5.9,12 1.2,7.8 7.4,7.2" fill="#f2c230" stroke="#7a5a10" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const TURN_DICE = '<svg viewBox="0 0 64 48" aria-hidden="true">' + dieSVG(3, 14, -10, [0, 4, 8]) + dieSVG(35, 7, 9, [0, 2, 4, 6, 8]) + '</svg>';
const TURN_ARROW = '<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h24M22 9.5 32.5 20 22 30.5"/></svg>';
// íconos de los botones de construir (resumen final)
const ICON_HOUSE = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 28V15L16 5l10 10v13z" fill="currentColor"/></svg>';
const ICON_CITY = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 28V17l7-6 7 6v11zM17 28V12l6-8 6 8v16z" fill="currentColor"/></svg>';

export function createHud(ctx) {
  var stage = ctx.stage, PLAYER_INFO = ctx.PLAYER_INFO, SEATS = ctx.SEATS, avatarHTML = ctx.players.avatarHTML;
  var handEl = stage.querySelector('.hand'), whoEl = document.getElementById('who'), seatsEl = document.getElementById('seats');
  seatsEl.innerHTML = PLAYER_INFO.map(function (pl, p) {
    return '<div class="seat" data-p="' + p + '" style="--pc:' + pl.css + '"><div class="av">' + avatarHTML(p) + '</div><span class="nm">' + pl.name + '</span>' +
      '<span class="vp" title="Puntos de victoria">' + STAR + '<b>0</b></span>' +
      '<span class="cnt"><svg viewBox="0 0 16 20" aria-hidden="true"><rect x="2" y="2" width="12" height="16" rx="2" fill="#f6ecd4" stroke="#5b4630" stroke-width="1.6"/></svg><b>0</b></span>' +
      '<span class="aw"><span class="bdg road" title="Ruta más larga">' + BADGE_ROAD + '<b></b></span><span class="bdg army" title="Gauchos jugados">' + BADGE_ARMY + '<b></b></span>' +
      '<span class="dv" title="Cartas de desarrollo" hidden><svg viewBox="0 0 16 20" aria-hidden="true"><rect x="2" y="2" width="12" height="16" rx="2" fill="#8f2a2a" stroke="#e8d6a0" stroke-width="1.6"/></svg><b>0</b></span></span></div>';
  }).join('');
  for (var si = SEATS; si < seatsEl.children.length; si++) seatsEl.children[si].hidden = true; // partidas de 3: sin el 4.º puesto
  seatsEl.setAttribute('data-n', SEATS); // con 3 puestos, en el celular cada uno tiene más ancho y muestra el nombre
  function handTotal(p) { return ctx.counts[p]; }
  function renderHand() {
    var pl = PLAYER_INFO[ctx.VIEWER];
    handEl.style.setProperty('--pc', pl.css); handEl.style.setProperty('--pt', pl.text);
    whoEl.innerHTML = '<div class="av">' + avatarHTML(ctx.VIEWER) + '</div><span class="nm">' + pl.name + '</span><span class="vp" title="Puntos de victoria">' + STAR + '<b>' + ctx.vps[ctx.VIEWER] + '</b></span>';
    HAND_KINDS.forEach(function (k) { handEl.querySelector('[data-res="' + k + '"] b').textContent = ctx.myHand[k]; });
  }
  function renderSeats() {
    Array.prototype.forEach.call(seatsEl.children, function (s, p) {
      s.classList.toggle('on', p === ctx.turn && !ctx.openingOn); s.querySelector('.cnt b').textContent = handTotal(p); s.querySelector('.vp b').textContent = ctx.vps[p];
      var dv = s.querySelector('.dv'), rd = s.querySelector('.bdg.road'), ar = s.querySelector('.bdg.army');
      dv.hidden = !ctx.devCounts[p]; dv.querySelector('b').textContent = ctx.devCounts[p];
      rd.classList.toggle('held', ctx.awardRoad.holder === p); rd.querySelector('b').textContent = ctx.roadLens[p]; rd.title = ctx.awardRoad.holder === p ? 'Tiene la Ruta más larga (' + ctx.roadLens[p] + ')' : 'Ruta más larga propia: ' + ctx.roadLens[p] + ' (hacen falta ' + ctx.game.config.longestRoadMin + ' y superar al resto)';
      ar.classList.toggle('held', ctx.awardArmy.holder === p); ar.querySelector('b').textContent = ctx.knights[p]; ar.title = ctx.awardArmy.holder === p ? 'Tiene la Milicia más grande (' + ctx.knights[p] + ' gauchos)' : 'Gauchos jugados: ' + ctx.knights[p] + ' (hacen falta ' + ctx.game.config.largestArmyMin + ' y superar al resto)';
    });
  }
  // Copia las manos y los puntos del estado del motor a lo que se ve en pantalla.
  function syncHands() {
    ctx.myHand = {}; HAND_KINDS.forEach(function (k) { ctx.myHand[k] = ctx.game.hand[k]; });
    ctx.counts = ctx.game.players.map(function (pl) { return pl.handCount; });
    ctx.vps = ctx.game.players.map(function (pl) { return pl.points; });
    ctx.vpCards = ctx.game.players.map(function (pl) { return pl.vpCards || 0; });
    ctx.devCounts = ctx.game.players.map(function (pl) { return pl.devCount; });
    ctx.knights = ctx.game.players.map(function (pl) { return pl.knights; });
    ctx.roadLens = ctx.game.players.map(function (pl) { return pl.roadLength; });
    ctx.awardRoad = { holder: ctx.game.longestRoad.holder, length: ctx.game.longestRoad.length };
    ctx.awardArmy = { holder: ctx.game.largestArmy.holder, size: ctx.game.largestArmy.size };
  }
  function resetPlayers() { ctx.VIEWER = ctx.me; ctx.turn = ctx.game.turn; syncHands(); renderHand(); renderSeats(); }
  // Pone la pantalla al día con el estado (banner del jugador de turno, puestos, ladrón, marcadores, botones y diálogos).
  function applyView() {
    ctx.VIEWER = ctx.me; ctx.turn = ctx.game.turn; syncHands(); renderHand(); renderSeats(); ctx.map.syncRobber();
    if (ctx.game.phase.kind === 'finished' && !ctx.summaryShown) ctx.summaryUI = ctx.summaryShown = true; // se entró a una partida ya terminada: el resumen no se vio con un evento en vivo
    refreshUi(); ctx.rig.setOrbit(ctx.game.phase.kind === 'finished'); // al recargar una partida terminada gira; con una nueva vuelve a la vista de siempre
  }
  function refreshUi() { ctx.map.refreshMarkers(); updateControls(); renderDialog(); showStatus(statusText(), false); }

  // Con bots nuevos (partida nueva contra bots): color, retrato y nombre de cada puesto.
  function renderSeatFaces() {
    Array.prototype.forEach.call(seatsEl.children, function (el, p) { el.style.setProperty('--pc', PLAYER_INFO[p].css); el.querySelector('.av').innerHTML = avatarHTML(p); el.querySelector('.nm').textContent = PLAYER_INFO[p].name; });
  }

  // Botón único de turno. Antes de tirar: dos dados. Después de tirar: flecha con el color de quien sigue.
  var btnTurn = document.getElementById('btnTurn'), btnDev = document.getElementById('btnDev'), btnTrade = document.getElementById('btnTrade'), btnCards = document.getElementById('btnCards'), cardsN = document.getElementById('cardsN');
  function updateTurnButton() {
    var ph = ctx.game.phase.kind, on = (ph === 'roll' || ph === 'main') && ctx.game.turn === ctx.me && !ctx.game.trade; // en línea, el botón de turno es solo de quien juega
    if (ctx.busy && !btnTurn.hidden) { btnTurn.disabled = true; return; } // durante la tirada (dados rodando, recursos volando) queda como estaba: con un 7 la fase cambia enseguida y el ícono desaparecería antes de ver el número
    btnTurn.hidden = !on;
    if (!on) { btnTurn.removeAttribute('data-key'); return; }
    btnTurn.disabled = ctx.busy;
    var next = (ctx.game.turn + 1) % ctx.game.players.length, key = ph + ':' + next;
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
    var can = !ctx.busy && ctx.game.turn === ctx.me && ctx.legal.some(function (a) { return a.type === 'buyDevCard'; }); // alcanza la mano y quedan cartas: lo dice el motor
    btnDev.disabled = !can;
    if (!can && ctx.pendingCmd && ctx.pendingCmd.type === 'buyDevCard') { ctx.pendingCmd = null; renderDialog(); }
  }
  function updateControls() {
    var ph = ctx.game.phase.kind, acts = ctx.legal, can = {};
    acts.forEach(function (a) { can[a.type] = true; });
    updateTurnButton(); updateDevButton();
    var canTrade = !!(can.bankTrade || can.proposeTrade || offerLimit()); // con el banco o con jugadores (con el tope de ofertas, igual se abre: «Ofrecer» queda gris)
    if (ctx.tradeUI && (!canTrade || (ctx.busy && !ctx.tradeUI.hidden))) ctx.tradeUI = null; // ya no se puede comerciar (otra fase, o la mano no alcanza)
    btnTrade.disabled = ctx.busy || !canTrade; pressed(btnTrade, !!ctx.tradeUI && !ctx.tradeUI.hidden); btnTrade.classList.toggle('stowed', !!ctx.tradeUI && !!ctx.tradeUI.hidden);
    var nDev = devTotal();
    if (ctx.game.trade) ctx.tradeUI = ctx.cardsUI = null; // con una oferta abierta, el diálogo es el de la oferta
    if (ctx.cardsUI && (nDev === 0 || ctx.game.turn !== ctx.me || (ctx.busy && !ctx.cardsUI.hidden))) ctx.cardsUI = null; // no hay nada que mostrar (o corre una animación)
    btnCards.disabled = ctx.busy || nDev === 0; pressed(btnCards, !!ctx.cardsUI && !ctx.cardsUI.hidden); btnCards.classList.toggle('stowed', !!ctx.cardsUI && !!ctx.cardsUI.hidden); cardsN.textContent = nDev || '';
    buildEl.hidden = ph === 'setup' || ph === 'finished';
    if (!can[{ road: 'buildRoad', settlement: 'buildSettlement', city: 'buildCity' }[ctx.buildMode]]) ctx.buildMode = null; // ya no alcanza o no hay dónde
    Array.prototype.forEach.call(buildEl.querySelectorAll('[data-build]'), function (b) {
      var kind = b.getAttribute('data-build');
      b.disabled = ctx.busy || ph === 'roadBuilding' || !can[{ road: 'buildRoad', settlement: 'buildSettlement', city: 'buildCity' }[kind]]; // con Empedrado los caminos se ponen gratis, sin este botón
      pressed(b, ctx.buildMode === kind);
    });
  }

  function statusText() {
    // Si el que juega es quien mira (VIEWER) se le habla de vos; si no, se nombra a esa persona.
    var ph = ctx.game.phase, name = PLAYER_INFO[ctx.game.turn].name, mine = ctx.game.turn === ctx.VIEWER;
    // Mientras se reproducen eventos, `game` todavía es la vista de antes (se actualiza al final): cuando un aviso temporal
    // vuelve al texto de siempre, se usa el turno ya mostrado (`turn`), no el viejo (si no, en el turno de un bot decía «Tu turno»).
    if (ctx.playing) return ctx.turn === ctx.VIEWER ? 'Tu turno' : 'Turno de ' + PLAYER_INFO[ctx.turn].name;
    switch (ph.kind) {
      case 'setup': {
        if (ctx.openingOn) return 'Sorteando quién empieza…';
        var fase = ph.step < ctx.game.players.length ? 'Fase 1' : 'Fase 2'; // el sentido (horario/antihorario) va en el reglamento, no acá: no sobrecargar el mensaje
        return (mine ? 'Tu turno' : name) + ' · ' + fase + ': ' + (ph.part === 'settlement' ? (mine ? 'tocá un punto para colocar tu casa' : 'coloca su casa') : (mine ? 'tocá un camino junto a tu casa' : 'coloca su camino'));
      }
      case 'roll': return mine ? 'Tu turno: jugá los dados' : 'Turno de ' + name;
      case 'main':
        if (ctx.buildMode) return mine ? { road: 'Elegí dónde va el camino', settlement: 'Elegí dónde va la casa', city: 'Elegí qué casa mejorar' }[ctx.buildMode] : 'Turno de ' + name;
        return mine ? 'Tu turno' : 'Turno de ' + name;
      case 'discard': return mine ? 'Salió un 7: descartá ' + ph.queue[0].count + ' cartas' : name + ' descarta ' + ph.queue[0].count + ' cartas';
      case 'moveRobber': return mine ? 'Mové el ladrón' : name + ' mueve el ladrón';
      case 'roadBuilding': return mine ? 'Empedrado: elegí dónde va el camino gratis (' + (ph.left === 2 ? 'faltan 2' : 'falta 1') + ')' : name + ' pone caminos gratis';
      case 'steal': return mine ? 'Elegí a quién robarle una carta' : name + ' elige a quién robarle';
      default: return ph.winner === ctx.VIEWER ? '¡Ganaste la partida con ' + ctx.vps[ph.winner] + ' puntos!' : '¡' + PLAYER_INFO[ph.winner].name + ' ganó la partida con ' + ctx.vps[ph.winner] + ' puntos!';
    }
  }
  // Paneles que aparecen solos (oferta, descarte, robo, resumen): la flecha los achica a una tira arriba para ver el tablero y
  // tocando la tira vuelven. `panelKey` identifica el panel a la vista y `minimized` el achicado: si aparece otro (una oferta
  // nueva, otro descarte), llega abierto.
  var panelKey = '', minimized = '';
  var CHEVRON_UP = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12.5 10 7.5l5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHEVRON_DOWN = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5 10 12.5l5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var MIN_BTN = '<button type="button" class="min" data-min aria-label="Minimizar" title="Minimizar">' + CHEVRON_UP + '</button>';
  function renderStrip(title) {
    dialogEl.className = 'panel dialog strip';
    dialogEl.innerHTML = '<button type="button" data-expand aria-label="Abrir" title="Abrir"><span></span>' + CHEVRON_DOWN + '</button>';
    dialogEl.querySelector('span').textContent = title;
    dialogEl.hidden = false;
  }
  function offerKey(t) { return 'offer:' + t.from + ':' + JSON.stringify(t.give) + JSON.stringify(t.get) + ':' + t.responses.map(function (r) { return r.player; }).join(','); }
  var discardSel = {}, dialogKey = ''; // selección del descarte; qué diálogo se armó (al cambiar, la selección se reinicia)
  var statusEl = document.getElementById('status'), statusTimer = null, statusSeq = 0; // statusSeq: cuántos mensajes se mostraron (para saber si uno sigue siendo el último)
  // Muestra un mensaje. Los errores y avisos "temporales" vuelven solos al texto de siempre.
  function showStatus(text, isError, temporary, who) {
    clearTimeout(statusTimer); statusSeq++;
    statusEl.innerHTML = '<i style="background:' + PLAYER_INFO[who !== undefined ? who : ctx.openingOn ? ctx.VIEWER : ctx.playing ? ctx.turn : ctx.game.turn].css + '"></i><span></span>';
    statusEl.lastChild.textContent = text;
    statusEl.classList.toggle('error', !!isError);
    if (isError || temporary) statusTimer = setTimeout(function () { showStatus(statusText(), false); }, isError ? 2500 : 4000);
  }

  // Diálogo: descartar cartas (con un 7) o elegir a quién robarle. La selección se reinicia cuando cambia quién tiene que actuar.
  var dialogEl = document.getElementById('dialog'), buildEl = document.getElementById('build');
  function resIcon(k) { return RES_ICONS[k]; }
  function renderDialog() {
    var ph = ctx.game.phase;
    if (ctx.pendingCmd && (ctx.busy || ctx.pendingCmd.player !== ctx.game.turn)) ctx.pendingCmd = null;
    stage.toggleAttribute('data-confirm', !!ctx.pendingCmd); // con una confirmación abierta, el texto de estado se oculta para no quedar debajo
    if (ctx.pendingCmd) {
      dialogKey = ''; if (ctx.pendingCmd.type === 'buyDevCard') ctx.map.clearGhost(); else ctx.map.showGhost(ctx.pendingCmd);
      dialogEl.className = 'panel dialog confirm';
      dialogEl.innerHTML = '<div class="yesno"><button type="button" class="no" data-cancel aria-label="Cancelar" title="Cancelar">✕</button><button type="button" class="yes" data-ok aria-label="Confirmar" title="Confirmar">✓</button></div>';
      dialogEl.hidden = false; placeConfirm();
      return;
    }
    ctx.map.clearGhost(); panelKey = '';
    dialogEl.className = 'panel dialog'; dialogEl.style.left = dialogEl.style.top = dialogEl.style.transform = '';
    if (ctx.summaryUI && !ctx.busy) { dialogKey = ''; panelKey = 'summary'; if (minimized === panelKey) renderStrip('Fin de la partida'); else renderSummary(); return; }
    var ot = offerNow(), watch = !!ot && offerWatch(ot); // la oferta se ve también mientras se reproducen eventos
    if (ot && !watch) { dialogKey = ''; panelKey = offerKey(ot); renderOffer(ot, false, minimized === panelKey); return; }
    if (ctx.tradeUI && !ctx.tradeUI.hidden && !ctx.busy && ph.kind === 'main') { dialogKey = ''; renderTrade(); return; }
    if (ctx.cardsUI && !ctx.cardsUI.hidden && !ctx.busy) { dialogKey = ''; renderCards(); return; }
    if (ot) { dialogKey = ''; renderOffer(ot, true); return; } // entre otros: chica arriba, sin tapar tus paneles
    if (ctx.busy || ctx.game.turn !== ctx.me || (ph.kind !== 'discard' && ph.kind !== 'steal')) { dialogEl.hidden = true; dialogKey = ''; return; } // descartar y elegir víctima solo lo ve quien actúa
    var key = ph.kind + ':' + ctx.game.turn + ':' + (ph.kind === 'discard' ? ph.queue.length : ph.victims.join(','));
    if (key !== dialogKey) { dialogKey = key; discardSel = {}; }
    var title = ph.kind === 'discard' ? 'Descartá ' + ph.queue[0].count + ' cartas' : '¿A quién le robás?';
    panelKey = key; if (minimized === key) { renderStrip(title); return; }
    var html = '';
    if (ph.kind === 'discard') {
      var need = ph.queue[0].count, got = HAND_KINDS.reduce(function (a, k) { return a + (discardSel[k] || 0); }, 0);
      html = MIN_BTN + '<h3></h3><p>Elegidas ' + got + ' de ' + need + '</p><div class="rows">' + HAND_KINDS.filter(function (k) { return ctx.myHand[k] > 0; }).map(function (k) {
        return '<div class="row"><span class="ico">' + resIcon(k) + '</span><span class="nm">' + TERRAINS[k].res + '</span>' +
          '<button type="button" data-dec="' + k + '" aria-label="Menos ' + TERRAINS[k].res + '"' + ((discardSel[k] || 0) ? '' : ' disabled') + '>−</button>' +
          '<b>' + (discardSel[k] || 0) + ' / ' + ctx.myHand[k] + '</b>' +
          '<button type="button" data-inc="' + k + '" aria-label="Más ' + TERRAINS[k].res + '"' + ((discardSel[k] || 0) < ctx.myHand[k] && got < need ? '' : ' disabled') + '>+</button></div>';
      }).join('') + '</div><button type="button" class="primary" data-confirm' + (got === need ? '' : ' disabled') + '>Descartar</button>';
    } else {
      html = MIN_BTN + '<h3></h3><div class="victims">' + ph.victims.map(function (v) {
        var total = ctx.counts[v];
        return '<button type="button" class="victim" data-victim="' + v + '" style="--pc:' + PLAYER_INFO[v].css + '"><span class="av">' + avatarHTML(v) + '</span><span>' + PLAYER_INFO[v].name + '</span><small>' + total + ' cartas</small></button>';
      }).join('') + '</div>';
    }
    dialogEl.innerHTML = html;
    dialogEl.querySelector('h3').textContent = title;
    dialogEl.hidden = false;
  }
  // Comerciar con el banco: dos filas de fichas (doy / recibo). Lo que se puede entregar, la tasa y lo que se puede pedir salen de
  // la acción bankTrade de legalActions; acá no se calcula ninguna regla.
  // Mis cartas: las cartas de desarrollo de la mano y, para Acopio y Buena cosecha, la elección de recursos. Qué se puede jugar y
  // cuándo lo dice el motor (legalActions); acá solo se explica por qué una carta no se puede jugar ahora.
  // Resumen de fin de partida: se abre solo, una vez (con el evento en vivo, o al entrar a una partida que ya terminó) y no
  // vuelve a abrirse sola después de que se cierra (importa en línea: el polling no la tiene que forzar de nuevo).
  function devTotal() { var n = 0; DEV_ORDER.forEach(function (k) { n += ctx.game.dev.hand[k]; }); return n; }
  function cardReason(k, can) {
    var d = ctx.game.dev, ph = ctx.game.phase.kind;
    if (!DEV[k].play) return '';
    if (ctx.game.turn !== ctx.me) return 'Esperá tu turno';
    if (d.hand[k] - d.fresh[k] <= 0) return 'La compraste en este turno: se juega desde el próximo';
    if (d.played) return 'Ya jugaste una carta en este turno';
    if (ph !== 'main' && ph !== 'roll') return 'Ahora no se puede jugar';
    if (!can[DEV[k].play]) return k === 'roadBuilding' ? 'No tenés dónde poner caminos' : k === 'yearOfPlenty' ? 'El banco casi no tiene cartas' : 'Ahora no se puede jugar';
    return '';
  }
  function resChips(enabled, selected, count) {
    return '<div class="pick">' + HAND_KINDS.map(function (k) {
      return '<button type="button" data-res="' + k + '" aria-pressed="' + (selected(k) ? 'true' : 'false') + '"' + (enabled(k) ? '' : ' disabled') +
        ' style="--c:' + TERRAINS[k].ui + '" title="' + TERRAINS[k].res + '"><span class="ico">' + resIcon(k) + '</span><small>' + (count(k) ? '×' + count(k) : '&nbsp;') + '</small></button>';
    }).join('') + '</div>';
  }
  function renderCards() {
    var can = {}, d = ctx.game.dev, html;
    ctx.legal.forEach(function (a) { can[a.type] = a; });
    dialogEl.className = 'panel dialog trade cards';
    function yesno(ok) { return '<div class="yesno"><button type="button" class="no" data-cancel aria-label="Volver" title="Volver">✕</button><button type="button" class="yes" data-ok aria-label="Confirmar" title="Confirmar"' + (ok ? '' : ' disabled') + '>✓</button></div>'; }
    if (ctx.cardsUI.mode === 'monopoly') {
      html = '<h3>Acopio</h3><p>¿Qué recurso querés que te entreguen?</p>' +
        resChips(function () { return true; }, function (k) { return ctx.cardsUI.res === k; }, function () { return 0; }) +
        '<div class="sum">' + (ctx.cardsUI.res ? 'Todos te dan su ' + TERRAINS[ctx.cardsUI.res].res.toLowerCase() : 'Elegí un recurso') + '</div>' + yesno(!!ctx.cardsUI.res);
    } else if (ctx.cardsUI.mode === 'plenty') {
      var avail = can.playYearOfPlenty ? can.playYearOfPlenty.resources : [], picks = ctx.cardsUI.picks, need = can.playYearOfPlenty ? can.playYearOfPlenty.count : 2;
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
  // Resumen de fin de partida: una fila bien corta por jugador (para entrar en el ancho de un celular), con lo que ya es
  // público durante la partida (nada de manos ni cartas de desarrollo ajenas). Se arma con lo mismo que ya pinta cada
  // puesto (`vps`, `awardRoad`/`awardArmy`) más las casas/estancias contadas de `shown.vertexBuildings`. Los Puntos de victoria
  // ocultos se revelan al terminar (la vista los manda en `vpCards`): una cartita al lado del puntaje, para que la cuenta cierre.
  function renderSummary() {
    var ph = ctx.game.phase, seats = SEATS;
    var rows = PLAYER_INFO.slice(0, seats).map(function (pl, p) {
      var settlements = 0, cities = 0;
      ctx.shown.vertexBuildings.forEach(function (b) { if (b && b.player === p) { if (b.city) cities++; else settlements++; } });
      var badges = (ctx.awardRoad.holder === p ? BADGE_ROAD : '') + (ctx.awardArmy.holder === p ? BADGE_ARMY : '');
      return '<div class="row' + (p === ph.winner ? ' winner' : '') + '" style="--pc:' + pl.css + '"><span class="av">' + avatarHTML(p) + '</span>' +
        '<span class="nm">' + pl.name + '</span>' + (badges ? '<span class="bdg">' + badges + '</span>' : '') +
        '<small title="' + settlements + ' casa' + (settlements === 1 ? '' : 's') + ' y ' + cities + ' estancia' + (cities === 1 ? '' : 's') + '">' + ICON_HOUSE + settlements + ICON_CITY + cities + '</small>' + // íconos de los botones de construir: con el texto no entraban la insignia y los Puntos de victoria
        (ctx.vpCards[p] ? '<span class="vpc" title="' + ctx.vpCards[p] + (ctx.vpCards[p] === 1 ? ' Punto de victoria' : ' Puntos de victoria') + '"><img src="' + devCardURL('victoryPoint') + '" alt="Punto de victoria" draggable="false">' + (ctx.vpCards[p] > 1 ? '<b>×' + ctx.vpCards[p] + '</b>' : '') + '</span>' : '') +
        '<span class="vp">' + STAR + ctx.vps[p] + '</span></div>';
    }).join('');
    dialogEl.className = 'panel dialog summary';
    dialogEl.innerHTML = '<button type="button" class="x" data-close aria-label="Cerrar" title="Cerrar">✕</button>' + MIN_BTN + '<h3>Fin de la partida</h3><div class="rows">' + rows + '</div>';
    dialogEl.hidden = false;
  }
  function plentyNeed() { var a = ctx.legal.filter(function (x) { return x.type === 'playYearOfPlenty'; })[0]; return a ? a.count : 2; } // cuántas cartas pide Buena cosecha (2, o 1 si el banco casi no tiene)
  function tradeOptions() {
    var a = ctx.legal.filter(function (x) { return x.type === 'bankTrade'; })[0];
    return a ? a.trades : [];
  }
  // Comercio entre jugadores: la oferta se arma con pasos ± (doy / pido) y se manda a todos o a algunos. Las reglas las valida el motor.
  function others() { var o = []; for (var i = 0; i < ctx.game.players.length; i++) if (i !== ctx.me) o.push(i); return o; }
  function cardChips(c) {
    return '<span class="chips">' + HAND_KINDS.filter(function (k) { return c[k]; }).map(function (k) {
      return '<span class="chip" style="--c:' + TERRAINS[k].ui + '" title="' + TERRAINS[k].res + '"><span class="ico">' + resIcon(k) + '</span><b>×' + c[k] + '</b></span>';
    }).join('') + '</span>';
  }
  var OFFER_MAX = 9; // tope de cartas de un mismo recurso que se pide en una oferta (el motor no lo exige; es para que el paso ± no se vaya al infinito)
  function offerState() {
    var o = ctx.tradeUI.offer || (ctx.tradeUI.offer = { give: {}, get: {}, to: others() });
    o.to = o.to.filter(function (p) { return p !== ctx.me; });
    HAND_KINDS.forEach(function (k) { if (o.give[k] > ctx.myHand[k]) o.give[k] = ctx.myHand[k]; if (!o.give[k]) delete o.give[k]; });
    return o;
  }
  // Tope de ofertas por turno alcanzado: el motor ya no ofrece `proposeTrade`, pero la pestaña «Jugadores» sigue a la vista
  // con «Ofrecer» gris (sin decirle al jugador cuántas le quedan).
  function offerLimit() { return !!ctx.game && ctx.game.turn === ctx.me && ctx.game.phase.kind === 'main' && !ctx.game.trade && (ctx.game.tradeOffers || 0) >= ctx.game.config.trade.maxOffersPerTurn; }
  function renderPlayersTab() {
    var o = offerState(), pl = ctx.legal.filter(function (a) { return a.type === 'proposeTrade'; })[0];
    var sg = sumOf(o.give), st = sumOf(o.get), ok = sg > 0 && st > 0 && o.to.length > 0;
    // «Ofrezco» y «Quiero»: dos franjas horizontales, una columna por recurso con + arriba y − abajo de la cantidad. Las flechas son las mismas de la
    // oferta recibida: roja ↑ lo que se te va, verde ↓ lo que te entra.
    function strip(side) {
      var giving = side === 'give', mine = giving ? o.give : o.get, other = giving ? o.get : o.give, pre = giving ? 'data-og-' : 'data-ot-', verb = giving ? ' que ofrezco' : ' que quiero';
      return '<div class="side ' + side + '"><p>' + dirIco(!giving, giving ? 'Esto se te va' : 'Esto te entra') + (giving ? 'Ofrezco' : 'Quiero') + '</p><div class="steps">' + HAND_KINDS.map(function (k) {
        var n = mine[k] || 0, max = giving ? ctx.myHand[k] : OFFER_MAX;
        return '<div class="step' + (n ? ' on' : '') + '" style="--c:' + TERRAINS[k].ui + '">' +
          '<button type="button" ' + pre + 'inc="' + k + '" aria-label="Más ' + TERRAINS[k].res + verb + '"' + (n < max && !other[k] ? '' : ' disabled') + '>+</button>' +
          '<span class="card" title="' + TERRAINS[k].res + '"><span class="ico">' + resIcon(k) + '</span><b>' + n + '</b></span>' +
          '<button type="button" ' + pre + 'dec="' + k + '" aria-label="Menos ' + TERRAINS[k].res + verb + '"' + (n ? '' : ' disabled') + '>−</button></div>';
      }).join('') + '</div></div>';
    }
    // A quién: los mismos redondeles del color de cada uno que muestra la oferta abierta, con el avatar adentro y el nombre
    // chico debajo (elegido con borde lleno, el resto punteado y apagado); al ofrecer, los elegidos pasan a «pensando».
    var tos = others().map(function (p) {
      return '<button type="button" class="pick" data-to="' + p + '" aria-pressed="' + (o.to.indexOf(p) >= 0 ? 'true' : 'false') + '" style="--pc:' + PLAYER_INFO[p].css + ';--pt:' + PLAYER_INFO[p].text + '">' +
        '<span class="dot"><span class="av">' + avatarHTML(p) + '</span></span><small></small></button>';
    }).join('');
    return strip('give') + strip('get') +
      '<div class="to-row"><div class="dots">' + tos + '</div></div>' + // sin línea de ayuda: el ✓ gris ya dice que falta algo
      '<div class="yesno"><button type="button" class="yes" data-offer aria-label="Ofrecer" title="Ofrecer"' + (ok && pl ? '' : ' disabled') + '>✓</button></div>'; // la tilde verde de siempre
  }
  var CLOSE_BTN = '<button type="button" class="x" data-close aria-label="Cerrar" title="Cerrar (y borrar lo elegido)">✕</button>';
  function renderTrade() {
    var can = {}; ctx.legal.forEach(function (a) { can[a.type] = a; });
    var players = can.proposeTrade || offerLimit(); // la pestaña sigue aunque se haya llegado al tope de ofertas
    if (!ctx.tradeUI.tab || (ctx.tradeUI.tab === 'bank' && !can.bankTrade) || (ctx.tradeUI.tab === 'players' && !players)) ctx.tradeUI.tab = can.bankTrade ? 'bank' : 'players';
    var tabs = can.bankTrade && players
      ? '<div class="tabs"><button type="button" data-tab="bank" aria-pressed="' + (ctx.tradeUI.tab === 'bank') + '">Banco</button><button type="button" data-tab="players" aria-pressed="' + (ctx.tradeUI.tab === 'players') + '">Jugadores</button></div>'
      : '';
    dialogEl.className = 'panel dialog trade';
    if (ctx.tradeUI.tab === 'players') {
      dialogEl.innerHTML = CLOSE_BTN + '<h3>Comerciar con jugadores</h3>' + tabs + renderPlayersTab();
      Array.prototype.forEach.call(dialogEl.querySelectorAll('[data-to]'), function (el) { var nm = PLAYER_INFO[+el.getAttribute('data-to')].name; el.querySelector('small').textContent = nm; el.title = nm; el.setAttribute('aria-label', 'Ofrecerle a ' + nm); });
      dialogEl.hidden = false;
      return;
    }
    var trades = tradeOptions(), byGive = {};
    trades.forEach(function (t) { byGive[t.give] = t; });
    if (ctx.tradeUI.give && !byGive[ctx.tradeUI.give]) ctx.tradeUI.give = ctx.tradeUI.get = null;
    if (ctx.tradeUI.get && (!ctx.tradeUI.give || byGive[ctx.tradeUI.give].get.indexOf(ctx.tradeUI.get) < 0)) ctx.tradeUI.get = null;
    var give = ctx.tradeUI.give && byGive[ctx.tradeUI.give];
    function chips(attr, sel, enabled, label) {
      return '<div class="pick">' + HAND_KINDS.map(function (k) {
        var on = enabled(k), lab = label(k);
        return '<button type="button" data-' + attr + '="' + k + '" aria-pressed="' + (sel === k ? 'true' : 'false') + '"' + (on ? '' : ' disabled') +
          ' style="--c:' + TERRAINS[k].ui + '" title="' + TERRAINS[k].res + '"><span class="ico">' + resIcon(k) + '</span><small>' + lab + '</small></button>';
      }).join('') + '</div>';
    }
    dialogEl.innerHTML = CLOSE_BTN + '<h3>' + (tabs ? 'Comerciar' : 'Comerciar con el banco') + '</h3>' + tabs + '<p>' + dirIco(false, 'Esto se te va') + 'Doy</p>' +
      chips('give', ctx.tradeUI.give, function (k) { return !!byGive[k]; }, function (k) { return byGive[k] ? byGive[k].rate + ':1' : '&nbsp;'; }) +
      '<p>' + dirIco(true, 'Esto te entra') + 'Recibo</p>' +
      chips('get', ctx.tradeUI.get, function (k) { return !!give && give.get.indexOf(k) >= 0; }, function () { return '1'; }) +
      '<div class="sum">' + (give && ctx.tradeUI.get ? give.rate + ' × ' + TERRAINS[ctx.tradeUI.give].res + ' → 1 × ' + TERRAINS[ctx.tradeUI.get].res : '&nbsp;') + '</div>' + // sin ayuda (el ✓ aparece al completar); el renglón queda reservado
      '<div class="yesno"' + (give && ctx.tradeUI.get ? '' : ' style="visibility:hidden"') + '><button type="button" class="no" data-cancel aria-label="Cancelar" title="Cancelar">✕</button><button type="button" class="yes" data-ok aria-label="Confirmar" title="Confirmar">✓</button></div>';
    dialogEl.hidden = false;
  }
  // Oferta abierta, en un solo panel y sin texto: arriba quien ofrece y las cartas (flechas desde su lado; si te la ofrecen a
  // vos, desde el tuyo), abajo un redondel del color de cada consultado (pensando / ✓ / ✕). Quien ofrece concreta tocando un
  // redondel con ✓; a quien la recibe le salen además ✕ / ✓. Si no participás, la ves chica arriba, sin botones. Durante una
  // reproducción de eventos el panel sigue a `offerShown` (se llena al ritmo de las respuestas); al cerrarse queda
  // `OFFER_END_MS` con el resultado (los dos que cambiaron resaltados, o todo apagado): 1 s quieto y 0,2 s desvaneciéndose.
  function dirIco(down, label) { return '<span class="dir ' + (down ? 'in' : 'out') + '" title="' + label + '" aria-label="' + label + '">' + (down ? '↓' : '↑') + '</span>'; }
  var offerEnd = null, offerEndTimer = null, offerFresh = -1, offerCan = true, OFFER_END_MS = 1200;
  function copyOffer(t) { return { from: t.from, give: t.give, get: t.get, responses: t.responses.map(function (r) { return { player: r.player, status: r.status }; }) }; }
  function offerNow() { return (ctx.playing ? ctx.offerShown : ctx.game.trade) || offerEnd; }
  function offerWatch(t) { return t.from !== ctx.me && !t.responses.some(function (r) { return r.player === ctx.me; }); }
  function closeOffer(done) {
    var t = ctx.offerShown || (ctx.game.trade && copyOffer(ctx.game.trade));
    ctx.offerShown = null; offerFresh = -1; clearTimeout(offerEndTimer);
    if (t) { t.done = done; offerEnd = t; offerEndTimer = setTimeout(function () { offerEnd = null; renderDialog(); }, reduced() ? 0 : OFFER_END_MS); }
    renderDialog();
  }
  // Durante una reproducción: se abre una oferta (la de `offer`) o alguien responde.
  function offerProposed(offer) {
    clearTimeout(offerEndTimer); offerEnd = null; offerFresh = -1;
    ctx.offerShown = offer;
    renderDialog();
  }
  function offerResponded(p, animate) { offerFresh = animate ? p : -1; renderDialog(); }
  // `collapsed`: minimizada con la flecha; se ve como la chica de arriba y tocándola vuelve (tu redondel titila si falta tu respuesta).
  function renderOffer(t, watch, collapsed) {
    var live = !ctx.busy && !t.done && !!ctx.game.trade, act = function (type) { return live ? ctx.legal.filter(function (a) { return a.type === type; })[0] : null; };
    var mine = act('respondTrade'), conf = act('confirmTrade'), own = t.from === ctx.me, asked = !own && !watch;
    // Botones y aviso ocupan siempre su lugar (invisibles cuando no corresponden), para que el panel no cambie de tamaño al
    // responder o al cerrarse. Si el motor no lo dice (ya respondiste, o se está reproduciendo), se mira la mano: es solo aspecto.
    // Cerrada la oferta vale lo que se vio abierta (la mano ya cambió con el cambio).
    var can = t.done ? offerCan : mine ? mine.canAccept : HAND_KINDS.every(function (k) { return (ctx.myHand[k] || 0) >= (t.get[k] || 0); });
    offerCan = can;
    // Tu ✓ / ✕ sale en el acto, sin esperar a que se reproduzcan las respuestas de los demás: el motor ya te deja responder
    // (los bots consultados responden antes que las personas) y la respuesta va a la cola. Después, quien ofreció elige
    // entre los que aceptaron, como siempre.
    var early = asked && !mine && !t.done && ctx.playing && !ctx.sending && t.responses.some(function (r) { return r.player === ctx.me && r.status === 'pending'; });
    var answer = !!mine || early;
    var LABEL = { pending: 'pensando', accepted: 'aceptó', rejected: 'rechazó' };
    var dots = '<div class="dots">' + t.responses.map(function (r) {
      var p = r.player, pick = !!t.done && t.done.with === p, tap = !collapsed && !!conf && conf.with.indexOf(p) >= 0; // minimizada, la tira entera es el botón para abrirla
      var cls = 'dot st-' + r.status + (pick ? ' chosen' : '') + (offerFresh === p ? ' fresh' : '') + (tap ? ' tap' : '') + (collapsed && p === ctx.me && r.status === 'pending' ? ' wait' : '');
      var inner = r.status === 'accepted' ? '✓' : r.status === 'rejected' ? '✕' : '<i></i><i></i><i></i>';
      var attrs = ' class="' + cls + '" data-p="' + p + '" data-st="' + LABEL[r.status] + '" style="--pc:' + PLAYER_INFO[p].css + ';--pt:' + PLAYER_INFO[p].text + '"';
      return tap ? '<button type="button" data-with="' + p + '"' + attrs + '>' + inner + '</button>' : '<span' + attrs + '>' + inner + '</span>';
    }).join('') + '</div>';
    var from = '<span class="from' + (t.done && t.done.with !== undefined ? ' chosen' : '') + '" data-p="' + t.from + '" style="--pc:' + PLAYER_INFO[t.from].css + '"><span class="av">' + avatarHTML(t.from) + '</span></span>';
    var outGive = asked ? dirIco(true, 'Esto te entra') : dirIco(false, own ? 'Esto se te va' : 'Da');
    var outGet = asked ? dirIco(false, 'Esto se te va') : dirIco(true, own ? 'Esto te entra' : 'Pide');
    dialogEl.className = 'panel dialog trade offer' + (watch || collapsed ? ' mini' : '') + (collapsed ? ' collapsed' : '') + (t.done ? ' done' : '');
    if (collapsed) dialogEl.innerHTML = '<button type="button" data-expand aria-label="Abrir la oferta" title="Abrir la oferta">' + from + '<span class="swap">' + outGive + cardChips(t.give) + '</span><span class="swap">' + outGet + cardChips(t.get) + '</span>' + dots + CHEVRON_DOWN + '</button>';
    else if (watch) dialogEl.innerHTML = from + '<span class="swap">' + outGive + cardChips(t.give) + '</span><span class="swap">' + outGet + cardChips(t.get) + '</span>' + dots;
    else dialogEl.innerHTML = MIN_BTN + (asked ? '<div class="head">' + from + '<b class="who"></b></div>' : '') +
      '<div class="swap">' + outGive + cardChips(t.give) + '</div><div class="swap">' + outGet + cardChips(t.get) + '</div>' + dots +
      (asked && !can ? '<div class="sum">No tenés lo que te piden</div>' : '') +
      (asked ? '<div class="yesno"' + (answer ? '' : ' style="visibility:hidden"') + '><button type="button" class="no" data-reject' + (early ? ' data-early' : '') + ' aria-label="Rechazar" title="Rechazar"' + (answer ? '' : ' disabled') + '>✕</button>' +
        (can ? '<button type="button" class="yes" data-accept' + (early ? ' data-early' : '') + ' aria-label="Aceptar" title="Aceptar"' + (answer ? '' : ' disabled') + '>✓</button>' : '') + '</div>' : '') +
      (own ? '<button type="button" class="primary" data-cancel-offer' + (live ? '' : ' disabled style="visibility:hidden"') + '>Cancelar oferta</button>' : '');
    Array.prototype.forEach.call(dialogEl.querySelectorAll('[data-p]'), function (el) { // los nombres van por DOM (los escribe el jugador)
      var nm = PLAYER_INFO[+el.getAttribute('data-p')].name, st = el.getAttribute('data-st');
      el.title = nm; el.setAttribute('aria-label', st ? nm + ': ' + st : nm);
    });
    var who = dialogEl.querySelector('.who'); if (who) who.textContent = PLAYER_INFO[t.from].name;
    offerFresh = -1; // el saltito del redondel que acaba de cambiar va una sola vez
    dialogEl.hidden = false;
  }
  dialogEl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-min')) { minimized = panelKey; renderDialog(); return; } // se puede achicar y abrir aunque corra una animación
    if (b.hasAttribute('data-expand')) { minimized = ''; renderDialog(); return; }
    if (ctx.busy && !b.hasAttribute('data-early')) return;
    if (b.hasAttribute('data-early')) { // respuesta durante la reproducción: tu redondel cambia ya; lo que sigue se reproduce después
      var yes = b.hasAttribute('data-accept');
      if (ctx.offerShown) ctx.offerShown.responses.forEach(function (r) { if (r.player === ctx.me) r.status = yes ? 'accepted' : 'rejected'; });
      offerFresh = reduced() ? -1 : ctx.me;
      ctx.replay.dispatch({ type: 'respondTrade', player: ctx.me, accept: yes });
      renderDialog();
      return;
    }
    if (ctx.pendingCmd) {
      var cmd = ctx.pendingCmd; ctx.pendingCmd = null;
      if (b.hasAttribute('data-ok')) confirmDrop(cmd); else renderDialog();
      return;
    }
    if (ctx.summaryUI) { if (b.hasAttribute('data-close')) ctx.summaryUI = null; refreshUi(); return; } // se cierra y no vuelve a abrirse sola
    if (ctx.game.trade) { // oferta abierta: responder, concretar con quien aceptó o cancelar
      var tc = null;
      if (b.hasAttribute('data-accept')) tc = { type: 'respondTrade', player: ctx.me, accept: true };
      else if (b.hasAttribute('data-reject')) tc = { type: 'respondTrade', player: ctx.me, accept: false };
      else if (b.hasAttribute('data-with')) tc = { type: 'confirmTrade', player: ctx.me, with: +b.getAttribute('data-with') };
      else if (b.hasAttribute('data-cancel-offer')) tc = { type: 'cancelTrade', player: ctx.me };
      if (tc) { ctx.replay.dispatch(tc); return; } // si no, el clic es de otro panel (la oferta entre otros no tapa «Mis cartas»)
    }
    if (ctx.cardsUI) {
      if (b.hasAttribute('data-close')) ctx.cardsUI = null;
      else if (b.hasAttribute('data-cancel')) ctx.cardsUI = ctx.cardsUI.mode === 'hand' ? null : { mode: 'hand', res: null, picks: [] };
      else if (b.hasAttribute('data-play')) {
        var dk = b.getAttribute('data-play');
        if (dk === 'monopoly') ctx.cardsUI = { mode: 'monopoly', res: null, picks: [] };
        else if (dk === 'yearOfPlenty') ctx.cardsUI = { mode: 'plenty', res: null, picks: [] };
        else { ctx.cardsUI = null; ctx.replay.dispatch({ type: DEV[dk].play, player: ctx.game.turn }); return; } // Gaucho y Empedrado siguen sobre el tablero
      } else if (b.hasAttribute('data-res')) {
        var rk = b.getAttribute('data-res');
        if (ctx.cardsUI.mode === 'monopoly') ctx.cardsUI.res = rk; else if (ctx.cardsUI.picks.length < plentyNeed()) ctx.cardsUI.picks.push(rk);
      } else if (b.hasAttribute('data-clear')) ctx.cardsUI.picks = [];
      else if (b.hasAttribute('data-ok')) {
        var ui = ctx.cardsUI; ctx.cardsUI = null;
        ctx.replay.dispatch(ui.mode === 'monopoly' ? { type: 'playMonopoly', player: ctx.game.turn, resource: ui.res } : { type: 'playYearOfPlenty', player: ctx.game.turn, resources: ui.picks.slice() });
        return;
      }
      refreshUi();
      return;
    }
    if (ctx.tradeUI && b.hasAttribute('data-close')) { ctx.tradeUI = null; refreshUi(); return; } // ✕ del comercio: cierra y borra lo elegido
    if (ctx.tradeUI && ctx.tradeUI.tab === 'players') {
      var o = offerState(), at;
      if (b.hasAttribute('data-tab')) ctx.tradeUI.tab = b.getAttribute('data-tab');
      else if ((at = b.getAttribute('data-og-inc'))) o.give[at] = (o.give[at] || 0) + 1;
      else if ((at = b.getAttribute('data-og-dec'))) o.give[at] = Math.max(0, (o.give[at] || 0) - 1);
      else if ((at = b.getAttribute('data-ot-inc'))) o.get[at] = (o.get[at] || 0) + 1;
      else if ((at = b.getAttribute('data-ot-dec'))) o.get[at] = Math.max(0, (o.get[at] || 0) - 1);
      else if ((at = b.getAttribute('data-to'))) { var pid = +at, ix = o.to.indexOf(pid); if (ix >= 0) o.to.splice(ix, 1); else o.to.push(pid); }
      else if (b.hasAttribute('data-offer')) {
        var clean = function (c) { var r = {}; HAND_KINDS.forEach(function (k) { if (c[k] > 0) r[k] = c[k]; }); return r; };
        ctx.replay.dispatch({ type: 'proposeTrade', player: ctx.me, give: clean(o.give), get: clean(o.get), to: o.to.slice().sort() });
        return;
      }
      renderDialog();
      return;
    }
    if (ctx.tradeUI) {
      if (b.hasAttribute('data-tab')) { ctx.tradeUI.tab = b.getAttribute('data-tab'); renderDialog(); return; }
      if (b.hasAttribute('data-give')) ctx.tradeUI.give = b.getAttribute('data-give');
      else if (b.hasAttribute('data-get')) ctx.tradeUI.get = b.getAttribute('data-get');
      else if (b.hasAttribute('data-cancel')) { ctx.tradeUI = null; refreshUi(); return; }
      else if (b.hasAttribute('data-ok')) { ctx.replay.dispatch({ type: 'bankTrade', player: ctx.me, give: ctx.tradeUI.give, get: ctx.tradeUI.get }); return; }
      renderDialog();
      return;
    }
    var ph = ctx.game.phase;
    if (ph.kind === 'discard') {
      if (b.hasAttribute('data-inc')) discardSel[b.getAttribute('data-inc')] = (discardSel[b.getAttribute('data-inc')] || 0) + 1;
      else if (b.hasAttribute('data-dec')) discardSel[b.getAttribute('data-dec')] = (discardSel[b.getAttribute('data-dec')] || 0) - 1;
      else if (b.hasAttribute('data-confirm')) { ctx.replay.dispatch({ type: 'discard', player: ctx.game.turn, cards: discardSel }); return; }
      renderDialog();
    } else if (ph.kind === 'steal' && b.hasAttribute('data-victim')) ctx.replay.dispatch({ type: 'steal', player: ctx.game.turn, victim: +b.getAttribute('data-victim') });
  });

  // Jugada de construcción a la espera del ✓ / ✕ del jugador.
  function askConfirm(cmd) { ctx.pendingCmd = cmd; renderDialog(); }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (ctx.pendingCmd) { ctx.pendingCmd = null; renderDialog(); }
    else if (ctx.tradeUI && !ctx.tradeUI.hidden) { ctx.tradeUI = null; refreshUi(); }
    else if (ctx.cardsUI && !ctx.cardsUI.hidden) { ctx.cardsUI = ctx.cardsUI.mode === 'hand' ? null : { mode: 'hand', res: null, picks: [] }; refreshUi(); }
  });
  // Modal de confirmación pegado a la pieza: arriba de ella si entra en pantalla, si no abajo (y si ninguno entra, del lado
  // con más lugar). Se recalcula en cada cuadro porque la cámara orbita.
  function placeConfirm() {
    if (!ctx.pendingCmd || dialogEl.hidden || !dialogEl.classList.contains('confirm')) return;
    var top, bot, sr = stage.getBoundingClientRect();
    if (ctx.pendingCmd.type === 'buyDevCard') { // pegado al botón de la carta
      var br = btnDev.getBoundingClientRect(), cx = br.left - sr.left + br.width / 2;
      top = { x: cx, y: br.top - sr.top }; bot = { x: cx, y: br.bottom - sr.top };
    } else {
      var at = ctx.map.ghostAnchors(); if (!at) return;
      top = at.top; bot = at.bot;
    }
    var W = stage.clientWidth, H = stage.clientHeight, w = dialogEl.offsetWidth, h = dialogEl.offsetHeight, gap = 14, edge = 8;
    var fitsAbove = top.y - gap - h >= edge, fitsBelow = bot.y + gap + h <= H - edge;
    var above = fitsAbove || (!fitsBelow && top.y > H - bot.y);
    var y = above ? top.y - gap - h : bot.y + gap, x = (above ? top.x : bot.x) - w / 2;
    x = Math.max(edge, Math.min(W - w - edge, x)); y = Math.max(edge, Math.min(H - h - edge, y));
    var op = dialogEl.offsetParent, or = op ? op.getBoundingClientRect() : { left: 0, top: 0 };
    dialogEl.style.left = (sr.left - or.left + x) + 'px'; dialogEl.style.top = (sr.top - or.top + y) + 'px'; dialogEl.style.transform = 'none';
  }
  // Al confirmar, la pieza baja a su lugar y recién entonces se construye la real (sin animación de brote: ya llegó).
  function confirmDrop(cmd) {
    if (cmd.type === 'buyDevCard') { ctx.replay.dispatch(cmd); return; } // no hay pieza que apoyar: se compra directo
    if (reduced() || !ctx.map.dropGhost()) { ctx.replay.dispatch(cmd); return; }
    ctx.busy = true; dialogEl.hidden = true;
    var key = cmd.edge !== undefined ? 'e' + cmd.edge : 'v' + cmd.vertex + (cmd.type === 'buildCity' ? 'c' : 's');
    setTimeout(function () { ctx.busy = false; ctx.map.markSeen(key); ctx.replay.dispatch(cmd); }, DROP_MS);
  }

  btnTurn.addEventListener('click', function () {
    if (ctx.busy || !ctx.game) return;
    if (ctx.game.phase.kind === 'roll') ctx.replay.rollDice();
    else if (ctx.game.phase.kind === 'main') ctx.replay.dispatch({ type: 'endTurn', player: ctx.game.turn });
  });
  btnDev.addEventListener('click', function () {
    if (ctx.busy || !ctx.game) return;
    stow(); ctx.buildMode = null;
    if (ctx.pendingCmd && ctx.pendingCmd.type === 'buyDevCard') { ctx.pendingCmd = null; renderDialog(); } else askConfirm({ type: 'buyDevCard', player: ctx.game.turn });
  });
  // los botones de construir activan (o desactivan) el modo: el tablero muestra dónde se puede
  buildEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-build]'); if (!b || b.disabled || ctx.busy) return;
    var kind = b.getAttribute('data-build'); ctx.buildMode = ctx.buildMode === kind ? null : kind; stow(); refreshUi();
  });
  // Comerciar y Mis cartas: su botón de la bandeja los abre y los esconde (para mirar el tablero). Escondidos conservan lo
  // elegido y el botón queda marcado; si no había nada elegido, esconder es cerrar. Lo elegido se borra al jugar, al pasar el
  // turno o con el ✕ del panel. Son excluyentes entre sí, con el modo de construir y con una confirmación abierta.
  function tradeChosen(u) { var o = u.offer; return !!(u.give || u.get || (o && (sumOf(o.give) || sumOf(o.get)))); }
  function stow() {
    if (ctx.tradeUI && !ctx.tradeUI.hidden) { if (tradeChosen(ctx.tradeUI)) ctx.tradeUI.hidden = true; else ctx.tradeUI = null; }
    if (ctx.cardsUI && !ctx.cardsUI.hidden) { if (ctx.cardsUI.mode !== 'hand') ctx.cardsUI.hidden = true; else ctx.cardsUI = null; }
  }
  btnTrade.addEventListener('click', function () {
    if (ctx.busy || !ctx.game) return;
    var open = !!ctx.tradeUI && !ctx.tradeUI.hidden;
    ctx.pendingCmd = null; ctx.buildMode = null; stow();
    if (!open) { if (ctx.tradeUI) ctx.tradeUI.hidden = false; else ctx.tradeUI = { tab: ctx.legal.some(function (a) { return a.type === 'bankTrade'; }) ? 'bank' : 'players', give: null, get: null, offer: null }; }
    refreshUi();
  });
  btnCards.addEventListener('click', function () {
    if (ctx.busy || !ctx.game) return;
    var open = !!ctx.cardsUI && !ctx.cardsUI.hidden;
    ctx.pendingCmd = null; ctx.buildMode = null; stow();
    if (!open) { if (ctx.cardsUI) ctx.cardsUI.hidden = false; else ctx.cardsUI = { mode: 'hand', res: null, picks: [] }; }
    refreshUi();
  });

  return {
    renderHand: renderHand, renderSeats: renderSeats, renderSeatFaces: renderSeatFaces, resetPlayers: resetPlayers, applyView: applyView,
    refreshUi: refreshUi, renderDialog: renderDialog, showStatus: showStatus, statusSeq: function () { return statusSeq; },
    askConfirm: askConfirm, placeConfirm: placeConfirm,
    copyOffer: copyOffer, closeOffer: closeOffer, offerProposed: offerProposed, offerResponded: offerResponded
  };
}
