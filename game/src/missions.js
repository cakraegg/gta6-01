// VENTARA BAY — missions: six story jobs from fixer Lena Voss, plus side
// work (taxi fares and package runs). Each mission is a chain of steps
// with a beacon in the world and a waypoint on the HUD.

import * as THREE from 'three';
import { makeCar, steerCarToward } from './vehicles.js';

// Mission steps: goto (reach the marker), chase (stay near a moving car),
// escape (lose the wanted level), hold (stand in the ring), deliver.
export const MISSION_DEFS = [
  {
    id: 1, title: 'The Pickup', giver: 'Lena Voss',
    briefing: 'Lena needs a package from the Marina. Drive or walk to the blue beacon.',
    reward: 150,
    steps: [{ type: 'goto', x: 210, z: -150, r: 6, text: 'Reach the Marina pickup' }],
  },
  {
    id: 2, title: 'Tail the Courier', giver: 'Lena Voss',
    briefing: 'A courier is moving product through Old Town. Stay on his tail.',
    reward: 220,
    steps: [{ type: 'chase', target: 'courier', r: 10, hold: 8, text: 'Stay close to the courier car' }],
  },
  {
    id: 3, title: 'Lose the Tail', giver: 'Dario',
    briefing: 'You were made. The PD is on you — lose them before you meet Kiki.',
    reward: 250,
    steps: [{ type: 'escape', text: 'Lose the wanted level' }],
  },
  {
    id: 4, title: 'The Drop', giver: 'Kiki',
    briefing: 'Take the goods to the Harbor Docks. No stops, no witnesses.',
    reward: 300,
    steps: [{ type: 'goto', x: 200, z: 210, r: 6, text: 'Deliver to the Harbor Docks' }],
  },
  {
    id: 5, title: 'The Small Heist', giver: 'Lena Voss',
    briefing: 'A cash van parks on the Neon Strip. Hold the ring to crack it, then run.',
    reward: 450,
    steps: [
      { type: 'hold', x: 30, z: 30, r: 7, hold: 4, text: 'Hold the ring to crack the van' },
      { type: 'goto', x: -180, z: -180, r: 8, text: 'Escape to the Palm Heights safehouse' },
    ],
  },
  {
    id: 6, title: 'The Last Getaway', giver: 'Lena Voss',
    briefing: 'One last run down the Coastal Highway. Four stars and counting — do not stop.',
    reward: 800,
    steps: [{ type: 'goto', x: 240, z: -260, r: 8, text: 'Reach the end of the Coastal Highway' }],
  },
];

function makeBeacon(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2ee8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30; g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3, 4.2, 32),
    new THREE.MeshBasicMaterial({ color: 0x2ee8ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4; g.add(ring);
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23c }),
  );
  marker.position.y = 6; marker.rotation.y = Math.PI / 4; g.add(marker);
  g.visible = false;
  scene.add(g);
  return { group: g, beam, ring, marker };
}

