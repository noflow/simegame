// src/ai/events.js
import { getMeta, setMeta } from './memory.js';

export async function evaluateEvents(npc, world, meters={}, flags={}) {
  const storeKey = `events:${npc.id || npc.name}`;
  const defKey = `events_def:${npc.id || npc.name}`;

  const defs = await getMeta(defKey, []) || [];
  if (!defs.length) return { applied: [], flags, meters, addedGoals: [] };

  const appliedKey = `${storeKey}:applied`;
  const appliedSet = new Set(await getMeta(appliedKey, []) || []);

  const hits = [];
  const addedGoals = [];
  for (const ev of defs) {
    if (ev.once && appliedSet.has(ev.id)) continue;
    if (matches(ev.when, world, meters, flags)) {
      applyEffects(ev.effect, meters, flags, addedGoals);
      hits.push(ev.id);
      if (ev.once) appliedSet.add(ev.id);
    }
  }

  if (hits.length) {
    await setMeta(appliedKey, Array.from(appliedSet));
    await setMeta(`flags:${npc.id || npc.name}`, flags);
    await setMeta(`meters:${npc.id || npc.name}`, meters);
  }
  return { applied: hits, flags, meters, addedGoals };
}

function arr(x) { return Array.isArray(x) ? x : (x ? [x] : []); }

function matches(when={}, world, meters, flags) {
  if (when.afterDay != null && !(world.currentDay >= when.afterDay)) return false;
  if (when.dayEquals != null && !(world.currentDay === when.dayEquals)) return false;
  if (when.time && when.time !== 'any' && world.timeSegment !== when.time) return false;
  if (when.locationId && world.resolvedLocationId !== when.locationId) return false;
  if (when.minFriendship != null && !(Number(meters.friendship || 0) >= when.minFriendship)) return false;
  if (when.minRomance != null && !(Number(meters.romance || 0) >= when.minRomance)) return false;
  for (const k of arr(when.flagTrue)) if (!flags[k]) return false;
  for (const k of arr(when.flagFalse)) if (flags[k]) return false;
  return true;
}

function applyEffects(effect={}, meters, flags, addedGoals) {
  if (effect.setFlag) for (const [k, v] of Object.entries(effect.setFlag)) flags[k] = v;
  if (effect.meters) for (const [k, d] of Object.entries(effect.meters)) meters[k] = Number(meters[k] || 0) + Number(d || 0);
  if (Array.isArray(effect.addGoals)) for (const g of effect.addGoals) addedGoals.push(String(g));
}

export async function setEventDefs(npc, defs) {
  const defKey = `events_def:${npc.id || npc.name}`;
  await setMeta(defKey, defs);
}

export async function getFlags(npc) { return await getMeta(`flags:${npc.id || npc.name}`, {}); }
export async function setFlags(npc, flags) { return await setMeta(`flags:${npc.id || npc.name}`, flags); }
export async function getMeters(npc) { return await getMeta(`meters:${npc.id || npc.name}`, {}); }
export async function setMeters(npc, meters) { return await setMeta(`meters:${npc.id || npc.name}`, meters); }
