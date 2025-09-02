#!/usr/bin/env bash
set -euo pipefail

# Output zips will be created in the current directory.
# Requires: bash + zip

# --- helpers ---
write() { mkdir -p "$(dirname "$1")"; printf "%s" "$2" > "$1"; }

# =========================
# 1) PATCH ZIP (index.html + src/main.js)
# =========================
PATCH_DIR="patch_build"
rm -rf "$PATCH_DIR"
mkdir -p "$PATCH_DIR/src"

# --- index.html (patched, includes chub.ai loader control) ---
write "$PATCH_DIR/index.html" '<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AI NPC Game (Modular)</title>
<style>
  :root{ --bg:#0b0d10; --panel:#12161b; --muted:#9aa5b1; --text:#e6eef7; --accent:#67c1f5; }
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial;background:var(--bg);color:var(--text)}
  header{display:flex;gap:.75rem;align-items:center;padding:.75rem 1rem;border-bottom:1px solid #1b222b;position:sticky;top:0;background:#0b0d10}
  .pill{padding:.25rem .5rem;border-radius:999px;background:#0f141a;border:1px solid #1d2631;color:var(--muted);font-size:.85rem}
  .layout{display:grid;grid-template-columns:260px 1fr 360px;gap:12px;padding:12px}
  .card{background:var(--panel);border:1px solid #1b222b;border-radius:14px;overflow:hidden}
  .card h2{font-size:1rem;margin:0;padding:.8rem .9rem;border-bottom:1px solid #1b222b}
  .card .body{padding:.9rem}
  .row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  button,input,textarea{background:#0f141a;border:1px solid #2a3441;color:var(--text);border-radius:10px;padding:.55rem .7rem;font:inherit}
  button{background:#18212b;cursor:pointer} button:hover{background:#1d2733}
</style>
</head>
<body>
  <header>
    <h1 style="font-size:1rem;margin:0;">AI NPC Game (Modular)</h1>
    <span class="pill">Location: <span id="loc">—</span></span>
    <span class="pill">Day: <span id="day">1</span></span>
    <span class="pill">Time: <span id="time">morning</span></span>
    <span class="pill">Money: <span id="money">$50</span></span>
    <span style="margin-left:auto"></span>
    <button id="advance">Advance Time</button>
    <button id="openSettings">Settings</button>
  </header>

  <main class="layout">
    <aside class="card"><h2>Menu</h2><div class="body">
      <div class="row" style="gap:.4rem;">
        <button id="openKnown">Known (<span id="knownCount">0</span>)</button>
      </div>
      <div class="row" style="gap:.4rem;margin-top:.5rem;">
        <button id="openSettings2">Open Settings</button>
      </div>
    </div></aside>

    <section class="card"><h2>World</h2><div class="body">
      <div id="mapMedia"><img id="locationImage" style="width:100%;height:220px;object-fit:cover;border:1px solid #1b222b;border-radius:10px;display:none"/></div>
      <div id="locationDesc"><b>No world loaded yet.</b><br/>Open <i>Settings → World & Characters</i> to load your JSON.</div>
      <div style="height:1px;background:#1b222b;margin:.8rem 0"></div>
      <div class="row small" style="opacity:.8">Who&apos;s here</div>
      <div id="presence" class="small">—</div>
      <div id="hereNPCs" style="display:flex;flex-direction:column;gap:.5rem;margin-top:.4rem;"></div>
    </div></section>

    <aside class="card"><h2>Bag & Data</h2><div class="body">
      <div class="row"><input id="newItem" placeholder="Add item"/><button id="addItem">Add</button></div>
      <div id="inv"></div>
      <div style="height:1px;background:#1b222b;margin:.8rem 0"></div>
      <div class="row"><input id="moneyDelta" type="number" step="1" placeholder="±$" style="width:90px"/><button id="applyMoney">Apply</button></div>
    </div></aside>
  </main>

  <!-- Settings Modal (world/characters/chub.ai import) -->
  <div id="settingsModal" class="modal-overlay" aria-hidden="true" style="position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:2000">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle" style="width:min(720px,95vw);background:#12161b;border:1px solid #1b222b;border-radius:14px;overflow:hidden">
      <header style="display:flex;align-items:center;gap:.6rem;padding:.7rem .9rem;border-bottom:1px solid #1b222b;background:#0f141a">
        <h3 id="settingsTitle" style="margin:0;font-size:.98rem">Settings</h3>
        <span style="margin-left:auto"></span>
        <button class="close" id="settingsCloseBtn" title="Close" style="margin-left:auto;background:#222;border:1px solid #2a3441;border-radius:8px;padding:.25rem .5rem;cursor:pointer">×</button>
      </header>
      <div class="body" style="padding:.9rem">
        <label class="small">LLM API Key
          <input id="apiKey" type="text" placeholder="Paste key…" style="width:100%"/>
        </label>

        <div style="height:1px;background:#1b222b;margin:.8rem 0"></div>

        <h3 class="small" style="margin:.25rem 0 .5rem 0;">World & Characters</h3>
        <div class="row" style="gap:.75rem; flex-wrap:wrap">
          <label class="btn-ghost" for="mapFile">Load map.json</label>
          <input id="mapFile" type="file" accept="application/json" style="display:none"/>

          <label class="btn-ghost" for="charsFile">Load characters.json</label>
          <input id="charsFile" type="file" accept="application/json" style="display:none"/>

          <label class="btn-ghost" for="chubFile">Load chub.ai character.json</label>
          <input id="chubFile" type="file" accept="application/json" style="display:none"/>
        </div>
        <p class="small" id="dataStatus" style="opacity:.8;margin:.25rem 0 0 0;">
          Using: <span id="worldSource">none</span> · <span id="charsSource">none</span>
        </p>
      </div>
    </div>
  </div>

<link rel="icon" href="data:," />
<script src="./src/cosmos.js"></script>
<script type="module" src="./src/main.js?v=21"></script>
</body></html>
'

# --- src/main.js (patched) ---
write "$PATCH_DIR/src/main.js" "$(cat <<'JS'
// src/main.js (patched with chub.ai import + auto-schedule)
export const TIME_SLOTS = ["early_morning","morning","lunch","afternoon","evening","night"];
const WORLD_KEY = 'world_json_override_v1';
const CHARS_KEY = 'characters_json_override_v1';

function get(world,key){ return world?.[key]; }
function $(id){ return document.getElementById(id); }
function readFileAsText(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=()=>rej(fr.error||new Error('Read failed'));fr.onload=()=>res(String(fr.result||''));fr.readAsText(file,'utf-8');});}

function setStatus(){
  const w = localStorage.getItem(WORLD_KEY);
  const c = localStorage.getItem(CHARS_KEY);
  const wEl = $('worldSource'), cEl = $('charsSource');
  if (wEl) wEl.textContent = w ? 'custom map.json' : 'none';
  if (cEl) cEl.textContent = c ? 'custom characters.json' : 'none';
}

// --- AI client (CosmosRP) ---
async function cosmosChat({messages, temperature=0.7, max_tokens=512}){
  const key = localStorage.getItem('cosmos.apiKey') || localStorage.getItem('llm_api_key');
  if (!key) throw new Error('CosmosRP API key missing in Settings.');
  const base = (localStorage.getItem('cosmos.baseUrl') || 'https://api.pawan.krd/cosmosrp/v1').replace(/\/+$/,'');
  const endpoint = (localStorage.getItem('cosmos.endpointOverride') || `${base}/chat/completions`);
  const res = await fetch(endpoint, {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${key}`,'Content-Type':'application/json' },
    body: JSON.stringify({ model: localStorage.getItem('cosmos.model') || 'cosmosrp-v3.5', messages, temperature, max_tokens })
  });
  if(!res.ok){ throw new Error(`CosmosRP ${res.status}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

// --- Scheduling helpers ---
function getWorldPlaces(limit=24){
  try{
    const p = window.GameData?.WORLD?.passages || {};
    return Object.keys(p).slice(0,limit);
  }catch{ return ['Your Room']; }
}
function sanitizeSchedule(arr, places, slots){
  const okd = d=> Number.isInteger(d)&&d>=1&&d<=7;
  return (Array.isArray(arr)?arr:[]).map(r=>({
    location: places.includes(r.location)?r.location:(places[0]||'Your Room'),
    days: (Array.isArray(r.days)?r.days.filter(okd):[1,2,3,4,5]),
    slots:(Array.isArray(r.slots)?r.slots.filter(s=>slots.includes(s)):['morning','afternoon'])
  })).filter(r=>r.days.length&&r.slots.length);
}
function hash32(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function seeded(seed){ seed=(seed*1664525+1013904223)>>>0; return [seed, (seed/0xffffffff)]; }
function randomScheduleFor(npc){
  const PLACES=getWorldPlaces(24), SLOTS=TIME_SLOTS;
  let seed=hash32((npc.name||'npc')+'|'+(npc.role||'')+'|'+(npc.persona||''));
  const picks=new Set(); const target=1+Math.floor((seed%3));
  for(let i=0;i<PLACES.length && picks.size<target+1;i++){ [seed]=seeded(seed); picks.add(PLACES[Math.floor(seed*PLACES.length)%PLACES.length]); }
  const core=[...picks]; const wk=[1,2,3,4,5], we=[6,7];
  const workSlots=SLOTS.filter(s=>/^(early_morning|morning|lunch|afternoon)$/.test(s))||SLOTS.slice(0,3);
  const eveSlots=SLOTS.filter(s=>/^(evening|night)$/.test(s))||SLOTS.slice(-2);
  const sched=[];
  if(core[0]) sched.push({location:core[0], days:wk, slots:workSlots.slice(0,3)});
  if(core[1]) sched.push({location:core[1], days:wk, slots:workSlots.slice(1,3)});
  sched.push({location:core[2]||core[1]||core[0]||PLACES[0]||'Your Room', days:we, slots:eveSlots});
  return sanitizeSchedule(sched, PLACES, SLOTS);
}
async function aiSuggestSchedule(npc){
  const PLACES=getWorldPlaces(24), SLOTS=TIME_SLOTS;
  try{
    const sys='Return STRICT JSON ONLY: an array of {location, days[1..7], slots[from provided]} using only given places/slots.';
    const user=JSON.stringify({npc:{name:npc.name,role:npc.role,persona:npc.persona}, places:PLACES, slots:SLOTS});
    const raw = await cosmosChat({messages:[{role:'system',content:sys},{role:'user',content:user}], temperature:0.3, max_tokens:500});
    const text=String(raw||'').trim().replace(/^```json/i,'').replace(/```$/,'');
    const parsed=JSON.parse(text);
    const clean=sanitizeSchedule(parsed, PLACES, SLOTS);
    if (!clean.length) throw new Error('empty');
    return clean;
  }catch(e){
    console.warn('AI schedule failed, fallback to random', e?.message||e);
    return randomScheduleFor(npc);
  }
}
async function ensureSchedule(npc){
  const PLACES=getWorldPlaces(24), SLOTS=TIME_SLOTS;
  if (Array.isArray(npc.schedule) && npc.schedule.some(r=>r&&r.location)) {
    npc.schedule = sanitizeSchedule(npc.schedule, PLACES, SLOTS);
    if (npc.schedule.length) return npc;
  }
  npc.schedule = await aiSuggestSchedule(npc);
  return npc;
}

// --- chub.ai adapter ---
function chubToNpc(json){
  return {
    id: (json.name||'npc').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,32) || 'npc',
    name: json.name || 'Unnamed',
    role: json.description || json.scenario || 'Citizen',
    gender: json.gender || 'unknown',
    avatar: json.avatar || '',
    persona: json.persona || json.description || '',
    greeting: json.greeting || '',
    greetings:{ work:'', home:'', casual: json.greeting||'' },
    appearance:{ height:'', weight:'', hair:'', eyes:'', style:'' },
    sexuality:{ orientation:'' },
    location:'Your Room',
    traits: Array.isArray(json.tags)? json.tags.slice(0,8) : [],
    schedule: Array.isArray(json.schedule)? json.schedule : []
  };
}

// --- basic boot/UI wiring (minimal to keep patch small) ---
window.GameData = { WORLD:null, CHARACTERS:null };

function openSettings(){ const m=$('settingsModal'); if(!m) return; m.style.display='flex'; m.setAttribute('aria-hidden','false'); setStatus(); }
function closeSettings(){ const m=$('settingsModal'); if(!m) return; m.style.display='none'; m.setAttribute('aria-hidden','true'); }

async function onLoadJson(inputEl, key){
  const f=inputEl.files && inputEl.files[0]; if(!f) return;
  try{
    const text=await readFileAsText(f); const json=JSON.parse(text);
    localStorage.setItem(key, text);
    if(key===WORLD_KEY){ window.GameData.WORLD=json; }
    if(key===CHARS_KEY){ window.GameData.CHARACTERS=json; }
    alert('Loaded '+(key===WORLD_KEY?'map.json':'characters.json'));
  }catch(err){ alert('Invalid JSON: '+(err.message||err)); }
  finally{ inputEl.value=''; setStatus(); }
}

document.addEventListener('DOMContentLoaded', ()=>{
  $('openSettings')?.addEventListener('click', openSettings);
  $('openSettings2')?.addEventListener('click', openSettings);
  $('settingsCloseBtn')?.addEventListener('click', closeSettings);
  $('settingsModal')?.addEventListener('click', e=>{ if(e.target.id==='settingsModal') closeSettings(); });

  $('mapFile')?.addEventListener('change', e=> onLoadJson(e.target, WORLD_KEY));
  $('charsFile')?.addEventListener('change', e=> onLoadJson(e.target, CHARS_KEY));

  // chub.ai import + schedule
  $('chubFile')?.addEventListener('change', async (e)=>{
    const f=e.target.files && e.target.files[0]; if(!f) return;
    try{
      const text=await readFileAsText(f); const json=JSON.parse(text);
      let npc = chubToNpc(json);
      await ensureSchedule(npc);

      const charsObj = window.GameData.CHARACTERS || { characters: [] };
      const list = Array.isArray(charsObj.characters) ? charsObj.characters : (charsObj.characters = []);
      const i = list.findIndex(c => c.id === npc.id);
      if (i>=0) list[i]=npc; else list.push(npc);

      localStorage.setItem(CHARS_KEY, JSON.stringify(charsObj, null, 2));
      window.GameData.CHARACTERS = charsObj;
      alert(`Imported ${npc.name} with a generated schedule.`);
    }catch(err){
      console.error(err);
      alert('Invalid chub.ai JSON: '+(err.message||err));
    }finally{ e.target.value=''; }
  });

  setStatus();
});
JS
)"

( cd "$PATCH_DIR" && zip -r ../patch_chub_import_ai_schedule.zip . >/dev/null )

# =========================
# 2) FULL PROJECT ZIP (uses the same patched files + minimal stubs)
# =========================
FULL_DIR="game_project"
rm -rf "$FULL_DIR"
mkdir -p "$FULL_DIR/src" "$FULL_DIR/chat" "$FULL_DIR/src/render" "$FULL_DIR/src/known" "$FULL_DIR/src/builder"

# Reuse the patched files
cp -a "$PATCH_DIR/index.html" "$FULL_DIR/index.html"
cp -a "$PATCH_DIR/src/main.js" "$FULL_DIR/src/main.js"

# Minimal supporting modules (stubs, enough to run)
write "$FULL_DIR/src/constants.js" 'export const TIME_SLOTS=["early_morning","morning","lunch","afternoon","evening","night"]; export const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];'
write "$FULL_DIR/src/state.js" 'export const state={location:"Your Room",day:1,timeIndex:1,money:50,inventory:[]}; export function loadState(){} export function saveState(){localStorage.setItem("game_state_v1",JSON.stringify(state));}'
write "$FULL_DIR/src/storage.js" 'export function loadApiKey(){const k=localStorage.getItem("llm_api_key"); const i=document.getElementById("apiKey"); if(i&&k) i.value=k;}'
write "$FULL_DIR/src/data.js" 'export let WORLD=null,CHARACTERS=null; export function setGameData(w,c){WORLD=w;CHARACTERS=c;}'
write "$FULL_DIR/src/render/sidebar.js" 'export function renderSidebar(){} export function renderInventory(){} export function renderMoney(){const m=document.getElementById("money"); if(m) m.textContent="$50";}'
write "$FULL_DIR/src/render/map.js" 'export function renderLocation(){} export function goTo(){}'
write "$FULL_DIR/src/presence.js" 'export function updatePresence(){}'
write "$FULL_DIR/chat/index.js" 'export function renderChat(){} export function startChat(){} export function getRelationship(){return {introduced:true,history:[],discoveredTraits:[]}}'
write "$FULL_DIR/src/known/index.js" 'export function openKnownModal(){} export function closeKnownModal(){} export function renderKnownList(){}'

# Tiny Cosmos client (stub) so main.js can call window.CosmosRP if the user configures it later
write "$FULL_DIR/src/cosmos.js" 'window.CosmosRP=window.CosmosRP||{ async callChat(){ throw new Error("Set CosmosRP API key in localStorage to enable."); } };'

( cd "$FULL_DIR" && zip -r ../ai-npc-game.zip . >/dev/null )

# =========================
# 3) RAW UPLOADED FILES ZIP (if you have your originals in this folder)
# =========================
# Place your originals (index.html, main.js, etc.) alongside this script, then run:
#   zip -r ai-npc-game_raw.zip index.html main.js constants.js storage.js state.js builder.js presence.js sidebar.js cosmos.js data.js map.js debug.js index.js character_builder.js cosmos_patcher.js index.html.backup main.js.backup
echo "Done. Created: ai-npc-game.zip, patch_chub_import_ai_schedule.zip"
