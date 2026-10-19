import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROUND_LIMIT,parseCreatureAttack,creatureCatalog,attackLookup,chooseAttacks,createFight,stepFight} from '../src/coliseum-rules.js';

const read = name => JSON.parse(readFileSync(new URL(`./fixtures/tables/${name}.json`,import.meta.url)));
const catalog = creatureCatalog(read('creatures'));
const tables = Object.fromEntries(['A-10.9.2','A-10.9.7','A-10.9.8',...Array.from({length:6},(_,i) => `A-10.10.${i+3}`)].map(code => [code,read(code)]));
const wolf = catalog.find(creature => creature.name === 'Wolf');
const tiger = catalog.find(creature => creature.name === 'Tiger');
const seeded = (seed = 21) => () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed / 4294967296; };

test('all 130 creature entries have usable primary attacks and combat statistics',() => {
  assert.equal(catalog.length,130);
  assert.equal(new Set(catalog.map(creature => creature.id)).size,130);
  for (const creature of catalog) {
    assert.ok(creature.attacks[0],creature.name);
    assert.ok(creature.hits > 0);
    assert.ok(creature.armor_type >= 1 && creature.armor_type <= 20);
    assert.ok(Number.isFinite(creature.db));
  }
});

test('playback damage includes extra critical hits and instant death without changing base hits',()=>{
  const creature={...wolf,hits:100,armor_type:1,db:0,attacks:[parseCreatureAttack('100LBi100')]};
  for(const [description,effect,expected] of [['Impact.','+7H',12],['Foe dies instantly.','+0H',100]]){
    const fight=createFight(creature,creature);
    const fixture={...tables,'A-10.9.7':{columns:[{label:'AT 1'}],rows:[{roll:'01-150',values:['5A']}]},'A-10.10.4':{rows:[{roll:'01-100',cells:[{description,effect}]}]}};
    stepFight(fight,fixture,()=>.49);
    const attack=fight.log[0].events.find(event=>event.kind==='attack');
    assert.equal(attack.hits,5);
    assert.equal(attack.damage,expected);
    assert.equal(fight.fighters[1-attack.side].hits,expected);
  }
});

test('attack notation preserves size, OB, chance, and conditional follow-ups',() => {
  assert.deepEqual(parseCreatureAttack('−50Ti100'),{ob:-50,size:'T',type:'Ti',chance:100,follow:null,optional:false,raw:'−50Ti100'});
  assert.equal(parseCreatureAttack('70LGr «').follow,'same');
  assert.equal(parseCreatureAttack('60Wp √').follow,'next');
  assert.equal(parseCreatureAttack('30Wp opt').optional,true);
  assert.deepEqual(parseCreatureAttack('Both35'),{both:true,chance:35,raw:'Both35'});
  assert.equal(parseCreatureAttack('Swarm–20SSt'),null);
  assert.equal(parseCreatureAttack('3 or more–20MCl'),null);
});

test('percentage choices and Both entries choose the corresponding attacks',() => {
  const creature = {attacks:['70LCl40','60LBi40','Both20'].map(parseCreatureAttack)};
  assert.deepEqual(chooseAttacks(creature,1),[0]);
  assert.deepEqual(chooseAttacks(creature,40),[0]);
  assert.deepEqual(chooseAttacks(creature,41),[1]);
  assert.deepEqual(chooseAttacks(creature,80),[1]);
  assert.deepEqual(chooseAttacks(creature,81),[0,1]);
  assert.deepEqual(chooseAttacks(creature,100),[0,1]);
});

test('natural attack sizes cap the actual table result; fumbles stay unmodified',() => {
  const table = tables['A-10.9.7'];
  for (const [size,limit] of [['T',81],['S',105],['M',120],['L',135],['H',150]]) {
    assert.deepEqual(attackLookup(table,900,50,1,size),attackLookup(table,limit,50,1,size));
  }
  assert.equal(attackLookup(table,900,1,1,'H').result,'F');
  assert.equal(attackLookup(table,-50,50,20,'L').hits,0);
});

