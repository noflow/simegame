// src/builder/character_builder.js
const CHARS_KEY = 'characters_json_override_v1';

function $(id){ return document.getElementById(id); }
function slugify(s){
  return String(s||'npc').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32) || 'npc';
}
function uniqueId(baseId, list){
  const ids = new Set((list||[]).map(c=>c.id));
  let id = baseId || 'npc';
  let n=2;
  while(ids.has(id)) { id = `${baseId}-${n++}`; }
  return id;
}
function ensureCharsObject(){
  try{
    const raw = localStorage.getItem(CHARS_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj.characters)) return obj;
    }
  }catch{}
  const seed = (window.GameData && window.GameData.CHARACTERS) || { characters: [] };
  if (!Array.isArray(seed.characters)) seed.characters = [];
  return JSON.parse(JSON.stringify(seed));
}

function extractJsonBlock(s){
  const m = String(s||'').match(/\{[\s\S]*\}$/m) || String(s||'').match(/\{[\s\S]*\}/m);
  return m ? m[0] : s;
}
function safeParse(s){
  try{ return JSON.parse(s); }catch(e){ try{ return JSON.parse(extractJsonBlock(s)); }catch{ return null; } }
}

function normalize(npc){
  const out = Object.assign({
    id:'',name:'Unnamed',role:'',gender:'unknown',avatar:'',
    persona:'',greeting:'',greetings:{work:'',home:'',casual:''},
    appearance:{height:'',weight:'',hair:'',eyes:'',style:''},
    sexuality:{orientation:''},
    location: window.GameState?.state?.location || 'Your Room',
    traits:[],
    schedule:[{ days:[1,2,3,4,5], slots:['morning','lunch','afternoon'], location: 'Coffee Shop' }]
  }, npc||{});
  // id
  const current = window.GameData?.CHARACTERS?.characters || [];
  out.id = uniqueId(slugify(out.id || out.name || out.role || 'npc'), current);
  if (!Array.isArray(out.traits)) out.traits = [];
  if (!out.greetings) out.greetings = {work:'',home:'',casual:''};
  if (!Array.isArray(out.schedule) || !out.schedule.length) {
    out.schedule = [{ days:[1,2,3,4,5], slots:['morning','lunch','afternoon'], location: out.location }];
  }
  return out;
}

export function openCharacterBuilder(){
  const ov = $('charBuildModal'); if (!ov) return;
  ov.style.display = 'flex'; ov.setAttribute('aria-hidden','false');
  $('charBuildPrompt')?.focus();
  $('charBuildStatus') && ( $('charBuildStatus').textContent = 'Describe your character, then Generate.' );
  const ta = $('charBuildJson'); if (ta) ta.value = '';
}

export function closeCharacterBuilder(){
  const ov = $('charBuildModal'); if (!ov) return;
  ov.style.display = 'none'; ov.setAttribute('aria-hidden','true');
}

export async function generateCharacterFromPrompt(){
  const prompt = $('charBuildPrompt')?.value.trim();
  const out = $('charBuildJson');
  const status = $('charBuildStatus');
  if (!prompt) { if (status) status.textContent = 'Enter a concept first.'; return; }

  if (!window.GameAI || !window.GameAI.llm) {
    if (status) status.textContent = 'Cosmos/LLM not configured. Falling back to stub.';
    const stub = normalize({ name: 'New NPC', role: 'Citizen', persona: 'Friendly and grounded.' });
    if (out) out.value = JSON.stringify(stub, null, 2);
    return;
  }

  if (status) status.textContent = 'Generating…';

  const system = `Return ONLY valid JSON (no markdown) for an NPC:\n{
  "id": "kebab-case identifier",
  "name": "string",
  "role": "string",
  "gender": "male|female|unknown",
  "avatar": "url or empty string",
  "persona": "<=60 words, grounded, present tense",
  "greeting": "first casual line",
  "greetings": { "work": "str", "home": "str", "casual": "str" },
  "appearance": { "height":"", "weight":"", "hair":"", "eyes":"", "style":"" },
  "sexuality": { "orientation": "" },
  "location": "existing place if known",
  "traits": ["short","tokens"],
  "schedule": [ { "location":"Coffee Shop", "days":[1,2,3,4,5], "slots":["morning","lunch","afternoon"] } ]
}`;

  const user = `Concept: ${prompt}\nOutput JSON only.`;

  try{
    const content = await window.GameAI.llm({ history:[{speaker:"System", text:system}], userText: user }, { temperature:0.7, max_tokens:700 });
    let text = String(content||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'');
    let obj = safeParse(text);
    if (!obj) throw new Error('Bad JSON from model');
    obj = normalize(obj);
    if (out) out.value = JSON.stringify(obj, null, 2);
    if (status) status.textContent = `Generated: ${obj.name} (${obj.role})`;
  }catch(e){
    console.warn(e);
    if (status) status.textContent = 'Failed to generate JSON; produced a stub.';
    const stub = normalize({ name: 'New NPC', role: 'Citizen', persona: 'Friendly and grounded.' });
    if (out) out.value = JSON.stringify(stub, null, 2);
  }
}

export function addCharacterToGame(){
  const ta = $('charBuildJson');
  const status = $('charBuildStatus');
  if (!ta) return;
  let obj = null;
  try{ obj = JSON.parse(ta.value); }catch(e){ if (status) status.textContent='Fix the JSON before saving.'; return; }
  obj = normalize(obj);

  // Merge into characters
  const charsObj = ensureCharsObject();
  const list = Array.isArray(charsObj.characters) ? charsObj.characters : (charsObj.characters = []);
  const i = list.findIndex(c => c.id === obj.id);
  if (i >= 0) list[i] = obj; else list.push(obj);

  try{
    localStorage.setItem(CHARS_KEY, JSON.stringify(charsObj, null, 2));
  }catch(e){ console.warn('Could not persist to localStorage', e); }

  try{
    window.GameData = window.GameData || {};
    window.GameData.CHARACTERS = charsObj;
    if (typeof window.setGameData === 'function' && window.GameData.WORLD) {
      window.setGameData(window.GameData.WORLD, window.GameData.CHARACTERS);
    }
    window.GameLogic?.updatePresence?.();
    if (status) status.textContent = `Saved "${obj.name}".`;
  }catch(e){
    console.warn('Applied but UI refresh may need reload.', e);
  }
}
