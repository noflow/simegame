export const ROUTER_BUILD = 'v2.2-expressive-intents';

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function cleanPlace(place){
  if (!place) return 'City';
  const m = String(place).trim();
  const map = {
    'city center':'City Center',
    'sisters room':"Sister's Room",
    "sister's room":"Sister's Room",
    'apt':'Apartments',
    'apartment':'Apartments',
    'apartments':'Apartments'
  };
  const key = m.toLowerCase();
  return map[key] || m;
}

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

    const place = cleanPlace(world.location || npc.location || 'City');
    const pr = pronounPack(player.gender);

    const lower = userText.toLowerCase();

    // Intents
    const reHi = /\b(hi|hello|hey|yo|sup)\b/;
    const reHow = /\b(how are you|how's it going|how are u|how r (you|u))\b/;
    const reWhere = /\b(where(\s+are|\s*r)?\s*(you|u|ya)|where\s+u\s+at|where\s*are\s*you\s*right\s*now|where\s+is\s+this|what\s+(place|location))\b/;
    const reWhoAmI = /\b(who\s+am\s+i|what('?| i)?s\s+my\s+name)\b/;
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
      const nm = (player && player.name && player.name !== 'You') ? player.name : 'you';
      const base = respond({
        short: `You're ${nm}.`,
        long: `You're ${nm}.` + (nm==='you' ? ` If you want me to call you something else, tell me your name.` : '')
      });
      return pronounHint ? `${base} I keep ${pr.subj}/${pr.obj} in mind.` : base;
    }

    // What do you do?
    if (reWhatDoYouDo.test(lower)) {
      const role = npc.role || 'friend';
      const short = `I'm ${/^(a|an)\b/i.test(role) ? '' : 'a '}${role}.`.replace(/\s+/g,' ').trim();
      let long = short;
      const persona = npc.persona || '';
      if (style !== 'concise' && persona) {
        const first = persona.split(';')[0].trim();
        long = `${short} ${pick([
          `It fits me—${first.toLowerCase()}.`,
          `Day to day? ${first}.`,
          `Keeps me busy—${first.toLowerCase()}.`
        ])}`;
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

    // Default: engaging but short
    const persona = npc.persona || '';
    const hook = pick([
      `What do you need?`,
      `Shoot.`,
      `Walk with me?`,
      `Tell me what's up.`
    ]);
    const short = hook;
    const long = [persona ? `I hear you — ${persona.toLowerCase()}.` : `I hear you.`, hook].join(' ');
    return respond({ short, long });

  } catch(e) {
    return `[router error: ${String(e)}]`;
  }
}

export default respondToV2;
