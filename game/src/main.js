// Solmar Heat — boot, the game state, the event ledger and the one loop. The world
// advances in fixed 1/60 s steps; every system (traffic, the law, fists, Dario's
// list) writes what happened into state.events, and the ledger below prices it —
// heat for crimes, fines for failures, screens for the two ways a run can end.
//
// Screens: title, play, pause, busted, wasted, story. ?seed=N fixes the city's
// dressing; ?shot=foot|drive|chase|mission (with &seed=N) stages that scene
// instead of running the loop and sets window.__shotReady for a screenshot.
import { CAR, PLACES, STEP, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { Rng } from './random.js';
import { buildCity } from './city.js';
import { collideCars, seedTraffic, stepTraffic } from './cars.js';
import { makePlayer, stepDriving, stepOnFoot, tryEnterExit } from './player.js';
import { maintainPeds, scarePeds, seedPeds, stepPed } from './pedestrians.js';
import { addHeat, clearWanted, makeWanted, stepWanted } from './police.js';
import { hurtPed, stepCombat, swapWeapon } from './combat.js';
import { currentTarget, makeMissions, stepMissions } from './missions.js';
import { loadSave, saveGame } from './save.js';
import { createInput } from './input.js';
import { drawWorld } from './render.js';
import { drawHud, drawOverlay, drawTitle, TITLE_BUTTONS } from './hud.js';
import { engineSound, playSfx, sirenSound, tickSound, toggleMute, unlockAudio } from './sound.js';
import { makeFakeInput, stageShot } from './shots.js';

const MAX_FRAME = 0.25;

/** A whole run of Solmar Heat, fresh from a seed, optionally continued from a save. */
export function createGame(seed, save = null) {
  const rng = new Rng(seed);
  const state = {
    rng,
    city: null,
    player: makePlayer(PLACES.cafe.x, PLACES.cafe.y + 40),
    cars: [],
    peds: [],
    wanted: makeWanted(),
    missions: makeMissions(),
    cash: 0,
    time: 0,
    shake: 0,
    sfx: [],
    events: [],
    particles: [],
    skids: [],
    tracers: [],
    popups: [],
    toast: null,
    lastPenalty: 0,
    camera: { x: 0, y: 0 },
    mouseWorld: { x: 0, y: 0 },
    soundOn: true,
  };
  state.city = buildCity(rng);
  seedTraffic(state);
  seedPeds(state);
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  if (save) {
    state.cash = save.cash;
    state.missions.index = Math.min(6, save.missionIndex);
    if (state.missions.index >= 6) state.missions.phase = 'complete';
    state.player.x = save.x || state.player.x;
    state.player.y = save.y || state.player.y;
    state.player.health = save.health || 100;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }
  return state;
}

function toast(state, text, color = '#ffffff', seconds = 2.6) {
  state.toast = { text, color, t: seconds };
}

/** The two ways a run ends, and what they cost. */
function endRun(state, screen) {
  const p = state.player;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar.lastDriver = 'player';
    p.inCar = null;
  }
  state.lastPenalty = Math.min(state.cash, screen === 'busted' ? 200 : 150);
  state.cash -= state.lastPenalty;
  clearWanted(state);
  p.health = 100;
  // Released onto the road outside, never inside the building itself.
  if (screen === 'busted') {
    p.x = PLACES.policeStation.x;
    p.y = 1540;
  } else {
    p.x = PLACES.hospital.x;
    p.y = 980;
  }
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.sfx.push(screen);
  saveGame(state);
}

