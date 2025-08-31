// src/main.js
import * as GameConst from './constants.js';
import * as GameState from './state.js';
import * as GameStorage from './storage.js';
import { setGameData } from './data.js';
import * as GameLogic from './presence.js';

import { renderLocation, goTo } from './render/map.js';
import { renderSidebar, renderInventory, renderMoney } from './render/sidebar.js';

import * as GameUI from '../chat/index.js';       // chat at repo root
import * as Known from './known/index.js';
import * as Debug from './debug.js';

// ---- cache guards (optional)
if (window.__GAME_BOOTED__) {
  console.warn("Game already booted — duplicate load prevented.", import.meta.url);
} else {
  window.__GAME_BOOTED__ = true;
}

// ---- overrides in localStorage
const WORLD_KEY = 'world_json_override_v1';
const CHARS_KEY = 'characters_json_override_v1';

function setStatusBadges() {
  const w = localStorage.getItem(WORLD_KEY);
  const c = localStorage.getItem(CHARS_KEY);
  const wEl = document.getElementById('worldSource');
  const cEl = document.getElementById('charsSource');
  if (wEl) wEl.textContent = w ? 'custom map.json' : 'none';
  if (cEl) cEl.textContent = c ? 'custom characters.json' : 'none';
}

async function readFileAsText(file) {
  return await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(fr.error || new Error('Read failed'));
    fr.onload = () => res(String(fr.result || ''));
    fr.readAsText(file, 'utf-8');
  });
}

function openSettingsModal() {
  const overlay = document.getElementById('settingsModal');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden','false');
  setStatusBadges();
}

function closeSettingsModal() {
  const overlay = document.getElementById('settingsModal');
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden','true');
}

// expose minimal globals
window.GameConst = GameConst;
window.GameState = GameState;
window.GameLogic = GameLogic;
window.GameUI = { ...GameUI, renderChat: GameUI.renderChat, renderSidebar };
window.GameKnown = Known;
window.GameDebug = Debug;
window.GameNav = { goTo };

function advanceTime(){
  const TIME_SLOTS = GameConst.TIME_SLOTS;
  GameState.state.timeIndex++;
  if(GameState.state.timeIndex >= TIME_SLOTS.length){
    GameState.state.timeIndex=0; GameState.state.day++; if(GameState.state.day>7) GameState.state.day=1;
  }
  const d = document.getElementById('day'); if(d) d.textContent = GameState.state.day;
  const t = document.getElementById('time'); if(t) t.textContent = TIME_SLOTS[GameState.state.timeIndex];
  renderSidebar();
  // Only update presence if world loaded
  if (window.GameData?.WORLD && window.GameData?.CHARACTERS) {
    GameLogic.updatePresence();
  }
  GameState.saveState();
}

function applyMoney(delta){
  GameState.state.money += delta; renderMoney(); renderSidebar(); GameState.saveState();
}

async function boot(){
  try{
    // basic UI init
    GameState.loadState(); GameStorage.loadApiKey(); renderMoney(); renderInventory(); renderSidebar();
    document.getElementById('day')?.textContent = GameState.state.day;
    document.getElementById('time')?.textContent = GameConst.TIME_SLOTS[GameState.state.timeIndex];

    // Try to load overrides (required now)
    let worldObj = null, charsObj = null;
    try {
      const wStr = localStorage.getItem(WORLD_KEY);
      const cStr = localStorage.getItem(CHARS_KEY);
      if (wStr) worldObj = JSON.parse(wStr);
      if (cStr) charsObj = JSON.parse(cStr);
    } catch (e) {
      console.warn('Bad override JSON; clearing', e);
      localStorage.removeItem(WORLD_KEY);
      localStorage.removeItem(CHARS_KEY);
    }

    // If both are present, start the game
    if (worldObj && charsObj) {
      window.GameData = { WORLD: worldObj, CHARACTERS: charsObj };
      setGameData(worldObj, charsObj);
    } else {
      // Otherwise, prompt user to load files
      window.GameData = { WORLD: null, CHARACTERS: null };
      openSettingsModal();
    }
  }catch(err){
    console.error(err);
    alert("Error: " + (err.message||String(err)));
  }
}

