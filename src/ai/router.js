// src/ai/router.js
import { Policy } from './policy.js';
import { appendChat, loadChat } from './memory.js';
import { llmChat, mockChat, isConfigured } from './adapter.js';

function buildSystemPrompt({ world, now, location, npc, meters }) {
  const relBits = [];
  if (npc?.relations) {
    for (const [name, rel] of Object.entries(npc.relations)) {
      relBits.push(`${name}: ${rel.type}${typeof rel.strength === 'number' ? ` (${rel.strength})` : ''}`);
    }
  }
  const tone = Policy.stylePrompt(Policy.verbosity);
  const scheduleNote = `Honor schedules unless a specific-dated meeting overrides them; after the meeting, resume normal schedule.`;

  return [
    `You are the NPC "${npc?.name ?? 'Unknown'}" inside a life-sim game world.`,
    `Current time: ${now}. Location: ${location?.name ?? 'Unknown'}.`,
    `World rules: characters remember relationships, locations, and scheduled meetings.`,
    scheduleNote,
    `Relationships: ${relBits.join('; ') || 'none declared'}.`,
    `Meters: friendship=${meters?.friendship ?? 0}, romance=${meters?.romance ?? 0}.`,
    `If meters exceed thresholds, loosen tone accordingly.`,
    `Style: ${tone}`
  ].join('\n');
}

function trimHistory(arr, max) {
  return arr.slice(-max).map(m => ({ role: m.role, content: m.content }));
}

export async function respondTo(userText, ctx) {
  const npcId = ctx?.npc?.id ?? ctx?.npc?.name ?? 'npc';
  const sys = buildSystemPrompt(ctx);

  const history = await loadChat(npcId, Policy.maxHistory);
  const msgs = [
    { role: 'system', content: sys },
    ...trimHistory(history, Policy.maxHistory - 2),
    { role: 'user', content: userText }
  ];

  const reply = isConfigured() ? await llmChat(msgs) : await mockChat(msgs);

  await appendChat(npcId, { role: 'user', content: userText });
  await appendChat(npcId, { role: 'assistant', content: reply });

  return reply;
}


// ==== Persona Runtime Polyfills (auto-injected patch) ====
(function(global){
  // Minimal safe logger
  function safeLog(){ try { console.log.apply(console, arguments); } catch(_e){} }

  // Append message to chat log
  if (!global.appendMsgToLog) {
    global.appendMsgToLog = function(who, text){
      try{
        var log = document.getElementById('chatLog') || document.querySelector('.chat-log') || document.body;
        var div = document.createElement('div');
        div.className = 'msg ' + (who || 'sys');
        div.innerHTML = String(text || '');
        log.appendChild(div);
        if (log.scrollHeight) log.scrollTop = log.scrollHeight;
      }catch(e){ safeLog('appendMsgToLog error', e); }
    };
  }

  // Modal helper
  if (!global.ensureModal){
    global.ensureModal = function(){
      var modal = document.getElementById('chatModal');
      if (!modal){
        modal = document.createElement('div');
        modal.id = 'chatModal';
        modal.className = 'modal';
        var input = document.createElement('input');
        input.id = 'chatInput';
        input.type = 'text';
        modal.appendChild(input);
        document.body.appendChild(modal);
      }
      return modal;
    };
  }

  // Close character create modal (no-op safe)
  if (!global.closeCharCreateModal){
    global.closeCharCreateModal = function(){
      var m = document.getElementById('charCreateModal');
      if (m && m.parentNode) m.parentNode.removeChild(m);
      var ov = document.querySelector('.modal, .modal-overlay');
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    };
  }

  // Expose sendCurrentMessage only once if a local version exists
  try {
    if (typeof sendCurrentMessage === 'function' && !global.sendCurrentMessage){
      global.sendCurrentMessage = sendCurrentMessage;
    }
  } catch(_e){}

  // Guard GameLogic presence
  try {
    if (global.GameLogic && typeof global.GameLogic.updatePresence !== 'function'){
      global.GameLogic.updatePresence = function(){};
    }
  } catch(_e){}
})(window || this);
// ==== End Polyfills ====
