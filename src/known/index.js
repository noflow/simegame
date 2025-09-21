// src/known/index.js

export function inferGender(npc){
  if (npc && npc.gender) return npc.gender;
  const p = (npc && npc.persona) ? String(npc.persona) : '';
  if (/\b(she|her)\b/i.test(p)) return 'female';
  if (/\b(he|his)\b/i.test(p)) return 'male';
  const o = (npc && npc.sexuality && npc.sexuality.orientation) || '';
  if (/lesbian/i.test(o)) return 'female';
  if (/^gay$/i.test(o)) return 'male';
  return 'unknown';
}

export function knownCharacters(){
  const chars = window.GameData?.CHARACTERS?.characters || [];
  const rels  = window.GameState?.state?.relationships || {};
  return chars.filter(c => rels[c.id] && rels[c.id].introduced);
}

export function openKnownModal(){
  const overlay = document.getElementById('knownModal');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  renderKnownList();
}

export function closeKnownModal(){
  var overlay = document.getElementById('knownModal');
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
}

export function renderKnownList(){
  const list = document.getElementById('knownList');
  if (!list) return;

  const searchInput = document.getElementById('knownSearch');
  const q = (searchInput ? searchInput.value : '').trim().toLowerCase();

  list.innerHTML = '';

  const allChars = window.GameData?.CHARACTERS?.characters || [];
  if (allChars.length === 0){
    list.innerHTML = `<div class="small">Load <b>characters.json</b> in Settings to see characters here.</div>`;
    const det = document.getElementById('knownDetail');
    if (det) det.innerHTML = `<div class="small">Select a character to see details.</div>`;
    return;
  }

  const introduced = knownCharacters();
  const filtered = introduced.filter(c =>
    !q || c.name.toLowerCase().includes(q) || (c.role || '').toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  );

  if (filtered.length === 0){
    list.innerHTML = `<div class="small">You haven't met anyone yet${q ? ' (or no matches for your search)' : ''}.</div>`;
    var det = document.getElementById('knownDetail');
    if (det) det.innerHTML = `<div class="small">Select a character to see details.</div>`;
    return;
  }

  filtered.forEach(c => {
    const item = document.createElement('div');
    item.className = 'known-item';
    item.innerHTML = `
      <img src="${c.avatar}" alt="${c.name}"/>
      <div style="flex:1">
        <div><b>${c.name}</b></div>
        <div class="small">${c.role || ''}</div>
      </div>`;
    item.addEventListener('click', () => renderKnownDetail(c.id));
    list.appendChild(item);
  });

  // Preselect the first result
  renderKnownDetail(filtered[0].id);
}

export function renderKnownDetail(id){
  const box = document.getElementById('knownDetail');
  if (!box) return;

  var chars = window.GameData?.CHARACTERS?.characters || [];
  const npc = chars.find(x => x.id === id);
  if (!npc){
    box.innerHTML = `<div class="small">Character not found. Load a valid <b>characters.json</b> and try again.</div>`;
    return;
  }

  const rel = window.GameUI?.getRelationship ? window.GameUI.getRelationship(npc.id) : null;
  const gender = inferGender(npc);
  const ap = npc.appearance || {};

  function firstSentence(str){
    if(!str) return '';
    try {
      const s = String(str).trim();
      const m = s.match(/^[^.!?]+[.!?]?/);
      return m ? m[0].trim() : s;
    } catch(e){ return String(str); }
  }

  function getDiscoveredTraits(npc, rel){
    const traits = Array.isArray(npc.traits) ? npc.traits : [];
    const history = (rel && Array.isArray(rel.history)) ? rel.history : [];
    const npcLines = history.filter(h => h.speaker === npc.name).map(h => (h.text || '').toLowerCase());
    const found = new Set((rel && Array.isArray(rel.discoveredTraits)) ? rel.discoveredTraits : []);
    traits.forEach(t => {
      const tLower = String(t).toLowerCase();
      if (npcLines.some(line => line.includes(tLower))) found.add(t);
    });
    if (rel) {
      rel.discoveredTraits = Array.from(found);
      try { window.GameState?.saveState?.(); } catch(e){}
    }
    return Array.from(found);
  }

  const desc = firstSentence(npc.persona) || (npc.role || '');
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
      ${
        learnedTraits.length
          ? learnedTraits.map(t => `<span class="trait-chip">${t}</span>`).join('')
          : '<div class="small">No traits discovered yet — chat more to learn about them.</div>'
      }
    </div>
    <div class="divider"></div>
    <div>
      <div class="small" style="margin-bottom:.25rem;">Physical Description</div>
      <div class="fact small">
        Height: ${ap.height || '—'} · Weight: ${ap.weight || '—'} · Hair: ${ap.hair || '—'} · Eyes: ${ap.eyes || '—'} · Style: ${ap.style || '—'}
      </div>
    </div>
  `;
}
