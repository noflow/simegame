// /chat/index.js
console.log("✅ Loaded chat module from:", import.meta.url);
import { respondToV2 } from '../src/ai/router.v2.js';

const CHAT_OVERLAY_ID = 'chatModal';
let overlay = null;
let currentNpcId = null;
let detachEsc = null; // to remove ESC handler when closing
let lastSubmitAt = 0; // debounce to prevent double-send

function ensureModal() {
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = CHAT_OVERLAY_ID;
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.5);
    display:none; align-items:center; justify-content:center;
    z-index:3000; pointer-events:auto;`;

  overlay.innerHTML = `
    <div id="chatModalCard" class="modal" role="dialog" aria-modal="true" aria-labelledby="chatTitle"
         style="width:min(720px,95vw); background:var(--panel); border:1px solid #1b222b; border-radius:14px; overflow:hidden; pointer-events:auto;">
      <header style="display:flex; align-items:center; gap:.6rem; padding:.7rem .9rem; border-bottom:1px solid #1b222b; background:#0f141a">
        <img id="chatAvatar" style="width:28px;height:28px;border-radius:8px;border:1px solid #1b222b;object-fit:cover;display:none"/>
        <h3 id="chatTitle" style="margin:0;font-size:.98rem">Chat</h3>
        <span style="margin-left:auto"></span>
        <button class="close" id="chatCloseBtn" title="Close"
                style="margin-left:auto;background:#222;border:1px solid #2a3441;border-radius:8px;padding:.25rem .5rem;cursor:pointer">×</button>
      </header>
      <div class="body" style="display:flex;flex-direction:column;gap:.6rem;min-height:380px;max-height:70vh">
        <div id="chatMessages" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:.4rem"></div>
        <!-- ✅ form-based controls: Enter submits, no extra keydown listeners -->
        <form class="row" id="chatForm" style="gap:.5rem">
          <input id="chatInput" class="btn-ghost" placeholder="Say something…" style="flex:1" autocomplete="off" />
          <button id="chatSend" class="btn-primary" type="submit">Send</button>
        </form>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const card = overlay.querySelector('#chatModalCard');
  card.addEventListener('click', e => e.stopPropagation());           // clicks inside don't close
  overlay.addEventListener('click', e => {                            // click on backdrop closes
    if (e.target && e.target.id === CHAT_OVERLAY_ID) closeChatModal();
  });

  overlay.querySelector('#chatCloseBtn').addEventListener('click', closeChatModal);

  // ✅ single submit path (prevents double triggers)
  const form = overlay.querySelector('#chatForm');
  form.onsubmit = (e) => {
    e.preventDefault();
    // small debounce: ignore if another submit happened < 250ms ago
    const now = Date.now();
    if (now - lastSubmitAt < 250) return;
    lastSubmitAt = now;
    sendCurrentMessage();
  };

  // ❌ no input.onkeydown here
  // ❌ no extra click listener on #chatSend (submit already handles it)

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
  const rel = getRelationship(npc.id); // ensure exists + introduced

  // Greet if the NPC hasn't spoken yet (covers first time and old stub histories)
  const npcHasSpoken = Array.isArray(rel.history) && rel.history.some(h => h.speaker === npc.name);
  if (!npcHasSpoken) {
    rel.history = Array.isArray(rel.history) ? rel.history : [];
    const greet = npc.greeting || `Hi, I'm ${npc.name}.` + (npc.role ? ` I'm a ${npc.role.toLowerCase()}.` : '');
    rel.history.push({ speaker: npc.name, text: greet, ts: Date.now() });
    window.GameState?.saveState?.();
  }

  const ov = ensureModal();
  const title = ov.querySelector('#chatTitle');
  const avatar = ov.querySelector('#chatAvatar');

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

  // ESC closes while chat is open
  detachEsc?.(); // remove previous if any
  const escHandler = (e)=>{ if(e.key === 'Escape') closeChatModal(); };
  document.addEventListener('keydown', escHandler);
  detachEsc = ()=> document.removeEventListener('keydown', escHandler);

  ov.style.display = 'flex';
  ov.setAttribute('aria-hidden','false');

  // make sure input is visible + focused
  const input = ov.querySelector('#chatInput');
  if (input) { input.disabled = false; input.style.color = 'var(--text)'; input.value = ''; input.focus(); }

  renderChat();
}

export function closeChatModal(){
  const ov = document.getElementById(CHAT_OVERLAY_ID);
  if (!ov) return;
  ov.style.display = 'none';
  ov.setAttribute('aria-hidden','true');
  detachEsc?.(); // remove ESC handler
}

export function renderChat(){
  const ov = ensureModal();
  const box = ov.querySelector('#chatMessages');
  if (!box) return;
  box.innerHTML = '';

  const rel = currentNpcId ? getRelationship(currentNpcId) : null;
  if (!rel) {
    box.innerHTML = '<div class="small">Pick someone to chat with.</div>';
    return;
  }

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
  const ov = ensureModal();
  const input = ov.querySelector('#chatInput');
  if (!input) return;
  const text = String(input.value || '').trim();
  if (!text) return;

  const npc = getNpcById(currentNpcId);
  if (!npc) return;

  const rel = getRelationship(currentNpcId);
  // show player's line immediately
  rel.history.push({ speaker:'You', text, ts: Date.now() });

  // load world (WORLD.json or window.GameState fallback)
  var world = window.WORLD_STATE || null;
  var loadWorld = (world ? Promise.resolve(world) : fetch('./WORLD.json', { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : {}; })
      .catch(function(){ return {}; })
  ).then(function(w){ return w || {}; });

  loadWorld.then(function(w){
    if (w.currentDay == null && window.GameState && window.GameState.day) w.currentDay = window.GameState.day;
    if (!w.timeSegment && window.GameState && window.GameState.time) w.timeSegment = window.GameState.time;
    w.locations = w.locations || {};

    var meters = Object.assign({ friendship: rel.friendship || 0, romance: rel.romance || 0 }, rel.meters || {});

    return respondToV2(text, {
      world: w,
      now: new Date().toLocaleString(),
      npc: npc,
      meters: meters
    }).then(function(reply){
      rel.history.push({ speaker: npc.name, text: reply || '…', ts: Date.now() });
    }).catch(function(err){
      console.error('AI router v2 error:', err);
      rel.history.push({ speaker: npc.name, text: '[AI error. Check settings/API key.]', ts: Date.now() });
    }).then(function(){
      if (window.GameState && window.GameState.saveState) window.GameState.saveState();
      input.value = '';
      renderChat();
    });
  });
}
window.sendCurrentMessage = sendCurrentMessage; // <-- make it visible to onsubmit


window.sendCurrentMessage = sendCurrentMessage;
window.GameUI = Object.assign(window.GameUI || {}, {
  startChat, closeChatModal, renderChat, getRelationship
});
