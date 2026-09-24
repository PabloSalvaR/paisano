// Animaciones de la interfaz: recursos que vuelan de las casillas a los puestos, robos, cartas jugadas y compradas, placas
// de los reconocimientos, copa de campeón y los destellos y cifras sobre puestos y tarjetas. Actualizan `ctx.myHand` y
// `ctx.counts` al ritmo de la animación (al final de la reproducción se corrigen con el estado real).
import * as THREE from 'three';
import { awardURL, devCardURL } from '../cardart';
import { DEV, TERRAINS, TILE_TOP } from './constants.js';
import { RES_ICONS } from './markup.js';

export const AWARD_MS = 3800; // placa de reconocimiento: ~2,5 s quieta en el centro antes de volar al puesto
// Carta jugada, tramos (ms): aparece, queda quieta en el centro (tiene que alcanzar para leerla), baja al tablero y se desvanece.
export const PLAYED_IN = 270, PLAYED_HOLD = 3000, PLAYED_DOWN = 570, PLAYED_FADE = 210;
export const PLAYED_MS = PLAYED_IN + PLAYED_HOLD + PLAYED_DOWN + PLAYED_FADE;
export const MONOPOLY_FLY_WAIT = PLAYED_IN + 500; // las cartas del Acopio salen volando cuando la carta ya se asentó en el centro

