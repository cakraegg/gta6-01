// VENTARA BAY — save: mission progress, cash and position in localStorage.
// Continue resumes exactly where Jax left off.

const KEY = 'ventara-bay-save-v1';

export function saveGame(G) {
  try {
    const data = {
      mission: G.missions.current,
      missionState: G.missions.state,
      cash: Math.floor(G.player.cash),
      health: Math.round(G.player.health),
      x: Math.round(G.player.x),
      z: Math.round(G.player.z),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.mission !== 'number' || typeof data.cash !== 'number') return null;
    return data;
  } catch (e) { return null; }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

export function applySave(G, data) {
  G.player.cash = data.cash;
  G.player.health = data.health;
  G.player.x = data.x;
  G.player.z = data.z;
  G.player.mesh.group.position.set(data.x, 0, data.z);
  const idx = Math.max(0, Math.min(5, data.mission));
  if (data.missionState === 'done' && idx < 5) {
    G.missions.start(G, idx + 1);
  } else {
    G.missions.start(G, idx);
  }
}
