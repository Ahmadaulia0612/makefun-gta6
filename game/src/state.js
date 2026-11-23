// The whole game state in one object, created fresh per run. Systems
// (traffic, police, missions, combat) all read and write this object; the
// renderer only reads it. Nothing here touches the DOM.
import { PLAYER } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './world.js';

export function createState(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  return {
    seed,
    random,
    city,
    time: 0,
    mode: 'title', // title | play | paused | busted | wasted | complete
    titleChoice: 0,
    isShot: false, // true while a staged ?shot= scene is being rendered
    lastShotAt: null,
    player: {
      x: 504, y: 560, angle: -Math.PI / 2, speed: 0,
      onFoot: true, health: PLAYER.health, maxHealth: PLAYER.health,
      cash: 200, weapon: 'fists', ammo: 0, car: null,
      invulnerable: 0, punchCooldown: 0, shootCooldown: 0,
      bustedTimer: 0, moving: false,
    },
    wanted: 0,
    wantedTimer: 0,
    cars: [],
    peds: [],
    footCops: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    skids: [],
    mission: {
      index: 0, step: 0, active: false, started: false,
      marker: null, objective: '', timer: 0, holdTimer: 0,
      done: false, kills: 0, collected: 0,
    },
    camera: { x: 504, y: 560, zoom: 1, shake: 0 },
    stats: { carsStolen: 0, missionsDone: 0, kills: 0, cashEarned: 0, pedsHit: 0 },
    events: [], // {type, x, y} drained by main.js each frame for sound/particles
    messages: [],
    banner: null,
    bannerTimer: 0,
    saveExists: false,
    muted: false,
    nextCarId: 1,
  };
}

export function addMessage(state, text) {
  state.messages.unshift({ text, t: state.time });
  if (state.messages.length > 4) state.messages.length = 4;
}

export function showBanner(state, title, sub) {
  state.banner = { title, sub: sub || '' };
  state.bannerTimer = 3.2;
}

export function addCash(state, amount) {
  state.player.cash += amount;
  state.stats.cashEarned += amount;
}
