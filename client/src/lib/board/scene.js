// Renderer, escena y cámara: los controles para orbitar, la vuelta a la vista por defecto, el giro de fin de partida, el
// mapa de entorno (reflejos suaves) y el tamaño según la pantalla.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { col } from './util.js';

export function createScene(stage) {
  // ------------------------------------------------------------------ renderer / escena
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.insertBefore(renderer.domElement, stage.firstChild);

  var scene = new THREE.Scene();
  scene.background = col(0xb9c9cf);
  scene.fog = new THREE.Fog(col(0xb9c9cf), 24, 70);

  var camera = new THREE.PerspectiveCamera(35, 1, 0.5, 200);
  // Arranca con el tablero bien encuadrado y una inclinación de ~30° respecto de la vertical (a distancia ~17) para que
  // se note el 3D antes de mover nada. El norte del tablero queda hacia arriba de la pantalla.
  camera.position.set(0, 14.9, 8.5);

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 30;
  controls.minPolarAngle = 0; // permite volver a la vista cenital; se puede inclinar hasta maxPolarAngle
  controls.maxPolarAngle = 1.3;
  // vista por defecto (botón "Centrar"): vuelve con una transición suave; si el usuario toca la cámara se cancela
  var HOME_POS = camera.position.clone(), HOME_TARGET = controls.target.clone(), homing = false;
  controls.addEventListener('start', function () { homing = false; });
  // Fin de la partida: la cámara gira sola, muy despacio y cambiando de altura y de distancia. Si el usuario toca el tablero se
  // detiene y retoma a los pocos segundos. Con una partida nueva (o cualquier estado no terminado) vuelve a la vista de siempre.
  var orbit = { on: false, resumeAt: 0, t: 0 }, orbitSph = new THREE.Spherical(), orbitOff = new THREE.Vector3();
  function setOrbit(on) {
    if (orbit.on === on) return;
    orbit.on = on; orbit.t = 0; orbit.resumeAt = 0;
    homing = !on; // al cortarla, la cámara vuelve suavemente a la vista inicial
  }
  controls.addEventListener('start', function () { orbit.resumeAt = Infinity; });
  controls.addEventListener('end', function () { orbit.resumeAt = performance.now() + 6000; });

  // ------------------------------------------------------------------ mapa de entorno (reflejos suaves)
  try {
    var envScene = new THREE.Scene();
    var skyGeo = new THREE.SphereGeometry(50, 24, 16);
    var pos = skyGeo.attributes.position, colors = [];
    var cTop = col(0xcfe4ff), cMid = col(0xf5efe4), cBot = col(0x76674f), tmp = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 50;
      if (y > 0) tmp.copy(cMid).lerp(cTop, Math.pow(y, 0.6)); else tmp.copy(cMid).lerp(cBot, Math.min(1, -y * 1.6));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    var pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene).texture;
    pm.dispose();
  } catch (e) { console.warn('Sin mapa de entorno:', e.message); }

  // Un paso de la cámara por cuadro: vuelta suave a la vista por defecto, giro de fin de partida y amortiguación.
  function update(dt) {
    if (homing) {
      var k = 1 - Math.exp(-dt * 6);
      camera.position.lerp(HOME_POS, k); controls.target.lerp(HOME_TARGET, k);
      if (camera.position.distanceTo(HOME_POS) < 0.01) { camera.position.copy(HOME_POS); controls.target.copy(HOME_TARGET); homing = false; }
    }
    if (orbit.on && performance.now() >= orbit.resumeAt) {
      orbit.t += dt;
      orbitOff.copy(camera.position).sub(controls.target); orbitSph.setFromVector3(orbitOff);
      var ease = 1 - Math.exp(-dt * 0.8);
      orbitSph.theta += dt * 0.07;
      orbitSph.phi += (0.85 + 0.4 * Math.sin(orbit.t * 0.11) - orbitSph.phi) * ease;
      orbitSph.radius += (17 + 3 * Math.sin(orbit.t * 0.07 + 1) - orbitSph.radius) * ease;
      orbitOff.setFromSpherical(orbitSph); camera.position.copy(controls.target).add(orbitOff);
    }
    controls.update();
  }

  function resize() {
    var w = stage.clientWidth || 800, h = stage.clientHeight || 600, aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.fov = aspect < 0.75 ? 58 : aspect < 1.1 ? 46 : 35;
    // El banner de recursos tapa la parte baja: se corre la imagen hacia arriba para que el tablero quede
    // centrado en el espacio libre sobre el banner (el cliente sigue viendo el mismo tablero, solo desplazado).
    var hand = stage.querySelector('.hand'), shift = 0;
    if (hand) shift = Math.max(0, Math.round((h - (hand.getBoundingClientRect().top - stage.getBoundingClientRect().top)) / 2));
    camera.setViewOffset(w, h, 0, shift, w, h);
    camera.updateProjectionMatrix();
  }

  return {
    renderer: renderer, scene: scene, camera: camera, controls: controls, resize: resize,
    rig: { setOrbit: setOrbit, goHome: function () { homing = true; }, update: update }
  };
}
