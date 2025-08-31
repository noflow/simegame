export function toggleDebugPanel(){
  const p = document.getElementById('debugPanel');
  if(!p) return;
  p.style.display = (p.style.display==='none' || !p.style.display) ? 'block' : 'none';
}
export function clearMemory(){ localStorage.removeItem('chat_memory_v1'); localStorage.removeItem('chat_summaries_v1'); alert('All NPC memory cleared.'); }
export function exportChat(npcId){
  const blob = new Blob([JSON.stringify({ npcId, state: window.GameState.state, timestamp:new Date().toISOString() }, null, 2)], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `chat_export_${npcId||'none'}.txt`; a.click(); URL.revokeObjectURL(a.href);
}
