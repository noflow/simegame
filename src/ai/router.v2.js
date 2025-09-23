export const ROUTER_BUILD = 'v3.0-training';
import { getPack, matchTopic, sample } from './training.js';
import { generateLocal } from './generator.local.js';
import { generateLLM } from './bridge.js';
import { llmChat } from './adapter.js';

function normalizePlaceName(name){
  if (!name) return 'City';
  let n = String(name).trim();
  const map = {
    'city center':'City Center',
    'downtown':'City Center',
    'living room':'Living Room',
    'lounge':'Living Room',
    'kitchen':'Kitchen',
    'bedroom':'Bedroom',
    "sister's room":"Sister's Room",
    'sisters room':"Sister's Room",
    'apartment':'Apartments',
    'apt':'Apartments',
    'mall':'Mall',
    'plaza':'City Center',
    'park':'Park'
  };
  const key = n.toLowerCase();
  return map[key] || (n[0].toUpperCase() + n.slice(1));
}
function zoneOf(place){
  const p = String(place||'').toLowerCase();
  if (p.includes('city') || p.includes('plaza') || p.includes('mall') || p.includes('park')) return 'city';
  if (p.includes('room') || p.includes('kitchen') || p.includes('living') || p.includes('apartment')) return 'home';
  return 'city';
}

function pronounPack(gender){
  const g = String(gender||'').toLowerCase();
  if (g==='male' || g==='man' || g==='m') return {subj:'he', obj:'him', poss:'his', pair:'he/him'};
  if (g==='female' || g==='woman' || g==='f' || g==='transgender' || g==='transgender female' || g==='trans_female') return {subj:'she', obj:'her', poss:'her', pair:'she/her'};
  return {subj:'they', obj:'them', poss:'their', pair:'they/them'};
}

function normPlace(p){
  if (!p) return 'City';
  const m = String(p).trim();
  const map = {
    'city center':'City Center',
    'sisters room':"Sister's Room",
    "sister's room":"Sister's Room",
    'apt':'Apartments',
    'apartment':'Apartments',
    'apartments':'Apartments'
  };
  const key = m.toLowerCase();
  return map[key] || m;
}

