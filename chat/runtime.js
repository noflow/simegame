// Chat runtime (v25) — single entry; ES5-compatible, dynamic router import
if (window.__CHAT_RUNTIME_LOADED__) {
  console.warn("♻️ Chat runtime already loaded — skipping.");
} else {
  window.__CHAT_RUNTIME_LOADED__ = true;
  console.log("✅ Chat runtime loaded.");

  // --- ensureModal: create overlay if missing (responsive, larger) ---
  if (typeof window.ensureModal !== 'function') {
    function ensureModal(){
      var ov = document.getElementById('chatOverlay');
      if (ov) return ov;
      ov = document.createElement('div');
      ov.id = 'chatOverlay';
      ov.setAttribute('role','dialog');
      ov.setAttribute('aria-hidden','true');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:none;z-index:9999;';
      ov.innerHTML = [
        '<style id="chatOverlayStyles">',
        '#chatOverlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:none;z-index:9999;}',
        '#chatBox{position:absolute;right:24px;bottom:24px;width:520px;max-width:92vw;height:70vh;max-height:86vh;background:#101114;color:#e6e6e6;border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.55);overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}',
        '#chatHeader{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#17181c;border-bottom:1px solid #24262b}',
        '#chatTitle{font-weight:600}',
        '#chatClose{background:#2a2d34;color:#e6e6e6;border:0;border-radius:10px;padding:6px 10px;cursor:pointer}',
        '#chatLog{height:calc(70vh - 120px);max-height:calc(86vh - 120px);overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#0d0f13}',
        '#chatLog .msg{padding:8px 10px;border-radius:10px;max-width:85%}',
        '#chatLog .msg.you{align-self:flex-end;background:#1f4f2e}',
        '#chatLog .msg.npc{align-self:flex-start;background:#222733}',
        '#chatForm{display:flex;gap:8px;padding:12px;background:#17181c;border-top:1px solid #24262b}',
        '#chatInput{flex:1;padding:10px 12px;border-radius:10px;border:1px solid #2a2d34;background:#0f1116;color:#e6e6e6}',
        '#sendBtn{padding:10px 14px;border-radius:10px;border:0;background:#3b82f6;color:white;cursor:pointer}',
        '@media (max-width: 520px){#chatBox{right:4vw;left:4vw;width:auto}}',
        '</style>',
        '<div id="chatBox">',
        '  <div id="chatHeader">',
        '    <strong id="chatTitle">Chat</strong>',
        '    <button id="chatClose" data-chat-close>✕</button>',
        '  </div>',
        '  <div id="chatLog"></div>',
        '  <form id="chatForm">',
        '    <input id="chatInput" autocomplete="off" placeholder="Say something...">',
        '    <button id="sendBtn" type="submit">Send</button>',
        '  </form>',
        '</div>'
      ].join('');
      document.body.appendChild(ov);
      // Wire submit/click/Enter
      var form = ov.querySelector('#chatForm');
      if (form) {
        form.addEventListener('submit', function(e){
          e.preventDefault();
          if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
        });
      }
      var sendBtn = ov.querySelector('#sendBtn');
      if (sendBtn) {
        sendBtn.addEventListener('click', function(e){
          e.preventDefault();
          if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
        });
      }
      var inputEl = ov.querySelector('#chatInput');
      if (inputEl) {
        inputEl.addEventListener('keydown', function(e){
          var key = e.key || e.keyCode;
          if (key === 'Enter' || key === 13) {
            e.preventDefault();
            if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
          }
        });
      }
      return ov;
    }
    window.ensureModal = ensureModal;
  }

  // --- Fallback renderChat (safe) ---
  if (typeof window.renderChat !== 'function') {
    function escapeHtml(s){
      var str = String(s||'');
      var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
      return str.replace(/[&<>"']/g, function(ch){ return map[ch]; });
    }
    function renderChat(){
      try{
        var ov = document.getElementById('chatOverlay');
        if (!ov) return;
        var log = ov.querySelector('#chatLog');
        if (!log) return;
        var rel = (typeof getRelationship==='function' ? getRelationship(window.currentNpcId) : null);
        if (!rel) { rel = { history: [], friendship: 0, romance: 0 }; if (typeof setRelationship==='function') try{ setRelationship(window.currentNpcId, rel); }catch(e){} }
        if (!rel.history) rel.history = [];
        log.innerHTML = rel.history.map(function(m){
          var who = m.speaker || '';
          var body = escapeHtml(m.text || '');
          var cls = (who==='You' ? 'you' : 'npc');
          return '<div class="msg '+cls+'"><strong>'+escapeHtml(who)+':</strong> '+body+'</div>';
        }).join('');
        log.scrollTop = log.scrollHeight;
      }catch(e){ console.warn('renderChat fallback failed:', e); }
    }
    window.renderChat = renderChat;
    window.GameUI = window.GameUI || {};
    window.GameUI.renderChat = renderChat;
  }

  // --- Close helpers & listeners ---
  function closeChatModal(){
    var ov = document.getElementById('chatOverlay');
    if (!ov) return;
    ov.style.display = 'none';
    ov.setAttribute('aria-hidden', 'true');
    var input = ov.querySelector('#chatInput');
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
    var ov = document.getElementById('chatOverlay') || (typeof ensureModal==='function' ? ensureModal() : null);
    var input = (ov && ov.querySelector) ? ov.querySelector('#chatInput') : document.querySelector('#chatInput');
    if (!input) return;
    var text = String(input.value || '').trim();
    if (!text) return;

    var npc = (typeof getNpcById==='function' ? getNpcById(window.currentNpcId) : (window.ActiveNPC||{id:'lily',name:'Lily'}));
    if (!npc) return;

    try {
      if ((npc.id==='lily' || /lily/i.test(npc.name||'')) && (!npc.relations || !npc.relations.MC)) {
        npc.relations = Object.assign({}, npc.relations||{}, { MC: { type:'sister', strength:80 } });
      }
    } catch(e){}

    var rel = (typeof getRelationship==='function' ? getRelationship(window.currentNpcId) : {history:[],friendship:0,romance:0});
    if (!rel.history) rel.history = [];
    rel.history.push({ speaker:'You', text:text, ts: Date.now() });

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

  // --- Start chat shim (presence.js) ---
  function startChat(npcId){
    try{
      if (npcId) window.currentNpcId = npcId;
      var ov = (typeof ensureModal==='function' ? ensureModal() : document.getElementById('chatOverlay'));
      if (!ov) { console.warn('startChat: #chatOverlay not found'); return; }
      ov.style.display = 'block';
      ov.removeAttribute('aria-hidden');
      try{
        var npc = (typeof getNpcById==='function' ? getNpcById(window.currentNpcId) : null);
        var title = ov.querySelector('#chatTitle');
        if (title && npc && npc.name) title.textContent = npc.name;
      }catch(e){}
      var input = ov.querySelector('#chatInput');
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
