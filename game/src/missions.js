// Solmar Heat — the story: six jobs from fixer Dario Venn, from a quiet car delivery
// to the Solmar Score. Each mission is a list of steps (go somewhere, take a car,
// deliver it, lose the heat, run checkpoints, survive an ambush); this file runs the
// steps, pays the cash, and tells the HUD what to point at.
import { PLACES } from './config.js';
import { makeCar } from './cars.js';
import { makePed } from './pedestrians.js';
import { raiseHeatTo } from './police.js';
import { saveGame } from './save.js';

/** Spawn a car a mission cares about, flagged so the story can follow it. */
function missionCar(state, x, y, angle, color, tough = false) {
  const car = makeCar(x, y, angle, color, 'mission');
  if (tough) {
    car.health = 720;
    car.speedScale = 0.78;
  }
  state.cars.push(car);
  return car;
}

const MISSIONS = [
  {
    title: 'First Wheels',
    intro: 'Dario: A client’s coupé is sitting at Pier 9. Bring it to the Marina Grand — clean, no dents.',
    reward: 250,
    steps: (state) => [
      { kind: 'takeCar', x: 392, y: 1908, label: 'Take the coupé at Pier 9', make: () => missionCar(state, 392, 1908, Math.PI / 2, '#1abc9c') },
      { kind: 'deliverCar', x: PLACES.hotel.x, y: PLACES.hotel.y, label: 'Deliver the coupé to the Marina Grand' },
    ],
  },
  {
    title: 'Marina Package',
    intro: 'Dario: The Marina Grand holds a package for Venn Logistics. Legs or wheels, your call.',
    reward: 400,
    steps: () => [
      { kind: 'goto', x: PLACES.hotel.x, y: PLACES.hotel.y, label: 'Pick up the package at the Marina Grand' },
      { kind: 'goto', x: PLACES.office.x, y: PLACES.office.y, label: 'Drop the package at Venn Logistics' },
    ],
  },
  {
    title: 'Hot Tail',
    intro: 'Dario: The drop went bad and half of Solmar PD is awake. Lose them. All of them.',
    reward: 500,
    onStart: (state) => raiseHeatTo(state, 3),
    steps: () => [
      { kind: 'escape', label: 'Lose the heat — break line of sight and stay hidden' },
    ],
  },
  {
    title: 'Checkpoint Run',
    intro: 'Dario: A buyer wants proof you know this city. Six checkpoints, two minutes. Drive.',
    reward: 600,
    timer: 120,
    steps: () => [
      { kind: 'goto', x: 2900, y: 2040, label: 'Checkpoint 1 — the east promenade', cp: true },
      { kind: 'goto', x: 3052, y: 560, label: 'Checkpoint 2 — the airstrip', cp: true },
      { kind: 'goto', x: 2100, y: 210, label: 'Checkpoint 3 — north suburbs', cp: true },
      { kind: 'goto', x: 1120, y: 480, label: 'Checkpoint 4 — downtown north', cp: true },
      { kind: 'goto', x: 1960, y: 1120, label: 'Checkpoint 5 — Solmar Park', cp: true },
      { kind: 'goto', x: 420, y: 1700, label: 'Checkpoint 6 — the docks gate', cp: true },
    ],
  },
  {
    title: 'Dockside Ambush',
    intro: 'Dario: Meet my contact at Pier 9. And Reyes — go ready. It smells wrong.',
    reward: 800,
    steps: () => [
      { kind: 'fight', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Meet the contact at Pier 9' },
      { kind: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, label: 'Get back to the Marina Garage' },
    ],
  },
  {
    title: 'The Solmar Score',
    intro: 'Dario: An armoured van, downtown, full of someone else’s money. Take it to Hangar 1. Retire rich.',
    reward: 1500,
    steps: (state) => [
      { kind: 'takeCar', x: 1510, y: 1250, label: 'Steal the armoured van downtown', make: () => missionCar(state, 1510, 1250, Math.PI / 2, '#8d99ae', true), hot: 4 },
      { kind: 'deliverCar', x: PLACES.hangar.x, y: PLACES.hangar.y, label: 'Deliver the van to Hangar 1' },
    ],
  },
];

/** Fresh story state: Dario is waiting at Café Sol with the first job. */
export function makeMissions() {
  return { index: 0, phase: 'offer', steps: [], stepIndex: 0, timer: 0, car: null, banner: null };
}

function setBanner(state, title, text, seconds = 3.6) {
  state.missions.banner = { title, text, t: seconds };
}

function startMission(state) {
  const m = state.missions;
  const def = MISSIONS[m.index];
  m.steps = def.steps(state);
  m.stepIndex = 0;
  m.phase = 'active';
  m.car = null;
  m.timer = def.timer ?? 0;
  if (def.onStart) def.onStart(state);
  setBanner(state, def.title, def.intro, 4.4);
  state.sfx.push('pickup');
}

function failMission(state, why) {
  const m = state.missions;
  setBanner(state, 'JOB FAILED', why, 3.4);
  state.sfx.push('busted');
  m.phase = 'offer';
  m.steps = [];
  m.stepIndex = 0;
  if (m.car && m.car.driver !== 'player') {
    state.cars.splice(state.cars.indexOf(m.car), 1);
  }
  m.car = null;
}

function completeMission(state) {
  const m = state.missions;
  const def = MISSIONS[m.index];
  state.cash += def.reward;
  setBanner(state, 'JOB DONE', `${def.title} — +$${def.reward}`, 3.8);
  state.sfx.push('mission');
  state.sfx.push('cash');
  state.popups.push({ x: state.player.x, y: state.player.y - 30, text: `+$${def.reward}`, t: 1.6, color: '#7be382' });
  m.index += 1;
  m.steps = [];
  m.stepIndex = 0;
  m.car = null;
  if (m.index >= MISSIONS.length) {
    m.phase = 'complete';
    state.events.push({ type: 'storyComplete' });
  } else {
    m.phase = 'offer';
  }
  saveGame(state);
}

function currentStep(state) {
  const m = state.missions;
  return m.phase === 'active' ? m.steps[m.stepIndex] : null;
}

function advance(state) {
  const m = state.missions;
  const step = currentStep(state);
  if (step && step.cp) state.sfx.push('checkpoint');
  m.stepIndex += 1;
  if (m.stepIndex >= m.steps.length) completeMission(state);
}

/** What the HUD arrow and the minimap point at right now, or null in free roam. */
export function currentTarget(state) {
  const m = state.missions;
  if (m.phase === 'offer') {
    return { x: PLACES.cafe.x, y: PLACES.cafe.y, label: `Meet Dario at Café Sol — next job: ${MISSIONS[m.index].title}` };
  }
  const step = currentStep(state);
  if (!step) return null;
  if (step.kind === 'escape') return null;
  if (step.kind === 'deliverCar' && m.car && state.player.inCar !== m.car) {
    return { x: m.car.x, y: m.car.y, label: 'Get back in the car' };
  }
  return { x: step.x, y: step.y, label: step.label };
}

/** One story step: offers taken, steps checked, timers run down. */
export function stepMissions(state, dt) {
  const m = state.missions;
  if (m.banner) {
    m.banner.t -= dt;
    if (m.banner.t <= 0) m.banner = null;
  }
  const p = state.player;

  if (m.phase === 'offer') {
    if (Math.hypot(p.x - PLACES.cafe.x, p.y - PLACES.cafe.y) < 54 && !p.inCar) startMission(state);
    return;
  }
  if (m.phase !== 'active') return;

  const def = MISSIONS[m.index];
  if (def.timer) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'Out of time. Dario still has the job — meet him at Café Sol.');
      return;
    }
  }

  const step = currentStep(state);
  if (!step) return;
  switch (step.kind) {
    case 'goto': {
      const r = p.inCar ? 72 : 52;
      if (Math.hypot(p.x - step.x, p.y - step.y) < r) advance(state);
      break;
    }
    case 'takeCar': {
      if (!step.spawned) {
        step.spawned = true;
        m.car = step.make();
      }
      if (p.inCar === m.car) {
        if (step.hot) raiseHeatTo(state, step.hot);
        advance(state);
      }
      break;
    }
    case 'deliverCar': {
      if (p.inCar === m.car && Math.hypot(p.x - step.x, p.y - step.y) < 76) advance(state);
      break;
    }
    case 'escape': {
      if (state.wanted.heat <= 0 && state.wanted.stars === 0) advance(state);
      break;
    }
    case 'fight': {
      if (!step.spawned && Math.hypot(p.x - step.x, p.y - step.y) < 300) {
        step.spawned = true;
        step.thugs = [];
        for (let i = 0; i < 3; i += 1) {
          const thug = makePed(step.x + state.rng.range(-70, 70), step.y + state.rng.range(-50, 50), state.rng, 'thug');
          thug.health = 80;
          step.thugs.push(thug);
          state.peds.push(thug);
        }
        setBanner(state, 'AMBUSH', 'Dario’s contact brought friends. Put them down.', 3);
        state.sfx.push('thud');
      }
      if (step.spawned && step.thugs.every((t) => t.mode === 'down' || !state.peds.includes(t))) {
        advance(state);
      }
      break;
    }
    default:
      break;
  }
}

/** The mission list, for the start screen's story blurb. */
export function missionTitles() {
  return MISSIONS.map((m) => m.title);
}
