
// === Debug Banner (ai_mode + ai_freedom) ===
function __getAiMode(){ try{ return localStorage.getItem('ai_mode') || 'hybrid'; }catch(_e){ return 'hybrid'; } }
function __setAiMode(v){ try{ localStorage.setItem('ai_mode', v); }catch(_e){} }
function __getAiFreedom(){ try{ return Number(localStorage.getItem('ai_freedom') || 0.5); }catch(_e){ return 0.5; } }
function __setAiFreedom(v){ try{ localStorage.setItem('ai_freedom', String(v)); }catch(_e){} }

function ensureDebugBanner(modal){
  try{
    const host = modal.querySelector('.cosmosrp') || modal;
    let bar = host.querySelector('#aiDebugBar');
    if (!bar){
      bar = document.createElement('div');
      bar.id = 'aiDebugBar';
      bar.style.cssText = 'position:absolute; top:8px; right:8px; display:flex; gap:8px; align-items:center; padding:6px 8px; background:rgba(20,20,20,0.6); color:#fff; border-radius:10px; font:12px/1.2 system-ui; z-index:9999; backdrop-filter: blur(4px);';
      bar.innerHTML = `
        <span style="opacity:.8;">AI</span>
        <select id="aiModeSel" style="background:#111; color:#fff; border:1px solid #444; border-radius:6px; padding:2px 6px;">
          <option value="hybrid">hybrid</option>
          <option value="router">router</option>
          <option value="llm">llm</option>
        </select>
        <label style="display:flex;align-items:center;gap:4px;">
          <span>freedom</span>
          <input id="aiFreedomRange" type="range" min="0" max="1.2" step="0.05" style="width:120px;">
          <input id="aiFreedomNum" type="number" min="0" max="1.2" step="0.05" style="width:55px; background:#111; color:#fff; border:1px solid #444; border-radius:6px; padding:2px 4px;">
        </label>
        <button id="aiQuickCycle" title="Quick cycle ai_mode" style="background:#222; color:#fff; border:1px solid #444; border-radius:6px; padding:2px 6px;">Cycle</button>
        <button id="aiSave" style="background:#0a7; color:#001; border:none; border-radius:6px; padding:2px 8px; font-weight:600;">Save</button>
      `;
      host.appendChild(bar);
    }
    const modeSel = bar.querySelector('#aiModeSel');
    const range = bar.querySelector('#aiFreedomRange');
    const num = bar.querySelector('#aiFreedomNum');
    const save = bar.querySelector('#aiSave');
    const cyc = bar.querySelector('#aiQuickCycle');

    function syncFromStorage(){
      const m = __getAiMode();
      const f = __getAiFreedom();
      modeSel.value = m;
      range.value = isFinite(f) ? f : 0.5;
      num.value = isFinite(f) ? f : 0.5;
      bar.setAttribute('data-mode', m);
      bar.setAttribute('data-freedom', String(f));
      bar.title = `ai_mode: ${m} | ai_freedom: ${f}`;
    }
    function syncFreedom(val){
      const v = Math.max(0, Math.min(1.2, Number(val)||0));
      range.value = v; num.value = v;
    }
    range.addEventListener('input', ()=> syncFreedom(range.value));
    num.addEventListener('input', ()=> syncFreedom(num.value));
    save.addEventListener('click', ()=>{
      __setAiMode(modeSel.value);
      __setAiFreedom(Number(num.value));
      syncFromStorage();
    });
    cyc.addEventListener('click', ()=>{
      const modes = ['hybrid','router','llm'];
      const cur = __getAiMode();
      const idx = (modes.indexOf(cur)+1) % modes.length;
      __setAiMode(modes[idx]);
      syncFromStorage();
    });

    // keyboard: Alt+D toggles bar visibility
    window.addEventListener('keydown', function(e){
      if ((e.key==='d' || e.key==='D') && e.altKey){
        bar.style.display = (bar.style.display==='none' ? 'flex' : 'none');
      }
    }, { once:false });

    syncFromStorage();
    return bar;
  }catch(e){ console.warn('ensureDebugBanner error', e); return null; }
}


import * as __StateMod from '../src/state.js';
try{ if (!window.GameState) window.GameState = __StateMod; }catch(_e){}
// runtime.js (clean rewrite) — v35
try{ if (!window.GameState) window.GameState = __StateMod; }catch(_e){}

// Minimal, self-contained chat runtime with IndexedDB history, modal UI, and router.v2 integration.

