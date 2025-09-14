Simegame AI Add-On (pre-wired)
------------------------------
Files added:
  src/ai/memory.js
  src/ai/policy.js
  src/ai/adapter.js
  src/ai/router.js

If you don't use <script type="module"> in index.html, import these from your JS entry instead.

Configure in browser console or settings UI:
  localStorage.llm_api_key = 'YOUR_KEY'
  localStorage.llm_base_url = 'https://api.pawan.krd/cosmosrp/v1'
  localStorage.llm_model = 'CosmosRP-V3.5'
  localStorage.ai_verbosity = 'concise'
