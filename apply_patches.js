
const fs = require('fs');
const path = require('path');

function backup(p){
  try {
    const bak = p + '.bak';
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, fs.readFileSync(p, 'utf8'), 'utf8');
  } catch(e){}
}

function patchMainJS(file){
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1) Remove duplicate CHARS_KEY in chub.ai helpers section (only if present)
  src = src.replace(
    /\/\/\s*===== chub\.ai import \+ schedule merge helpers =====\s*const CHARS_KEY\s*=\s*[^;]+;/,
    '// ===== chub.ai import + schedule merge helpers ====='
  );

  // 2) Replace the whole bridgeCosmosKey IIFE with a clean one
  const bridgeClean = `// --- Bridge: keep #apiKey (llm_api_key) and Cosmos (cosmos.apiKey) in sync ---
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

  const bridgeRegex = /\(function bridgeCosmosKey\)\([\s\S]*?\}\)\(\);/m;
  if (bridgeRegex.test(src)){
    src = src.replace(bridgeRegex, bridgeClean);
    changed = true;
  }

  // 3) Ensure chub/import and exportChars listeners exist outside the IIFE
  if (!/document\.getElementById\('chubFile'\)\?\.addEventListener\('change'/.test(src)){
    const injectPoint = src.indexOf('// header buttons');
    if (injectPoint !== -1){
      const listeners = `

// chub.ai importer and export chars
document.getElementById('chubFile')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const text = await new Promise((res, rej) => {
      const fr = new FileReader(); fr.onerror = () => rej(fr.error || new Error('Read failed')); fr.onload = () => res(String(fr.result || '')); fr.readAsText(f, 'utf-8');
    });
    const json = JSON.parse(text);
    let npc = chubToNpc(json);
    await ensureSchedule(npc);

    const charsObj = getCharactersObj();
    const list = Array.isArray(charsObj.characters) ? charsObj.characters : (charsObj.characters = []);
    npc.id = uniquifyId(npc.id, list);
    const i = list.findIndex(c => c.id === npc.id);
    if (i >= 0) list[i] = npc; else list.push(npc);

    saveCharactersObj(charsObj);
    alert(\`Imported "\${npc.name}" and added to characters.json\`);
  } catch (err) {
    console.error(err);
    alert('Invalid chub.ai JSON: ' + (err?.message || err));
  } finally {
    e.target.value = '';
  }
});

document.getElementById('exportChars')?.addEventListener('click', () => {
  const obj = getCharactersObj();
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'characters.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
});
`;
      src = src.slice(0, injectPoint) + '// header buttons' + listeners + src.slice(injectPoint + '// header buttons'.length);
      changed = true;
    }
  }

  if (changed){
    backup(file);
    fs.writeFileSync(file, src, 'utf8');
    console.log('✔ Patched', file);
  } else {
    console.log('• No changes needed for', file);
  }
}

function patchCharacterBuilder(file){
  if (!fs.existsSync(file)) return;
  var src = fs.readFileSync(file, 'utf8');
  var changed = false;

  // 1) Remove dead fallback block after generateCharacterFromPrompt
  const deadBlock = /\n\s*if\s*\(!window\.GameAI[\s\S]*?export function addCharacterToGame/;
  if (deadBlock.test(src)){
    src = src.replace(deadBlock, "\n\nexport function addCharacterToGame");
    changed = true;
  }

  // 2) Fix empty regex guards
  const rep1 = src.replace(/const sexualRx = \/\\b\(\)\\b\/i;/, "const sexualRx = /\\b(?:sex|sexual|explicit|nsfw|porn|fetish|kink|erotic)\\b/i;");
  if (rep1 !== src){ src = rep1; changed = true; }
  const rep2 = src.replace(/const familyRx\s+= \/\\b\(\)\\b\/i;/, "const familyRx  = /\\b(?:mom|mother|sister|brother|dad|father|stepmom|stepsister)\\b/i;");
  if (rep2 !== src){ src = rep2; changed = true; }

  if (changed){
    backup(file);
    fs.writeFileSync(file, src, 'utf8');
    console.log('✔ Patched', file);
  } else {
    console.log('• No changes needed for', file);
  }
}

function patchWorldJSON(file){
  if (!fs.existsSync(file)) return;
  let raw = fs.readFileSync(file, 'utf8');
  try{
    const data = JSON.parse(raw);
    if (data && typeof data === 'object'){
      if (!data.passages || typeof data.passages !== 'object'){
        // wrap whole object
        const wrapped = { passages: data };
        backup(file);
        fs.writeFileSync(file, JSON.stringify(wrapped, null, 2), 'utf8');
        console.log('✔ Wrapped root in passages for', file);
        return;
      }
      let moved = false;
      for (const k of Object.keys(data)){
        if (k === 'passages') continue;
        if (typeof data[k] === 'string' || typeof data[k] === 'object'){
          if (!(k in data.passages)) data.passages[k] = data[k];
          delete data[k];
          moved = true;
        }
      }
      if (moved){
        backup(file);
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
        console.log('✔ Moved top-level keys under passages for', file);
      } else {
        console.log('• WORLD.json already structured correctly.');
      }
    }
  }catch(e){
    console.warn('Skipping WORLD.json (invalid JSON?)', e.message);
  }
}

(function main(){
  const root = process.cwd();
  const files = {
    main: path.join(root, 'src', 'main.js'),
    charBuilder: path.join(root, 'src', 'builder', 'character_builder.js'),
    world: path.join(root, 'WORLD.json'),
  };

  patchMainJS(files.main);
  patchCharacterBuilder(files.charBuilder);
  patchWorldJSON(files.world);

  console.log('Done.');
})();
