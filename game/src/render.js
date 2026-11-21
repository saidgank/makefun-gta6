// Solmar Heat — drawing the world: ground, roads, water, buildings with their
// shadows, palms, cars, people and the weather of effects (skids, tracers, smoke,
// sparks) that the simulation leaves behind. Everything is canvas shapes in a
// sun-soaked palette; the camera transform is set by main.js before this is called.
import {
  COLORS, H_ROADS, ROAD_HALF, SAND_Y, SEA_Y, V_ROADS, WORLD_H, WORLD_W,
} from './config.js';
import { INLET, PARK, POND } from './city.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A deterministic hash from a position, for window patterns that never flicker. */
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawGround(ctx, state, view) {
  const { city } = state;
  ctx.fillStyle = COLORS.sidewalk;
  ctx.fillRect(view.x, view.y, view.w, view.h);

  // The park's grass and the airport's concrete apron.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(PARK.x - 14, PARK.y - 14, PARK.w + 28, PARK.h + 28);
  ctx.fillStyle = COLORS.grassDark;
  ctx.fillRect(PARK.x + 30, PARK.y + 30, PARK.w - 60, 60);
  ctx.fillStyle = '#c9ccd1';
  ctx.fillRect(2696, 36, 628, 900);

  // Sand and sea, with a foam edge that breathes.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, SAND_Y, WORLD_W, SEA_Y - SAND_Y);
  const seaGrad = ctx.createLinearGradient(0, SEA_Y, 0, WORLD_H);
  seaGrad.addColorStop(0, COLORS.seaShallow);
  seaGrad.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, SEA_Y, WORLD_W, WORLD_H - SEA_Y);
  ctx.fillStyle = COLORS.seaFoam;
  const foamShift = Math.sin(state.time * 1.4) * 3;
  ctx.fillRect(0, SEA_Y - 3 + foamShift, WORLD_W, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i += 1) {
    const sx = hash(i, 7) * WORLD_W;
    const sy = SEA_Y + 14 + hash(i, 13) * 130 + Math.sin(state.time * 2 + i) * 3;
    if (sx > view.x - 20 && sx < view.x + view.w + 20 && sy > view.y - 10 && sy < view.y + view.h + 10) {
      ctx.fillRect(sx, sy, 16, 2);
    }
  }
  // The docks inlet and the park pond.
  ctx.fillStyle = COLORS.seaDeep;
  ctx.fillRect(INLET.x, INLET.y, INLET.w, INLET.h);
  ctx.fillRect(POND.x, POND.y, POND.w, POND.h);
  ctx.fillStyle = COLORS.seaShallow;
  ctx.fillRect(POND.x + 6, POND.y + 6, POND.w - 12, POND.h - 12);

  // Roads: asphalt strips, then dashes, then crosswalks at every crossing.
  ctx.fillStyle = COLORS.asphalt;
  for (const cx of V_ROADS) ctx.fillRect(cx - ROAD_HALF, 0, ROAD_HALF * 2, H_ROADS[H_ROADS.length - 1] + ROAD_HALF);
  for (const cy of H_ROADS) ctx.fillRect(0, cy - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  ctx.fillStyle = COLORS.laneDash;
  for (const cx of V_ROADS) {
    for (let y = 16; y < 2140; y += 48) {
      if (H_ROADS.some((cy) => Math.abs(y - cy) < 78)) continue;
      ctx.fillRect(cx - 2, y, 4, 24);
    }
  }
  for (const cy of H_ROADS) {
    for (let x = 16; x < WORLD_W - 20; x += 48) {
      if (V_ROADS.some((cx) => Math.abs(x - cx) < 78)) continue;
      ctx.fillRect(x, cy - 2, 24, 4);
    }
  }
  ctx.fillStyle = COLORS.crosswalk;
  for (const cx of V_ROADS) {
    for (const cy of H_ROADS) {
      for (let s = 0; s < 5; s += 1) {
        ctx.fillRect(cx - ROAD_HALF + 8, cy - 44 + s * 19, 14, 9);
        ctx.fillRect(cx + ROAD_HALF - 22, cy - 44 + s * 19, 14, 9);
        ctx.fillRect(cx - 44 + s * 19, cy - ROAD_HALF + 8, 9, 14);
        ctx.fillRect(cx - 44 + s * 19, cy + ROAD_HALF - 22, 9, 14);
      }
    }
  }

  // Shipping containers stacked by Pier 9.
  const containers = ['#c0392b', '#2471a3', '#229954', '#b7950b', '#7d3c98', '#ca6f1e', '#2e86c1', '#a93226'];
  for (let i = 0; i < containers.length; i += 1) {
    const x = 168 + (i % 4) * 64;
    const y = 1880 + Math.floor(i / 4) * 74;
    ctx.fillStyle = containers[i];
    ctx.fillRect(x, y, 54, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, y + 12, 54, 4);
  }

  // Palms and trees.
  for (const palm of city.palms) {
    if (!inView(view, palm.x, palm.y, 40)) continue;
    drawPalm(ctx, palm);
  }
  for (const tree of city.trees) {
    if (!inView(view, tree.x, tree.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(tree.x + 4, tree.y + 6, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3e7d44';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57a05e';
    ctx.beginPath();
    ctx.arc(tree.x - tree.r * 0.25, tree.y - tree.r * 0.25, tree.r * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
}

function inView(view, x, y, pad) {
  return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
}

function drawPalm(ctx, palm) {
  const { x, y, s } = palm;
  ctx.strokeStyle = '#2e7d32';
  ctx.lineWidth = 3.4 * s;
  ctx.lineCap = 'round';
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * Math.PI * 2 + x * 0.01;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s,
      x + Math.cos(a) * 17 * s, y + Math.sin(a) * 17 * s + 4 * s,
    );
    ctx.stroke();
  }
  ctx.fillStyle = '#6d4c41';
  ctx.beginPath();
  ctx.arc(x, y, 3.4 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuildings(ctx, state, view) {
  for (const b of state.city.buildings) {
    if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    const lift = Math.min(26, b.storeys * 2.1);
    ctx.fillStyle = 'rgba(20, 16, 8, 0.20)';
    ctx.fillRect(b.x + lift, b.y + lift * 1.25, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(74, 62, 44, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Roof furniture: an inset slab, and for towers a grid of lit windows.
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    if (b.storeys >= 4) {
      ctx.fillStyle = 'rgba(38, 50, 66, 0.35)';
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 24));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if (hash(b.x + i * 31, b.y + j * 47) > 0.42) continue;
          ctx.fillRect(b.x + 12 + i * ((b.w - 24) / Math.max(1, cols - 1)), b.y + 12 + j * ((b.h - 24) / Math.max(1, rows - 1)), 7, 5);
        }
      }
    }
    if (b.label) {
      ctx.fillStyle = 'rgba(24, 28, 36, 0.85)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }
  }
}

/** A car, any kind: body, glass, lights, damage smoke, and the law's light bar. */
export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 26, 15, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#14161a';
  ctx.fillRect(-16, -14, 10, 5);
  ctx.fillRect(-16, 9, 10, 5);
  ctx.fillRect(7, -14, 10, 5);
  ctx.fillRect(7, 9, 10, 5);
  // Body.
  rr(ctx, -23, -12, 46, 24, 7);
  ctx.fillStyle = car.health <= 0 ? '#3a3a3a' : car.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (car.kind === 'police') {
    ctx.fillStyle = COLORS.policeTrim ?? '#22262e';
    ctx.fillRect(-4, -12, 13, 24);
  }
  // Glasshouse.
  rr(ctx, -9, -9, 19, 18, 4);
  ctx.fillStyle = '#1d2a38';
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 210, 240, 0.5)';
  ctx.fillRect(6, -8, 4, 16);
  // Lights.
  ctx.fillStyle = '#fff6bf';
  ctx.fillRect(21, -9, 3, 5);
  ctx.fillRect(21, 4, 3, 5);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-24, -9, 3, 5);
  ctx.fillRect(-24, 4, 3, 5);
  if (car.kind === 'police') {
    const phase = Math.floor(time * 3.4) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#5e0f0c';
    ctx.fillRect(-5, -6, 6, 12);
    ctx.fillStyle = phase ? '#0f2f5e' : '#2f7bff';
    ctx.fillRect(1, -6, 6, 12);
  }
  if (car.kind === 'mission') {
    ctx.strokeStyle = `rgba(255, 201, 60, ${0.55 + Math.sin(time * 4) * 0.3})`;
    ctx.lineWidth = 2.5;
    rr(ctx, -25, -14, 50, 28, 8);
    ctx.stroke();
  }
  ctx.restore();
  // Damage smoke, drawn unrotated so it rises off the bonnet.
  if (car.health < 110 && car.health > 0) {
    const n = car.health < 50 ? 3 : 2;
    for (let i = 0; i < n; i += 1) {
      const t = (time * 1.7 + i * 0.37 + car.id) % 1;
      ctx.fillStyle = `rgba(60,60,60,${0.34 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(car.x + Math.cos(car.angle) * 16 + Math.sin(time * 2 + i * 2) * 3, car.y + Math.sin(car.angle) * 16 - t * 22, 4 + t * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (car.health <= 0) {
    ctx.fillStyle = 'rgba(30,30,30,0.5)';
    ctx.beginPath();
    ctx.arc(car.x, car.y - 8, 13, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A pedestrian: a shirt, a head, and a shadow; the fallen lie flat and fade. */
export function drawPed(ctx, ped) {
  if (ped.mode === 'down') {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, ped.down / 2));
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(14, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(ped.x + 2, ped.y + 4, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.mode === 'thug' ? '#5d1a1a' : ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 8.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 2.4, ped.y + Math.sin(ped.angle) * 2.4, 4.4, 0, Math.PI * 2);
  ctx.fill();
}

/** Reyes: orange shirt on foot, a fist or a pistol in hand; hidden inside his car. */
export function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 4, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#22262e';
    ctx.fillRect(6, -2, 15, 4.4);
  } else if (p.swing > 0) {
    ctx.strokeStyle = '#f1c27d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(17, 8);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.playerShirt;
  ctx.beginPath();
  ctx.arc(0, 0, 10.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(2.6, 0, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The gold pillar and pulsing ring that mark where the story wants Reyes. */
function drawObjectiveMarker(ctx, state, target) {
  if (!target) return;
  const pulse = 1 + Math.sin(state.time * 4.2) * 0.16;
  const grad = ctx.createLinearGradient(0, target.y - 190, 0, target.y);
  grad.addColorStop(0, 'rgba(255, 201, 60, 0)');
  grad.addColorStop(1, 'rgba(255, 201, 60, 0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(target.x - 13, target.y - 190, 26, 190);
  ctx.strokeStyle = COLORS.objective;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 24 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.objective;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
  ctx.fill();
}

/** Paint the whole world for one frame. The caller has set the camera transform. */
export function drawWorld(ctx, state, view, target) {
  drawGround(ctx, state, view);
  // Skid marks under everything that moves.
  ctx.fillStyle = 'rgba(20,20,22,0.4)';
  for (const s of state.skids) {
    ctx.globalAlpha = Math.min(0.4, s.life / 6);
    ctx.fillRect(s.x - 2.4, s.y - 2.4, 4.8, 4.8);
  }
  ctx.globalAlpha = 1;
  drawBuildings(ctx, state, view);
  drawObjectiveMarker(ctx, state, target);
  for (const car of state.cars) {
    if (inView(view, car.x, car.y, 70)) drawCar(ctx, car, state.time);
  }
  for (const ped of state.peds) {
    if (inView(view, ped.x, ped.y, 40)) drawPed(ctx, ped);
  }
  drawPlayer(ctx, state);
  // Tracers and particles on top.
  for (const t of state.tracers) {
    ctx.strokeStyle = `rgba(255, 233, 163, ${Math.max(0, t.life / 0.08)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x0, t.y0);
    ctx.lineTo(t.x1, t.y1);
    ctx.stroke();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Cash popups float up off the world.
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const pop of state.popups) {
    ctx.globalAlpha = Math.min(1, pop.t);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y - (1.6 - pop.t) * 34);
  }
  ctx.globalAlpha = 1;
}
