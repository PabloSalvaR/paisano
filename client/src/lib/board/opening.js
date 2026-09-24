// Sorteo de quién abre. El motor ya sorteó (`game.opening`: rondas de 2 dados por jugador; si hay empate arriba, otra ronda
// solo con los empatados). Acá solo se muestra, una tirada por vez, y al terminar arranca la colocación (y, si abre un bot,
// empieza a jugar). Tocar lo salta.
import { miniDie, miniDieFace } from './dice.js';
import { reduced } from './util.js';

export function createOpening(ctx) {
  var audio = ctx.audio, PLAYER_INFO = ctx.PLAYER_INFO, withOthers = ctx.withOthers;
  var openingEl = document.getElementById('opening'), openingTimers = [];
  ctx.openingOn = false; // mientras dura el sorteo no se marca de quién es el turno (sería adelantar el resultado)
  // `fresh`: la única fila cuyos dados entran con animación (la recién revelada); las demás se redibujan quietas.
  function openingRows(round, shownN, winners, rollIdx, spinIdx, fresh) {
    return round.map(function (r, i) {
      var pl = PLAYER_INFO[r.player], out = i < shownN;
      if (i === spinIdx) return '<div class="orow spin" style="--pc:' + pl.css + '"><i></i><span class="nm"></span>' + miniDie(1 + Math.floor(Math.random() * 6)) + miniDie(1 + Math.floor(Math.random() * 6)) + '<b>…</b></div>'; // dados rodando (caras al azar, solo de adorno)
      if (i === rollIdx) return '<div class="orow mine" style="--pc:' + pl.css + '"><i></i><span class="nm"></span><button type="button" class="oroll">Tirar dados</button></div>'; // tu tirada: la hacés vos
      return '<div class="orow' + (winners && winners.indexOf(r.player) >= 0 ? ' win' : '') + '" style="--pc:' + pl.css + '"><i></i><span class="nm"></span>' +
        (out ? miniDie(r.roll[0], i === fresh) + miniDie(r.roll[1], i === fresh) + '<b>' + (r.roll[0] + r.roll[1]) + '</b>' : '<span class="odie ph"></span><span class="odie ph"></span><b>?</b>') + '</div>';
    }).join('');
  }
  function closeOpening() { openingTimers.forEach(clearTimeout); openingTimers = []; openingEl.hidden = true; openingEl.onclick = null; openingEl.style.minHeight = ''; ctx.openingOn = false; }
  function showOpening(rounds, first, done) {
    var animate = !reduced();
    ctx.openingOn = true; ctx.busy = true; ctx.hud.refreshUi(); ctx.hud.renderSeats();
    openingEl.hidden = false;
    function later(ms, fn) { openingTimers.push(setTimeout(fn, ms)); }
    function finish() {
      openingTimers.forEach(clearTimeout); openingTimers = [];
      openingEl.hidden = true; openingEl.onclick = null; openingEl.style.minHeight = ''; ctx.openingOn = false;
      ctx.busy = false; ctx.hud.refreshUi(); ctx.hud.renderSeats();
      ctx.hud.showStatus(first === ctx.VIEWER && withOthers ? 'Empezás vos' : 'Empieza ' + PLAYER_INFO[first].name, false, true, first);
      done();
    }
    openingEl.onclick = finish; // tocar salta el sorteo
    function playRound(ri) {
      var round = rounds[ri], last = ri === rounds.length - 1, max = Math.max.apply(null, round.map(function (r) { return r.roll[0] + r.roll[1]; }));
      var winners = round.filter(function (r) { return r.roll[0] + r.roll[1] === max; }).map(function (r) { return r.player; });
      function draw(n, note, win, rollIdx, spinIdx, fresh) {
        openingEl.innerHTML = '<h3>' + (ri === 0 ? '¿Quién empieza?' : 'Desempate') + '</h3><div class="orows">' + openingRows(round, n, win ? winners : null, rollIdx, spinIdx, fresh) + '</div><p class="onote">' + (note || '&nbsp;') + '</p>';
        Array.prototype.forEach.call(openingEl.querySelectorAll('.orow .nm'), function (el, i) { el.textContent = PLAYER_INFO[round[i].player].name; });
      }
      function conclude() {
        later(550, function () {
          var names = winners.map(function (p) { return PLAYER_INFO[p].name; });
          draw(round.length, last ? 'Empieza ' + names[0] : 'Empate entre ' + names.join(' y ') + ': tiran de nuevo', true);
          later(last ? 1900 : 1700, function () { if (last) finish(); else playRound(ri + 1); });
        });
      }
      // Los otros tiran solos, de a uno y con pausas para que se entienda: «Tira X…» con los dados rodando (~0,9 s),
      // el resultado queda a la vista (~0,9 s) y recién ahí tira el siguiente. Cuando le toca a quien mira, se frena hasta que toque «Tirar dados».
      // Mientras ruedan (el revolcón es CSS, `.orow.spin .odie`) solo se cambia la cara de los dados de esa fila, sin reemplazarlos,
      // para no cortar la animación ni redibujar el panel (eso repetía la entrada de todos los dados y parpadeaban).
      function spin(i, left, done) {
        var row = openingEl.querySelector('.orow.spin');
        if (!row) draw(i, withOthers && round[i].player === ctx.VIEWER ? 'Tirás…' : 'Tira ' + PLAYER_INFO[round[i].player].name + '…', false, null, i);
        else Array.prototype.forEach.call(row.querySelectorAll('.odie'), function (d) { d.innerHTML = miniDieFace(1 + Math.floor(Math.random() * 6)); });
        if (left <= 0) done(); else later(110, function () { spin(i, left - 1, done); });
      }
      function step(i) {
        if (i >= round.length) return conclude();
        if (withOthers && round[i].player === ctx.VIEWER) {
          draw(i, 'Tu turno: tirá los dados', false, i);
          openingEl.querySelector('.oroll').onclick = function (e) {
            e.stopPropagation();
            if (animate) audio.rollDice();
            spin(i, 8, function () { draw(i + 1, null, false, null, null, i); later(900, function () { step(i + 1); }); }); // tus dados también ruedan antes de mostrar el resultado
          };
          return;
        }
        later(i === 0 ? 1100 : 350, function () {
          if (animate) audio.rollDice(); // suenan los dados de cada uno que tira solo
          spin(i, 8, function () { draw(i + 1, null, false, null, null, i); later(900, function () { step(i + 1); }); });
        });
      }
      draw(0);
      if (ri === 0) openingEl.style.minHeight = openingEl.offsetHeight + 'px'; // el desempate tiene menos filas: el panel conserva el alto de la primera ronda y no se corre
      step(0);
    }
    playRound(0);
  }

  return { show: showOpening, close: closeOpening };
}
