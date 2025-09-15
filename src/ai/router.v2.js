// src/ai/router.v2.js
import { Policy } from './policy.js';
import { appendChat, loadChat } from './memory.js';
import { llmChat, mockChat, isConfigured } from './adapter.js';

import { resolveLocation } from './schedule.js';
import { buildKnowledge } from './knowledge.js';
import { evaluateEvents, getFlags, getMeters, setMeters } from './events.js';

function playerLine(npc, player){
  const pid = player?.id || 'MC';
  const pname = player?.name || pid;
  let relTxt='';
  try{
    const rel = npc?.relations && npc.relations[pid];
    if (rel && rel.type) relTxt = ` Relationship to user: ${rel.type}.`;
  }catch(e){}
  return `You are speaking to the human player "${pname}" (id "${pid}"). Treat the user as that person in your relationships.${relTxt}`;
}


function styleFromLocationPolicy(policy) {
  let extra = '';
  if (policy?.mode === 'qna') extra += ' Keep replies concise and Q&A focused. Avoid describing the environment unless asked.';
  if (policy?.avoidScene === true) extra += ' Do not include scenic descriptions.';
  if (typeof policy?.maxWords === 'number') extra += ` Keep responses under ${policy.maxWords} words unless clarification is needed.`;
  return extra;
}

function personaFromMeters(meters) {
  const lines = [];
  if ((meters.friendship ?? 0) >= (Policy.loosenThresholds.friendship || 30)) lines.push('Tone: friendly and open.');
  if ((meters.romance ?? 0) >= (Policy.loosenThresholds.romance || 50)) lines.push('Tone: warm, with subtle intimacy (keep PG unless prompted otherwise).');
  return lines.join(' ');
}

function buildSystemPrompt({ npc, world, knowledge, personaNotes, player }) {
  const tone = Policy.stylePrompt(Policy.verbosity);
  const locText = world?.resolvedLocationName ? `You are currently at ${world.resolvedLocationName}.` : 'Your current location is unknown.';
  return [`You are the NPC "${npc?.name ?? 'Unknown'}" in a life-sim game.`,
    (player ? playerLine(npc, player) : ''),
    locText,
    `Honor schedules unless a dated meeting overrides them; after the meeting, resume normal schedule.`,
    `Facts:\n- ${knowledge.facts.join('\n- ')}`,
    knowledge.goals.length ? `Goals:\n- ${knowledge.goals.join('\n- ')}` : '',
    `Style: ${tone}${styleFromLocationPolicy(knowledge.locationPolicy)}`,
    personaNotes ? `Persona: ${personaNotes}` : ''
  ].filter(Boolean).join('\n');
}

export async function respondToV2(userText, ctx) {
  const npc = ctx?.npc || {};
  const npcId = npc?.id ?? npc?.name ?? 'npc';

  const loc = await resolveLocation(npc, ctx.world);
  if (loc) {
    ctx.world.resolvedLocationId = loc.id;
    ctx.world.resolvedLocationName = loc.name;
  }

  const curFlags = await getFlags(npc);
  const curMeters = Object.assign({}, { friendship: 0, romance: 0 }, await getMeters(npc), ctx.meters || {});

  const evRes = await evaluateEvents(npc, ctx.world, curMeters, curFlags);
  await setMeters(npc, evRes.meters);

  const knowledge = buildKnowledge(npc, ctx.world, evRes.meters, evRes.flags);
  const personaNotes = personaFromMeters(evRes.meters);

  const sys = buildSystemPrompt({ npc, world: ctx.world, knowledge, personaNotes, player: ctx.player });
  const history = await loadChat(npcId, Policy.maxHistory);
  const msgs = [
    { role: 'system', content: sys },
    ...history.slice(-Policy.maxHistory + 2).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText }
  ];

  const reply = isConfigured() ? await llmChat(msgs) : await mockChat(msgs);

  await appendChat(npcId, { role: 'user', content: userText });
  await appendChat(npcId, { role: 'assistant', content: reply });

  return reply;
}
