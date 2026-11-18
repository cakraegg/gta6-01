// VENTARA BAY — city generation: roads, districts, buildings, props, collisions.
// Deterministic: every placement comes from a seeded RNG, so the same seed
// always builds the same city (screenshots and replays agree).

import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD = { min: -300, max: 300, beachX: 258, waterX: 284 };
export const ROADS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const ROAD_W = 12;

export const DISTRICTS = [
  { name: 'Marina District', color: 0x9fd8d2 },
  { name: 'Old Town', color: 0xe8b06b },
  { name: 'Neon Strip', color: 0xff2e88 },
  { name: 'Harbor Docks', color: 0xd97b4f },
  { name: 'Palm Heights', color: 0x7fc98a },
  { name: 'Coastal Highway', color: 0x7fb2e8 },
];

export function districtAt(x, z) {
  if (x > 216) return 'Coastal Highway';
  if (x > 150 && z < 0) return 'Marina District';
  if (x > 150 && z >= 0) return 'Harbor Docks';
  if (x < -120 && z < -60) return 'Palm Heights';
  if (x < -120 && z >= 60) return 'Old Town';
  if (Math.abs(x) <= 90 && Math.abs(z) <= 90) return 'Neon Strip';
  if (x < -60) return z < 0 ? 'Palm Heights' : 'Old Town';
  return z < 0 ? 'Marina District' : 'Harbor Docks';
}

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const px = (v) => ((v + 300) / 600) * 1024;
  g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, 1024, 1024);
  // road strips
  g.fillStyle = '#383d49';
  for (const r of ROADS) {
    g.fillRect(px(r - 6), 0, px(12) - px(0), 1024);
    g.fillRect(0, px(r - 6), 1024, px(12) - px(0));
  }
  // centre dashes (yellow) + edge lines (white)
  g.fillStyle = '#d8b13c';
  for (const r of ROADS) {
    for (let v = -300; v < 300; v += 24) {
      g.fillRect(px(r) - 1, px(v), 2, 10);
      g.fillRect(px(v), px(r) - 1, 10, 2);
    }
  }
  g.fillStyle = '#c8ccd4';
  for (const r of ROADS) {
    g.fillRect(px(r - 6), 0, 2, 1024); g.fillRect(px(r + 6) - 2, 0, 2, 1024);
    g.fillRect(0, px(r - 6), 1024, 2); g.fillRect(0, px(r + 6) - 2, 1024, 2);
  }
  // crosswalks at every intersection
  g.fillStyle = '#e8ebf0';
  for (const rx of ROADS) for (const rz of ROADS) {
    for (let k = -2; k <= 2; k++) {
      g.fillRect(px(rx - 6 + k * 2.4), px(rz - 5), 2, 10);
      g.fillRect(px(rx - 5), px(rz - 6 + k * 2.4), 10, 2);
    }
  }
  // beach sand strip on the east edge
  g.fillStyle = '#d9b380'; g.fillRect(px(258), 0, px(300) - px(258), 1024);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function windowsTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#20242e'; g.fillRect(0, 0, 128, 256);
  const rng = mulberry32(77);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const lit = rng();
      g.fillStyle = lit > 0.55 ? (lit > 0.85 ? '#ffd27a' : '#9fd8ff') : '#10131a';
      g.fillRect(x, y, 9, 11);
    }
  }
  return new THREE.CanvasTexture(c);
}

function buildingWindows(winTex, w, h) {
  // repeat the window grid so windows stay window-sized on any building
  const tex = winTex.clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 6)));
  return tex;
}

function palmTree(trunkMat, leafMat) {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 7, 6), trunkMat);
  trunk.position.y = 3.5; trunk.castShadow = true; t.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), leafMat);
  crown.scale.set(1, 0.55, 1); crown.position.y = 7.4; crown.castShadow = true; t.add(crown);
  return t;
}

