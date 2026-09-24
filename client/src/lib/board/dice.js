// Dados: el recuadro grande con dos cubos de CSS al tirar, el chip que queda en la esquina todo el turno, la estadística de
// tiradas y las caras chicas que usan el sorteo de quién abre y el botón de turno.

// Cada dado es un cubo de 6 caras con puntos. Para mostrar la cara `v` de frente hay que girar el cubo:
//   [rotateX, rotateY] en grados; las caras opuestas suman 7 (1-6, 2-5, 3-4).
const DIE_FACES = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
export const DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const DIE_LAYOUT = [[1, 'front'], [6, 'back'], [3, 'right'], [4, 'left'], [2, 'top'], [5, 'bottom']];
const DIE_TILT = 'rotateX(-22deg) rotateY(-28deg)'; // leve inclinación fija para que se vean el techo y un costado
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

// Dado chico en SVG (botón de turno).
export function dieSVG(x, y, rot, pips) {
  return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ' 13 13)"><rect width="26" height="26" rx="6" fill="#c81e1e" stroke="#6e1414" stroke-width="2"/>' +
    pips.map(function (i) { return '<circle cx="' + (6.5 + (i % 3) * 6.5) + '" cy="' + (6.5 + Math.floor(i / 3) * 6.5) + '" r="2.2" fill="#fff"/>'; }).join('') + '</g>';
}
// Caras chicas (chip de los dados y sorteo de quién abre).
export function miniDieFace(v) {
  return '<rect x="1" y="1" width="24" height="24" rx="6" fill="#c81e1e" stroke="#6e1414" stroke-width="2"/>' +
    DIE_PIPS[v].map(function (i) { return '<circle cx="' + (6.5 + (i % 3) * 6.5) + '" cy="' + (6.5 + Math.floor(i / 3) * 6.5) + '" r="2.2" fill="#fff"/>'; }).join('');
}
export function miniDie(v, fresh) { return '<svg class="odie' + (fresh ? ' fresh' : '') + '" viewBox="0 0 26 26" aria-hidden="true">' + miniDieFace(v) + '</svg>'; }

export function createDice() {
  var diceBox = document.getElementById('dice'), diceTimer = null;
  diceBox.innerHTML = '<div class="dice-row"></div><b></b>';
  var diceRow = diceBox.firstChild, diceSum = diceRow.nextSibling;
  var dieA = buildDie(), dieB = buildDie(); diceRow.appendChild(dieA.el); diceRow.appendChild(dieB.el);
  // Después de mostrarse grandes, los dados se achican a un chip en la esquina (dos caras chicas y el total) que queda a la
  // vista todo el turno, como los dados que quedan sobre la mesa; se va cuando pasa el turno o se vuelve a tirar.
  var diceChip = document.createElement('div'); diceChip.className = 'dice-chip'; diceChip.hidden = true; diceChip.setAttribute('aria-hidden', 'true');
  diceBox.parentNode.appendChild(diceChip);
  function clearDice() { clearTimeout(diceTimer); diceBox.getAnimations().forEach(function (a) { a.cancel(); }); diceBox.hidden = true; diceChip.hidden = true; }
  function dockDice(a, b, s, animate) {
    diceChip.innerHTML = miniDie(a) + miniDie(b) + '<b>' + s + '</b>'; // mismas caras chicas que el sorteo de quién abre
    diceChip.hidden = false;
    if (!animate) { diceBox.hidden = true; return; }
    // el recuadro grande viaja hasta donde está el chip y se achica; recién al llegar aparece el chip
    var br = diceBox.getBoundingClientRect(), cr = diceChip.getBoundingClientRect(), base = getComputedStyle(diceBox).transform;
    base = base === 'none' ? '' : ' ' + base;
    var dx = cr.left + cr.width / 2 - (br.left + br.width / 2), dy = cr.top + cr.height / 2 - (br.top + br.height / 2);
    diceChip.style.visibility = 'hidden';
    diceBox.animate([{ transform: base || 'none', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px)' + base + ' scale(' + (cr.width / br.width) + ')', opacity: 0.3 }],
      { duration: 450, easing: 'ease-in' }).onfinish = function () { diceBox.hidden = true; diceChip.style.visibility = ''; };
  }
  // Estadística: cuántas veces salió cada total (2 a 12). Se reinicia con "Nuevo mapa" (partida nueva).
  var rollCounts = {}, chartEl = document.getElementById('chart'), statsN = document.getElementById('statsN');
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

  // La tirada: los dados ruedan y, cuando terminan de caer, se ve el total, se anota en la estadística y se llama a
  // `landed` (producción o ladrón); un rato después los dados se achican al chip.
  function roll(a, b, s, animate, landed) {
    clearDice();
    diceSum.textContent = '';
    diceBox.hidden = false;
    spinDie(dieA, a, animate); spinDie(dieB, b, animate);
    diceTimer = setTimeout(function () {
      diceSum.textContent = s;
      rollCounts[s]++; updateStats();
      diceTimer = setTimeout(function () { dockDice(a, b, s, animate); }, animate ? 1600 : 0);
      landed();
    }, animate ? 1250 : 0);
  }
  function resetStats() { for (var n = 2; n <= 12; n++) rollCounts[n] = 0; updateStats(); } // partida nueva

  return { roll: roll, clear: clearDice, resetStats: resetStats };
}
