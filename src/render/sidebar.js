// render/sidebar.js
import { state } from '../state.js';

export function renderSidebar(){
  const sd = document.getElementById('sidebarDay'); if(sd) sd.textContent = state.day;
  const st = document.getElementById('sidebarTime'); if(st) st.textContent = window.GameConst.TIME_SLOTS[state.timeIndex];
  const sm = document.getElementById('sidebarMoney'); if(sm) sm.textContent = `$${state.money}`;
  const kc = document.getElementById('knownCount');
  if(kc && window.GameData.CHARACTERS && window.GameData.CHARACTERS.characters){
    const introduced = window.GameData.CHARACTERS.characters.filter(c => (state.relationships && state.relationships[c.id] && state.relationships[c.id].introduced));
    kc.textContent = introduced.length;
  }
}
export function renderInventory(){
  const inv = document.getElementById('inv'); if(!inv) return; inv.innerHTML='';
  window.GameState.state.inventory.forEach((it,i)=>{
    const row = document.createElement('div'); row.className='inv-item';
    row.innerHTML = `<span>${it}</span><span class="row"><button data-i="${i}" class="btn-ghost">Remove</button></span>`;
    row.querySelector('button').onclick = ()=>{ window.GameState.state.inventory.splice(i,1); renderInventory(); window.GameState.saveState(); };
    inv.appendChild(row);
  });
}
export function renderMoney(){ const m = document.getElementById('money'); if(m) m.textContent = `$${window.GameState.state.money}`; }
