export function inferGender(npc){
  if(npc.gender) return npc.gender;
  const p = (npc.persona || '');
  if(/\b(she|her)\b/i.test(p)) return 'female';
  if(/\b(he|his)\b/i.test(p)) return 'male';
  const o = npc.sexuality && npc.sexuality.orientation || '';
  if(/lesbian/i.test(o)) return 'female';
  if(/^gay$/i.test(o)) return 'male';
  return 'unknown';
}
export function knownCharacters(){
  if(!window.GameData.CHARACTERS || !window.GameData.CHARACTERS.characters) return [];
  return window.GameData.CHARACTERS.characters.filter(
    c => window.GameState.state.relationships && window.GameState.state.relationships[c.id] && window.GameState.state.relationships[c.id].introduced
  );
}
export function openKnownModal(){
  const overlay = document.getElementById('knownModal');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden','false');
  renderKnownList();
}
export function closeKnownModal(){
  const overlay = document.getElementById('knownModal');
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden','true');
}
export function renderKnownList(){
  const list = document.getElementById('knownList');
  const search = (document.getElementById('knownSearch')?.value || '').trim().toLowerCase();
  if (!list) return;
  list.innerHTML = '';
  const chars = knownCharacters().filter(
    c => c.name.toLowerCase().includes(search) || (c.role||'').toLowerCase().includes(search)
  );
  if (chars.length === 0){
    list.innerHTML = '<div class="small">You haven’t met anyone yet.</div>';
    const det = document.getElementById('knownDetail');
    if (det) det.innerHTML = '<div class="small">Select a character to see details.</div>';
    return;
  }
  chars.forEach(c=>{
    const item = document.createElement('div');
    item.className = 'known-item';
    item.innerHTML = `<img src="${c.avatar}" alt="${c.name}"/><div style="flex:1"><div><b>${c.name}</b></div><div class="small">${c.role||''}</div></div>`;
    item.addEventListener('click', ()=> renderKnownDetail(c.id));
    list.appendChild(item);
  });
  renderKnownDetail(chars[0].id);
}
export function renderKnownDetail(id){
  const npc = window.GameData.CHARACTERS.characters.find(x=>x.id===id);
  const box = document.getElementById('knownDetail');
  if (!npc || !box) return;
  const rel = window.GameUI.getRelationship(npc.id);
  const gender = inferGender(npc);
  const ap = npc.appearance || {};
  function firstSentence(str){
    if(!str) return '';
    try{
      const s = String(str).trim();
      const m = s.match(/^[^.!?]+[.!?]?/);
      return m ? m[0].trim() : s;
    }catch(e){ return String(str); }
  }
  function getDiscoveredTraits(npc, rel){
    const traits = Array.isArray(npc.traits) ? npc.traits : [];
    const history = (rel && Array.isArray(rel.history)) ? rel.history : [];
    const npcLines = history.filter(h => h.speaker === npc.name).map(h => (h.text||'').toLowerCase());
    const found = new Set((rel && Array.isArray(rel.discoveredTraits)) ? rel.discoveredTraits : []);
    traits.forEach(t => {
      const tLower = String(t).toLowerCase();
      if(npcLines.some(line => line.includes(tLower))) found.add(t);
    });
    if (rel) {
      rel.discoveredTraits = Array.from(found);
      try { window.GameState.saveState(); } catch(e){}
    }
    return Array.from(found);
  }
  const desc = firstSentence(npc.persona) || (npc.role||'');
  const learnedTraits = getDiscoveredTraits(npc, rel);
  box.innerHTML = `
    <div class="player-card">
      <img src="${npc.avatar}" alt="${npc.name}"/>
      <div class="pc-info">
        <div class="pc-name">${npc.name}</div>
        <div class="pc-desc">${desc}</div>
        <div class="small">Sex: ${gender}</div>
      </div>
    </div>
    <div class="divider"></div>
    <div>
      <div class="small" style="margin-bottom:.25rem;">Traits learned</div>
      ${learnedTraits.length ? learnedTraits.map(t=>`<span class="trait-chip">${t}</span>`).join('') : '<div class="small">No traits discovered yet — chat more to learn about them.</div>'}
    </div>
    <div class="divider"></div>
    <div>
      <div class="small" style="margin-bottom:.25rem;">Physical Description</div>
      <div class="fact small">
        Height: ${ap.height||'—'} · Weight: ${ap.weight||'—'} · Hair: ${ap.hair||'—'} · Eyes: ${ap.eyes||'—'} · Style: ${ap.style||'—'}
      </div>
    </div>
  `;
}
