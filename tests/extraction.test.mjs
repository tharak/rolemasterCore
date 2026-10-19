import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulateGuildBattle,seededRandom,supportBonus,attackElement} from '../src/index.js';
const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name,import.meta.url)));
const tables=Object.fromEntries(readdirSync(new URL('./fixtures/tables/',import.meta.url)).filter(n=>n.startsWith('A-10.')).map(n=>[n.slice(0,-5),fixture('tables/'+n)]));
for(const scenario of fixture('combat-parity.json'))test('pre-extraction combat parity: '+scenario.seed,()=>{
 const result=simulateGuildBattle(scenario.party,scenario.enemies,tables,seededRandom(scenario.seed),structuredClone(scenario.options));
 assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'),scenario.expected);
});
test('all engine entrypoints import without browser globals or host files',async()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
 for(const target of Object.values(pkg.exports)){
  const file=new URL('../'+target,import.meta.url),source=readFileSync(file,'utf8');
  assert.doesNotMatch(source,/\b(?:document|window|localStorage|sessionStorage)\s*[.[]|from ['"][^'"]*\/(?:ludus|arena|dom|ui)[.-]/);
  await import(file.href);
 }
});
test('caller supplied geometry and element rules control support without Ludus dependencies',()=>{
 const unit={id:'a',x:10,supportEffects:[{group:'prayer',db:10,until:20,range:5}]};
 assert.equal(supportBonus(unit,[unit],[],0,'db',null,{attendantX:10}),10);
 assert.equal(supportBonus(unit,[unit],[],0,'db',null,{attendantX:0}),0);
 assert.equal(attackElement({name:'Solar ray'},{elementNames:{heat:'solar'}}),'heat');
 assert.equal(attackElement({element:'cold'}),'cold');
});
