// Shared policy for recognized temporary critical effects only. Never parse
// bleeding, death or narrative injuries into a new temporary effect.
export function criticalDuration(count, kind, context = '') {
  if (count !== undefined && count !== null && String(count).trim() !== '') {
    const roundsLeft=Number(count)||1;
    return {roundsLeft,label:roundsLeft+' round'+(roundsLeft===1?'':'s'),defaulted:false};
  }
  const marker={penalty:/penalt|[-−–]\s*\d+|useless|immobiliz/i,bonus:/bonus|attacker|\(\s*\+\d+/i,stun:/stunn|∑/i,stunNoParry:/stunn|parry|∑∏/i,noParry:/unable to parry|cannot parry|no parry|∏/i,mustParry:/must parry|forced to parry|π/i}[kind];
  for (const segment of String(context).split(/[.!?;\n]/).filter(text=>marker?.test(text))) {
    const until=/\buntil\s+[^.!?;]+/i.exec(segment);
    if(until)return {roundsLeft:null,label:until[0].trim(),defaulted:false};
    if(/\bpermanent(?:ly)?\b/i.test(segment))return {roundsLeft:null,label:'permanent',defaulted:false};
    if(/\b(?:indefinite(?:ly)?|ongoing)\b/i.test(segment))return {roundsLeft:null,label:'ongoing',defaulted:false};
    const explicit=/\bfor\s+(\d+|one|two|three)\s+(rounds?|rnds?|hours?|days?|weeks?|months?|years?)/i.exec(segment);
    if(explicit){
      const n=Number(explicit[1])||({one:1,two:2,three:3})[explicit[1].toLowerCase()];
      if(/^r(?:ound|nd)/i.test(explicit[2]))return {roundsLeft:n,label:n+' round'+(n===1?'':'s'),defaulted:false};
      return {roundsLeft:null,label:'for '+explicit[1]+' '+explicit[2]+' (GM-managed)',defaulted:false};
    }
  }
  // Core Rules, Key to the Criticals (printed p. 209): the specific penalty
  // rule overrides the general omitted-beta default of one.
  return kind==='penalty'
    ? {roundsLeft:null,label:'until healed',defaulted:true}
    : {roundsLeft:1,label:'1 round',defaulted:true};
}
export function criticalDurationFields(count,kind,context) {
  const duration=criticalDuration(count,kind,context);
  return duration.roundsLeft===null ? {roundsLeft:null,durationLabel:duration.label} : {roundsLeft:duration.roundsLeft};
}
