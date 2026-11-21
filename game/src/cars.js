// Solmar Heat — cars: the shared arcade driving physics, the traffic that follows the
// road grid keeping right, parked cars waiting to be stolen, and the collisions that
// bend them all. Police pursuit steering lives here too; police.js decides where the
// police want to go, this file decides how a car gets there.
import { CAR, H_ROADS, LANE_OFF, V_ROADS } from './config.js';
import { hitsBuilding, hitsWater, surfaceAt } from './city.js';
import { CAR_COLORS } from './random.js';

let nextCarId = 1;

/** A car. kind: 'traffic' | 'parked' | 'police' | 'mission'. driver: 'ai' | 'player' | null. */
export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++,
    x, y, angle, speed: 0,
    color, kind,
    health: CAR.maxHealth,
    driver: kind === 'parked' ? null : 'ai',
    leg: null,
    cruise: 170,
    slipping: false,
    honk: 0,
    speedScale: 1,
    lastDriver: null,
  };
}

/** Seed the city: parked cars on some kerbs, traffic already rolling on the grid. */
export function seedTraffic(state) {
  const { rng, city } = state;
  for (const spot of city.parkedSpots) {
    if (rng.chance(0.45)) continue;
    const car = makeCar(spot.x, spot.y, spot.angle, rng.pick(CAR_COLORS), 'parked');
    car.angle += rng.range(-0.04, 0.04);
    state.cars.push(car);
  }
  for (let i = 0; i < 14; i += 1) {
    const car = makeCar(0, 0, 0, rng.pick(CAR_COLORS), 'traffic');
    placeOnRandomLeg(state, car);
    car.cruise = rng.range(140, 215);
    state.cars.push(car);
  }
}

/** The lane coordinate for travelling along a road: right-hand traffic. */
function laneFor(axis, c, dir) {
  if (axis === 'v') return c + (dir < 0 ? LANE_OFF : -LANE_OFF);
  return c + (dir > 0 ? LANE_OFF : -LANE_OFF);
}

