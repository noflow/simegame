// src/main.js
import * as GameConst from './constants.js';
import * as GameState from './state.js';
import * as GameStorage from './storage.js';
import { setGameData, loadInlineJson } from './data.js';   // was ../data.js
import * as GameLogic from './presence.js';

import { renderLocation, goTo } from './render/map.js';
import { renderSidebar, renderInventory, renderMoney } from './render/sidebar.js';

import * as GameUI from '../chat/index.js';                // was ./chat/...
import * as Known from './known/index.js';
import * as Debug from './debug.js';


// Surface unexpected JS errors during dev
window.addEventListener('error', e => { console.error('🔥 Script error:', e.message, e.filename+':'+e.lineno); });

// Expose minimal global names (handy for dev console and cross-module calls without circular imports)
window.GameConst = GameConst;
window.GameState = GameState;
window.GameLogic = GameLogic;
window.GameUI = { ...GameUI, renderChat: GameUI.renderChat, renderSidebar };
window.GameData = {}; // will hold WORLD/CHARACTERS after load
window.GameKnown = Known;
window.GameDebug = Debug;

function advanceTime(){
  const TIME_SLOTS = GameConst.TIME_SLOTS;
  GameState.state.timeIndex++;
  if(GameState.state.timeIndex >= TIME_SLOTS.length){
    GameState.state.timeIndex=0; GameState.state.day++; if(GameState.state.day>7) GameState.state.day=1;
  }
  const d = document.getElementById('day'); if(d) d.textContent = GameState.state.day;
  const t = document.getElementById('time'); if(t) t.textContent = TIME_SLOTS[GameState.state.timeIndex];
  renderSidebar();
  GameLogic.updatePresence(); GameState.saveState();
}

function applyMoney(delta){ GameState.state.money += delta; renderMoney(); renderSidebar(); GameState.saveState(); }

async function boot(){
  try{
    GameState.loadState(); GameStorage.loadApiKey(); renderMoney(); renderInventory(); renderSidebar();
    const d = document.getElementById('day'); if(d) d.textContent = GameState.state.day;
    const t = document.getElementById('time'); if(t) t.textContent = GameConst.TIME_SLOTS[GameState.state.timeIndex];

    const { WORLD, CHARACTERS } = loadInlineJson();
    window.GameData.WORLD = WORLD; window.GameData.CHARACTERS = CHARACTERS;
    setGameData(WORLD, CHARACTERS);

    renderLocation(); GameLogic.updatePresence(); GameUI.renderChat(); renderSidebar();
  }catch(err){ console.error(err); alert("Error: " + (err.message||String(err))); }
}

addEventListener('DOMContentLoaded', ()=>{
  boot();
  document.getElementById('advance')?.addEventListener('click', advanceTime);
  document.getElementById('save')?.addEventListener('click', ()=>{ GameState.saveState(); GameStorage.loadApiKey(); alert('Saved.'); });
  document.getElementById('reset')?.addEventListener('click', ()=>{ if(confirm('Reset game state?')){ localStorage.removeItem('game_state_v1'); location.reload(); } });

  document.getElementById('addItem')?.addEventListener('click', ()=>{
    const v = document.getElementById('newItem').value.trim(); if(!v) return;
    GameState.state.inventory.push(v); document.getElementById('newItem').value=''; renderInventory(); GameState.saveState();
  });
  document.getElementById('applyMoney')?.addEventListener('click', ()=>{ const n=parseInt(document.getElementById('moneyDelta').value,10); if(!isNaN(n)) applyMoney(n); });

  // Known Characters modal wiring
  document.getElementById('openKnown')?.addEventListener('click', Known.openKnownModal);
  document.getElementById('knownCloseBtn')?.addEventListener('click', Known.closeKnownModal);
  document.getElementById('knownModal')?.addEventListener('click', (e)=>{ if(e.target.id==='knownModal'){ Known.closeKnownModal(); }});
  document.getElementById('knownSearch')?.addEventListener('input', Known.renderKnownList);

  // Settings basics
  document.getElementById('openSettings')?.addEventListener('click', ()=>{
    const overlay = document.getElementById('settingsModal'); overlay.style.display='flex'; overlay.setAttribute('aria-hidden','false');
  });
  document.getElementById('settingsCloseBtn')?.addEventListener('click', ()=>{
    const overlay = document.getElementById('settingsModal'); overlay.style.display='none'; overlay.setAttribute('aria-hidden','true');
  });
  document.getElementById('exportChatBtn')?.addEventListener('click', ()=> Debug.exportChat(GameState.state.npcFocused));

  // Chat input (optional modal can be added similarly to original)
});

// optional: expose navigation
window.GameNav = { goTo };
