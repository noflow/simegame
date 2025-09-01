/**
 * cosmos_patcher.js
 * Patches:
 *   - index.html: add <script src="./src/cosmos.js"></script> before main.js and bump ?v=
 *   - src/main.js: bridge llm_api_key <-> cosmos.apiKey
 *   - index.js (built chat file): call window.CosmosRP.callChat in sendCurrentMessage()
 *
 * Run: node cosmos_patcher.js
 */

const fs = require('fs');
const path = require('path');

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}
function write(file, text, backup = true) {
  if (backup && !fs.existsSync(file + '.backup')) {
    fs.writeFileSync(file + '.backup', fs.readFileSync(file));
  }
  fs.writeFileSync(file, text, 'utf8');
}

function patchIndexHtml(file) {
  let src = read(file);
  // Ensure cosmos.js from /src is before main.js
  const mainTagRe = /<script\s+type="module"\s+src="\.\/*src\/main\.js(\?v=\d+)?"><\/script>/i;
  if (mainTagRe.test(src)) {
    src = src.replace(
      mainTagRe,
      '<script src="./src/cosmos.js"></script>\n  <script type="module" src="./src/main.js?v=20"></script>'
    );
  } else if (!/src=["']\.\/src\/cosmos\.js["']/.test(src)) {
    // Fallback: inject before </body>
    src = src.replace(
      /<\/body>/i,
      '<script src="./src/cosmos.js"></script>\n  <script type="module" src="./src/main.js?v=20"></script>\n</body>'
    );
  } else {
    // Cosmos already present; just bump main version
    src = src.replace(
      /<script\s+type="module"\s+src="\.\/*src\/main\.js\?v=\d+"><\/script>/i,
      '<script type="module" src="./src/main.js?v=20"></script>'
    );
  }
  write(file, src);
  console.log('✓ index.html patched');
}

function patchMainJs(file) {
  let src = read(file);
  if (src.includes('bridgeCosmosKey')) {
    console.log('• src/main.js: bridge already present');
    return;
  }
  const insertion = `
// --- Bridge: keep #apiKey (llm_api_key) and Cosmos (cosmos.apiKey) in sync ---
(function bridgeCosmosKey(){
  try {
    const k1 = localStorage.getItem('llm_api_key');
    const k2 = localStorage.getItem('cosmos.apiKey');
    if (k1 && !k2) localStorage.setItem('cosmos.apiKey', k1);
    if (k2 && !k1) localStorage.setItem('llm_api_key', k2);
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('change', () => {
        const v = apiKeyInput.value.trim();
        localStorage.setItem('llm_api_key', v);
        localStorage.setItem('cosmos.apiKey', v);
      });
    }
  } catch(e) { console.warn('Cosmos key bridge failed:', e); }
})();`;

  // Insert right after "boot();" inside DOMContentLoaded
  const domReadyRe = /(addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{\s*[\s\S]*?)(boot\(\);\s*)/;
  if (domReadyRe.test(src)) {
    src = src.replace(domReadyRe, (_, pre, bootCall) => pre + bootCall + '\n  ' + insertion + '\n');
  } else {
    // Fallback: append at end (safe)
    src += '\n' + insertion + '\n';
  }
  write(file, src);
  console.log('✓ src/main.js patched (key bridge)');
}

function patchChatBuilt(file) {
  let src = read(file);

  // Remove import of cosmos module (if any)
  src = src.replace(/^\s*import\s+\{\s*chatWithNpc\s*\}\s+from\s+['"]\.\.\/src\/cosmos\.js['"]\s*;\s*\n/m, '');

  // Replace sendCurrentMessage() body with Cosmos call
  const sendRe = /function\s+sendCurrentMessage\(\)\s*\{[\s\S]*?\}\s*/;
  const newFn = `
async function sendCurrentMessage(){
  const ov = ensureModal();
  const input = ov.querySelector('#chatInput');
  if (!input) return;
  const text = String(input.value || '').trim();
  if (!text) return;

  const npc = getNpcById(currentNpcId);
  if (!npc) return;

  const rel = getRelationship(currentNpcId);
  rel.history.push({ speaker:'You', text, ts: Date.now() });

  const history = Array.isArray(rel.history) ? rel.history.slice(-20) : [];
  const messages = [
    { role: 'system', content: \`You are roleplaying as \${npc.name}\${npc.role ? ', ' + npc.role : ''}. Persona: \${npc.persona || 'neutral'}. Stay in-character, natural, and concise.\` },
    ...history
      .filter(h => h && h.text)
      .map(h => h.speaker === 'You' ? { role:'user', content:h.text } : { role:'assistant', content:h.text })
  ];

  try {
    if (!window.CosmosRP || !window.CosmosRP.callChat) throw new Error('CosmosRP not loaded');
    const { content } = await window.CosmosRP.callChat({ messages, temperature: 0.7, max_tokens: 512 });
    rel.history.push({ speaker: npc.name, text: content || '…', ts: Date.now() });
  } catch (err) {
    console.error('LLM error:', err);
    rel.history.push({ speaker: npc.name, text: '[Error getting reply. Check Cosmos settings.]', ts: Date.now() });
  }

  window.GameState?.saveState?.();
  input.value = '';
  renderChat();
}
`;
  if (sendRe.test(src)) {
    src = src.replace(sendRe, newFn);
  }

  // Remove stub, if still present
  src = src.replace(/\nfunction\s+generateStubReply\([^)]*\)\s*\{[\s\S]*?\}\s*/g, '\n// (stub removed; using CosmosRP)\n');

  write(file, src);
  console.log('✓ chat/index.js (chat build) patched');
}

function run() {
  const root = process.cwd();
  nst indexHtml = path.join(root, 'index.html');
  nst mainJs = path.join(root, 'src', 'main.js');
  const chatBuilt = path.join(root, 'chat','index.js'); // your chat build

  patchIndexHtml(indexHtml);
  patchMainJs(mainJs);
  patchChatBuilt(chatBuilt);

  console.log('\nAll done. Commit + push to GitHub Pages, then hard refresh.');
}

try { run(); }
catch (e) {
  console.error('Patch failed:', e.message);
  process.exit(1);
}
