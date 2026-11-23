// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, busted, wasted and complete screens.
// ?seed=N fixes the city. ?shot=cover|drive|foot|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { PLAYER, STEP } from './config.js';
import { createState, addMessage, showBanner } from './state.js';
import { resolveCircle } from './world.js';
import { driveCar, spawnParkedCars, spawnPeds, spawnTraffic, updatePeds, updateTraffic } from './traffic.js';
import { addWanted, updatePolice, updateWanted } from './police.js';
import { applyExplosion, playerPunch, playerShoot, spawnPickup, updateBullets, updateEnemies, updatePickups } from './combat.js';
import { resetMissionToStart, startMission, updateMission } from './missions.js';
import { applySave, loadGame, saveGame } from './save.js';
import { ACTION_ATTACK, ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createState(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

spawnTraffic(state, 16);
spawnParkedCars(state, 9);
spawnPeds(state, 26);
// Two parked cars right by the Hideout spawn, so the first steal in
// Mission 1 is immediate instead of a hunt across the map.
for (const spot of [{ x: 648, y: 504, angle: 0 }, { x: 504, y: 696, angle: Math.PI / 2 }]) {
  state.cars.push({
    id: state.nextCarId, x: spot.x, y: spot.y, angle: spot.angle, speed: 0,
    color: '#d23b3b', kind: 'parked', health: 100,
    axis: 'x', dir: 1, lane: 0, targetSpeed: 150,
    turnCooldown: 0, stuckTimer: 0, smokeTimer: 0,
  });
  state.nextCarId += 1;
}
spawnPickup(state, 'health', 560, 620, 0);
spawnPickup(state, 'ammo', 460, 460, 0);

const savedData = loadGame();
state.saveExists = savedData !== null;

function screenToWorld(mx, my) {
  const size = renderer.cssSize();
  const cam = state.camera;
  return {
    x: (mx - size.w / 2) / cam.zoom + cam.x,
    y: (my - size.h / 2) / cam.zoom + cam.y,
  };
}

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.exploded) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterOrExitCar() {
  const player = state.player;
  if (player.onFoot) {
    const car = nearestCar(78);
    if (!car) {
      addMessage(state, 'No car close enough — walk up to one and press E.');
      return;
    }
    const witnessed = state.footCops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 380)
      || state.peds.some((p) => p.mode !== 'down' && Math.hypot(p.x - player.x, p.y - player.y) < 320);
    if (car.kind === 'traffic' || car.kind === 'parked') {
      state.stats.carsStolen += 1;
      if (witnessed) addWanted(state, 1, 'You stole a car!');
    } else if (car.kind === 'police') {
      addWanted(state, 2, 'You stole a police car!');
    }
    car.kind = 'player';
    player.car = car;
    player.onFoot = false;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    state.events.push({ type: 'pickup', x: car.x, y: car.y });
  } else if (player.car) {
    const car = player.car;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 44;
    player.y = car.y + Math.sin(side) * 44;
    resolveCircle(state.city, player, 14);
    player.angle = car.angle;
    player.onFoot = true;
    player.car = null;
    car.kind = 'parked';
    car.speed = 0;
  }
}

function drainEvents() {
  for (const event of state.events.splice(0)) {
    if (event.type === 'shot') audio.shoot();
    else if (event.type === 'enemyShot') audio.enemyShoot();
    else if (event.type === 'crash') audio.crash();
    else if (event.type === 'punch') audio.punch();
    else if (event.type === 'pickup') audio.pickup();
    else if (event.type === 'cash') audio.cash();
    else if (event.type === 'missionDone') audio.missionDone();
    else if (event.type === 'runover') {
      audio.crash();
      addWanted(state, 1, 'You ran someone over!');
    } else if (event.type === 'explosion') {
      audio.explosion();
      applyExplosion(state, event.x, event.y);
    }
  }
}

