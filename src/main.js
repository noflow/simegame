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
import * as CharBuild from './builder/character_builder.js';

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
window.setGameData = setGameData;

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

function getWorldPlaces(limit = 24) {
  try {
    const p = window.GameData?.WORLD?.passages || {};
    const names = Object.keys(p);
    return names.length ? names.slice(0, limit) : ['Your Room'];
  } catch { return ['Your Room']; }
}

function sanitizeSchedule(arr, allowedPlaces, allowedSlots){
  const daysOk = d => Number.isInteger(d) && d>=1 && d<=7;
  return (Array.isArray(arr) ? arr : []).map(r => ({
    location: allowedPlaces.includes(r.location) ? r.location : (allowedPlaces[0] || 'Your Room'),
    days: (Array.isArray(r.days) ? r.days.filter(daysOk) : [1,2,3,4,5]).slice(0,7),
    slots: (Array.isArray(r.slots) ? r.slots.filter(s => allowedSlots.includes(s)) : ['morning','afternoon'])
  })).filter(r => r.days.length && r.slots.length);
}

function hash32(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function seededRand(seed){ seed=(seed*1664525+1013904223)>>>0; return [seed, (seed/0xffffffff)]; }

function randomScheduleFor(npc){
  const PLACES = getWorldPlaces(24);
  const TIME_SLOTS = window.GameConst?.TIME_SLOTS || ["morning","lunch","afternoon"];
  let seed = hash32((npc.name||'npc') + '|' + (npc.role||'') + '|' + (npc.persona||''));
  const picks = new Set();
  const target = 1 + Math.floor((seed % 3));
  for (let i=0; i<PLACES.length && picks.size < target + 1; i++){
    [seed] = seededRand(seed);
    const idx = Math.floor(seed * PLACES.length) % PLACES.length;
    picks.add(PLACES[idx]);
  }
  const core = Array.from(picks);
  const daysWork = [1,2,3,4,5];
  const daysPlay = [6,7];
  const workSlots = TIME_SLOTS.filter(s => /^(early_morning|morning|lunch|afternoon)$/.test(s)) || TIME_SLOTS.slice(0,3);
  const eveSlots  = TIME_SLOTS.filter(s => /^(evening|night)$/.test(s)) || TIME_SLOTS.slice(-2);
  const sched = [];
  if (core[0]) sched.push({ location: core[0], days: daysWork, slots: workSlots.slice(0,3) });
  if (core[1]) sched.push({ location: core[1], days: daysWork, slots: workSlots.slice(1,3) });
  const wkndPlace = core[2] || core[1] || core[0] || PLACES[0] || 'Your Room';
  const wkndSlots = eveSlots.length ? eveSlots : (TIME_SLOTS.length ? [TIME_SLOTS.at(-1)] : ['evening']);
  sched.push({ location: wkndPlace, days: [6,7], slots: wkndSlots });
  return sanitizeSchedule(sched, PLACES, TIME_SLOTS);
}

async function aiSuggestSchedule(npc){
  try {
    if (!window.CosmosRP || !window.CosmosRP.callChat) throw new Error('No LLM configured');
    const PLACES = getWorldPlaces(24);
    const TIME_SLOTS = window.GameConst?.TIME_SLOTS || ["morning","lunch","afternoon"];
    const system = `You output STRICT JSON ONLY: an array of schedule rules for an NPC in a slice-of-life game.
Each item: { "location": "<one of provided places>", "days":[1..7], "slots":["<from provided slots>"] }
Use days 1..7 where 1=Mon, 7=Sun. Use ONLY the provided places and slots.`;
    const user = JSON.stringify({ npc:{ name:npc.name, role:npc.role, persona:npc.persona }, places:PLACES, slots:TIME_SLOTS });
    const { content } = await window.CosmosRP.callChat({ messages:[{role:'system',content:system},{role:'user',content:user}], temperature:0.3, max_tokens:500 });
    let text = String(content||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'');
    let parsed = JSON.parse(text);
    const clean = sanitizeSchedule(parsed, PLACES, TIME_SLOTS);
    if (!clean.length) throw new Error('Empty/invalid schedule from AI');
    return clean;
  } catch(e) {
    console.warn('AI schedule failed → fallback to random:', e?.message||e);
    return randomScheduleFor(npc);
  }
}

async function ensureSchedule(npc){
  const PLACES = getWorldPlaces(24);
  const TIME_SLOTS = window.GameConst?.TIME_SLOTS || ["morning","lunch","afternoon"];
  const hasUseful = Array.isArray(npc.schedule) && npc.schedule.some(r => r && r.location);
  if (hasUseful) {
    npc.schedule = sanitizeSchedule(npc.schedule, PLACES, TIME_SLOTS);
    if (npc.schedule.length) return npc;
  }
  npc.schedule = await aiSuggestSchedule(npc);
  return npc;
}

function chubToNpc(json){
  return {
    id: (json.name || 'npc').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,32) || 'npc',
    name: json.name || 'Unnamed',
    role: json.description || json.scenario || 'Citizen',
    gender: json.gender || 'unknown',
    avatar: json.avatar || '',
    persona: json.persona || json.description || '',
    greeting: json.greeting || '',
    greetings: { work:'', home:'', casual: json.greeting || '' },
    appearance: { height:'', weight:'', hair:'', eyes:'', style:'' },
    sexuality: { orientation: '' },
    location: 'Your Room',
    traits: Array.isArray(json.tags) ? json.tags.slice(0,8) : [],
    schedule: Array.isArray(json.schedule) ? json.schedule : []
  };
}

