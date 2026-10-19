import test from 'node:test';
import assert from 'node:assert/strict';
import {killExperience,criticalExperience,activityExperience,combatExperience,appendExperience} from '../src/experience-rules.js';
import {createFight,stepFight} from '../src/coliseum-rules.js';
test('printed kill chart boundaries and book examples',()=>{
 assert.equal(killExperience(9,7),300);assert.equal(killExperience(7,1),500);
 assert.equal(killExperience(8,11),130);assert.equal(killExperience(9,11),150);
 assert.equal(killExperience(0,1),50);assert.equal(killExperience(0,11),0);
 assert.equal(killExperience(10,1),650);assert.equal(killExperience(20,30),200);
 assert.deepEqual('ABCDE'.split('').map(s=>criticalExperience(0,s)),[3,5,8,10,13]);
 assert.equal(criticalExperience(9,'C'),135);
});
test('spell, maneuver and travel awards follow the worked examples',()=>{
 assert.equal(activityExperience({kind:'spell',casterLevel:20,spellLevel:16}),60);
 assert.equal(activityExperience({kind:'spell',casterLevel:20,spellLevel:5}),0);
 assert.equal(activityExperience({kind:'spell',casterLevel:20,spellLevel:50}),200);
 assert.equal(activityExperience({kind:'spell',success:false}),0);
 assert.equal(activityExperience({kind:'maneuver',difficulty:'Light'})+activityExperience({kind:'maneuver',difficulty:'Medium',danger:2})+activityExperience({kind:'maneuver',difficulty:'Medium'}),160);
 assert.equal(activityExperience({kind:'travel',miles:30,danger:2}),60);
 assert.equal(activityExperience({kind:'travel',miles:30,mode:'sea'}),3);
 assert.equal(activityExperience({kind:'travel',miles:30,conscious:false}),0);
});
const fixture=()=>({finished:true,fighters:[{creature:{level:7,hits:100},hits:10},{creature:{level:9,hits:50},hits:60}],log:[{events:[{kind:'attack',side:0,hits:20,experienceHits:60,defeated:true,melee:false,critical:{severity:'C'}},{kind:'attack',side:1,hits:10,critical:{severity:'A'}}]}]});
test('combat awards separate received criticals, cap delivered criticals and exclude staged kill XP',()=>{
 const fight=fixture();
 const practice=combatExperience(fight,0,{intelligent:true});
 assert.deepEqual(practice.parts,{hitsDelivered:120,hitsReceived:10,criticalsDelivered:135,criticalsReceived:100,defeat:0,mortalWound:0});
 const conflict=combatExperience(fight,0,{intelligent:true,trueConflict:true});
 assert.equal(conflict.parts.defeat,315);
 fight.log[0].events[0].critical.severity='E';fight.log[0].events[0].melee=true;
 assert.equal(combatExperience(fight,0,{trueConflict:true}).parts.criticalsDelivered,300);
 assert.equal(combatExperience(fight,0,{trueConflict:true}).parts.defeat,0);
 assert.equal(combatExperience(fight,0,{multiplier:0.5}).total,Math.trunc(combatExperience(fight,0).total/2));
 fight.log[0].events[1].mortal=true;
 assert.equal(combatExperience(fight,0).parts.mortalWound,500);
 assert.equal(combatExperience(fight,0,{revived:true}).parts.mortalWound,1000);
});
test('awards are immutable, safe, journaled, deduplicated and usable by sheet undo',()=>{
 const original={xp:'100',xpHistory:'[]'};
 const next=appendExperience(original,{id:'fight-1',amount:50,reason:'Duel',date:'today'});
 assert.equal(original.xp,'100');assert.equal(next.xp,'150');assert.equal(JSON.parse(next.xpHistory)[0].before,100);
 assert.throws(()=>appendExperience(next,{id:'fight-1',amount:50}),/already/);
 assert.throws(()=>appendExperience(next,{id:'fight-2',amount:Infinity}),/Invalid/);
});
test('instant-death HP collapse is excluded from damage experience',()=>{
 const attackTable={columns:[{label:'AT 1'}],rows:[{roll:'XX-150',values:['1E']}]};
 const criticalTable={rows:[{roll:'01-100',cells:Array.from({length:5},()=>({description:'Foe dies instantly.',effect:'+5H'}))}]};
 const actor={name:'Fighter',level:1,hits:500,armor_type:1,db:0,size:'M',attacks:[{type:'Wp',ob:0,size:'M',chance:100}]};
 const fight=createFight(actor,{...actor,name:'Foe'});
 stepFight(fight,{'A-10.9.2':attackTable,'A-10.10.5':criticalTable},()=>0.49);
 const event=fight.log[0].events.find(e=>e.kind==='attack');
 assert.ok(event.damage>=500);assert.equal(event.experienceHits,6);assert.equal(event.mortal,true);
});

test('delayed death and bleeding preserve defeat attribution without adding synthetic hits',()=>{
 const fight=fixture();fight.log=[{events:[{kind:'dies',side:1,sourceSide:0}]}];
 let award=combatExperience(fight,0,{trueConflict:true});
 assert.equal(award.parts.defeat,300);assert.equal(award.parts.hitsDelivered,0);
 fight.log=[{events:[{kind:'bleed',side:1,sourceSide:0,hits:2,defeated:true}]}];
 award=combatExperience(fight,0,{trueConflict:true});assert.equal(award.parts.defeat,300);assert.equal(award.parts.hitsDelivered,4);
 const record=appendExperience({xp:'100',xpHistory:'[]'},{id:'penalty',amount:-25});
 assert.equal(record.xp,'75');assert.throws(()=>appendExperience(record,{id:'too-much',amount:-100}),/Invalid/);
 assert.equal(activityExperience({kind:'negative',amount:30}),-30);
 assert.equal(activityExperience({kind:'maneuver',difficulty:'Medium',danger:2,defeated:true}),500);
});
