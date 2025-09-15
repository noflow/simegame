// Chat runtime (v19) — single source of truth
if (window.__CHAT_RUNTIME_LOADED__) {
  console.warn("♻️ Chat runtime already loaded — skipping.");
} else {
  window.__CHAT_RUNTIME_LOADED__ = true;
  console.log("✅ Chat runtime loaded.");

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
  window.sendCurrentMessage = sendCurrentMessage;
}
