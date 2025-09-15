// src/data.js
import { state } from './state.js';
import { renderLocation } from './render/map.js';
import { updatePresence } from './presence.js';

import { renderSidebar } from './render/sidebar.js';

export let WORLD = null;
export let CHARACTERS = null;

export function setGameData(worldObj, charsObj){
  WORLD = worldObj; CHARACTERS = charsObj;

  // Ensure starting location exists
  if (!WORLD?.passages?.[state.location]) {
    const fallback = WORLD?.passages?.["Your Room"]
      ? "Your Room"
      : Object.keys(WORLD?.passages || {})[0] || "Your Room";
    state.location = fallback;
  }

  // Initial UI refresh once data is present
  renderLocation();
  updatePresence();
  renderChat();
  renderSidebar();
}