// --- Globals & helpers ---
try { if (typeof window.currentNpcId === 'undefined') window.currentNpcId = null; } catch(_e){}
function escapeHtml(s){
  s = String(s == null ? '' : s);
  return s.replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; });
}

// --- Debug overlay ---
(function(){
  try {
    let enabled = true;
    function ensureDbg(){
      let wrap = document.getElementById('chatDebugWrap');
      if (!wrap){
        wrap = document.createElement('div');
        wrap.id = 'chatDebugWrap';
        wrap.setAttribute('style','position:fixed;right:12px;bottom:12px;width:420px;max-height:40vh;background:#0c0f14;border:1px solid #1b222b;border-radius:10px;z-index:4000;color:#cde;padding:10px;font:12px/1.3 system-ui,Segoe UI,Arial;');
        wrap.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong>Chat Debug</strong><button id="chatDebugClose" style="background:transparent;color:#8ab;border:0">×</button></div><pre id="chatDebugLog" style="white-space:pre-wrap;overflow:auto;margin:0;max-height:30vh"></pre>';
        document.body.appendChild(wrap);
        wrap.querySelector('#chatDebugClose').onclick = ()=> wrap.remove();
      }
      return wrap;
    }
    function logLine(msg, data){
      const s = "[" + (new Date()).toLocaleTimeString() + "] " + String(msg) + (data!==undefined ? " " + (function(){try{return JSON.stringify(data)}catch(_){return ""}})() : "");
      console.debug("%c[CHAT]", "color:#0a0", s, data||"");
      if (!enabled) return;
      const pre = ensureDbg().querySelector('#chatDebugLog');
      if (pre) pre.textContent = (pre.textContent + (pre.textContent ? "\n":"") + s).slice(-8000);
    }
    window.ChatDebug = { log: logLine, enable: ()=>{enabled=true; logLine("debug on")}, disable: ()=>{enabled=false; logLine("debug off")} };
    logLine("Chat runtime loaded", {build:"v35"});
  } catch(e){}
})();

// --- IndexedDB RelStore ---
const RelStore = (function(){
  const DB_NAME='SimegameDB', DB_VER=1, STORE='relationships';
  const cache = Object.create(null);
  let dbp=null;
  function open(){ if (dbp) return dbp; dbp = new Promise((res,rej)=>{
    try {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = ()=> { const db=req.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
      req.onsuccess = ()=> res(req.result);
      req.onerror = ()=> rej(req.error||new Error('IDB open failed'));
    } catch(e){ rej(e); }
  }); return dbp; }
  async function get(id){ const db = await open(); return new Promise((res,rej)=>{ try { const tx=db.transaction(STORE,'readonly'); const os=tx.objectStore(STORE); const r=os.get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error) } catch(e){ rej(e) } }) }
  async function set(id,val){ const db = await open(); return new Promise((res,rej)=>{ try { const tx=db.transaction(STORE,'readwrite'); const os=tx.objectStore(STORE); const r=os.put(val,id); r.onsuccess=()=>{ try{ if(window.RelBC) window.RelBC.postMessage({type:'rel:update',id:id}); }catch(_e){}; res(true) }; r.onerror=()=>rej(r.error) } catch(e){ rej(e) } }) }
  return {
    async preload(id){ if (cache[id]!==undefined) return; try{ cache[id] = (await get(id)) || {id:id, history:[], friendship:0, romance:0}; }catch(e){ cache[id] = {id:id, history:[], friendship:0, romance:0}; } },
    getSync(id){ return cache[id] || {id:id, history:[], friendship:0, romance:0}; },
    async set(id,rel){ cache[id]=rel; try{ await set(id,rel); }catch(e){ console.warn('RelStore.set failed',e) } }
  }
})();
try { window.RelBC = new BroadcastChannel('simegame_chat'); window.RelBC.onmessage = (ev)=>{ const d=ev&&ev.data||{}; if(d.type==='rel:update' && d.id===window.currentNpcId) { RelStore.preload(d.id).then(()=>renderChat()); } }; } catch(_e){}

