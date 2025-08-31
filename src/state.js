export const state = {
  location: "Your Room",
  day: 1,
  timeIndex: 1,
  money: 50,
  inventory: [],
  threadVisible: [],
  npcFocused: null,
  memory: {}
};
export function loadState(){ try{ const raw = localStorage.getItem("game_state_v1"); if(raw) Object.assign(state, JSON.parse(raw)); }catch(e){} }
export function saveState(){ try{ localStorage.setItem("game_state_v1", JSON.stringify(state)); }catch(e){} }
