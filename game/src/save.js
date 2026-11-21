// Solmar Heat — the save game: cash, story progress and where Reyes woke up, kept in
// localStorage. Written when a mission lands and read at the start screen; storage
// can be unavailable (private windows), and every failure here is a shrug, not a crash.
import { SAVE_KEY } from './config.js';

/** Persist the run: cash, the next mission on offer, health and position. */
export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionIndex: state.missions.index,
      storyDone: state.missions.index >= 6,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: Math.round(state.player.health),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // No storage, no save: the run lasts this visit only.
  }
}

/** The saved run, or null when there is none worth continuing. */
export function loadSave() {
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

/** Forget the save (a new game overwrites it on its first mission anyway). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to forget.
  }
}
