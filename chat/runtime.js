// Chat runtime (v30) — full modal (#chatModal), ES5-compatible
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
        '    <form id="chatForm" class="cosmosrp-actions" style="display:flex;gap:8px;padding:12px;border-top:1px solid #1b222b">',
        '      <input id="chatInput" autocomplete="off" placeholder="Say something..." style="flex:1">',
        '      <button id="sendBtn" type="submit" class="btn-primary">Send</button>',
        '    </form>',
        '  </div>',
        '</div>'
      ].join('');
      document.body.appendChild(modal);
      // Wire form + send + enter
      var form = modal.querySelector('#chatForm');
      if (form) {
        form.addEventListener('submit', function(e){
          e.preventDefault();
          if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
        });
      }
      var sendBtn = modal.querySelector('#sendBtn');
      if (sendBtn) {
        sendBtn.addEventListener('click', function(e){
          e.preventDefault();
          if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
        });
      }
      var inputEl = modal.querySelector('#chatInput');
      if (inputEl) {
        inputEl.addEventListener('keydown', function(e){
          var key = e.key || e.keyCode;
          if (key === 'Enter' || key === 13) {
            e.preventDefault();
            if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
          }
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
      var map = {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"};
      return str.replace(/[&<>\\\"']/g, function(ch){ return map[ch]; });
    }
    function renderChat(){
      try{
        var modal = document.getElementById('chatModal');
        if (!modal) return;
        var log = modal.querySelector('#chatLog');
        if (!log) return;
        var rel = (typeof getRelationship==='function' ? getRelationship(window.currentNpcId) : null);
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
    if (!__routerPromise) {
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
  function sendCurrentMessage(){
    var modal = document.getElementById('chatModal') || (typeof ensureModal==='function' ? ensureModal() : null);
    var input = (modal && modal.querySelector) ? modal.querySelector('#chatInput') : document.querySelector('#chatInput');
    if (!input) return;
    var text = String(input.value || '').trim();
    if (!text) return;

    var npc = null;
    if (window.ActiveNPC && window.ActiveNPC.id) npc = window.ActiveNPC;
    else if (typeof getNpcById==='function') npc = getNpcById(window.currentNpcId);
    if (!npc) npc = { id: 'lily', name:'Lily'};

    try {
      if ((npc.id==='lily' || /lily/i.test(npc.name||'')) && (!npc.relations || !npc.relations.MC)) {
        npc.relations = Object.assign({}, npc.relations||{}, { MC: { type:'sister', strength:80 } });
      }
    } catch(e){}

    var rel = (typeof getRelationship==='function' ? getRelationship(npc.id) : {history:[],friendship:0,romance:0});
    if (!rel.history) rel.history = [];
    rel.history.push({ speaker:'You', text:text, ts: Date.now() });
    if (typeof setRelationship==='function') { try { setRelationship(npc.id, rel); } catch(e){} }

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

      return respondToV2(text, {
        world: w,
        now: new Date().toLocaleString(),
        npc: npc,
        meters: meters,
        player: player
      }).then(function(reply){
        rel.history.push({ speaker: npc.name, text: reply || '…', ts: Date.now() });
      }).catch(function(err){
        console.error('AI router v2 error:', err);
        rel.history.push({ speaker: npc.name, text: '[AI error. Check settings/API key.]', ts: Date.now() });
      }).then(function(){
        if (window.GameState && window.GameState.saveState) window.GameState.saveState();
        if (input) input.value = '';
        if (typeof renderChat==='function') renderChat();
      });
    });
  }
  window.sendCurrentMessage = sendCurrentMessage;

  // --- Start chat (accepts NPC object or id) ---
  function startChat(npcOrId){
    try{
      var npc = null;
      if (npcOrId && typeof npcOrId === 'object') { npc = npcOrId; }
      else if (typeof getNpcById==='function' && npcOrId) { npc = getNpcById(npcOrId); }
      if (npc && npc.id) {
        window.currentNpcId = npc.id;
        window.ActiveNPC = npc;
      } else if (!window.currentNpcId) {
        window.currentNpcId = 'lily';
      }
      var modal = (typeof ensureModal==='function' ? ensureModal() : document.getElementById('chatModal'));
      if (!modal) { console.warn('startChat: #chatModal not found'); return; }
      var wrap = modal.querySelector('.cosmosrp');
      if (wrap) { wrap.style.display = 'flex'; }
      modal.removeAttribute('aria-hidden');
      try{
        var relInit = (typeof getRelationship==='function') ? getRelationship(window.currentNpcId) : null;
        if (!relInit) { relInit = { history: [], friendship: 0, romance: 0 }; if (typeof setRelationship==='function') setRelationship(window.currentNpcId, relInit); }
      }catch(e){}
      try{
        var npc2 = npc || (typeof getNpcById==='function' ? getNpcById(window.currentNpcId) : null);
        var title = modal.querySelector('#chatTitle');
        if (title && npc2 && npc2.name) title.textContent = npc2.name;
      }catch(e){}
      var input = modal.querySelector('#chatInput');
      if (input) input.focus();
      if (typeof renderChat === 'function') renderChat();
    }catch(e){ console.error('startChat error:', e); }
  }
  window.startChat = startChat;
  window.GameUI = window.GameUI || {};
  window.GameUI.startChat = startChat;
  window.GameUI.closeChat = closeChatModal;
  window.GameUI.renderChat = window.renderChat || function(){};
  window.GameUI.sendCurrentMessage = window.sendCurrentMessage;
}
