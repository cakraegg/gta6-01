# VENTARA BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/cakraegg/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/cakraegg/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

VENTARA BAY is an original sun-soaked coastal open-world crime game, built with three.js in plain static files — six story missions, live traffic, pedestrians, a 1–5 star police wanted system, and steal-and-drive cars. No build step, no network requests, no model calls: the whole game runs offline from `game/`.

You play Jax Corso, a getaway driver working for fixer Lena Voss in a coastal city of six named districts — Marina District, Old Town, Neon Strip, Harbor Docks, Palm Heights, and the Coastal Highway. Run the crew's jobs, stay ahead of the police, and make the last getaway.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## How to play

| Key | Action |
| --- | --- |
| WASD | Move on foot / drive |
| Mouse | Camera |
| E | Enter / exit a car (steal parked and traffic cars) |
| 1 | Fists |
| 2 | Pistol |
| R | Reload |
| P | Pause |

## Systems

- **Open world** — six named districts with roads, sidewalks, a marina, docks, and a coastal highway, all drivable and walkable.
- **Traffic and pedestrians** — cars circulate on the road network and pedestrians walk the sidewalks.
- **Wanted system** — 1–5 stars. Police cars spawn, chase, and ram; on foot they close in and arrest you.
- **Six story missions** — a pickup, a chase, a police escape, a delivery, a small heist, and the last getaway, with named characters, objective markers, waypoint beacons, and cash rewards, plus side activities.
- **Combat** — fists and a pistol with ammo and reload.
- **HUD and minimap** — health, cash, wanted stars, speed, mission objective, and a live minimap with player, police, and objective blips.
- **Save** — progress is saved to localStorage; continue from the start screen.
- **Audio** — synthesized WebAudio sound effects and a procedural music loop.

## Structure

- `game/index.html` — entry point (import map points at the vendored three.js).
- `game/src/` — one module per job: `city.js`, `player.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `missions.js`, `combat.js`, `hud.js`, `minimap.js`, `audio.js`, `save.js`, `shots.js`.
- `game/vendor/` — three.js 0.187.0, vendored as minified builds.
- `main.ts` — copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.
- `screenshots/` — four deterministic gameplay screenshots (1280×720).

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=q30cw9pb&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
