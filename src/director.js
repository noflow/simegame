// src/director.js
import { state, saveState } from './state.js';
import { TIME_SLOTS } from './constants.js';
import { CHARACTERS } from './data.js';
import * as GameLogic from './presence.js';

function ensure() {
  state.appointments = state.appointments || [];   // [{npcId, day, slot, location, reason?, oneTime?, id}]
  state.flags = state.flags || {};                 // story flags / event switches
  state.affinity = state.affinity || {};           // { [npcId]: { friendship, romance } }
}

export function scheduleMeet(npcId, { day, slot, location, reason = 'user-request', oneTime = true }) {
  ensure();
  const appt = { npcId, day, slot, location, reason, oneTime, id: `${npcId}|${day}|${slot}|${location}|${Date.now()}` };
  state.appointments.push(appt);
  saveState();
  return appt;
}

export function appointmentFor(npc) {
  ensure();
  const slot = TIME_SLOTS[state.timeIndex];
  return (state.appointments || []).find(a => a.npcId === npc.id && a.day === state.day && a.slot === slot) || null;
}

function consumeAppointmentsAtCurrentMoment() {
  ensure();
  const slot = TIME_SLOTS[state.timeIndex];
  const here = state.location;
  const keep = [];
  for (const a of state.appointments) {
    const consumeNow = a.oneTime && a.day === state.day && a.slot === slot && a.location === here;
    if (consumeNow) {
      // Example: story beat hooks
      if (a.reason === 'arc:lily_soften' && !state.flags.lily_softened) {
        state.flags.lily_softened = true;
      }
    } else {
      keep.push(a);
    }
  }
  if (keep.length !== state.appointments.length) {
    state.appointments = keep;
    saveState();
  }
}

export function recordAffinity(npcId, dFriend = 0, dRom = 0) {
  ensure();
  const a = state.affinity[npcId] = state.affinity[npcId] || { friendship: 0, romance: 0 };
  a.friendship = Math.max(0, Math.min(100, a.friendship + dFriend));
  a.romance   = Math.max(0, Math.min(100, a.romance   + dRom));
  saveState();
  return a;
}

export function getAffinity(npcId) {
  ensure();
  return state.affinity[npcId] || { friendship: 0, romance: 0 };
}

// Called when time advances
export function tick() {
  ensure();
  // Future: time-based preplanned events can promote flags here
}

// Called after moving between locations
export function onLocationEntered() {
  consumeAppointmentsAtCurrentMoment();
}