function getCharactersObj(){
  try {
    const raw = localStorage.getItem(CHARS_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && Array.isArray(obj.characters)) return obj;
    }
  } catch {}
  const fromMem = window.GameData?.CHARACTERS;
  if (fromMem && Array.isArray(fromMem.characters)) return JSON.parse(JSON.stringify(fromMem));
  return { characters: [] };
}

function uniquifyId(id, list){
  const taken = new Set(list.map(c => c.id));
  if (!taken.has(id)) return id;
  let n = 2; let next = `${id}-${n}`;
  while (taken.has(next)) { n++; next = `${id}-${n}`; }
  return next;
}

function saveCharactersObj(obj){
  try { localStorage.setItem(CHARS_KEY, JSON.stringify(obj, null, 2)); } catch {}
  window.GameData = window.GameData || {};
  window.GameData.CHARACTERS = obj;
  if (window.GameData.WORLD && typeof window.setGameData === 'function') {
    window.setGameData(window.GameData.WORLD, obj);
  }
  window.GameLogic?.updatePresence?.();
  window.GameKnown?.renderKnownList?.();
  window.GameUI?.renderChat?.();
}
// ===== end helpers =====
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

addEventListener('DOMContentLoaded', async ()=>{
  try { await loadIncludedCharactersOverride(); } catch(e) { console.warn('includes pre-load failed:', e); }
  boot();

  
  
// --- Bridge: keep #apiKey (llm_api_key) and Cosmos (cosmos.apiKey) in sync ---
(function bridgeCosmosKey(){
  try {
    const k1 = localStorage.getItem('llm_api_key');
    const k2 = localStorage.getItem('cosmos.apiKey');
    if (k1 && !k2) localStorage.setItem('cosmos.apiKey', k1);
    if (k2 && !k1) localStorage.setItem('llm_api_key', k2);
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('change', () => {
        const v = apiKeyInput.value.trim();
        localStorage.setItem('llm_api_key', v);
        localStorage.setItem('cosmos.apiKey', v);
      });
    }
  } catch(e) { console.warn('Cosmos key bridge failed:', e); }
})();

// chub.ai importer and export chars (outside bridgeCosmosKey)
document.getElementById('chubFile')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const text = await new Promise((res, rej) => {
      const fr = new FileReader(); fr.onerror = () => rej(fr.error || new Error('Read failed')); fr.onload = () => res(String(fr.result || '')); fr.readAsText(f, 'utf-8');
    });
    const json = JSON.parse(text);
    let npc = chubToNpc(json);
    await ensureSchedule(npc);

    const charsObj = getCharactersObj();
    const list = Array.isArray(charsObj.characters) ? charsObj.characters : (charsObj.characters = []);
    npc.id = uniquifyId(npc.id, list);
    const i = list.findIndex(c => c.id === npc.id);
    if (i >= 0) list[i] = npc; else list.push(npc);

    saveCharactersObj(charsObj);
    alert(`Imported "${npc.name}" and added to characters.json`);
  } catch (err) {
    console.error(err);
    alert('Invalid chub.ai JSON: ' + (err?.message || err));
  } finally {
    e.target.value = '';
  }
});

