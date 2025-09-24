// src/ai/training.js
export const packs = {
  lily: {
    id: 'lily',
    name: 'Lily Thompson',
    roleDesc: "Psychology student with eclectic style; blunt but tender underneath.",
    tone: ["casual", "bold", "warm"],
    smallTalk: [
      "You look beat—want a snack?",
      "We should hit the city this weekend."
    ],
    busy: [
      "Can this wait? I’ve got a deadline.",
      "Ugh—study crunch. Later?"
    ],
    topics: [
      { key: "school|class|assignment|exam|study|psychology", lines: [
        "Psych is a trip—half my notes are doodles, half are insights. What's your study survival plan?",
        "I'm juggling stats and cognitive theory. If I disappear, I'm probably buried under flashcards."
      ]},
      { key: "music|headphone|song|playlist|band", lines: [
        "If you see my headphones, I owe you one. What's your current repeat song?",
        "I curate playlists like a dragon hoards gold—want a link?"
      ]},
      { key: "city|mall|downtown|hangout", lines: [
        "City Center's got energy. Want coffee then people-watch?",
        "If we hit the mall, I'm steering us away from the 'buy everything' vortex."
      ]},
      { key: "family|sister|parents|home", lines: [
        "We're messy but loyal—comes with the family package.",
        "I talk tough, but I look out for mine. You included."
      ]}
    ]
  },
  ava: {
    id: 'ava',
    name: 'Ava Sinclair',
    roleDesc: "Entrepreneur / lifestyle influencer—polished, ambitious, guarded.",
    tone: ["precise", "confident", "efficient"],
    smallTalk: [
      "You have good timing.",
      "Camera in ten. Can this be concise?"
    ],
    busy: [
      "I’m on a deadline—walk with me.",
      "Make it quick, I’m late for a call."
    ],
    topics: [
      { key: "work|brand|sponsor|campaign|business|startup|pitch", lines: [
        "Brand health is compounding—consistency over stunts. What's your angle?",
        "I make decisions fast and edit faster. Less noise, more signal."
      ]},
      { key: "fashion|style|outfit|wardrobe", lines: [
        "Tailoring beats trends. Two sharp pieces, one statement—that’s the tempo.",
        "I dress for the meeting I want, not the room I'm in."
      ]},
      { key: "city|event|launch|venue", lines: [
        "City Center is convenient, the light is tricky. We'll make it work.",
        "If there's a launch nearby, I'm probably orbiting it."
      ]},
      { key: "privacy|trust|rumor|reputation", lines: [
        "Signal stays tight; I don't trade in rumors.",
        "Trust is currency. Earned slowly, spent carefully."
      ]}
    ]
  }
};

export function getPack(npc){
  if (!npc) return null;
  // If the character JSON contains a 'training' block, normalize and use it
  const t = npc.training;
  const out = t ? {
    id: (npc.id || 'npc'),
    name: (npc.name || 'NPC'),
    roleDesc: t.roleDesc || npc.role || '',
    tone: Array.isArray(t.tone) ? t.tone.slice(0,3) : [],
    smallTalk: Array.isArray(t.smallTalk) ? t.smallTalk.slice(0,6) : (Array.isArray(npc?.chat_behavior?.smallTalkLines) ? [].slice(0,6) : []),
    busy: Array.isArray(t.busy) ? t.busy.slice(0,6) : (Array.isArray(npc?.chat_behavior?.busyLines) ? [].slice(0,6) : []),
    topics: Array.isArray(t.topics) ? t.topics.map(x=>({ key:String(x.key||'').trim(), lines:Array.isArray(x.lines)?x.lines.slice(0,8):[] })) : []
  } : null;

  if (out && (out.smallTalk.length || out.busy.length || out.topics.length || out.roleDesc)) {
    return out;
  }

  // Fallback to built-in packs by id/name
  const id = (npc.id || '').toLowerCase();
  const name = (npc.name || '').toLowerCase();
  return packs[id] || (name.includes('lily') ? packs.lily : name.includes('ava') ? packs.ava : null);
}

export function matchTopic(pack, userText){
  if (!pack) return null;
  const lower = (userText||'').toLowerCase();
  let best = null, bestScore = 0;
  for (const t of pack.topics || []){
    const keys = (t.key || '').split('|').map(k=>k.trim()).filter(Boolean);
    let score = 0;
    for (const k of keys){
      if (lower.includes(k)) score += Math.max(1, k.length/6);
    }
    if (score > bestScore){ bestScore = score; best = t; }
  }
  return best;
}

export function sample(arr){
  return arr && arr.length ? arr[Math.floor(Math.random()*arr.length)] : null;
}
