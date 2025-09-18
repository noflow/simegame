try { if (typeof window.currentNpcId === 'undefined') window.currentNpcId = null; } catch(_e){}
// === Chat Debug Overlay & Logger (auto) ===
(function(){
  try {
    if (typeof window === 'undefined') return;
    // Enable when ?chatdebug=1 or localStorage.CHAT_DEBUG === '1'
    var q = (location && location.search || "");
    var enabled = /\bchatdebug=1\b/.test(q) || (function(){ try { return localStorage.getItem('CHAT_DEBUG') === '1'; } catch(e){ return false; }})();
    window.__CHAT_RUNTIME_BUILD = (window.__CHAT_RUNTIME_BUILD || "v34-debug") + "-" + (new Date()).toISOString();
    function ensureDbg(){
      var el = document.getElementById('chatDebug');
      if (el) return el;
      el = document.createElement('div');
      el.id = 'chatDebug';
      el.style.position = 'fixed';
      el.style.right = '10px';
      el.style.bottom = '10px';
      el.style.width = 'min(420px, 80vw)';
      el.style.maxHeight = '40vh';
      el.style.overflow = 'auto';
      el.style.zIndex = '99999';
      el.style.font = '12px/1.4 monospace';
      el.style.background = 'rgba(0,0,0,0.8)';
      el.style.color = '#0f0';
      el.style.border = '1px solid #0f0';
      el.style.borderRadius = '8px';
      el.style.padding = '8px';
      el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
      el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><strong>Chat Debug</strong><button id="chatDebugClose" style="background:#111;color:#0f0;border:1px solid #0f0;border-radius:4px;padding:2px 6px;cursor:pointer">×</button></div><pre id="chatDebugLog" style="white-space:pre-wrap;margin:0"></pre>';
      document.body.appendChild(el);
      var btn = el.querySelector('#chatDebugClose');
      if (btn) btn.addEventListener('click', function(){ el.style.display='none'; });
      return el;
    }
    function logLine(msg, data){
      var s = "[" + (new Date()).toLocaleTimeString() + "] " + String(msg);
      if (data !== undefined) {
        try { s += " " + JSON.stringify(data); } catch(e){}
      }
      console.debug("%c[CHAT]", "color:#0a0", s, data||"");
      if (!enabled) return;
      var wrap = ensureDbg();
      var pre = wrap.querySelector('#chatDebugLog');
      if (pre) {
        pre.textContent = (pre.textContent + (pre.textContent ? "\n" : "") + s).slice(-8000);
      }
    }
    window.ChatDebug = {
      enable: function(){ try { localStorage.setItem('CHAT_DEBUG','1'); } catch(e){} enabled = true; logLine("Chat debug enabled"); },
      disable: function(){ try { localStorage.removeItem('CHAT_DEBUG'); } catch(e){} enabled = false; var el=document.getElementById('chatDebug'); if(el) el.style.display='none'; console.debug("[CHAT] debug disabled"); },
      log: logLine,
      build: function(){ return window.__CHAT_RUNTIME_BUILD; }
    };
    // banner
    logLine("Chat runtime loaded", { build: window.__CHAT_RUNTIME_BUILD });
  } catch(e){
    console.warn("ChatDebug init error", e);
  }
})(); 
// === End Chat Debug ===

// === Chat relationship shim (always-on) ===
(function(){
  try {
    if (typeof window === 'undefined') return;
    window.__chatHistory = window.__chatHistory || {};
    if (typeof window.getRel !== 'function') {
      window.getRel = function(id){
        var rel = null;
        try { if (typeof getRelationship === 'function') rel = getRelationship(id); } catch(e){}
        if (!rel) {
          rel = window.__chatHistory[id] || { history: [], friendship: 0, romance: 0 };
          window.__chatHistory[id] = rel;
        }
        if (!Array.isArray(rel.history)) rel.history = [];
        return rel;
      };
    }
    if (typeof window.setRel !== 'function') {
      window.setRel = function(id, rel){
        try { if (typeof setRelationship === 'function') return setRelationship(id, rel); } catch(e){}
        window.__chatHistory[id] = rel || { history: [], friendship: 0, romance: 0 };
      };
    }
  } catch(e) {
    console.warn('chat relationship shim error:', e);
  }
})(); 
// === End shim ===

