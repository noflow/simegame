/* runtime.js — rebuilt clean to fix parse errors and bad strings */

;(function(global){
  'use strict';

  // -------- Utilities --------
  function safe(fn){ try { return fn(); } catch(_e){} }
  function byId(id){ return document.getElementById(id); }
  function qs(sel, root){ return (root||document).querySelector(sel); }

  // Polyfills / guards
  if (!global.appendMsgToLog){
    global.appendMsgToLog = function(who, text){
      var log = byId('chatLog') || qs('.chat-log') || document.body;
      var div = document.createElement('div');
      div.className = 'msg ' + (who || 'sys');
      div.textContent = String(text || '');
      log.appendChild(div);
      if (log.scrollHeight) log.scrollTop = log.scrollHeight;
    };
  }

  if (!global.ensureModal){
    global.ensureModal = function(){
      var modal = byId('chatModal');
      if (!modal){
        modal = document.createElement('div');
        modal.id = 'chatModal';
        modal.className = 'modal cosmosrp';
        modal.innerHTML = [
          '<div class="chat-window">',
            '<div id="chatLog" class="chat-log" style="max-height:50vh;overflow:auto"></div>',
            '<form id="chatForm" class="chat-form">',
              '<input id="chatInput" type="text" autocomplete="off" placeholder="Say something..."/>',
              '<button id="sendBtn" type="submit">Send</button>',
              '<button id="chatClear" type="button">Clear</button>',
              '<button id="chatClose" type="button">Close</button>',
            '</form>',
          '</div>'
        ].join('');
        document.body.appendChild(modal);
      }
      return modal;
    };
  }

  if (!global.closeCharCreateModal){
    global.closeCharCreateModal = function(){
      var m = byId('charCreateModal');
      if (m && m.parentNode) m.parentNode.removeChild(m);
    };
  }

  function openChatModal(){
    var modal = ensureModal();
    modal.style.display = 'block';
    var input = qs('#chatInput', modal);
    if (input) input.focus();
  }
  function closeChatModal(){
    var modal = ensureModal();
    modal.style.display = 'none';
  }

  function renderChat(){
    var modal = ensureModal();
    var log = byId('chatLog') || qs('.chat-log', modal);
    if (!log) return;
    // Live render from RelStore (if available)
    var id = global.currentNpcId || (global.ActiveNPC && global.ActiveNPC.id) || 'lily';
    var rel = safe(()=> global.RelStore.getSync(id)) || { history: [] };
    var hist = rel.history || [];
    log.innerHTML = '';
    for (var i=0; i<hist.length; i++){
      var row = hist[i];
      var div = document.createElement('div');
      div.className = 'msg ' + (row.speaker || 'sys');
      div.textContent = String(row.text || '');
      log.appendChild(div);
    }
    if (log.scrollHeight) log.scrollTop = log.scrollHeight;
  }

  // getRespond guard
  function getResponder(){
    if (typeof global.getRespond === 'function') return global.getRespond();
    // fallback: echo
    return Promise.resolve(function(userText, ctx){
      return "Sorry, I'm busy right now.";
    });
  }

  // -------- Sender --------
  function sendCurrentMessage(){
    try{
      var modal = ensureModal();
      var input = qs('#chatInput', modal); if (!input) return;
      var textVal = String(input.value || '').trim();
      if (!textVal) return;
      input.value = '';

      // Resolve NPC id & rel
      var npc = null;
      if (global.ActiveNPC && typeof global.ActiveNPC === 'object') npc = global.ActiveNPC;
      else if (typeof global.currentNpcId === 'string' && typeof global.getNpcById === 'function') npc = getNpcById(global.currentNpcId);

      var id = (typeof global.currentNpcId === 'object' && global.currentNpcId && global.currentNpcId.id)
                || (npc && npc.id) || global.currentNpcId || 'lily';

      // push user message
      var rel = safe(()=> global.RelStore.getSync(id)) || { history: [] };
      rel.history = rel.history || [];
      rel.history.push({speaker:'You', text:textVal, ts:Date.now()});
      safe(()=> global.RelStore.set(id, rel).then(renderChat));

      // ask AI
      getResponder().then(function(fn){
        try {
          var ctx = {
            npc: npc,
            world: (global.GameWorld || global.world || global.gameWorld || {}),
            player: (global.Player || { id:'MC', name:'You' })
          };
          return fn(textVal, ctx);
        } catch(e){
          safe(()=> global.__AI_DEBUG_ERR && global.__AI_DEBUG_ERR('sendCurrentMessage', e));
          throw e;
        }
      }).then(function(reply){
        reply = String(reply || '');
        safe(()=> appendMsgToLog((npc && npc.name) ? npc.name : 'AI', reply));
        var r2 = safe(()=> global.RelStore.getSync(id)) || { history: [] };
        r2.history = r2.history || [];
        r2.history.push({speaker: (npc && npc.name) ? npc.name : 'AI', text: reply, ts: Date.now()});
        return safe(()=> global.RelStore.set(id, r2).then(renderChat));
      }).catch(function(err){
        var r3 = safe(()=> global.RelStore.getSync(id)) || { history: [] };
        r3.history = r3.history || [];
        var msg = '[AI error: ' + String(err) + ']';
        r3.history.push({speaker:'System', text: msg, ts: Date.now()});
        safe(()=> appendMsgToLog('System', msg));
        return safe(()=> global.RelStore.set(id, r3).then(renderChat));
      });

    }catch(e){
      console.warn('sendCurrentMessage failed', e);
    }
  }
  global.sendCurrentMessage = sendCurrentMessage;

  // -------- Start chat --------
  function startChat(npcOrId){
    try{
      var npc = null;
      if (npcOrId && typeof npcOrId === 'object') npc = npcOrId;
      else if (typeof getNpcById === 'function' && npcOrId) npc = getNpcById(npcOrId);
      if (npc && npc.id) { global.currentNpcId = npc.id; global.ActiveNPC = npc; }
      openChatModal();
      renderChat();

      // wire listeners (once per modal create)
      var modal = ensureModal();
      var form = qs('#chatForm', modal);
      var sendBtn = qs('#sendBtn', modal);
      var closeBtn = qs('#chatClose', modal);
      var clearBtn = qs('#chatClear', modal);
      if (form && !form.__bound){ form.__bound = true; form.addEventListener('submit', function(e){ e.preventDefault(); sendCurrentMessage(); }); }
      if (sendBtn && !sendBtn.__bound){ sendBtn.__bound = true; sendBtn.addEventListener('click', function(e){ e.preventDefault(); sendCurrentMessage(); }); }
      if (closeBtn && !closeBtn.__bound){ closeBtn.__bound = true; closeBtn.addEventListener('click', function(e){ e.preventDefault(); closeChatModal(); }); }
      if (clearBtn && !clearBtn.__bound){ clearBtn.__bound = true; clearBtn.addEventListener('click', function(e){ e.preventDefault(); safe(()=>global.RelStore.set(global.currentNpcId || (npc && npc.id) || 'lily', {history:[], friendship:0, romance:0}).then(renderChat)); }); }

      // close on backdrop
      var wrap = qs('.cosmosrp', modal);
      if (wrap && !wrap.__bound){
        wrap.__bound = true;
        modal.addEventListener('click', function(e){
          if (e.target === modal) closeChatModal();
        });
      }
    }catch(e){
      console.warn('startChat failed', e);
    }
  }
  global.startChat = startChat;

  // init hook (optional auto-open)
  safe(function(){ if (!byId('chatLog')) ensureModal(); });
})(window);