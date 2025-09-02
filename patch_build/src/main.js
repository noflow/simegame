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