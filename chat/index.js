// chat/index.js (shim) — forward to unified runtime sender
export function sendCurrentMessage() {
  if (typeof window.sendCurrentMessage === 'function') {
    window.sendCurrentMessage();
  } else {
    console.warn('sendCurrentMessage not yet available.');
  }
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