export function createCity(scene) {
  const rng = mulberry32(1337);
  const city = {
    rng, colliders: [], buildings: [], palms: [],
    spawnPlayer: [0, -6], spawnCars: [],
    water: null, neonSigns: [],
  };

  // sky, fog and lights (sunset over the bay)
  scene.background = new THREE.Color(0x4a2a63);
  scene.fog = new THREE.Fog(0x4a2a63, 160, 620);
  const hemi = new THREE.HemisphereLight(0x9a7fd0, 0xf0b070, 1.15);
  scene.add(hemi);
  city.hemi = hemi; // staged daylight shots retune the sky light (shots.js)
  const sun = new THREE.DirectionalLight(0xff9a4d, 2.1);
  sun.position.set(-180, 90, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  scene.add(sun.target);
  city.sun = sun;

  // low sun disc on the horizon (east, over the water)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false }),
  );
  sunDisc.position.set(560, 52, -40); sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  // ground with painted roads
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // water plane (east of the beach)
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 600),
    new THREE.MeshStandardMaterial({ color: 0x1a6f8e, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(284 + 170, 0.4, 0);
  scene.add(water);
  city.water = water;

  // shared materials
  const winTex = windowsTexture();
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a44, roughness: 1 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.5 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

  const palette = {
    'Marina District': [0xe8e4da, 0x9fd8d2, 0x7fb2c9, 0xf2ede2],
    'Old Town': [0xc98f5f, 0xb0703f, 0xd9a86c, 0x8a5a3b],
    'Neon Strip': [0x2e2a3a, 0x3a2a4a, 0x241f33, 0x4a2a3a],
    'Harbor Docks': [0x8a6f5c, 0x6f5a4a, 0x9a7a5c, 0x5c4a3a],
    'Palm Heights': [0xf2d8b0, 0xe8c98f, 0xd9b380, 0xc9a86c],
    'Coastal Highway': [0x5a7a9a, 0x7fb2d8, 0x4a6a8a, 0x9ac2e8],
  };
  const neonColors = [0xff2e88, 0x2ee8ff, 0xffd23c, 0x7cff5e];

  const blockCenters = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    blockCenters.push([-210 + i * 60, -210 + j * 60]);
  }

  // sidewalk slabs, buildings, palms, lamps per block
  for (const [bx, bz] of blockCenters) {
    const district = districtAt(bx, bz);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(48, 0.6, 48), sidewalkMat);
    slab.position.set(bx, 0.3, bz);
    slab.receiveShadow = true;
    scene.add(slab);

    const colors = palette[district];
    const nB = district === 'Neon Strip' ? 2 : (rng() > 0.4 ? 2 : 1);
    for (let b = 0; b < nB; b++) {
      const w = 12 + rng() * 14, d = 12 + rng() * 14;
      const tall = district === 'Coastal Highway' || district === 'Neon Strip';
      const h = tall ? 26 + rng() * 42 : 8 + rng() * 16;
      const ox = (b === 0 ? -10 : 10) + (rng() - 0.5) * 6;
      const oz = (rng() - 0.5) * 18;
      const mat = new THREE.MeshStandardMaterial({
        map: buildingWindows(winTex, w, h),
        color: colors[Math.floor(rng() * colors.length)],
        roughness: 0.85,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(bx + ox, 0.6 + h / 2, bz + oz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
      city.buildings.push(mesh);
      city.colliders.push({ x: bx + ox, z: bz + oz, hx: w / 2, hz: d / 2 });
      // neon sign band on Neon Strip towers
      if (district === 'Neon Strip' && rng() > 0.35) {
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 1.6, 0.4),
          new THREE.MeshBasicMaterial({ color: neonColors[Math.floor(rng() * neonColors.length)] }),
        );
        sign.position.set(bx + ox, 0.6 + h * 0.72, bz + oz + d / 2 + 0.3);
        scene.add(sign);
        city.neonSigns.push(sign);
      }
    }
    // palms on the block corners
    if (district === 'Palm Heights' || district === 'Marina District' || rng() > 0.6) {
      const p = palmTree(trunkMat, leafMat);
      p.position.set(bx + 20, 0.6, bz + 20);
      scene.add(p); city.palms.push(p);
    }
  }

  // street lamps along every road
  for (const r of ROADS) {
    for (let v = -270; v <= 270; v += 60) {
      for (const [lx, lz] of [[r + 7, v], [r - 7, v + 30]]) {
        if (lx > 252 || lz > 295) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
        pole.position.set(lx, 3.6, lz); scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlow);
        bulb.position.set(lx, 6.7, lz); scene.add(bulb);
      }
    }
  }

  // harbor containers (south-east docks)
  const contColors = [0xc95f3c, 0x3c7ac9, 0x4fc95f, 0xd9b13c];
  for (let i = 0; i < 10; i++) {
    const cx = 195 + (i % 5) * 14, cz = 190 + Math.floor(i / 5) * 10;
    const cont = new THREE.Mesh(
      new THREE.BoxGeometry(11, 3.2, 3),
      new THREE.MeshStandardMaterial({ color: contColors[i % 4], roughness: 0.8, metalness: 0.3 }),
    );
    cont.position.set(cx, 2.2, cz);
    cont.castShadow = true;
    scene.add(cont);
    city.colliders.push({ x: cx, z: cz, hx: 5.5, hz: 1.5 });
  }

  // marina boats on the water
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.2, 9),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }),
    );
    hull.position.y = 0.6; boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), lampMat);
    mast.position.y = 4; boat.add(mast);
    boat.position.set(300 + rng() * 30, 0.6, -180 + i * 80);
    boat.rotation.y = (rng() - 0.5) * 0.6;
    scene.add(boat);
  }

  // parked-car spawn spots along roads (used by vehicles.js)
  for (let i = 0; i < 14; i++) {
    const road = ROADS[Math.floor(rng() * ROADS.length)];
    const along = -240 + rng() * 480;
    const side = rng() > 0.5 ? 1 : -1;
    city.spawnCars.push(rng() > 0.5 ? [road + side * 4.4, along, 0] : [along, road + side * 4.4, Math.PI / 2]);
  }
  return city;
}

// Push a circle (player / car / pedestrian) out of building colliders.
export function collideCircle(city, x, z, r) {
  let nx = x, nz = z;
  for (const c of city.colliders) {
    const dx = nx - c.x, dz = nz - c.z;
    const px = c.hx + r - Math.abs(dx);
    const pz = c.hz + r - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) nx = c.x + Math.sign(dx || 1) * (c.hx + r);
      else nz = c.z + Math.sign(dz || 1) * (c.hz + r);
    }
  }
  if (nx > WORLD.beachX - 2 && nz > -290 && nz < 290) {
    // beach is walkable, water is not
    if (nx > WORLD.waterX - 2) nx = WORLD.waterX - 2;
  }
  nx = Math.max(WORLD.min + 2, Math.min(WORLD.max - 2, nx));
  nz = Math.max(WORLD.min + 2, Math.min(WORLD.max - 2, nz));
  return { x: nx, z: nz };
}

// Snap a point to the nearest road centre line (for traffic / spawns).
export function nearestRoadPoint(x, z) {
  let best = null, bd = 1e9;
  for (const r of ROADS) {
    const d1 = Math.abs(x - r), d2 = Math.abs(z - r);
    if (d1 < bd) { bd = d1; best = [r, z]; }
    if (d2 < bd) { bd = d2; best = [x, r]; }
  }
  return best;
}
