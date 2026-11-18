// VENTARA BAY — combat: fists up close, a pistol at range, ammo that runs
// out. Violence raises the wanted level, so every shot has a price.

import * as THREE from 'three';

export function createCombat(scene, camera) {
  const raycaster = new THREE.Raycaster();
  const combat = {
    weapon: 'fists', // 'fists' | 'pistol'
    ammo: 12, reserve: 48,
    shotsAt: -100, punchAt: -100,
    tracer: null, flash: null,
    punch, shoot, reload, update,
  };

  // muzzle flash light + tracer line, created lazily
  combat.flash = new THREE.PointLight(0xffd27a, 0, 18);
  scene.add(combat.flash);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  combat.tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
  scene.add(combat.tracer);

  function punch(G) {
    if (G.time - combat.punchAt < 0.35) return;
    combat.punchAt = G.time;
    G.player.punching = 0.25;
    G.audio.swing();
    // hit the nearest officer or pedestrian in front, within 2.2 m
    const p = G.player;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    for (const u of G.police.units) {
      const dx = u.x - p.x, dz = u.z - p.z;
      if (Math.hypot(dx, dz) < 2.2 && dx * fx + dz * fz > 0) {
        u.health -= 25;
        G.audio.thud();
        if (u.health <= 0) {
          // knocked flat: the officer is dragged off and a fresh one answers the call
          u.health = 50;
          const a = G.city.rng() * Math.PI * 2;
          u.x = p.x + Math.cos(a) * 60;
          u.z = p.z + Math.sin(a) * 60;
          G.police.addWanted(1);
          G.hud.toast('Officer down — the heat just went up');
        }
        return;
      }
    }
  }

  function shoot(G) {
    if (combat.weapon !== 'pistol') return;
    if (G.time - combat.shotsAt < 0.22) return;
    if (combat.ammo <= 0) { G.audio.click(); G.hud.toast('Out of ammo — press R to reload'); return; }
    combat.ammo -= 1;
    combat.shotsAt = G.time;
    G.audio.shot();
    G.police.addWanted(1);
    // raycast from the camera centre into the scene
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const targets = [];
    for (const u of G.police.units) targets.push(u.mesh.group);
    for (const c of G.police.cars) targets.push(c.car.group);
    const hits = raycaster.intersectObjects(targets, true);
    const from = camera.position.clone();
    let end = from.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(60));
    if (hits.length > 0) {
      end = hits[0].point.clone();
      const hit = hits[0].object;
      // walk up to the unit / car record that owns this mesh
      for (const u of G.police.units) {
        if (u.mesh.group === hit || u.mesh.group.children.includes(hit) || hit.parent === u.mesh.group) {
          u.health -= 34;
          if (u.health <= 0) {
            u.health = 50;
            G.hud.toast('Officer down');
          }
          break;
        }
      }
    }
    // tracer + flash for one frame
    const pos = combat.tracer.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    combat.tracer.material.opacity = 0.9;
    combat.flash.position.copy(from);
    combat.flash.intensity = 6;
  }

  function reload(G) {
    if (combat.weapon !== 'pistol' || combat.ammo >= 12 || combat.reserve <= 0) return;
    const need = 12 - combat.ammo;
    const take = Math.min(need, combat.reserve);
    combat.ammo += take; combat.reserve -= take;
    G.audio.reload();
    G.hud.toast('Reloaded — ' + combat.ammo + ' in the mag');
  }

  function update(dt, G) {
    combat.tracer.material.opacity = Math.max(0, combat.tracer.material.opacity - dt * 6);
    combat.flash.intensity = Math.max(0, combat.flash.intensity - dt * 40);
  }
  return combat;
}