addEventListener('DOMContentLoaded', ()=>{
  boot();

  // header buttons
  document.getElementById('advance')?.addEventListener('click', advanceTime);

  // settings open/close
  document.getElementById('openSettings')?.addEventListener('click', openSettingsModal);
  document.getElementById('openSettings2')?.addEventListener('click', openSettingsModal);
  document.getElementById('settingsCloseBtn')?.addEventListener('click', closeSettingsModal);
  document.getElementById('settingsModal')?.addEventListener('click', (e)=>{ if(e.target.id==='settingsModal'){ closeSettingsModal(); }});

  // Known Characters modal wiring
  document.getElementById('openKnown')?.addEventListener('click', Known.openKnownModal);
  document.getElementById('knownCloseBtn')?.addEventListener('click', Known.closeKnownModal);
  document.getElementById('knownModal')?.addEventListener('click', (e)=>{ if(e.target.id==='knownModal'){ Known.closeKnownModal(); }});
  document.getElementById('knownSearch')?.addEventListener('input', Known.renderKnownList);

  // Inventory & money
  document.getElementById('addItem')?.addEventListener('click', ()=>{
    const v = document.getElementById('newItem').value.trim(); if(!v) return;
    GameState.state.inventory.push(v); document.getElementById('newItem').value=''; renderInventory(); GameState.saveState();
  });
  document.getElementById('applyMoney')?.addEventListener('click', ()=>{
    const n=parseInt(document.getElementById('moneyDelta').value,10); if(!isNaN(n)) applyMoney(n);
  });

  // ---- Settings: JSON imports & game actions
  document.getElementById('mapFile')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await readFileAsText(f);
      const json = JSON.parse(text);
      localStorage.setItem(WORLD_KEY, text);
      window.GameData.WORLD = json;
      if (window.GameData.CHARACTERS) {
        setGameData(window.GameData.WORLD, window.GameData.CHARACTERS);
      }
      GameState.saveState();
      setStatusBadges();
      alert('Loaded custom map.json');
    } catch (err) {
      alert('Invalid map.json: ' + (err.message || err));
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('charsFile')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await readFileAsText(f);
      const json = JSON.parse(text);
      localStorage.setItem(CHARS_KEY, text);
      window.GameData.CHARACTERS = json;
      if (window.GameData.WORLD) {
        setGameData(window.GameData.WORLD, window.GameData.CHARACTERS);
      }
      GameState.saveState();
      setStatusBadges();
      alert('Loaded custom characters.json');
    } catch (err) {
      alert('Invalid characters.json: ' + (err.message || err));
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('clearOverrides')?.addEventListener('click', () => {
    // kept disabled since there is no built-in now
    alert('Built-in data removed in this build. Load map.json and characters.json from Settings to play.');
  });

  document.getElementById('saveGame')?.addEventListener('click', () => {
    GameState.saveState();
    alert('Game saved.');
  });

  document.getElementById('resetGame')?.addEventListener('click', () => {
    if (!confirm('Reset all progress and clear custom data?')) return;
    localStorage.removeItem('game_state_v1');
    localStorage.removeItem(WORLD_KEY);
    localStorage.removeItem(CHARS_KEY);
    location.reload();
  });

  // UI prefs
  GameState.state.settings = GameState.state.settings || { compact:false, contrast:false };
  function applySettings(){
    document.body.classList.toggle('compact', !!GameState.state.settings.compact);
    document.body.classList.toggle('contrast', !!GameState.state.settings.contrast);
  }
  const compactEl = document.getElementById('setCompact');
  const contrastEl = document.getElementById('setHighContrast');
  if (compactEl) compactEl.checked = !!GameState.state.settings.compact;
  if (contrastEl) contrastEl.checked = !!GameState.state.settings.contrast;
  compactEl?.addEventListener('change', ()=>{
    GameState.state.settings.compact = compactEl.checked; applySettings(); GameState.saveState();
  });
  contrastEl?.addEventListener('change', ()=>{
    GameState.state.settings.contrast = contrastEl.checked; applySettings(); GameState.saveState();
  });
  applySettings();

  // when opening settings, update status labels
  document.getElementById('openSettings')?.addEventListener('click', setStatusBadges);
  document.getElementById('openSettings2')?.addEventListener('click', setStatusBadges);
  setStatusBadges();
});

// optional: expose navigation
window.GameNav = { goTo };
