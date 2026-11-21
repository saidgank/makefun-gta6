// Solmar Heat — the law: a heat score that buys stars, patrol cars that spawn beyond
// the player's sight and hunt the road grid down, and the bust meter that fills when
// a patrol car has the player cornered. Crimes arrive as events; this file prices
// them, and prices forgiveness too when the player breaks line of sight.
import { HEAT_PER_STAR, MAX_STARS, POLICE_BY_STARS } from './config.js';
import { makeCar, stepPursuit } from './cars.js';
import { nearestRoadPoint } from './city.js';

/** The wanted state: heat points, the stars they buy, and how the bust is going. */
export function makeWanted() {
  return { heat: 0, stars: 0, unseenFor: 0, bust: 0, spawnTimer: 0 };
}

/** Stars for a heat score: every full slice of HEAT_PER_STAR is a star. */
export function starsFor(heat) {
  if (heat <= 0) return 0;
  return Math.min(MAX_STARS, Math.ceil(heat / HEAT_PER_STAR));
}

/** A crime was committed: price it in heat. */
export function addHeat(state, points) {
  const w = state.wanted;
  w.heat = Math.min(HEAT_PER_STAR * MAX_STARS + 30, w.heat + points);
  w.stars = starsFor(w.heat);
  w.unseenFor = 0;
}

/** Set a floor under the heat: a mission gone loud is at least this hot. */
export function raiseHeatTo(state, stars) {
  const w = state.wanted;
  const floor = stars * HEAT_PER_STAR - (HEAT_PER_STAR - 1);
  if (w.heat < floor) w.heat = floor;
  w.stars = starsFor(w.heat);
}

/** The active patrol cars (not wrecked, not stolen by the player). */
function patrolCars(state) {
  return state.cars.filter((c) => c.kind === 'police' && c.driver !== 'player');
}

function spawnCop(state) {
  const p = state.player;
  const a = state.rng.range(0, Math.PI * 2);
  const dist = state.rng.range(660, 800);
  const rp = nearestRoadPoint(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist);
  const car = makeCar(rp.x, rp.y, a + Math.PI, '#f2f3f5', 'police');
  car.driver = 'police';
  car.health = 260;
  state.cars.push(car);
}

/** One wanted step: sight and decay, reinforcements, pursuit and the bust meter. */
export function stepWanted(state, dt) {
  const w = state.wanted;
  const p = state.player;
  w.stars = starsFor(w.heat);
  const cops = patrolCars(state);
  const active = cops.filter((c) => c.health > 0);

  let nearest = Infinity;
  for (const cop of active) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < nearest) nearest = d;
  }
  const seen = nearest < 470;
  if (seen) w.unseenFor = 0;
  else {
    w.unseenFor += dt;
    if (w.unseenFor > 5 && w.heat > 0) {
      w.heat = Math.max(0, w.heat - 5.5 * dt);
      w.stars = starsFor(w.heat);
    }
  }

  // Reinforcements arrive one at a time, out of sight; surplus cars peel off.
  const wanted = POLICE_BY_STARS[w.stars];
  w.spawnTimer -= dt;
  if (active.length < wanted && w.spawnTimer <= 0) {
    spawnCop(state);
    w.spawnTimer = 1.1;
  }
  if (active.length > wanted) {
    for (const cop of active) {
      if (Math.hypot(cop.x - p.x, cop.y - p.y) > 820) {
        state.cars.splice(state.cars.indexOf(cop), 1);
        break;
      }
    }
  }

  // Pursuit: aim where the player will be, harder the hotter it gets.
  const target = p.inCar ? p.inCar : p;
  const lead = p.inCar ? 0.32 : 0;
  const tx = target.x + (p.inCar ? Math.cos(target.angle) * target.speed * lead : 0);
  const ty = target.y + (p.inCar ? Math.sin(target.angle) * target.speed * lead : 0);
  for (const cop of cops) {
    stepPursuit(state, cop, dt, tx, ty, 0.82 + w.stars * 0.06);
  }

  // The bust: cornered on foot, or boxed in at a crawl with a patrol car alongside.
  let bustRate = -0.45;
  if (!p.inCar && nearest < 98) bustRate = 0.35 + (1 - nearest / 98) * 0.85;
  else if (p.inCar && Math.abs(p.inCar.speed) < 42 && nearest < 78) bustRate = 0.55;
  w.bust = Math.max(0, Math.min(1, w.bust + bustRate * dt));
  if (w.bust >= 1) {
    w.bust = 0;
    state.events.push({ type: 'busted' });
  }
}

/** Clear the slate after a bust or a hospital visit: the fine is taken by main. */
export function clearWanted(state) {
  const w = state.wanted;
  w.heat = 0;
  w.stars = 0;
  w.bust = 0;
  state.cars = state.cars.filter((c) => c.kind !== 'police' || c.driver === 'player');
}
