// Solmar Heat — the wheelman: Reyes on foot and behind the wheel. Walking, running,
// sliding along walls, climbing into any car in reach (its driver may object), and
// climbing out again. Driving itself is cars.js physics; this file feeds it inputs.
import { CAR, PLAYER, WORLD_H, WORLD_W } from './config.js';
import { hitsBuilding, hitsWater } from './city.js';
import { driveCar } from './cars.js';
import { makePed } from './pedestrians.js';

/** Reyes at the start of a new game, outside Café Sol. */
export function makePlayer(x, y) {
  return {
    x, y,
    angle: Math.PI / 2,
    health: PLAYER.maxHealth,
    inCar: null,
    weapon: 'fists',
    punchCd: 0,
    gunCd: 0,
    hurtTimer: 0,
    swing: 0,
  };
}

/** Slide a circle through the world: try the full move, then each axis alone. */
export function slideMove(state, body, radius, nx, ny) {
  const blocked = (x, y) => hitsBuilding(state.city, x, y, radius) || hitsWater(state.city, x, y, radius);
  if (!blocked(nx, ny)) {
    body.x = nx;
    body.y = ny;
    return true;
  }
  if (!blocked(nx, body.y)) { body.x = nx; return true; }
  if (!blocked(body.x, ny)) { body.y = ny; return true; }
  return false;
}

/** One step on foot: axes to velocity, velocity to a slide, cars to a shove or a hit. */
export function stepOnFoot(state, input, dt) {
  const p = state.player;
  const axes = input.axes();
  const len = Math.hypot(axes.x, axes.y);
  if (len > 0) {
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const vx = (axes.x / len) * speed;
    const vy = (axes.y / len) * speed;
    p.angle = Math.atan2(vy, vx);
    slideMove(state, p, PLAYER.radius, p.x + vx * dt, p.y + vy * dt);
  }
  if (p.weapon === 'pistol') {
    const m = state.mouseWorld;
    if (m) p.angle = Math.atan2(m.y - p.y, m.x - p.x);
  }
  p.x = Math.max(14, Math.min(WORLD_W - 14, p.x));
  p.y = Math.max(14, Math.min(WORLD_H - 14, p.y));

  // Cars are furniture until they are not: a slow one shoves, a fast one hurts.
  for (const car of state.cars) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = CAR.radius + PLAYER.radius - 2;
    if (d === 0 || d >= min) continue;
    const ux = dx / d;
    const uy = dy / d;
    if (Math.abs(car.speed) > 72 && car.driver !== 'player') {
      state.events.push({ type: 'playerHurt', amount: 15, x: car.x, y: car.y });
      state.sfx.push('thud');
      slideMove(state, p, PLAYER.radius, p.x + ux * 54, p.y + uy * 54);
      state.shake = Math.min(10, state.shake + 4);
    } else {
      slideMove(state, p, PLAYER.radius, car.x + ux * min, car.y + uy * min);
    }
  }
}

/** One step behind the wheel: the input becomes throttle and steering. */
export function stepDriving(state, input, dt) {
  const car = state.player.inCar;
  if (!car) return;
  driveCar(state, car, dt, input.throttle(), input.steer(), input.handbrake());
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  if (Math.abs(car.speed) > 40 && state.soundOn) state.sfx.push('engine');
}

/** The nearest car the player could climb into, or null. */
export function nearestCar(state, range = PLAYER.enterRange) {
  const p = state.player;
  let best = null;
  let bestD = range;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/**
 * E pressed: climb out of the current car, or into the nearest one. Stealing is an
 * event the wanted system hears about; a traffic driver bails out and runs.
 */
export function tryEnterExit(state) {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    car.driver = null;
    car.lastDriver = 'player';
    p.inCar = null;
    const side = car.angle + Math.PI / 2;
    for (const [ox, oy] of [
      [Math.cos(side) * 30, Math.sin(side) * 30],
      [-Math.cos(side) * 30, -Math.sin(side) * 30],
      [Math.cos(car.angle) * 34, Math.sin(car.angle) * 34],
      [-Math.cos(car.angle) * 34, -Math.sin(car.angle) * 34],
    ]) {
      const nx = car.x + ox;
      const ny = car.y + oy;
      if (!hitsBuilding(state.city, nx, ny, PLAYER.radius) && !hitsWater(state.city, nx, ny, PLAYER.radius)) {
        p.x = nx;
        p.y = ny;
        break;
      }
    }
    state.sfx.push('door');
    return;
  }
  const car = nearestCar(state);
  if (!car) return;
  if (car.driver === 'ai' && car.kind === 'traffic') {
    const ped = makePed(car.x + 20, car.y + 10, state.rng, 'flee');
    ped.panic = 3;
    state.peds.push(ped);
  }
  if (car.lastDriver !== 'player' && car.kind !== 'police') {
    state.events.push({ type: 'theft', car });
  }
  if (car.kind === 'police') state.events.push({ type: 'theftPolice', car });
  car.driver = 'player';
  car.speed = 0;
  p.inCar = car;
  state.sfx.push('door');
}
