// src/ai/adapter.js
const DEFAULT_BASE = (localStorage.getItem('llm_base_url') || 'https://api.pawan.krd/cosmosrp/v1').replace(/\/$/, '');
const DEFAULT_MODEL = localStorage.getItem('llm_model') || 'CosmosRP-V3.5';
const KEY = localStorage.getItem('llm_api_key') || localStorage.getItem('cosmos.apiKey') || '';

export async function llmChat(messages, opts = {}) {
  const base = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const url = base + '/chat/completions';

  // Build request body (ES5-safe: no ?? / optional chaining)
  const body = {
    model: opts.model || DEFAULT_MODEL,
    messages: messages,
    temperature: (function () {
      var temp = opts.temperature;
      if (temp === undefined || temp === null) {
        var tLS = parseFloat(localStorage.getItem('llm_temperature'));
        temp = isNaN(tLS) ? 1.2 : tLS;
      }
      if (temp < 0) temp = 0;
      if (temp > 2) temp = 2;
      return temp;
    })(),
    top_p: (function () {
      var v = parseFloat(localStorage.getItem('llm_top_p'));
      if (isNaN(v)) v = 0.95;
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      return v;
    })(),
    presence_penalty: (function () {
      var v = parseFloat(localStorage.getItem('llm_presence_penalty'));
      return isNaN(v) ? 0.8 : v;
    })(),
    frequency_penalty: (function () {
      var v = parseFloat(localStorage.getItem('llm_frequency_penalty'));
      return isNaN(v) ? 0.5 : v;
    })(),
    max_tokens: (function () {
      var mt = (opts.max_tokens !== undefined && opts.max_tokens !== null) ? opts.max_tokens : 512;
      return mt;
    })()
  };

  var headers = { 'Content-Type': 'application/json' };
  if (KEY) headers['Authorization'] = 'Bearer ' + KEY;

  const res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(function(){ return ''; });
    throw new Error('LLM error ' + res.status + ': ' + text);
  }

  const data = await res.json().catch(function(){ return null; });
  const text =
    data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      ? data.choices[0].message.content
      : '';
  return text;
}

export async function mockChat(messages) {
  var last = '';
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messages[i] && messages[i].role === 'user') { last = String(messages[i].content || ''); break; }
  }
  return 'Mock reply: ' + (last.slice(0, 160)) + '…';
}

export function isConfigured() {
  return Boolean((localStorage.getItem('llm_api_key') || localStorage.getItem('cosmos.apiKey') || '')) &&
         Boolean((localStorage.getItem('llm_base_url') || DEFAULT_BASE));
}