// --- Modal UI ---
function ensureModal(){
  let modal = document.getElementById('chatModal');
  if (!modal){
    modal = document.createElement('div');
    modal.id='chatModal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML = [
      '<style>',
      '.cosmosrp{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:3000}',
      '.cosmosrp-card{width:min(1100px,96vw);height:88vh;max-height:90vh;border:1px solid #1b222b;border-radius:14px;overflow:hidden;background:#0d0f13;color:#dfe6f1;display:flex;flex-direction:column;min-height:0}',
      '.cosmosrp-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1b222b}',
      '.cosmosrp-body{display:flex;gap:12px;padding:14px;min-height:540px;flex:1 1 auto;overflow:hidden}',
      '.cosmosrp-log{flex:1 1 auto;min-height:65vh;height:auto;max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:10px;background:#0d0f13;border:1px solid #1b222b;border-radius:12px;padding:12px;overscroll-behavior:contain;scrollbar-gutter:stable both-edges}',
      '.msg{padding:8px 10px;border-radius:10px;background:#121722;max-width:100%;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap} .msg.you{background:#162235} .msg strong{color:#9ec1ff}',
      '.cosmosrp-actions{display:flex;gap:8px;padding:12px;border-top:1px solid #1b222b}',
      '.btn-ghost{background:transparent;border:1px solid #263040;color:#bcd;padding:6px 10px;border-radius:8px}',
      '.btn-primary{background:#1f4fff;border:0;color:white;padding:8px 12px;border-radius:8px}',
      '</style>',
      '<div class="cosmosrp">',
      '  <div class="cosmosrp-card">',
      '    <div class="cosmosrp-head">',
      '      <strong id="chatTitle">Chat</strong>',
      '      <div class="row" style="display:flex;gap:8px">',
      '        <button id="chatClear" class="btn-ghost">Clear</button>',
      '        <button id="chatClose" class="btn-ghost" data-chat-close>Close</button>',
      '      </div>',
      '    </div>',
      '    <div class="cosmosrp-body">',
      '      <div id="chatLog" class="cosmosrp-log"></div>',
      '      <div class="cosmosrp-aside" style="width:180px">',
      '        <div>Friendship: <span id="meterFriend">0</span></div>',
      '        <div>Romance: <span id="meterRomance">0</span></div>',
      '      </div>',
      '    </div>',
      '    <form id="chatForm" class="cosmosrp-actions" novalidate>',
      '      <input id="chatInput" type="text" autocomplete="off" placeholder="Say something..." style="flex:1; height:40px; line-height:40px; min-height:40px; overflow-x:auto; white-space:nowrap; text-overflow:clip">',
      '      <button id="sendBtn" type="submit" class="btn-primary">Send</button>',
      '    </form>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);
  }
  return modal;
}

function openChatModal(){
  const modal = ensureModal();
  modal.removeAttribute('aria-hidden'); try{ modal.removeAttribute('inert'); }catch(_){}
  const wrap = modal.querySelector('.cosmosrp'); if (wrap) wrap.style.display='flex';
  try{ modal.querySelector('#chatInput').focus(); }catch(_){}
}

function closeChatModal(){
  const modal = document.getElementById('chatModal'); if (!modal) return;
  const wrap = modal.querySelector('.cosmosrp'); if (wrap) wrap.style.display='none';
  try{ if (document.activeElement) document.activeElement.blur(); }catch(_){}
  try{ document.body && document.body.focus && document.body.focus(); }catch(_){}
  try{ modal.setAttribute('inert',''); }catch(_){}
  modal.setAttribute('aria-hidden','true');
}

// --- Render ---
function renderChat(){
  try{
    const modal = document.getElementById('chatModal'); if (!modal) return;
    let log = modal.querySelector('#chatLog');
    if (!log){ const b = modal.querySelector('.cosmosrp-body')||modal; log=document.createElement('div'); log.id='chatLog'; log.className='cosmosrp-log'; b.insertBefore(log, b.firstChild); }
    let id = (typeof window.currentNpcId==='object' ? window.currentNpcId && window.currentNpcId.id : window.currentNpcId) || (window.ActiveNPC && window.ActiveNPC.id) || 'lily';
    const rel = (RelStore.getSync ? RelStore.getSync(id) : {id:id, history:[], friendship:0, romance:0});
    const mf = modal.querySelector('#meterFriend'); if (mf) mf.textContent = rel.friendship || 0;
    const mr = modal.querySelector('#meterRomance'); if (mr) mr.textContent = rel.romance || 0;
    let html = "";
    for (let i=0;i<(rel.history||[]).length;i++){
      const m = rel.history[i]||{}; const who = m.speaker||""; const body = escapeHtml(m.text||"");
      const cls = (who === "You" ? "you" : "npc");
      html += '<div class="msg '+cls+'"><strong>'+escapeHtml(who)+':</strong> '+body+'</div>';
    }
    log.innerHTML = html;
    try{
      log.scrollTop = log.scrollHeight;
      requestAnimationFrame(()=>{ try{ log.scrollTop = log.scrollHeight; }catch(_e){} });
      requestAnimationFrame(()=>{ try{ log.scrollTop = log.scrollHeight; }catch(_e){} });
    }catch(_e){}
  }catch(e){ console.warn('renderChat failed', e); }
}
window.renderChat = renderChat;






