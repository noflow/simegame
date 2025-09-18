// router.v2.js (guarded, first-person NPC replies)
export async function respondToV2(userText, ctx) {
  try {
    userText = String(userText || '').trim();
    const npc = (ctx && ctx.npc) || { id:'npc', name:'NPC', greetings:{casual:'Hey.'}, chat_behavior:{} };
    const world = (ctx && ctx.world) || {};
    const player = (ctx && ctx.player) || { id:'MC', name:'You' };

    const name = npc.name || 'NPC';
    const place = (world && (world.location || world.scene || world.place)) || (npc.location || 'here');

    // Basic patterns to keep things grounded
    const lower = userText.toLowerCase();
    const asksHowAreYou = /\b(how are you|how's it going|how are u|how r you)\b/.test(lower);
    const saysHi = /\b(hi|hello|hey|yo|sup)\b/.test(lower);

    // Choose a greeting if there is no history or user greets
    if (saysHi || asksHowAreYou) {
      const mood = (npc.chat_behavior && npc.chat_behavior.smallTalkLines && npc.chat_behavior.smallTalkLines[0]) || null;
      if (asksHowAreYou) {
        return `I'm alright—just at the ${place}. How about you?`;
      }
      if (mood) return mood;
      return `Hey. What's up?`;
    }

    // Soft persona echo based on traits/persona
    const persona = npc.persona || '';
    const traits = Array.isArray(npc.traits) ? npc.traits.slice(0,2).join(', ') : '';
    const hint = [persona, traits].filter(Boolean).join(' — ');

    // Short, direct, first-person reply; avoid inventing new characters.
    let reply = `I hear you. ${hint ? '('+hint+')' : ''}`.trim();
    if (reply.length > 160) reply = reply.slice(0,160);

    // If user mentions the NPC by name, acknowledge personally
    if (new RegExp(`\\b${name.split(' ')[0].toLowerCase()}\\b`).test(lower)) {
      reply = `Hey, it's ${name}. ${hint ? hint : ''}`.trim();
    }

    return reply || `Okay.`;
  } catch (e) {
    return `[router error: ${String(e)}]`;
  }
}

export default respondToV2;