test('large and super-large creatures ignore insufficient critical severity',() => {
  // At AT 1 and a modified result of 83, a huge bite delivers an A critical.
  const attack = parseCreatureAttack('33HBi100');
  for (const size of ['L*','H*']) {
    const target = {...wolf,size,armor_type:1,db:0,hits:10000};
    const attacker = {...wolf,hits:10000,attacks:[attack,null,null]};
    const fight = createFight(attacker,target);
    stepFight(fight,tables,() => .49);
    const event = fight.log[0].events.find(event => event.kind === 'attack' && event.side === 0);
    assert.equal(event.critical.severity,'A');
    assert.equal(event.critical.ignored,true);
  }
});

test('bleeding starts next round and simultaneous defeat is a draw',() => {
  const fight = createFight(wolf,tiger);
  fight.fighters.forEach(fighter => {
    fighter.hits = fighter.creature.hits-1;
    fighter.effects.push({kind:'bleed',amount:1,roundsLeft:null,starts:2});
    fighter.effects.push({kind:'stun',roundsLeft:5,starts:1});
  });
  stepFight(fight,tables,seeded());
  assert.equal(fight.finished,false);
  assert.equal(fight.log[0].events.filter(event => event.kind === 'bleed').length,0);
  stepFight(fight,tables,seeded());
  assert.equal(fight.finished,true);
  assert.equal(fight.winner,null);
  assert.equal(fight.log[0].events.filter(event => event.kind === 'bleed').length,2);
});

test('same-round and next-round follow-ups respect creature attack notation',() => {
  for (const [marker,expected] of [['«',2],['√',1]]) {
    const attacker = {...wolf,hits:10000,attacks:['200HBi100',`20MCl ${marker}`,null].map(parseCreatureAttack)};
    const target = {...wolf,hits:10000,db:0,armor_type:1};
    const fight = createFight(attacker,target);
    stepFight(fight,tables,() => .49);
    assert.equal(fight.log[0].events.filter(event => event.side === 0 && event.kind === 'attack').length,expected);
    if (marker === '√') assert.deepEqual(fight.fighters[0].pending,[1]);
  }
});

test('seeded fights are reproducible and completed fights cannot advance',() => {
  const first = createFight(wolf,tiger), second = createFight(wolf,tiger);
  const a = seeded(), b = seeded();
  while (!first.finished) stepFight(first,tables,a);
  while (!second.finished) stepFight(second,tables,b);
  assert.deepEqual(first,second);
  const round = first.round;
  stepFight(first,tables,a);
  assert.equal(first.round,round);
  assert.ok(round <= ROUND_LIMIT);
});

test('every creature can complete an arena duel without invalid state',() => {
  for (const [index,creature] of catalog.entries()) {
    const fight = createFight(creature,catalog[(index+17)%catalog.length]);
    const random = seeded(index+1);
    while (!fight.finished) stepFight(fight,tables,random);
    assert.ok(fight.round <= ROUND_LIMIT,creature.name);
    assert.ok(fight.fighters.every(fighter => Number.isFinite(fighter.hits)),creature.name);
  }
});

test('round limit produces a draw and stun time is cumulative',() => {
  const fight = createFight(wolf,wolf);
  fight.fighters.forEach(fighter => {
    fighter.creature = {...fighter.creature,db:1000};
    fighter.effects.push({kind:'stun',roundsLeft:2,starts:1},{kind:'stunNoParry',roundsLeft:2,starts:1});
  });
  stepFight(fight,tables,() => .49);
  assert.deepEqual(fight.fighters[0].effects.map(effect => effect.roundsLeft),[2,1]);
  while (!fight.finished) stepFight(fight,tables,() => .49);
  assert.equal(fight.round,ROUND_LIMIT);
  assert.equal(fight.winner,null);
});
