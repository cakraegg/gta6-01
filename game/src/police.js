// VENTARA BAY — the law: a wanted level of 1 to 5 stars and the police
// who answer it. Cops chase on foot and by car, ram the player, and arrest
// Jax if they hold him still for two seconds.

import * as THREE from 'three';
import { makeCar, steerCarToward, carDistance } from './vehicles.js';
import { damagePlayer } from './player.js';
import { mulberry32 } from './city.js';

function makeOfficer(scene) {
  const g = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d2f55, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 8), navy);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.y = 1.78; g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.7 }));
  hat.position.y = 1.96; g.add(hat);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), navy);
  legL.position.set(-0.13, 0.31, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; g.add(legR);
  scene.add(g);
  return { group: g, legL, legR };
}

export function createPolice(scene, city) {
  const rng = mulberry32(5150);
  const police = {
    wanted: 0, units: [], cars: [],
    lastSeen: 0, arrestTimer: 0, quietTimer: 0,
    addWanted, setWanted, update, spawnCar, spawnUnit,
  };

  function addWanted(n) {
    police.wanted = Math.max(0, Math.min(5, police.wanted + n));
    police.quietTimer = 0;
  }
  function setWanted(n) {
    police.wanted = Math.max(0, Math.min(5, n));
    police.quietTimer = 0;
  }

  function spawnUnit(x, z) {
    const mesh = makeOfficer(scene);
    mesh.group.position.set(x, 0, z);
    police.units.push({ mesh, x, z, heading: 0, walkPhase: rng() * 6, health: 50 });
  }
  function spawnCar(x, z) {
    const car = makeCar(scene, { color: 0xf2f2f2, police: true, x, z, heading: 0, driver: 'police' });
    police.cars.push({ car, health: 80 });
  }
  function despawnAll() {
    for (const u of police.units) scene.remove(u.mesh.group);
    for (const c of police.cars) scene.remove(c.car.group);
    police.units = []; police.cars = [];
  }

  function update(dt, G) {
    const p = G.player;
    const wantUnits = police.wanted === 0 ? 0 : Math.min(2 + police.wanted, 7);
    const wantCars = police.wanted >= 2 ? Math.min(police.wanted - 1, 4) : 0;
    // spawn up to the wanted strength, near the player but off-screen
    while (police.units.length < wantUnits) {
      const a = rng() * Math.PI * 2;
      spawnUnit(p.x + Math.cos(a) * 55, p.z + Math.sin(a) * 55);
    }
    while (police.cars.length < wantCars) {
      const a = rng() * Math.PI * 2;
      spawnCar(p.x + Math.cos(a) * 70, p.z + Math.sin(a) * 70);
    }
    while (police.units.length > wantUnits) {
      const u = police.units.pop(); scene.remove(u.mesh.group);
    }
    while (police.cars.length > wantCars) {
      const c = police.cars.pop(); scene.remove(c.car.group);
    }
    if (police.wanted === 0) { police.arrestTimer = 0; return; }

    const anyNear = police.units.some((u) => Math.hypot(u.x - p.x, u.z - p.z) < 60)
      || police.cars.some((c) => carDistance(c.car, p) < 60);
    if (anyNear) { police.quietTimer = 0; police.lastSeen = G.time; }
    else {
      police.quietTimer += dt;
      if (police.quietTimer > 12) {
        police.wanted = Math.max(0, police.wanted - 1);
        police.quietTimer = 0;
        G.hud.toast(police.wanted === 0 ? 'You lost them. The heat is off.' : 'Heat dropping — wanted level ' + police.wanted);
      }
    }

    // foot officers run the player down
    let closest = 1e9;
    for (const u of police.units) {
      const d = Math.hypot(u.x - p.x, u.z - p.z);
      closest = Math.min(closest, d);
      const speed = p.onFoot ? 6.4 : 7.5;
      const want = Math.atan2(p.x - u.x, p.z - u.z);
      let diff = want - u.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
      u.x += Math.sin(u.heading) * speed * dt;
      u.z += Math.cos(u.heading) * speed * dt;
      u.walkPhase += dt * speed * 2.4;
      u.mesh.group.position.set(u.x, 0, u.z);
      u.mesh.group.rotation.y = u.heading;
      u.mesh.legL.rotation.x = Math.sin(u.walkPhase) * 0.5;
      u.mesh.legR.rotation.x = -Math.sin(u.walkPhase) * 0.5;
      // a punch-range officer on foot hurts Jax
      if (p.onFoot && d < 1.6) damagePlayer(G, 14 * dt);
    }
    // arrest: an officer holds Jax still for two seconds
    if (p.onFoot && closest < 2.2) {
      police.arrestTimer += dt;
      if (police.arrestTimer > 2) {
        G.mode = 'busted';
        G.hud.showEnd('BUSTED', 'The Ventara Bay PD finally caught up with Jax.');
        return;
      }
    } else {
      police.arrestTimer = 0;
    }

    // police cars chase and ram
    for (const c of police.cars) {
      const car = c.car;
      const d = steerCarToward(car, p.x, p.z, 24 + police.wanted, dt, G.city, G.collide);
      if (d < 3.4) {
        // ram: shove the player's car and hurt Jax
        if (!p.onFoot && p.car) {
          p.car.speed *= 0.6;
          damagePlayer(G, 8 * dt);
          G.audio.thud();
        } else if (p.onFoot) {
          damagePlayer(G, 20 * dt);
        }
      }
    }
  }
  return police;
}
