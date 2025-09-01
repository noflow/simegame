// src/main.js
import * as GameConst from './constants.js';
import * as GameState from './state.js';
import * as GameStorage from './storage.js';
import { setGameData } from './data.js';
import * as GameLogic from './presence.js';

import { renderLocation, goTo } from './render/map.js';
import { renderSidebar, renderInventory, renderMoney } from './render/sidebar.js';

import * as GameUI from '../chat/index.js?v=3';
import * as Known from './known/index.js';
import * as Debug from './debug.js';

// ensure global container exists even before JSON is loaded
window.GameData = window.GameData || { WORLD: null, CHARACTERS: null };

// ---- guard against double boot
if (window.__GAME_BOOTED__) {
  console.warn("Game already booted — duplicate load prevented.", import.meta.url);
} else {
  window.__GAME_BOOTED__ = true;
}

// ---- localStorage keys for user JSON
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

// ===== CosmosRP wiring (non-breaking) =====
/**
 * Build OpenAI-style messages from our chat history.
 * history: [{speaker:"You"|"NPC Name", text:"..."}]
 */
function buildMessagesFromHistory(history, systemPrompt = "") {
  const msgs = [];
  if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
  if (Array.isArray(history)) {
    for (const turn of history) {
      if (!turn || !turn.text) continue;
      if (/^you$/i.test(turn.speaker || "")) {
        msgs.push({ role: "user", content: turn.text });
      } else {
        msgs.push({ role: "assistant", content: turn.text });
      }
    }
  }
  return msgs;
}

async function llmReplyWithCosmos(history, userText, options = {}) {
  if (!window.CosmosRP || !window.CosmosRP.callChat) {
    throw new Error("CosmosRP client not loaded. Ensure cosmos.js is included.");
  }
  const systemPrompt = window.GameState?.systemPrompt || "";
  const messages = buildMessagesFromHistory(history, systemPrompt);
  messages.push({ role: "user", content: userText });

  const { content } = await window.CosmosRP.callChat({
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 512
  });
  return content || "";
}

// Provide a simple provider-agnostic entrypoint for the rest of the app/UI.
window.GameAI = window.GameAI || {};
/**
 * window.GameAI.llm(input, opts)
 * - input can be a string (prompt) or an object {history, userText}
 */
window.GameAI.llm = async (input, opts = {}) => {
  try {
    if (typeof input === "string") {
      // No history; send as a single user message
      const { content } = await window.CosmosRP.callChat({
        messages: [{ role: "user", content: input }],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens ?? 512
      });
      return content || "";
    } else if (input && typeof input === "object") {
      const { history, userText } = input;
      return await llmReplyWithCosmos(history || [], userText || "", opts);
    }
    throw new Error("Invalid input to GameAI.llm");
  } catch (e) {
    console.error("LLM error:", e);
    throw e;
  }
};
// ===== end CosmosRP wiring =====

function advanceTime(){
  const TIME_SLOTS = GameConst.TIME_SLOTS;
  GameState.state.timeIndex++;
  if (GameState.state.timeIndex >= TIME_SLOTS.length) {
    GameState.state.timeIndex = 0;
    GameState.state.day++;
    if (GameState.state.day > 7) GameState.state.day = 1;
  }
  { const d = document.getElementById('day');  if (d) d.textContent  = GameState.state.day; }
  { const t = document.getElementById('time'); if (t) t.textContent = TIME_SLOTS[GameState.state.timeIndex]; }
  renderSidebar();
  if (window.GameData && window.GameData.WORLD && window.GameData.CHARACTERS) {
    GameLogic.updatePresence();
  }
  GameState.saveState();
}

function applyMoney(delta){
  GameState.state.money += delta;
  renderMoney();
  renderSidebar();
  GameState.saveState();
}

async function boot(){
  try{
    // basic UI init
    GameState.loadState();
    GameStorage.loadApiKey();
    renderMoney();
    renderInventory();
    renderSidebar();
    { const el = document.getElementById('day');  if (el) el.textContent  = GameState.state.day; }
    { const el = document.getElementById('time'); if (el) el.textContent = GameConst.TIME_SLOTS[GameState.state.timeIndex]; }

    // Load user overrides (required now; no built-in JSON)
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

    // If both present, start; otherwise prompt user to load files
    if (worldObj && charsObj) {
      window.GameData = { WORLD: worldObj, CHARACTERS: charsObj };
      setGameData(worldObj, charsObj);
    } else {
      window.GameData = { WORLD: null, CHARACTERS: null };
      openSettingsModal();
    }
  } catch (err) {
    console.error(err);
    alert("Error: " + (err.message || String(err)));
  }
}

addEventListener('DOMContentLoaded', ()=>{
  boot();

  // header buttons
  { const el = document.getElementById('advance'); if (el) el.addEventListener('click', advanceTime); }

  // settings open/close
  { const el = document.getElementById('openSettings');  if (el) el.addEventListener('click', openSettingsModal); }
  { const el = document.getElementById('openSettings2'); if (el) el.addEventListener('click', openSettingsModal); }
  { const el = document.getElementById('settingsCloseBtn'); if (el) el.addEventListener('click', closeSettingsModal); }
  document.getElementById('settingsModal')?.addEventListener('click', (e)=>{
    if (e.target && e.target.id === 'settingsModal') closeSettingsModal();
  });

  // Known Characters modal wiring
  { const el = document.getElementById('openKnown');      if (el) el.addEventListener('click', Known.openKnownModal); }
  { const el = document.getElementById('knownCloseBtn');  if (el) el.addEventListener('click', Known.closeKnownModal); }
  document.getElementById('knownModal')?.addEventListener('click', (e)=>{
    if (e.target && e.target.id === 'knownModal') Known.closeKnownModal();
  });
  document.getElementById('knownSearch')?.addEventListener('input', Known.renderKnownList);

  // Inventory & money
  document.getElementById('addItem')?.addEventListener('click', ()=>{
    const input = document.getElementById('newItem');
    const v = input ? input.value.trim() : '';
    if (!v) return;
    GameState.state.inventory.push(v);
    if (input) input.value = '';
    renderInventory();
    GameState.saveState();
  });

  document.getElementById('applyMoney')?.addEventListener('click', ()=>{
    const el = document.getElementById('moneyDelta');
    const n = el ? parseInt(el.value, 10) : NaN;
    if (!isNaN(n)) applyMoney(n);
  });

  // ---- Settings: JSON imports & game actions
  document.getElementById('mapFile')?.addEventListener('change', async (e) => {
    const f = e.target && e.target.files ? e.target.files[0] : null;
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
    const f = e.target && e.target.files ? e.target.files[0] : null;
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
    GameState.state.settings.compact = !!compactEl.checked;
    applySettings(); GameState.saveState();
  });
  contrastEl?.addEventListener('change', ()=>{
    GameState.state.settings.contrast = !!contrastEl.checked;
    applySettings(); GameState.saveState();
  });
  applySettings();

  // update status badges when opening settings
  document.getElementById('openSettings')?.addEventListener('click', setStatusBadges);
  document.getElementById('openSettings2')?.addEventListener('click', setStatusBadges);
  setStatusBadges();
});
