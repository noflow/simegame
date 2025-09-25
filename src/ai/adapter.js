// src/ai/adapter.js
const DEFAULT_BASE = localStorage.getItem('llm_base_url') || 'https://api.pawan.krd/cosmosrp/v1';
const DEFAULT_MODEL = localStorage.getItem('llm_model') || 'CosmosRP-V3.5';
const KEY = localStorage.getItem('llm_api_key') || localStorage.getItem('cosmos.apiKey') || '';

export async function llmChat(messages, opts = {}) {
  const base = opts.baseUrl || DEFAULT_BASE;
  const url = `${base}/chat/completions`;
  const body = {
    model: opts.model || DEFAULT_MODEL,
    messages,
    (function(){
      let temp = opts.temperature;
      if (temp === undefined || temp === null){
        const tLS = parseFloat(localStorage.getItem('llm_temperature'));
        temp = isNaN(tLS) ? 1.2 : tLS;
      }
      if (temp < 0) temp = 0;
      if (temp > 2) temp = 2;
      return temp;
    })()?? 0.7,
    top_p: (function(){ const v=parseFloat(localStorage.getItem('llm_top_p')); return isNaN(v)?0.95:Math.max(0,Math.min(1,v)); })(),
    presence_penalty: (function(){ const v=parseFloat(localStorage.getItem('llm_presence_penalty')); return isNaN(v)?0.8:v; })(),
    frequency_penalty: (function(){ const v=parseFloat(localStorage.getItem('llm_frequency_penalty')); return isNaN(v)?0.5:v; })(),
    (function(){
      var mt = (opts.max_tokens !== undefined && opts.max_tokens !== null) ? opts.max_tokens : parseInt(localStorage.getItem('llm_max_tokens')||'',10);
      if (isNaN(mt)) mt = 640; // raise budget for richer replies
      if (mt < 64) mt = 64;
      if (mt > 2048) mt = 2048;
      return mt;
    })()
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': KEY ? `Bearer ${KEY}` : '' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  return text;
}

export async function mockChat(messages) {
  const last = messages.filter(m => m.role === 'user').pop()?.content || '';
  return `Mock reply: ${last.slice(0, 160)}…`;
}

export function isConfigured() {
  return Boolean(KEY) && Boolean(DEFAULT_BASE);
}
