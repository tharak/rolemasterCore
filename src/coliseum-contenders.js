// Pure adapters from saved encounter actors and the printed master table.
// No DOM, storage, random rolls, or changes to the source character records.
import {masterSpells} from './guild-spells.js';
import {criticalEquipment} from './critical-equipment.js';

export const arenaWeaponStyles={
  'Weapon • 1-H Edged':{label:'1-H Edged',table:'A-10.9.2',critical:'A-10.10.5',kind:'me'},
  'Weapon • 1-H Concussion':{label:'1-H Concussion',table:'A-10.9.1',critical:'A-10.10.3',kind:'me'},
  'Weapon • 2-Handed':{label:'2-Handed',table:'A-10.9.3',critical:'A-10.10.3',kind:'me'},
  'Weapon • Pole Arms':{label:'Pole Arms',table:'A-10.9.5',critical:'A-10.10.4',kind:'me'},
  'Weapon • Missile':{label:'Missile',table:'A-10.9.4',critical:'A-10.10.4',kind:'ms'},
  'Weapon • Missile Artillery':{label:'Missile Artillery',table:'A-10.9.4',critical:'A-10.10.4',kind:'ms'},
  'Weapon • Thrown':{label:'Thrown',table:'A-10.9.6',critical:'A-10.10.4',kind:'ms'},
};
function weaponAttack({key,name,category,ob,rawKind}) {
  const style=arenaWeaponStyles[category];
  return {key,name,category,ob,type:'Wp',size:'M',chance:0,optional:true,
    attackTable:style.table,criticalTable:style.critical,rawKind};
}
function explicitEquipment(actor) {
  const names=(actor.equipmentNames||[]).filter(name=>typeof name==='string').join(' ').toLowerCase();
  const facts=Object.fromEntries(criticalEquipment.map(([key])=>[key,names.includes(key)]));
  facts.helmet=/helm|helmet/.test(names);facts['full helmet']=/full helm/.test(names);facts.visor=/visor/.test(names);
  facts['abdomen armor']=/abdom(?:en|inal) armor/.test(names);
  facts.shield=actor.shieldBonus>0||/shield/.test(names);
  return Object.keys(facts).filter(key=>facts[key]);
}
export function characterContenders(actors) {
  const seen=new Set();
  return actors.filter(actor=>actor&&typeof actor.id==='string'&&actor.id&&!seen.has(actor.id)&&seen.add(actor.id)).map(actor=>{
    const attacks=[];
    for(const weapon of actor.attacks||[]){
      if(!Object.hasOwn(arenaWeaponStyles,weapon.category)||!Number.isFinite(weapon.bonus))continue;
      const key=JSON.stringify([weapon.category,weapon.name]);
      if(attacks.some(attack=>attack.key===key))continue;
      attacks.push(weaponAttack({key,name:weapon.name,category:weapon.category,ob:weapon.bonus}));
    }
    const problems=[];
    if(!Number.isFinite(actor.hitsMax)||actor.hitsMax<=0)problems.push('finish Body Development for positive maximum hits');
    if(!attacks.length)problems.push('equip a supported weapon');
    return {id:'character:'+actor.id,sourceKind:'character',sourceId:actor.id,name:actor.name||'Unnamed',
      group:'Character',race:actor.race,profession:actor.profession,level:actor.level,size:'M',hits:actor.hitsMax,
      armor_type:actor.at,db:actor.db,initiativeBonus:actor.stats?.[8]||0,attacks,
      suggestedEquipment:explicitEquipment(actor),unavailable:problems.join('; '),
      special:`${actor.race} ${actor.profession} · Saved character. Uses the calculated stats and equipped weapons from Encounters.`};
  });
}
export function masterCharacterCatalog(data,{spellPresets=true}={}) {
  if(data?.code!=='T-5.8')throw new Error('Master Character table T-5.8 is required.');
  const pages=data.tablePages||[];
  const pattern=/^(?:(Fighter|Thief|Rogue|Cleric|Magician|Mentalist|Ranger|Dabbler|Bard)\s+)?(1|5|10|15|20)\s+(\d+)\((\d+)(s?)(\*?)\)\s+(\d+)\s+(\d+)\s+(-?\d+)(me|ms|ds)\s+(-?\d+)(me|ms|ds)(?=\s)/;
  const rows=pages.flatMap(page=>String(page.text||'').split('\n').flatMap(raw=>{
    const match=pattern.exec(raw.trim());
    return match?[{match,raw,page}]:[];
  }));
  if(rows.length!==45)throw new Error(`T-5.8: expected 45 complete character rows, found ${rows.length}.`);
  const contenders=[];
  for(let offset=0;offset<rows.length;offset+=5){
    const block=rows.slice(offset,offset+5),profession=block.find(row=>row.match[1])?.match[1];
    if(!profession||block.map(row=>row.match[2]).join(',')!=='1,5,10,15,20')throw new Error('T-5.8: profession or level grouping is incomplete.');
    for(const {match:m,raw,page} of block){
      const level=Number(m[2]),sourceAttacks=[{slot:1,ob:Number(m[9]),kind:m[10]},{slot:2,ob:Number(m[11]),kind:m[12]}];
      const attacks=sourceAttacks.filter(attack=>attack.kind!=='ds').map(attack=>{
        const category=attack.kind==='me'?'Weapon • 1-H Edged':'Weapon • Missile';
        return weaponAttack({key:'slot-'+attack.slot,name:`#${attack.slot} ${attack.kind==='me'?'Melee':'Missile'} · ${arenaWeaponStyles[category].label}`,category,ob:attack.ob,rawKind:attack.kind});
      });
      contenders.push({id:`master:${profession.toLowerCase()}:${level}`,sourceKind:'master',name:`${profession} (level ${level})`,
        group:'T-5.8 enemy',profession,level,size:'M',armor_type:Number(m[3]),db:Number(m[4]),hits:Number(m[7]),ppMax:Number(m[8]),
        ...(spellPresets?masterSpells(profession,level,Number(raw.trim().slice(m[0].length).trim().split(/\s+/)[5])):{spellRanks:Number(raw.trim().slice(m[0].length).trim().split(/\s+/)[5]),spellLists:[]}),
        attacks,sourceAttacks,suggestedEquipment:m[5]?['shield']:[],spellDefense:m[6]==='*',
        source:{code:'T-5.8',printedPage:page.printedPage,pdfPage:page.pdfPage,raw},
        special:`T-5.8 · ${m[8]} PPs. Printed DB ${m[4]}${m[5]?' includes shield':''}; spell increases are not added. Weapon types are configurable.${sourceAttacks.some(attack=>attack.kind==='ds')?' Directed-spell OB is preserved; no spell is specified in the table.':''}`});
    }
  }
  return contenders;
}
export function configureContender(contender,{attackKey,category}={}) {
  if(!contender.sourceKind)return contender;
  const chosen=contender.attacks.find(attack=>attack.key===attackKey)||contender.attacks[0];
  return {...contender,attacks:contender.attacks.map(attack=>{
    const style=arenaWeaponStyles[category];
    const change=contender.sourceKind==='master'&&attack===chosen&&style?.kind===attack.rawKind;
    const configured=change?weaponAttack({...attack,category,name:attack.name.split(' · ')[0]+' · '+style.label}):{...attack};
    return {...configured,chance:attack===chosen?100:0,optional:attack!==chosen};
  })};
}
