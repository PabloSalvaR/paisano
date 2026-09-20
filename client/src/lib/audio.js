/* eslint-disable */
// Sonido procedural (Web Audio, sin archivos ni librerías): dados y ambiente según la luz.
// El AudioContext se crea recién con el primer gesto del usuario (los navegadores bloquean el autoplay).

var VOLUME_KEY = 'paisano.volume', AMBIENT_KEY = 'paisano.ambient';
// Mezcla del ambiente por luz: pájaros (piar suelto) y grillos (solo de noche).
var AMBIENT = {
  day:   { birds: 1,    crickets: 0 },
  dusk:  { birds: 0.35, crickets: 0 },
  night: { birds: 0,    crickets: 1 }
};

export function createAudio() {
  var ctx = null, master = null, ambientBus = null, cricketLevel = 0, birdLevel = 0, mode = 'day';
  var birdTimer = 0, cricketTimer = 0, disposed = false, noiseBuf = null;
  var started = false; // ya sonó el primer pájaro (para que el ambiente se note apenas se habilita el audio)
  var volume = 0.5, ambientOn = true; // volume: 0..1 (0 = silencio total, dados incluidos)
  try {
    ambientOn = localStorage.getItem(AMBIENT_KEY) !== 'off';
    var v = parseFloat(localStorage.getItem(VOLUME_KEY)); if (v >= 0 && v <= 1) volume = v;
  } catch (e) {}

  function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = buf);
  }
  function fade(param, value, tc) { param.setTargetAtTime(value, ctx.currentTime, tc || 0.6); }

  // ---------------------------------------------------------------- ambiente
  function startAmbient() {
    ambientBus = ctx.createGain(); ambientBus.gain.value = ambientOn ? 1 : 0; ambientBus.connect(master);
    setAmbient(mode, true);
    scheduleBirds();
    scheduleCrickets();
  }
  function setAmbient(m, instant) {
    mode = AMBIENT[m] ? m : 'day';
    if (!ctx) return;
    var a = AMBIENT[mode];
    cricketLevel = a.crickets;
    birdLevel = a.birds;
  }
  function chirp(t0, base, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t0);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, t0 + 0.11);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(ambientBus); o.start(t0); o.stop(t0 + 0.14);
  }
  function birdCall() {
    var n = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1800, t = ctx.currentTime + 0.05;
    for (var i = 0; i < n; i++) chirp(t + i * (0.13 + Math.random() * 0.05), base * (0.92 + Math.random() * 0.16), 0.07 * Math.max(birdLevel, 0.5));
  }
  function scheduleBirds() {
    if (disposed) return;
    birdTimer = setTimeout(function () {
      if (ctx.state === 'running' && ambientOn && Math.random() < birdLevel) birdCall();
      scheduleBirds();
    }, 1800 + Math.random() * 3200);
  }

  // Grillos: cantos sueltos y espaciados, no un zumbido continuo. Cada canto son 3 a 6 pulsitos agudos; entre uno y otro pasa un
  // silencio al azar (a veces largo) y de vez en cuando otro grillo contesta. De noche suenan; de día y al atardecer, no.
  function cricketPulse(t0, freq, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    o.connect(g); g.connect(ambientBus); o.start(t0); o.stop(t0 + 0.05);
  }
  function cricketCall() {
    var base = 3900 + Math.random() * 700, n = 3 + Math.floor(Math.random() * 4), gap = 0.05 + Math.random() * 0.03;
    var t = ctx.currentTime + 0.05, vol = 0.03 * cricketLevel * (0.6 + Math.random() * 0.6);
    for (var i = 0; i < n; i++) cricketPulse(t + i * gap, base * (0.995 + Math.random() * 0.01), vol);
  }
  function scheduleCrickets() {
    if (disposed) return;
    var wait = 1200 + Math.random() * 3800 + (Math.random() < 0.2 ? 3000 + Math.random() * 5000 : 0);
    cricketTimer = setTimeout(function () {
      if (ctx.state === 'running' && ambientOn && Math.random() < cricketLevel) {
        cricketCall();
        if (Math.random() < 0.3) setTimeout(function () { if (!disposed && ctx.state === 'running') cricketCall(); }, 150 + Math.random() * 400); // otro grillo contesta
      }
      scheduleCrickets();
    }, wait);
  }

  // ---------------------------------------------------------------- dados
  // Un golpe de dado sobre madera: "toc" sordo (seno corto y grave) + un poco de ruido filtrado sin agudos.
  function click(t, vol, freq) {
    var o = ctx.createOscillator(), og = ctx.createGain();
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.05);
    og.gain.setValueAtTime(vol, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.07);
    var s = ctx.createBufferSource(); s.buffer = noiseBuffer();
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    s.connect(lp); lp.connect(g); g.connect(master); s.start(t, Math.random(), 0.05);
  }
  // Dados: cinco toques de rebote que se espacian (el primero es suave y arranca con el clic) y un golpe al caer.
  // El giro dura ~1.15 s, como el ease-out del CSS.
  var BOUNCES = [[0, 0.12], [0.24, 0.2], [0.48, 0.18], [0.7, 0.15], [0.88, 0.12], [1.02, 0.09]]; // [segundos desde el clic, volumen]
  function rollDice() {
    if (!ctx) return;
    var t0 = ctx.currentTime + 0.005, tl = t0 + 1.15;
    BOUNCES.forEach(function (b) { click(t0 + b[0], b[1], 380 + Math.random() * 160); });
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, tl); o.frequency.exponentialRampToValueAtTime(60, tl + 0.14);
    g.gain.setValueAtTime(0.4, tl); g.gain.exponentialRampToValueAtTime(0.0001, tl + 0.2);
    o.connect(g); g.connect(master); o.start(tl); o.stop(tl + 0.22);
    click(tl, 0.3, 480);
  }

  // ---------------------------------------------------------------- piezas
  // Una pieza de madera que se apoya con suavidad: "tum" redondo y grave, sin el chasquido seco (arranque suave, sin ruido agudo).
  // El camino es liviano; el poblado, más lleno; la ciudad, más grave y con un segundo apoyo tenue.
  var LAND = { road: [225, 0.32, 0.13], settlement: [165, 0.42, 0.17], city: [120, 0.52, 0.22] }; // [frecuencia, volumen, duración]
  function thump(t, freq, vol, dur) {
    var o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1500;
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
  }
  function land(kind) {
    if (!ctx) return;
    var p = LAND[kind] || LAND.settlement, t = ctx.currentTime + 0.005;
    thump(t, p[0], p[1], p[2]);
    click(t, p[1] * 0.3, p[0] * 2.2); // toquecito seco y bajo, para que se sienta el golpe
    if (kind === 'city') thump(t + 0.13, p[0] * 1.3, p[1] * 0.4, 0.1);
  }

  // ---------------------------------------------------------------- control
  function applyGain() { if (master) fade(master.gain, volume, 0.05); }
  // Llamar desde un gesto del usuario: crea el contexto (una sola vez) y lo reanuda.
  function unlock() {
    if (disposed) return;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
      startAmbient();
    }
    if (ctx.state === 'suspended') ctx.resume().then(function () { if (!started) { started = true; if (ambientOn && birdLevel > 0) birdCall(); } });
    else if (!started) { started = true; if (ambientOn && birdLevel > 0) birdCall(); }
  }
  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v)); applyGain();
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch (e) {}
  }
  function setAmbientOn(on) {
    ambientOn = !!on;
    if (ambientBus) fade(ambientBus.gain, ambientOn ? 1 : 0, 0.3);
    if (ctx && ambientOn && birdLevel > 0 && ctx.state === 'running') birdCall(); // avisa que el ambiente volvió
    try { localStorage.setItem(AMBIENT_KEY, ambientOn ? 'on' : 'off'); } catch (e) {}
  }
  function onVisibility() { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    unlock: unlock,
    getVolume: function () { return volume; },
    setVolume: setVolume,
    isAmbientOn: function () { return ambientOn; },
    setAmbientOn: setAmbientOn,
    setAmbient: setAmbient,
    rollDice: rollDice,
    land: land,
    dispose: function () {
      disposed = true; clearTimeout(birdTimer); clearTimeout(cricketTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (ctx) ctx.close();
    }
  };
}
