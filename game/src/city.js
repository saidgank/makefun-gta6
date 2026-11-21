// Solmar Heat — the city of Solmar: a road grid over a coastal shelf, with downtown
// towers, beachfront hotels, suburbs, docks, an airstrip and one green park. buildCity
// lays the buildings, palms and parking spots; the helpers answer the questions the
// rest of the game asks every step: is this spot solid, is it water, is it road.
import {
  H_ROADS, PLACES, ROAD_HALF, SAND_Y, SEA_Y, V_ROADS, WORLD_H, WORLD_W,
} from './config.js';

/** Paint for generated buildings, per district. */
const TOWER_PAINT = ['#d9c8a9', '#c7d3dd', '#e5b8a2', '#b8c9b0', '#d5d8e6', '#eed9b7'];
const HOTEL_PAINT = ['#fdf3d8', '#ffe3ec', '#d8f3ee', '#fff1c9'];
const HOUSE_PAINT = ['#f6e3c5', '#e8f0d8', '#f9dcc4', '#dcebf5', '#f5e0e6'];
const SHED_PAINT = ['#8d99ae', '#a26769', '#6d8ea0', '#94785d'];

/** Buildings placed by hand, with the label the renderer paints on the roof. */
const SPECIALS = [
  { x: 1180, y: 640, w: 120, h: 74, storeys: 2, color: '#f2c14e', label: 'CAFÉ SOL' },
  { x: 1036, y: 1150, w: 168, h: 100, storeys: 6, color: '#7d8aa0', label: 'POLICE HQ' },
  { x: 1230, y: 1090, w: 130, h: 84, storeys: 8, color: '#c7d3dd', label: 'VENN LOGISTICS' },
  { x: 150, y: 1640, w: 190, h: 104, storeys: 2, color: '#94785d', label: 'MARINA GARAGE' },
  { x: 1660, y: 1800, w: 220, h: 96, storeys: 7, color: '#fdf3d8', label: 'MARINA GRAND' },
  { x: 2790, y: 590, w: 200, h: 104, storeys: 4, color: '#eef2f5', label: 'HOSPITAL' },
  { x: 2930, y: 180, w: 250, h: 120, storeys: 2, color: '#a8b0ba', label: 'HANGAR 1' },
  { x: 90, y: 2050, w: 220, h: 90, storeys: 2, color: '#6d8ea0', label: 'PIER 9 WAREHOUSE' },
];

/** The park block: between the 1540 and 2100 roads across, the 980 and 1540 down. */
export const PARK = { x: 1614, y: 1054, w: 412, h: 412 };
/** The park's pond: decorative water that blocks movement like the sea does. */
export const POND = { x: 1740, y: 1190, w: 180, h: 120 };
/** The docks inlet, a bite of sea into the west edge. */
export const INLET = { x: 0, y: 1560, w: 128, h: 560 };

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

/** Which district a point belongs to; drives building style and ground tint. */
export function districtAt(x, y) {
  if (y >= SAND_Y) return 'beach';
  if (x <= 430 && y >= 1400) return 'docks';
  if (x >= 2660 && y <= 1000) return 'airport';
  if (x >= 900 && x <= 2180 && y >= 300 && y <= 1660) return 'downtown';
  if (y >= 1540) return 'beachfront';
  return 'suburbs';
}