function updateCamera(dt) {
  const cam = state.camera;
  const player = state.player;
  const lead = player.car ? 0.35 : 0.12;
  const tx = player.x + Math.cos(player.angle) * (player.car ? player.car.speed * lead : 0);
  const ty = player.y + Math.sin(player.angle) * (player.car ? player.car.speed * lead : 0);
  const k = 1 - Math.exp(-6 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const targetZoom = player.onFoot ? 1 : 0.85;
  cam.zoom += (targetZoom - cam.zoom) * (1 - Math.exp(-3 * dt));
  cam.shake = Math.max(0, cam.shake - dt * 26);
}

function worldStep(inputState, input, dt) {
  const player = inputState.player;
  const st = inputState;
  st.time += dt;
  if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (st.bannerTimer > 0) st.bannerTimer -= dt;

  const actions = input.takeActions();
  if (actions & ACTION_ENTER_CAR) enterOrExitCar();

  const move = input.move();
  const mouse = input.mouse();
  const worldMouse = screenToWorld(mouse.x, mouse.y);
  const attacking = (actions & ACTION_ATTACK) !== 0 || mouse.down;

  if (player.onFoot) {
    const speed = input.runHeld() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (move.active) {
      player.x += move.x * speed * dt;
      player.y += move.y * speed * dt;
      player.angle = Math.atan2(move.y, move.x);
      player.moving = true;
    } else {
      player.moving = false;
    }
    resolveCircle(st.city, player, PLAYER.radius);
    if (attacking) {
      player.angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);
      if (player.weapon === 'pistol') playerShoot(st, worldMouse.x, worldMouse.y);
      else playerPunch(st);
    }
  } else if (player.car) {
    const throttle = -move.y;
    const steer = move.x;
    driveCar(st, player.car, throttle, steer, input.handbrakeHeld(), dt);
    player.x = player.car.x;
    player.y = player.car.y;
    player.angle = player.car.angle;
    if (player.car.exploded) {
      player.health -= 40;
      player.onFoot = true;
      player.car.kind = 'parked';
      player.car.speed = 0;
      player.car = null;
      player.x += 40;
      player.y += 40;
      resolveCircle(st.city, player, PLAYER.radius);
      addMessage(st, 'Your car blew up — get out of there!');
    }
  }

  updateMission(st, dt);
  updateTraffic(st, dt);
  updatePeds(st, dt);
  updateWanted(st, dt);
  updatePolice(st, dt);
  updateEnemies(st, dt);
  updateBullets(st, dt);
  updatePickups(st, dt);

  // Any car whose health hit zero blows up.
  for (const car of st.cars) {
    if (car.health <= 0 && !car.exploded) {
      car.exploded = true;
      car.speed = 0;
      st.events.push({ type: 'explosion', x: car.x, y: car.y });
      st.camera.shake = 12;
      for (let i = 0; i < 22; i += 1) {
        st.particles.push({
          x: car.x, y: car.y,
          vx: (st.random() - 0.5) * 420, vy: (st.random() - 0.5) * 420,
          life: 0.9, color: i % 3 === 0 ? '#ff7a2a' : '#5a5a5a', size: 5,
        });
      }
      if (car === player.car) {
        player.health -= 40;
        player.onFoot = true;
        player.car = null;
        player.x += 40;
        player.y += 40;
      }
    }
  }

  for (const p of st.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
  }
  st.particles = st.particles.filter((p) => p.life > 0);
  for (const s of st.skids) s.life -= dt;
  st.skids = st.skids.filter((s) => s.life > 0);

  drainEvents();
  updateCamera(dt);

  if (st.mode === 'play' && player.health <= 0) {
    st.mode = 'wasted';
    audio.busted();
    showBanner(st, 'WASTED', '');
  } else if (st.mode === 'play' && player.bustedTimer > 1.6) {
    st.mode = 'busted';
    audio.busted();
    showBanner(st, 'BUSTED', '');
  }
}

