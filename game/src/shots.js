// Staged screenshot scenes behind ?shot=cover|drive|foot|mission (with
// &seed=N). Each one sets the real game up — a mission, a wanted level, a
// chase, a shootout — then plays the real rules forward with a scripted
// driver for a few seconds, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { ACTION_ATTACK } from './input.js';
import { setMissionStep, startMission } from './missions.js';

function makeFakeInput(getter) {
  return {
    move() {
      const g = getter();
      return { x: g.mx || 0, y: g.my || 0, active: !!(g.mx || g.my) };
    },
    runHeld() { return false; },
    handbrakeHeld() { return !!getter().handbrake; },
    mouse() {
      const g = getter();
      return { x: g.sx || 0, y: g.sy || 0, down: !!g.attack };
    },
    takeActions() {
      return getter().attack ? ACTION_ATTACK : 0;
    },
  };
}

function nearestEnemy(state) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function putPlayerInCar(state, car) {
  car.kind = 'player';
  car.health = Math.max(car.health, 80);
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

/** Drive toward a world point along the roads: keep to the current road and
 *  turn at intersections, so the car never wedges itself into a building. */
function roadSteer(state, tx, ty) {
  const car = state.player.car;
  if (!car) return { mx: 0, my: 0 };
  const city = state.city;
  let nearestX = city.roadXs[0];
  let dx = Infinity;
  for (const rx of city.roadXs) {
    const d = Math.abs(car.x - rx);
    if (d < dx) { dx = d; nearestX = rx; }
  }
  let nearestY = city.roadYs[0];
  let dy = Infinity;
  for (const ry of city.roadYs) {
    const d = Math.abs(car.y - ry);
    if (d < dy) { dy = d; nearestY = ry; }
  }
  const onVertical = dx < 34;
  const onHorizontal = dy < 34;
  let desired;
  if (onVertical && onHorizontal) {
    if (Math.abs(car.y - ty) < 40) desired = tx > car.x ? 0 : Math.PI;
    else if (Math.abs(car.x - tx) < 40) desired = ty > car.y ? Math.PI / 2 : -Math.PI / 2;
    else if (Math.abs(tx - car.x) > Math.abs(ty - car.y)) desired = tx > car.x ? 0 : Math.PI;
    else desired = ty > car.y ? Math.PI / 2 : -Math.PI / 2;
  } else if (onVertical) {
    desired = ty > car.y ? Math.PI / 2 : -Math.PI / 2;
  } else if (onHorizontal) {
    desired = tx > car.x ? 0 : Math.PI;
  } else {
    desired = Math.atan2(ty - car.y, tx - car.x);
  }
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { mx: Math.max(-1, Math.min(1, diff * 2.5)), my: -1 };
}

export function stageShot(name, state, stepWorld, cssSize) {
  const step = (input) => stepWorld(state, input, 1 / 60);
  const player = state.player;

  if (name === 'drive') {
    // Free-roam drive east along Bay Bank road, through downtown traffic.
    const car = state.cars.find((c) => c.kind === 'traffic') || state.cars[0];
    putPlayerInCar(state, car);
    car.x = 808; car.y = 1112; car.angle = 0;
    car.health = 100;
    player.x = car.x; player.y = car.y;
    state.camera.x = car.x; state.camera.y = car.y;
    const input = makeFakeInput(() => roadSteer(state, 2328, 1112));
    for (let i = 0; i < 60 * 6; i += 1) step(input);
    return { screen: 'play' };
  }

  if (name === 'foot') {
    // On foot at Sunset Mall, mission marker ahead, pedestrians around.
    startMission(state, 1);
    player.x = 504; player.y = 1560;
    player.angle = -Math.PI / 2;
    state.camera.x = player.x; state.camera.y = player.y;
    const input = makeFakeInput(() => {
      const dx = 504 - player.x;
      const dy = 1416 - player.y;
      const d = Math.hypot(dx, dy) || 1;
      return { mx: dx / d, my: dy / d };
    });
    for (let i = 0; i < 60 * 4; i += 1) step(input);
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // Turf War shootout: rivals in the alley, Rio armed and firing.
    startMission(state, 4);
    setMissionStep(state, 1);
    player.x = 1416; player.y = 1560;
    player.angle = -Math.PI / 2;
    state.camera.x = player.x; state.camera.y = player.y;
    player.weapon = 'pistol';
    player.ammo = 120;
    let tick = 0;
    const input = makeFakeInput(() => {
      tick += 1;
      const enemy = nearestEnemy(state);
      if (!enemy) return { mx: 0, my: 0 };
      const sx = (enemy.x - state.camera.x) * state.camera.zoom + cssSize.w / 2;
      const sy = (enemy.y - state.camera.y) * state.camera.zoom + cssSize.h / 2;
      return { mx: 0.2, my: 0, sx, sy, attack: tick % 3 === 0 };
    });
    for (let i = 0; i < 60 * 4; i += 1) step(input);
    return { screen: 'play' };
  }

  // Default: cover — a three-star getaway chase with the HUD, the minimap
  // and the mission objective all on screen at once.
  startMission(state, 3);
  setMissionStep(state, 1); // straight to the escape, wanted level 3
  const car = state.cars.find((c) => c.kind === 'traffic') || state.cars[0];
  putPlayerInCar(state, car);
  // Start on the Bay Bank road, heading west toward the Hideout.
  car.x = 1300; car.y = 1112; car.angle = Math.PI;
  car.health = 100;
  player.x = car.x; player.y = car.y;
  state.camera.x = car.x; state.camera.y = car.y;
  const input = makeFakeInput(() => roadSteer(state, 504, 504));
  for (let i = 0; i < 60 * 5; i += 1) step(input);
  return { screen: 'play' };
}
