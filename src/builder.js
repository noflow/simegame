// src/builder.js
import { TIME_SLOTS } from './constants.js';

let wired = false;

function el(id){ return document.getElementById(id); }
function show(id, on=true){
  const n = el(id); if(!n) return; n.style.display = on ? 'flex' : 'none';
  n.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function slugify(s){
  return String(s||'npc').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32) || 'npc';
}
function uniqueId(base){
  const taken = new Set((window.GameData?.CHARACTERS?.characters || []).map(c=>c.id));
  if(!taken.has(base)) return base;
  let i=2;
  while(taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function fallbackLocation(){
  const world = window.GameData?.WORLD || null;
  if (world?.passages && world.passages["Your Room"]) return "Your Room";
  const keys = world?.passages ? Object.keys(world.passages) : [];
  return keys[0] || "Your Room";
}

function normalizeNPC(npc){
  const out = Object.assign({
    id: '',
    name: 'Unnamed',
    role: '',
    location: window.GameState?.state?.location || fallbackLocation(),
    avatar: '',
    persona: '',
    greeting: '',
    greetings: { work:'', home:'', casual:'' },
    traits: [],
    sexuality: { orientation: '' },
    appearance: { height:'', weight:'', hair:'', eyes:'', style:'' },
    schedule: []
  }, npc || {});

  // id
  let base = slugify(out.id || out.name);
  out.id = uniqueId(base || 'npc');

  // location
  if (!out.location) out.location = fallbackLocation();

  // schedule (fallback if empty)
  if (!Array.isArray(out.schedule) || out.schedule.length === 0) {
    out.schedule = [{
      location: out.location,
      days: [1,2,3,4,5],
      slots: ["morning","lunch","afternoon"]
    }];
  } else {
    // ensure valid fields
    out.schedule = out.schedule.map(r => ({
      location: r.location || out.location,
      days: Array.isArray(r.days) && r.days.length ? r.days : [1,2,3,4,5],
      slots: Array.isArray(r.slots) && r.slots.length ? r.slots.filter(s=>TIME_SLOTS.includes(s)) : ["morning","afternoon"]
    }));
  }

  // greetings shim
  if (!out.greetings || typeof out.greetings !== 'object') {
    out.greetings = { work: '', home: '', casual: '' };
  }
  if (!out.greeting && out.greetings.casual) out.greeting = out.greetings.casual;

  return out;
}

function extractJsonBlock(s){
  // Try to pull the biggest JSON object in the string
  const m = s.match(/\{[\s\S]*\}$/m) || s.match(/\{[\s\S]*\}/m);
  return m ? m[0] : s;
}

function safeParse(jsonLike){
  try {
    return JSON.parse(jsonLike);
  } catch(e){
    try { return JSON.parse(extractJsonBlock(jsonLike)); }
    catch(_) { return null; }
  }
}

async function generateFromIdea(idea){
  const world = window.GameData?.WORLD || {};
  const knownPlaces = world?.passages ? Object.keys(world.passages).slice(0,25) : [];
  const slots = TIME_SLOTS.join(', ');

  const schema = {
    id: "kebab-case identifier (optional)",
    name: "display name",
    role: "short job/role (e.g., Barista, Librarian)",
    location: "one of the current world locations",
    avatar: "optional URL string (can be empty)",
    persona: "1–3 sentences of vibe/voice/background",
    greeting: "short first line if the player meets them casually",
    greetings: {
      work: "if player meets them at work",
      home: "if player meets them at home",
      casual: "if player meets them anywhere else"
    },
    traits: ["curious","punctual","sarcastic"],
    sexuality: { orientation: "optional short label" },
    appearance: { height:"", weight:"", hair:"", eyes:"", style:"" },
    schedule: [
      { location: "Coffee Shop", days: [1,2,3,4,5], slots: ["morning","lunch","afternoon"] }
    ]
  };

  const prompt = [
`You are an NPC character generator for a slice-of-life game.`,
`Return STRICT JSON ONLY that matches the schema below (no markdown, no prose).`,
`Days are numeric 1..7 (Mon..Sun). Time slots are: ${slots}.`,
`Choose the "location" from this world list if possible: ${knownPlaces.join(', ') || '(none provided)'} .`,
`Keep "persona" under 60 words, grounded and playable.`,
`Schema: ${JSON.stringify(schema, null, 2)}`,
`Concept: ${idea}`
  ].join('\n');

  const raw = await window.GameAI.llm(prompt, { temperature: 0.8, max_tokens: 700 });
  let obj = safeParse(raw);
  if (!obj) {
    // one quick repair attempt:
    const repair = await window.GameAI.llm(
      `Fix this to valid JSON that matches the schema. Do not add commentary:\n${raw}`,
      { temperature: 0 }
    );
    obj = safeParse(repair);
  }
  if (!obj) throw new Error('Model did not return valid JSON.');
  return normalizeNPC(obj);
}

function setPreview(npc){
  const box = el('builderPreview');
  if (!box) return;
  const pretty = JSON.stringify(npc, null, 2);
  box.textContent = pretty;
}

function ensureWiring(){
  if (wired) return; wired = true;

  el('builderGenerateBtn')?.addEventListener('click', async ()=>{
    const t = el('builderConcept')?.value.trim();
    if (!t) return;
    el('builderGenerateBtn').disabled = true;
    el('builderSaveBtn').disabled = true;
    el('builderStatus').textContent = 'Generating…';
    try{
      const npc = await generateFromIdea(t);
      setPreview(npc);
      // Stash on window for "Save"
      window.__BUILDER_LAST_NPC__ = npc;
      el('builderStatus').textContent = `Ready: ${npc.name} (${npc.role})`;
      el('builderSaveBtn').disabled = false;
    }catch(e){
      console.error(e);
      el('builderStatus').textContent = 'Failed to generate. Check console.';
    }finally{
      el('builderGenerateBtn').disabled = false;
    }
  });

  el('builderSaveBtn')?.addEventListener('click', ()=>{
    const txt = el('builderPreview')?.textContent || '{}';
    let npc = null;
    try { npc = normalizeNPC(JSON.parse(txt)); } catch(e){}
    if (!npc) { alert('Preview JSON is invalid.'); return; }

    // create container if needed
    if (!window.GameData.CHARACTERS) window.GameData.CHARACTERS = { characters: [] };
    if (!Array.isArray(window.GameData.CHARACTERS.characters)) window.GameData.CHARACTERS.characters = [];

    window.GameData.CHARACTERS.characters.push(npc);

    try {
      // refresh various UIs
      window.GameLogic?.updatePresence?.();
      window.GameKnown?.renderKnownList?.();
      window.GameUI?.renderChat?.();
      window.GameState?.saveState?.();
      alert(`Added "${npc.name}" to your roster.`);
    } catch(e){ console.warn('Refresh failed', e); }
  });

  el('builderCloseBtn')?.addEventListener('click', closeBuilderModal);
  el('builderModal')?.addEventListener('click', (e)=>{
    if (e.target && e.target.id === 'builderModal') closeBuilderModal();
  });
}

export function openBuilderModal(){
  ensureWiring();
  el('builderConcept').value = '';
  el('builderPreview').textContent = '{\n  "id": "",\n  "name": "",\n  "role": "",\n  "location": "",\n  "persona": ""\n}';
  el('builderStatus').textContent = 'Describe the character you want, then Generate.';
  el('builderSaveBtn').disabled = true;
  show('builderModal', true);
  el('builderConcept').focus();
}
export function closeBuilderModal(){
  show('builderModal', false);
}

// expose for convenience
window.GameBuilder = { openBuilderModal, closeBuilderModal };
