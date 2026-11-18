// VENTARA BAY — minimap: a live canvas map of the city with the player,
// the mission marker, police and traffic. North-up, centred on the player.

import { districtAt } from './city.js';

export function createMinimap(canvas, city) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const SCALE = 0.32; // world units -> minimap px

  function draw(G) {
    const px = G.player.x, pz = G.player.z;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // dark glass background
    ctx.fillStyle = 'rgba(12, 16, 28, 0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-px, -pz);
    // water (east)
    ctx.fillStyle = '#1a6f8e';
    ctx.fillRect(284, -300, 320, 600);
    // roads
    ctx.strokeStyle = '#5a6272';
    ctx.lineWidth = 12;
    ctx.beginPath();
    for (const r of [-240, -180, -120, -60, 0, 60, 120, 180, 240]) {
      ctx.moveTo(r, -300); ctx.lineTo(r, 300);
      ctx.moveTo(-300, r); ctx.lineTo(300, r);
    }
    ctx.stroke();
    // beach
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(258, -300, 26, 600);
    // mission marker (pulsing)
    const target = G.missions && G.missions.state === 'active'
      ? missionTarget(G) : (G.missions && G.missions.side ? { x: G.missions.side.x, z: G.missions.side.z } : null);
    if (target) {
      const pulse = 6 + Math.sin(G.time * 4) * 2;
      ctx.fillStyle = '#2ee8ff';
      ctx.beginPath(); ctx.arc(target.x, target.z, pulse + 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#062a33';
      ctx.beginPath(); ctx.arc(target.x, target.z, 4, 0, Math.PI * 2); ctx.fill();
    }
    // traffic (white) and police (red)
    ctx.fillStyle = '#e8ebf0';
    for (const t of G.traffic.list) {
      ctx.fillRect(t.car.x - 2, t.car.z - 2, 4, 4);
    }
    ctx.fillStyle = '#ff2e2e';
    for (const c of G.police.cars) {
      ctx.beginPath(); ctx.arc(c.car.x, c.car.z, 4, 0, Math.PI * 2); ctx.fill();
    }
    for (const u of G.police.units) {
      ctx.beginPath(); ctx.arc(u.x, u.z, 3, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow (rotates with heading)
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(G.player.heading);
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // district label
    ctx.fillStyle = '#e8ebf0';
    ctx.font = 'bold 12px Trebuchet MS, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(districtAt(px, pz).toUpperCase(), 8, H - 8);
    // north tick
    ctx.fillStyle = '#ff2e88';
    ctx.font = 'bold 12px Trebuchet MS, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('N ↑', W - 8, 16);
  }

  function missionTarget(G) {
    const def = G.missions.defs[G.missions.current];
    if (!def || G.missions.state !== 'active') return null;
    const s = def.steps[G.missions.step];
    if (!s) return null;
    if (s.type === 'chase' && G.missions.courier) {
      return { x: G.missions.courier.car.x, z: G.missions.courier.car.z };
    }
    if (s.type === 'escape') return null;
    return { x: s.x, z: s.z };
  }
  return { draw };
}
