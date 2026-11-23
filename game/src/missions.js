// The story: six missions for Rio Vega, from his first stolen car to the
// big score at Bay Bank. Each mission is a list of steps; a step is a thing
// to do at a place (go there, get in a car, hold a spot, take out rivals).
// Finishing a mission pays cash and starts the next one.
import { addCash, addMessage, showBanner } from './state.js';
import { spawnEnemies, spawnPickup } from './combat.js';
import { addWanted } from './police.js';

export const MISSIONS = [
  {
    title: 'First Wheels',
    briefing: 'Rio needs wheels. Steal a car and bring it to the Chop Shop.',
    reward: 500,
    steps: [
      { type: 'incar', text: 'Steal a car — walk up to one and press E' },
      { type: 'goto', text: 'Drive to the Chop Shop', x: 1720, y: 2024, radius: 90 },
    ],
  },
  {
    title: 'The Package',
    briefing: 'A package at Sunset Mall. Deliver it to the Motel, no questions.',
    reward: 800,
    steps: [
      { type: 'goto', text: 'Pick up the package at Sunset Mall', x: 504, y: 1416, radius: 80 },
      { type: 'goto', text: 'Deliver it to the Motel', x: 2024, y: 504, radius: 80 },
    ],
  },
  {
    title: 'Tools of the Trade',
    briefing: 'Three toolboxes stashed around the city. Collect them all.',
    reward: 1000,
    steps: [
      { type: 'goto', text: 'Collect toolbox 1 of 3 — City Hall', x: 808, y: 504, radius: 80 },
      { type: 'goto', text: 'Collect toolbox 2 of 3 — Grand Hotel', x: 1416, y: 808, radius: 80 },
      { type: 'goto', text: 'Collect toolbox 3 of 3 — Marina', x: 2328, y: 2024, radius: 80 },
    ],
  },
  {
    title: 'Heat Wave',
    briefing: 'Grab the bag from Bay Bank. The cops will not wait.',
    reward: 1500,
    steps: [
      { type: 'goto', text: 'Grab the bag from Bay Bank', x: 1112, y: 1112, radius: 80 },
      { type: 'escape', text: 'Lose the heat — reach the Hideout', x: 504, y: 504, radius: 90 },
    ],
  },
  {
    title: 'Turf War',
    briefing: 'The Vipers took our corner. Take it back.',
    reward: 2000,
    steps: [
      { type: 'goto', text: 'Meet the Vipers at the alley', x: 1416, y: 1416, radius: 90 },
      { type: 'kill', count: 5, text: 'Take out 5 Vipers', x: 1416, y: 1416 },
    ],
  },
  {
    title: 'The Big Score',
    briefing: 'Bay Bank. One vault, eight seconds, then run like hell.',
    reward: 5000,
    steps: [
      { type: 'goto', text: 'Get to Bay Bank', x: 1112, y: 1112, radius: 90 },
      { type: 'hold', seconds: 8, text: 'Hold the vault — stay in the circle', x: 1112, y: 1112, radius: 110 },
      { type: 'escape', text: 'Escape to the Hideout with the cash', x: 504, y: 504, radius: 90 },
    ],
  },
];

function currentStep(state) {
  const mission = MISSIONS[state.mission.index];
  if (!mission) return null;
  return mission.steps[state.mission.step] || null;
}

export function currentObjective(state) {
  const step = currentStep(state);
  if (!step || !state.mission.active) return 'Free roam — press E near a car to steal it';
  return step.text;
}

function beginStep(state, step) {
  const m = state.mission;
  m.holdTimer = 0;
  m.kills = 0;
  m.timer = 0;
  if (step.type === 'goto' || step.type === 'escape' || step.type === 'hold') {
    m.marker = { x: step.x, y: step.y, radius: step.radius || 80 };
  } else if (step.type === 'kill') {
    m.marker = { x: step.x, y: step.y, radius: 120 };
    spawnEnemies(state, step.x, step.y, step.count || 5);
    addMessage(state, 'Rivals incoming — click to shoot, F to punch.');
  } else {
    m.marker = null;
  }
  if (step.type === 'escape') {
    const stars = state.mission.index >= 5 ? 4 : 3;
    state.wanted = Math.max(state.wanted, stars);
    addMessage(state, `Wanted level ${state.wanted} — run!`);
  }
}

export function startMission(state, index) {
  const mission = MISSIONS[index];
  if (!mission) {
    state.mission.active = false;
    state.mission.marker = null;
    state.mission.done = true;
    return;
  }
  state.mission.index = index;
  state.mission.step = 0;
  state.mission.active = true;
  state.mission.started = true;
  state.mission.collected = 0;
  showBanner(state, `Mission ${index + 1}: ${mission.title}`, mission.briefing);
  addMessage(state, mission.briefing);
  beginStep(state, mission.steps[0]);
}

function finishMission(state) {
  const mission = MISSIONS[state.mission.index];
  addCash(state, mission.reward);
  state.stats.missionsDone += 1;
  showBanner(state, 'Mission passed!', `+$${mission.reward}  —  ${mission.title}`);
  state.events.push({ type: 'missionDone', x: state.player.x, y: state.player.y });
  if (state.mission.index === 0 && state.player.weapon === 'fists') {
    state.player.weapon = 'pistol';
    state.player.ammo += 24;
    addMessage(state, 'Pistol earned — click to shoot.');
  }
  if (state.mission.index === 2) {
    state.player.ammo += 48;
    addMessage(state, 'Ammo +48');
  }
  spawnPickup(state, 'health', state.player.x + 60, state.player.y, 0);
  const next = state.mission.index + 1;
  if (next >= MISSIONS.length) {
    state.mission.active = false;
    state.mission.done = true;
    state.mission.marker = null;
    state.mode = 'complete';
    return;
  }
  startMission(state, next);
}

export function updateMission(state, dt) {
  if (!state.mission.active) return;
  const step = currentStep(state);
  if (!step) return;
  const player = state.player;
  const dist = (x, y) => Math.hypot(player.x - x, player.y - y);
  let done = false;
  if (step.type === 'incar') {
    done = !player.onFoot && player.car !== null;
  } else if (step.type === 'goto' || step.type === 'escape') {
    done = dist(step.x, step.y) < (step.radius || 80);
  } else if (step.type === 'hold') {
    if (dist(step.x, step.y) < (step.radius || 110)) {
      state.mission.holdTimer += dt;
      if (state.mission.holdTimer >= step.seconds) done = true;
    } else {
      state.mission.holdTimer = Math.max(0, state.mission.holdTimer - dt);
    }
  } else if (step.type === 'kill') {
    done = state.mission.kills >= (step.count || 5);
  }
  if (!done) return;
  state.mission.step += 1;
  const mission = MISSIONS[state.mission.index];
  if (state.mission.step >= mission.steps.length) {
    finishMission(state);
  } else {
    addMessage(state, 'Objective complete.');
    state.events.push({ type: 'pickup', x: player.x, y: player.y });
    beginStep(state, mission.steps[state.mission.step]);
  }
}

export function resetMissionToStart(state) {
  if (state.mission.done) return;
  startMission(state, state.mission.index);
}

/** Jump a mission to one of its steps (used by the staged screenshots). */
export function setMissionStep(state, stepIndex) {
  const mission = MISSIONS[state.mission.index];
  if (!mission || stepIndex >= mission.steps.length) return;
  state.mission.step = stepIndex;
  beginStep(state, mission.steps[stepIndex]);
}