/** Lay out the whole city. Deterministic for a given rng stream. */
export function buildCity(rng) {
  const buildings = SPECIALS.map((s) => ({ ...s, kind: 'special' }));
  const palms = [];
  const trees = [];
  const parkedSpots = [];

  // Blocks are the cells between neighbouring road centre lines, inset past the kerb.
  const xBounds = [0, ...V_ROADS, WORLD_W];
  const yBounds = [0, ...H_ROADS, WORLD_H];
  for (let i = 0; i < xBounds.length - 1; i += 1) {
    for (let j = 0; j < yBounds.length - 1; j += 1) {
      const bx = xBounds[i] + (i === 0 ? 26 : ROAD_HALF + 14);
      const by = yBounds[j] + (j === 0 ? 26 : ROAD_HALF + 14);
      const bw = xBounds[i + 1] - (i === xBounds.length - 2 ? 26 : ROAD_HALF + 14) - bx;
      const bh = yBounds[j + 1] - (j === yBounds.length - 2 ? 26 : ROAD_HALF + 14) - by;
      if (bw < 120 || bh < 90) continue;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const district = districtAt(cx, cy);
      const isPark = cx > PARK.x && cx < PARK.x + PARK.w && cy > PARK.y && cy < PARK.y + PARK.h;
      if (isPark || district === 'beach' || district === 'airport') {
        if (isPark) {
          for (let p = 0; p < 7; p += 1) palms.push({ x: bx + rng.range(30, bw - 30), y: by + rng.range(30, bh - 30), s: rng.range(0.8, 1.25) });
        }
        continue;
      }
      // One to four buildings a block, on a loose grid inside it.
      const cols = rng.int(1, 2);
      const rows = rng.int(1, 2);
      for (let gx = 0; gx < cols; gx += 1) {
        for (let gy = 0; gy < rows; gy += 1) {
          const w = (bw / cols) * rng.range(0.52, 0.78);
          const h = (bh / rows) * rng.range(0.52, 0.78);
          const rect = {
            x: bx + (bw / cols) * gx + (bw / cols - w) / 2,
            y: by + (bh / rows) * gy + (bh / rows - h) / 2,
            w, h,
          };
          if (SPECIALS.some((s) => rectsOverlap(rect, s, 20))) continue;
          let paint = HOUSE_PAINT;
          let storeys = rng.int(1, 3);
          let kind = 'house';
          if (district === 'downtown') { paint = TOWER_PAINT; storeys = rng.int(6, 16); kind = 'tower'; }
          else if (district === 'beachfront') { paint = HOTEL_PAINT; storeys = rng.int(4, 9); kind = 'hotel'; }
          else if (district === 'docks') { paint = SHED_PAINT; storeys = 1; kind = 'shed'; }
          buildings.push({ ...rect, storeys, color: rng.pick(paint), kind });
        }
      }
      if (district === 'suburbs') {
        for (let t = 0; t < 3; t += 1) trees.push({ x: bx + rng.range(14, bw - 14), y: by + rng.range(14, bh - 14), r: rng.range(11, 19) });
      }
      // Parallel parking along the block's south and east kerbs.
      const spots = rng.int(0, 3);
      for (let s = 0; s < spots; s += 1) {
        parkedSpots.push({ x: bx + 40 + s * 62 + rng.range(-6, 6), y: by + bh + 26, angle: 0 });
      }
      if (rng.chance(0.6)) parkedSpots.push({ x: bx + bw + 26, y: by + rng.range(50, bh - 50), angle: Math.PI / 2 });
    }
  }

  // Palms marching along the promenade and sprinkled on the sand.
  for (let x = 90; x < WORLD_W - 60; x += rng.range(80, 130)) {
    palms.push({ x, y: SAND_Y - 26 + rng.range(-6, 6), s: rng.range(0.9, 1.4) });
  }
  for (let p = 0; p < 26; p += 1) {
    palms.push({ x: rng.range(60, WORLD_W - 60), y: rng.range(SAND_Y + 16, SEA_Y - 30), s: rng.range(0.8, 1.3) });
  }

  const waterRects = [
    { x: 0, y: SEA_Y, w: WORLD_W, h: WORLD_H - SEA_Y },
    { ...INLET },
    { ...POND },
  ];
  return { buildings, palms, trees, parkedSpots, waterRects, places: PLACES };
}

/** True when a circle overlaps any building. Brute force: the city is small. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/** True when a point sits in the sea, the inlet or the pond. */
export function inWater(city, x, y) {
  for (const w of city.waterRects) {
    if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
  }
  return false;
}

/** True when a circle would touch water. */
export function hitsWater(city, x, y, r) {
  for (const w of city.waterRects) {
    const nx = Math.max(w.x, Math.min(x, w.x + w.w));
    const ny = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** What a wheel or a foot stands on: road, sand, grass (the park) or pavement. */
export function surfaceAt(city, x, y) {
  if (inWater(city, x, y)) return 'water';
  if (y >= SAND_Y) return 'sand';
  if (x > PARK.x && x < PARK.x + PARK.w && y > PARK.y && y < PARK.y + PARK.h) return 'grass';
  for (const cx of V_ROADS) if (Math.abs(x - cx) <= ROAD_HALF) return 'road';
  for (const cy of H_ROADS) if (Math.abs(y - cy) <= ROAD_HALF) return 'road';
  return 'pavement';
}

/** The nearest point on any road centre line; police and traffic think in these. */
export function nearestRoadPoint(x, y) {
  let best = null;
  for (const cx of V_ROADS) {
    const d = Math.abs(x - cx);
    if (best === null || d < best.d) best = { x: cx, y, d, axis: 'v', c: cx };
  }
  for (const cy of H_ROADS) {
    const d = Math.abs(y - cy);
    if (d < best.d) best = { x, y: cy, d, axis: 'h', c: cy };
  }
  return best;
}
