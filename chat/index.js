// chat/index.js (shim) — forward to unified runtime sender
export function sendCurrentMessage() {
  if (typeof window.sendCurrentMessage === 'function') {
    window.sendCurrentMessage();
  } else {
    console.warn('sendCurrentMessage not yet available.');
  }
}


;(function(global){
  if (!global.appendMsgToLog){
    global.appendMsgToLog = function(who, text){
      try{
        var log = document.getElementById('chatLog') || document.querySelector('.chat-log') || document.body;
        var div = document.createElement('div');
        div.className = 'msg ' + (who || 'sys');
        div.textContent = String(text || '');
        log.appendChild(div);
        if (log.scrollHeight) log.scrollTop = log.scrollHeight;
      }catch(e){ console.warn('appendMsgToLog error', e); }
    };
  }
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
  if (!global.closeCharCreateModal){
    global.closeCharCreateModal = function(){
      var m = document.getElementById('charCreateModal');
      if (m && m.parentNode) m.parentNode.removeChild(m);
    };
  }
})(window || this);
