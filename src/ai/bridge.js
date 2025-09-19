// src/ai/bridge.js
export async function generateLLM(userText, ctx){
  try{
    const res = await fetch('/api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userText, ctx })
    });
    if (!res.ok) return null;
    const data = await res.json().catch(()=>null);
    if (data && typeof data.reply === 'string') return (data.reply || '').trim();
    return null;
  }catch(_e){
    return null;
  }
}