export function createMissions(scene) {
  const missions = {
    defs: MISSION_DEFS,
    current: 0, step: 0, state: 'idle', // idle | active | done
    holdT: 0, chaseT: 0, courier: null,
    side: null, // {type:'taxi'|'package', ...}
    beacon: makeBeacon(scene),
    start, update, completeStep, sideJob, finishSide,
  };

  function start(G, idx) {
    missions.current = idx; missions.step = 0;
    missions.state = 'active'; missions.holdT = 0; missions.chaseT = 0;
    const def = MISSION_DEFS[idx];
    // mission 2: a courier car to tail around Old Town
    if (idx === 1 && !missions.courier) {
      const car = makeCar(G.scene, { color: 0x2e2e38, x: -180, z: 120, heading: 0, driver: 'courier' });
      missions.courier = { car, loop: [[-180, 120], [-120, 120], [-120, 180], [-180, 180]], wp: 0 };
    }
    // mission 3 opens with the PD already on Jax; mission 6 opens at four stars
    if (idx === 2) G.police.setWanted(2);
    if (idx === 5) G.police.setWanted(4);
    return def;
  }

  function currentStep() {
    if (missions.state !== 'active') return null;
    return MISSION_DEFS[missions.current].steps[missions.step];
  }

  function stepTarget(G) {
    const s = currentStep();
    if (!s) return null;
    if (s.type === 'chase' && missions.courier) {
      return { x: missions.courier.car.x, z: missions.courier.car.z, text: s.text };
    }
    if (s.type === 'escape') return { x: G.player.x, z: G.player.z, text: s.text };
    return { x: s.x, z: s.z, text: s.text };
  }

  function completeStep(G) {
    const def = MISSION_DEFS[missions.current];
    missions.step += 1;
    missions.holdT = 0; missions.chaseT = 0;
    if (missions.step >= def.steps.length) {
      // mission complete
      G.player.cash += def.reward;
      missions.state = 'done';
      missions.beacon.group.visible = false;
      G.hud.banner('MISSION COMPLETE', def.title + '  •  +$' + def.reward);
      G.audio.jingle();
      G.save.saveGame(G);
      if (missions.current + 1 < MISSION_DEFS.length) {
        setTimeout(() => {
          if (missions.state === 'done') {
            const next = start(G, missions.current + 1);
            G.hud.banner('NEW MISSION', next.title + ' — ' + next.giver);
            G.hud.toast(next.briefing);
          }
        }, 4000);
      } else {
        setTimeout(() => {
          G.hud.banner('VENTARA BAY', 'All six story missions done. The city is yours, Jax.');
        }, 4000);
      }
    } else {
      G.hud.toast('Next: ' + def.steps[missions.step].text);
    }
  }

  function sideJob(G, type) {
    if (missions.side) return false;
    const rng = G.city.rng;
    const tx = -240 + rng() * 480, tz = -240 + rng() * 480;
    missions.side = { type, x: tx, z: tz, reward: type === 'taxi' ? 60 : 80 };
    G.hud.toast(type === 'taxi'
      ? 'Taxi fare: pick up the passenger and drop them at the marker (+$60)'
      : 'Package run: deliver to the marker (+$80)');
    return true;
  }

  function finishSide(G) {
    if (!missions.side) return;
    G.player.cash += missions.side.reward;
    G.hud.banner('SIDE JOB DONE', '+' + '$' + missions.side.reward);
    G.audio.jingle();
    missions.side = null;
  }

  function update(dt, G) {
    const p = G.player;
    // the courier keeps driving its Old Town loop while mission 2 is live
    if (missions.courier && missions.current === 1 && missions.state === 'active') {
      const c = missions.courier;
      const d = steerCarToward(c.car, c.loop[c.wp][0], c.loop[c.wp][1], 11, dt, G.city, G.collide);
      if (d < 3) c.wp = (c.wp + 1) % c.loop.length;
    }
    const s = currentStep();
    const target = stepTarget(G);
    // beacon follows the active target
    if (target && s && s.type !== 'escape') {
      missions.beacon.group.visible = true;
      missions.beacon.group.position.set(target.x, 0, target.z);
      missions.beacon.marker.rotation.y += dt * 2;
      missions.beacon.marker.position.y = 6 + Math.sin(G.time * 2) * 0.5;
    } else {
      missions.beacon.group.visible = false;
    }
    if (!s) return;
    const d = Math.hypot(p.x - (target ? target.x : 0), p.z - (target ? target.z : 0));
    if (s.type === 'goto' && d < s.r) completeStep(G);
    else if (s.type === 'hold' && d < s.r) {
      missions.holdT += dt;
      if (missions.holdT >= s.hold) completeStep(G);
    } else if (s.type === 'hold') {
      missions.holdT = Math.max(0, missions.holdT - dt);
    } else if (s.type === 'chase' && d < s.r) {
      missions.chaseT += dt;
      if (missions.chaseT >= s.hold) completeStep(G);
    } else if (s.type === 'chase') {
      missions.chaseT = Math.max(0, missions.chaseT - dt);
    } else if (s.type === 'escape' && G.police.wanted === 0) {
      completeStep(G);
    }
    // side-job target
    if (missions.side) {
      const sd = Math.hypot(p.x - missions.side.x, p.z - missions.side.z);
      if (sd < 6) finishSide(G);
    }
  }
  return missions;
}
