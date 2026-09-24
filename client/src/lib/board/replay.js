// Comandos y eventos: manda las jugadas a la sesión y reproduce en orden lo que pasó (lo propio y lo de los demás), con
// pausas y animaciones. La vista (`ctx.game`) recién se actualiza al final de cada reproducción.
import { topology } from '../../engine';
import { DEV, HAND_KINDS, TERRAINS } from './constants.js';
import { AWARD_MS, MONOPOLY_FLY_WAIT, PLAYED_MS } from './fx.js';
import { reduced, sumOf } from './util.js';

export function createReplay(ctx) {
  var audio = ctx.audio, PLAYER_INFO = ctx.PLAYER_INFO, withOthers = ctx.withOthers;
  var handEl = ctx.stage.querySelector('.hand'), seatsEl = document.getElementById('seats');

  // La tirada la decide el motor (servidor autoritativo); acá solo se anima (ver playEvents): la pantalla revela el resultado
  // cuando los dados terminan de caer, y mientras tanto los botones y marcadores quedan bloqueados (busy).
  function rollDice() {
    if (ctx.busy || !ctx.game || ctx.game.phase.kind !== 'roll') return;
    ctx.busy = true; // también cubre la espera de la respuesta de la sesión
    ctx.session.send({ type: 'rollDice', player: ctx.game.turn }).then(function (r) {
      if (!r.ok) { ctx.busy = false; ctx.hud.showStatus(r.error.message, true); return; }
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
        if (n > 0) { left[k] -= n; jobs.push({ t: ctx.map.tiles()[et.id], p: +p, k: terr, n: n }); }
      });
    });
    return jobs;
  }

  // Envía un comando al motor: si lo acepta, actualiza el tablero; si no, muestra el error.
  function dispatch(cmd) {
    if (ctx.sending) return;
    ctx.pendingCmd = null;
    ctx.sending = true;
    ctx.session.send(cmd).then(function (r) { ctx.sending = false; settle(cmd, r); });
  }
  // Respuesta de la sesión a un comando: la pantalla se pone al día (con animaciones) recién acá, no antes.
  function settle(cmd, r) {
    if (ctx.playing) { // respuesta a un rechazo temprano (se mandó durante una reproducción): sus eventos van a la cola
      if (r.ok) queue.push(r.events); else ctx.hud.showStatus(r.error.message, true);
      if (resumeReplay) { var go = resumeReplay; resumeReplay = null; go(); }
      return;
    }
    if (!r.ok) { ctx.hud.showStatus(r.error.message, true); ctx.hud.renderDialog(); return; }
    // un panel escondido con algo elegido sobrevive a otras jugadas (construir, por ejemplo); se borra al usarlo o al pasar el turno
    var done = cmd.type === 'endTurn';
    if (!ctx.tradeUI || !ctx.tradeUI.hidden || done || /Trade$/.test(cmd.type)) ctx.tradeUI = null;
    if (!ctx.cardsUI || !ctx.cardsUI.hidden || done || /^play/.test(cmd.type)) ctx.cardsUI = null;
    ctx.buildMode = null;
    if (cmd.type === 'buyDevCard') audio.card(); // la carta propia suena al comprarla (las de otros, al reproducir el evento)
    var landed = { placeRoad: 'road', buildRoad: 'road', placeSettlement: 'settlement', buildSettlement: 'settlement', buildCity: 'city' }[cmd.type];
    if (landed) audio.land(landed); // la pieza toca el tablero
    playEvents(r.events);
  }

  // En línea, lo que hacen los demás llega por la sesión (polling): se reproduce igual que lo propio, en orden. Devuelve la
  // función que corta la suscripción.
  function listen(session) {
    return session.subscribe(function (v, events) {
        if (!events.length) return;
        if (ctx.playing || ctx.busy || ctx.sending) queue.push(events); else playEvents(events);
    });
  }

  // ------------------------------------------------------------------ reproducción de eventos
  // Lo que pasó después de un comando (lo propio y, contra bots, lo de los demás) llega como una lista de eventos. Se
  // reproducen en orden, con pausas cortas cuando actúa otro jugador, para que se vea qué hizo cada uno. `game` (la vista)
  // recién se actualiza al final; mientras tanto `shown` es lo ya dibujado y `counts`, `myHand` y `vps` avanzan al ritmo
  // de la animación (al terminar se corrigen con el estado real: si algo quedó corrido, se arregla solo).
  function foreign(p) { return withOthers && p !== ctx.VIEWER; } // jugadas de otro: llevan pausa y sonido
  var BOT_GAP_MS = 2000; // «piensa» este rato antes de cada acción de otro, para que se pueda seguir lo que hace
  var queue = [], resumeReplay = null; // queue: tandas de eventos de otros que llegaron mientras se reproducía otra
  function playEvents(events) {
    var animate = !reduced(), i = 0, note = null;
    ctx.playing = true; ctx.offerShown = ctx.game.trade && ctx.hud.copyOffer(ctx.game.trade);
    ctx.busy = true; ctx.hud.refreshUi();
    function pause(cont, ms) { if (animate && ms > 0) setTimeout(cont, ms); else cont(); }
    // Antes de una acción de otro jugador: espera BOT_GAP_MS. `spent`: la acción abre con ResourcesSpent (construir); su pieza
    // llega justo después y no vuelve a esperar.
    function gap(p, cont, again) { if (!again && foreign(p)) return pause(cont, BOT_GAP_MS); return cont(); }
    function afterSpent(ev) { var prev = events[i - 2]; return !!prev && prev.type === 'ResourcesSpent' && prev.player === ev.player; }
    function take(type) { var e = events[i]; if (e && e.type === type) { i++; return e; } return null; }
    function next() {
      if (i >= events.length) {
        if (queue.length) { events = queue.shift(); i = 0; return next(); } // sigue con lo que llegó mientras tanto
        if (ctx.sending) { resumeReplay = next; return; } // un rechazo temprano todavía sin respuesta: se la espera para seguir
        // el aviso del robo sobrevive al refresco final, pero solo si sigue siendo lo último que se mostró: si después pasó
        // otra cosa (sobre todo el cambio de turno) no se repone, para que no quede colgado cuando te toca tirar
        var keep = note && note.seq === ctx.hud.statusSeq();
        ctx.playing = false; ctx.busy = false; ctx.offerShown = null; ctx.pull(); ctx.map.syncPieces(); ctx.hud.applyView();
        if (keep) ctx.hud.showStatus(note.text, false, true, note.who);
        return;
      }
      handle(events[i++], next);
    }
    // la tirada: dados rodando; el resultado y la producción aparecen cuando terminan de caer
    function rollAnim(ev, dist, cont) {
      var a = ev.dice[0], b = ev.dice[1], s = ev.total;
      if (animate) audio.rollDice();
      ctx.dice.roll(a, b, s, animate, function () {
        var dur = 0;
        if (s === 7) { ctx.map.robberJump(); if (animate) audio.seven(); }
        else { ctx.map.pulseNumber(s); dur = ctx.fx.flyGains(rollJobs({ map: ctx.game.map, robber: ctx.shown.robber, vertexBuildings: ctx.shown.vertexBuildings }, s, dist ? dist.gains : []), animate); }
        setTimeout(cont, animate ? Math.max(dur, 900) : 0); // se sigue cuando terminan de llegar los recursos
      });
    }
    function handle(ev, cont) {
      var p = ev.player;
      switch (ev.type) {
        case 'DiceRolled': return gap(p, function () { rollAnim(ev, take('ResourcesDistributed'), cont); });
        case 'SettlementBuilt': case 'CityBuilt': case 'RoadBuilt':
          return gap(p, function () { built(ev, cont); }, afterSpent(ev));
        case 'ResourcesSpent':
          return gap(p, function () {
            ctx.counts[p] -= sumOf(ev.cost);
            if (p === ctx.VIEWER) { for (var kc in ev.cost) ctx.myHand[kc] -= ev.cost[kc]; ctx.hud.renderHand(); }
            ctx.hud.renderSeats();
            cont();
          });
        case 'Discarded':
          return gap(p, function () {
            ctx.counts[p] -= sumOf(ev.cards);
            if (p === ctx.VIEWER) { for (var kd in ev.cards) ctx.myHand[kd] -= ev.cards[kd]; ctx.hud.renderHand(); }
            ctx.hud.renderSeats();
            if (foreign(p) && animate) ctx.fx.pop(seatsEl.children[p], PLAYER_INFO[p].css);
            pause(cont, foreign(p) ? 550 : 0);
          });
        case 'RobberMoved':
          return gap(p, function () { ctx.shown.robber = ev.tile; ctx.map.syncRobber(); if (foreign(p) && animate) audio.robberMoved(); pause(cont, foreign(p) ? 800 : 0); });
        case 'BankTraded':
          return gap(p, function () {
            ctx.counts[p] += 1 - ev.giveCount; ctx.hud.renderSeats();
            audio.trade();
            if (p === ctx.VIEWER) ctx.fx.tradeFx(ev); else if (animate) ctx.fx.pop(seatsEl.children[p], PLAYER_INFO[p].css);
            pause(cont, foreign(p) ? 600 : 0);
          });
        case 'TradeProposed':
          return gap(p, function () {
            audio.card();
            ctx.hud.offerProposed({ from: p, give: ev.give, get: ev.get, responses: ev.to.map(function (q) { return { player: q, status: 'pending' }; }) });
            if (animate) ctx.fx.pop(seatsEl.children[p], PLAYER_INFO[p].css);
            pause(cont, foreign(p) ? 1100 : 300);
          });
        case 'TradeResponded':
          if (ctx.offerShown) ctx.offerShown.responses.forEach(function (r) { if (r.player === p) r.status = ev.accept ? 'accepted' : 'rejected'; });
          ctx.hud.offerResponded(p, animate);
          // si lo que sigue ya cierra la oferta, no hace falta esperar: el resultado queda a la vista al cerrarse
          var closes = events[i] && (events[i].type === 'TradeCancelled' || events[i].type === 'TradeCompleted');
          return pause(cont, foreign(p) && !closes ? 900 : 0);
        case 'TradeCompleted': {
          var gn = sumOf(ev.give), tn = sumOf(ev.get);
          ctx.counts[p] += tn - gn; ctx.counts[ev.with] += gn - tn;
          HAND_KINDS.forEach(function (k) {
            if (p === ctx.VIEWER) ctx.myHand[k] += (ev.get[k] || 0) - (ev.give[k] || 0);
            if (ev.with === ctx.VIEWER) ctx.myHand[k] += (ev.give[k] || 0) - (ev.get[k] || 0);
          });
          ctx.hud.renderSeats(); ctx.hud.renderHand(); audio.trade();
          if (animate) { ctx.fx.pop(seatsEl.children[p], PLAYER_INFO[p].css); ctx.fx.pop(seatsEl.children[ev.with], PLAYER_INFO[ev.with].css); }
          ctx.hud.closeOffer({ with: ev.with });
          return pause(cont, foreign(p) || foreign(ev.with) ? 900 : 0);
        }
        case 'TradeCancelled':
          ctx.hud.closeOffer({ reason: ev.reason });
          return pause(cont, foreign(p) ? 700 : 0);
        case 'DevCardBought':
          return gap(p, function () {
            ctx.devCounts[p]++; ctx.hud.renderSeats();
            if (foreign(p)) audio.card();
            if (animate) ctx.fx.pop(seatsEl.children[p], PLAYER_INFO[p].css);
            if (ev.kind) { ctx.hud.showStatus('Compraste: ' + DEV[ev.kind].name, false, true, p); if (animate) ctx.fx.revealCard(ev.kind); }
            else ctx.hud.showStatus(PLAYER_INFO[p].name + ' compró una carta de desarrollo', false, true, p);
            pause(cont, foreign(p) ? 650 : 0);
          }, afterSpent(ev));
        case 'KnightPlayed':
          return gap(p, function () {
            ctx.devCounts[p] = Math.max(0, ctx.devCounts[p] - 1); ctx.knights[p]++; ctx.hud.renderSeats();
            if (foreign(p)) audio.card();
            if (animate) { ctx.fx.pop(seatsEl.children[p], PLAYER_INFO[p].css); ctx.fx.cardPlayed(p, 'knight'); }
            ctx.hud.showStatus((p === ctx.VIEWER ? 'Jugaste un Gaucho' : PLAYER_INFO[p].name + ' jugó un Gaucho'), false, true, p);
            pause(cont, foreign(p) ? PLAYED_MS : 0);
          });
        case 'MonopolyPlayed':
          return gap(p, function () {
            var total = 0, fly = 0;
            ctx.devCounts[p] = Math.max(0, ctx.devCounts[p] - 1);
            // lo que se lleva vuela desde cada uno que lo tenía (si sos vos, desde tu banner) hasta quien jugó la carta, como en el
            // robo; sale cuando la carta ya está a la vista en el centro
            var jobs = ev.taken.filter(function (t) { return t.amount > 0; }).map(function (t) {
              total += t.amount;
              return { from: t.player, p: p, k: ev.resource, n: t.amount, wait: MONOPOLY_FLY_WAIT };
            });
            ctx.hud.renderSeats();
            if (foreign(p)) audio.card();
            if (animate) { ctx.fx.pop(seatsEl.children[p], PLAYER_INFO[p].css); ctx.fx.cardPlayed(p, 'monopoly', ev.resource); fly = MONOPOLY_FLY_WAIT + ctx.fx.flyGains(jobs, true); }
            else {
              jobs.forEach(function (j) { ctx.counts[j.from] -= j.n; if (j.from === ctx.VIEWER) ctx.myHand[ev.resource] -= j.n; });
              ctx.counts[p] += total; if (p === ctx.VIEWER) ctx.myHand[ev.resource] += total;
              ctx.hud.renderSeats(); ctx.hud.renderHand();
            }
            ctx.hud.showStatus((p === ctx.VIEWER ? 'Jugaste Acopio' : PLAYER_INFO[p].name + ' jugó Acopio') + ': ' + TERRAINS[ev.resource].res.toLowerCase() + (total ? ' (+' + total + ')' : ' (nadie tenía)'), false, true, p);
            pause(cont, Math.max(foreign(p) ? PLAYED_MS : 1100, fly));
          });
        case 'YearOfPlentyPlayed':
          return gap(p, function () {
            ctx.devCounts[p] = Math.max(0, ctx.devCounts[p] - 1);
            ev.gains.forEach(function (g) {
              ctx.counts[g.player] += g.amount;
              if (g.player === ctx.VIEWER) ctx.myHand[g.resource] += g.amount;
            });
            ctx.hud.renderSeats(); ctx.hud.renderHand();
            if (foreign(p)) audio.card();
            if (animate) {
              ctx.fx.cardPlayed(p, 'yearOfPlenty');
              ev.gains.forEach(function (g) {
                var card = g.player === ctx.VIEWER ? handEl.querySelector('[data-res="' + g.resource + '"]') : seatsEl.children[g.player], col = g.player === ctx.VIEWER ? card.style.getPropertyValue('--c') : PLAYER_INFO[g.player].css;
                ctx.fx.pop(card, col); ctx.fx.floatText(card, '+' + g.amount, col);
              });
            }
            ctx.hud.showStatus((p === ctx.VIEWER ? 'Jugaste Buena cosecha' : PLAYER_INFO[p].name + ' jugó Buena cosecha'), false, true, p);
            pause(cont, foreign(p) ? PLAYED_MS : 900);
          });
        case 'RoadBuildingPlayed':
          return gap(p, function () {
            ctx.devCounts[p] = Math.max(0, ctx.devCounts[p] - 1); ctx.hud.renderSeats();
            if (foreign(p)) audio.card();
            if (animate) { ctx.fx.pop(seatsEl.children[p], PLAYER_INFO[p].css); ctx.fx.cardPlayed(p, 'roadBuilding'); }
            ctx.hud.showStatus((p === ctx.VIEWER ? 'Jugaste Empedrado' : PLAYER_INFO[p].name + ' jugó Empedrado') + ': 2 caminos gratis', false, true, p);
            pause(cont, foreign(p) ? PLAYED_MS : 0);
          });
        case 'LongestRoadChanged': {
          var pts = ctx.game.config.awardPoints;
          ctx.awardRoad = { holder: ev.player, length: ev.length }; if (ev.player !== null) ctx.roadLens[ev.player] = ev.length;
          if (ev.from !== null) ctx.vps[ev.from] -= pts;
          if (ev.player !== null) ctx.vps[ev.player] += pts;
          ctx.hud.renderSeats(); ctx.hud.renderHand();
          if (animate && ev.player !== null) ctx.fx.awardWon(ev.player, 'longestRoad', ev.from);
          ctx.hud.showStatus(ev.player === null ? PLAYER_INFO[ev.from].name + ' perdió la Ruta más larga' : (ev.player === ctx.VIEWER ? 'Tenés' : PLAYER_INFO[ev.player].name + ' tiene') + ' la Ruta más larga (' + ev.length + ' caminos)', false, true, ev.player === null ? ev.from : ev.player);
          return pause(cont, ev.player === null ? 1000 : AWARD_MS); // si nadie se queda con la ruta, va solo el aviso
        }
        case 'LargestArmyChanged': {
          var apts = ctx.game.config.awardPoints;
          ctx.awardArmy = { holder: ev.player, size: ev.size };
          if (ev.from !== null) ctx.vps[ev.from] -= apts;
          ctx.vps[ev.player] += apts;
          ctx.hud.renderSeats(); ctx.hud.renderHand();
          if (animate) ctx.fx.awardWon(ev.player, 'largestArmy', ev.from);
          ctx.hud.showStatus((ev.player === ctx.VIEWER ? 'Tenés' : PLAYER_INFO[ev.player].name + ' tiene') + ' la Milicia más grande (' + ev.size + ' gauchos)', false, true, ev.player);
          return pause(cont, AWARD_MS);
        }
        case 'Stolen': return stolen(ev, cont);
        case 'GameWon': // solo suena si ganaste, la copa, el resumen y el giro de cámara son para toda la mesa
          ctx.vps[ev.player] = ev.points; ctx.hud.renderSeats(); ctx.hud.renderHand(); // el evento trae el total con los Puntos de victoria ocultos
          if (animate) { if (ev.player === ctx.VIEWER) audio.victory(); ctx.fx.showTrophy(); ctx.summaryUI = ctx.summaryShown = true; }
          ctx.rig.setOrbit(true);
          return cont();
        case 'TurnChanged':
          ctx.turn = ev.player; ctx.hud.renderSeats(); ctx.dice.clear();
          if (withOthers) ctx.hud.showStatus(ev.player === ctx.VIEWER ? 'Tu turno' : 'Turno de ' + PLAYER_INFO[ev.player].name, false, false, ev.player);
          return pause(cont, foreign(ev.player) ? 450 : 0);
        default: return cont(); // DiscardRequired, ResourcesDistributed suelto, GameWon: lo muestra el estado final
      }
    }
    function built(ev, cont) {
      var p = ev.player;
      {
          var kind = ev.type === 'RoadBuilt' ? 'road' : ev.type === 'CityBuilt' ? 'city' : 'settlement';
          if (kind === 'road') ctx.shown.edgeRoads[ev.edge] = p; else ctx.shown.vertexBuildings[ev.vertex] = { player: p, city: kind === 'city' };
          if (kind !== 'road') { ctx.vps[p] += 1; ctx.hud.renderSeats(); if (p === ctx.VIEWER) ctx.hud.renderHand(); }
          ctx.map.syncPieces();
          if (foreign(p)) audio.land(kind); // las propias ya sonaron al tocar
          var wait = foreign(p) ? 650 : 0;
          // la 2.ª casa de la colocación inicial cobra recursos: se animan desde las casillas que toca
          var got = kind === 'settlement' ? take('ResourcesDistributed') : null;
          if (got) {
            var jobs = [];
            topology().vertices[ev.vertex].tiles.forEach(function (tid) {
              var terr = ctx.game.map.terrains[tid];
              if (terr !== 'desert') jobs.push({ t: ctx.map.tiles()[tid], p: p, k: terr, n: 1 });
            });
            wait = Math.max(wait, ctx.fx.flyGains(jobs, animate));
          }
          return pause(cont, wait);
        }
    }
    function stolen(ev, cont) {
      if (ev.victim === ctx.VIEWER && animate) audio.robbed(); // la melodía es solo para quien perdió la carta
      if (ev.resource) { // los dos implicados ven qué carta fue
        note = { text: (ev.thief === ctx.VIEWER ? 'Le robaste ' : PLAYER_INFO[ev.thief].name + ' le robó ') + TERRAINS[ev.resource].res.toLowerCase() + ' a ' + PLAYER_INFO[ev.victim].name, who: ev.thief };
        ctx.hud.showStatus(note.text, false, true, note.who); note.seq = ctx.hud.statusSeq();
        return pause(cont, ctx.fx.flyGains([{ from: ev.victim, p: ev.thief, k: ev.resource, n: 1 }], animate));
      }
      note = { text: PLAYER_INFO[ev.thief].name + ' le robó una carta a ' + PLAYER_INFO[ev.victim].name, who: ev.thief }; // un tercero no ve cuál
      ctx.hud.showStatus(note.text, false, true, note.who); note.seq = ctx.hud.statusSeq();
      ctx.counts[ev.victim] -= 1; ctx.counts[ev.thief] += 1; ctx.hud.renderSeats();
      if (animate) { ctx.fx.pop(seatsEl.children[ev.victim], PLAYER_INFO[ev.victim].css); ctx.fx.pop(seatsEl.children[ev.thief], PLAYER_INFO[ev.thief].css); }
      return pause(cont, 700);
    }
    next();
  }

  return { dispatch: dispatch, rollDice: rollDice, playEvents: playEvents, listen: listen };
}
