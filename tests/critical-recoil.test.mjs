import test from 'node:test';
import assert from 'node:assert/strict';
import {criticalRecoils,recoilMovement} from '../src/critical-recoil.js';
import {parseCriticalSymbols} from '../src/rules.js';
import {resolveCriticalEquipment} from '../src/critical-equipment.js';

test('explicit recoil distance is recognized in either field; unrelated movement stays literal',()=>{
  for(const text of ['Foe recoils 5 feet away from your assault.','Foe recoils 10 feet from the blast.','He recoils 15 ft.']){
    assert.equal(criticalRecoils(text).length,1,text);
    assert.deepEqual(parseCriticalSymbols('',text),criticalRecoils(text));
    assert.deepEqual(parseCriticalSymbols(text),criticalRecoils(text));
  }
  assert.deepEqual(parseCriticalSymbols('feet from your blow.','Foe recoils 10'),[{kind:'recoil',feet:10}]);
  for(const text of ['Foe recoils.','Foe recoils before your blow impacts. He steps back 5 feet.','You recoil 5 feet.','If shield breaks, foe recoils 5 feet.','Foe does not recoil 5 feet.'])assert.deepEqual(criticalRecoils(text),[],text);
  for(const [equipment,count] of [[[],0],[['shield'],1]]){
    const choice=resolveCriticalEquipment('If foe has a shield, foe recoils 10 feet.','+1H',equipment);
    assert.equal(parseCriticalSymbols(choice.effect,choice.description).filter(e=>e.kind==='recoil').length,count);
  }
});

test('recoil moves the stated distance away from a direct attacker or area center',()=>{
  const target={q:5,r:4},attacker={q:4,r:4},center={q:6,r:4};
  assert.deepEqual(recoilMovement(target,attacker,5).position,{q:6,r:4});
  const area=recoilMovement(target,center,10);
  assert.deepEqual(area.position,{q:3,r:4});assert.equal(area.movedFeet,10);
  assert.deepEqual(target,{q:5,r:4});assert.deepEqual(center,{q:6,r:4});
  for(const [q,r] of [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]){
    const result=recoilMovement(target,{q:target.q-q,r:target.r-r},15);
    assert.deepEqual(result.position,{q:target.q+3*q,r:target.r+3*r});assert.equal(result.movedFeet,15);
  }
  const diagonal=recoilMovement({q:5,r:5},{q:3,r:4},15);
  assert.equal(diagonal.path.length,3);
  const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
  let previous={q:5,r:5};for(const hex of diagonal.path){assert.equal(distance(hex,previous),1);assert.ok(distance(hex,{q:3,r:4})>distance(previous,{q:3,r:4}));previous=hex;}
});

test('recoil stops before blockers, occupied hexes, and map edges without overshooting scale',()=>{
  const target={q:5,r:4},origin={q:4,r:4};
  for(const options of [{terrain:{'7,4':'blocked'}},{occupied:[{q:7,r:4}]}]){
    const move=recoilMovement(target,origin,15,options);assert.deepEqual(move.position,{q:6,r:4});assert.equal(move.movedFeet,5);assert.ok(move.reason);
  }
  const edge=recoilMovement({q:11,r:4},origin,15);assert.deepEqual(edge.position,{q:12,r:4});assert.match(edge.reason,/edge/);
  const small=recoilMovement(target,origin,5,{scale:10});assert.deepEqual(small.position,target);assert.equal(small.movedFeet,0);assert.match(small.reason,/map hex/);
  assert.equal(recoilMovement(target,origin,20,{scale:10}).movedFeet,20);
  assert.equal(recoilMovement(target,origin,10,{terrain:{'6,4':'difficult'}}).movedFeet,10);
});

test('unplaced tokens and foes at the area center require a direction rather than arbitrary movement',()=>{
  const target={q:5,r:4};
  for(const origin of [target,{q:null,r:null},undefined]){
    const move=recoilMovement(target,origin,5);assert.deepEqual(move.position,target);assert.equal(move.movedFeet,0);assert.ok(move.reason);
  }
});
