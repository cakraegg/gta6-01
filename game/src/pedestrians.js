// VENTARA BAY — pedestrians: sidewalk walkers who flee gunfire and police.
// They make the streets feel inhabited instead of empty.

import * as THREE from 'three';
import { mulberry32 } from './city.js';

const SHIRT_COLORS = [0xe84c4c, 0x4c8ae8, 0xe8c53c, 0x4ce88a, 0xe84cd9, 0x8a4ce8, 0xf2f2f2, 0x2e2e38];

function makePedestrian(scene, x, z, rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)], roughness: 0.9,
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a06c, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8), shirt);
  body.position.y = 1.0; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.7; head.castShadow = true; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), pants);
  legL.position.set(-0.12, 0.3, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.12; g.add(legR);
  g.position.set(x, 0, z);
  scene.add(g);
  return { group: g, legL, legR, x, z, heading: rng() * Math.PI * 2, speed: 1.1 + rng() * 0.7, flee: 0, walkPhase: rng() * 6 };
}

export function createPedestrians(scene, city, count) {
  const rng = mulberry32(9001);
  const peds = { list: [], rng, update };
  for (let i = 0; i < count; i++) {
    const bx = -210 + Math.floor(rng() * 8) * 60;
    const bz = -210 + Math.floor(rng() * 8) * 60;
    const x = bx + (rng() - 0.5) * 40;
    const z = bz + (rng() - 0.5) * 40;
    peds.list.push(makePedestrian(scene, x, z, rng));
  }

  function update(dt, G) {
    const px = G.player.x, pz = G.player.z;
    const shotsFired = G.combat && G.combat.shotsAt > 0 && (G.time - G.combat.shotsAt) < 2;
    for (const p of peds.list) {
      // flee from the player when wanted is high or shots were just fired
      const dPlayer = Math.hypot(p.x - px, p.z - pz);
      if ((G.police.wanted >= 3 && dPlayer < 14) || (shotsFired && dPlayer < 22)) p.flee = 2.5;
      let tx = p.x + Math.sin(p.heading) * 2;
      let tz = p.z + Math.cos(p.heading) * 2;
      if (p.flee > 0) {
        p.flee -= dt;
        tx = p.x + (p.x - px); tz = p.z + (p.z - pz);
        p.speed = 3.4;
      } else {
        p.speed = 1.2;
      }
      const want = Math.atan2(tx - p.x, tz - p.z);
      let diff = want - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      // stay inside the world and out of the water
      if (p.x > 256) { p.x = 256; p.heading = Math.PI - p.heading; }
      if (p.x < -298) { p.x = -298; p.heading = Math.PI - p.heading; }
      if (p.z > 298) { p.z = 298; p.heading = -p.heading; }
      if (p.z < -298) { p.z = -298; p.heading = -p.heading; }
      // turn around at random corners (seeded, deterministic)
      if (Math.abs(p.x % 60) < 1.5 || Math.abs(p.z % 60) < 1.5) {
        if (peds.rng() < 0.002) p.heading += Math.PI / 2;
      }
      p.walkPhase += dt * p.speed * 3;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.heading;
      p.legL.rotation.x = Math.sin(p.walkPhase) * 0.5;
      p.legR.rotation.x = -Math.sin(p.walkPhase) * 0.5;
    }
  }
  return peds;
}
