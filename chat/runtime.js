
// runtime.js (clean rewrite) — v35
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
      '.cosmosrp-card{width:min(1100px,96vw);max-height:90vh;border:1px solid #1b222b;border-radius:14px;overflow:hidden;background:#0d0f13;color:#dfe6f1}',
      '.cosmosrp-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1b222b}',
      '.cosmosrp-body{display:flex;gap:10px;padding:12px;min-height:420px}',
      '.cosmosrp-log{flex:1;overflow:auto;display:flex;flex-direction:column;gap:8px;background:#0d0f13;border:1px solid #1b222b;border-radius:10px;padding:10px}',
      '.msg{padding:6px 8px;border-radius:8px;background:#121722} .msg.you{background:#162235} .msg strong{color:#9ec1ff}',
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
      '      <div class="cosmosrp-aside" style="width:220px">',
      '        <div>Friendship: <span id="meterFriend">0</span></div>',
      '        <div>Romance: <span id="meterRomance">0</span></div>',
      '      </div>',
      '    </div>',
      '    <form id="chatForm" class="cosmosrp-actions" novalidate>',
      '      <input id="chatInput" type="text" autocomplete="off" placeholder="Say something..." style="flex:1">',
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
    log.scrollTop = log.scrollHeight;
  }catch(e){ console.warn('renderChat failed', e); }
}
window.renderChat = renderChat;

// --- Router loader ---
let __routerPromise = null;
function getRespond(){
  if (window.respondToV2) return Promise.resolve(window.respondToV2);
  if (!__routerPromise){
    __routerPromise = import('../src/ai/router.v2.js').then(m=> m.respondToV2 || m.default);
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
    getRespond().then(fn=> fn({text: textVal, npcId: id, npc: npc})).then(resp=>{
      const reply = (resp && (resp.reply || resp.text)) || '';
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