/** Price everything the systems reported this step. */
function processEvents(state, setScreen) {
  const events = state.events.splice(0, state.events.length);
  for (const ev of events) {
    switch (ev.type) {
      case 'theft':
        // Dario's own job cars are his to lend: taking one is work, not theft.
        if (ev.car && ev.car.kind === 'mission') break;
        addHeat(state, 40);
        toast(state, 'Vehicle stolen', '#ffd76a', 1.6);
        break;
      case 'theftPolice':
        addHeat(state, 75);
        toast(state, 'You stole a police car. Bold.', '#ff9d9d', 2.2);
        break;
      case 'carHit':
        if (ev.speed > 205) {
          addHeat(state, 16);
          toast(state, 'Hit and run', '#ffd76a', 1.4);
        }
        break;
      case 'assault':
        addHeat(state, 10);
        break;
      case 'gunshot':
        addHeat(state, 9);
        break;
      case 'shotCar':
        addHeat(state, ev.car.kind === 'police' ? 26 : 10);
        break;
      case 'pedDown':
        // Reyes answers for his own violence; a stranger's accident is not his
        // crime, and the ambush's thugs were never innocents to begin with.
        if (ev.culprit !== 'world' && ev.ped.wasThug !== true) addHeat(state, 55);
        break;
      case 'playerHurt': {
        const p = state.player;
        p.health -= ev.amount;
        p.hurtTimer = 0.8;
        if (p.health <= 0) setScreen('wasted');
        break;
      }
      case 'busted':
        setScreen('busted');
        break;
      case 'storyComplete':
        setScreen('story');
        break;
      default:
        break;
    }
  }
}

/** Advance the whole world one fixed step. Story and combat can be held (title). */
export function stepGame(state, input, dt, live = true) {
  state.time += dt;
  const p = state.player;

  if (p.inCar) stepDriving(state, input, dt);
  else stepOnFoot(state, input, dt);

  for (const car of state.cars) {
    if (car.kind === 'traffic' && car.driver === 'ai') stepTraffic(state, car, dt);
  }
  stepWanted(state, dt);
  collideCars(state);
  // Wheels versus people: any car moving fast puts a pedestrian down, and the
  // event ledger decides whose crime it was.
  for (const car of state.cars) {
    if (Math.abs(car.speed) < 60) continue;
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < CAR.radius + 7) {
        hurtPed(state, ped, 100, car.driver === 'player' ? 'player' : 'world');
        scarePeds(state, car.x, car.y, 170);
      }
    }
  }
  for (const ped of state.peds) stepPed(state, ped, dt);
  maintainPeds(state, dt);
  if (live) {
    stepCombat(state, input, dt);
    stepMissions(state, dt);
  }

  // Health returns when the street leaves Reyes alone for a while.
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  else if (p.health > 0 && p.health < 100) p.health = Math.min(100, p.health + 1.7 * dt);

  for (const t of state.tracers) t.life -= dt;
  state.tracers = state.tracers.filter((t) => t.life > 0);
  for (const pt of state.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
  for (const pop of state.popups) pop.t -= dt;
  state.popups = state.popups.filter((pop) => pop.t > 0);
  if (state.toast) {
    state.toast.t -= dt;
    if (state.toast.t <= 0) state.toast = null;
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
}

/** Drain the sound queue and run the two loops for this frame. */
function runSound(state) {
  const names = state.sfx.splice(0, state.sfx.length);
  for (const name of names) {
    if (name !== 'engine') playSfx(name);
  }
  const p = state.player;
  engineSound(p.inCar ? p.inCar.speed / 356 : null);
  let siren = false;
  if (state.wanted.stars > 0) {
    for (const car of state.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 720) {
        siren = true;
        break;
      }
    }
  }
  sirenSound(siren);
  tickSound(1 / 60);
}

/** Camera: follow Reyes, lean into a car's motion, keep the world on screen. */
function updateCamera(state, dt) {
  const p = state.player;
  let tx = p.x;
  let ty = p.y;
  if (p.inCar) {
    tx += Math.cos(p.inCar.angle) * p.inCar.speed * 0.34;
    ty += Math.sin(p.inCar.angle) * p.inCar.speed * 0.34;
  }
  const k = Math.min(1, dt * 5.2);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
}

function clampCamera(state) {
  const halfW = VIEW_W / 2;
  const halfH = VIEW_H / 2;
  state.camera.x = Math.max(halfW, Math.min(WORLD_W - halfW, state.camera.x));
  state.camera.y = Math.max(halfH, Math.min(WORLD_H - halfH, state.camera.y));
}