document.getElementById('exportChars')?.addEventListener('click', () => {
  const obj = getCharactersObj();
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'characters.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
});

// ==== Character Creation Data & Logic ====
const APPEARANCE_OPTIONS = {
  male: {
    head:  ['images/player/male/head1.png','images/player/male/head2.png','images/player/male/head3.png'],
    torso: ['images/player/male/torso1.png','images/player/male/torso2.png','images/player/male/torso3.png'],
    legs:  ['images/player/male/legs1.png','images/player/male/legs2.png','images/player/male/legs3.png'],
  },
  female: {
    head:  ['images/player/female/head1.png','images/player/female/head2.png','images/player/female/head3.png'],
    torso: ['images/player/female/torso1.png','images/player/female/torso2.png','images/player/female/torso3.png'],
    legs:  ['images/player/female/legs1.png','images/player/female/legs2.png','images/player/female/legs3.png'],
  },
  transgender: {
    head:  ['images/player/trans/head1.png','images/player/trans/head2.png','images/player/trans/head3.png'],
    torso: ['images/player/trans/torso1.png','images/player/trans/torso2.png','images/player/trans/torso3.png'],
    legs:  ['images/player/trans/legs1.png','images/player/trans/legs2.png','images/player/trans/legs3.png'],
  }
};

function defaultAppearance(g='male'){
  const opt = APPEARANCE_OPTIONS[g] || APPEARANCE_OPTIONS.male;
  return { head: opt.head[0], torso: opt.torso[0], legs: opt.legs[0] };
}

function openCharCreateModal(e){
  const overlay = document.getElementById('charCreateModal');
  if (!overlay) return;
  overlay._opener = (e && e.currentTarget) || document.activeElement;
  overlay.style.display = 'flex';
  overlay.removeAttribute('inert');
  overlay.setAttribute('aria-hidden','false');

  // Seed defaults based on current/last gender
  const st = GameState.state || {};
  const player = st.player || {};
  const gender = player.gender || 'male';
  const name = player.name || '';
  const ap = player.appearance || defaultAppearance(gender);

  // Fill inputs
  const nameEl = document.getElementById('ccName'); if (nameEl) nameEl.value = name;
  const gEls = document.querySelectorAll('input[name="ccGender"]');
  gEls.forEach(r => { r.checked = (r.value === gender); });

  // Render option grids & preview
  renderAppearanceSelectors(gender, ap);
  wireCharCreateEvents();
  const _t = nameEl || overlay; if (_t && typeof _t.focus === 'function') _t.focus({ preventScroll:true });
}

function closeCharCreateModal(){
  const overlay = document.getElementById('charCreateModal');
  if (!overlay) return;
  if (overlay.contains(document.activeElement)) document.activeElement.blur();
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden','true');
  overlay.setAttribute('inert','');
  const __op = overlay._opener || document.getElementById('openSettings') || document.body; if (__op && typeof __op.focus === 'function') __op.focus();
}

function wireCharCreateEvents(){
  document.getElementById('charCreateCloseBtn')?.addEventListener('click', closeCharCreateModal, { once:true });
  // Gender change re-renders selectors with defaults
  document.querySelectorAll('input[name="ccGender"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const g = document.querySelector('input[name="ccGender"]:checked')?.value || 'male';
      renderAppearanceSelectors(g, defaultAppearance(g));
    });
  });
  document.getElementById('ccSave')?.addEventListener('click', saveCharacterFromModal, { once:true });
}

