// src/ai/boot-demo.js
// Optional helper demonstrating meetings and events for Lily.
// This won't override your existing flow; it exposes window.AI.respondV2 for testing.

import { respondToV2 } from './router.v2.js';
import { createMeeting } from './schedule.js';
import { setEventDefs } from './events.js';

(function(){
  const W = (window.WORLD_STATE = window.WORLD_STATE || {});
  W.locations = W.locations || { home: { name: 'Home' }, coffee_shop: { name: 'Bean Scene' } };
  W.locationPolicies = W.locationPolicies || { coffee_shop: { mode: 'qna', avoidScene: true, maxWords: 80 } };
  W.currentDay = W.currentDay || 4;
  W.timeSegment = W.timeSegment || 'evening';

  // Example Lily NPC object (adjust to match your actual structure)
  const Lily = { id: 'lily', name: 'Lily', relations: { MC: { type: 'sister', strength: 80 } } };

  // Schedule a meeting: Day 4 evening at coffee shop
  createMeeting(Lily, { day: 4, time: 'evening', location: 'coffee_shop', label: 'Coffee chat' });

  // Pre-planned event: Lily gets nicer after coffee if friendship >= 20
  setEventDefs(Lily, [{
    id: 'E_LILY_OPEN_UP',
    once: true,
    when: { afterDay: 4, locationId: 'coffee_shop', minFriendship: 20 },
    effect: { setFlag: { 'lily.isMean': false }, meters: { friendship: 10 }, addGoals: ['Be a little nicer to MC'] }
  }]);

  window.AI = window.AI || {};
  window.AI.respondV2 = async function(npc, text) {
    const world = window.WORLD_STATE || {};
    const meters = Object.assign({ friendship: 15, romance: 0 }, npc?.meters || {});
    return await respondToV2(text, { world, now: new Date().toLocaleString(), npc, meters });
  };
})();
