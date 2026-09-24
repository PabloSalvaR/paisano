// Quién se sienta en cada asiento: nombre, personaje y color. Contra bots, el primero sos vos (con tu nombre, personaje y
// color) y los bots se sortean en cada partida.
import { DEFAULT_CAST, characterById, drawBotCharacters, portraitHTML } from '../characters';
import { SEAT_COLORS } from './markup.js';
import { shuffleAny } from './util.js';

// `PLAYERS`: materiales 3D de las piezas por asiento (drawBots los reparte según el color de cada uno).
export function createPlayers(opts, online, PLAYERS) {
  // El personaje (el retrato) sale de `characters.ts`: contra bots lo elegís vos y los bots sacan otros; la mesa local y las
  // salas online usan el elenco por asiento (`DEFAULT_CAST`), con el nombre del retrato hasta que la sala diga otro.
  var PLAYER_INFO = SEAT_COLORS.map(function (sc, i) { var ch = characterById(DEFAULT_CAST[i]); return { name: ch.name, character: ch.id, color: sc.id, css: sc.css, text: sc.text }; });
  if (online) opts.seats.forEach(function (st, i) { if (PLAYER_INFO[i]) PLAYER_INFO[i].name = st.name; }); // los nombres vienen de la sala
  // cuántos juegan: en línea, los de la sala; contra bots, lo elegido (3 o 4); en la mesa local, siempre 4
  var SEATS = online ? opts.seats.length : opts.mode === 'bots' && opts.players === 3 ? 3 : 4;
  var SEAT_MATS = PLAYERS.slice(); // materiales 3D en el orden de SEAT_COLORS (drawBots los reparte)
  if (!online && opts.mode === 'bots' && opts.name) { // contra bots: el primer asiento es la persona, con el nombre que puso
    PLAYER_INFO[0].name = opts.name;
    var chosen = characterById(opts.characterId);
    if (chosen) PLAYER_INFO[0].character = chosen.id;
    drawBots();
  }
  // Contra bots, quiénes te tocan se sortea en cada partida: cada bot saca un personaje entre los 12 (sin repetir el tuyo ni
  // uno que se llame como vos, así no hacen falta sufijos como «(bot)») y se llama como su retrato (`drawBotCharacters`). Los
  // colores también: vos tenés el elegido (rojo si no elegiste) y los otros tres se reparten al azar entre los bots, sin repetirse.
  function drawBots() {
    var pool = drawBotCharacters(PLAYER_INFO.length - 1, PLAYER_INFO[0].character, opts.name);
    var myColor = Math.max(0, SEAT_COLORS.findIndex(function (c) { return c.id === opts.colorId; }));
    var colors = [myColor].concat(shuffleAny(SEAT_COLORS.map(function (c, i) { return i; }).filter(function (i) { return i !== myColor; })));
    for (var p = 0; p < PLAYER_INFO.length; p++) {
      // las piezas 3D usan su propio material por asiento: van con el mismo color que el puesto
      PLAYER_INFO[p].color = SEAT_COLORS[colors[p]].id; PLAYER_INFO[p].css = SEAT_COLORS[colors[p]].css; PLAYER_INFO[p].text = SEAT_COLORS[colors[p]].text; PLAYERS[p] = SEAT_MATS[colors[p]];
      if (p > 0) { PLAYER_INFO[p].name = pool[p - 1].name; PLAYER_INFO[p].character = pool[p - 1].id; }
    }
  }
  function avatarHTML(p) { return portraitHTML(PLAYER_INFO[p].character, PLAYER_INFO[p].color); } // la ropa, del color del asiento

  return { PLAYER_INFO: PLAYER_INFO, SEATS: SEATS, drawBots: drawBots, avatarHTML: avatarHTML };
}
