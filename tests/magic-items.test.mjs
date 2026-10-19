import test from 'node:test';import assert from 'node:assert/strict';
import {magicPrice,createMagicItem,useMagicItem,rechargeMagicItem,useBonusItem} from '../src/magic-item-rules.js';
test('T-5.3 worked examples and unsupported levels',()=>{
 for(const [v,expected] of [[{kind:'Staff',level:6,normal:.005},500.005],[{kind:'Rod',level:4,normal:.003},180.003],[{kind:'Wand',level:2,normal:.001},40.001],[{kind:'Wand',level:2,normal:.001,channeling:true},80.002],[{kind:'Daily',level:4,normal:.3,uses:2},245.3],[{kind:'Daily',level:4,normal:2,uses:2,form:'Ring'},492],[{kind:'Potion',level:6},100],[{kind:'Bonus',normal:.5,bonus:15},125]])assert.equal(magicPrice(v).priceGp,expected);
 assert.throws(()=>magicPrice({kind:'Wand',level:3}));assert.throws(()=>magicPrice({kind:'Bonus',weight:39}));
});
test('consumables, daily refresh and charge exhaustion enforce prerequisites',()=>{
 let item=createMagicItem({kind:'Wand',level:2});assert.throws(()=>useMagicItem(item,{day:'1'}));for(let i=0;i<10;i++)item=useMagicItem(item,{day:'1',attuned:true});assert.throws(()=>useMagicItem(item,{day:'2',keyed:true}));assert.equal(rechargeMagicItem(item).remaining,10);
 let daily=createMagicItem({kind:'Daily',level:4,uses:2});daily=useMagicItem(daily,{day:'1',keyed:true});daily=useMagicItem(daily,{day:'1',keyed:true});assert.throws(()=>useMagicItem(daily,{day:'1',keyed:true}));assert.equal(useMagicItem(daily,{day:'2',keyed:true}).remaining,1);
 assert.equal(useMagicItem(createMagicItem({kind:'Potion'}),{day:'1'}).remaining,0);
});
test('one bonus item per rest and adder spell limit',()=>{const v={owner:'Mira',item:'Oak',kind:'Adder',count:1,held:true,restedWith:true,known:true};const state=useBonusItem({},v);assert.throws(()=>useBonusItem(state,v));assert.throws(()=>useBonusItem(state,{...v,item:'Ash',kind:'Multiplier'}));assert.equal(useBonusItem({},{...v,kind:'Multiplier',count:3,basePp:12}).Mira.powerPoints,36);});