// Chat runtime (v32) — full modal (#chatModal), ES5-compatible
if (window.__CHAT_RUNTIME_LOADED__) {
  console.warn("♻️ Chat runtime already loaded — skipping.");
} else {
  window.__CHAT_RUNTIME_LOADED__ = true;
  console.log("✅ Chat runtime loaded.");

  // --- ensureModal: create #chatModal if missing (full-size modal) ---
  if (typeof window.ensureModal !== 'function') {
    function ensureModal(){
      var modal = document.getElementById('chatModal');
      if (modal) return modal;

      modal = document.createElement('div');
      modal.id = 'chatModal';
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-hidden','true');
      modal.innerHTML = [
        '<div class="cosmosrp" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:3000">',
        '  <div class="cosmosrp-card" style="width:min(1100px,96vw);max-height:90vh;border:1px solid #1b222b;border-radius:14px;overflow:hidden;background:var(--panel)">',
        '    <div class="cosmosrp-head" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1b222b">',
        '      <strong id="chatTitle">Chat</strong>',
        '      <div class="row" style="gap:8px">' +
'        <button id="chatClear" class="btn-ghost">Clear</button>' +
'        <button id="chatClose" data-chat-close class="btn-ghost">Close</button>' +
'      </div>',
        '    </div>',
        '    <div class="cosmosrp-body" style="display:flex;gap:10px;padding:12px;min-height:420px">',
        '      <div id="chatLog" class="cosmosrp-log" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:8px;background:#0d0f13;border:1px solid #1b222b;border-radius:10px;padding:10px"></div>',
        '      <div class="cosmosrp-side" style="width:260px;display:flex;flex-direction:column;gap:8px">',
        '         <div class="status-row"><span class="label">Friendship</span><span id="meterFriend">0</span></div>',
        '         <div class="status-row"><span class="label">Romance</span><span id="meterRomance">0</span></div>',
        '      </div>',
        '    </div>',
        '    <form id="chatForm" novalidate class="cosmosrp-actions" style="display:flex;gap:8px;padding:12px;border-top:1px solid #1b222b">',
        '      <input id="chatInput" type="text" autocomplete="off" placeholder="Say something..." style="flex:1">',
        '      <button id="sendBtn" type="submit" class="btn-primary">Send</button>',
        '    </form>',
        '  </div>',
        '</div>'
      ].join('');
      document.body.appendChild(modal);
      // Ensure required children exist; if not, rebuild the modal content
      try {
        var _log = modal.querySelector('#chatLog');
        var _form = modal.querySelector('#chatForm');
        var _input = modal.querySelector('#chatInput');
        if (!_log || !_form || !_input) {
          modal.innerHTML = [
            '<div class="cosmosrp" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:3000">',
            '  <div class="cosmosrp-card" style="width:min(1100px,96vw);max-height:90vh;border:1px solid #1b222b;border-radius:14px;overflow:hidden;background:var(--panel)">',
            '    <div class="cosmosrp-head" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1b222b">',
            '      <strong id="chatTitle">Chat</strong>',
            '      <div class="row" style="gap:8px">',
            '        <button id="chatClear" class="btn-ghost">Clear</button>',
            '        <button id="chatClose" data-chat-close class="btn-ghost">Close</button>',
            '      </div>',
            '    </div>',
            '    <div class="cosmosrp-body" style="display:flex;gap:10px;padding:12px;min-height:420px">',
            '      <div id="chatLog" class="cosmosrp-log" style="flex:1;overflow:auto;border:1px solid #1b222b;border-radius:10px;padding:10px"></div>',
            '      <div class="cosmosrp-aside" style="width:220px">',
            '        <div>Friendship: <span id="meterFriend">0</span></div>',
            '        <div>Romance: <span id="meterRomance">0</span></div>',
            '      </div>',
            '    </div>',
            '    <form id="chatForm" novalidate class="cosmosrp-actions" style="display:flex;gap:8px;padding:12px;border-top:1px solid #1b222b">',
            '      <input id="chatInput" type="text" autocomplete="off" placeholder="Say something..." style="flex:1">',
            '      <button id="sendBtn" type="submit" class="btn-primary">Send</button>',
            '    </form>',
            '  </div>',
            '</div>'
          ].join('');
        }
      } catch(_e) {}

      try { window.ChatDebug && ChatDebug.log('ensureModal: modal created'); } catch(e){}

      // Wire form + send + enter (keydown/keypress/keyup)
      var form = modal.querySelector('#chatForm');
      if (form) {
        form.addEventListener('submit', function(e){ try{ window.ChatDebug && ChatDebug.log('form submit'); }catch(_e){};
          e.preventDefault();
          if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
        });
      }
      var sendBtn = modal.querySelector('#sendBtn');
      if (sendBtn) {
        sendBtn.addEventListener('click', function(e){ try{ window.ChatDebug && ChatDebug.log('sendBtn click'); }catch(_e){};
          e.preventDefault();
          if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
        });
      var clearBtn = modal.querySelector('#chatClear');
      if (clearBtn) {
        clearBtn.addEventListener('click', function(e){
          e.preventDefault();
          try{ window.ChatDebug && ChatDebug.log('chatClear click'); }catch(_e){}
          try {
            var id = (typeof window.currentNpcId==='object' ? window.currentNpcId.id : window.currentNpcId) || (window.ActiveNPC && window.ActiveNPC.id);
            if (!id) return;
            var blank = { id: id, history: [], friendship: 0, romance: 0 };
            if (window.RelStore && typeof window.RelStore.set==='function') {
              window.RelStore.set(id, blank).then(function(){ if (typeof renderChat==='function') renderChat(); });
            } else if (typeof setRelationship==='function') {
              setRelationship(id, blank);
              if (typeof renderChat==='function') renderChat();
            }
          } catch(e){ console.warn('chatClear failed', e); }
        });
      }

      }
      var inputEl = modal.querySelector('#chatInput');
      function maybeSend(e){
        var key = e.key || e.keyCode;
        if (key === 'Enter' || key === 13) {
          e.preventDefault();
          if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
          return false;
        }
      }
      if (inputEl) {
        inputEl.addEventListener('keydown', maybeSend);
        inputEl.addEventListener('keypress', maybeSend);
        inputEl.addEventListener('keyup', function(e){
          if ((e.key || e.keyCode) === 'Enter' || (e.keyCode === 13)) e.preventDefault();
        });
      }
      return modal;
    }
    window.ensureModal = ensureModal;
  }

  // --- Fallback renderChat (safe) ---
  if (typeof window.renderChat !== 'function') {
    function escapeHtml(s){
      var str = String(s || '');
      var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
      return str.replace(/[&<>"']/g, function(ch){ return map[ch]; });
    }
    function renderChat(){ try{ window.ChatDebug && ChatDebug.log('renderChat start', {npcId: window.currentNpcId}); }catch(_e){}
      try{
        var modal = document.getElementById('chatModal');
        if (!modal) return;
        var log = modal.querySelector('#chatLog');
        if (!log) {
          var body = modal.querySelector('.cosmosrp-body') || modal;
          log = document.createElement('div');
          log.id = 'chatLog';
          log.className = 'cosmosrp-log';
          log.setAttribute('style','flex:1;overflow:auto;border:1px solid #1b222b;border-radius:10px;padding:10px');
          body.insertBefore(log, body.firstChild);
        }
        var relId = window.currentNpcId || (window.ActiveNPC && window.ActiveNPC.id) || 'lily';
        if (relId && typeof relId === 'object') { try { window.ChatDebug && ChatDebug.log('renderChat: normalize relId object', relId); }catch(_e){}; relId = relId.id || String(relId); }
        var rel = (typeof getRelationship==='function' ? getRelationship(relId) : null);
        if (!rel) {
          rel = { history: [], friendship: 0, romance: 0 };
          if (typeof setRelationship==='function') { try { setRelationship(window.currentNpcId, rel); } catch(e){} }
        }
        if (!rel.history) rel.history = [];
        var html = "";
        for (var i=0; i<rel.history.length; i++){
          var m = rel.history[i] || {};
          var who = m.speaker || "";
          var body = escapeHtml(m.text || "");
          var cls = (who === "You" ? "you" : "npc");
          html += '<div class="msg ' + cls + '"><strong>' + escapeHtml(who) + ':</strong> ' + body + '</div>';
        }
        var mf = modal.querySelector('#meterFriend'); if (mf) mf.textContent = rel.friendship || 0;
        var mr = modal.querySelector('#meterRomance'); if (mr) mr.textContent = rel.romance || 0;
        log.innerHTML = html;
        log.scrollTop = log.scrollHeight;
      }catch(e){ console.warn('renderChat fallback failed:', e); }
    }
    window.renderChat = renderChat;
    window.GameUI = window.GameUI || {};
    window.GameUI.renderChat = renderChat;
  }

  // --- Close helpers & listeners ---
  function closeChatModal(){
    var modal = document.getElementById('chatModal');
    if (!modal) return;
    var wrap = modal.querySelector('.cosmosrp');
    if (wrap) wrap.style.display = 'none';
    
    try { if (document.activeElement) document.activeElement.blur(); } catch(_e){}
    try { document.body.focus(); } catch(_e){}
    try { modal.setAttribute('inert',''); } catch(_e){}
    modal.setAttribute('aria-hidden','true');
    var input = modal.querySelector('#chatInput');
    if (input) input.blur();
  }
  try{ window.ChatDebug && ChatDebug.log('renderChat end'); }catch(_e){}
  window.closeChatModal = closeChatModal;

  if (!window.__chatCloseWired) {
    window.__chatCloseWired = true;
    document.addEventListener('keydown', function(e){
      if ((e.key || e.keyCode) === 'Escape' || (e.keyCode === 27)) closeChatModal();
    });
    document.addEventListener('click', function(e){
      if (!e || !e.target) return;
      var t = e.target;
      var matches = t.matches ? t.matches('#chatClose,[data-chat-close]') : false;
      var closest = t.closest ? t.closest('#chatClose,[data-chat-close]') : null;
      if (matches || closest) {
        e.preventDefault();
        closeChatModal();
      }
    }, true);
  }

  // --- Dynamic router import (once) ---
  var __routerPromise = null;
  function getRespond(){
    if (window.respondToV2) return Promise.resolve(window.respondToV2);
    if (!__routerPromise) { try{ window.ChatDebug && ChatDebug.log('getRespond: dynamic import router.v2'); }catch(_e){}
      __routerPromise = import('../src/ai/router.v2.js').then(function(m){
        var fn = m.respondToV2 || m.default;
        if (!fn) throw new Error('router.v2.js missing respondToV2 export');
        window.respondToV2 = fn;
        return fn;
      });
    }
    return __routerPromise;
  }

  // --- Core sender (no async/await) ---
  function sendCurrentMessage(){ try{ window.ChatDebug && ChatDebug.log('sendCurrentMessage called'); }catch(_e){}
    var modal = document.getElementById('chatModal') || (typeof ensureModal === 'function' ? ensureModal() : null);
    var input = (modal && modal.querySelector) ? modal.querySelector('#chatInput') : document.querySelector('#chatInput');
    if (!input) return;
    var textVal = String(input.value || '').trim();
    if (!textVal) { try{ window.ChatDebug && ChatDebug.log('sendCurrentMessage: empty input'); }catch(_e){}; return; }

    var npc = null;
    if (window.ActiveNPC && window.ActiveNPC.id) npc = window.ActiveNPC;
    else if (typeof getNpcById === 'function' && window.currentNpcId) npc = getNpcById(window.currentNpcId);
    if (!npc && typeof window.currentNpcId === 'string') { npc = { id: window.currentNpcId, name: window.currentNpcId }; }

    // Ensure global targeting is aligned
    if (!window.currentNpcId || window.currentNpcId !== npc.id) window.currentNpcId = npc.id; try{ window.ChatDebug && ChatDebug.log('startChat: set currentNpcId', {id:npc.id,name:npc.name}); }catch(_e){}
    window.ActiveNPC = npc; try{ window.ChatDebug && ChatDebug.log('sendCurrentMessage: target npc', {id:npc && npc.id, name:npc && npc.name}); }catch(_e){}

    try {
      if ((npc.id==='lily' || /lily/i.test(npc.name||'')) && (!npc.relations || !npc.relations.MC)) {
        npc.relations = Object.assign({}, npc.relations||{}, { MC: { type:'sister', strength:80 } });
      }
    } catch(e){}

    var rel = (typeof getRelationship==='function' ? getRelationship(npc.id) : null) || {history:[],friendship:0,romance:0};
    if (!rel.history) rel.history = [];
    try{ window.ChatDebug && ChatDebug.log('sendCurrentMessage: push user msg', {text: textVal}); }catch(_e){}
    rel.history.push({ speaker:'You', text: textVal, ts: Date.now() });
    if (typeof setRelationship==='function') { try { setRelationship(npc.id, rel); } catch(e){} }
    if (typeof renderChat==='function') renderChat(); // optimistic echo
    input.value = '';

    var world = window.WORLD_STATE || null;
    var loadWorld = (world ? Promise.resolve(world) : fetch('./WORLD.json', { cache: 'no-store' })
        .then(function(r){ return r.ok ? r.json() : {}; })
        .catch(function(){ return {}; })
    ).then(function(w){ return w || {}; });

    var player = {
      id: (window.GameState && window.GameState.playerId) || 'MC',
      name: (window.GameState && window.GameState.playerName) || 'MC'
    };

    Promise.all([loadWorld, getRespond()]).then(function(vals){
      var w = vals[0];
      var respondToV2 = vals[1];
      if (w.currentDay == null && window.GameState && window.GameState.day) w.currentDay = window.GameState.day;
      if (!w.timeSegment && window.GameState && window.GameState.time) w.timeSegment = window.GameState.time;
      w.locations = w.locations || {};

      var meters = Object.assign({ friendship: rel.friendship || 0, romance: rel.romance || 0 }, rel.meters || {});

      try{ window.ChatDebug && ChatDebug.log('AI: respondToV2 start', {text: textVal}); }catch(_e){}
      return respondToV2(textVal, {
        world: w,
        now: new Date().toLocaleString(),
        npc: npc,
        meters: meters,
        player: player
      }).then(function(reply){ try{ window.ChatDebug && ChatDebug.log('AI: respondToV2 done', {reply: (reply && reply.text) ? reply.text : reply}); }catch(_e){}
        var out = (reply && typeof reply === 'object' && reply.text) ? reply.text : reply;
        if (!out) out = '…';
        rel.history.push({ speaker: npc.name || (npc.id || 'NPC'), text: out, ts: Date.now() });
      }).catch(function(err){ try{ window.ChatDebug && ChatDebug.log('AI: respondToV2 error', {error: String(err && (err.stack || err))}); }catch(_e){}
        console.error('AI router v2 error:', err);
        rel.history.push({ speaker: npc.name || (npc.id || 'NPC'), text: '[AI error. Check settings/API key.]', ts: Date.now() });
      }).then(function(){
        if (typeof setRelationship==='function') { try { setRelationship(npc.id, rel); } catch(e){} }
        if (window.GameState && window.GameState.saveState) window.GameState.saveState();
        if (typeof renderChat==='function') renderChat();
      });
    });
  }
  window.sendCurrentMessage = sendCurrentMessage;

  // --- Start chat (accepts NPC object or id) ---
  \1 try{ window.ChatDebug && ChatDebug.log('startChat called', {npcOrId: npcOrId}); }catch(_e){} try{ window.ChatDebug && ChatDebug.log('startChat called', {npcOrId: npcOrId}); }catch(_e){}
    try {
      var npc = null;
      if (npcOrId && typeof npcOrId === 'object') {
        npc = npcOrId;
      } else if (typeof getNpcById === 'function' && npcOrId) {
        npc = getNpcById(npcOrId);
      }

      if (npc && npc.id) {
        window.currentNpcId = npc.id; try{ window.ChatDebug && ChatDebug.log('startChat: set currentNpcId', {id:npc.id,name:npc.name}); }catch(_e){}
        window.ActiveNPC = npc; try{ window.ChatDebug && ChatDebug.log('sendCurrentMessage: target npc', {id:npc && npc.id, name:npc && npc.name}); }catch(_e){}
      } else if (!window.currentNpcId) {
        window.currentNpcId = 'lily';
      }

      var modal = (typeof ensureModal === 'function' ? ensureModal() : document.getElementById('chatModal'));
      if (!modal) {
        console.warn('startChat: #chatModal not found');
        return;
      }

      var wrap = modal.querySelector('.cosmosrp');
      if (wrap) {
        wrap.style.display = 'flex';
      }

      modal.removeAttribute('aria-hidden'); try{ modal.removeAttribute('inert'); }catch(_e){}

      try {
        var relInit = (typeof getRelationship === 'function') ? getRelationship(window.currentNpcId) : null;
        if (!relInit) {
          relInit = { history: [], friendship: 0, romance: 0 };
          if (typeof setRelationship === 'function') {
            setRelationship(window.currentNpcId, relInit);
          }
        }
      } catch (e) {}

      try {
        var npc2 = npc || (typeof getNpcById === 'function' ? getNpcById(window.currentNpcId) : null);
        var title = modal.querySelector('#chatTitle');
        if (title && npc2 && npc2.name) {
          title.textContent = npc2.name;
        }
      } catch (e) {}

      var input = modal.querySelector('#chatInput');
      if (input) { try{ window.ChatDebug && ChatDebug.log('startChat: focusing input'); }catch(_e){} input.focus(); }

      if (typeof renderChat === 'function') renderChat();

    } catch (e) {
      console.error('startChat error:', e);
    }
  }

  // Attach to global scope
  window.startChat = startChat;
  window.GameUI = window.GameUI || {};
  window.GameUI.startChat = startChat;
  window.GameUI.closeChat = closeChatModal;
  window.GameUI.renderChat = window.renderChat || function() {};
  window.GameUI.sendCurrentMessage = sendCurrentMessage; // fixed

} // <-- Added this closing brace to close the "else" block


// === IndexedDB Relationship Store Shim (IDB-backed) ===
(function(){
  if (window.__REL_STORE_PATCHED__) return;
  window.__REL_STORE_PATCHED__ = true;

  const DB_NAME = 'SimegameDB';
  const DB_VER = 1;
  const STORE_REL = 'relationships';

  const _cache = Object.create(null);
  let _dbPromise = null;

  function openDB(){
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject)=>{
      try{
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = function(){
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_REL)){
            db.createObjectStore(STORE_REL);
          }
        };
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ reject(req.error || new Error('IDB open failed')); };
      }catch(e){ reject(e); }
    });
    return _dbPromise;
  }

  async function idbGet(store, key){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      try{
        const tx = db.transaction(store, 'readonly');
        const os = tx.objectStore(store);
        const rq = os.get(key);
        rq.onsuccess = ()=> resolve(rq.result);
        rq.onerror = ()=> reject(rq.error || new Error('IDB get failed'));
      }catch(e){ reject(e); }
    });
  }

  async function idbSet(store, key, value){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      try{
        const tx = db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        const rq = os.put(value, key);
        rq.onsuccess = ()=> resolve(true);
        rq.onerror = ()=> reject(rq.error || new Error('IDB put failed'));
      }catch(e){ reject(e); }
    });
  }

  const RelStore = {
    async preload(npcId){
      try{
        if (_cache[npcId] !== undefined) return;
        const rel = await idbGet(STORE_REL, npcId);
        _cache[npcId] = rel || { id: npcId, history: [] };
      }catch(e){
        console.warn('RelStore.preload error', e);
        if (_cache[npcId] === undefined) _cache[npcId] = { id: npcId, history: [] };
      }
    },
    getSync(npcId){
      return _cache[npcId] || { id: npcId, history: [] };
    },
    async set(npcId, rel){
      _cache[npcId] = rel;
      try{
        await idbSet(STORE_REL, npcId, rel);
        try { if (window.RelBC) window.RelBC.postMessage({type:'rel:update', id: npcId}); } catch(_e){}
      }catch(e){ console.warn('RelStore.set failed', e); }
    }
  };
  window.RelStore = RelStore;
  try { window.RelBC = window.RelBC || new BroadcastChannel('simegame_chat'); } catch(_e) { window.RelBC = null; }

  if (typeof window.getRelationship !== 'function'){
    window.getRelationship = function(npcId){
      return RelStore.getSync(npcId);
    };
  }
  if (typeof window.setRelationship !== 'function'){
    window.setRelationship = function(npcId, rel){
      RelStore.set(npcId, rel);
    };
  }
  if (typeof window.appendMsgToLog !== 'function'){
    window.appendMsgToLog = function(who, text){
      try{
        var npcId = (window.currentNpcId && window.currentNpcId.id) || window.currentNpcId || (window.ActiveNPC && window.ActiveNPC.id) || 'unknown';
        if (!npcId) npcId = 'unknown';
        var rel = RelStore.getSync(npcId);
        if (!rel.history) rel.history = [];
        rel.history.push({ speaker: who, text: String(text) });
        RelStore.set(npcId, rel);
        try{ window.renderChat && window.renderChat(); }catch(_e){}
      }catch(e){
        console.warn('appendMsgToLog error', e);
      }
    };
  }

  // Listen for cross-tab updates and refresh when viewing same NPC
  try {
    if (window.RelBC && !window.__REL_BC_BOUND__) {
      window.__REL_BC_BOUND__ = true;
      window.RelBC.onmessage = function(ev){
        var d = ev && ev.data || {};
        if (d.type==='rel:update'){
          var cur = (typeof window.currentNpcId==='object' ? window.currentNpcId && window.currentNpcId.id : window.currentNpcId);
          if (cur && cur === d.id) {
            try { window.RelStore.preload(cur).then(function(){ if (typeof renderChat==='function') renderChat(); }); } catch(_e){}
          }
        }
      };
    }
  } catch(_e){}

})(); // end IDB shim
