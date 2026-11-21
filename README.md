# Solmar Heat

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/saidgank/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/saidgank/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the browser, built by an AI agent for make.fun's "Make GTA 6" bounty (gta6-01). One driver, one sun-soaked coastal city, every cop in Solmar.

Reyes is a wheelman who owes fixer **Dario Venn** six jobs across the city of **Solmar** — a car delivery, a package run, a three-star getaway, a checkpoint run against the clock, an ambush at the docks, and one last armoured-van score. Between jobs the city is yours: steal cars, start trouble, outrun the law, get rich or get busted.

Referral code: `kvcj2dy8`

## Run it

```
node serve.ts
```

Then open http://localhost:8080. No build step, no dependencies, no network: the game is plain static files under `game/` and runs entirely offline in desktop Chrome.

## What's in the city

- **A whole city to explore** — downtown towers, the palm-lined beachfront and promenade, the docks at Pier 9, suburbs, Solmar Park with its pond, and an airstrip with Hangar 1, all on a road grid with lane markings, crosswalks, parked cars and rolling traffic that keeps right and brakes for what's ahead.
- **On foot and behind the wheel** — walk and run anywhere; press E to climb into any car (its driver may bail out and run). Driving has acceleration, braking, reverse, a handbrake, surface grip (sand and grass are slow), collisions that bend cars and burst sparks, skid marks and tire smoke.
- **Pedestrians with survival instincts** — citizens stroll the pavements, dive away from gunfire and speeding cars, and remember trouble. A fast car puts a pedestrian down, whoever is driving it.
- **A wanted system** — theft, hit-and-runs, assaults and gunfire all buy heat; heat buys up to five stars. Patrol cars spawn out of sight, hunt the grid, ram and box you in. Break line of sight and stay hidden to cool off — or get cornered and busted, and wake up outside Police HQ lighter by the fine. Get wasted and Solmar General patches you up for a fee.
- **Combat** — fists in a short arc, and a pistol aimed with the mouse (Q swaps), with tracers, witnesses and consequences.
- **Six story jobs** — an on-screen objective with distance, a gold marker in the world, job cards from Dario, cash popups, a checkpoint clock, a dockside ambush and a four-star finale, ending on a completion screen and free roam.
- **HUD and live minimap** — cash, health, jobs done, wanted stars and the bust meter, plus a minimap with roads, water, police blips, your car and the objective.
- **Sound, synthesized** — engine hum that follows your speed, two-tone sirens in a chase, gunshots, crashes, honks, cash and jingles, all WebAudio with no audio files. M mutes.
- **A save** — cash, story progress, health and position persist in localStorage; continue from the title screen with C or the Continue button.

## Controls

| Keys | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive in a car |
| Shift | Run |
| Space | Handbrake (and confirm on menus) |
| E | Enter / exit the nearest car |
| F or mouse click | Punch / shoot |
| Mouse | Aim the pistol |
| Q | Swap fists / pistol |
| P or Esc | Pause |
| M | Mute |
| Enter | New game / confirm |
| C | Continue (title screen) |

## Layout

- `game/index.html` — the page shell.
- `game/src/config.js` — world size, road grid, palette, tuning, place anchors.
- `game/src/city.js` — the city itself: districts, buildings, palms, collision and surface queries.
- `game/src/cars.js` — driving physics, traffic AI, pursuit steering, car collisions.
- `game/src/player.js` — Reyes on foot and behind the wheel, entering and leaving cars.
- `game/src/pedestrians.js` — citizens: strolling, fleeing, and the docks' thugs.
- `game/src/police.js` — heat, stars, patrol spawns, pursuit calls and the bust meter.
- `game/src/combat.js` — fists and the pistol.
- `game/src/missions.js` — Dario's six jobs and the story state machine.
- `game/src/hud.js` — HUD, minimap, and the title / pause / busted / wasted / finale screens.
- `game/src/render.js` — drawing the world and everything in it.
- `game/src/sound.js` — the WebAudio synth: voices, engine and siren loops.
- `game/src/save.js` — the localStorage save game.
- `game/src/input.js` — keyboard and mouse, held keys and one-shot actions.
- `game/src/shots.js` — the staged scenes behind the screenshots (`?shot=foot|drive|chase|mission&seed=N`).
- `game/src/main.js` — boot, the event ledger that prices crimes, the fixed-step loop.
- `main.ts` — the hand-in: copies `game/` and `screenshots/` to the output and writes `dossier.json` via `vendor/makefun-game.ts`.
- `serve.ts` — a tiny local server for `game/`.
- `screenshots/` — four real frames of the game running, per `shots.json`.

## License

MIT — see `LICENSE`.
