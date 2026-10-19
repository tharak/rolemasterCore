import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {raceHealing,recoveryTables,healingFactor,woundSeverity,recoveryDays,recoveryPlan,hitRecovery,nerveDamage,permanentInjury,firstAid,soulRecovery,mentalStats,physicalStats,mentalLossDice,advanceDeath,restoreSoul} from '../src/healing-rules.js';
test('all recovery table rows preserve the source values and boundary lookups',()=>{
 const text=JSON.parse(readFileSync(new URL('./fixtures/tables/T-5.4.json',import.meta.url))).tablePages[0].text.replace(/\s+/g,' ');
 for(const [type,rows] of Object.entries(recoveryTables)){let previous=-1000;for(const [max,...values] of rows){assert.ok(text.includes(values.join(' ')));for(const [i,severity] of ['Light','Medium','Severe'].entries()){assert.equal(recoveryDays(type,severity,previous,0,'Common Man'),values[i]);if(Number.isFinite(max))assert.equal(recoveryDays(type,severity,max,0,'Common Man'),values[i]);}previous=max+1;}}
 assert.equal(Object.keys(raceHealing).length,12);assert.equal(12+5+healingFactor('Halfling').departure,35);
 assert.equal(recoveryDays('Head','Severe',90,0,'Dwarf'),15);
});
test('classification, combined recovery and permanent nerve damage match book examples',()=>{
 assert.equal(woundSeverity({penalty:20}),'Light');assert.equal(woundSeverity({penalty:21}),'Medium');assert.equal(woundSeverity({bleeding:11}),'Severe');assert.equal(woundSeverity({fracture:true}),'Medium');
 const plan=recoveryPlan([{days:30,penalty:70},{days:8},{days:1}]);assert.equal(plan.days,34.5);assert.equal(plan.daily,2);assert.equal(plan.firstDay,3);
 assert.equal(nerveDamage(40,17,9,-5).permanent,20);assert.equal(nerveDamage(40,17,-11,0).permanent,40);assert.equal(nerveDamage(40,17,-10,0).permanent,20);
 assert.match(permanentInjury(50,50).result,/unspecified/);
});
test('natural recovery and first aid enforce continuous time, equipment and once-per-wound limits',()=>{
 assert.equal(hitRecovery('active',8,4),2);assert.equal(hitRecovery('rest',2.9,4),4);assert.equal(hitRecovery('sleep',8,4),16);assert.equal(hitRecovery('sleep',8,4,true),16);assert.equal(hitRecovery('sleep',3,-5),3);assert.equal(hitRecovery('sleep',3,-5,false,1),1);
 assert.equal(firstAid({severity:'Severe',type:'Skin/Tissue',bleeding:12,success:true,equipment:true}).bleeding,7);
 assert.equal(firstAid({severity:'Medium',type:'Organ',success:true,equipment:true}).effective,false);assert.throws(()=>firstAid({applied:true}));
 assert.equal(soulRecovery({days:7,mode:'stationary',soothing:true,holy:true},()=>3).points,23);
});
const death=()=>({round:0,stats:Object.fromEntries([...mentalStats,...physicalStats].map(name=>[name,{temp:50,pot:80}]))});
test('death clocks distinguish Preservation, Lifekeeping and physical versus mental loss',()=>{
 assert.equal(mentalLossDice(19,2),'1d5+1');
 const initial=death(),preserved=advanceDeath(initial,12,{preserved:true},()=>1);assert.deepEqual(preserved.stats,initial.stats);assert.equal(preserved.soulDeparted,true);
 const kept=advanceDeath(initial,12,{lifekeeping:true},()=>2);assert.equal(kept.soulDeparted,undefined);assert.ok(kept.stats.Memory.temp<50);
 const physical=advanceDeath(initial,420,{race:'Dwarf'},()=>2);assert.equal(physical.stats.Constitution.temp,49);
 assert.equal(advanceDeath(initial,419,{race:'Dwarf'},()=>2).stats.Constitution.temp,50);
 const destroyed=advanceDeath(initial,1,{soulDestroyed:true},()=>1);assert.throws(()=>restoreSoul(destroyed,true));assert.equal(restoreSoul(preserved,true).coma,false);
 assert.throws(()=>advanceDeath(restoreSoul(preserved,true),1));
 assert.equal(initial.round,0);
});