function __detectPlayer(){
  try{
    let p = (window.GameState && window.GameState.state && window.GameState.state.player) || window.Player || {};
    if (!p || typeof p !== 'object') p = {};
    try{
      const raw = localStorage.getItem('game_state_v1');
      if ((!p.gender || !p.name) && raw){
        const s = JSON.parse(raw);
        if (s && s.player){ p = Object.assign({}, p, s.player); }
      }
    }catch(_e){}
    if (p.gender){
      const g = String(p.gender).toLowerCase();
      if (g==='transgender' || g==='trans female' || g==='transgender female' || g==='transfemale') p.gender = 'transgender female';
      else if (/^m(ale)?$/.test(g)) p.gender = 'male';
      else if (/^f(emale)?$/.test(g)) p.gender = 'female';
    }
    if (!p.id) p.id = 'MC';
    if (!p.name) p.name = 'You';
    return p;
  }catch(e){ return { id:'MC', name:'You' }; }
}
function __detectLocation(){
  try{
    try{
      const mod = (window.GameState || __StateMod);
      if (mod && mod.state && mod.state.location) return String(mod.state.location);
    }catch(_e){}
    const st = (window.GameState && window.GameState.state) || {};
    let loc = st.location || (window.GameWorld && window.GameWorld.location) || (window.world && window.world.location);
    if (!loc){
      const el = document.querySelector('[data-current-location]') || document.querySelector('[data-location].active') || document.getElementById('locationDesc');
      if (el){
        const attr = el.getAttribute('data-current-location') || el.getAttribute('data-location') || '';
        const txt = (el.textContent || '').trim();
        loc = attr || (txt.split('\n')[0].trim());
      }
    }
    if (!loc) loc = 'City';
    return String(loc);
  }catch(e){ return 'City'; }
}


function __detectTimeOfDay(){
  try{
    const st = (window.GameState && window.GameState.state) || (typeof __StateMod !== 'undefined' && __StateMod.state) || {};
    const idx = st.timeIndex || 0;
    return ['morning','afternoon','evening','night'][idx] || 'day';
  }catch(e){ return 'day'; }
}
// --- Router loader ---

let __routerPromise = null;
function getRespond(){
  if (window.respondToV2) return Promise.resolve(window.respondToV2);
  if (!__routerPromise){
    __routerPromise = import('../src/ai/router.v2.js?v=20250918061249').then(m=> { try{ window.ChatDebug && ChatDebug.log('Router loaded', {build: m.ROUTER_BUILD || 'unknown'}); }catch(_e){}; return m.respondToV2 || m.default; });
  }
  return __routerPromise;
}

// --- Sender ---
function sendCurrentMessage(){
  try{
    const modal = ensureModal();
    const input = modal.querySelector('#chatInput'); if (!input) return;
    const textVal = String(input.value||'').trim();
    if (!textVal) return;
    input.value = '';

    // Resolve NPC id & rel
    let npc = window.ActiveNPC && typeof window.ActiveNPC==='object' ? window.ActiveNPC : (window.getNpcById && typeof window.currentNpcId==='string' ? getNpcById(window.currentNpcId) : null);
    let id = (typeof window.currentNpcId==='object' ? window.currentNpcId && window.currentNpcId.id : window.currentNpcId) || (npc && npc.id) || 'lily';
    // push user
    let rel = RelStore.getSync(id); rel.history = rel.history || []; rel.history.push({speaker:'You', text:textVal, ts:Date.now()});
    RelStore.set(id, rel).then(()=> renderChat());

    // AI reply
    getRespond().then(fn=> {
      const ctx = {
        npc: npc,
        world: (window.GameWorld || window.world || window.gameWorld || {}),
        player: (window.Player || { id: 'MC', name: 'You' })
      };
      return fn(textVal, ctx);
    }).then(reply=>{
      reply = String(reply || '');
      const r2 = RelStore.getSync(id); r2.history = r2.history || []; r2.history.push({speaker: npc && npc.name || 'NPC', text:String(reply), ts:Date.now()});
      RelStore.set(id, r2).then(()=> renderChat());
    }).catch(err=>{
      const r3 = RelStore.getSync(id); r3.history = r3.history || []; r3.history.push({speaker: 'System', text:'[AI error: '+String(err)+']', ts:Date.now()});
      RelStore.set(id, r3).then(()=> renderChat());
    });
  }catch(e){ console.warn('sendCurrentMessage failed', e); }
}
window.sendCurrentMessage = sendCurrentMessage;

