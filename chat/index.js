// chat/index.js
// Minimal stub so the rest of the game can run without errors.
// You can replace these later with your real chat UI logic.

export function renderChat() {
  console.log("🗨️ renderChat() called (stub)");
}

export function closeChatModal() {
  console.log("❌ closeChatModal() called (stub)");
}

export function startChat(npc) {
  console.log("👤 Starting chat with:", npc);
  alert(`(Stub) You started a chat with ${npc.name}`);
  try {
    // Ensure relationships exist
    const st = window.GameState.state;
    st.relationships = st.relationships || {};
    st.relationships[npc.id] = st.relationships[npc.id] || {
      introduced: true,
      history: [],
      discoveredTraits: []
    };
    st.relationships[npc.id].introduced = true;
    window.GameState.saveState();
  } catch (e) {
    console.error("Failed to update relationships in stub:", e);
  }
}

export function getRelationship(npcId) {
  const st = window.GameState?.state || {};
  const rels = st.relationships || {};
  // Always return a safe object
  return rels[npcId] || { introduced: false, history: [], discoveredTraits: [] };
}
