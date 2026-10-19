// Normalize existing audited JS rules into a versioned, language-neutral data pack.
// No PDF is needed to reproduce this artifact.
import fs from 'node:fs';
import {normalizedCriticalCell} from '../src/critical-source.js';
import {resolveCriticalEquipment, hasEquipment} from '../src/critical-equipment.js';
import {parseCriticalSymbols} from '../src/rules.js';
import {criticalConsequences} from '../src/critical-consequences.js';
import {attackLookup} from '../src/coliseum-rules.js';
const read=code=>JSON.parse(fs.readFileSync(new URL(`../tests/fixtures/tables/${code}.json`,import.meta.url)));
const range=s=>{const [a,b]=s.split('-');return [a==='XX'?-10000:parseInt(a),s.endsWith('+')?10000:parseInt(b||a)];};
const attacks={},criticals={},parity=[];
for(const n of [1,2,3,4,5,6,9]){
 const code=`A-10.9.${n}`,table=read(code);
 attacks[code]=table.rows.map(r=>({range:range(r.roll),unmodified:r.unmodified,values:r.values}));
 for(const armor of [1,6,10,16,20])for(const total of [-50,33,50,66,80,100,120,150,250])for(const first of [1,50,100]){
  parity.push({code,armor,total,first,expected:attackLookup(table,total,first,armor,'M').result});
 }
}
for(const n of [1,2,3,4,5,6]){
 const code=`A-10.10.${n}`,table=read(code);
 criticals[code]=table.rows.map(r=>({range:range(r.roll),cells:r.cells.map(raw=>{
  const cell=normalizedCriticalCell(raw), initial=resolveCriticalEquipment(cell.description,cell.effect,{});
  const keys=initial.conditions;
  const variants=[];
  for(let mask=0;mask<2**keys.length;mask++){
   const equipment=Object.fromEntries(keys.map((key,i)=>[key,!!(mask&(1<<i))]));
   const selected=resolveCriticalEquipment(cell.description,cell.effect,equipment);
   const effects=parseCriticalSymbols(selected.effect,selected.description);
   variants.push({mask:keys.reduce((m,k,i)=>m|(hasEquipment(equipment,k)?1<<i:0),0),description:selected.description,effect:selected.effect,effects,disabling:criticalConsequences(selected.description,selected.effect).some(e=>e.disabling),review:selected.unresolvedMechanics});
  }
  return {keys,variants};
 })}));
}
const basic=read("A-10.9.11").rows.filter(r=>r.roll.includes("-")||r.unmodified).map(r=>({range:range(r.roll),unmodified:r.unmodified,values:r.values}));
const textRows=code=>read(code).rows.map(r=>({range:range(r.roll),cells:r.cells.map(c=>c.description)}));
const pack={weapon_fumbles:textRows("A-10.11.1"),spell_failures:textRows("A-10.11.2"),basic,version:1,source:'Rolemaster Fantasy Role Playing Core Rules; audited fieldbook extraction',attacks,criticals};
fs.writeFileSync(new URL('../data/tactical-v1.json',import.meta.url),JSON.stringify(pack));
fs.writeFileSync(new URL('../rust/crates/rolemaster-tactical/tests/attack-parity.json',import.meta.url),JSON.stringify(parity));
console.log(`Wrote ${parity.length} JS attack parity cases and normalized combat data.`);
