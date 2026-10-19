// Pure helper shared by combat and tests: exact membership, range, expiry,
// elemental restrictions and non-cumulative protection families.
export function supportBonus(unit,units,auras,clock,stat,element,geometry={}){
 const x=unit.x??(geometry.partyX??0);
 const effects=[...(unit.creature?.supportEffects||unit.supportEffects||[]),...auras.filter(a=>{
  const center=units.find(u=>u.id===a.targetId);return center&&!center.dead&&Math.abs(x-center.x)<=a.radius&&Math.abs(center.x-(geometry.attendantX??0))<=a.range;
 })];
 const groups=new Map();
 for(const e of effects){
  if(e.until<=clock||Math.abs(x-(geometry.attendantX??0))>e.range||e.element&&e.element!==element)continue;
  groups.set(e.group,Math.max(groups.get(e.group)||0,e[stat]||0));
 }
 return [...groups.values()].reduce((a,b)=>a+b,0);
}

export function attackElement(attack,{elementNames={},elementTables={}}={}){
 if(attack.element)return attack.element;
 for(const [element,pattern] of Object.entries(elementNames))if(new RegExp(pattern,'i').test(attack.name||''))return element;
 return elementTables[attack.criticalTable];
}