/** Put a traffic car at a random intersection, heading out along a fresh leg. */
export function placeOnRandomLeg(state, car) {
  const { rng } = state;
  const axis = rng.chance(0.5) ? 'v' : 'h';
  const c = rng.pick(axis === 'v' ? V_ROADS : H_ROADS);
  const cross = rng.pick(axis === 'v' ? H_ROADS : V_ROADS);
  const dir = rng.chance(0.5) ? 1 : -1;
  const lane = laneFor(axis, c, dir);
  if (axis === 'v') { car.x = lane; car.y = cross; car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  else { car.x = cross; car.y = lane; car.angle = dir > 0 ? 0 : Math.PI; }
  car.leg = nextLeg(state, axis, c, cross, dir, true);
  car.speed = car.cruise * 0.7;
}

/**
 * Choose the leg that starts at the intersection (c, cross): mostly straight on,
 * sometimes a turn, never a U-turn, and at the grid's edge always a turn.
 */
function nextLeg(state, axis, c, cross, dir, fresh = false) {
  const { rng } = state;
  const along = axis === 'v' ? H_ROADS : V_ROADS;
  const idx = along.indexOf(cross);
  const options = [];
  if (idx + dir >= 0 && idx + dir < along.length) options.push({ axis, c, from: cross, to: along[idx + dir], dir, weight: fresh ? 1 : 3 });
  for (const turnDir of [-1, 1]) {
    options.push({ axis: axis === 'v' ? 'h' : 'v', c: cross, from: c, to: c, dir: turnDir, weight: 1 });
  }
  let total = 0;
  for (const o of options) total += o.weight;
  let roll = rng.range(0, total);
  let chosen = options[0];
  for (const o of options) { roll -= o.weight; if (roll <= 0) { chosen = o; break; } }
  return chosen;
}

/** The point a leg drives toward: the far intersection, in the correct lane. A turn
 *  leg (to === from) aims past the corner, so the car takes a line through the
 *  intersection instead of diving at its heart and swinging wide on the exit. */
function legTarget(car) {
  const leg = car.leg;
  const lane = laneFor(leg.axis, leg.c, leg.dir);
  const reach = leg.to === leg.from ? leg.dir * 110 : 0;
  return leg.axis === 'v' ? { x: lane, y: leg.to + reach } : { x: leg.to + reach, y: lane };
}

function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Surface grip: sand and grass slow a car and soften its acceleration. */
function surfaceFactor(state, x, y) {
  const s = surfaceAt(state.city, x, y);
  if (s === 'sand') return 0.55;
  if (s === 'grass') return 0.62;
  if (s === 'pavement') return 0.85;
  return 1;
}

/**
 * Advance one car by dt under throttle/steer inputs (-1..1). Returns the impact speed
 * when the car struck the world this step, else 0. Shared by every driver.
 */
export function driveCar(state, car, dt, throttle, steer, handbrake, turnScale = 1) {
  const grip = surfaceFactor(state, car.x, car.y);
  const topSpeed = CAR.maxSpeed * grip * (car.kind === 'police' ? 1.12 : 1) * (car.speedScale ?? 1);
  if (throttle > 0) car.speed += CAR.accel * grip * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 12) car.speed -= CAR.brake * dt;
    else car.speed += CAR.accel * 0.45 * throttle * dt;
  }
  car.speed -= car.speed * CAR.drag * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(topSpeed, car.speed));
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 190 * dt);

  const speedRatio = Math.max(-1, Math.min(1, car.speed / CAR.maxSpeed));
  car.slipping = Boolean(handbrake && Math.abs(car.speed) > 90) || Math.abs(steer) > 0.85 && Math.abs(car.speed) > 230;
  car.angle += steer * CAR.turnRate * turnScale * speedRatio * dt * (handbrake ? 1.5 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let impact = 0;
  const blocked = (x, y) => hitsBuilding(state.city, x, y, CAR.radius) || hitsWater(state.city, x, y, CAR.radius);
  if (!blocked(nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else {
    impact = Math.abs(car.speed);
    if (!blocked(nx, car.y)) car.x = nx;
    else if (!blocked(car.x, ny)) car.y = ny;
    car.speed = -car.speed * 0.22;
    if (impact > 150) {
      car.health -= (impact - 140) / 7;
      state.shake = Math.min(14, state.shake + impact / 34);
      state.sfx.push('crash');
      burstSparks(state, car.x + Math.cos(car.angle) * 22, car.y + Math.sin(car.angle) * 22, 7);
    }
  }
  if (car.slipping && Math.abs(car.speed) > 60) addSkid(state, car);
  return impact;
}

/** A short-lived spark burst where metal met concrete. */
export function burstSparks(state, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(30, 130);
    state.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: state.rng.range(0.2, 0.5), maxLife: 0.5, color: '#ffd76a', size: state.rng.range(1.5, 3),
    });
  }
}

function addSkid(state, car) {
  const back = 16;
  const side = 9;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  for (const s of [-1, 1]) {
    state.skids.push({
      x: car.x - cos * back - sin * side * s,
      y: car.y - sin * back + cos * side * s,
      life: 5,
    });
  }
  if (state.skids.length > 420) state.skids.splice(0, state.skids.length - 420);
  if (state.rng.chance(0.5)) {
    state.particles.push({
      x: car.x - cos * back, y: car.y - sin * back,
      vx: state.rng.range(-14, 14), vy: state.rng.range(-14, 14),
      life: state.rng.range(0.4, 0.9), maxLife: 0.9, color: 'rgba(230,230,230,0.5)', size: state.rng.range(4, 8),
    });
  }
}

