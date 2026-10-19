// Explicit fatal clauses only. Narrative time units and inactive-round
// requirements are recognized for display but remain GM-managed in combat.
const number='(?:\\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|twelve)';
const target='\\b(?:foe|he|enemy|opponent)\\b[^.!?;]{0,130}?';
const time='('+number+')\\s+(?:(inactive|painful|sad)\\s+)?(rounds?|rnds?|hours?|days?)';
const patterns=[
  {re:new RegExp(target+'\\b(?:dies?|(?:is\\s+)?dead)\\s+(?:instantly|immediately)\\b','i'),rounds:0},
  {re:new RegExp(target+'\\b(?:dies?|expires?)\\s+(?:(?:of|from)\\s+[^.!?;]{1,70}?\\s+)?(?:in|after)\\s+'+time,'i'),timed:true},
  {re:new RegExp(target+'\\b(?:dies?|expires?)\\s+'+time+'\\s+later','i'),timed:true},
  {re:new RegExp('\\b(?:killing|kills?)\\s+(?:him|foe|enemy|opponent)\\s+(?:in|after)\\s+'+time,'i'),timed:true},
  {re:new RegExp(target+'\\b(?:for|in)\\s+'+time+'[^.!?;]{0,45}?\\b(?:then\\s+(?:drops\\s+and\\s+)?(?:he\\s+)?dies?|before\\s+he\\s+dies?|and\\s+dies?)\\b','i'),timed:true},
  {re:new RegExp('\\bFalls again and dies\\s+in\\s+'+time,'i'),timed:true},
  {re:new RegExp(target+'\\bdies?\\s+(?:next round|a round later)\\b','i'),rounds:1},
  {re:new RegExp(target+'\\b(?:dies?|expires?)\\b(?!\\s+(?:(?:of|from)\\s+[^.!?;]{1,70}?\\s+)?(?:(?:in|after)\\s+'+number+'|'+number+'\\s+(?:inactive\\s+)?(?:round|rnd|hour|day)))','i'),rounds:0},
  {re:new RegExp(target+'\\b(?:(?:is|falls)\\s+(?:quite\\s+)?)dead\\b','i'),rounds:0},
  {re:/\b(?:killing|kills?)\s+(?:him|foe|enemy|opponent)\s+(?:instantly|immediately)\b/i,rounds:0},
  {re:new RegExp('\\bkills?\\s+(?:him|foe|enemy|opponent)\\b(?!\\s+(?:in|after)\\s+'+number+')','i'),rounds:0},
  {re:new RegExp(target+'\\bexpires?\\s+in a heap[^.!?;]{0,15}?immediately','i'),rounds:0},
];
export function criticalDeath(text) {
  const input=String(text||'');
  const candidates=patterns.map(pattern=>{
    const m=pattern.re.exec(input);if(!m)return null;
    const amount=pattern.timed?(Number(m[1])||({a:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twelve:12})[m[1].toLowerCase()]):pattern.rounds;
    const inactive=pattern.timed&&(m[2]?.toLowerCase()==='inactive'||/^\s+of inactivity\b/i.test(input.slice(m.index+m[0].length)));
    const unit=pattern.timed?m[3].toLowerCase():'rounds';
    return {raw:m[0],index:m.index,rounds:amount,...(inactive?{inactive:true}:{}),...(!/^r(?:ound|nd)/.test(unit)?{unit,manual:true}:{}),priority:pattern.timed?0:1};
  }).filter(Boolean).sort((a,b)=>a.index-b.index||a.priority-b.priority);
  const match=candidates[0];if(!match)return null;
  const sentence=input.slice(0,match.index).split(/[.!?;]/).at(-1)+' '+match.raw+input.slice(match.index+match.raw.length).split(/[.!?;]/)[0];
  match.conditional=/\b(?:if|unless|otherwise|without|w\/o)\b/i.test(sentence);
  delete match.priority;return match;
}
export function criticalDeathLabel(death) {
  if(death.rounds===0)return 'Dies: instantly';
  if(death.manual)return 'Dies: after '+death.rounds+' '+death.unit+' (GM-managed)';
  return 'Dies: in '+death.rounds+(death.inactive?' inactive':'')+' round'+(death.rounds===1?'':'s')+' unless healed'+(death.inactive?' (GM-managed)':'');
}
export function cancelCriticalDeathOnHealing(target,oldDamage) {
  if(!target.deathRequiresRepair&&target.deathRound!==undefined&&target.hits<oldDamage){delete target.deathRound;delete target.deathDamage;return true;}
  return false;
}
function kill(target,maxHits) {
  target.hits=Math.max(target.hits||0,maxHits);target.dead=true;
  target.statuses=[...new Set([...(target.statuses||[]),'Dead'])];
  delete target.deathRound;delete target.deathDamage;
}
export function applyCriticalDeath(target,maxHits,round,count) {
  if(target.dead)return;
  if(count===0){kill(target,maxHits);return;}
  if(!Number.isFinite(count)||count<1)return;
  target.deathRound=Math.min(target.deathRound??Infinity,round+count);
  target.deathDamage=target.hits;
}
export function advanceCriticalDeath(target,maxHits,round) {
  if(target.deathRound===undefined)return false;
  if(cancelCriticalDeathOnHealing(target,target.deathDamage))return false;
  if(round>=target.deathRound){kill(target,maxHits);return true;}
  return false;
}
