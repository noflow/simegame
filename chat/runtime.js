// === Chat relationship shim (always-on) + Debug v35 ===
(function(){
  try {
    if (typeof window === 'undefined') return;
    // v35 tag
    window.__CHAT_RUNTIME_BUILD = "v35-debug-" + (new Date()).toISOString();
    // Debug overlay (toggle via ?chatdebug=1 or localStorage.CHAT_DEBUG='1')
    var q = (location && location.search || "");
    var enabled = /\bchatdebug=1\b/.test(q) || (function(){ try { return localStorage.getItem('CHAT_DEBUG') === '1'; } catch(e){ return false; }})();
    function ensureDbg(){
      var el = document.getElementById('chatDebug');
      if (el) return el;
      el = document.createElement('div');
      el.id = 'chatDebug';
      el.style.cssText = 'position:fixed;right:10px;bottom:10px;width:min(420px,80vw);max-height:40vh;overflow:auto;z-index:99999;font:12px/1.4 monospace;background:rgba(0,0,0,0.8);color:#0f0;border:1px solid #0f0;border-radius:8px;padding:8px;box-shadow:0 6px 18px rgba(0,0,0,0.4)';
      el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><strong>Chat Debug</strong><button id="chatDebugClose" style="background:#111;color:#0f0;border:1px solid #0f0;border-radius:4px;padding:2px 6px;cursor:pointer">×</button></div><pre id="chatDebugLog" style="white-space:pre-wrap;margin:0"></pre>';
      document.body.appendChild(el);
      var btn = el.querySelector('#chatDebugClose');
      if (btn) btn.addEventListener('click', function(){ el.style.display='none'; });
      return el;
    }
    function logLine(msg, data){
      var s = "[" + (new Date()).toLocaleTimeString() + "] " + String(msg);
      if (data !== undefined) { try { s += " " + JSON.stringify(data); } catch(e){} }
      console.debug("%c[CHAT]", "color:#0a0", s, data||"");
      if (!enabled) return;
      var wrap = ensureDbg();
      var pre = wrap.querySelector('#chatDebugLog');
      if (pre) pre.textContent = (pre.textContent + (pre.textContent? "\n":"") + s).slice(-8000);
    }
    window.ChatDebug = {
      enable: function(){ try { localStorage.setItem('CHAT_DEBUG','1'); } catch(e){} enabled = true; logLine("Chat debug enabled"); },
      disable: function(){ try { localStorage.removeItem('CHAT_DEBUG'); } catch(e){} enabled = false; var el=document.getElementById('chatDebug'); if(el) el.style.display='none'; console.debug("[CHAT] debug disabled"); },
      log: logLine,
      build: function(){ return window.__CHAT_RUNTIME_BUILD; }
    };
    // Relationship shim
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
    logLine("Chat runtime loaded", { build: window.__CHAT_RUNTIME_BUILD });
  } catch(e) {
    console.warn('chat relationship shim/debug error', e);
  }
})(); 
// === End v35 shims ===

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
        '      <button id="chatClose" data-chat-close class="btn-ghost">Close</button>',
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
      try { window.ChatDebug && ChatDebug.log('ensureModal: modal created'); } catch(e){}
      try {
        var style = document.getElementById('chatMsgStyles');
        if (!style){
          style = document.createElement('style');
          style.id = 'chatMsgStyles';
          style.textContent = '.cosmosrp-log{background:var(--panel,rgba(255,255,255,0.02));} .cosmosrp-log .msg{display:flex;gap:8px;margin:8px 0;padding:8px;border-radius:8px;border:1px solid #1b222b} .cosmosrp-log .msg.you{background:rgba(0,128,0,0.08)} .cosmosrp-log .msg.npc{background:rgba(0,0,128,0.08)} .cosmosrp-log .msg .who{font-weight:bold;min-width:64px} .cosmosrp-log .msg .body{white-space:pre-wrap;}';
          document.head.appendChild(style);
        }
      } catch(e){}

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

  // --- Direct DOM append fallback (ensures messages always show) ---
  function appendMsgToLog(who, text){
    try {
      var modal = document.getElementById('chatModal') || (typeof ensureModal === 'function' ? ensureModal() : null);
      if (!modal) return;
      var log = modal.querySelector('#chatLog');
      if (!log) return;
      var div = document.createElement('div');
      var cls = (String(who).toLowerCase() === 'you') ? 'you' : 'npc';
      div.className = 'msg ' + cls;
      div.innerHTML = '<div class="who">' + (who || '') + '</div><div class="body">' + String(text || '').replace(/[&<>"]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s])) + '</div>';
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      try{ window.ChatDebug && ChatDebug.log('appendMsgToLog', {who: who, text: text}); }catch(_e){}
    } catch(e){
      console.warn('appendMsgToLog error', e);
    }
  }

  }

  // --- Fallback renderChat (safe) ---
  if (typeof window.renderChat !== 'function') {
    function escapeHtml(s){
      var str = String(s || '');
      var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
      return str.replace(/[&<>"']/g, function(ch){ return map[ch]; });
    }
    function renderChat(){
      try{
        var modal = document.getElementById('chatModal');
        if (!modal) return;
        var log = modal.querySelector('#chatLog');
        if (!log) return;
        var relId = window.currentNpcId || (window.ActiveNPC && window.ActiveNPC.id) || 'lily';
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
    modal.setAttribute('aria-hidden','true');
    
      // Seed greeting if first time chatting
      try {
        var rel0 = (typeof getRel==='function' ? getRel(window.currentNpcId) : null) || { history: [], friendship: 0, romance: 0 };
        if (!Array.isArray(rel0.history)) rel0.history = [];
        if (rel0.history.length === 0) {
          var npc0 = (window.ActiveNPC && window.ActiveNPC.id === window.currentNpcId) ? window.ActiveNPC : (typeof getNpcById === 'function' ? getNpcById(window.currentNpcId) : null) || { id: window.currentNpcId, name: String(window.currentNpcId||'NPC') };
          var g = (npc0 && npc0.greetings) ? npc0.greetings : {};
          var greetText = (g && (g.work || g.home || g.default || g.intro || g.casual)) || (npc0.greeting || null);
          if (!greetText) greetText = "Hi, I'm " + (npc0.name || 'NPC') + ". How can I help?";
          appendMsgToLog(npc0.name || (npc0.id || 'NPC'), String(greetText));
          rel0.history.push({ speaker: npc0.name || (npc0.id || 'NPC'), text: String(greetText), ts: Date.now() });
          try { if (typeof setRel==='function') setRel(window.currentNpcId, rel0); } catch(e){}
          try{ window.ChatDebug && ChatDebug.log('greeting seeded', {npcId:npc0.id, greet: greetText}); }catch(_e){}
        } else {
          try{ window.ChatDebug && ChatDebug.log('greeting skipped (history exists)', {len: rel0.history.length}); }catch(_e){}
        }
      } catch(e){ try{ window.ChatDebug && ChatDebug.log('greeting error', {err: String(e && (e.stack || e))}); }catch(_e){} }

      var input = modal.querySelector('#chatInput');
    if (input) input.blur();
  }
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
    window.ActiveNPC = npc; try{ window.ChatDebug && ChatDebug.log('sendCurrentMessage: target npc', {id: npc && npc.id, name: npc && npc.name}); }catch(_e){}

    try {
      if ((npc.id==='lily' || /lily/i.test(npc.name||'')) && (!npc.relations || !npc.relations.MC)) {
        npc.relations = Object.assign({}, npc.relations||{}, { MC: { type:'sister', strength:80 } });
      }
    } catch(e){}

    var rel = (typeof getRelationship==='function' ? getRelationship(npc.id) : null) || {history:[],friendship:0,romance:0};
    if (!rel.history) rel.history = [];
    rel.history.push({ speaker:'You', text: textVal, ts: Date.now() });
    appendMsgToLog('You', textVal);
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
        appendMsgToLog(npc.name || (npc.id || 'NPC'), out);
        appendMsgToLog(npc.name || (npc.id || 'NPC'), '[AI error. Check settings/API key.]');
        rel.history.push({ speaker: npc.name || (npc.id || 'NPC'), text: out, ts: Date.now() });
      }).catch(function(err){ try{ window.ChatDebug && ChatDebug.log('AI: respondToV2 error', {error: String(err && (err.stack || err))}); }catch(_e){}
        console.error('AI router v2 error:', err);
        appendMsgToLog(npc.name || (npc.id || 'NPC'), '[AI error. Check settings/API key.]');
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
  function startChat(npcOrId) { try{ window.ChatDebug && ChatDebug.log('startChat called', {npcOrId: npcOrId}); }catch(_e){}
    try {
      var npc = null;
      if (npcOrId && typeof npcOrId === 'object') {
        npc = npcOrId;
      } else if (typeof getNpcById === 'function' && npcOrId) {
        npc = getNpcById(npcOrId);
      }

      if (npc && npc.id) {
        window.currentNpcId = npc.id; try{ window.ChatDebug && ChatDebug.log('startChat: set currentNpcId', {id:npc.id,name:npc.name}); }catch(_e){}
        window.ActiveNPC = npc; try{ window.ChatDebug && ChatDebug.log('sendCurrentMessage: target npc', {id: npc && npc.id, name: npc && npc.name}); }catch(_e){}
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

      modal.removeAttribute('aria-hidden');

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

      
      // Seed greeting if first time chatting
      try {
        var rel0 = (typeof getRel==='function' ? getRel(window.currentNpcId) : null) || { history: [], friendship: 0, romance: 0 };
        if (!Array.isArray(rel0.history)) rel0.history = [];
        if (rel0.history.length === 0) {
          var npc0 = (window.ActiveNPC && window.ActiveNPC.id === window.currentNpcId) ? window.ActiveNPC : (typeof getNpcById === 'function' ? getNpcById(window.currentNpcId) : null) || { id: window.currentNpcId, name: String(window.currentNpcId||'NPC') };
          var g = (npc0 && npc0.greetings) ? npc0.greetings : {};
          var greetText = (g && (g.work || g.home || g.default || g.intro || g.casual)) || (npc0.greeting || null);
          if (!greetText) greetText = "Hi, I'm " + (npc0.name || 'NPC') + ". How can I help?";
          appendMsgToLog(npc0.name || (npc0.id || 'NPC'), String(greetText));
          rel0.history.push({ speaker: npc0.name || (npc0.id || 'NPC'), text: String(greetText), ts: Date.now() });
          try { if (typeof setRel==='function') setRel(window.currentNpcId, rel0); } catch(e){}
          try{ window.ChatDebug && ChatDebug.log('greeting seeded', {npcId:npc0.id, greet: greetText}); }catch(_e){}
        } else {
          try{ window.ChatDebug && ChatDebug.log('greeting skipped (history exists)', {len: rel0.history.length}); }catch(_e){}
        }
      } catch(e){ try{ window.ChatDebug && ChatDebug.log('greeting error', {err: String(e && (e.stack || e))}); }catch(_e){} }

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
