// Solmar Heat — the screenshot scenes behind ?shot=foot|drive|chase|mission&seed=N.
// Each scene arranges the real game — Reyes, traffic, the law, Dario's list — then
// plays it forward with a scripted driver for a fixed number of steps, so the frame
// is a moment the game itself produced and the same seed always gives the same one.
import { PLACES } from './config.js';
import { makeCar } from './cars.js';
import { raiseHeatTo } from './police.js';

/** A stand-in input with fixed answers, for staging scenes and the title backdrop. */
export function makeFakeInput({ throttle = 0, steer = 0 } = {}) {
  return {
    mouse: { x: 0, y: 0, down: false },
    axes: () => ({ x: 0, y: 0 }),
    throttle: () => throttle,
    steer: () => steer,
    running: () => false,
    handbrake: () => false,
    attacking: () => false,
    takeActions: () => [],
  };
}

function runSteps(state, step, input, seconds) {
  const n = Math.round(seconds / (1 / 60));
  for (let i = 0; i < n; i += 1) step(state, input, 1 / 60);
}

/** Reyes on foot downtown: café behind him, the city awake, Dario's marker up. */
function stageFoot(state, step) {
  const p = state.player;
  p.x = 1090;
  p.y = 890;
  p.angle = -0.81;
  runSteps(state, step, makeFakeInput(), 1.6);
}

/** Reyes driving the beachfront in traffic, the sea on his right. */
function stageDrive(state, step) {
  const car = makeCar(430, 2130, 0, '#e74c3c', 'traffic');
  car.driver = 'player';
  car.speed = 205;
  state.cars.push(car);
  const p = state.player;
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  runSteps(state, step, makeFakeInput({ throttle: 0.72 }), 1.3);
}

/**
 * The money shot: a three-star chase downtown. The mission card reads as an escape
 * objective, the stars are lit, and Solmar PD is on the minimap and in the mirrors.
 */
function stageChase(state, step) {
  const car = makeCar(1506, 640, Math.PI / 2, '#e74c3c', 'traffic');
  car.driver = 'player';
  car.speed = 238;
  state.cars.push(car);
  const p = state.player;
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  const m = state.missions;
  m.index = 2;
  m.phase = 'active';
  m.steps = [{ kind: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Hot Tail — lose the heat and reach Pier 9' }];
  m.stepIndex = 0;
  m.banner = { title: 'Hot Tail', text: 'Dario: The drop went bad. Lose them — all of them.', t: 99 };
  raiseHeatTo(state, 3);
  for (let i = 0; i < 3; i += 1) {
    const cop = makeCar(1510, 640 - 150 - i * 88, Math.PI / 2, '#f2f3f5', 'police');
    cop.driver = 'police';
    cop.health = 260;
    cop.speed = 196;
    state.cars.push(cop);
  }
  runSteps(state, step, makeFakeInput({ throttle: 0.94 }), 1.2);
}

/** A job just landed at the Marina Garage: the card, the cash, the quiet after. */
function stageMission(state, step) {
  const p = state.player;
  p.x = 392;
  p.y = 1792;
  p.angle = -2.2;
  state.cash = 2550;
  state.missions.index = 5;
  state.missions.banner = { title: 'JOB DONE', text: 'Dockside Ambush — +$800', t: 99 };
  state.popups.push({ x: p.x, y: p.y - 30, text: '+$800', t: 1.5, color: '#7be382' });
  const coupe = makeCar(452, 1846, Math.PI, '#1abc9c', 'mission');
  coupe.driver = null;
  state.cars.push(coupe);
  runSteps(state, step, makeFakeInput(), 1.2);
}

/** Set `state` to the named scene. Unknown names stage the foot scene. */
export function stageShot(state, name, step) {
  if (name === 'drive') stageDrive(state, step);
  else if (name === 'chase') stageChase(state, step);
  else if (name === 'mission') stageMission(state, step);
  else stageFoot(state, step);
  // The camera settles on Reyes instantly in a still, however it got there.
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}
