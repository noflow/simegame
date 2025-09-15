// Chat runtime (v20) — single entry; dynamic router import
if (window.__CHAT_RUNTIME_LOADED__) {
  console.warn("♻️ Chat runtime already loaded — skipping.");
} else {
  window.__CHAT_RUNTIME_LOADED__ = true;
  console.log("✅ Chat runtime loaded.");

  // --- ensureModal: create a simple overlay if missing ---
  if (typeof window.ensureModal !== 'function') {
    function ensureModal(){
      var ov = document.getElementById('chatOverlay');
      if (ov) return ov;
      ov = document.createElement('div');
      ov.id = 'chatOverlay';
      ov.setAttribute('role','dialog');
      ov.setAttribute('aria-hidden','true');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:none;z-index:9999;';
      ov.innerHTML = [
        '<div id="chatBox" style="position:absolute;right:20px;bottom:20px;width:360px;max-width:90vw;background:#111;color:#eee;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto;">',
        '  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#1b1b1b;border-bottom:1px solid #2a2a2a;">',
        '    <strong id="chatTitle">Chat</strong>',
        '    <button id="chatClose" data-chat-close style="background:#333;color:#eee;border:0;border-radius:8px;padding:6px 10px;cursor:pointer">✕</button>',
        '  </div>',
        '  <div id="chatLog" style="height:260px;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:6px;background:#0f0f0f;"></div>',
        '  <form id="chatForm" style="display:flex;gap:6px;padding:10px;background:#1a1a1a;border-top:1px solid #2a2a2a">',
        '    <input id="chatInput" autocomplete="off" placeholder="Say something..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid #333;background:#0e0e0e;color:#eee">',
        '    <button id="sendBtn" type="submit" style="padding:8px 12px;border-radius:8px;border:0;background:#3b82f6;color:white;cursor:pointer">Send</button>',
        '  </form>',
        '</div>'
      ].join('');
      document.body.appendChild(ov);
      // Wire submit to sendCurrentMessage
      var form = ov.querySelector('#chatForm');
      if (form) {
        form.addEventListener('submit', function(e){
          e.preventDefault();
          if (typeof window.sendCurrentMessage === 'function') window.sendCurrentMessage();
        });
      }
      return ov;
    }
    window.ensureModal = ensureModal;
  }


  // --- Fallback helpers (only if host hasn't defined them) ---
  if (typeof window.ensureModal !== 'function') {
    function ensureModal(){ return document.getElementById('chatOverlay'); }
    window.ensureModal = ensureModal;
  }

  if (typeof window.renderChat !== 'function') {
    function escapeHtml(s){
      var str = String(s||'');
      var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
      return str.replace(/[&<>"']/g, function(ch){ return map[ch]; });
    }
    function renderChat(){
      try{
        const ov = document.getElementById('chatOverlay');
        if (!ov) return;
        const log = ov.querySelector('#chatLog');
        if (!log) return;
        const rel = (typeof getRelationship==='function' ? getRelationship(window.currentNpcId) : null);
        if (!rel || !Array.isArray(rel.history)) return;
        log.innerHTML = rel.history.map(function(m){
          const who = m.speaker || '';
          const body = escapeHtml(m.text || '');
          const cls = (who==='You' ? 'you' : 'npc');
          return '<div class="msg '+cls+'"><strong>'+escapeHtml(who)+':</strong> '+body+'</div>';
        }).join('');
        log.scrollTop = log.scrollHeight;
      }catch(e){ console.warn('renderChat fallback failed:', e); }
    }
    window.renderChat = renderChat;
    window.GameUI = window.GameUI || {};
    window.GameUI.renderChat = renderChat;
  }

  // Lazy-load the AI router exactly once
  let __routerPromise = null;
  function getRespond(){
    if (window.respondToV2) return Promise.resolve(window.respondToV2);
    if (!__routerPromise) {
      __routerPromise = import('../src/ai/router.v2.js').then(function(m){
        const fn = m.respondToV2 || m.default;
        if (!fn) throw new Error('router.v2.js missing respondToV2 export');
        window.respondToV2 = fn;
        return fn;
      });
    }
    return __routerPromise;
  }

  // Close helpers
  function closeChatModal(){
    const ov = document.getElementById('chatOverlay');
    if (!ov) return;
    ov.style.display = 'none';
    ov.setAttribute('aria-hidden', 'true');
    const input = ov.querySelector('#chatInput');
    if (input) input.blur();
  }
  window.closeChatModal = closeChatModal;

  if (!window.__chatCloseWired) {
    window.__chatCloseWired = true;
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeChatModal();
    });
    document.addEventListener('click', function(e){
      if (!e.target) return;
      if (e.target.matches && (e.target.matches('#chatClose') || e.target.matches('[data-chat-close]') || (e.target.closest && e.target.closest('[data-chat-close],#chatClose')))) {
        e.preventDefault();
        closeChatModal();
      }
    }, true);
  }

  // Core sender (no async/await)
  function sendCurrentMessage(){
    const ov = document.getElementById('chatOverlay') || (typeof ensureModal==='function' ? ensureModal() : null);
    const input = (ov && ov.querySelector) ? ov.querySelector('#chatInput') : document.querySelector('#chatInput');
    if (!input) return;
    const text = String(input.value || '').trim();
    if (!text) return;

    const npc = (typeof getNpcById==='function' ? getNpcById(window.currentNpcId) : (window.ActiveNPC||{id:'lily',name:'Lily'}));
    if (!npc) return;

    // Safety fallback: Lily knows MC is sibling
    try {
      if ((npc.id==='lily' || /lily/i.test(npc.name||'')) && (!npc.relations || !npc.relations.MC)) {
        npc.relations = Object.assign({}, npc.relations||{}, { MC: { type:'sister', strength:80 } });
      }
    } catch(e){}

    const rel = (typeof getRelationship==='function' ? getRelationship(window.currentNpcId) : {history:[],friendship:0,romance:0});
    rel.history.push({ speaker:'You', text, ts: Date.now() });

    var world = window.WORLD_STATE || null;
    var loadWorld = (world ? Promise.resolve(world) : fetch('./WORLD.json', { cache: 'no-store' })
        .then(function(r){ return r.ok ? r.json() : {}; })
        .catch(function(){ return {}; })
    ).then(function(w){ return w || {}; });

    const player = {
      id: (window.GameState && window.GameState.playerId) || 'MC',
      name: (window.GameState && window.GameState.playerName) || 'MC'
    };

    Promise.all([loadWorld, getRespond()]).then(function(vals){
      const w = vals[0];
      const respondToV2 = vals[1];
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

  // --- Start chat shim for presence.js ---
  function startChat(npcId){
    try{
      if (npcId) window.currentNpcId = npcId;
      var ov = (typeof ensureModal==='function' ? ensureModal() : document.getElementById('chatOverlay'));
      if (!ov) { console.warn('startChat: #chatOverlay not found'); return; }
      ov.style.display = 'block';
      ov.removeAttribute('aria-hidden');
      // set chat title if NPC available
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
  window.GameUI.renderChat = window.renderChat || (function(){});
  window.GameUI.sendCurrentMessage = window.sendCurrentMessage;

  window.sendCurrentMessage = sendCurrentMessage;
}
