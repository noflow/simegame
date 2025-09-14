// src/ai/knowledge.js
export function buildKnowledge(npc, world, meters={}, flags={}) {
  const facts = [];
  const goals = [];

  if (npc?.name) facts.push(`Your name is ${npc.name}.`);
  if (npc?.role) facts.push(`Role: ${npc.role}.`);
  if (npc?.relations) {
    const relBits = [];
    for (const [name, rel] of Object.entries(npc.relations)) {
      const type = rel.type?.toLowerCase?.() || 'relation';
      const strength = typeof rel.strength === 'number' ? ` (strength ${rel.strength})` : '';
      relBits.push(`${name}: ${type}${strength}`);
    }
    if (relBits.length) facts.push(`Relationships: ${relBits.join('; ')}.`);
  }

  const day = world?.currentDay != null ? world.currentDay : 'Unknown';
  const seg = world?.timeSegment || 'Unknown';
  facts.push(`World time: Day ${day}, ${seg}.`);

  const m = [];
  for (const [k, v] of Object.entries(meters)) if (typeof v === 'number') m.push(`${k}=${v}`);
  if (m.length) facts.push(`Meters: ${m.join(', ')}.`);

  if (flags) {
    const keys = Object.keys(flags).filter(k => typeof flags[k] !== 'object');
    if (keys.length) facts.push(`Flags: ${keys.slice(0,8).map(k => `${k}=${String(flags[k])}`).join(', ')}.`);
  }

  if (Array.isArray(npc?.goals)) npc.goals.forEach(g => goals.push(String(g)));

  const currLocId = world?.resolvedLocationId;
  const locationPolicy = (world?.locationPolicies && currLocId)
    ? (world.locationPolicies[currLocId] || {})
    : {};

  return { facts, locationPolicy, goals };
}