function respawn(kind) {
  const player = state.player;
  player.health = player.maxHealth;
  player.invulnerable = 2;
  player.bustedTimer = 0;
  player.onFoot = true;
  player.car = null;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.footCops.length = 0;
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  state.enemies.length = 0;
  state.bullets.length = 0;
  if (kind === 'busted') {
    player.cash = Math.round(player.cash * 0.85);
    player.x = 1112;
    player.y = 620;
    addMessage(state, 'Released from the precinct. Fines paid.');
  } else {
    player.x = 808;
    player.y = 2140;
    addMessage(state, 'You wake up at Bay General Hospital.');
  }
  player.angle = -Math.PI / 2;
  state.camera.x = player.x;
  state.camera.y = player.y;
  resetMissionToStart(state);
  state.mode = 'play';
  saveGame(state);
}

function startGame(fromSave) {
  audio.unlock();
  if (fromSave && savedData) {
    applySave(state, savedData);
    startMission(state, Math.min(savedData.missionIndex, 5));
    addMessage(state, 'Welcome back to Solmar Bay.');
  } else {
    startMission(state, 0);
  }
  state.mode = 'play';
  saveGame(state);
  status.textContent = 'Playing Solmar Bay. WASD to move, E to steal a car.';
}

function runShot(name) {
  state.mode = 'play';
  state.isShot = true;
  const scene = stageShot(name, state, worldStep, renderer.cssSize());
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let attractAngle = 0;

  function announce(message) {
    status.textContent = message;
  }

  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && event.code === 'KeyN') {
      startGame(false);
      screen = SCREEN_PLAY;
      announce('New game. Mission 1: First Wheels.');
    }
  });

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      state.muted = audio.toggleMute();
      addMessage(state, state.muted ? 'Sound muted (M to unmute).' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        startGame(state.saveExists);
        screen = SCREEN_PLAY;
        announce('Playing. Mission 1: First Wheels.');
      }
      return { play: 0, pause: false };
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        saveGame(state);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return { play: 0, pause: true };
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        if (screen === SCREEN_BUSTED) respawn('busted');
        else if (screen === SCREEN_WASTED) respawn('wasted');
        else state.mode = 'play';
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return { play: 0, pause: false };
    }
    return { play: actions, pause: false };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const handled = handleActions();
    if (screen === SCREEN_TITLE) {
      state.time += STEP;
      attractAngle += STEP * 0.06;
      state.camera.x = 1300 + Math.cos(attractAngle) * 520;
      state.camera.y = 1300 + Math.sin(attractAngle) * 520;
      state.camera.zoom = 0.8;
      updateTraffic(state, STEP);
      updatePeds(state, STEP);
      renderer.draw(state, SCREEN_TITLE);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      renderer.draw(state, SCREEN_PAUSED);
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_OVER) {
      renderer.draw(state, screen);
      return;
    }
    // Playing: fixed steps, actions consumed once per frame.
    let pending = handled.play;
    const stepInput = {
      move: () => input.move(),
      runHeld: () => input.runHeld(),
      handbrakeHeld: () => input.handbrakeHeld(),
      mouse: () => input.mouse(),
      takeActions: () => {
        const taken = pending;
        pending = 0;
        return taken;
      },
    };
    while (accumulator >= STEP) {
      worldStep(state, stepInput, STEP);
      accumulator -= STEP;
      if (state.mode === 'wasted') screen = SCREEN_WASTED;
      else if (state.mode === 'busted') screen = SCREEN_BUSTED;
      else if (state.mode === 'complete') screen = SCREEN_OVER;
      if (screen !== SCREEN_PLAY) break;
    }
    // Engine hum and siren follow the player.
    audio.engine(state.player.car ? Math.abs(state.player.car.speed) / 560 : 0, !!state.player.car);
    audio.siren(state.wanted > 0, STEP);
    saveTimer += STEP;
    if (saveTimer > 20) {
      saveTimer = 0;
      saveGame(state);
    }
    renderer.draw(state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
