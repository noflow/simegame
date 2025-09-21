
// cosmos.js — CosmosRP integration (settings UI + client)
(() => {
  const LS = {
    apiKey: 'cosmos.apiKey',
    baseUrl: 'cosmos.baseUrl',
    model: 'cosmos.model',
    endpointOverride: 'cosmos.endpointOverride'
  };

  const CosmosSettings = {
    load() {
      return {
        apiKey: localStorage.getItem(LS.apiKey) || '',
        baseUrl: localStorage.getItem(LS.baseUrl) || 'https://api.pawan.krd/cosmosrp/v1',
        model:  localStorage.getItem(LS.model)  || 'cosmosrp-v3.5',
        endpointOverride: localStorage.getItem(LS.endpointOverride) || ''
      };
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
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.cosmosrp-close');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    const s = CosmosSettings.load();
    const els = {
      apiKey: modal.querySelector('#cosmos_apiKey'),
      baseUrl: modal.querySelector('#cosmos_baseUrl'),
      model: modal.querySelector('#cosmos_model'),
      endpointOverride: modal.querySelector('#cosmos_endpointOverride'),
      testBtn: modal.querySelector('#cosmos_test'),
      testStatus: modal.querySelector('#cosmos_test_status'),
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
