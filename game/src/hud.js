// Solmar Heat — everything painted over the world: the HUD (cash, health, weapon,
// the objective banner and Dario's job cards), the wanted stars and bust meter, the
// live minimap, and the full screens (title, pause, busted, wasted, story's end).
// Screen space only: main.js hands over an untransformed context.
import { COLORS, PLACES, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { currentTarget } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAP = { x: VIEW_W - 224, y: 16, w: 208, h: 156 };

/** The title screen's buttons, shared between the painter and the click handler. */
export const TITLE_BUTTONS = {
  newGame: { x: VIEW_W / 2 - 220, y: 566, w: 200, h: 52 },
  continueGame: { x: VIEW_W / 2 + 20, y: 566, w: 200, h: 52 },
};

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function text(ctx, value, x, y, size, color, align = 'left', weight = '') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function drawMinimap(ctx, state, target) {
  const { x, y, w, h } = MAP;
  panel(ctx, x - 4, y - 4, w + 8, h + 26);
  const sx = (wx) => x + (wx / WORLD_W) * w;
  const sy = (wy) => y + (wy / WORLD_H) * h;
  ctx.fillStyle = '#274b63';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#3f4a3a';
  ctx.fillRect(x, y, w, sy(2352) - y);
  ctx.fillStyle = '#4db3d9';
  ctx.fillRect(x, sy(2352), w, y + h - sy(2352));
  ctx.strokeStyle = 'rgba(230,230,230,0.65)';
  ctx.lineWidth = 2;
  for (const cx of [420, 980, 1540, 2100, 2660]) {
    ctx.beginPath();
    ctx.moveTo(sx(cx), y);
    ctx.lineTo(sx(cx), sy(2160));
    ctx.stroke();
  }
  for (const cy of [420, 980, 1540, 2100]) {
    ctx.beginPath();
    ctx.moveTo(x, sy(cy));
    ctx.lineTo(x + w, sy(cy));
    ctx.stroke();
  }
  // Police first, so the player and the objective sit on top.
  const blink = Math.floor(state.time * 2.6) % 2 === 0;
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.driver === 'player') continue;
    ctx.fillStyle = blink ? '#3fa9ff' : '#bfe1ff';
    ctx.fillRect(sx(car.x) - 2.6, sy(car.y) - 2.6, 5.2, 5.2);
  }
  if (state.missions.car) {
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(sx(state.missions.car.x) - 2.4, sy(state.missions.car.y) - 2.4, 4.8, 4.8);
  }
  if (target) {
    ctx.fillStyle = COLORS.objective;
    ctx.beginPath();
    ctx.arc(sx(target.x), sy(target.y), 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,201,60,0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sx(target.x), sy(target.y), 7.6 + Math.sin(state.time * 4) * 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The player: a white arrow turned to his heading.
  const p = state.player;
  ctx.save();
  ctx.translate(sx(p.x), sy(p.y));
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.4);
  ctx.lineTo(-5, 4.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, 'SOLMAR', x + w / 2, y + h + 19, 12, '#cfd8e3', 'center', 'bold');
}

function drawStars(ctx, state) {
  const w = state.wanted;
  if (w.stars === 0 && w.bust <= 0) return;
  const y = MAP.y + MAP.h + 44;
  for (let i = 0; i < 5; i += 1) {
    text(ctx, '★', MAP.x + MAP.w - i * 30 - 14, y, 27, i < w.stars ? '#ffc93c' : 'rgba(255,255,255,0.25)', 'center');
  }
  if (w.bust > 0.02) {
    const bw = 150;
    const bx = MAP.x + MAP.w - bw;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, y + 12, bw, 11);
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(bx, y + 12, bw * w.bust, 11);
    text(ctx, 'BUSTED?', bx + bw / 2, y + 40, 13, '#ffb3b3', 'center', 'bold');
  }
}

