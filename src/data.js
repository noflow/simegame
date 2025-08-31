// src/data.js
import { state } from './state.js';
import { renderLocation } from '../render/map.js';
import { updatePresence } from './presence.js';
import { renderChat } from '../chat/index.js';
import { renderSidebar } from '../render/sidebar.js';

export let WORLD = null;
export let CHARACTERS = null;

export function setGameData(worldObj, charsObj){
  WORLD = worldObj; CHARACTERS = charsObj;
  if (!WORLD.passages[state.location]) {
    state.location = WORLD.passages["Your Room"] ? "Your Room" : Object.keys(WORLD.passages)[0];
  }
  renderLocation(); updatePresence(); renderChat(); renderSidebar();
}

export function loadInlineJson(){
  const wd = document.getElementById('worldData'); const cd = document.getElementById('charactersData');
  if(!wd || !cd) throw new Error("Inline JSON blocks missing.");
  WORLD = JSON.parse(wd.textContent || "{}");
  CHARACTERS = JSON.parse(cd.textContent || "{}");
  return { WORLD, CHARACTERS };
}
