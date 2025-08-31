// /chat/index.js

const CHAT_OVERLAY_ID = 'chatModal';
let currentNpcId = null;

function ensureModal() {
  let overlay = document.getElementById(CHAT_OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = CHAT_OVERLAY_ID;
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:2000';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="chatTitle"
         style="width:min(720px,95vw);background:var(--panel);border:1px solid #1b222b;border-radius:14px;overflow:hidden">
      <header style="display:flex;align-items:center;gap:.6rem;padding:.7rem .9rem;border-bottom:1px solid #1b222b;background:#0f141a">
        <img id="chatAvatar" style="width:28px;height:28px;border-radius:8px;border:1px solid #1b222b;object-fit:cover;display:none"/>
        <h3 id="chatTitle" style="margin:0;font-size:.98rem">Chat</h3>
        <span style="margin-left:auto"></span>
        <button class="close" id="chatCloseBtn" title="Close"
                style="margin-left:auto;background:#222;border:1px solid #2a3441;border-radius:8px;padding:.25rem .5rem;cursor:pointer">×</button>
      </header>
      <div class="body" style="display:flex;flex-direction:column;gap:.6rem;min-height:380px;max-height:70vh">
        <div id="chatMessages" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:.4rem"></div>
        <div class="row">
          <input id="chatInput" class="btn-ghost" placeholder="Say something…" style="flex:1"/>
          <button id="chatSend" class="btn-primary">Send</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target.id === CHAT_OVERLAY_ID) closeChatModal(); });
  overlay.querySelector('#chatCloseBtn').addEventListener('click', closeChatModal);
  overlay.querySelector('#chatSend').addEventListener('click', sendCurrentMessage);
  overlay.querySelector('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendCurrentMessage(); });

  return overlay;
}

function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function getNpcById(id){ const list = window.GameData?.CHARACTERS?.characters || []; return list.find(c=>c.id===id); }

export function getRelationship(id){
  const st = window.GameState?.state;
  if (!st) return { introduced:false, history:[], discoveredTraits:[] };
  st.relationships = st.relationships || {};
  if (!st.relationships[id]) st.relationships[id] = { introduced:true, history:[], discoveredTraits:[] };
  return st.relationships[id];
}

export function startChat(npcOrId){
  const npc = typeof npcOrId === 'string' ? getNpcById(npcOrId) : npcOrId;
  if (!npc){ alert('Load characters.json first.'); return; }
  currentNpcId = npc.id;
  getRelationship(npc.id); // ensure exists + introduced

  const overlay = ensureModal();
  const title = overlay.querySelector('#chatTitle');
  const avatar = overlay.querySelector('#chatAvatar');

  if (title) title.textContent = npc.name;
  if (avatar) {
    if (npc.avatar) {
      avatar.src = npc.avatar;
      avatar.style.display = 'block';
      avatar.onerror = () => { avatar.style.display = 'none'; };
    } else {
      avatar.style.display = 'none';
    }
  }

  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden','false');
  renderChat();
  const input = overlay.querySelector('#chatInput'); if (input) input.focus();
}

export function closeChatModal(){
  const overlay = document.getElementById(CHAT_OVERLAY_ID);
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden','true');
}

export function renderChat(){
  const overlay = ensureModal();
  const box = overlay.querySelector('#chatMessages');
  if (!box) return;
  box.innerHTML = '';

  if (!currentNpcId){
    box.innerHTML = '<div class="small">Pick someone to chat with.</div>';
    return;
  }

  const npc = getNpcById(currentNpcId);
  const rel = getRelationship(currentNpcId);

  (rel.history || []).forEach(h=>{
    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.style.justifyContent = h.speaker === 'You' ? 'flex-end' : 'flex-start';

    const b = document.createElement('div');
    b.style.maxWidth='75%';
    b.style.padding='.45rem .6rem';
    b.style.borderRadius='12px';
    b.style.border='1px solid #1b222b';
    b.style.background = h.speaker === 'You' ? '#17212b' : '#0f141a';
    b.innerHTML = `<div class="small" style="opacity:.8;margin-bottom:.15rem">${escapeHtml(h.speaker)}</div>${escapeHtml(h.text)}`;

    wrap.appendChild(b);
    box.appendChild(wrap);
  });

  box.scrollTop = box.scrollHeight;
}

function sendCurrentMessage(){
  const overlay = ensureModal();
  const input = overlay.querySelector('#chatInput');
  if (!input) return;
  const text = String(input.value || '').trim();
  if (!text) return;

  const npc = getNpcById(currentNpcId);
  if (!npc) return;

  const rel = getRelationship(currentNpcId);
  rel.history.push({ speaker:'You', text, ts: Date.now() });

  // Placeholder NPC reply (replace with your AI call if desired)
  const reply = generateStubReply(npc, text);
  rel.history.push({ speaker:npc.name, text: reply, ts: Date.now() });

  window.GameState?.saveState?.();
  input.value = '';
  renderChat();
}

function generateStubReply(npc, text){
  const hint = npc?.persona ? ` (${String(npc.persona).split('.').shift()})` : '';
  return `I hear you: "${text}".${hint ? ' ' + hint : ''}`;
}