function drawFrame(ctx, state, screen, hasSave) {
  clampCamera(state);
  const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const camX = state.camera.x - VIEW_W / 2 + shakeX;
  const camY = state.camera.y - VIEW_H / 2 + shakeY;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-camX, -camY);
  drawWorld(ctx, state, { x: camX, y: camY, w: VIEW_W, h: VIEW_H }, currentTarget(state));
  ctx.restore();
  if (screen === 'title') {
    drawTitle(ctx, state, hasSave);
    return;
  }
  drawHud(ctx, state);
  if (screen !== 'play') drawOverlay(ctx, state, screen);
}

/** The shot scenes: stage, paint twice, raise the flag. */
function runShot(canvas, name, seed) {
  const ctx = canvas.getContext('2d');
  const state = createGame(seed);
  stageShot(state, name, (s, input, dt) => stepGame(s, input, dt, false));
  let painted = 0;
  function paint() {
    drawFrame(ctx, state, 'play', false);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** The live game: screens, the fixed-step loop, and every key that changes them. */
function runGame(canvas) {
  const ctx = canvas.getContext('2d');
  const input = createInput(canvas);
  const status = document.getElementById('status');
  let save = loadSave();
  let state = createGame((Math.random() * 4294967296) >>> 0, null);
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();

  function setScreen(next) {
    if (next === 'busted' || next === 'wasted') {
      endRun(state, next);
      screen = next;
      status.textContent = next === 'busted' ? 'Busted. The police take a fine.' : 'Wasted. The hospital takes a fee.';
      return;
    }
    screen = next;
  }

  function newGame() {
    state = createGame((Math.random() * 4294967296) >>> 0, null);
    screen = 'play';
    status.textContent = 'Playing Solmar Heat. Meet Dario at Café Sol.';
  }

  function continueGame() {
    if (!save) return;
    state = createGame((Math.random() * 4294967296) >>> 0, save);
    screen = 'play';
    status.textContent = 'Welcome back to Solmar.';
  }

  function handleActions() {
    for (const action of input.takeActions()) {
      unlockAudio();
      if (action === 'mute') {
        state.soundOn = !toggleMute();
        continue;
      }
      if (screen === 'title') {
        if (action === 'confirm') newGame();
        else if (action === 'click') {
          const { x, y } = input.mouse;
          const n = TITLE_BUTTONS.newGame;
          const c = TITLE_BUTTONS.continueGame;
          if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) newGame();
          else if (save && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) continueGame();
        }
        continue;
      }
      if (screen === 'play') {
        if (action === 'pause') screen = 'pause';
        else if (action === 'enter') tryEnterExit(state);
        else if (action === 'weapon') swapWeapon(state);
        continue;
      }
      if (screen === 'pause') {
        if (action === 'pause' || action === 'confirm') screen = 'play';
        continue;
      }
      // busted, wasted, story: any confirmation returns to the streets.
      if (action === 'confirm' || action === 'click') screen = 'play';
    }
  }

  // C continues from the title screen.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && screen === 'title') continueGame();
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    state.mouseWorld.x = state.camera.x - VIEW_W / 2 + input.mouse.x;
    state.mouseWorld.y = state.camera.y - VIEW_H / 2 + input.mouse.y;
    if (screen === 'play') {
      while (accumulator >= STEP) {
        stepGame(state, input, STEP, true);
        processEvents(state, setScreen);
        accumulator -= STEP;
        if (screen !== 'play') {
          accumulator = 0;
          break;
        }
      }
    } else if (screen === 'title') {
      // The city idles behind the title: traffic rolls, citizens stroll.
      while (accumulator >= STEP) {
        stepGame(state, makeFakeInput(), STEP, false);
        state.events.length = 0;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (screen === 'play' || screen === 'title') updateCamera(state, 1 / 60);
    runSound(state);
    drawFrame(ctx, state, screen, Boolean(save));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') screen = 'pause';
  });

  status.textContent = 'Solmar Heat. Press Enter for a new game.';
  requestAnimationFrame(frame);
}

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const shot = params.get('shot');
if (shot) runShot(canvas, shot, Number.isInteger(seedParam) ? seedParam : 1);
else runGame(canvas);
