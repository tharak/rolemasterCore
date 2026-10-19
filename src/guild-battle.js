import {supportBonus,attackElement} from './combat-support.js';
// DOM-free party combat. Reuses the existing attack tables and critical resolver.
import {attackLookup,resolveCritical,chooseAttacks} from './coliseum-rules.js';
import {openEndedD100} from './rules.js';
import {advanceCriticalDeath} from './critical-death.js';
import {expireCriticalEffects,accumulatedStunRounds} from './critical-stun.js';
import {knownAutomatedSpells} from './guild-spells.js';
import {combatExperience,activityExperience} from './experience-rules.js';
const alive=u=>!u.dead&&!u.incapacitated&&u.hits<u.creature.hits&&!u.asleep&&accumulatedStunRounds(u.effects)<=10;
const active=(u,r)=>u.effects.filter(e=>e.starts<=r);
const blocked=(u,r)=>accumulatedStunRounds(active(u,r))>10||active(u,r).some(e=>['stun','stunNoParry','downOrOut','noParry','mustParry'].includes(e.kind));
const modifier=(u,r)=>active(u,r).reduce((s,e)=>s+(e.kind==='bonus'?e.amount:e.kind==='penalty'?-e.amount:0),0);
const threshold=(a,t)=>{const base=[0,50,45,40,35,30,27,24,21,18,15,13,11,9,7,5],attack=[0,0,5,10,15,20,23,26,29,32,35,37,39,41,43,45];return (t<=15?base[Math.max(1,t)]:20-t)+(a<=15?attack[Math.max(1,a)]:30+a);};
const within=(raw,n)=>{const [a,b]=raw.split('-');return n>=(a==='XX'?-Infinity:parseInt(a))&&n<=(raw.endsWith('+')?Infinity:Number(b||a));};
function resisted(caster,target,tables,d100,support=0){
 const table=tables['A-10.9.11'],roll=openEndedD100(d100);
 const regular=table.rows.filter(r=>!r.unmodified&&/^\d{2}(?:-\d{2})?$/.test(r.roll));
 const row=table.rows.find(r=>r.unmodified&&within(r.roll,roll.first))||regular.find(r=>within(r.roll,roll.total))||(roll.total>95?regular[0]:regular.at(-1));
 const columns=table.columns.map((c,i)=>({...c,i})).filter(c=>c.group===caster.creature.realm&&(c.label==='Other'||c.label==='Metal armor'&&target.creature.armor_type>=13||c.label==='Leather armor'&&target.creature.armor_type>=5&&target.creature.armor_type<=12||c.label==='Metal shield'&&target.creature.equipment.shield));
 if(columns.some(c=>row.values[c.i]==='F'))return {resisted:true,detail:'Basic spell attack failed'};
 const mod=Math.max(...columns.map(c=>Number(row.values[c.i])||0));
 const resistance=openEndedD100(d100).total+support+mod+(caster.creature.realm===target.creature.realm?15:0),need=threshold(caster.creature.level,target.creature.level);
 return {resisted:resistance>=need,detail:`RR ${resistance} vs ${need}`};
}
function spellChoice(u,all,r){
 const allies=all.filter(a=>a.team===u.team&&alive(a)),foes=all.filter(a=>a.team!==u.team&&alive(a));
 for(const spell of knownAutomatedSpells(u.creature).filter(s=>s.level<=u.pp)){
  let target;
  if(spell.kind==='heal')target=allies.filter(a=>a.hits>=8).sort((a,b)=>b.hits/b.creature.hits-a.hits/a.creature.hits)[0];
  else if(spell.kind==='ward')target=(spell.self?[u]:allies).find(a=>!a.ward||a.ward.until<r);
  else target=foes.find(a=>(!spell.maxTargetLevel||a.creature.level<=spell.maxTargetLevel)&&(!['stun','song'].includes(spell.kind)||!blocked(a,r)));
  if(target)return {spell,target:target.id};
 }
 return null;
}
export function simulateGuildBattle(party,enemies,tables,random=Math.random,{roundLimit=80,recordPlayback=false,persistentConsequences=false,support=null,geometry={},elements={}}={}){
 if(!party.length||!enemies.length)throw new Error('A battle needs two parties.');
 const units=[...party.map(c=>[c,0]),...enemies.map(c=>[c,1])].map(([c,team])=>({id:c.id,team,creature:structuredClone(c),hits:c.damage||0,pp:c.pp??c.ppMax??0,effects:structuredClone(c.effects||[]).map(e=>({...e,starts:1})),dead:!!c.dead,pending:[],x:(team===0?(geometry.partyX??0):(geometry.enemyX??40))+(team===0?party:enemies).findIndex(a=>a.id===c.id)*(geometry.formationSpacing??2),conditions:structuredClone(c.conditions||[])}));
 const supportClock=round=>(support?.clock||0)+round-1;
 const bonus=(unit,round,stat,element)=>support?supportBonus(unit,units,support.auras,supportClock(round),stat,element,geometry):0;
 const refreshConditions=round=>{
  if(support)support.auras=support.auras.filter(a=>{
   const center=units.find(u=>u.id===a.targetId);
   return center&&!center.dead&&Math.abs(center.x-(geometry.attendantX??0))<=a.range&&a.until>supportClock(round);
  });
  for(const u of units){
   if(support)u.creature.supportEffects=(u.creature.supportEffects||[]).filter(e=>e.until>supportClock(round)&&Math.abs(u.x-(geometry.attendantX??0))<=e.range);
   const clock=supportClock(round);
   u.conditions=u.conditions.filter(c=>c.until>clock);
   if(u.managedSleep)u.asleep=false;
   u.managedSleep=u.conditions.some(c=>c.kind==='sleep');
   if(u.managedSleep)u.asleep=true;
   if(support)u.incapacitated=!!(u.consequences?.some(i=>i.disabling)||u.creature.injuries?.some(i=>i.disabling&&(!i.recoveryUntil||i.recoveryUntil>clock)&&(!i.suppressedUntil||i.suppressedUntil<=clock)));
  }
 };
 refreshConditions(1);
 const snapshot=round=>units.map(u=>({id:u.id,hp:Math.max(0,u.creature.hits-u.hits),pp:u.pp,standing:alive(u),dead:!!u.dead,asleep:!!u.asleep,
  conditions:[...(u.consequences||[]).map(c=>c.label),...(u.creature.injuries||[]).filter(i=>i.disabling&&(!i.suppressedUntil||i.suppressedUntil<=supportClock(round))).map(i=>i.label),...(bonus(u,round,'db')?[`Blessed +${bonus(u,round,'db')} DB`]:[])],effects:u.effects.map(e=>({kind:e.kind,amount:e.amount||0,roundsLeft:e.roundsLeft,pending:e.starts>round})),
  ...(u.deathRound!==undefined?{mortalIn:Math.max(0,u.deathRound-round)}:{})}));
 const initial=recordPlayback?snapshot(1):null;
 let previous=initial;
 const changes=round=>{const current=snapshot(round),changed=current.filter((u,i)=>JSON.stringify(u)!==JSON.stringify(previous[i]));previous=current;return changed;};
 const d100=()=>Math.floor(random()*100)+1,d10=()=>Math.floor(random()*10)+1,log=[];
 for(let round=1;round<=roundLimit&&[0,1].every(team=>units.some(u=>u.team===team&&alive(u)));round++){
  const entry={round,events:[]};
  refreshConditions(round);
  const record=(u,kind,text,extra={})=>entry.events.push({actor:u.id,team:u.team,kind,text,...extra,...(recordPlayback?{changes:changes(round)}:{})});
  for(const u of units){
   if(u.dead)continue;
   if(advanceCriticalDeath(u,u.creature.hits,round)){record(u,'dies',`${u.creature.name} dies from a mortal wound.`,{target:u.id,source:u.lastAttacker});continue;}
   const bleed=active(u,round).filter(e=>e.kind==='bleed').reduce((s,e)=>s+e.amount,0);
   if(bleed){u.hits+=bleed;record(u,'bleed',`${u.creature.name} takes ${bleed} bleeding hits.`,{hits:bleed,target:u.id,source:u.lastAttacker});}
  }
  const order=units.map(u=>({u,initiative:d10()+d10()+modifier(u,round)+(u.automaticInitiativeRound===round?10000:0),tie:random()})).sort((a,b)=>b.initiative-a.initiative||a.tie-b.tie);
  for(const {u} of order){
   if(![0,1].every(team=>units.some(a=>a.team===team&&alive(a))))break;
   if(!alive(u))continue;
   if(blocked(u,round)||u.conditions.some(c=>c.kind==='stun'&&c.until>supportClock(round))){u.casting=null;u.song=null;u.pending=[];record(u,'stun',`${u.creature.name} cannot act while stunned or forced to parry.`);continue;}
   if(u.song){const target=units.find(a=>a.id===u.song);if(target&&alive(target)){target.effects.push({kind:'stun',roundsLeft:1,starts:round});record(u,'concentrate',`${u.creature.name} maintains the song on ${target.creature.name}.`);continue;}u.song=null;}
   const choice=u.casting||spellChoice(u,units,round);
   if(choice){
    const target=units.find(a=>a.id===choice.target),spell=choice.spell;
    if(target&&alive(target)&&u.pp>=spell.level){
     u.casting={...choice,prepared:(choice.prepared||0)+1};
     if(u.casting.prepared<=2){record(u,'prepare',`${u.creature.name} prepares ${spell.name} (${u.casting.prepared}/2).`);continue;}
     u.casting=null;u.pp-=spell.level;
     let detail='',success=true;
     if(['stun','pain','sleep','song'].includes(spell.kind)){
      const rr=resisted(u,target,tables,d100,bonus(target,round,'rr'));detail=rr.detail;success=!rr.resisted;
      if(success){
       if(spell.kind==='pain'){const hits=Math.ceil((target.creature.hits-target.hits)*.25);target.hits+=hits;detail+=` · ${hits} hits`;}
       if(spell.kind==='stun'){const fail=/RR (-?\d+) vs (\d+)/.exec(detail);const rounds=Math.max(1,Math.ceil((Number(fail[2])-Number(fail[1]))/10));target.effects.push({kind:'stun',roundsLeft:rounds,starts:round});detail+=` · stunned ${rounds} rounds`;}
       if(spell.kind==='song'){u.song=target.id;target.effects.push({kind:'stun',roundsLeft:1,starts:round});detail+=' · held by the song';}
       if(spell.kind==='sleep'){target.asleep=true;detail+=' · asleep';}
      }else detail+=' · resisted';
     }else if(spell.kind==='heal'){const healed=Math.min(target.hits,Array.from({length:spell.dice},d10).reduce((a,b)=>a+b,0));target.hits-=healed;detail=`${healed} hits healed`;}
     else if(spell.kind==='ward'){target.ward={bonus:spell.bonus,until:round+u.creature.level*6};detail=`+${spell.bonus} DB`;}
     else if(spell.kind==='bolt'){
      const attack={name:spell.name,ob:(u.creature.sourceAttacks.find(a=>a.kind==='ds')?.ob||0)+spell.obModifier,type:'Wp',size:'M',attackTable:'A-10.9.9',criticalTable:spell.critical,cap:spell.cap,maxCritical:spell.maxCritical,spell:true};
      strike(u,target,attack,round,record);detail='bolt resolved';
     }
     record(u,'spell',`${u.creature.name} casts ${spell.name} on ${target.creature.name}: ${detail} (${spell.level} PP).`,{target:target.id,spellLevel:spell.level,success});continue;
    }
    u.casting=null;
   }
   const targets=units.filter(a=>a.team!==u.team&&alive(a));if(!targets.length)break;
   const target=targets[Math.floor(random()*targets.length)];
   const attacks=u.pending.length?[...u.pending]:(u.creature.sourceKind==='master'?[Math.max(0,u.creature.attacks.findIndex(a=>a?.chance>0))]:chooseAttacks(u.creature,d100()));u.pending=[];
   const used=new Set();
   for(const index of attacks){
    if(used.has(index)||!alive(target))continue;
    used.add(index);const attack=u.creature.attacks[index];
    const result=strike(u,target,attack,round,record);
    if(result.critical&&attack.type!=='Ti'){
     const follow=u.creature.attacks[index+1];
     if(follow?.follow==='same')attacks.push(index+1);
     if(follow?.follow==='next')u.pending.push(index+1);
    }
   }
  }
  for(const u of units)u.effects=expireCriticalEffects(u.effects,round,'starts');
  log.push(entry);
 }
 // A battle ending is not treatment. Resolve outstanding mortal-wound clocks
 // even when their victims can no longer act or all opponents are down.
 if(persistentConsequences){
  while(units.some(u=>!u.dead&&u.deathRound!==undefined)){
   const round=log.length+1,entry={round,events:[]};
   for(const u of units.filter(u=>!u.dead&&u.deathRound!==undefined)){
    const died=advanceCriticalDeath(u,u.creature.hits,round);
    entry.events.push({actor:u.id,team:u.team,target:u.id,kind:died?'dies':u.deathRound===undefined?'stabilized':'mortal',text:died?`${u.creature.name} dies from untreated mortal wounds.`:u.deathRound===undefined?`${u.creature.name}'s mortal wound is stabilized.`:`${u.creature.name}: mortal wound, ${u.deathRound-round} rounds remain.`,...(recordPlayback?{changes:changes(round)}:{})});
   }
   log.push(entry);
  }
 }
 if(support)for(const u of units){
  for(const e of u.effects.filter(e=>['stun','stunNoParry'].includes(e.kind)&&e.roundsLeft>0))u.conditions.push({kind:'stun',until:supportClock(log.length+1)+e.roundsLeft});
 }
 const survivors=team=>units.some(u=>u.team===team&&alive(u));
 const winner=survivors(0)&&!survivors(1)?0:survivors(1)&&!survivors(0)?1:null;
 const xp={};
 for(const self of units.filter(u=>u.team===0)){
  let total=0;
  for(const foe of units.filter(u=>u.team===1)){
   const pairLog=log.map(r=>({events:r.events.filter(e=>
    e.kind==='attack'&&((e.actor===self.id&&e.target===foe.id)||(e.actor===foe.id&&e.target===self.id))||
    ['bleed','dies'].includes(e.kind)&&((e.actor===self.id&&e.source===foe.id)||(e.actor===foe.id&&e.source===self.id))
   ).map(e=>({...e,side:e.actor===self.id?0:1,sourceSide:e.source===self.id?0:e.source===foe.id?1:undefined}))}));
   total+=combatExperience({fighters:[self,foe],log:pairLog},0,{trueConflict:true,intelligent:!!foe.creature.sourceKind,size:foe.creature.size==='H*'?'super-large':foe.creature.size==='L*'?'large':'normal'}).total;
  }
  total+=log.flatMap(r=>r.events).filter(e=>e.actor===self.id&&e.kind==='spell'&&e.success).reduce((s,e)=>s+activityExperience({kind:'spell',casterLevel:self.creature.level,spellLevel:e.spellLevel}),0);
  xp[self.id]=total;
 }
 return {winner,rounds:log.length,log,units,xp,...(support?{supportAuras:support.auras}:{}),...(recordPlayback?{playback:{version:1,initial,final:snapshot(log.length)}}:{})};
 function strike(u,target,attack,round,record){
  const melee=attack.rawKind!=='ms'&&!attack.spell&&!attack.simpleBolt;
  if(support&&melee)u.x=target.x+(u.team===0?-(geometry.meleeReach??3):(geometry.meleeReach??3));
  const element=attackElement(attack,elements);
  const roll=openEndedD100(d100),db=target.creature.db+bonus(target,round,'db',element)+(target.ward?.until>=round?target.ward.bonus:0)-(attack.spell&&target.creature.equipment.shield?10:0);
  const woundFraction=u.hits/u.creature.hits,woundPenalty=woundFraction>.75?-30:woundFraction>.5?-20:woundFraction>.25?-10:0;
  const total=roll.total+attack.ob+(attack.obModifier||0)-db+modifier(u,round)+woundPenalty+(attack.spell&&!target.creature.equipment.helmet?5:0),result=attackLookup(tables[attack.attackTable],Math.min(attack.cap??Infinity,total),roll.first,target.creature.armor_type,attack.size);
  if(attack.maxCritical&&!(attack.simpleBolt&&roll.first===100)&&result.critical>attack.maxCritical)result.critical=attack.maxCritical;
  const before=target.hits,targetState=blocked(target,round)?'stunned':'active';target.hits+=result.hits;
  const critical=result.critical?resolveCritical(target,u,attack,result.critical,tables,d100,round,{persistentConsequences,allies:units.filter(a=>a.team===u.team&&a.id!==u.id&&alive(a))}):null;
  target.lastAttacker=u.id;
  record(u,'attack',`${u.creature.name} → ${target.creature.name}: ${attack.name}, roll ${roll.total}, OB ${attack.ob}${attack.simpleBolt?` (${attack.obModifier>=0?'+':''}${attack.obModifier} bolt)`:''}, DB ${db}, modifiers ${total-roll.total-attack.ob-(attack.obModifier||0)+db} → ${total}; ${target.hits-before} hits${critical?` · ${critical.severity} critical: ${critical.description}`:''}${!alive(target)?' · defeated':''}.`,{target:target.id,attackName:attack.name,damage:target.hits-before,hits:result.hits,experienceHits:result.hits+(critical?.experienceHits||0),critical,targetState,melee:attack.rawKind!=='ms'&&!attack.spell&&!attack.simpleBolt,defeated:!alive(target),mortal:!!target.dead||target.deathRound!==undefined});
  return result;
 }
}
