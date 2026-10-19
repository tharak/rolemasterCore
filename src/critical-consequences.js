// Explicit structural injuries only, after equipment-dependent clauses are selected.
// Unknown or unresolved conditional prose must not invent a permanent disability.
export function criticalConsequences(description,effect=''){
 const text=(String(description)+' '+String(effect)).replace(/[’]/g,"'");
 const sentences=text.split(/[.!?;]/).filter(s=>! /\b(?:if|unless|otherwise|without|w\/o)\b/i.test(s));
 const clear=sentences.join('. '),result=[];
 const temporary=/paraly[sz][^.!?;]*\bfor\s+(?:\d+|one|two|three)\s+(?:round|minute|hour|day|week)/i.test(clear);
 if(!temporary&&(/\bparaly[sz](?:ed|is)\b/i.test(clear)||/\bsever(?:s|ed)?\s+(?:foe's\s+|his\s+|the\s+)?spine\b/i.test(clear))){
  result.push({kind:'paralysis',destroyed:/\b(?:destroyed|severed|severs|sever)\b/i.test(clear),label:'Paralyzed',treatment:'Unparalysis',disabling:true});
 }
 const limb=/\bsever(?:s|ed|ing)?\s+(?:(?:foe's|his|the|a)\s+)?(?:(?:left|right|weapon|shield|upper|lower)\s+)?(leg|arm|hand|foot)\b/ig;
 for(const match of clear.matchAll(limb))if(!result.some(r=>r.part===match[1].toLowerCase()))result.push({kind:'severedLimb',part:match[1].toLowerCase(),label:`Severed ${match[1].toLowerCase()}`,treatment:'Limb restoration',disabling:true});
 if(/\bnerve(?:s)?\b/i.test(clear)&&/\b(?:damage|damaged|sever|destroy|cut|torn)/i.test(clear)&&!result.some(r=>r.kind==='paralysis')){
  const penalty=Number(/-([0-9]+)/.exec(effect)?.[1]||0);
  result.push({kind:'nerve',label:'Nerve damage',treatment:'Nerve Law',disabling:/useless|paraly/i.test(clear),nervePenalty:penalty,destroyed:/destroy|sever/i.test(clear)});
 }
 const degree=/\b(?:3rd|third)[ -]degree/i.test(clear)?3:/\b(?:2nd|second)[ -]degree/i.test(clear)?2:/\b(?:1st|first)[ -]degree/i.test(clear)?1:null;
 if(degree&&/burn|frostbite/i.test(clear))result.push({kind:'burn',degree,label:`Degree ${degree} burn/frostbite`,treatment:'Frost/Burn Relief',disabling:false});
 if(/\b(?:headache|toothache|hangover|bee.sting)\b/i.test(clear))result.push({kind:'irritation',label:'Minor irritation',treatment:'Minor Irritation Relief',disabling:false});
 if(!result.length&&/\bpermanent(?:ly)?\b/i.test(clear)&&/\b(?:blind|deaf|useless|crippl|nerve|brain|spine)/i.test(clear))result.push({kind:'permanentInjury',label:'Permanent injury',treatment:'Specialist restoration',disabling:true});
 return result;
}
export const hasDisablingInjury=member=>(member.injuries||[]).some(i=>i.disabling&&!i.suppressed);
