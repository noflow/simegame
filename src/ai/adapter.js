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
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 512
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
  var text = data?.choices?.[0]?.message?.content ?? '';
  return text;
}

export async function mockChat(messages) {
  const last = messages.filter(m => m.role === 'user').pop()?.content || '';
  return `Mock reply: ${last.slice(0, 160)}…`;
}

export function isConfigured() {
  return Boolean(KEY) && Boolean(DEFAULT_BASE);
}
