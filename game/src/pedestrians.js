// Solmar Heat — pedestrians: Solmar's citizens stroll the pavements, dive away from
// trouble and remember an insult for a few seconds. A few of them, on the docks, are
// not citizens at all: the mission's thugs walk at the player and swing.
import { H_ROADS, ROAD_HALF, V_ROADS, WORLD_H, WORLD_W } from './config.js';
import { hitsBuilding, hitsWater } from './city.js';
import { SHIRT_COLORS } from './random.js';

/** A pedestrian. mode: 'stroll' | 'flee' | 'thug' | 'down'. */
export function makePed(x, y, rng, mode = 'stroll') {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    shirt: rng.pick(SHIRT_COLORS),
    mode,
    health: 100,
    down: 0,
    panic: 0,
    swingCd: 0,
    legDir: rng.chance(0.5) ? 1 : -1,
    axis: rng.chance(0.5) ? 'v' : 'h',
    lane: 0,
  };
}

/** A pavement point beside a random road: where citizens appear. */
function pavementPoint(state) {
  const { rng } = state;
  const vertical = rng.chance(0.5);
  const road = rng.pick(vertical ? V_ROADS : H_ROADS);
  const side = rng.chance(0.5) ? 1 : -1;
  const off = side * (ROAD_HALF + rng.range(10, 20));
  const along = rng.range(80, (vertical ? WORLD_H : WORLD_W) - 300);
  return vertical ? { x: road + off, y: along, axis: 'v' } : { x: along, y: road + off, axis: 'h' };
}

/** Fill the streets with citizens. */
export function seedPeds(state, count = 36) {
  for (let i = 0; i < count; i += 1) {
    const p = pavementPoint(state);
    const ped = makePed(p.x, p.y, state.rng);
    ped.axis = p.axis;
    state.peds.push(ped);
  }
}

/** Send every citizen near a point running from it: gunfire, crashes, a car mounting the kerb. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.mode !== 'stroll') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.mode = 'flee';
      ped.panic = state.rng.range(1.6, 3.2);
      ped.angle = Math.atan2(ped.y - y, ped.x - x) + state.rng.range(-0.5, 0.5);
    }
  }
}

function movePed(state, ped, dt, speed) {
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (!hitsBuilding(state.city, nx, ny, 10) && !hitsWater(state.city, nx, ny, 10)) {
    ped.x = nx;
    ped.y = ny;
    ped.speed = speed;
    return true;
  }
  if (!hitsBuilding(state.city, nx, ped.y, 10) && !hitsWater(state.city, nx, ped.y, 10)) {
    ped.x = nx;
    ped.speed = speed;
    return true;
  }
  if (!hitsBuilding(state.city, ped.x, ny, 10) && !hitsWater(state.city, ped.x, ny, 10)) {
    ped.y = ny;
    ped.speed = speed;
    return true;
  }
  ped.speed = 0;
  return false;
}

/** One pedestrian step: stroll the pavement grid, flee a threat, or close on the player. */
export function stepPed(state, ped, dt) {
  if (ped.mode === 'down') {
    ped.down -= dt;
    return;
  }
  if (ped.swingCd > 0) ped.swingCd -= dt;

  if (ped.mode === 'flee') {
    ped.panic -= dt;
    if (ped.panic <= 0) ped.mode = 'stroll';
    if (!movePed(state, ped, dt, 218)) ped.angle += dt * 5;
    return;
  }

  if (ped.mode === 'thug') {
    const p = state.player;
    const d = Math.hypot(p.x - ped.x, p.y - ped.y);
    ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
    if (d > 30) movePed(state, ped, dt, 168);
    else {
      ped.speed = 0;
      if (ped.swingCd <= 0 && !p.inCar) {
        ped.swingCd = 0.85;
        state.events.push({ type: 'playerHurt', amount: 8, x: ped.x, y: ped.y });
        state.sfx.push('thud');
      }
    }
    return;
  }

  // Stroll: walk the current pavement line; at a crossing, sometimes turn.
  const turnAt = ped.axis === 'v' ? H_ROADS : V_ROADS;
  const along = ped.axis === 'v' ? ped.y : ped.x;
  ped.angle = ped.axis === 'v' ? ped.legDir * Math.PI / 2 : (ped.legDir > 0 ? 0 : Math.PI);
  for (const c of turnAt) {
    if (Math.abs(along - c) < 8 && state.rng.chance(0.012)) {
      ped.axis = ped.axis === 'v' ? 'h' : 'v';
      ped.legDir = state.rng.chance(0.5) ? 1 : -1;
      // Step onto the crossing pavement of the road just turned onto.
      if (ped.axis === 'h') ped.y = c + (ped.y > c ? ROAD_HALF + 13 : -ROAD_HALF - 13);
      else ped.x = c + (ped.x > c ? ROAD_HALF + 13 : -ROAD_HALF - 13);
      break;
    }
  }
  if (!movePed(state, ped, dt, 74)) {
    ped.legDir *= -1;
    ped.angle += Math.PI;
  }
  // Keep citizens out of the sea and inside the world.
  ped.x = Math.max(16, Math.min(WORLD_W - 16, ped.x));
  ped.y = Math.max(16, Math.min(WORLD_H - 16, ped.y));
}

/** Keep the streets populated: the fallen fade, fresh citizens arrive off-camera. */
export function maintainPeds(state, dt) {
  state.peds = state.peds.filter((ped) => !(ped.mode === 'down' && ped.down <= 0));
  const cam = state.camera;
  let citizens = 0;
  for (const ped of state.peds) if (ped.mode !== 'thug') citizens += 1;
  if (citizens < 34 && state.rng.chance(dt * 2)) {
    const p = pavementPoint(state);
    if (Math.abs(p.x - cam.x) > 760 || Math.abs(p.y - cam.y) > 560) {
      const ped = makePed(p.x, p.y, state.rng);
      ped.axis = p.axis;
      state.peds.push(ped);
    }
  }
}
