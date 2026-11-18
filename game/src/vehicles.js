// VENTARA BAY — vehicles: box-built car models and arcade driving physics.
// One car factory for the player, traffic and police; the same model reads
// as a car at a glance in a shrunk screenshot.

import * as THREE from 'three';

const CAR_COLORS = [0xd93c3c, 0x3c7ad9, 0xe8c53c, 0x3cd98a, 0xd9d9d9, 0x2e2e38, 0xe87a3c, 0x8a3cd9];

export function pickCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}

// Build one car from boxes: body, cabin, wheels, lights. Returns the car record.
export function makeCar(scene, opts = {}) {
  const color = opts.color ?? 0xd93c3c;
  const police = !!opts.police;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.25, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.1, metalness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.1, -0.25); cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w); wheels.push(w);
  }
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const hx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), headMat);
    h.position.set(hx, 0.62, 2.22); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat);
    t.position.set(hx, 0.62, -2.22); g.add(t);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    bar.position.set(0, 1.45, -0.25); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 1.46, -0.25); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.28, 1.46, -0.25); g.add(blue);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  g.position.set(opts.x ?? 0, 0, opts.z ?? 0);
  g.rotation.y = opts.heading ?? 0;
  scene.add(g);
  return {
    group: g, wheels, police, color,
    x: opts.x ?? 0, z: opts.z ?? 0, heading: opts.heading ?? 0,
    speed: 0, steer: 0, driver: opts.driver ?? null,
    maxSpeed: police ? 26 : 22, accel: 14, brake: 30,
    smoke: 0, health: 100,
  };
}

// Arcade driving for the player car: W/S accelerate and brake, A/D steer,
// Space handbrakes into a skid. Returns the speed in m/s.
export function driveCar(car, input, dt, city, collide) {
  const forward = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const handbrake = !!input.handbrake;
  if (forward > 0) car.speed += car.accel * dt;
  else if (forward < 0) car.speed -= (car.speed > 0.5 ? car.brake : car.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = Math.max(-9, Math.min(car.maxSpeed, car.speed));
  const grip = handbrake ? 0.35 : 1;
  const steerTarget = steerIn * 0.55 * grip * Math.min(1, Math.abs(car.speed) / 6);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * (car.speed / 4.4) * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collide(city, nx, nz, 1.6);
  // a collision scrubs speed (a wall stop, not a slide-through)
  if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) car.speed *= 0.4;
  car.x = fixed.x; car.z = fixed.z;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt / 0.38;
  for (const w of car.wheels) w.rotation.x += spin;
  if (car.wheels[0]) car.wheels[0].rotation.y = car.steer * 0.5;
  if (car.wheels[1]) car.wheels[1].rotation.y = car.steer * 0.5;
  if (handbrake && Math.abs(car.speed) > 8) car.smoke = 1;
  return car.speed;
}

// Steer a car toward a target point at a capped speed (police + traffic).
export function steerCarToward(car, tx, tz, speed, dt, city, collide) {
  const dx = tx - car.x, dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.5) return dist;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
  car.speed += (speed - car.speed) * Math.min(1, dt * 1.5);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collide(city, nx, nz, 1.6);
  if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) car.speed *= 0.5;
  car.x = fixed.x; car.z = fixed.z;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt / 0.38;
  for (const w of car.wheels) w.rotation.x += spin;
  return dist;
}

export function carDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
