// VENTARA BAY — deterministic screenshot states. ?shot=cover|marina|highway|heist
// v2: every shot is staged in bright late-afternoon daylight, the police sit
// close to the lens, and traffic plus pedestrians are placed in the frame so
// the city reads alive instead of empty. The page sets window.__shotReady
// when the fixed simulation steps are done.

import * as THREE from 'three';

export const SHOT_STEPS = 240; // 4 seconds of fixed-step sim before the shot

// Swap the dusk scene for a bright late-afternoon day: blue sky, pale haze,
// a warm high sun. Only the staged shots use this — the live game keeps its
// dusk look. The shadow camera is re-aimed at the shot (fx, fz) so shadows
// land where the frame is instead of around the world origin.
function setDaylight(G, fx, fz) {
  const scene = G.scene;
  scene.background = new THREE.Color(0x8ec8ee);
  scene.fog = new THREE.Fog(0x9fd0ea, 200, 900);
  const hemi = G.city.hemi;
  if (hemi) {
    hemi.color.setHex(0xcfe8ff);
    hemi.groundColor.setHex(0x9a8a6a);
    hemi.intensity = 1.5;
  }
  const sun = G.city.sun;
  sun.color.setHex(0xffeec4);
  sun.intensity = 2.4;
  sun.position.set(140, 170, 90);
  sun.target.position.set(fx, 0, fz);
  sun.target.updateMatrixWorld();
  // Lift the materials that read as black slabs in daylight: tower walls
  // (box + window map) get a brighter tint, and very dark plain materials
  // (sidewalk slabs, lamp posts, navy uniforms) are doubled. Runtime-only
  // staging — the live dusk game is untouched. A Set keeps shared materials
  // (one sidewalk material for every slab) from compounding.
  const lifted = new Set();
  scene.traverse((m) => {
    if (!m.isMesh || !m.material || !m.material.isMeshStandardMaterial) return;
    if (lifted.has(m.material)) return;
    const c = m.material.color;
    const isTower = m.geometry && m.geometry.type === 'BoxGeometry' && !!m.material.map;
    if (isTower) {
      lifted.add(m.material);
      c.multiplyScalar(1.5);
    } else if (Math.max(c.r, c.g, c.b) < 0.38) {
      lifted.add(m.material);
      c.multiplyScalar(2.0);
    }
  });
}

// Drop one traffic car on a fixed road spot with a short two-point loop
// along that road, so it stays in the neighbourhood for the whole shot
// instead of wandering off across the city.
function stageTraffic(G, i, x, z, heading, ax, az, bx, bz) {
  const t = G.traffic.list[i];
  if (!t) return;
  t.car.x = x; t.car.z = z; t.car.heading = heading;
  t.car.group.position.set(x, 0, z);
  t.car.group.rotation.y = heading;
  t.loop = [[ax, az], [bx, bz]];
  t.wp = 0;
  t.speed = 8;
  t.paused = 0;
}

// Drop one pedestrian on a fixed sidewalk spot, facing into the frame.
function stagePed(G, i, x, z, heading) {
  const p = G.peds.list[i];
  if (!p) return;
  p.x = x; p.z = z; p.heading = heading;
  p.flee = 0;
  p.group.position.set(x, 0, z);
  p.group.rotation.y = heading;
}

// Spawn a police car at (x, z) already facing `heading` at `speed`, so a
// staged chase does not waste the shot turning around and accelerating.
function aimPolice(G, x, z, heading, speed) {
  G.police.spawnCar(x, z);
  const c = G.police.cars[G.police.cars.length - 1].car;
  c.heading = heading; c.speed = speed;
  c.group.rotation.y = heading;
}

// Recolour the biggest box mesh of a car (its body) so the player's car
// reads on the road. Clones the material so other cars keep theirs.
function paintBody(car, color) {
  if (!car || !car.group) return;
  let best = null, bestVol = 0;
  car.group.traverse((m) => {
    if (!m.isMesh || !m.geometry || !m.geometry.parameters) return;
    const v = m.geometry.parameters;
    if (v.width === undefined || v.height === undefined || v.depth === undefined) return;
    const vol = v.width * v.height * v.depth;
    if (vol > bestVol) { bestVol = vol; best = m; }
  });
  if (best) {
    best.material = best.material.clone();
    best.material.color.setHex(color);
  }
}

// Put Jax in the nearest parked car at a fixed spot, facing a heading.
function placeInCar(G, x, z, heading) {
  const p = G.player;
  // reuse the closest parked car, teleported to the shot's start line
  let car = G.parked[0];
  if (!car) return;
  car.x = x; car.z = z; car.heading = heading; car.speed = 0;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = heading;
  car.driver = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = x; p.z = z; p.heading = heading;
  const pi = G.parked.indexOf(car);
  if (pi >= 0) G.parked.splice(pi, 1);
}

