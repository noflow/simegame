// /src/data.js
import { state } from './state.js?v=2';
import { renderLocation } from './render/map.js?v=2';
import { updatePresence } from './presence.js?v=2';
import { renderChat } from '../chat/index.js?v=2';
import { renderSidebar } from './render/sidebar.js?v=2';

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
  const wd = document.getElementById('worldData');
  const cd = document.getElementById('charactersData');
  if(!wd || !cd) throw new Error("Inline JSON blocks missing.");
  WORLD = JSON.parse(wd.textContent || "{}");
  CHARACTERS = JSON.parse(cd.textContent || "{}");
  return { WORLD, CHARACTERS };
}