export async function respondToV2(userText, ctx){
  try {
    const text = String(userText||'').trim();
    const npc = (ctx && ctx.npc) || { id:'npc', name:'NPC', role:'friend', chat_behavior:{} };
    const world = (ctx && ctx.world) || {};
    const player = (ctx && ctx.player) || { id:'MC', name:'You', gender:'unknown' };
    const historyCount = Number(ctx && ctx.historyCount || 0);
    const style = (ctx && ctx.aiStyle) || 'expressive';
    const rel = (ctx && (ctx.relationship || ctx.relInfo)) || null;
    const relationship = rel; // alias for backward-compat

    const place = normPlace(world.location || 'City');
    const pr = pronounPack(player.gender);
    const lower = text.toLowerCase();
    const pack = getPack(npc);
    // Intent regexes (normalized)
    const reHi = /\b(hi|hello|hey|yo|sup)\b/i;
    const reHow = /\b(how are you|how's it going|how are u|how r (you|u))\b/i;
    const reWhere = /\b(where(\s+are|\s*r)?\s*(you|u|ya)|where\s+(are\s+)?you\s+at|where\s+u\s+at|where\s*are\s*you\s*right\s*now|where\s+is\s+this|what\s+(place|location))\b/i;
    const reWhoAmI = /\b(who\s+am\s+i|do\s+you\s+know\s+who\s+i\s+am|do\s+you\s+know\s+my\s+name|what('?| i)?s\s+my\s+name|what\s+is\s+my\s+name)\b/i;
    const reWhatDoYouDo = /\b(what\s+do\s+you\s+do|your\s+job|what\s+is\s+your\s+work|what\s+is\s+your\s+role)\b/i;
    const isAllowedIntent = reHi.test(lower) || reHow.test(lower) || reWhere.test(lower) || reWhoAmI.test(lower) || reWhatDoYouDo.test(lower);

    const __aiMode = (localStorage.getItem('ai_mode') || 'hybrid'); // 'hybrid' | 'llm' | 'router'
    const __aiFreedom = Math.max(0, Math.min(1, Number(localStorage.getItem('ai_freedom') || 0.5)));
    async function hybridGenerate(){
      if (__aiMode === 'llm' || (__aiMode==='hybrid' && Math.random() < 0.5)){
        let llm = null;
      try{
        const sys = buildSystemPrompt({ npc, world, player, gameState: ctx && ctx.gameState });
        const hist = Array.isArray(ctx?.recentHistory) ? ctx.recentHistory.slice(-8) : [];
        const messages = [{ role:'system', content: sys }, ...hist, { role:'user', content: userText }];
        llm = await llmChat(messages, { max_tokens: 220, temperature: 0.75 });
        if (llm && typeof llm === 'string' && llm.trim()) return llm.trim();
      }catch(_e){}
      }
      if (__aiMode !== 'router' && Math.random() < __aiFreedom){
        try { return generateLocal(userText, ctx, pack); } catch(_e){}
      }
      return null;
    }
    // Freedom dial: 0..1 (default 0.35)
    const freedom = Math.max(0, Math.min(1, Number(localStorage.getItem('ai_freedom') || 0.35)));
    function freeformLine(){
      const z = zoneOf(place);
      const tone = (pack && pack.tone) || [];
      const flavor = tone && tone.length ? tone[0] : (npc.persona || '').split(';')[0].trim();
      const cityActs = ['people-watch', 'grab coffee', 'browse the mall', 'walk the plaza', 'hit the park'];
      const homeActs = ['talk in the Kitchen', 'move to the Living Room', 'keep it low in the Bedroom'];
      const act = (z==='city') ? cityActs[Math.floor(Math.random()*cityActs.length)]
                               : homeActs[Math.floor(Math.random()*homeActs.length)];
      const hooks = ['What do you think?', 'Want to?', 'If you\'re up for it.', 'Your call.'];
      const hook = hooks[Math.floor(Math.random()*hooks.length)];
      const base = flavor ? `${flavor}.` : `${npc.name}.`;
      let line = `${base} We could ${act}. ${hook}`;
      return line.trim();
    }

    
    // Location-aware suggestion (occasional, expressive only)
    function maybeSuggest(place){
      if (style!=='expressive') return null;
      if (Math.random() > 0.2) return null;
      const z = zoneOf(place);
      if (z==='city'){
        const opts = ['grab coffee', 'walk the plaza', 'check the mall', 'hit the park'];
        const act = opts[Math.floor(Math.random()*opts.length)];
        return `We could ${act}.`;
      } else {
        const opts = ['shift to the Living Room', 'talk in the Kitchen', 'take this to the Bedroom'];
        const act = opts[Math.floor(Math.random()*opts.length)];
        return act.replace('shift to','Let’s shift to');
      }
    }
// Intents
    
    
    // Movement intents: "let's go to the living room", "go to city center"
    const reMove = /\b(let'?s\s+)?(go|move|head|walk)\s+(to|into)\s+(the\s+)?([a-z][a-z\s']+)\b/;
    function movementReply(targetRaw){
      const target = normalizePlaceName(targetRaw);
      const line = style==='expressive' ? `Alright. Let's go to the ${target}.` : `Going to the ${target}.`;
      // Emit a directive the runtime will perform (and strip from chat)
      const directive = ` [[MOVE:${target}]]`;
      return line + directive;
    }
const minTalk = Number(npc?.chat_behavior?.minTalkLevel || 0);
    const currentFriend = Number((rel && rel.friendship) || (rel && rel.friendship) || (npc && npc.friendship && npc.friendship.level) || 0);
    const tooLow = currentFriend < minTalk;

    const pronounHint = (historyCount <= 1 && pr.pair !== 'they/them')
      ? `Got it — I'll use ${pr.pair}.`
      : '';

    const respond = (short, long) => (style === 'concise' ? short : (long || short));

    // Gate on minTalkLevel (busy tone)
    if (tooLow && !isAllowedIntent) {
      const line = sample(pack?.busy) || sample(npc?.chat_behavior?.busyLines) || "I'm wrapped up—later?";
      return respond(line, line);
    }

    const busyHint = (tooLow && isAllowedIntent) ? ' (I’m a bit swamped.)' : '';

    // Greeting / How
    if (reHi.test(lower) || reHow.test(lower)){
      if (reHow.test(lower)){
        const base = respond(`I'm alright—here at the ${place}. You?`, `I'm alright—here at the ${place}. How about you?`);
        let ret = pronounHint ? `${base} ${pronounHint}` : base;
      if (busyHint) ret += busyHint;
      return ret;
      }
      const mood = sample(pack?.smallTalk) || sample(npc?.chat_behavior?.smallTalkLines) || 'Hey.';
      const base = respond(mood, mood);
      let ret = pronounHint ? `${base} ${pronounHint}` : base;
      if (busyHint) ret += busyHint;
      return ret;
    }

    // Where are you?
    if (reWhere.test(lower)){
      let base = respond(`We're at the ${place}.`, `We're at the ${place}.`);
      if (busyHint) base += busyHint;
      let ret = pronounHint ? `${base} ${pronounHint}` : base;
      if (busyHint) ret += busyHint;
      return ret;
    }

    // Who am I?
    if (reWhoAmI.test(lower)){
      const nm = (player && player.name && player.name !== 'You') ? player.name : null;
      const base = nm ? `You're ${nm}.` : `You're you. If you want me to use a different name, tell me what to call you.`;
      let out = pronounHint ? `${base} I keep ${pr.subj}/${pr.obj} in mind.` : base;
      if (busyHint) out += busyHint;
      return out;
    }

    // What do you do?
    if (reWhatDoYouDo.test(lower)){
      const role = npc.role || 'friend';
      const roleLine = pack?.roleDesc ? `I'm ${/^(a|an)\b/i.test(role) ? '' : 'a '}${role}. ${pack.roleDesc}`.trim()
                                      : `I'm ${/^(a|an)\b/i.test(role) ? '' : 'a '}${role}.`;
      let outRole = respond(roleLine, roleLine);
      if (busyHint) outRole += busyHint;
      return outRole;
    }

    // Movement request
    if (reMove.test(lower)){
      const m = lower.match(reMove);
      const raw = (m && (m[5]||'').trim()) || '';
      if (raw) return movementReply(raw);
    }

    // Hybrid organic generation
    {
      const gen = await hybridGenerate();
      if (gen) return gen;
    }

    // Topic pick from training
    const topic = matchTopic(pack, text);
    if (topic){
      const line = sample(topic.lines);
      if (line){
        const hook = style === 'expressive' ? sample([
          "Want to dig in?",
          "Tell me your take.",
          "We can circle back if you're busy."
        ]) : null;
        return hook ? `${line} ${hook}` : line;
      }
    }

    // Fallback
    const fallback = sample(pack?.smallTalk) || (freedom > 0.6 ? freeformLine() : "What do you need?");
    const spice = (Math.random() < freedom ? freeformLine() : null);
    const sug = spice || maybeSuggest(place);
    const out = sug ? `${fallback} ${sug}` : fallback;
    return respond(out, out);

  } catch (e){
    return `[router error: ${String(e)}]`;
  }
}

export default respondToV2;
function normalizeSlot(state){
  try{
    const slots = (window.TIME_SLOTS || (typeof __StateMod!=='undefined' && __StateMod.TIME_SLOTS) || ['early_morning','morning','lunch','afternoon','evening','night']);
    const idx = (state && typeof state.timeIndex==='number') ? state.timeIndex : 2;
    return slots[idx] || 'afternoon';
  }catch(_e){ return 'afternoon'; }
}
function npcOnShift(npc, state){
  try{
    if (!npc || !npc.schedule || !Array.isArray(npc.schedule)) return false;
    const day = state?.day || 1;
    const slot = normalizeSlot(state);
    return npc.schedule.some(r => (r.days||[]).includes(day) && (r.slots||[]).includes(slot));
  }catch(_e){ return false; }
}
function currentPlace(ctx){
  const st = ctx?.gameState || null;
  return (st && st.location) ? String(st.location) : (ctx?.npc?.location || 'City Center');
}
function buildSystemPrompt(ctx){
  const npc = ctx?.npc || { id:'npc', name:'NPC' };
  const player = ctx?.player || { name:'You' };
  const world = ctx?.world || {};
  const state = ctx?.gameState || null;
  const place = currentPlace(ctx);
  const slot = normalizeSlot(state);
  const onShift = npcOnShift(npc, state);
  const role = npc.role || (place==='Coffee Shop' ? 'Barista' : '');

  const rules = [
    'You are an in-world NPC. Stay strictly in the game world.',
    'Write 1–3 concise sentences. Be natural and conversational.',
    'Respect existing places/rooms; do not invent new ones.',
    'If moving or meeting, add an ACTION at the very end.',
    'If busy/on shift, speak like someone working—short, courteous, focused.',
    'Steer away from endless small talk; propose a plan or wrap up when appropriate.',
    'Use at most one ACTION per reply.'
  ];

  const work = onShift
    ? `You are currently ON SHIFT as ${role||'staff'} at ${place} during ${slot}. Prioritize brief, helpful replies while working—e.g., taking orders, quick updates, or suggesting a later time.`
    : `You are currently OFF shift at ${place} during ${slot}. You can chat a bit more freely.`;

  const actionFmt = [
    'ACTION format (append at end when needed):',
    '<<MOVE who="player|{npcId}" place="Coffee Shop" room="Counter">>',
    '<<SCHEDULE who="{npcId}" place="Coffee Shop" at="today 12:00" note="quick chat">>',
    '<<END_SCENE reason="We have a plan for later.">>'
  ].join('\n').replace(/{npcId}/g, npc.id || 'npc');

  return [
    rules.join('\n'),
    '',
    work,
    '',
    'World constraints: only use known places and rooms you are told.',
    actionFmt
  ].join('\n');
}
