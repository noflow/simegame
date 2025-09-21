
// cosmos.js — CosmosRP integration (settings UI + client)
(() => {
  const LS = {
    apiKey: 'cosmos.apiKey',
    baseUrl: 'cosmos.baseUrl',
    model: 'cosmos.model',
    endpointOverride: 'cosmos.endpointOverride',
    aiFreedom: 'cosmos.ai_freedom',
    temperature: 'cosmos.temperature',
    maxTokens: 'cosmos.max_tokens'
  };

  const CosmosSettings = {
    load() {
      return {
        apiKey: localStorage.getItem(LS.apiKey) || '',
        baseUrl: localStorage.getItem(LS.baseUrl) || 'https://api.pawan.krd/cosmosrp/v1',
        model:  localStorage.getItem(LS.model)  || 'cosmosrp-v3.5',
        endpointOverride: localStorage.getItem(LS.endpointOverride) || ''
      };
    // Prefill values (guarded)
    try {
      const st = CosmosSettings.load();
      if (els.apiKey) els.apiKey.value = st.apiKey || '';
      if (els.baseUrl) els.baseUrl.value = st.baseUrl || '';
      if (els.model) els.model.value = st.model || '';
      if (els.endpointOverride) els.endpointOverride.value = st.endpointOverride || '';
      if (els.aiFreedom && els.aiFreedomNum){
        const f = Number(isFinite(st.aiFreedom) ? st.aiFreedom : 0.8);
        els.aiFreedomNum.value = f; els.aiFreedom.value = f;
      }
      if (els.temperature && els.temperatureNum){
        const t = Number(isFinite(st.temperature) ? st.temperature : 0.9);
        els.temperatureNum.value = t; els.temperature.value = t;
      }
      if (els.maxTokens) els.maxTokens.value = Number(isFinite(st.maxTokens) ? st.maxTokens : 200);
      function clamp(n,min,max){ n=Number(n)||0; return Math.max(min, Math.min(max, n)); }
      function syncFreedom(v){ const n = clamp(v, 0, 1.2); if (els.aiFreedomNum) els.aiFreedomNum.value = n; if (els.aiFreedom) els.aiFreedom.value = n; }
      function syncTemp(v){ const n = clamp(v, 0, 2); if (els.temperatureNum) els.temperatureNum.value = n; if (els.temperature) els.temperature.value = n; }
      if (els.aiFreedom) els.aiFreedom.addEventListener('input', ()=> syncFreedom(els.aiFreedom.value));
      if (els.aiFreedomNum) els.aiFreedomNum.addEventListener('input', ()=> syncFreedom(els.aiFreedomNum.value));
      if (els.temperature) els.temperature.addEventListener('input', ()=> syncTemp(els.temperature.value));
      if (els.temperatureNum) els.temperatureNum.addEventListener('input', ()=> syncTemp(els.temperatureNum.value));
    } catch(e){ console.warn('prefill error', e); }
    },
    save({ apiKey, baseUrl, model, endpointOverride }) {
      if (apiKey !== undefined) localStorage.setItem(LS.apiKey, apiKey);
      if (baseUrl !== undefined) localStorage.setItem(LS.baseUrl, baseUrl);
      if (model !== undefined) localStorage.setItem(LS.model, model);
      if (endpointOverride !== undefined) localStorage.setItem(LS.endpointOverride, endpointOverride);
    }
  };

  function cosmosEndpoint() {
    const s = CosmosSettings.load();
    if (s.endpointOverride && s.endpointOverride.trim()) return s.endpointOverride.trim();
    const base = (s.baseUrl || '').replace(/\/+$/, '');
    return `${base}/chat/completions`;
  }

  async function callCosmosChat({ messages, temperature = 0.7, max_tokens = 512 }) {
    const s = CosmosSettings.load();
    if (!s.apiKey) throw new Error('CosmosRP API key is missing in Settings.');

    const res = await fetch(cosmosEndpoint(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${s.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: s.model,
        messages,
        temperature,
        max_tokens
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`CosmosRP error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      '';
    return { content, raw: data };
  }

  async function testCosmos() {
    try {
      const r = await callCosmosChat({
        messages: [{ role:'user', content:'Say "pong" if you can read me.' }],
        temperature: 0, max_tokens: 5
      });
      return /pong/i.test(r.content || '');
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // -------- Settings UI (minimal, self-contained) --------
  function ensureStyles() {
    const cssId = "cosmosrp-settings-css";
    if (document.getElementById(cssId)) return;
    const style = document.createElement('style');
    style.id = cssId;
    style.textContent = `
      .cosmosrp-btn {
        position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;
        padding: .6rem .9rem; border-radius: .6rem; border: none;
        background: var(--accent, #67c1f5); color: var(--text, #111);
        box-shadow: 0 6px 18px rgba(0,0,0,.25); cursor: pointer; font-weight: 600;
      }
      .cosmosrp-modal {
        position: fixed; inset: 0; z-index: 10000; display: none;
        align-items: center; justify-content: center;
        background: rgba(0,0,0,.45);
      }
      .cosmosrp-card {
        width: min(560px, 92vw);
        background: var(--panel, #12161b);
        color: var(--text, #e6eef7);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 1rem; padding: 1rem 1.25rem;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
      }
      .cosmosrp-card h3 { margin: 0 0 .5rem 0 }
      .cosmosrp-row { margin: .5rem 0 }
      .cosmosrp-row label { display: block; font-size: .9rem; opacity: .85; margin-bottom: .25rem }
      .cosmosrp-row input {
        width: 100%; padding: .55rem .65rem; border-radius: .5rem;
        border: 1px solid rgba(255,255,255,.15);
        background: rgba(0,0,0,.25); color: inherit;
      }
      .cosmosrp-adv summary { cursor: pointer; opacity: .85 }
      .cosmosrp-actions { display: flex; gap: .5rem; margin-top: .75rem; align-items: center }
      .cosmosrp-actions button {
        padding: .55rem .8rem; border-radius: .5rem; border: 1px solid rgba(255,255,255,.15);
        background: rgba(102, 187, 106, .15); color: inherit; cursor: pointer;
      }
      .cosmosrp-close {
        float: right; cursor: pointer; opacity: .7; font-weight: 700; font-size: 1.1rem;
      }
    `;
    document.head.appendChild(style);
  }

  
  function ensureTuningRows(modal){
    try{
      const getEl = (sel) => modal.querySelector(sel);
      const card = modal.querySelector('.cosmosrp-card');
      if (!card) return;
      const hasFreedom = !!getEl('#cosmos_aiFreedom');
      const hasTemp    = !!getEl('#cosmos_temperature');
      const hasMaxTok  = !!getEl('#cosmos_maxTokens');
      const actions = modal.querySelector('.cosmosrp-actions');
      const elFromHTML = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };

      if (!hasFreedom){
        const node = elFromHTML(`
          <div class="cosmosrp-row" style="display:grid;grid-template-columns: 1fr 3fr;gap:.5rem;align-items:center;">
            <label>AI Freedom</label>
            <div style="display:flex;gap:.5rem;align-items:center;">
              <input id="cosmos_aiFreedom_num" type="number" min="0" max="1.2" step="0.05" style="width:70px;">
              <input id="cosmos_aiFreedom" type="range" min="0" max="1.2" step="0.05" style="flex:1;">
            </div>
          </div>`);
        actions ? card.insertBefore(node, actions) : card.appendChild(node);
      }
      if (!hasTemp){
        const node = elFromHTML(`
          <div class="cosmosrp-row" style="display:grid;grid-template-columns: 1fr 3fr;gap:.5rem;align-items:center;">
            <label>Temperature</label>
            <div style="display:flex;gap:.5rem;align-items:center;">
              <input id="cosmos_temperature_num" type="number" min="0" max="2" step="0.05" style="width:70px;">
              <input id="cosmos_temperature" type="range" min="0" max="2" step="0.05" style="flex:1;">
            </div>
          </div>`);
        actions ? card.insertBefore(node, actions) : card.appendChild(node);
      }
      if (!hasMaxTok){
        const node = elFromHTML(`
          <div class="cosmosrp-row">
            <label>Max Tokens</label>
            <input id="cosmos_maxTokens" type="number" min="0" max="1000" step="1" placeholder="200">
          </div>`);
        actions ? card.insertBefore(node, actions) : card.appendChild(node);
      }
    } catch(e){ console.warn('ensureTuningRows error', e); }
  }
function buildModal() {
    ensureStyles();
    const modal = document.createElement('div');
    modal.className = 'cosmosrp-modal';
    modal.innerHTML = `
      <div class="cosmosrp-card">
        <span class="cosmosrp-close" title="Close">&times;</span>
        <h3>CosmosRP API</h3>
        <div class="cosmosrp-row">
          <label>API Key</label>
          <input id="cosmos_apiKey" type="password" placeholder="sk-...">
        </div>
        <div class="cosmosrp-row">
          <label>Base URL</label>
          <input id="cosmos_baseUrl" type="text" placeholder="https://api.pawan.krd/cosmosrp/v1">
        </div>
        <div class="cosmosrp-row">
          <label>Model ID (matching)</label>
          <input id="cosmos_model" type="text" placeholder="cosmosrp-v3.5">
        </div>
        <details class="cosmosrp-adv cosmosrp-row">
          <summary>Advanced: Override full endpoint</summary>
          <small>Leave blank to use <code>[Base URL]/chat/completions</code>.</small>
          <div style="margin-top:.35rem">
            <input id="cosmos_endpointOverride" type="text" placeholder="https://api.pawan.krd/cosmosrp/v1/chat/completions">
          </div>
        </details>
        <div class="cosmosrp-actions">
          <button id="cosmos_test" type="button">Test Connection</button>
          <span id="cosmos_test_status" style="font-size:.9rem;opacity:.85"></span>
        </div>
      </div>
    `;
    ensureTuningRows(modal);
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.cosmosrp-close');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    const s = CosmosSettings.load();
    const getEl = (sel) => modal.querySelector(sel);
    const els = {
      apiKey: getEl('#cosmos_apiKey'),
      baseUrl: getEl('#cosmos_baseUrl'),
      model: getEl('#cosmos_model'),
      endpointOverride: getEl('#cosmos_endpointOverride'),
      testBtn: getEl('#cosmos_test'),
      testStatus: getEl('#cosmos_test_status'),
    };
    els.apiKey.value = s.apiKey;
    els.baseUrl.value = s.baseUrl;
    els.model.value = s.model;
    els.endpointOverride.value = s.endpointOverride;

    [els.apiKey, els.baseUrl, els.model, els.endpointOverride].forEach(inp => {
      inp.addEventListener('change', () => {
        CosmosSettings.save({
          apiKey: els.apiKey.value.trim(),
          baseUrl: els.baseUrl.value.trim(),
          model: els.model.value.trim(),
          endpointOverride: els.endpointOverride.value.trim()
        });
      });
    });

    els.testBtn.addEventListener('click', async () => {
      els.testStatus.textContent = 'Testing...';
      const ok = await testCosmos();
      els.testStatus.textContent = ok ? '✅ Connected' : '❌ Failed';
    });

    return modal;
  }

  function ensureLauncher(modal) {
    let btn = document.getElementById('cosmosrp-launcher');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'cosmosrp-launcher';
    btn.className = 'cosmosrp-btn';
    btn.textContent = 'CosmosRP';
    btn.title = 'Open CosmosRP Settings';
    btn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
    document.body.appendChild(btn);
    return btn;
  }

  function bootstrap() {
    const modal = buildModal();
    ensureLauncher(modal);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // Expose on window for app usage
  window.CosmosRP = {
    settings: CosmosSettings,
    endpoint: cosmosEndpoint,
    callChat: callCosmosChat,
  };
})();
