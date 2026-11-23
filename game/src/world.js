// The city of Solmar Bay: a seeded grid of roads, blocks, buildings, parks,
// a beach and a marina. Pure data plus collision helpers — no drawing and no
// browser in here, so the same city builds identically for play and for the
// staged screenshots.
import { BUILDING_COLORS, LANDMARKS, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';

const HALF_ROAD = WORLD.roadWidth / 2;
export const BEACH_Y = 2440;
export const SEA_Y = 2520;
export const MARINA_X = 2480;

export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const palms = [];
  const parkingLots = [];
  const roadXs = ROADS.slice();
  const roadYs = ROADS.slice();

  for (let i = 0; i < roadXs.length - 1; i += 1) {
    for (let j = 0; j < roadYs.length - 1; j += 1) {
      const x0 = roadXs[i] + HALF_ROAD + 12;
      const x1 = roadXs[i + 1] - HALF_ROAD - 12;
      const y0 = roadYs[j] + HALF_ROAD + 12;
      const y1 = roadYs[j + 1] - HALF_ROAD - 12;
      if (y0 > BEACH_Y - 40) continue; // the south strip is beach, not blocks
      const roll = random();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: Math.floor(range(random, 4, 9)) });
        for (let t = 0; t < 5; t += 1) {
          palms.push({ x: range(random, x0 + 14, x1 - 14), y: range(random, y0 + 14, y1 - 14) });
        }
        continue;
      }
      if (roll < 0.22) {
        parkingLots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const split = random() < 0.45;
      const cols = split ? 2 : 1;
      const rows = split ? 2 : 1;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const bx = x0 + (c * (x1 - x0)) / cols + 6;
          const by = y0 + (r * (y1 - y0)) / rows + 6;
          const bw = (x1 - x0) / cols - 12;
          const bh = (y1 - y0) / rows - 12;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            color: pick(random, BUILDING_COLORS),
            height: Math.floor(range(random, 6, 20)),
            windows: random() < 0.8,
          });
        }
      }
    }
  }
  // Landmark buildings sit on their named blocks.
  for (const mark of LANDMARKS) {
    const b = buildings.find((item) => Math.abs(item.x + item.w / 2 - mark.x) < 200 && Math.abs(item.y + item.h / 2 - mark.y) < 200);
    if (b) b.name = mark.name;
  }
  // Palms along the beach and the marina promenade.
  for (let x = 120; x < WORLD.size - 120; x += 90) {
    palms.push({ x: x + range(random, -20, 20), y: BEACH_Y + 26 + range(random, 0, 30) });
  }
  for (let y = 200; y < BEACH_Y; y += 130) {
    if (random() < 0.6) palms.push({ x: MARINA_X - 40, y });
  }
  return { buildings, parks, palms, parkingLots, roadXs, roadYs };
}

export function isOnRoad(city, x, y) {
  for (const rx of city.roadXs) if (Math.abs(x - rx) <= HALF_ROAD) return true;
  for (const ry of city.roadYs) if (Math.abs(y - ry) <= HALF_ROAD) return true;
  return false;
}

export function nearestRoad(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadXs) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { axis: 'x', value: rx, dir: 1 }; }
  }
  for (const ry of city.roadYs) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { axis: 'y', value: ry, dir: 1 }; }
  }
  return best;
}

/** Push a circle out of every building and the sea; returns true if it hit anything. */
export function resolveCircle(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * radius;
      body.y = cy + (dy / d) * radius;
    } else {
      // Centre inside the building: push out along the smallest overlap.
      const left = body.x - b.x + radius;
      const right = b.x + b.w - body.x + radius;
      const top = body.y - b.y + radius;
      const bottom = b.y + b.h - body.y + radius;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - radius;
      else if (m === right) body.x = b.x + b.w + radius;
      else if (m === top) body.y = b.y - radius;
      else body.y = b.y + b.h + radius;
    }
  }
  if (body.y > SEA_Y - radius) { body.y = SEA_Y - radius; hit = true; }
  if (body.x > MARINA_X - radius && body.y > 200) { body.x = MARINA_X - radius; hit = true; }
  if (body.x < radius) { body.x = radius; hit = true; }
  if (body.y < radius) { body.y = radius; hit = true; }
  if (body.x > WORLD.size - radius) { body.x = WORLD.size - radius; hit = true; }
  if (body.y > WORLD.size - radius) { body.y = WORLD.size - radius; hit = true; }
  return hit;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(random, city) {
  if (random() < 0.5) {
    return { x: pick(random, city.roadXs) + range(random, -24, 24), y: range(random, 120, BEACH_Y - 120) };
  }
  return { x: range(random, 120, MARINA_X - 120), y: pick(random, city.roadYs) + range(random, -24, 24) };
}
