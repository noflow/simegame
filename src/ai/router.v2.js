export const ROUTER_BUILD = 'v2.4-expressive-intents-loc';

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function pronounPack(gender){
  const g = String(gender||'').toLowerCase();
  if (g==='male' || g==='man' || g==='m') return {subj:'he', obj:'him', poss:'his', pair:'he/him'};
  if (g==='female' || g==='woman' || g==='f' || g==='transgender' || g==='transgender female' || g==='trans_female') return {subj:'she', obj:'her', poss:'her', pair:'she/her'};
  return {subj:'they', obj:'them', poss:'their', pair:'they/them'};
}

export async function respondToV2(userText, ctx) {
  try {
    userText = String(userText || '').trim();
    const npc = (ctx && ctx.npc) || { id:'npc', name:'NPC', role:'friend', chat_behavior:{} };
    const world = (ctx && ctx.world) || {};
    const player = (ctx && ctx.player) || { id:'MC', name:'You', gender:'unknown' };
    const historyCount = (ctx && ctx.historyCount) || 0;
    const style = (ctx && ctx.aiStyle) || 'expressive';

    // IMPORTANT: Use current world location only (not npc.home)
    const place = (world && world.location) ? String(world.location) : 'City';
    const pr = pronounPack(player.gender);
    const lower = userText.toLowerCase();

    // Intents
    const reHi = /\b(hi|hello|hey|yo|sup)\b/;
    const reHow = /\b(how are you|how's it going|how are u|how r (you|u))\b/;
    const reWhere = /\b(where(\s+are|\s*r)?\s*(you|u|ya)|where\s+(are\s+)?you\s+at|where\s+u\s+at|where\s*are\s*you\s*right\s*now|where\s+is\s+this|what\s+(place|location))\b/;
    const reWhoAmI = /\b(who\s+am\s+i|do\s+you\s+know\s+who\s+i\s+am|do\s+you\s+know\s+my\s+name|what('?| i)?s\s+my\s+name|what\s+is\s+my\s+name)\b/;
    const reWhatDoYouDo = /\b(what\s+do\s+you\s+do|your\s+job|what\s+is\s+your\s+work|what\s+is\s+your\s+role)\b/;
    const reName = new RegExp("\\b"+(npc.name||'NPC').split(' ')[0].toLowerCase()+"\\b");

    const pronounHint = (historyCount <= 1 && pr.pair !== 'they/them')
      ? `Got it — I'll use ${pr.pair}.`
      : '';

    function respond(lines){
      if (style === 'concise') return lines.short;
      return lines.long || lines.short;
    }

    // Greetings / How are you
    if (reHi.test(lower) || reHow.test(lower)) {
      if (reHow.test(lower)) {
        const base = respond({
          short: `I'm alright—here at the ${place}. You?`,
          long: `I'm alright—here at the ${place}. How about you?`
        });
        return pronounHint ? `${base} ${pronounHint}` : base;
      }
      const mood = npc?.chat_behavior?.smallTalkLines?.[0];
      const base = respond({
        short: mood || `Hey.`,
        long: mood || `Hey. What's up?`
      });
      return pronounHint ? `${base} ${pronounHint}` : base;
    }

    // Where are you?
    if (reWhere.test(lower)) {
      const base = respond({
        short: `We're at the ${place}.`,
        long: `We're at the ${place}.`
      });
      return pronounHint ? `${base} ${pronounHint}` : base;
    }

    // Who am I?
    if (reWhoAmI.test(lower)) {
      const nm = (player && player.name && player.name !== 'You') ? player.name : null;
      const base = nm ? `You're ${nm}.` : `You're you. If you want me to use a different name, tell me what to call you.`;
      return pronounHint ? `${base} I keep ${pr.subj}/${pr.obj} in mind.` : base;
    }

    // What do you do?
    if (reWhatDoYouDo.test(lower)) {
      const role = npc.role || 'friend';
      const short = `I'm ${/^(a|an)\\b/i.test(role) ? '' : 'a '}${role}.`.replace(/\\s+/g,' ').trim();
      let long = short;
      const persona = npc.persona || '';
      if (style !== 'concise' && persona) {
        const first = persona.split(';')[0].trim();
        long = `${short} ${first ? first : ''}`.trim();
      }
      return respond({ short, long });
    }

    // If player mentions NPC name
    if (reName.test(lower)) {
      const base = respond({
        short: `It's ${npc.name}.`,
        long: `It's ${npc.name}. I'm at the ${place}.`
      });
      return pronounHint ? `${base} ${pronounHint}` : base;
    }

    // Default
    const hook = pick([`What do you need?`,`Shoot.`,`Walk with me?`,`Tell me what's up.`]);
    const short = hook;
    const long = hook;
    return respond({ short, long });

  } catch(e) {
    return `[router error: ${String(e)}]`;
  }
}

export default respondToV2;
