// Traffic cars, parked cars, pedestrians, and the player's driving physics.
// Traffic follows the road grid: each car runs along one road and sometimes
// turns at an intersection. Pedestrians walk the sidewalks and flee gunfire
// and speeding cars.
import { CAR, CAR_COLORS, PED_COLORS } from './config.js';
import { pick, range } from './random.js';
import { nearestRoad, randomRoadPoint, resolveCircle } from './world.js';

function makeCar(state, x, y, angle, kind, color) {
  return {
    id: state.nextCarId,
    x, y, angle, speed: 0,
    color: color || pick(state.random, CAR_COLORS),
    kind, health: CAR.health,
    axis: 'x', dir: 1, lane: 14, road: 200, targetSpeed: 150,
    turnCooldown: 2, stuckTimer: 0, smokeTimer: 0,
  };
}

export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(state.random, state.city);
    const road = nearestRoad(state.city, p.x, p.y);
    const car = makeCar(state, p.x, p.y, 0, 'traffic');
    state.nextCarId += 1;
    if (road.axis === 'x') {
      car.axis = 'x';
      car.road = road.value;
      car.lane = state.random() < 0.5 ? -14 : 14;
      car.x = road.value + car.lane;
      car.dir = state.random() < 0.5 ? 1 : -1;
      car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'y';
      car.road = road.value;
      car.lane = state.random() < 0.5 ? -14 : 14;
      car.y = road.value + car.lane;
      car.dir = state.random() < 0.5 ? 1 : -1;
      car.angle = car.dir === 1 ? 0 : Math.PI;
    }
    car.targetSpeed = range(state.random, 120, 190);
    car.speed = car.targetSpeed;
    state.cars.push(car);
  }
}

export function spawnParkedCars(state, count) {
  const lotSlots = new Map();
  for (let i = 0; i < count; i += 1) {
    const lot = state.city.parkingLots[Math.floor(state.random() * state.city.parkingLots.length)];
    let x;
    let y;
    let angle;
    if (lot) {
      // Park in marked slots so cars never stack on top of each other.
      const n = lotSlots.get(lot) || 0;
      lotSlots.set(lot, n + 1);
      const col = n % 3;
      const row = Math.floor(n / 3) % 2;
      x = lot.x + 45 + col * ((lot.w - 90) / 2);
      y = lot.y + 45 + row * Math.max(40, lot.h - 90);
      angle = row === 0 ? 0 : Math.PI;
    } else {
      const p = randomRoadPoint(state.random, state.city);
      x = p.x;
      y = p.y;
      angle = 0;
    }
    const car = makeCar(state, x, y, angle, 'parked');
    state.nextCarId += 1;
    state.cars.push(car);
  }
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(state.random, state.city);
    const road = nearestRoad(state.city, p.x, p.y);
    const ped = {
      x: p.x, y: p.y, angle: state.random() * Math.PI * 2,
      speed: range(state.random, 40, 75),
      color: pick(state.random, PED_COLORS),
      mode: 'walk', fleeTimer: 0, downTimer: 0,
      axis: road.axis, roadValue: road.value, dir: state.random() < 0.5 ? 1 : -1,
      turnCooldown: range(state.random, 2, 6),
    };
    state.peds.push(ped);
  }
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

