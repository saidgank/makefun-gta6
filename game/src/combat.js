// Solmar Heat — combat: fists and a pistol, both aimed by where Reyes faces (the
// mouse when the pistol is out). Hits are instant rays and short arcs; the noise and
// the witnesses are events the wanted system prices. Nothing here draws: a tracer is
// two points and a lifetime, and render.js fades it.
import { CAR, PLAYER } from './config.js';
import { hitsBuilding, hitsWater } from './city.js';
import { scarePeds } from './pedestrians.js';

/** Hurt a pedestrian; at zero health they go down and stay down a while. The culprit
 *  is 'player' for Reyes's own fists, bullets and wheels, 'world' for traffic. */
export function hurtPed(state, ped, amount, culprit = 'player') {
  if (ped.mode === 'down') return;
  ped.health -= amount;
  if (ped.health <= 0) {
    ped.wasThug = ped.mode === 'thug';
    ped.mode = 'down';
    ped.down = 7;
    ped.speed = 0;
    state.events.push({ type: 'pedDown', ped, culprit });
  } else if (ped.mode !== 'thug') {
    ped.mode = 'flee';
    ped.panic = 2.4;
    ped.angle = Math.atan2(ped.y - state.player.y, ped.x - state.player.x);
  }
}

function punch(state) {
  const p = state.player;
  p.punchCd = PLAYER.punchCooldown;
  p.swing = 0.16;
  state.sfx.push('punch');
  let hit = false;
  for (const ped of state.peds) {
    if (ped.mode === 'down') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d > PLAYER.punchRange + 10) continue;
    const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
    let diff = ang - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.15) {
      hurtPed(state, ped, PLAYER.punchDamage);
      hit = true;
    }
  }
  if (hit) {
    state.events.push({ type: 'assault' });
    scarePeds(state, p.x, p.y, 130);
  }
}

function shoot(state) {
  const p = state.player;
  p.gunCd = PLAYER.gunCooldown;
  state.sfx.push('shot');
  state.events.push({ type: 'gunshot' });
  scarePeds(state, p.x, p.y, 400);
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const x0 = p.x + cos * 16;
  const y0 = p.y + sin * 16;
  let end = PLAYER.gunRange;
  let hitCar = null;
  let hitPed = null;
  // March the ray; the first thing it meets — wall, citizen or car — takes the round.
  for (let d = 10; d < PLAYER.gunRange; d += 7) {
    const x = x0 + cos * d;
    const y = y0 + sin * d;
    if (hitsBuilding(state.city, x, y, 2) || hitsWater(state.city, x, y, 2)) {
      end = d;
      break;
    }
    let stop = false;
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      if (Math.hypot(ped.x - x, ped.y - y) < 13) {
        hitPed = ped;
        end = d;
        stop = true;
        break;
      }
    }
    if (stop) break;
    for (const car of state.cars) {
      if (Math.hypot(car.x - x, car.y - y) < CAR.radius + 3) {
        hitCar = car;
        end = d;
        stop = true;
        break;
      }
    }
    if (stop) break;
  }
  const x1 = x0 + cos * end;
  const y1 = y0 + sin * end;
  state.tracers.push({ x0, y0, x1, y1, life: 0.08 });
  state.particles.push({
    x: x0, y: y0, vx: cos * 30, vy: sin * 30, life: 0.06, maxLife: 0.06, color: '#ffe9a3', size: 5,
  });
  if (hitPed) hurtPed(state, hitPed, PLAYER.gunDamage);
  if (hitCar) {
    hitCar.health -= PLAYER.gunDamage;
    state.events.push({ type: 'shotCar', car: hitCar });
    if (hitCar.health <= 0 && hitCar.driver === 'player') state.events.push({ type: 'ownCarDead' });
  }
}

/** One combat step: cooldowns, then fists or the pistol while the attack is held. */
export function stepCombat(state, input, dt) {
  const p = state.player;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.gunCd > 0) p.gunCd -= dt;
  if (p.swing > 0) p.swing -= dt;
  if (p.inCar || !input.attacking()) return;
  if (p.weapon === 'pistol') {
    if (p.gunCd <= 0) shoot(state);
  } else if (p.punchCd <= 0) {
    punch(state);
  }
}

/** Q (or 1/2): swap between fists and the pistol. */
export function swapWeapon(state) {
  const p = state.player;
  p.weapon = p.weapon === 'fists' ? 'pistol' : 'fists';
  state.sfx.push('click');
}
