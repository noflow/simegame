import { TIME_SLOTS, DAYS } from './constants.js';
import { state } from './state.js';
import { CHARACTERS } from './data.js';

export function defaultScheduleFor(id){
  if(id === 'maya'){
    return [{ days:[1,2,3,4,5], slots:["morning","lunch","afternoon"], location:"Coffee Shop" }];
  }
  return [];
}
function __readAppointments(){
  try {
    const raw = localStorage.getItem('appointments_v1');
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch(e){ return []; }
}
export function npcHere(npc){
  const loc = state.location;
  const day = state.day; const slot = TIME_SLOTS[state.timeIndex];
  const schedule = (npc.schedule && npc.schedule.length) ? npc.schedule : defaultScheduleFor(npc.id);
  // Appointments override: if a meeting exists for this npc at current day/slot, treat them as at that location.
  const appts = __readAppointments().filter(a => a.npcId === npc.id && a.day === day && a.slot === slot);
  if (appts.length) {
    // If appointment location matches current location, they're here.
    return appts.some(a => a.location === loc);
  }
  return schedule.some(rule => rule.location===loc && rule.days.includes(day) && rule.slots.includes(slot));
}
export function isOnDuty(npc){
  const day = state.day; const slot = TIME_SLOTS[state.timeIndex];
  const scheduledHere = (npc.schedule||[]).some(rule => rule.location===state.location && rule.days.includes(day) && rule.slots.includes(slot));
  return scheduledHere && state.location === npc.location;
}
export function contextualGreeting(npc){
  if (isOnDuty(npc)) return (npc.greetings && npc.greetings.work) || "Welcome in! What can I get started for you?";
  if ((npc.greetings && npc.greetings.home) && /apartment|home|house/i.test(state.location)) return npc.greetings.home;
  return (npc.greetings && npc.greetings.casual) || "Hey there.";
}
export function updatePresence(){
  if(!CHARACTERS || !CHARACTERS.characters) return;
  const here = CHARACTERS.characters.filter(npc=> npcHere(npc));
  const holder = document.getElementById('hereNPCs');
  const status = document.getElementById('presence');
  if (!holder || !status) return;
  holder.innerHTML = '';
  if(here.length===0){ status.textContent='No one you know is around at this time.'; return; }
  status.textContent = 'Available to chat:';
  here.forEach(npc=>{
    const div = document.createElement('div');
    div.className = 'npc';
    div.innerHTML = `<img src="${npc.avatar}" alt="${npc.name}"/><div style="flex:1"><div class="name">${npc.name}</div><div class="where small">${state.location}</div></div><button class="btn-primary">Chat</button>`;
    div.querySelector('button').addEventListener('click', ()=> window.GameUI.startChat(npc));
    holder.appendChild(div);
  });
}
