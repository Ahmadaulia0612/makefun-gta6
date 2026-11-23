// Combat: shooting, punching, rival gang members, pickups and explosions.
// Bullets are simple fast circles; hits are checked against buildings,
// enemies, cars, pedestrians and the player.
import { PLAYER, WANTED } from './config.js';
import { addMessage } from './state.js';
import { addWanted } from './police.js';
import { pointInBuilding } from './world.js';

export function spawnBullet(state, x, y, angle, speed, fromPlayer, damage) {
  state.bullets.push({
    x, y, angle, speed,
    fromPlayer, damage,
    life: 1.4,
  });
}

export function playerShoot(state, tx, ty) {
  const player = state.player;
  if (player.shootCooldown > 0) return false;
  if (player.weapon !== 'pistol') return false;
  if (player.ammo <= 0) {
    addMessage(state, 'Out of ammo — find ammo pickups (green boxes).');
    player.shootCooldown = 0.35;
    return false;
  }
  player.ammo -= 1;
  player.shootCooldown = 0.22;
  const angle = Math.atan2(ty - player.y, tx - player.x);
  spawnBullet(state, player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, angle, 900, true, 34);
  state.lastShotAt = { x: player.x, y: player.y, t: state.time };
  state.events.push({ type: 'shot', x: player.x, y: player.y });
  state.camera.shake = Math.max(state.camera.shake, 1.5);
  return true;
}

export function playerPunch(state) {
  const player = state.player;
  if (player.punchCooldown > 0) return false;
  player.punchCooldown = 0.45;
  state.events.push({ type: 'punch', x: player.x, y: player.y });
  const range = PLAYER.punchRange;
  let hitSomething = false;
  const tryHit = (x, y, radius) => {
    const dx = x - player.x;
    const dy = y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > range + radius) return false;
    const ang = Math.atan2(dy, dx);
    let diff = ang - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < PLAYER.punchArc;
  };
  for (const enemy of state.enemies) {
    if (enemy.health > 0 && tryHit(enemy.x, enemy.y, 14)) {
      enemy.health -= PLAYER.punchDamage;
      hitSomething = true;
    }
  }
  for (const cop of state.footCops) {
    if (tryHit(cop.x, cop.y, 12)) {
      addWanted(state, WANTED.killCop, 'You hit a cop!');
      hitSomething = true;
    }
  }
  for (const ped of state.peds) {
    if (ped.mode !== 'down' && tryHit(ped.x, ped.y, 12)) {
      ped.mode = 'down';
      ped.downTimer = 6;
      addWanted(state, 1, 'You attacked a pedestrian!');
      hitSomething = true;
    }
  }
  return hitSomething;
}

export function spawnEnemies(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    state.enemies.push({
      x: x + (state.random() - 0.5) * 160,
      y: y + (state.random() - 0.5) * 160,
      angle: 0, health: 100, speed: 210,
      color: '#8a2020', shootCooldown: 1 + state.random(),
      strafeDir: state.random() < 0.5 ? 1 : -1, strafeTimer: 2,
    });
  }
}

export function updateEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (enemy.health <= 0) continue;
    const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const desired = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    let diff = desired - enemy.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    enemy.angle += diff * Math.min(1, dt * 5);
    enemy.strafeTimer -= dt;
    if (enemy.strafeTimer <= 0) {
      enemy.strafeTimer = 1.5 + state.random();
      enemy.strafeDir *= -1;
    }
    if (d > 300) {
      enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
    } else if (d < 150) {
      enemy.x -= Math.cos(enemy.angle) * enemy.speed * 0.6 * dt;
      enemy.y -= Math.sin(enemy.angle) * enemy.speed * 0.6 * dt;
    } else {
      enemy.x += Math.cos(enemy.angle + Math.PI / 2) * enemy.strafeDir * 90 * dt;
      enemy.y += Math.sin(enemy.angle + Math.PI / 2) * enemy.strafeDir * 90 * dt;
    }
    if (d < 520) {
      enemy.shootCooldown -= dt;
      if (enemy.shootCooldown <= 0) {
        enemy.shootCooldown = 1.2 + state.random() * 0.8;
        const aim = Math.atan2(player.y - enemy.y, player.x - enemy.x) + (state.random() - 0.5) * 0.3;
        spawnBullet(state, enemy.x, enemy.y, aim, 600, false, 8);
        state.events.push({ type: 'enemyShot', x: enemy.x, y: enemy.y });
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.health > 0);
}

