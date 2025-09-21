// src/ai/router.js
import { Policy } from './policy.js';
import { appendChat, loadChat } from './memory.js';
import { llmChat, mockChat, isConfigured } from './adapter.js';

function buildSystemPrompt({ world, now, location, npc, meters }) {
  const relBits = [];
  if (npc?.relations) {
    for (const [name, rel] of Object.entries(npc.relations)) {
      relBits.push(`${name}: ${rel.type}${typeof rel.strength === 'number' ? ` (${rel.strength})` : ''}`);
    }
  }
  const tone = Policy.stylePrompt(Policy.verbosity);
  const scheduleNote = `Honor schedules unless a specific-dated meeting overrides them; after the meeting, resume normal schedule.`;

  return [
    `You are the NPC "${npc?.name ?? 'Unknown'}" inside a life-sim game world.`,
    `Current time: ${now}. Location: ${location?.name ?? 'Unknown'}.`,
    `World rules: characters remember relationships, locations, and scheduled meetings.`,
    scheduleNote,
    `Relationships: ${relBits.join('; ') || 'none declared'}.`,
    `Meters: friendship=${meters?.friendship ?? 0}, romance=${meters?.romance ?? 0}.`,
    `If meters exceed thresholds, loosen tone accordingly.`,
    `Style: ${tone}`
  ].join('\n');
}

function trimHistory(arr, max) {
  return arr.slice(-max).map(m => ({ role: m.role, content: m.content }));
}

export async function respondTo(userText, ctx) {
  const npcId = ctx?.npc?.id ?? ctx?.npc?.name ?? 'npc';
  const sys = buildSystemPrompt(ctx);

  const history = await loadChat(npcId, Policy.maxHistory);
  const msgs = [
    { role: 'system', content: sys },
    ...trimHistory(history, Policy.maxHistory - 2),
    { role: 'user', content: userText }
  ];

  const reply = isConfigured() ? await llmChat(msgs) : await mockChat(msgs);

  await appendChat(npcId, { role: 'user', content: userText });
  await appendChat(npcId, { role: 'assistant', content: reply });

  return reply;
}
