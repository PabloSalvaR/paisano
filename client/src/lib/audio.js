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
  var ctx = null, master = null, ambientBus = null, cricketGain = null, birdLevel = 0, mode = 'day';
  var birdTimer = 0, disposed = false, noiseBuf = null;
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
    // grillos: portadora aguda, modulada por trinos rápidos y por un ritmo lento
    var car = ctx.createOscillator(); car.frequency.value = 4300;
    var trill = ctx.createGain(); trill.gain.value = 0;
    var trillLfo = ctx.createOscillator(), trillLfoG = ctx.createGain();
    trillLfo.frequency.value = 26; trillLfoG.gain.value = 0.5; trill.gain.value = 0.5;
    trillLfo.connect(trillLfoG); trillLfoG.connect(trill.gain);
    var gate = ctx.createGain(); gate.gain.value = 0.5;
    var gateLfo = ctx.createOscillator(), gateLfoG = ctx.createGain();
    gateLfo.frequency.value = 2.2; gateLfoG.gain.value = 0.5; gateLfo.connect(gateLfoG); gateLfoG.connect(gate.gain);
    cricketGain = ctx.createGain(); cricketGain.gain.value = 0;
    car.connect(trill); trill.connect(gate); gate.connect(cricketGain); cricketGain.connect(ambientBus);
    car.start(); trillLfo.start(); gateLfo.start();

    setAmbient(mode, true);
    scheduleBirds();
  }
  function setAmbient(m, instant) {
    mode = AMBIENT[m] ? m : 'day';
    if (!ctx || !cricketGain) return;
    var a = AMBIENT[mode], tc = instant ? 0.01 : 1.2;
    fade(cricketGain.gain, 0.024 * a.crickets, tc);
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
    dispose: function () {
      disposed = true; clearTimeout(birdTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (ctx) ctx.close();
    }
  };
}