export function spawnPickup(state, kind, x, y, amount) {
  state.pickups.push({ kind, x, y, amount: amount || 0, bob: state.random() * Math.PI * 2 });
}

export function updatePickups(state, dt) {
  const player = state.player;
  for (const pickup of state.pickups) pickup.bob += dt * 3;
  state.pickups = state.pickups.filter((pickup) => {
    const d = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    if (d > 44) return true;
    if (pickup.kind === 'health') {
      if (player.health >= player.maxHealth) return true;
      player.health = Math.min(player.maxHealth, player.health + 35);
      addMessage(state, 'Health +35');
    } else if (pickup.kind === 'ammo') {
      player.ammo += 24;
      if (player.weapon === 'fists') player.weapon = 'pistol';
      addMessage(state, 'Ammo +24 — pistol ready (click to shoot)');
    } else if (pickup.kind === 'cash') {
      player.cash += pickup.amount;
      state.stats.cashEarned += pickup.amount;
      addMessage(state, `+$${pickup.amount}`);
      state.events.push({ type: 'cash', x: pickup.x, y: pickup.y });
      return false;
    }
    state.events.push({ type: 'pickup', x: pickup.x, y: pickup.y });
    return false;
  });
}

export function applyExplosion(state, x, y) {
  const radius = 150;
  const hurt = (tx, ty) => Math.hypot(tx - x, ty - y) < radius;
  if (hurt(state.player.x, state.player.y)) {
    state.player.health -= 45;
    state.camera.shake = 12;
  }
  for (const enemy of state.enemies) {
    if (hurt(enemy.x, enemy.y)) enemy.health -= 90;
  }
  for (const car of state.cars) {
    if (hurt(car.x, car.y) && car.kind !== 'player') car.health -= 60;
  }
  state.enemies = state.enemies.filter((e) => e.health > 0);
}

export function updateBullets(state, dt) {
  const player = state.player;
  state.bullets = state.bullets.filter((b) => {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0) return false;
    if (pointInBuilding(state.city, b.x, b.y)) {
      state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, color: '#ffd27a', size: 3 });
      return false;
    }
    if (b.fromPlayer) {
      for (const enemy of state.enemies) {
        if (enemy.health > 0 && Math.hypot(enemy.x - b.x, enemy.y - b.y) < 16) {
          enemy.health -= b.damage;
          state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, color: '#ff5a4e', size: 4 });
          if (enemy.health <= 0) {
            state.stats.kills += 1;
            state.mission.kills += 1;
            spawnPickup(state, 'cash', enemy.x, enemy.y, 60);
          }
          return false;
        }
      }
      for (const cop of state.footCops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
          addWanted(state, WANTED.killCop, 'You shot a cop!');
          state.footCops = state.footCops.filter((c) => c !== cop);
          return false;
        }
      }
      for (const ped of state.peds) {
        if (ped.mode !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.mode = 'down';
          ped.downTimer = 6;
          addWanted(state, WANTED.runOverPed, 'You shot a pedestrian!');
          return false;
        }
      }
      for (const car of state.cars) {
        if (car.kind !== 'player' && Math.hypot(car.x - b.x, car.y - b.y) < 34) {
          car.health -= b.damage;
          if (car.kind === 'police') addWanted(state, 1, 'You shot a police car!');
          return false;
        }
      }
    } else {
      const target = player.onFoot
        ? Math.hypot(player.x - b.x, player.y - b.y) < 16
        : player.car && Math.hypot(player.car.x - b.x, player.car.y - b.y) < 34;
      if (target) {
        if (player.onFoot) {
          if (player.invulnerable <= 0) {
            player.health -= b.damage;
            player.invulnerable = 0.5;
            state.camera.shake = Math.max(state.camera.shake, 3);
          }
        } else if (player.car) {
          player.car.health -= b.damage * 0.5;
        }
        return false;
      }
    }
    return true;
  });
}