export function setupShot(G, name) {
  const p = G.player;
  // start from a clean slate: no police, no wanted, mission 1 briefing
  G.police.setWanted(0);
  G.police.units = [];
  G.police.cars = [];
  G.input.up = false; G.input.down = false;
  G.input.left = false; G.input.right = false;

  if (name === 'cover') {
    // daylight chase down the Neon Strip: Jax driving north in the orange
    // getaway car, two cruisers tucked in close behind him on both flanks,
    // wanted 3 stars, mission 5 live. The cruisers start 9 and 13 metres
    // back and close only ~1 m/s on the tuned car, so they end the shot
    // big in frame without ever reaching ramming range.
    setDaylight(G, 0, 110);
    placeInCar(G, 0, 150, Math.PI);
    p.car.maxSpeed = 26; p.car.speed = 22; // tuned getaway car: outruns the cruisers' target just enough
    G.police.setWanted(3);
    G.missions.start(G, 4);
    paintBody(p.car, 0xff5a2a); // bright orange getaway car, readable on sunlit asphalt
    aimPolice(G, 5, p.z + 9, Math.PI, 23);
    aimPolice(G, -6, p.z + 13, Math.PI, 23);
    // cross traffic on the roads the chase runs through, walkers on the
    // sidewalks the camera looks down
    stageTraffic(G, 0, -24, 120, Math.PI / 2, 6, 120, -54, 120);
    stageTraffic(G, 1, 24, 90, -Math.PI / 2, -6, 90, 54, 90);
    stagePed(G, 0, 10, 68, -Math.PI / 2);
    stagePed(G, 1, -11, 62, Math.PI / 2);
    // camera closer and lower than v1, ahead of the car looking back at the chase
    p.camYaw = p.heading;
    p.camPitch = 0.24; p.camDist = 8;
    G.input.up = true;
    G.hud.setObjective('Hold the ring to crack the van', 42);
  } else if (name === 'marina') {
    // daylight on the Marina: Jax on foot facing the pickup beacon, the bay
    // and the boats over his shoulder, traffic rolling along the road the
    // camera stands on, walkers on the strip in front of him
    setDaylight(G, 210, -170);
    p.onFoot = true; p.car = null;
    p.x = 210; p.z = -170; p.heading = Math.PI; // face the beacon, south
    p.mesh.group.position.set(p.x, 0, p.z);
    G.missions.start(G, 0);
    // traffic rolls south on the two north-south roads either side of the
    // Marina strip, so it stays in the frame's depth instead of sliding
    // sideways out of it along the camera's own road
    stageTraffic(G, 0, 180, -170, 0, 180, -140, 180, -200);
    stageTraffic(G, 1, 240, -170, 0, 240, -140, 240, -200);
    stagePed(G, 0, 196, -168, Math.PI / 2);
    stagePed(G, 1, 224, -166, -Math.PI / 2);
    stagePed(G, 2, 204, -168, Math.PI);
    p.camYaw = Math.PI; p.camPitch = 0.3; p.camDist = 9; // camera north on road z=-180, looking south
    G.hud.setObjective('Reach the Marina pickup', 20);
  } else if (name === 'highway') {
    // daylight run down the Coastal Highway: Jax driving fast along the
    // beach road, the bay on his left, a car cruising ahead of him and one
    // coming the other way, a walker on the beach sidewalk
    setDaylight(G, 240, 70);
    placeInCar(G, 240, 120, Math.PI);
    G.missions.start(G, 5);
    G.police.setWanted(0); // clean daylight drive for this shot (the getaway's heat comes later)
    paintBody(p.car, 0xff5a2a);
    stageTraffic(G, 0, 236, 20, Math.PI, 236, -10, 236, 50);
    stageTraffic(G, 1, 244, -20, 0, 244, 10, 244, -50);
    stagePed(G, 0, 250, 20, Math.PI);
    p.camYaw = p.heading + Math.PI - 0.35; // tilt the view east so the sun sits at the frame's right edge
    p.camPitch = 0.24; p.camDist = 10;
    G.input.up = true;
    G.hud.setObjective('Reach the end of the Coastal Highway', 380);
  } else if (name === 'heist') {
    // the small heist, re-staged in daylight: Jax in the orange getaway car
    // at the van ring, wanted 3, two cruisers facing him from the north and
    // four officers closing the cordon around the car. The police AI is
    // frozen for this shot only — in v1 the cruisers chased through Jax and
    // were out of frame by the time the screenshot was taken, which is why
    // the heist read empty. The cruisers and the cordon stand inside the
    // open plaza (x 26-54, z 28-54) — v1 parked them at z 14-20, which is
    // inside the block's buildings, so they were hidden. Traffic rolls on
    // the north-south roads either side of the plaza and walkers stand on
    // it, so the frame is busy.
    setDaylight(G, 34, 35);
    placeInCar(G, 34, 38, 0); // face the ring, north
    G.police.setWanted(3);
    G.missions.start(G, 4);
    paintBody(p.car, 0xff5a2a);
    G.police.spawnCar(28, 30);
    G.police.spawnCar(46, 30);
    G.police.spawnUnit(30, 32);
    G.police.spawnUnit(44, 32);
    G.police.spawnUnit(30, 44);
    G.police.spawnUnit(40, 44);
    G.police.update = () => {}; // freeze the chase: staged units hold their marks for the shot
    stageTraffic(G, 0, 0, 20, Math.PI, 0, -10, 0, 50);
    stageTraffic(G, 1, 60, 40, Math.PI, 60, 10, 60, 70);
    stagePed(G, 0, 50, 50, Math.PI);
    stagePed(G, 1, 52, 32, -Math.PI / 2);
    stagePed(G, 2, 46, 46, Math.PI / 2);
    p.camYaw = 0; p.camPitch = 0.3; p.camDist = 10; // camera south on the slab, looking north
    G.hud.setObjective('Hold the ring to crack the van', 9);
  } else {
    // unknown shot name: plain menu-free view of the Strip
    setDaylight(G, 0, 0);
    p.onFoot = true; p.car = null;
    p.x = 0; p.z = -6; p.heading = 0;
    p.mesh.group.position.set(p.x, 0, p.z);
    G.missions.start(G, 0);
    p.camYaw = Math.PI; p.camPitch = 0.3; p.camDist = 9;
  }
  G.hud.setMission(G.missions.defs[G.missions.current].title);
  G.hud.setHealth(p.health);
  G.hud.setCash(p.cash);
  G.hud.setWanted(G.police.wanted);
  return SHOT_STEPS;
}