function renderAppearanceSelectors(gender, ap){
  const opts = APPEARANCE_OPTIONS[gender] || APPEARANCE_OPTIONS.male;
  renderOptionStrip('ccHead',  opts.head,  ap.head,  (v)=>{ ap.head=v; updatePreview(ap); });
  renderOptionStrip('ccTorso', opts.torso, ap.torso, (v)=>{ ap.torso=v; updatePreview(ap); });
  renderOptionStrip('ccLegs',  opts.legs,  ap.legs,  (v)=>{ ap.legs=v; updatePreview(ap); });
  updatePreview(ap);
  // stash draft on overlay for access on save
  const overlay = document.getElementById('charCreateModal');
  overlay._apDraft = ap;
}

function renderOptionStrip(id, list, current, onPick){
  const box = document.getElementById(id);
  if (!box) return;
  box.innerHTML = '';
  list.forEach(src => {
    const b = document.createElement('button');
    b.className = 'btn-ghost';
    b.style.padding = '.25rem'; b.style.borderRadius = '10px';
    b.style.borderColor = (src === current) ? '#67c1f5' : '#2a3441';
    b.innerHTML = `<img src="${src}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #1b222b" />`;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      onPick(src);
      // re-render to reflect selection highlight
      renderOptionStrip(id, list, src, onPick);
    });
    box.appendChild(b);
  });
}

function updatePreview(ap){
  const h = document.getElementById('ccPreviewHead');
  const t = document.getElementById('ccPreviewTorso');
  const l = document.getElementById('ccPreviewLegs');
  if (h) h.src = ap.head;
  if (t) t.src = ap.torso;
  if (l) l.src = ap.legs;
}

function saveCharacterFromModal(){
  const overlay = document.getElementById('charCreateModal');
  const name = document.getElementById('ccName')?.value?.trim() || '';
  const gender = document.querySelector('input[name="ccGender"]:checked')?.value || 'male';
  const ap = overlay?._apDraft || defaultAppearance(gender);

  const player = {
    name: name || 'Player',
    gender,
    age: 18,
    family: ['mother','sister'],
    appearance: ap,
    description: `${name || 'You'} are 18, just finished high school, living with Mom and Sister. Gender: ${gender}.`
  };
  // (no reassign) GameState.state is a module export object
  GameState.state.player = player;
  try { GameState.saveState?.(); } catch(e){}

  renderPlayerCard();
  closeCharCreateModal();
}

