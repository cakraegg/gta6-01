// VENTARA BAY — the player on foot: Jax Corso, getaway driver.
// Third-person WASD movement with a drag-orbit camera, and E to steal and
// drive any nearby car (or step out of the one being driven).

import * as THREE from 'three';
import { carDistance } from './vehicles.js';
import { collideCircle } from './city.js';

function makeJax(scene) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x27324a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a06c, roughness: 0.8 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 8), jacket);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.y = 1.78; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: 0xe87a3c, roughness: 0.8 }));
  cap.position.y = 1.95; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), jeans);
  legL.position.set(-0.13, 0.31, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.13), jacket);
  armL.position.set(-0.42, 1.15, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  scene.add(g);
  return { group: g, legL, legR, armL, armR };
}

export function createPlayer(scene, city) {
  const mesh = makeJax(scene);
  const [sx, sz] = city.spawnPlayer;
  const player = {
    mesh, x: sx, z: sz, heading: 0,
    speed: 0, onFoot: true, car: null,
    health: 100, cash: 250, wanted: 0,
    camYaw: Math.PI, camPitch: 0.3, camDist: 10,
    walkPhase: 0, punching: 0, busted: 0,
  };
  mesh.group.position.set(sx, 0, sz);
  return player;
}

// Find the nearest stealable car (parked, or an NPC's) within reach.
export function nearestStealableCar(G, maxDist) {
  let best = null, bd = maxDist;
  const cars = [...G.parked, ...G.traffic.list.map((t) => t.car)];
  for (const car of cars) {
    if (car.driver === 'police') continue;
    const d = Math.hypot(car.x - G.player.x, car.z - G.player.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function updatePlayer(dt, G) {
  const p = G.player;
  const input = G.input;
  if (p.onFoot) {
    // camera-relative WASD movement
    const fwd = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const sprint = input.sprint ? 1.7 : 1;
    const moveSpeed = 5.2 * sprint;
    const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
    // camera looks from behind the player toward -yaw, so forward is (-sin, -cos)
    const mx = (-sin) * fwd + (-cos) * strafe;
    const mz = (-cos) * fwd + sin * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      const nx = p.x + (mx / len) * moveSpeed * dt;
      const nz = p.z + (mz / len) * moveSpeed * dt;
      const fixed = collideCircle(G.city, nx, nz, 0.6);
      p.x = fixed.x; p.z = fixed.z;
      p.heading = Math.atan2(mx, mz);
      p.speed = moveSpeed;
      p.walkPhase += dt * moveSpeed * 2.2;
    } else {
      p.speed = 0;
    }
    p.mesh.group.position.set(p.x, 0, p.z);
    p.mesh.group.rotation.y = p.heading;
    const swing = p.speed > 0.1 ? Math.sin(p.walkPhase) * 0.45 : 0;
    p.mesh.legL.rotation.x = swing;
    p.mesh.legR.rotation.x = -swing;
    p.mesh.armL.rotation.x = -swing * 0.7;
    p.mesh.armR.rotation.x = swing * 0.7;
    if (p.punching > 0) {
      p.punching -= dt;
      p.mesh.armR.rotation.x = -1.6 * Math.max(0, p.punching / 0.25);
    }
  } else if (p.car) {
    // driving: position follows the car; the mesh hides inside it
    p.x = p.car.x; p.z = p.car.z;
    p.heading = p.car.heading;
    p.mesh.group.position.set(p.x, -2, p.z);
  }
  updateCamera(dt, G);
}

function updateCamera(dt, G) {
  const p = G.player;
  const cam = G.camera;
  // orbit target: the player (or the car)
  const tx = p.x, tz = p.z;
  const ty = p.onFoot ? 1.6 : 1.4;
  const dist = p.onFoot ? p.camDist : p.camDist + 3;
  const pitch = p.camPitch;
  const cx = tx + Math.sin(p.camYaw) * Math.cos(pitch) * dist;
  const cz = tz + Math.cos(p.camYaw) * Math.cos(pitch) * dist;
  const cy = ty + Math.sin(pitch) * dist;
  cam.position.set(cx, cy, cz);
  cam.lookAt(tx, ty, tz);
  // sun shadow follows the player so shadows stay crisp
  if (G.city.sun) {
    G.city.sun.position.set(p.x - 180, 90, p.z + 120);
    G.city.sun.target.position.set(p.x, 0, p.z);
    G.city.sun.target.updateMatrixWorld();
  }
}

// E: step into the nearest stealable car, or step out of the driven one.
export function toggleCar(G) {
  const p = G.player;
  if (!p.onFoot && p.car) {
    const car = p.car;
    car.driver = null;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.4;
    p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.4;
    p.mesh.group.position.set(p.x, 0, p.z);
    G.hud.toast('Stepped out of the car');
    return true;
  }
  if (p.onFoot) {
    const car = nearestStealableCar(G, 4.5);
    if (car) {
      car.driver = 'player';
      // stealing a car with a driver inside raises the heat a little
      if (car._hadDriver) G.police.addWanted(1);
      p.car = car;
      p.onFoot = false;
      // remove it from the parked list so it is not stolen twice
      const pi = G.parked.indexOf(car);
      if (pi >= 0) G.parked.splice(pi, 1);
      G.hud.toast('Car jacked — drive, Jax!');
      G.audio.chime();
      return true;
    }
    G.hud.toast('No car close enough — walk to one and press E');
    return false;
  }
  return false;
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.health <= 0) return;
  p.health = Math.max(0, p.health - amount);
  G.hud.damageFlash();
  if (p.health <= 0) {
    G.mode = 'wasted';
    G.hud.showEnd('WASTED', 'Jax got taken down. The bay keeps its secrets.');
  }
}
