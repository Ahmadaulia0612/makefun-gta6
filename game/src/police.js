// The wanted system and the police who answer it. Stars rise with crimes
// and fall when the player stays clean and unseen; police cars chase and ram,
// foot cops chase on foot and can bust the player, and at three stars and up
// the police shoot back.
import { POLICE, WANTED } from './config.js';
import { spawnBullet } from './combat.js';
import { addMessage } from './state.js';
import { nearestRoad, randomRoadPoint, resolveCircle } from './world.js';

export function addWanted(state, stars, reason) {
  if (stars <= 0) return;
  const before = state.wanted;
  state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
  state.wantedTimer = 0;
  if (state.wanted > before) addMessage(state, reason || `Wanted level ${state.wanted}`);
}

export function updateWanted(state, dt) {
  if (state.wanted === 0) return;
  state.wantedTimer += dt;
  if (state.wantedTimer < WANTED.decaySeconds) return;
  // A star fades only when no cop is close enough to see the player.
  const nearCop = state.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 520)
    || state.footCops.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 420);
  if (!nearCop) {
    state.wanted -= 1;
    state.wantedTimer = 0;
    if (state.wanted === 0) addMessage(state, 'You lost the cops. Stay clean.');
  } else {
    state.wantedTimer = WANTED.decaySeconds - 6;
  }
}

function policeSpawnPoint(state) {
  for (let tries = 0; tries < 12; tries += 1) {
    const p = randomRoadPoint(state.random, state.city);
    const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
    if (d > 480 && d < 1100) return p;
  }
  return { x: state.player.x + 600, y: state.player.y };
}

function ensurePolice(state) {
  const wantCars = Math.min(POLICE.maxCars, state.wanted);
  const haveCars = state.cars.filter((c) => c.kind === 'police' && !c.exploded).length;
  for (let i = haveCars; i < wantCars; i += 1) {
    const p = policeSpawnPoint(state);
    const road = nearestRoad(state.city, p.x, p.y);
    const car = {
      id: state.nextCarId, x: p.x, y: p.y, angle: 0, speed: 0,
      color: '#f5f5f5', kind: 'police', health: 120,
      axis: road.axis, dir: 1, lane: 0, targetSpeed: 430,
      turnCooldown: 0, stuckTimer: 0, smokeTimer: 0, shootCooldown: 1,
    };
    state.nextCarId += 1;
    state.cars.push(car);
  }
  const wantFoot = state.wanted >= 2 ? Math.min(POLICE.maxFoot, state.wanted * 2) : 0;
  for (let i = state.footCops.length; i < wantFoot; i += 1) {
    const p = policeSpawnPoint(state);
    state.footCops.push({
      x: p.x, y: p.y, angle: 0, speed: 300, color: '#1e3a8a',
      shootCooldown: 1.5, stuckTimer: 0,
    });
  }
  if (state.wanted === 0) {
    // Stand down: police cars cruise off, foot cops leave.
    state.cars = state.cars.filter((c) => c.kind !== 'police' || Math.hypot(c.x - state.player.x, c.y - state.player.y) < 900);
    state.footCops.length = 0;
    state.player.bustedTimer = 0;
  }
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export function updatePolice(state, dt) {
  ensurePolice(state);
  if (state.wanted === 0) return;
  const player = state.player;
  const px = player.x;
  const py = player.y;

  for (const car of state.cars) {
    if (car.kind !== 'police' || car.exploded) continue;
    const d = Math.hypot(px - car.x, py - car.y);
    const desired = Math.atan2(py - car.y, px - car.x);
    car.angle = angleLerp(car.angle, desired, dt * 2.4);
    const wantSpeed = Math.min(640, 420 + state.wanted * 32);
    car.speed += Math.max(-700 * dt, Math.min(500 * dt, wantSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hit = resolveCircle(state.city, car, 26);
    if (hit) car.speed *= 0.6;
    // Ramming the player's car: 12 damage per second of contact.
    if (player.car && d < 62) {
      const push = 62 - d;
      const nx = (player.car.x - car.x) / (d || 1);
      const ny = (player.car.y - car.y) / (d || 1);
      player.car.x += nx * push * 0.7;
      player.car.y += ny * push * 0.7;
      player.car.speed *= 0.92;
      player.car.health -= POLICE.ramDamage * dt;
      if (state.random() < 0.2) state.events.push({ type: 'crash', x: car.x, y: car.y });
      state.camera.shake = Math.max(state.camera.shake, 4);
    }
    // Shooting at three stars and up.
    if (state.wanted >= POLICE.shootStars && d < 430 && d > 90) {
      car.shootCooldown -= dt;
      if (car.shootCooldown <= 0) {
        car.shootCooldown = 1.1 + state.random() * 0.7;
        const aim = Math.atan2(py - car.y, px - car.x) + (state.random() - 0.5) * 0.35;
        spawnBullet(state, car.x, car.y, aim, 620, false, 7);
        state.events.push({ type: 'enemyShot', x: car.x, y: car.y });
      }
    }
  }

  for (const cop of state.footCops) {
    const d = Math.hypot(px - cop.x, py - cop.y);
    const desired = Math.atan2(py - cop.y, px - cop.x);
    cop.angle = angleLerp(cop.angle, desired, dt * 5);
    const speed = player.onFoot ? 295 : 180;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    resolveCircle(state.city, cop, 12);
    if (player.onFoot && d < 40) {
      player.bustedTimer += dt;
      if (player.bustedTimer > 0.4) addMessage(state, 'The cops are grabbing you — run!');
    } else {
      player.bustedTimer = Math.max(0, player.bustedTimer - dt * 2);
    }
    if (state.wanted >= POLICE.shootStars && player.onFoot && d < 380 && d > 60) {
      cop.shootCooldown -= dt;
      if (cop.shootCooldown <= 0) {
        cop.shootCooldown = 1.6 + state.random();
        const aim = Math.atan2(py - cop.y, px - cop.x) + (state.random() - 0.5) * 0.4;
        spawnBullet(state, cop.x, cop.y, aim, 580, false, 6);
        state.events.push({ type: 'enemyShot', x: cop.x, y: cop.y });
      }
    }
  }
}
