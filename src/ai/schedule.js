// src/ai/schedule.js
import { getMeta, setMeta } from './memory.js';

function parseDayExpr(expr, currentDay) {
  if (!expr || expr === 'any') return true;
  if (typeof expr === 'number') return currentDay === expr;
  if (typeof expr === 'string') {
    const parts = expr.split(',').map(s => s.trim());
    for (const p of parts) {
      if (p.includes('-')) {
        const [a, b] = p.split('-').map(n => parseInt(n.trim(), 10));
        if (currentDay >= a && currentDay <= b) return true;
      } else {
        const n = parseInt(p, 10);
        if (currentDay === n) return true;
      }
    }
  }
  return false;
}

function matchScheduleRule(rule, day, seg) {
  const dayOk = parseDayExpr(rule.day ?? 'any', day);
  const segOk = (rule.time ?? 'any') === 'any' || rule.time === seg;
  return dayOk && segOk;
}

export async function resolveLocation(npc, world) {
  const day = world?.currentDay;
  const seg = world?.timeSegment;

  const meetings = await getMeetings(npc);
  if (Array.isArray(meetings)) {
    const hit = meetings.find(m => m.day === day && (m.time === seg || m.time === 'any'));
    if (hit) {
      return {
        id: String(hit.location),
        name: world?.locations?.[hit.location]?.name || String(hit.location)
      };
    }
  }

  if (Array.isArray(npc?.schedule)) {
    const rule = npc.schedule.find(r => matchScheduleRule(r, day, seg));
    if (rule) {
      return {
        id: String(rule.location),
        name: world?.locations?.[rule.location]?.name || String(rule.location)
      };
    }
  }
  return null;
}

export async function createMeeting(npc, meeting) {
  const key = `meetings:${npc.id || npc.name}`;
  const list = (await getMeta(key, [])) || [];
  list.push(meeting);
  await setMeta(key, list);
  return list;
}

export async function getMeetings(npc) {
  const key = `meetings:${npc.id || npc.name}`;
  return await getMeta(key, []);
}

export async function clearMeetings(npc) {
  const key = `meetings:${npc.id || npc.name}`;
  await setMeta(key, []);
}
