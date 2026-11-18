// VENTARA BAY — traffic: cars that follow the road grid, plus parked cars
// the player can steal. Traffic keeps the city alive in every screenshot.

import { makeCar, steerCarToward, carDistance, pickCarColor } from './vehicles.js';
import { mulberry32 } from './city.js';

// One rectangular loop around a city block, as waypoints.
function blockLoop(cx, cz) {
  const h = 30;
  return [
    [cx - h, cz - h], [cx + h, cz - h],
    [cx + h, cz + h], [cx - h, cz + h],
  ];
}

export function createTraffic(scene, city, count) {
  const rng = mulberry32(4242);
  const traffic = { list: [], update };
  for (let i = 0; i < count; i++) {
    const bx = -210 + Math.floor(rng() * 8) * 60;
    const bz = -210 + Math.floor(rng() * 8) * 60;
    const loop = blockLoop(bx, bz);
    const start = loop[Math.floor(rng() * 4)];
    const car = makeCar(scene, {
      color: pickCarColor(rng),
      x: start[0], z: start[1],
      heading: rng() * Math.PI * 2,
    });
    car._hadDriver = true; // stealing one is a carjacking in front of witnesses
    traffic.list.push({
      car, loop, wp: 0,
      speed: 7 + rng() * 4,
      paused: 0,
    });
  }

  function update(dt, G) {
    for (const t of traffic.list) {
      if (t.paused > 0) { t.paused -= dt; continue; }
      const target = t.loop[t.wp];
      // brake for the car ahead on the same loop
      let ahead = null, best = 14;
      for (const o of traffic.list) {
        if (o === t) continue;
        const d = carDistance(t.car, o.car);
        if (d < best) { best = d; ahead = o; }
      }
      const playerCar = G.player.car;
      if (playerCar && carDistance(t.car, playerCar) < 12) {
        t.paused = 0.4; // let the player through
        continue;
      }
      const sp = ahead && best < 10 ? 0 : t.speed;
      const d = steerCarToward(t.car, target[0], target[1], sp, dt, G.city, G.collide);
      if (d < 3) t.wp = (t.wp + 1) % t.loop.length;
    }
  }
  return traffic;
}

// Parked cars along the roads: stealable (driver null). Returns the list.
export function createParkedCars(scene, city, rng) {
  const parked = [];
  for (const [x, z, heading] of city.spawnCars) {
    const car = makeCar(scene, {
      color: pickCarColor(rng),
      x, z, heading, driver: null,
    });
    parked.push(car);
  }
  return parked;
}
