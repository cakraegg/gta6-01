// VENTARA BAY — boot and the one loop: input every frame, the world in
// fixed 1/60 s steps, and the renderer painting what is there. Screens:
// menu, playing, paused, busted / wasted. ?shot=name stages one fixed
// scene instead of the menu and sets window.__shotReady for a screenshot.

import * as THREE from 'three';
import { createCity, collideCircle, districtAt, mulberry32 } from './city.js';
import { createPlayer, updatePlayer, toggleCar } from './player.js';
import { createTraffic, createParkedCars } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave, applySave } from './save.js';
import { setupShot } from './shots.js';
import { driveCar } from './vehicles.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

// --- renderer / scene / camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // r187 removed PCFSoftShadowMap
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 12, 20);

// --- the shared game state every module reads ---
const G = {
  scene, camera, renderer,
  time: 0, mode: 'menu',
  input: { up: false, down: false, left: false, right: false, sprint: false, handbrake: false },
  collide: (city, x, z, r) => collideCircle(city, x, z, r),
  shotMode: shotName, shotStepsLeft: 0, shotDone: false,
};
window.__game = G;

G.city = createCity(scene);
G.player = createPlayer(scene, G.city);
G.rng = mulberry32(seed);
G.parked = createParkedCars(scene, G.city, G.rng);
G.traffic = createTraffic(scene, G.city, 16);
G.peds = createPedestrians(scene, G.city, 26);
G.police = createPolice(scene, G.city);
G.combat = createCombat(scene, camera);
G.missions = createMissions(scene);
G.hud = createHud();
G.minimap = createMinimap(document.getElementById('minimap'), G.city);
G.audio = createAudio();
G.save = { saveGame, loadGame, hasSave, applySave };

const hudEl = document.getElementById('hud');

// --- input: keyboard, mouse drag camera, wheel zoom, click to fight ---
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'handbrake',
};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = KEYMAP[e.code];
  if (k) { G.input[k] = true; if (e.code === 'Space') e.preventDefault(); }
  if (e.code === 'KeyE' && G.mode === 'playing') toggleCar(G);
  if (e.code === 'Digit1' && G.mode === 'playing') { G.combat.weapon = 'fists'; G.hud.toast('Fists'); }
  if (e.code === 'Digit2' && G.mode === 'playing') { G.combat.weapon = 'pistol'; G.hud.toast('Pistol out'); }
  if (e.code === 'KeyR' && G.mode === 'playing') G.combat.reload(G);
  if (e.code === 'KeyM') { G.audio.setMuted(!G.audio.muted); G.hud.toast(G.audio.muted ? 'Muted' : 'Sound on'); }
  if ((e.code === 'KeyP' || e.code === 'Escape') && (G.mode === 'playing' || G.mode === 'paused')) togglePause();
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) G.input[k] = false;
});
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  if (G.mode === 'playing') {
    if (G.combat.weapon === 'pistol') G.combat.shoot(G);
    else G.combat.punch(G);
  }
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  G.player.camYaw -= (e.clientX - lastX) * 0.005;
  G.player.camPitch = Math.max(0.08, Math.min(0.9, G.player.camPitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  G.player.camDist = Math.max(6, Math.min(16, G.player.camDist + Math.sign(e.deltaY)));
}, { passive: false });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- screens and flow ---
function showHud(on) { hudEl.classList.toggle('hidden', !on); }
function newGame() {
  G.player.health = 100; G.player.cash = 250;
  G.player.x = G.city.spawnPlayer[0]; G.player.z = G.city.spawnPlayer[1];
  G.player.onFoot = true; G.player.car = null;
  G.player.mesh.group.position.set(G.player.x, 0, G.player.z);
  G.police.setWanted(0);
  G.missions.start(G, 0);
  G.hud.hideMenu();
  document.getElementById('end-screen').classList.remove('show');
  showHud(true);
  G.mode = 'playing';
  G.audio.ensure(); G.audio.startMusic();
  G.hud.banner('VENTARA BAY', 'Mission 1 — The Pickup. Lena is waiting.');
  G.hud.toast('Reach the blue beacon in the Marina District.');
}
function continueGame() {
  const data = loadGame();
  if (!data) { newGame(); return; }
  applySave(G, data);
  G.hud.hideMenu();
  document.getElementById('end-screen').classList.remove('show');
  showHud(true);
  G.mode = 'playing';
  G.audio.ensure(); G.audio.startMusic();
  G.hud.toast('Welcome back, Jax. Mission ' + (G.missions.current + 1) + ' is live.');
}
function togglePause() {
  if (G.mode === 'playing') {
    G.mode = 'paused';
    G.hud.showPause();
  } else if (G.mode === 'paused') {
    G.mode = 'playing';
    G.hud.hidePause();
  }
}
function backToMenu() {
  saveGame(G);
  G.mode = 'menu';
  G.hud.hidePause();
  document.getElementById('end-screen').classList.remove('show');
  showHud(false);
  G.hud.showMenu(hasSave());
}
function retry() {
  G.player.health = 100;
  G.police.setWanted(0);
  G.player.x = G.city.spawnPlayer[0]; G.player.z = G.city.spawnPlayer[1];
  G.player.onFoot = true; G.player.car = null;
  G.player.mesh.group.position.set(G.player.x, 0, G.player.z);
  document.getElementById('end-screen').classList.remove('show');
  showHud(true);
  G.mode = 'playing';
}

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-save-quit').addEventListener('click', backToMenu);
document.getElementById('btn-restart').addEventListener('click', () => {
  G.missions.start(G, G.missions.current);
  G.player.health = 100;
  G.hud.hidePause();
  G.mode = 'playing';
});
document.getElementById('btn-retry').addEventListener('click', retry);
document.getElementById('btn-menu').addEventListener('click', backToMenu);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'playing') togglePause();
});

