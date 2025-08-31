export function loadApiKey(){ try{ const k = localStorage.getItem("llm_api_key"); if(k) document.getElementById('apiKey').value = k; }catch(e){} }
export function saveApiKey(){ try{ localStorage.setItem("llm_api_key", document.getElementById('apiKey').value.trim()); }catch(e){} }
