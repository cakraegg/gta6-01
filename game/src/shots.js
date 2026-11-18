// VENTARA BAY — deterministic screenshot states. ?shot=cover|marina|highway|heist
// locks the camera, the player, the police and the mission into one fixed
// scene, then runs a fixed number of simulation steps so the frame is
// alive but reproducible. The page sets window.__shotReady when done.

export const SHOT_STEPS = 240; // 4 seconds of fixed-step sim before the shot

export function setupShot(G, name) {
  const p = G.player;
  // start from a clean slate: no police, no wanted, mission 1 briefing
  G.police.setWanted(0);
  G.police.units = [];
  G.police.cars = [];
  G.input.up = false; G.input.down = false;
  G.input.left = false; G.input.right = false;

  if (name === 'cover') {
    // dusk downtown chase: Jax driving north on the Neon Strip avenue,
    // two police cars closing in, wanted 3 stars, mission 5 live
    placeInCar(G, 0, 150, Math.PI);
    p.car.maxSpeed = 26; p.car.speed = 22; // tuned getaway car: outruns the cruisers' 27 m/s target just enough
    G.police.setWanted(3);
    G.missions.start(G, 4);
    paintBody(p.car, 0xff5a2a); // bright orange getaway car, readable on dark asphalt
    // the chase, framed: two cruisers on the road's flanks behind the player,
    // pre-aimed north at near-top speed. They close only ~1 m/s on the tuned
    // car, so they stay in frame beside the avenue without reaching ramming
    // range inside the 4-second shot (a ram would stop the car and wreck it)
    aimPolice(G, 6, p.z + 15, Math.PI, 24);
    aimPolice(G, -6, p.z + 22, Math.PI, 24);
    // camera ahead of the car, looking back down the avenue at the chase
    p.camYaw = p.heading;
    p.camPitch = 0.26; p.camDist = 10;
    G.input.up = true;
    G.hud.setObjective('Hold the ring to crack the van', 42);
  } else if (name === 'marina') {
    // on foot in the Marina District, Jax facing the pickup beacon with the
    // beam behind him; player and camera stand in the open strip between
    // the Marina blocks (colliders verified: no building at x 190-214,
    // z -170..-198) so no wall blocks the view
    p.onFoot = true; p.car = null;
    p.x = 210; p.z = -170; p.heading = Math.PI; // face the beacon, south
    p.mesh.group.position.set(p.x, 0, p.z);
    G.missions.start(G, 0);
    p.camYaw = Math.PI; p.camPitch = 0.3; p.camDist = 9; // camera north on road z=-180, looking south
    G.hud.setObjective('Reach the Marina pickup', 20);
  } else if (name === 'highway') {
    // sunset run down the Coastal Highway, Jax driving fast, no heat
    placeInCar(G, 240, 120, Math.PI);
    G.missions.start(G, 5);
    G.police.setWanted(0); // clean sunset drive for this shot (the getaway's heat comes later)
    paintBody(p.car, 0xff5a2a);
    p.camYaw = p.heading + Math.PI - 0.35; // tilt the view east so the sun disc sits at the frame's right edge
    p.camPitch = 0.24; p.camDist = 10;
    G.input.up = true;
    G.hud.setObjective('Reach the end of the Coastal Highway', 380);
  } else if (name === 'heist') {
    // the small heist: Jax in the orange getaway car at the van ring, wanted
    // 4, cruisers closing in from the south. Car and camera stand in the
    // open corridor south of the ring (colliders verified: no building at
    // x 26-54, z 28-54), so the beacon and the ring read in frame.
    placeInCar(G, 34, 38, 0); // face the ring, north
    G.police.setWanted(4);
    G.missions.start(G, 4);
    paintBody(p.car, 0xff5a2a);
    // two cruisers coming down from the north toward Jax, in frame ahead
    G.police.spawnCar(22, 14);
    G.police.spawnCar(46, 20);
    p.camYaw = 0; p.camPitch = 0.3; p.camDist = 10; // camera south on the slab, looking north
    G.hud.setObjective('Hold the ring to crack the van', 9);
  } else {
    // unknown shot name: plain menu-free view of the Strip
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

// Spawn a police car at (x, z) already facing `heading` at `speed`, so a
// staged chase does not waste the shot turning around and accelerating.
function aimPolice(G, x, z, heading, speed) {
  G.police.spawnCar(x, z);
  const c = G.police.cars[G.police.cars.length - 1].car;
  c.heading = heading; c.speed = speed;
  c.group.rotation.y = heading;
}

// Recolour the biggest box mesh of a car (its body) so the player's car
// reads on dark asphalt. Clones the material so other cars keep theirs.
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