// --- objective text for the HUD ---
function currentObjective() {
  const m = G.missions;
  if (m.state === 'done') return { text: 'Mission complete — next job incoming…', dist: null };
  if (m.state !== 'active') return { text: 'Talk to Lena Voss', dist: null };
  const def = m.defs[m.current];
  const s = def.steps[m.step];
  if (!s) return { text: def.title, dist: null };
  if (s.type === 'chase' && m.courier) {
    return { text: s.text, dist: Math.hypot(m.courier.car.x - G.player.x, m.courier.car.z - G.player.z) };
  }
  if (s.type === 'escape') return { text: s.text + ' — wanted ' + G.police.wanted + '★', dist: null };
  if (s.x != null) return { text: s.text, dist: Math.hypot(s.x - G.player.x, s.z - G.player.z) };
  return { text: s.text, dist: null };
}

// --- one fixed simulation step ---
function step(dt) {
  G.time += dt;
  if (G.mode !== 'playing') return;
  if (!G.player.onFoot && G.player.car) {
    driveCar(G.player.car, G.input, dt, G.city, G.collide);
  }
  updatePlayer(dt, G);
  G.traffic.update(dt, G);
  G.peds.update(dt, G);
  G.police.update(dt, G);
  G.combat.update(dt, G);
  G.missions.update(dt, G);
  G.audio.update(dt, G);
  // water shimmer
  if (G.city.water) G.city.water.position.y = 0.4 + Math.sin(G.time * 0.8) * 0.08;
}

// --- HUD refresh (throttled) ---
let hudTick = 0;
function refreshHud() {
  hudTick += 1;
  const p = G.player;
  G.hud.setHealth(p.health);
  G.hud.setCash(p.cash);
  G.hud.setWanted(G.police.wanted);
  const obj = currentObjective();
  G.hud.setObjective(obj.text, obj.dist);
  G.hud.setMission(G.missions.defs[G.missions.current].title);
  G.hud.setSpeed(!p.onFoot && p.car ? Math.abs(p.car.speed) * 3.6 : 0);
  G.hud.setClock(18 * 60 + G.time / 60);
  G.hud.setDistrict(districtAt(p.x, p.z));
  G.hud.setAmmo(G.combat.weapon, G.combat.ammo, G.combat.reserve);
  document.getElementById('crosshair').classList.toggle('on', G.combat.weapon === 'pistol' && G.mode === 'playing');
  if (hudTick % 3 === 0) G.minimap.draw(G);
}

// --- main loop ---
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (G.shotMode && !G.shotDone) {
    // deterministic shot: run exactly the staged steps, then freeze
    let n = 0;
    while (accumulator >= STEP && G.shotStepsLeft > 0) {
      step(STEP);
      accumulator -= STEP;
      G.shotStepsLeft -= 1;
      n += 1;
      if (n > 400) break;
    }
    refreshHud();
    renderer.render(scene, camera);
    if (G.shotStepsLeft <= 0) {
      G.shotDone = true;
      window.__shotReady = true;
    }
    return;
  }
  if (G.mode === 'menu') {
    // attract mode: slow orbit over the Neon Strip
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.05) * 160, 90, Math.cos(t * 0.05) * 160);
    camera.lookAt(0, 10, 0);
    if (G.city.water) G.city.water.position.y = 0.4 + Math.sin(t * 0.8) * 0.08;
    renderer.render(scene, camera);
    return;
  }
  while (accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
    if (G.mode !== 'playing') break;
  }
  if (G.mode === 'playing' || G.mode === 'paused' || G.mode === 'busted' || G.mode === 'wasted') {
    refreshHud();
  }
  renderer.render(scene, camera);
}

// --- start ---
if (shotName) {
  G.mode = 'playing';
  G.hud.hideMenu();
  showHud(true);
  G.shotStepsLeft = setupShot(G, shotName);
  requestAnimationFrame(frame);
} else {
  G.hud.showMenu(hasSave());
  requestAnimationFrame(frame);
}
