export const criticalEquipment = [
  ['helmet','Helmet / helm'],['full helmet','Full helm'],['visor','Visor'],['nose guard','Nose guard'],
  ['chest armor','Chest armor'],['plate chest armor','Plate chest armor'],['abdomen armor','Abdominal / abdomen armor'],
  ['waist armor','Waist armor'],['leg armor','Leg armor'],['leg greaves','Leg greaves'],['arm greaves','Arm greaves'],
  ['shoulder armor','Shoulder armor'],['thigh armor','Thigh armor'],['throat protector','Throat protector'],
  ['organic neck covering','Organic neck covering'],['shield','Shield'],['backpack','Backpack'],['belt','Belt'],['head gear','Head gear'],['armor','Other armor'],['neck armor','Neck armor'],['warm clothing','Warm clothing'],['wet','Wet / soaked']
];
const aliases = Object.fromEntries(criticalEquipment.map(([key])=>[key,key]));
Object.assign(aliases,{'helm':'helmet','full helm':'full helmet','visored':'visor','abdominal armor':'abdomen armor','ch armor':'chest armor','ch. armor':'chest armor','leg greave':'leg greaves','arm greave':'arm greaves','greaves':'leg greaves','warmly clothed':'warm clothing'});
const sortedAliases=Object.keys(aliases).sort((a,b)=>b.length-a.length);
export function hasEquipment(equipment,key) {
  const has=name=>Array.isArray(equipment)?equipment.includes(name):equipment?.[name]===true;
  if(has(key))return true;
  if(key==='helmet')return has('full helmet')||has('visor');
  if(key==='head gear')return has('helmet')||has('full helmet')||has('visor');
  if(key==='chest armor')return has('plate chest armor');
  if(key==='armor')return criticalEquipment.some(([name])=>/armor/.test(name)&&has(name));
  return false;
}
function conditionStart(text,previous,effectMode=false) {
  const marker=/^(if not|otherwise|if|without|with|w\/o|w\/)(?=[\s,:]|$)\s*/i.exec(text);if(!marker)return null;
  let rest=text.slice(marker[0].length),negative=/without|w\/o|if not|otherwise/i.test(marker[1]);
  if(/^if$/i.test(marker[1])&&/^the neck is exposed\b/i.test(rest))return {length:marker[0].length+'the neck is exposed'.length,key:'neck armor',negative:true};
  if(/^otherwise$/i.test(marker[1])||/^if not$/i.test(marker[1])&&!sortedAliases.some(alias=>rest.toLowerCase().startsWith(alias)))return previous?{length:marker[0].length,key:previous.key,negative:!previous.negative,alternate:true}: {length:marker[0].length,unsupported:true};
  const subject=/^(?:(?:foe|he|enemy|opponent)\s+)?(?:(?:has|have|is wearing|is)\s+)?(?:(no|not|doesn't have)\s+)?(?:a |an |any |the |his )?/i.exec(rest);
  rest=rest.slice(subject[0].length);if(subject[1])negative=!negative;
  const alias=sortedAliases.find(alias=>rest.toLowerCase().startsWith(alias)&&!/[a-z]/i.test(rest[alias.length]||''));
  if(!alias)return effectMode||/^if$/i.test(marker[1])?{length:marker[0].length,unsupported:true}:null;
  const tail=rest.slice(alias.length);
  const presence=/^\s+is\s+(absent|missing|present)\b/i.exec(tail);
  if(presence)return {length:marker[0].length+subject[0].length+alias.length+presence[0].length,key:aliases[alias],negative:presence[1].toLowerCase()!=='present'};
  if(/^\s*(?:\(|and\b|or\b)/i.test(tail))return {length:marker[0].length+subject[0].length+alias.length,unsupported:true};
  if(/^(?:with|w\/)$/i.test(marker[1])&&!/^\s*:+/.test(tail)&&(!/^\s*,/.test(tail)||effectMode))return null;
  return {length:marker[0].length+subject[0].length+alias.length,key:aliases[alias],negative};
}
export function resolveCriticalEquipment(description,effect,equipment={}) {
  description=String(description||'');effect=String(effect||'');
  const text=description+' '+effect,boundary=description.length+1;
  let previous=null,unresolved=false,unresolvedMechanics=false;const conditions=[],ranges=[],chunks=[];
  // The extraction can split a conditional sentence between the two fields.
  // Select clauses across that boundary, then project the selected ranges back
  // into each original field so numeric effects retain their source location.
  let start=0;
  for(const match of text.matchAll(/(?<=[.!?])\s+/g)){
    if(match.index>description.length)break;
    chunks.push({start,text:text.slice(start,match.index)});start=match.index+match[0].length;
  }
  chunks.push({start,text:text.slice(start)});
  for(const {start,text:chunk} of chunks){
    const candidates=[...chunk.matchAll(/\b(?:if not|otherwise|if|without|with|w\/o|w\/)(?=[\s,:]|$)/gi)];
    const markers=[];
    for(const m of candidates){const condition=conditionStart(chunk.slice(m.index),previous,start+m.index>=boundary);if(condition){markers.push({...condition,index:m.index});if(condition.unsupported)previous=null;if(!condition.unsupported&&!condition.alternate)previous=condition;}}
    if(!markers.length){ranges.push([start,start+chunk.length]);continue;}
    ranges.push([start,start+markers[0].index]);
    markers.forEach((condition,index)=>{
      const body=chunk.slice(condition.index+condition.length,markers[index+1]?.index??chunk.length).replace(/^\s*[:,]?\s*/,'');
      if(condition.unsupported||/::|\b(?:greaves|armor|shield|helm)\s*:/i.test(body)){unresolved=true;if(/[∑∏π∫]|\+\d+H|\b(?:dies?|dead|kills?|killing|recoils?|initiative)\b|\(\s*[-−–+]\s*\d+/i.test(body)||start+condition.index>=boundary)unresolvedMechanics=true;return;}
      conditions.push(condition.key);
      if(hasEquipment(equipment,condition.key)!==condition.negative)ranges.push([start+condition.index+condition.length,start+(markers[index+1]?.index??chunk.length)]);
    });
  }
  const project=(low,high)=>ranges.map(([a,b])=>text.slice(Math.max(a,low),Math.max(Math.max(a,low),Math.min(b,high))).replace(/^\s*[:,]?\s*/,'')).filter(Boolean).join(' ');
  return {description:project(0,description.length),effect:project(boundary,text.length),unresolved,unresolvedMechanics,conditions:[...new Set(conditions)]};
}
