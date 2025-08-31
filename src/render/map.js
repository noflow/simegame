// render/map.js
import { state, saveState } from '../state.js';
import { WORLD } from '../data.js';

export function renderLocation(){
  const el = document.getElementById('locationDesc');
  if(!el || !WORLD || !WORLD.passages){ return; }
  const passage = WORLD.passages[state.location];
  const base = (typeof passage === 'string') ? passage : (passage?.text || '');

  try{
    const imgEl = document.getElementById('locationImage');
    const imgSrc = (typeof passage==='object' && passage && passage.image) ? passage.image : "";
    if(imgEl){ if(imgSrc){ imgEl.src = imgSrc; imgEl.style.display='block'; } else { imgEl.style.display='none'; } }
  }catch(e){}

  let html = base.replace(/\{npc:([a-z0-9_\-]+)\}/gi, (m,id)=>{
    const chars = window.GameData.CHARACTERS?.characters || [];
    const npc = chars.find(c=>c.id===id);
    if(!npc) return '';
    const present = window.GameLogic.npcHere(npc);
    const status = present ? `<span class="pill" style="border-color:#2f4732;color:#a6e0a3">here</span>` : `<span class="pill" style="border-color:#47322f;color:#e0b0a6">away</span>`;
    return `<div class="row" style="margin:.35rem 0"><img src="${npc.avatar}" alt="${npc.name}" style="width:28px;height:28px;border-radius:8px;border:1px solid #1b222b"/> <b>${npc.name}</b> <span class="small">(${npc.role})</span> ${status}</div>`;
  });
  html = html.replace(/\[\[(.+?)->(.+?)\]\]/g, (m,label,dest)=> `<a href="#" data-goto="${dest}">${label}</a>`);
  el.innerHTML = html;
  el.querySelectorAll('a[data-goto]').forEach(a=> a.addEventListener('click', e=>{ e.preventDefault(); goTo(a.dataset.goto); }));
  const loc = document.getElementById('loc'); if(loc) loc.textContent = state.location;
}
export function goTo(dest){
  if(!WORLD || !WORLD.passages || !WORLD.passages[dest]){ alert(`No such place: ${dest}`); return; }
  const pass = WORLD.passages[dest];
  if(typeof pass === 'object' && pass.locked){ alert(`${dest} is locked right now.`); return; }
  state.location = dest; state.threadVisible = [];
  window.GameUI.closeChatModal();
  renderLocation(); window.GameLogic.updatePresence(); window.GameUI.renderChat(); window.GameUI.renderSidebar(); saveState();
}
