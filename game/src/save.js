// Saving and loading: one slot in localStorage. Progress is cash, mission,
// health, ammo, weapon and position — enough to continue a run after closing
// the tab. Nothing here is required to play.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.player.cash,
      missionIndex: state.mission.index,
      missionsDone: state.stats.missionsDone,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: Math.round(state.player.health),
      ammo: state.player.ammo,
      weapon: state.player.weapon,
      cashEarned: state.stats.cashEarned,
      kills: state.stats.kills,
      carsStolen: state.stats.carsStolen,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* storage can be off */ }
}

export function applySave(state, data) {
  state.player.cash = data.cash;
  state.player.x = data.x;
  state.player.y = data.y;
  state.player.health = data.health;
  state.player.ammo = data.ammo || 0;
  state.player.weapon = data.weapon || 'fists';
  state.stats.cashEarned = data.cashEarned || 0;
  state.stats.kills = data.kills || 0;
  state.stats.carsStolen = data.carsStolen || 0;
  state.stats.missionsDone = data.missionsDone || 0;
  state.camera.x = data.x;
  state.camera.y = data.y;
}