export function createFx(ctx) {
  var stage = ctx.stage, camera = ctx.camera, PLAYER_INFO = ctx.PLAYER_INFO;
  var handEl = stage.querySelector('.hand'), seatsEl = document.getElementById('seats');
  function handTotal(p) { return ctx.counts[p]; }

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
  // Copa dorada de campeón (dibujo propio, dos tonos para dar volumen): aparece un instante en el centro al ganar la
  // partida, la vean todos o no (solo quien ganó escucha la fanfarria, pero la copa es para toda la mesa).
  var TROPHY = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8h24v14c0 9-5 15-12 15S20 31 20 22V8z" fill="#f2c230"/>' +
    '<path d="M32 8h12v14c0 9-5 15-12 15z" fill="#d9a52a"/>' +
    '<path d="M20 10c-7 0-9 5-9 9s3 9 9 9" fill="none" stroke="#d9a52a" stroke-width="3.4" stroke-linecap="round"/>' +
    '<path d="M44 10c7 0 9 5 9 9s-3 9-9 9" fill="none" stroke="#f2c230" stroke-width="3.4" stroke-linecap="round"/>' +
    '<rect x="29" y="36" width="6" height="10" fill="#d9a52a"/><path d="M18 48h28l-3 8H21z" fill="#f2c230"/><path d="M32 48h14l-3 8H32z" fill="#d9a52a"/></svg>';
  function showTrophy() {
    var el = document.createElement('div'); el.className = 'trophy'; el.innerHTML = TROPHY; stage.appendChild(el);
    el.animate([
      { transform: 'translate(-50%,-30%) scale(.4) rotate(-10deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.15) rotate(4deg)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1, offset: 0.78 },
      { transform: 'translate(-50%,-65%) scale(.9) rotate(-4deg)', opacity: 0 }
    ], { duration: 2200, easing: 'ease-out' }).onfinish = function () { el.remove(); };
  }
  // Ruta más larga y Milicia más grande: la placa (cuadrada, para no confundirla con una carta) aparece en el centro para toda la mesa, con
  // una cinta que dice quién la tiene ahora, y vuela a su puesto (donde queda la insignia); el puesto que la perdió titila.
  function awardWon(p, kind, from) {
    var w = stage.clientWidth, h = stage.clientHeight, sr = stage.getBoundingClientRect();
    var el = document.createElement('div'); el.className = 'played award';
    el.innerHTML = '<img alt="" draggable="false"><span></span>';
    el.firstChild.src = awardURL(kind); el.firstChild.alt = kind === 'longestRoad' ? 'Ruta más larga' : 'Milicia más grande';
    var tag = el.lastChild; tag.style.background = PLAYER_INFO[p].css; tag.style.color = PLAYER_INFO[p].text;
    tag.textContent = PLAYER_INFO[p].name + ' tiene la ' + (kind === 'longestRoad' ? 'Ruta más larga' : 'Milicia más grande'); // simple, gane o pase de mano
    stage.appendChild(el);
    var ar = seatsEl.children[p].querySelector('.av').getBoundingClientRect(), tx = ar.left - sr.left + ar.width / 2, ty = ar.top - sr.top + ar.height / 2;
    var cx = w / 2, cy = h * 0.42;
    var at = function (x, y, sc, rot) { return 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) scale(' + sc + ') rotate(' + rot + 'deg)'; };
    el.animate([
      { transform: at(cx, cy + 40, 0.4, -10), opacity: 0 },
      { transform: at(cx, cy, 1.08, 3), opacity: 1, offset: 0.08 },
      { transform: at(cx, cy, 1, 0), opacity: 1, offset: 0.76 },
      { transform: at(tx, ty, 0.12, 0), opacity: 0.8, offset: 0.96 },
      { transform: at(tx, ty, 0.1, 0), opacity: 0 }
    ], { duration: AWARD_MS, easing: 'ease-in-out', fill: 'both' }).onfinish = function () { el.remove(); pop(seatsEl.children[p], PLAYER_INFO[p].css); };
    if (from !== null && from !== undefined) pop(seatsEl.children[from], PLAYER_INFO[from].css);
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
      var p = j.p, k = j.k, amount = j.n, mine = p === ctx.VIEWER, pl = PLAYER_INFO[p];
      var card = handEl.querySelector('[data-res="' + k + '"]'), seat = seatsEl.children[p];
      var target = mine ? card : seat, glow = mine ? card.style.getPropertyValue('--c') : pl.css;
      var gain = function () {
        if (mine) ctx.myHand[k] += amount;
        ctx.counts[p] += amount;
        if (mine) card.querySelector('b').textContent = ctx.myHand[k]; else seat.querySelector('.cnt b').textContent = handTotal(p);
        if (!animate) return;
        pop(target, glow); floatText(target, '+' + amount, mine ? card.style.getPropertyValue('--c') : pl.css);
      };
      if (!animate) { gain(); return; }
      var stolen = j.from !== undefined, delay = (stolen ? 250 : 450) + n * 260 + (j.wait || 0), sx, sy;
      if (stolen) { // robo o Acopio: sale de la víctima, que pierde las cartas en el momento de partir; si sos vos, de la tarjeta del recurso en el banner
        var fs = seatsEl.children[j.from], robbedMe = j.from === ctx.VIEWER, fr = (robbedMe ? card.querySelector('svg') : fs.querySelector('.av')).getBoundingClientRect();
        sx = fr.left - sr.left + fr.width / 2; sy = fr.top - sr.top + fr.height / 2;
        setTimeout(function () {
          ctx.counts[j.from] -= amount; fs.querySelector('.cnt b').textContent = handTotal(j.from);
          if (robbedMe) { ctx.myHand[k] -= amount; card.querySelector('b').textContent = ctx.myHand[k]; pop(card, card.style.getPropertyValue('--c')); floatText(card, '−' + amount, card.style.getPropertyValue('--c')); }
          else { pop(fs, PLAYER_INFO[j.from].css); if (j.wait !== undefined) floatText(fs, '−' + amount, PLAYER_INFO[j.from].css); }
        }, delay);
      } else {
        var v = new THREE.Vector3(j.t.x, TILE_TOP + 0.35, j.t.z).project(camera); sx = (v.x * 0.5 + 0.5) * w; sy = (0.5 - v.y * 0.5) * h;
      }
      var ar = (mine ? card.querySelector('svg') : seat.querySelector('.av')).getBoundingClientRect(), tx = ar.left - sr.left + ar.width / 2, ty = ar.top - sr.top + ar.height / 2;
      var fly = document.createElement('div'); fly.className = 'fly'; fly.style.background = pl.css; fly.appendChild(card.querySelector('svg').cloneNode(true)); stage.appendChild(fly);
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

  // Al jugar una carta de desarrollo (Gaucho, Acopio, Buena cosecha, Empedrado) la ve toda la mesa: aparece grande en el
  // centro, con una cinta del color de quien la jugó (si no fuiste vos), y después "baja" al tablero (se achica e inclina hacia el centro de
  // la mesa) y se desvanece, porque se descarta. Dura PLAYED_MS; las pausas de los demás la esperan.
  // Tramos (ms): aparece, queda quieta en el centro (tiene que alcanzar para leerla), baja al tablero y se desvanece.
  // `res` (opcional): el recurso elegido (Acopio), en una medalla sobre la esquina de la carta, para que se sepa qué se llevó sin leer el estado.
  function cardPlayed(p, kind, res) {
    var w = stage.clientWidth, h = stage.clientHeight;
    var el = document.createElement('div'); el.className = 'played';
    el.innerHTML = '<img alt="" draggable="false"><span></span>';
    el.firstChild.src = devCardURL(kind); el.firstChild.alt = DEV[kind].name;
    var tag = el.lastChild; // la cinta con el nombre es solo para la carta de otro: la propia ya sabés quién la jugó
    if (p === ctx.VIEWER) tag.remove(); else { tag.textContent = PLAYER_INFO[p].name; tag.style.background = PLAYER_INFO[p].css; tag.style.color = PLAYER_INFO[p].text; }
    if (res) {
      var medal = document.createElement('i'); medal.className = 'res-medal'; medal.title = TERRAINS[res].res;
      medal.style.setProperty('--c', TERRAINS[res].ui); medal.innerHTML = RES_ICONS[res];
      el.appendChild(medal);
    }
    stage.appendChild(el);
    var cx = w / 2, cy = h * 0.42, v = new THREE.Vector3(0, TILE_TOP, 0).project(camera), tx = (v.x * 0.5 + 0.5) * w, ty = (0.5 - v.y * 0.5) * h;
    var at = function (x, y, sc, rot) { return 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) scale(' + sc + ') rotate(' + rot + 'deg)'; };
    el.animate([
      { transform: at(cx, cy + 40, 0.5, -8), opacity: 0 },
      { transform: at(cx, cy, 1.05, 2), opacity: 1, offset: PLAYED_IN / PLAYED_MS },
      { transform: at(cx, cy, 1, 0), opacity: 1, offset: (PLAYED_IN + PLAYED_HOLD) / PLAYED_MS },
      { transform: at(tx, ty, 0.35, 14), opacity: 0.9, offset: (PLAYED_MS - PLAYED_FADE) / PLAYED_MS },
      { transform: at(tx, ty, 0.3, 16), opacity: 0 }
    ], { duration: PLAYED_MS, easing: 'ease-in-out', fill: 'both' }).onfinish = function () { el.remove(); };
  }

  return {
    pop: pop, floatText: floatText, tradeFx: tradeFx, flyGains: flyGains, cardPlayed: cardPlayed, awardWon: awardWon,
    revealCard: revealCard, showTrophy: showTrophy
  };
}
