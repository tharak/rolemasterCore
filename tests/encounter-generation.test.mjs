import test from 'node:test';
import assert from 'node:assert/strict';
import {encounterLookup,encounterRows,densities,groupSizeModifier,generateEncounter} from '../src/encounter-generation-rules.js';
import {readFileSync} from 'node:fs';
test('all 70 T-5.1 cells agree with the preserved source and their band boundaries',()=>{
 const source=JSON.parse(readFileSync(new URL('./fixtures/tables/T-5.1.json',import.meta.url))).tablePages.map(p=>p.text).join('\n').replace(/[–−]/g,'-').replace(/\s+/g,' ');
 let lower=-100;
 for(const [upper,cells] of encounterRows){
  assert.ok(source.includes(cells.join(' ')),cells.join(' '));
  for(let column=0;column<5;column++){
   assert.equal(encounterLookup(lower,densities[column]).cell,cells[column]);
   if(Number.isFinite(upper))assert.equal(encounterLookup(upper,densities[column]).cell,cells[column]);
  }lower=upper+1;
 }
 assert.equal(encounterLookup(91,'Dense',50).type,'wild');assert.equal(encounterLookup(91,'Dense',51).type,'social');
 assert.equal(encounterLookup(0,'Dense').type,'none');
});
test('half-count members and all group-size bands',()=>{
 assert.deepEqual(groupSizeModifier(0,1),{weighted:0.5,count:1,modifier:50});
 assert.equal(groupSizeModifier(1,1).modifier,20);
 assert.equal(groupSizeModifier(0,4).modifier,20);
 assert.deepEqual([1,2,3,4,5,7,8,10,11,20,21,50,51].map(n=>groupSizeModifier(n).modifier),[50,20,0,0,-10,-10,-20,-20,-50,-50,-75,-75,-100]);
 assert.throws(()=>groupSizeModifier(0,0));
});
test('both rolls are open-ended and tie-breaking consumes a separate ordinary d100',()=>{
 const dice=[96,50,40,51];let calls=0;
 const r=generateEncounter({density:'Dense',terrain:'Road',full:3},()=>{calls++;return dice.shift();});
 assert.equal(r.activity.total,146);assert.equal(r.avoidance.total,40);assert.equal(r.result,136);
 assert.equal(r.cell,'a/h');assert.equal(r.type,'social');assert.equal(calls,4);
 const no=generateEncounter({density:'Waste'},()=>50);assert.equal(no.type,'none');assert.equal(no.tieRoll,null);
});
test('activity, avoidance, camp and night modifiers remain independently reviewable',()=>{
 const r=generateEncounter({terrain:'Forest and Rough',travel:'Sneaking',full:3,hostile:true,patrolled:true,hueCry:true,night:true,nightAdapted:true,searching:true,campHours:16,activityExtra:5,avoidanceExtra:10},()=>50);
 assert.equal(r.activityTotal,230);assert.equal(r.avoidanceTotal,50);assert.equal(r.frequency,'Every hour during hue and cry');
});