// --- Start chat ---
function startChat(npcOrId){
  try{
    let npc = null;
    if (npcOrId && typeof npcOrId === 'object') npc = npcOrId;
    else if (typeof getNpcById === 'function' && npcOrId) npc = getNpcById(npcOrId);
    if (npc && npc.id) { window.currentNpcId = npc.id; window.ActiveNPC = npc; }
    if (!window.currentNpcId) window.currentNpcId = 'lily';
    const id = (typeof window.currentNpcId==='object' ? window.currentNpcId && window.currentNpcId.id : window.currentNpcId);
    // Preload & greeting on first open
    RelStore.preload(id).then(()=>{
      const r = RelStore.getSync(id);
      if (!r.history || !r.history.length){
        const g = npc && npc.greetings ? (npc.greetings.home || npc.greetings.casual) : null;
        if (g){ r.history = r.history || []; r.history.push({speaker: npc && npc.name || 'NPC', text:g}); RelStore.set(id, r); }
      }
      renderChat();
    });
    openChatModal();
    // wire listeners (once per modal create)
    const modal = ensureModal();
  try { ensureDebugBanner(modal); } catch(_e){}
    const form = modal.querySelector('#chatForm');
    const sendBtn = modal.querySelector('#sendBtn');
    const closeBtn = modal.querySelector('#chatClose');
    const clearBtn = modal.querySelector('#chatClear');
    if (form && !form.__bound){ form.__bound = true; form.addEventListener('submit', function(e){ e.preventDefault(); sendCurrentMessage(); }); }
    if (sendBtn && !sendBtn.__bound){ sendBtn.__bound = true; sendBtn.addEventListener('click', function(e){ e.preventDefault(); sendCurrentMessage(); }); }
    if (closeBtn && !closeBtn.__bound){ closeBtn.__bound = true; closeBtn.addEventListener('click', function(e){ e.preventDefault(); closeChatModal(); }); }
    if (clearBtn && !clearBtn.__bound){ clearBtn.__bound = true; clearBtn.addEventListener('click', function(e){ e.preventDefault(); const rid = (typeof window.currentNpcId==='object' ? window.currentNpcId && window.currentNpcId.id : window.currentNpcId); RelStore.set(rid, {id:rid, history:[], friendship:0, romance:0}).then(()=>renderChat()); }); }
    // close on backdrop click
    const wrap = modal.querySelector('.cosmosrp');
    if (wrap && !wrap.__bound){
      wrap.__bound = true;
      wrap.addEventListener('click', function(e){ if (e.target === wrap) closeChatModal(); }, true);
    }
  }catch(e){ console.warn('startChat failed', e); }
}
window.startChat = startChat;
window.GameUI = window.GameUI || {}; window.GameUI.startChat = startChat;

// --- Back-compat helper ---
if (typeof window.appendMsgToLog !== 'function'){
  window.appendMsgToLog = function(who, text){
    try{
      const id = (typeof window.currentNpcId==='object' ? window.currentNpcId && window.currentNpcId.id : window.currentNpcId) || (window.ActiveNPC && window.ActiveNPC.id) || 'lily';
      const rel = RelStore.getSync(id); rel.history = rel.history || []; rel.history.push({speaker: who, text: String(text)});
      RelStore.set(id, rel).then(()=> renderChat());
    }catch(e){ console.warn('appendMsgToLog error', e); }
  };
}

try{ window.GameUI = window.GameUI || {}; window.GameUI.closeChatModal = closeChatModal; }catch(_e){}

// ---- Ensure required globals for external callers ----
try{ if (typeof window !== 'undefined') {
  if (typeof window.appendMsgToLog === 'undefined' && typeof appendMsgToLog === 'function') window.appendMsgToLog = appendMsgToLog;
  if (typeof window.sendCurrentMessage === 'undefined' && typeof sendCurrentMessage === 'function') window.sendCurrentMessage = sendCurrentMessage;
  if (typeof window.renderChat === 'undefined' && typeof renderChat === 'function') window.renderChat = renderChat;
}}catch(_e){}

try { if (localStorage.getItem('ai_freedom') === null) localStorage.setItem('ai_freedom','1.2'); } catch(_e){}