function carAhead(state, car, dist) {
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
    if (forward > 0 && forward < dist && Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy) < 34) return true;
  }
  return false;
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    // Parked, player and police cars are moved by their own logic.
    if (car.kind === 'parked' || car.kind === 'player' || car.kind === 'police') continue;
    car.turnCooldown -= dt;
    // At an intersection, sometimes turn onto the crossing road.
    const nearX = state.city.roadXs.find((rx) => Math.abs(car.x - rx) < 8);
    const nearY = state.city.roadYs.find((ry) => Math.abs(car.y - ry) < 8);
    if (car.turnCooldown <= 0 && ((car.axis === 'x' && nearY !== undefined) || (car.axis === 'y' && nearX !== undefined)) && state.random() < 0.35) {
      if (car.axis === 'x') {
        car.axis = 'y';
        car.road = nearY;
        car.lane = state.random() < 0.5 ? -14 : 14;
        car.dir = state.random() < 0.5 ? 1 : -1;
        car.angle = car.dir === 1 ? 0 : Math.PI;
      } else {
        car.axis = 'x';
        car.road = nearX;
        car.lane = state.random() < 0.5 ? -14 : 14;
        car.dir = state.random() < 0.5 ? 1 : -1;
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
      car.turnCooldown = 4;
    }
    const want = carAhead(state, car, 90) ? 0 : car.targetSpeed;
    car.speed += Math.max(-400 * dt, Math.min(260 * dt, want - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Stay in lane: bumps can shove a car sideways, but traffic never
    // drives through parks or buildings.
    if (car.axis === 'x') car.x = car.road + car.lane;
    else car.y = car.road + car.lane;
    // Reverse at the city edges instead of wrapping.
    if (car.axis === 'x' && car.y < 90) { car.y = 90; car.dir = 1; car.angle = Math.PI / 2; }
    if (car.axis === 'x' && car.y > 2410) { car.y = 2410; car.dir = -1; car.angle = -Math.PI / 2; }
    if (car.axis === 'y' && car.x < 90) { car.x = 90; car.dir = 1; car.angle = 0; }
    if (car.axis === 'y' && car.x > 2430) { car.x = 2430; car.dir = -1; car.angle = Math.PI; }
  }
  // Gentle separation so traffic does not stack on one spot.
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i];
      const b = state.cars[j];
      if (a.kind === 'parked' || b.kind === 'parked') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.1 && d < 52) {
        const push = (52 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

export function updatePeds(state, dt) {
  const threat = state.lastShotAt || null;
  for (const ped of state.peds) {
    if (ped.mode === 'down') {
      ped.downTimer -= dt;
      continue;
    }
    let fleeing = false;
    if (threat && state.time - threat.t < 2.5) {
      const d = Math.hypot(ped.x - threat.x, ped.y - threat.y);
      if (d < 420) fleeing = true;
    }
    const player = state.player;
    if (!player.onFoot && player.car) {
      const d = Math.hypot(ped.x - player.x, ped.y - player.y);
      if (d < 130 && Math.abs(player.car.speed) > 200) fleeing = true;
    }
    if (fleeing) {
      ped.mode = 'flee';
      ped.fleeTimer = 1.5;
    }
    if (ped.mode === 'flee') {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - (threat ? threat.y : player.y), ped.x - (threat ? threat.x : player.x));
      ped.angle = angleLerp(ped.angle, away, dt * 6);
      ped.x += Math.cos(ped.angle) * 170 * dt;
      ped.y += Math.sin(ped.angle) * 170 * dt;
      if (ped.fleeTimer <= 0) ped.mode = 'walk';
    } else {
      ped.turnCooldown -= dt;
      const nearX = state.city.roadXs.find((rx) => Math.abs(ped.x - rx) < 10);
      const nearY = state.city.roadYs.find((ry) => Math.abs(ped.y - ry) < 10);
      if (ped.turnCooldown <= 0 && ((ped.axis === 'x' && nearY !== undefined) || (ped.axis === 'y' && nearX !== undefined)) && state.random() < 0.3) {
        if (ped.axis === 'x') {
          ped.axis = 'y';
          ped.roadValue = nearY;
          ped.dir = state.random() < 0.5 ? 1 : -1;
        } else {
          ped.axis = 'x';
          ped.roadValue = nearX;
          ped.dir = state.random() < 0.5 ? 1 : -1;
        }
        ped.turnCooldown = 5;
      }
      if (ped.axis === 'x') {
        ped.y += ped.dir * ped.speed * dt;
        ped.x += (ped.roadValue + 62 - ped.x) * dt * 2;
        ped.angle = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.x += ped.dir * ped.speed * dt;
        ped.y += (ped.roadValue + 62 - ped.y) * dt * 2;
        ped.angle = ped.dir === 1 ? 0 : Math.PI;
      }
      if (ped.y < 90) { ped.y = 90; ped.dir = 1; }
      if (ped.y > 2410) { ped.y = 2410; ped.dir = -1; }
      if (ped.x < 90) { ped.x = 90; ped.dir = 1; }
      if (ped.x > 2430) { ped.x = 2430; ped.dir = -1; }
    }
    resolveCircle(state.city, ped, 12);
  }
  state.peds = state.peds.filter((ped) => ped.mode !== 'down' || ped.downTimer > 0);
}

/** Player driving physics: throttle -1..1, steer -1..1, handbrake bool. */
export function driveCar(state, car, throttle, steer, handbrake, dt) {
  const maxSpeed = CAR.maxSpeed * (car.health < 35 ? 0.6 : 1);
  if (throttle > 0) {
    car.speed += CAR.accel * throttle * dt;
  } else if (throttle < 0) {
    // Braking while moving forward, reversing once stopped.
    car.speed += (car.speed > 10 ? -CAR.brake : -CAR.accel * 0.55) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 220 * dt);
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
    if (Math.abs(car.speed) > 120 && state.random() < 0.6) {
      state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 2.5 });
    }
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(maxSpeed, car.speed));
  const steerAmount = steer * CAR.grip * dt * Math.min(1, Math.abs(car.speed) / 160 + 0.25) * Math.sign(car.speed || 1);
  car.angle += steerAmount * (handbrake ? 1.5 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const probe = { x: nx, y: ny };
  const hit = resolveCircle(state.city, probe, 26);
  if (hit && Math.abs(car.speed) > 120) {
    state.events.push({ type: 'crash', x: car.x, y: car.y });
    car.health -= Math.abs(car.speed) * 0.03;
    state.camera.shake = Math.min(10, Math.abs(car.speed) * 0.02);
    car.speed *= -0.25;
    for (let i = 0; i < 8; i += 1) {
      state.particles.push({ x: car.x, y: car.y, vx: (state.random() - 0.5) * 260, vy: (state.random() - 0.5) * 260, life: 0.5, color: '#ffd27a', size: 3 });
    }
  } else {
    car.x = probe.x;
    car.y = probe.y;
  }
  // Running over pedestrians.
  for (const ped of state.peds) {
    if (ped.mode === 'down') continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 34 && Math.abs(car.speed) > 60) {
      ped.mode = 'down';
      ped.downTimer = 6;
      state.stats.pedsHit += 1;
      state.events.push({ type: 'runover', x: ped.x, y: ped.y });
      car.speed *= 0.92;
    }
  }
  // Bumping traffic cars.
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked') continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d > 0.1 && d < 56) {
      const push = (56 - d) / 2;
      const nx2 = (other.x - car.x) / d;
      const ny2 = (other.y - car.y) / d;
      other.x += nx2 * push;
      other.y += ny2 * push;
      other.speed *= 0.7;
      if (Math.abs(car.speed) > 200) state.events.push({ type: 'crash', x: car.x, y: car.y });
      car.speed *= 0.94;
    }
  }
  if (car.health <= 0 && !car.exploded) {
    car.exploded = true;
    state.events.push({ type: 'explosion', x: car.x, y: car.y });
    state.camera.shake = 14;
    for (let i = 0; i < 26; i += 1) {
      state.particles.push({
        x: car.x, y: car.y,
        vx: (state.random() - 0.5) * 420, vy: (state.random() - 0.5) * 420,
        life: 0.9, color: i % 3 === 0 ? '#ff7a2a' : '#5a5a5a', size: 5,
      });
    }
    car.speed = 0;
  }
  if (car.health < 40 && car.health > 0) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      state.particles.push({ x: car.x, y: car.y - 10, vx: 0, vy: -40, life: 1.1, color: '#888888', size: 6 });
    }
  }
  return car;
}
