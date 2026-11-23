// Solmar Bay — every tuning number, colour and name in one place.
// A top-down open-world crime game: one city, on foot and by car.
export const WORLD = { size: 2600, roadWidth: 96, blockGap: 304 };
export const ROADS = [200, 504, 808, 1112, 1416, 1720, 2024, 2328];
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay.save.v1';

export const PLAYER = {
  radius: 14,
  walkSpeed: 250,
  runSpeed: 380,
  health: 100,
  punchDamage: 25,
  punchRange: 46,
  punchArc: 1.1,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 520,
  brake: 760,
  reverseMax: 150,
  maxSpeed: 560,
  grip: 3.2,
  health: 100,
};

export const WANTED = {
  decaySeconds: 26,
  maxStars: 5,
  steal: 1,
  shoot: 1,
  runOverPed: 1,
  killCop: 2,
  killRival: 0,
};

export const POLICE = { maxCars: 4, maxFoot: 6, ramDamage: 12, shootStars: 3 };

export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#74a158',
  sand: '#e8d29a',
  sea: '#2fa8c9',
  seaDeep: '#1e86b3',
  sidewalk: '#c9c2b4',
  road: '#3d414c',
  roadLine: '#e8c33a',
  curb: '#9d968a',
  buildingRoof: '#e8e0d0',
  text: '#f4f1e8',
  muted: '#cfd3da',
  gold: '#f2c94c',
  danger: '#e5534b',
  policeBlue: '#3b82f6',
  policeRed: '#ef4444',
  hudPanel: 'rgba(12, 16, 24, 0.72)',
};

export const BUILDING_COLORS = [
  '#e8b4a0', '#f2d5a0', '#a8c8e8', '#c5e0b8', '#e8a8c0',
  '#d8c8f0', '#f0e0c0', '#b8d8d0', '#e0a890', '#c8b8a0',
];
export const CAR_COLORS = [
  '#d23b3b', '#2f6fd0', '#e8a13a', '#3aa655', '#7a4fd0',
  '#e8e8e8', '#222831', '#d06a9a', '#3ab8c9', '#c9d13b',
];
export const PED_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#fd79a8', '#00cec9', '#6c5ce7',
];

export const CITY_NAME = 'Solmar Bay';
export const GAME_TITLE = 'SOLMAR BAY';
export const GAME_SUBTITLE = 'An open-world crime story — steal, drive, run, survive.';

export const LANDMARKS = [
  { name: 'City Hall', x: 808, y: 504 },
  { name: 'Marina', x: 2328, y: 2024 },
  { name: 'Grand Hotel', x: 1416, y: 808 },
  { name: 'Sunset Mall', x: 504, y: 1416 },
  { name: 'Bay Bank', x: 1112, y: 1112 },
  { name: 'Hideout', x: 504, y: 504 },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