/** The whole HUD for one frame of play. */
export function drawHud(ctx, state) {
  const p = state.player;
  const target = currentTarget(state);
  drawMinimap(ctx, state, target);
  drawStars(ctx, state);

  // Cash, health, story progress.
  panel(ctx, 16, 16, 218, 86);
  text(ctx, `$ ${state.cash.toLocaleString('en-US')}`, 32, 50, 27, COLORS.cash, 'left', 'bold');
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(32, 62, 150, 11);
  ctx.fillStyle = p.health > 30 ? '#7be382' : COLORS.danger;
  ctx.fillRect(32, 62, 150 * Math.max(0, p.health) / 100, 11);
  text(ctx, `JOBS ${Math.min(state.missions.index, 6)}/6 · ${state.missions.phase === 'complete' ? 'STORY DONE' : 'DARIO’S LIST'}`, 32, 93, 12.5, '#cfd8e3');

  // The objective, top centre, with the distance left to run.
  if (target) {
    const dist = Math.round(Math.hypot(p.x - target.x, p.y - target.y) / 10);
    panel(ctx, VIEW_W / 2 - 265, 16, 530, 52);
    text(ctx, target.label, VIEW_W / 2, 40, 16.5, '#ffffff', 'center', 'bold');
    text(ctx, target === null ? '' : `${dist} m`, VIEW_W / 2, 60, 12.5, COLORS.objective, 'center');
  }

  // Dario's job card: title and words, fading as its seconds run out.
  const banner = state.missions.banner;
  if (banner) {
    const alpha = Math.min(1, banner.t / 0.8);
    ctx.save();
    ctx.globalAlpha = alpha;
    panel(ctx, VIEW_W / 2 - 330, 84, 660, 74);
    text(ctx, banner.title, VIEW_W / 2, 114, 21, COLORS.objective, 'center', 'bold');
    text(ctx, banner.text, VIEW_W / 2, 142, 14.5, '#ffffff', 'center');
    ctx.restore();
  }

  // Checkpoint clock.
  if (state.missions.phase === 'active' && state.missions.timer > 0) {
    text(ctx, `${Math.max(0, state.missions.timer).toFixed(1)}s`, VIEW_W / 2, 190, 30, state.missions.timer < 20 ? COLORS.danger : '#ffffff', 'center', 'bold');
  }

  // Weapon and the contextual hint line.
  text(ctx, p.inCar ? 'DRIVING' : (p.weapon === 'pistol' ? 'PISTOL' : 'FISTS'), VIEW_W - 24, VIEW_H - 22, 16, '#ffffff', 'right', 'bold');
  const hint = p.inCar
    ? 'W A S D drive · SPACE handbrake · E get out · P pause'
    : 'W A S D move · SHIFT run · E enter car · F / CLICK fight · Q weapon · P pause';
  text(ctx, hint, 20, VIEW_H - 22, 13.5, 'rgba(255,255,255,0.75)');

  // A toast: busted, wasted and lesser news, centre screen.
  if (state.toast) {
    const a = Math.min(1, state.toast.t / 0.6);
    ctx.save();
    ctx.globalAlpha = a;
    text(ctx, state.toast.text, VIEW_W / 2, VIEW_H - 120, 25, state.toast.color, 'center', 'bold');
    ctx.restore();
  }

  // Fresh damage reddens the edges.
  if (p.hurtTimer > 0) {
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
    grad.addColorStop(0, 'rgba(200,0,0,0)');
    grad.addColorStop(1, `rgba(200,0,0,${0.4 * Math.min(1, p.hurtTimer)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function dim(ctx, color = 'rgba(8, 10, 16, 0.62)') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function bigTitle(ctx, title, sub, y = 218) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  text(ctx, title, VIEW_W / 2, y, 84, '#ffc93c', 'center', '900');
  ctx.restore();
  if (sub) text(ctx, sub, VIEW_W / 2, y + 40, 19, '#ffffff', 'center');
}

/** The title screen over the drifting city. */
export function drawTitle(ctx, state, hasSave) {
  dim(ctx, 'rgba(8, 10, 16, 0.45)');
  bigTitle(ctx, 'SOLMAR HEAT', 'One driver. One city. Every cop in Solmar.');
  text(ctx, 'Reyes owes fixer Dario Venn six jobs across the city of Solmar —', VIEW_W / 2, 330, 17.5, '#e8edf3', 'center');
  text(ctx, 'deliveries, getaways and one last score. Steal cars, run from the law, get paid.', VIEW_W / 2, 356, 17.5, '#e8edf3', 'center');
  const controls = [
    'W A S D / arrows — move & drive',
    'SHIFT — run · SPACE — handbrake',
    'E — enter / exit car · F or CLICK — fight',
    'Mouse — aim the pistol · Q — swap weapon',
    'P — pause · M — mute',
  ];
  controls.forEach((line, i) => text(ctx, line, VIEW_W / 2, 408 + i * 25, 15.5, '#b9c4d0', 'center'));
  for (const [key, label] of [['newGame', 'NEW GAME'], ['continueGame', hasSave ? 'CONTINUE' : 'NO SAVE YET']]) {
    const b = TITLE_BUTTONS[key];
    ctx.fillStyle = key === 'newGame' ? '#ffc93c' : 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 9);
    ctx.fill();
    text(ctx, label, b.x + b.w / 2, b.y + 34, 18, key === 'newGame' ? '#1c2129' : '#8b93a3', 'center', 'bold');
  }
  text(ctx, 'ENTER — new game · C — continue', VIEW_W / 2, 652, 14, '#8b93a3', 'center');
  text(ctx, `The Marina Garage, ${PLACES.garage.label} and Pier 9 are all on your map. Good luck out there.`, VIEW_W / 2, 700, 13, '#67707d', 'center');
}

/** Pause, bust, waste and the story's end: the four ways play stops. */
export function drawOverlay(ctx, state, screen) {
  if (screen === 'pause') {
    dim(ctx);
    bigTitle(ctx, 'PAUSED', 'The city holds its breath.', 300);
    text(ctx, 'P or ENTER — back to the streets · progress saves after every job', VIEW_W / 2, 400, 16, '#cfd8e3', 'center');
    return;
  }
  if (screen === 'busted') {
    dim(ctx, 'rgba(10, 16, 34, 0.66)');
    bigTitle(ctx, 'BUSTED', '', 300);
    text(ctx, `Solmar PD takes $${state.lastPenalty} and your morning.`, VIEW_W / 2, 356, 18, '#ffffff', 'center');
    text(ctx, 'ENTER — back on the street', VIEW_W / 2, 404, 15, '#b9c4d0', 'center');
    return;
  }
  if (screen === 'wasted') {
    dim(ctx, 'rgba(34, 8, 8, 0.66)');
    bigTitle(ctx, 'WASTED', '', 300);
    text(ctx, `Solmar General patches Reyes up for $${state.lastPenalty}.`, VIEW_W / 2, 356, 18, '#ffffff', 'center');
    text(ctx, 'ENTER — leave the hospital', VIEW_W / 2, 404, 15, '#b9c4d0', 'center');
    return;
  }
  if (screen === 'story') {
    dim(ctx, 'rgba(20, 16, 4, 0.6)');
    bigTitle(ctx, 'SOLMAR IS YOURS', 'All six jobs done. The van, the money, the legend.');
    text(ctx, `Cash earned and kept: $${state.cash.toLocaleString('en-US')}`, VIEW_W / 2, 330, 20, COLORS.cash, 'center', 'bold');
    text(ctx, 'The city is still out there — traffic, cops and all. Free roam is yours.', VIEW_W / 2, 372, 16, '#e8edf3', 'center');
    text(ctx, 'ENTER — keep driving', VIEW_W / 2, 420, 15, '#b9c4d0', 'center');
  }
}
