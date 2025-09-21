// src/ai/memory.js
const DB_NAME = 'simegame-ai';
const DB_VERSION = 1;
const CHAT_STORE = 'chat';
const META_STORE = 'meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(storeName, mode, fn) {
  var db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let out;
    try { out = fn(store); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

export async function appendChat(characterId, message) {
  const id = String(characterId);
  var db = await openDB();
  return new Promise((resolve, reject) => {
    var tx = db.transaction(CHAT_STORE, 'readwrite');
    var store = tx.objectStore(CHAT_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const now = new Date().toISOString();
      const prev = getReq.result || { id, messages: [] };
      prev.messages.push({ ...message, t: now });
      store.put(prev);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadChat(characterId, limit = 50) {
  var id = String(characterId);
  var db = await openDB();
  return new Promise((resolve) => {
    var tx = db.transaction(CHAT_STORE, 'readonly');
    var store = tx.objectStore(CHAT_STORE);
    var req = store.get(id);
    req.onsuccess = () => {
      const arr = req.result?.messages || [];
      resolve(arr.slice(-limit));
    };
    req.onerror = () => resolve([]);
  });
}

export async function clearChat(characterId) {
  var id = String(characterId);
  return withStore(CHAT_STORE, 'readwrite', (s) => s.delete(id));
}

export async function setMeta(key, value) {
  return withStore(META_STORE, 'readwrite', (s) => s.put({ key, value }));
}

export async function getMeta(key, fallback = null) {
  var db = await openDB();
  return new Promise((resolve) => {
    var tx = db.transaction(META_STORE, 'readonly');
    var store = tx.objectStore(META_STORE);
    var req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? fallback);
    req.onerror = () => resolve(fallback);
  });
}