/** Is there a car or a person close ahead of this one? Traffic brakes for both. */
function obstacleAhead(state, car) {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const look = 52 + Math.abs(car.speed) * 0.32;
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const fwd = dx * cos + dy * sin;
    const lat = -dx * sin + dy * cos;
    if (fwd > 6 && fwd < look && Math.abs(lat) < 21) return true;
  }
  const p = state.player;
  if (!p.inCar) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const fwd = dx * cos + dy * sin;
    const lat = -dx * sin + dy * cos;
    if (fwd > 4 && fwd < look && Math.abs(lat) < 19) return true;
  }
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const fwd = dx * cos + dy * sin;
    const lat = -dx * sin + dy * cos;
    if (fwd > 4 && fwd < look * 0.8 && Math.abs(lat) < 18) return true;
  }
  return false;
}

/** One traffic step: follow the leg, mind the car in front, turn at the corner. */
export function stepTraffic(state, car, dt) {
  if (car.health <= 0) { car.speed = 0; return; }
  const target = legTarget(car);
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  // Switch legs early: the car starts curving inside the intersection instead of
  // reaching its heart and swinging wide around the far corner.
  if (dist < 78) {
    const leg = car.leg;
    car.leg = nextLeg(state, leg.axis, leg.c, leg.to, leg.dir);
    return;
  }
  // Aim a little ahead of the nose so lane changes curve instead of snapping.
  const lookX = car.x + Math.cos(car.angle) * 30;
  const lookY = car.y + Math.sin(car.angle) * 30;
  const want = Math.atan2(target.y - lookY, target.x - lookX);
  const diff = angleWrap(want - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  let throttle = 0.62;
  if (obstacleAhead(state, car)) throttle = car.speed > 24 ? -0.7 : 0;
  else if (Math.abs(diff) > 0.5) throttle = 0.25;
  driveCar(state, car, dt, throttle, steer, false, 2.2);
  if (Math.abs(car.speed) < 4 && throttle === 0) {
    car.honk -= dt;
    if (car.honk <= 0) { state.sfx.push('honk'); car.honk = state.rng.range(1.2, 3); }
  }
}

/**
 * Police driving: steer at a target point with conviction. Returns the distance to
 * the target so police.js can decide about the bust.
 */
export function stepPursuit(state, car, dt, tx, ty, aggression) {
  if (car.health <= 0) { car.speed = 0; return Math.hypot(tx - car.x, ty - car.y); }
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleWrap(want - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.8));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  let throttle = aggression;
  if (dist < 54 && Math.abs(diff) < 0.4) throttle = 0.1;
  if (Math.abs(diff) > 2.4) throttle = -0.5;
  driveCar(state, car, dt, throttle, steer, false, 1.6);
  return dist;
}

/** Bump every pair of cars apart; hard meetings cost health, noise and sparks. */
export function collideCars(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = CAR.radius * 2 - 4;
      if (d2 === 0 || d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      const aMovable = a.kind !== 'parked';
      const bMovable = b.kind !== 'parked';
      // A shove never lands a car inside a building or the water: if the pushed
      // spot is solid, the car stays and the speeds below absorb the meeting.
      const shove = (car, mx, my) => {
        if (!hitsBuilding(state.city, car.x + mx, car.y + my, CAR.radius) && !hitsWater(state.city, car.x + mx, car.y + my, CAR.radius)) {
          car.x += mx;
          car.y += my;
        }
      };
      if (aMovable) shove(a, -ux * push, -uy * push);
      if (bMovable) shove(b, ux * push, uy * push);
      if (!aMovable && bMovable) shove(b, ux * push, uy * push);
      if (!bMovable && aMovable) shove(a, -ux * push, -uy * push);
      const closing = Math.abs(a.speed) + Math.abs(b.speed);
      if (closing > 130) {
        const dmg = (closing - 120) / 9;
        a.health -= dmg;
        b.health -= dmg;
        state.shake = Math.min(12, state.shake + closing / 40);
        state.sfx.push('crash');
        burstSparks(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 6);
        if (a.driver === 'player' || b.driver === 'player') state.events.push({ type: 'carHit', other: a.driver === 'player' ? b : a, speed: closing });
      }
      const avg = (a.speed + b.speed) / 2;
      if (aMovable) a.speed = avg * 0.7;
      if (bMovable) b.speed = avg * 0.7;
    }
  }
}