function renderPlayerCard(){
  const box = document.getElementById('sidebarInfo');
  if (!box) return;

  const p = (window.GameState && window.GameState.state && window.GameState.state.player) || null;
  box.innerHTML = '';
  if (!p){
    box.innerHTML = '<div class="small">No character yet.</div>';
    return;
  }

  const ap = p.appearance || {};
  const wrapStyle = 'display:flex;flex-direction:column;gap:.5rem';
  const title = 'font-size:.8rem;opacity:.85;letter-spacing:.02em';
  const label = 'font-size:.75rem;opacity:.75;margin:.25rem 0 .1rem';
  const boxStyle = 'width:100%;height:100px;border:1px solid #1b222b;border-radius:10px;background:#0f141a;display:flex;align-items:center;justify-content:center;overflow:hidden';
  const imgStyle = 'max-width:100%;max-height:100%;object-fit:cover;display:block';

  box.innerHTML = `
    <div style="${wrapStyle}">
      <div style="${title}">Your Info</div>

      <div class="pc-name">${p.name || 'Player'}</div>
      <div class="small">Sex: ${p.gender || '—'}</div>

      <div style="${label}">Head</div>
      <div style="${boxStyle}">
        ${ap.head ? `<img src="${ap.head}" alt="Head" style="${imgStyle}">` : '<div class="small" style="opacity:.6">No head selected</div>'}
      </div>

      <div style="${label}">Torso</div>
      <div style="${boxStyle}">
        ${ap.torso ? `<img src="${ap.torso}" alt="Torso" style="${imgStyle}">` : '<div class="small" style="opacity:.6">No torso selected</div>'}
      </div>

      <div style="${label}">Legs</div>
      <div style="${boxStyle}">
        ${ap.legs ? `<img src="${ap.legs}" alt="Legs" style="${imgStyle}">` : '<div class="small" style="opacity:.6">No legs selected</div>'}
      </div>
    </div>
  `;
}// Open creation on first run
(function ensurePlayerAtStart(){
  const p = (GameState.state && GameState.state.player) || null;
  if (!p) {
    // Delay until DOM ready
    setTimeout(()=> openCharCreateModal(), 50);
  } else {
    renderPlayerCard();
  }
})();

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

  // --- Character Builder wiring ---
  { const el = document.getElementById('openCharBuilder');  if (el) el.addEventListener('click', CharBuild.openCharacterBuilder); }
  { const el = document.getElementById('charBuildCloseBtn'); if (el) el.addEventListener('click', CharBuild.closeCharacterBuilder); }
  { const el = document.getElementById('charBuildCancel'); if (el) el.addEventListener('click', CharBuild.closeCharacterBuilder); }
  document.getElementById('charBuildModal')?.addEventListener('click', (e)=>{
    if (e.target && e.target.id === 'charBuildModal') CharBuild.closeCharacterBuilder();
  });
  { const el = document.getElementById('charBuildGenerate'); if (el) el.addEventListener('click', CharBuild.generateCharacterFromPrompt); }
  { const el = document.getElementById('charBuildSave');      if (el) el.addEventListener('click', CharBuild.addCharacterToGame); }

});
// Close character create when clicking the backdrop
document.getElementById('charCreateModal')?.addEventListener('click', (e)=>{
  if (e.target && e.target.id === 'charCreateModal') closeCharCreateModal();
});


// === Characters includes loader ===
// If characters.json has "includes": ["characters/sarah.json", ...], aggregate them.
// We seed the local override (CHARS_KEY) so existing getCharactersObj() continues to work unchanged.

// === Characters includes loader ===
// Aggregate per-file characters listed in characters.json.includes into localStorage[CHARS_KEY]
async function loadIncludedCharactersOverride(){
  const CK = (typeof CHARS_KEY !== 'undefined') ? CHARS_KEY : 'characters_json_override_v1';
  try {
    const baseRes = await fetch('characters.json', { cache: 'no-store' });
    if (!baseRes.ok) { console.warn('characters.json fetch failed:', baseRes.status); return; }
    const base = await baseRes.json();
    const includes = Array.isArray(base.includes) ? base.includes : [];
    let list = Array.isArray(base.characters) ? base.characters.slice() : [];

    const baseUrl = new URL(location.pathname.replace(/[^/]*$/, ''), location.origin);
    for (const raw of includes){
      try {
        const url = new URL(String(raw), baseUrl);
        const r = await fetch(url.href, { cache: 'no-store' });
        if (!r.ok) { console.warn('include fetch failed:', raw, r.status); continue; }
        const j = await r.json();
        if (Array.isArray(j?.characters)) list.push(...j.characters);
        else if (j && typeof j === 'object') list.push(j);
      } catch(e){ console.warn('include load error:', raw, e); }
    }

    if (!list.length) {
      console.warn('No characters loaded from includes. Using base.characters if present.');
      if (!Array.isArray(base.characters)) {
        console.warn('No base.characters found either.');
      }
    }

    const merged = { ...base };
    if (list.length) merged.characters = list;

    localStorage.setItem(CK, JSON.stringify(merged));
    try { window.GameLogic?.updatePresence?.(); } catch (e) {
      console.warn('GameLogic.updatePresence failed:', e);
    }
  } catch (e) {
    console.warn('includes loader failed:', e);
  }
}
