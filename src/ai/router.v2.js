export const ROUTER_BUILD = 'v2-gender-loc-qa-002';
// router.v2.js (grounded replies w/ gender & location & "who am i")
export async function respondToV2(userText, ctx) {
  try {
    userText = String(userText || '').trim();
    const npc = (ctx && ctx.npc) || { id:'npc', name:'NPC', chat_behavior:{} };
    const world = (ctx && ctx.world) || {};
    const player = (ctx && ctx.player) || { id:'MC', name:'You', gender:'unknown' };
    const historyCount = (ctx && ctx.historyCount) || 0;

    const place = (world.location) || (npc.location) || 'City';

    // Pronouns for the PLAYER (male, female, transgender female)
    const g = String(player.gender||'').toLowerCase();
    const pronouns = (function(g){
      if (g === 'male' || g === 'man' || g === 'm') return {subj:'he', obj:'him', poss:'his'};
      if (g === 'female' || g === 'woman' || g === 'f' || g === 'transgender' || g === 'transgender female' || g === 'trans_female') return {subj:'she', obj:'her', poss:'her'};
      return {subj:'they', obj:'them', poss:'their'};
    })(g);

    const lower = userText.toLowerCase();

    // Intents
    const asksHow = /\b(how are you|how's it going|how are u|how r (you|u))\b/.test(lower);
    const saysHi = /\b(hi|hello|hey|yo|sup)\b/.test(lower);
    const asksWhere = /\b(where(\s+are|\s*r)?\s*(you|u|ya)|where\s+u\s+at|where\s*are\s*you\s*right\s*now|where\s+is\s+this|what\s+(place|location))\b/.test(lower);
    const asksWhoAmI = /\b(who\s+am\s+i|what's\s+my\s+name|who\s+am\s+i\??)\b/.test(lower);

    // One-time pronoun acknowledge on early turns
    const pronounHint = (historyCount <= 1 && (g === 'male' || g === 'female' || g === 'transgender' || g === 'transgender female' || g === 'trans_female'))
      ? `Got it — I'll use ${pronouns.subj}/${pronouns.obj}.`
      : '';

    // Greetings / How are you
    if (saysHi || asksHow) {
      const mood = npc?.chat_behavior?.smallTalkLines?.[0] || null;
      if (asksHow) {
        const base = `I'm alright—here at the ${place}. How about you?`;
        return pronounHint ? `${base} ${pronounHint}` : base;
      }
      const base = mood || `Hey. What's up?`;
      return pronounHint ? `${base} ${pronounHint}` : base;
    }

    // Where are you?
    if (asksWhere) {
      const base = `We're at the ${place}.`;
      return pronounHint ? `${base} ${pronounHint}` : base;
    }

    // Who am I?
    if (asksWhoAmI) {
      const name = player && player.name ? player.name : 'you';
      const base = `You're ${name}.`;
      return pronounHint ? `${base} I keep ${pronouns.subj}/${pronouns.obj} in mind.` : base;
    }

    // Name acknowledgement if user mentions NPC's first name — keep it short
    const first = (npc.name||'NPC').split(' ')[0].toLowerCase();
    if (new RegExp(`\\b${first}\\b`).test(lower)) {
      const base = `It's ${npc.name}. I'm at the ${place}.`;
      return pronounHint ? `${base} ${pronounHint}` : base;
    }

    // Default: short, grounded reply (no persona dumps)
    return pronounHint ? `Noted. ${pronounHint}` : `Okay.`;
  } catch(e) {
    return `[router error: ${String(e)}]`;
  }
}

export default respondToV2;
