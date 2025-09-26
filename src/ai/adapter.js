// src/ai/adapter.js
const DEFAULT_BASE = (localStorage.getItem('llm_base_url') || 'https://api.pawan.krd/cosmosrp/v1').replace(/\/$/, '');
const DEFAULT_MODEL = localStorage.getItem('llm_model') || 'CosmosRP-V3.5';
const KEY = localStorage.getItem('llm_api_key') || localStorage.getItem('cosmos.apiKey') || '';

export async function llmChat(messages, opts = {}) {
  const base = ((opts && opts.baseUrl) || DEFAULT_BASE).replace(/\/$/, '');
  const url = base + '/chat/completions';

  // Compute params (ES5-safe: no ?? or optional chaining)
  var temperature = (function () {
    var temp = opts.temperature;
    if (temp === undefined || temp === null) {
      var tLS = parseFloat(localStorage.getItem('llm_temperature'));
      temp = isNaN(tLS) ? 1.25 : tLS; // slightly higher for variety
    }
    if (temp < 0) temp = 0;
    if (temp > 2) temp = 2;
    return temp;
  })();

  var top_p = (function () {
    var v = (opts.top_p !== undefined && opts.top_p !== null)
      ? opts.top_p
      : parseFloat(localStorage.getItem('llm_top_p'));
    if (isNaN(v)) v = 0.98; // allow wider sampling for richer replies
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    return v;
  })();

  var presence_penalty = (function () {
    var v = (opts.presence_penalty !== undefined && opts.presence_penalty !== null)
      ? opts.presence_penalty
      : parseFloat(localStorage.getItem('llm_presence_penalty'));
    return isNaN(v) ? 0.3 : v; // lower penalty to avoid terse avoidance
  })();

  var frequency_penalty = (function () {
    var v = (opts.frequency_penalty !== undefined && opts.frequency_penalty !== null)
      ? opts.frequency_penalty
      : parseFloat(localStorage.getItem('llm_frequency_penalty'));
    return isNaN(v) ? 0.2 : v; // keep repetition under control but gentle
  })();

  var max_tokens = (function () {
    var mt = (opts.max_tokens !== undefined && opts.max_tokens !== null)
      ? opts.max_tokens
      : parseInt(localStorage.getItem('llm_max_tokens') || '', 10);
    if (isNaN(mt)) mt = 1000; // CHANGED DEFAULT: Increased token budget for descriptive AI
    if (mt < 64) mt = 64;
    if (mt > 2048) mt = 2048;
    return mt;
  })();

  const body = {
    model: (opts.model || DEFAULT_MODEL),
    messages: messages,
    temperature: temperature,
    top_p: top_p,
    presence_penalty: presence_penalty,
    frequency_penalty: frequency_penalty,
    max_tokens: max_tokens
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
  return 'Mock reply: ' + last.slice(0, 160) + '…';
}

export function isConfigured() {
  var haveKey = !!(localStorage.getItem('llm_api_key') || localStorage.getItem('cosmos.apiKey') || '');
  var haveBase = !!(localStorage.getItem('llm_base_url') || DEFAULT_BASE);
  return haveKey && haveBase;
}
