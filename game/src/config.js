// Solmar Heat — shared tuning constants: world size, the road grid, the palette and the
// gameplay numbers. Every other module reads its numbers from here so the whole game
// stays consistent, and one edit here rebalances everything at once.

/** World dimensions in pixels. The camera shows a window of VIEW_W x VIEW_H into it. */
export const WORLD_W = 3360;
export const WORLD_H = 2520;
export const VIEW_W = 1280;
export const VIEW_H = 800;

/** Centres of the vertical and horizontal roads; every road is ROAD_W wide. */
export const V_ROADS = [420, 980, 1540, 2100, 2660];
export const H_ROADS = [420, 980, 1540, 2100];
export const ROAD_W = 120;
export const ROAD_HALF = ROAD_W / 2;
/** Lane offset from a road's centre line; traffic keeps right. */
export const LANE_OFF = 30;

/** South edge geography: the promenade road, then sand, then the sea. */
export const SAND_Y = 2196;
export const SEA_Y = 2352;

/** The fixed simulation step, in seconds: 60 updates a second at any display rate. */
export const STEP = 1 / 60;

/** The wheelman on foot. */
export const PLAYER = {
  radius: 13,
  walkSpeed: 150,
  runSpeed: 256,
  maxHealth: 100,
  punchRange: 38,
  punchDamage: 34,
  punchCooldown: 0.34,
  gunDamage: 55,
  gunRange: 560,
  gunCooldown: 0.21,
  enterRange: 52,
};

/** Car handling, shared by the player's car, traffic and police with per-type tweaks. */
export const CAR = {
  length: 46,
  width: 24,
  radius: 17,
  maxSpeed: 356,
  maxReverse: 118,
  accel: 268,
  brake: 430,
  drag: 0.55,
  turnRate: 2.6,
  maxHealth: 240,
};

/** Wanted system: heat points buy stars in slices of HEAT_PER_STAR. */
export const HEAT_PER_STAR = 34;
export const MAX_STARS = 5;
/** Police cars hunting at each star level, indexed by stars 0..5. */
export const POLICE_BY_STARS = [0, 1, 2, 3, 4, 6];

/** Sun-soaked coastal palette. */
export const COLORS = {
  asphalt: '#3d4149',
  asphaltEdge: '#31353d',
  laneDash: '#e9c94a',
  crosswalk: '#d8d8d2',
  sidewalk: '#b7b1a4',
  sidewalkEdge: '#9d9689',
  grass: '#5da862',
  grassDark: '#4c9153',
  sand: '#eed493',
  seaShallow: '#4db3d9',
  seaDeep: '#2b7fb8',
  seaFoam: '#d9f4fb',
  playerShirt: '#ff7847',
  policeBody: '#f2f3f5',
  policeTrim: '#22262e',
  objective: '#ffc93c',
  cash: '#7be382',
  danger: '#ff5252',
  hudPanel: 'rgba(10, 14, 20, 0.55)',
  text: '#ffffff',
};

/** localStorage key the save game lives under. */
export const SAVE_KEY = 'solmar-heat-save-v1';

/** Named places in Solmar; city.js builds the world around these anchors. */
export const PLACES = {
  cafe: { x: 1246, y: 726, label: 'Café Sol' },
  garage: { x: 268, y: 1762, label: 'Marina Garage' },
  hotel: { x: 1762, y: 1906, label: 'Marina Grand Hotel' },
  office: { x: 1180, y: 1180, label: 'Venn Logistics Office' },
  docks: { x: 250, y: 1980, label: 'Pier 9, The Docks' },
  hangar: { x: 3052, y: 330, label: 'Solmar Air Hangar' },
  hospital: { x: 2900, y: 726, label: 'Solmar General Hospital' },
  policeStation: { x: 1120, y: 1120, label: 'Solmar Police HQ' },
};
