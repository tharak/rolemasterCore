import {criticalConsequences} from './critical-consequences.js';
import {openEndedD100, parseCriticalSymbols} from './rules.js';
import {automaticInitiative} from './critical-initiative.js';
import {applyCriticalDeath,advanceCriticalDeath} from './critical-death.js';
import {resolveCriticalEquipment} from './critical-equipment.js';
import {normalizedCriticalCell} from './critical-source.js';
import {expireCriticalEffects} from './critical-stun.js';

export const ROUND_LIMIT = 200;
export const attackTypes = {
  Bi:['Bite','A-10.9.7','A-10.10.4'], Cl:['Claw','A-10.9.7','A-10.10.5'],
  Ho:['Horn / tusk','A-10.9.7','A-10.10.4'], Pi:['Beak / pincher','A-10.9.7','A-10.10.5'],
  St:['Stinger','A-10.9.7','A-10.10.4'], Ti:['Tiny attack','A-10.9.7',null],
  Cr:['Crush','A-10.9.7','A-10.10.3'], Ts:['Trample','A-10.9.7','A-10.10.3'],
  Ba:['Bash','A-10.9.8','A-10.10.6'], Gr:['Grapple','A-10.9.8','A-10.10.6'],
  Wp:['Weapon','A-10.9.2','A-10.10.5']
};
export const attackName=attack=>attack.name||attackTypes[attack.type][0];

export function parseCreatureAttack(raw) {
  const text = String(raw || '').replace(/[−–]/g, '-').trim();
  const both = /^Both(\d+)$/.exec(text);
  if (both) return {both:true, chance:Number(both[1]), raw};
  const match = /^(-?\d+)([SMLH]?)(Bi|Cl|Ho|Pi|St|Ti|Cr|Ts|Ba|Gr|Wp)\s*(\d+|«|√|opt)?$/.exec(text);
  if (!match) return null; // Group and swarm attacks require multiple creatures.
  return {ob:Number(match[1]), size:match[2] || 'T', type:match[3],
    chance:/^\d+$/.test(match[4] || '') ? Number(match[4]) : 0,
    follow:match[4] === '«' ? 'same' : match[4] === '√' ? 'next' : null,
    optional:match[4] === 'opt', raw};
}

export function creatureCatalog(data) {
  return [['monster_statistics_chart','Monster'],['animal_statistics_chart','Animal']].flatMap(([key,group]) =>
    (data[key] || []).map((row,index) => ({...row, id:`${group.toLowerCase()}-${index}`, group,
      db:Number.parseInt(row.defensive_bonus,10) || 0,
      attacks:[row.primary_attack,row.secondary_attack,row.tertiary_attack].map(parseCreatureAttack)})));
}

const range = raw => {
  if (raw.endsWith('+')) return [Number.parseInt(raw,10),Infinity];
  const [low,high] = raw.split('-');
  return [low === 'XX' ? -Infinity : Number(low), Number(high || low)];
};
const inRange = (raw,value) => { const [low,high] = range(raw); return value >= low && value <= high; };

export function attackLookup(table, modified, first, armor, size) {
  const column = table.columns.findIndex(column => column.label === `AT ${armor}`);
  if (column < 0) throw new Error(`No armor column for AT ${armor}`);
  let row = table.rows.find(row => row.unmodified && inRange(row.roll,first));
  if (!row) {
    const rows = table.rows.filter(row => !row.unmodified);
    const sizeName = {T:'Tiny',S:'Small',M:'Medium',L:'Large',H:'Huge'}[size];
    const capRow = rows.find(row => row.section?.includes(`for ${sizeName} Attacks`));
    const upper = capRow ? range(capRow.roll)[1] : Math.max(...rows.map(row => range(row.roll)[1]));
    const lower = Math.min(...rows.map(row => range(row.roll)[0]));
    const lookup = Math.max(lower,Math.min(upper,modified));
    row = rows.find(row => inRange(row.roll,lookup));
  }
  if (!row) throw new Error(`No attack result for ${modified}`);
  const result = row.values[column];
  return {result,hits:Number.parseInt(result,10) || 0,critical:/[A-E]/.exec(result)?.[0] || null};
}

export function chooseAttacks(creature, roll) {
  const choices = creature.attacks.map((attack,index) => ({attack,index})).filter(({attack}) => attack?.chance > 0);
  const total = choices.reduce((sum,{attack}) => sum + attack.chance,0);
  let cursor = (roll - 1) / 100 * total;
  for (const {attack,index} of choices) {
    cursor -= attack.chance;
    if (cursor < 0) return attack.both ? [0,1].filter(i => creature.attacks[i] && !creature.attacks[i].both) : [index];
  }
  const fallback = creature.attacks.findIndex(attack => attack && !attack.both);
  return fallback < 0 ? [] : [fallback];
}

export function createFight(left,right) {
  if (![left,right].every(creature => creature?.hits > 0 && creature.attacks.some(attack => attack && !attack.both))) throw new Error('Choose two contenders with hits and attacks.');
  return {round:0,finished:false,winner:null,log:[],fighters:[left,right].map(creature =>
    ({creature,hits:0,effects:[],pending:[]}))};
}

const active = (fighter,round) => fighter.effects.filter(effect => effect.starts <= round);
const unable = (fighter,round) => active(fighter,round).some(effect => ['stun','stunNoParry','downOrOut','noParry','mustParry'].includes(effect.kind));
const modifier = (fighter,round) => active(fighter,round).reduce((total,effect) => total + (effect.kind === 'bonus' ? effect.amount : effect.kind === 'penalty' ? -effect.amount : 0),0);
const standing = fighter => fighter.hits < fighter.creature.hits;
function finish(fight, checkLimit = true) {
  const survivors = fight.fighters.map((fighter,index) => standing(fighter) ? index : null).filter(index => index !== null);
  if (survivors.length < 2 || checkLimit && fight.round >= ROUND_LIMIT) {
    fight.finished = true;
    fight.winner = survivors.length === 1 ? survivors[0] : null;
  }
}

export function resolveCritical(target,attacker,attack,severity,tables,d100,round,{allies,persistentConsequences=false}={}) {
  let code = attack.criticalTable||attackTypes[attack.type][2], column = severity.charCodeAt(0) - 65;
  const large = target.creature.size === 'L*', huge = target.creature.size === 'H*';
  if (!code || large && severity === 'A' || huge && severity <= 'C') return {ignored:true,severity};
  let roll = d100();
  if (large || huge) {
    code = huge ? 'A-10.10.8' : 'A-10.10.7'; column = 0;
    let next = roll;
    while (next >= 96) { next = d100(); roll += next; }
  }
  const table = tables[code];
  if (!table) throw new Error(`Missing critical table ${code}`);
  const cell = normalizedCriticalCell(table.rows.find(row => inRange(row.roll,roll))?.cells[column]);
  if (!cell) throw new Error(`No critical result for ${code} roll ${roll}`);
  // Equipment-dependent branches need GM interpretation; never combine both outcomes.
  const selected=resolveCriticalEquipment(cell.description,cell.effect,target.creature.equipment||{});
  const conditional=selected.unresolved;
  let experienceHits=0;
  const recoils=[];
  const manualEffects=[];
  for (const effect of parseCriticalSymbols(selected.effect,selected.description)) {
    if(effect.kind==='allyBonus'&&allies){for(const ally of allies)ally.effects.push({kind:'bonus',amount:effect.amount,roundsLeft:effect.roundsLeft,starts:round+1});continue;}
    if(effect.kind==='allyBonus'){manualEffects.push(`All allies gain +${effect.amount} for ${effect.roundsLeft} round(s); GM-managed because arena allies are not simulated.`);continue;}
    if(effect.kind==='recoil'){recoils.push(effect.feet);continue;}
    if(effect.kind==='dies'){applyCriticalDeath(target,target.creature.hits,round,effect.roundsLeft);continue;}
    if (effect.kind === 'initiative') { attacker.automaticInitiativeRound=round+1; continue; }
    if (effect.kind === 'hits') {target.hits += effect.amount;experienceHits+=effect.amount;}
    else (effect.kind === 'bonus' ? attacker : target).effects.push({...effect, starts:round+1});
  }
  const consequences=persistentConsequences?criticalConsequences(selected.description,selected.effect):[];
  if(consequences.length){if(consequences.some(c=>c.disabling))target.incapacitated=true;target.consequences=[...(target.consequences||[]),...consequences];if(target.deathRound!==undefined)target.deathRequiresRepair=true;}
  return {...(persistentConsequences?{consequences}:{}),experienceHits,severity,code,roll,description:selected.description,effect:selected.effect,sourceDescription:cell.sourceCorrection?.original.description??cell.description,sourceEffect:cell.sourceCorrection?.original.effect??cell.effect,conditional,equipmentConditions:selected.conditions,recoils,manualEffects};
}

export function stepFight(fight,tables,random = Math.random) {
  if (fight.finished) return fight;
  const automatic=automaticInitiative(fight.fighters,fight.round+1);
  if(automatic?.review) throw new Error(automatic.review);
  const d100 = () => Math.floor(random()*100)+1;
  const d10 = () => Math.floor(random()*10)+1;
  fight.round++;
  for(const fighter of fight.fighters) if(fighter.automaticInitiativeRound<=fight.round) delete fighter.automaticInitiativeRound;
  const entry = {round:fight.round,events:[]};
  for (const [side,fighter] of fight.fighters.entries()) {
    if(advanceCriticalDeath(fighter,fighter.creature.hits,fight.round))entry.events.push({side,kind:'dies',sourceSide:fighter.mortalSource});
    const bleed = active(fighter,fight.round).filter(effect => effect.kind === 'bleed').reduce((sum,effect) => sum+effect.amount,0);
    if (bleed&&!fighter.dead) { fighter.hits += bleed; entry.events.push({side,kind:'bleed',hits:bleed,defeated:!standing(fighter),sourceSide:1-side}); }
  }
  finish(fight,false);
  // AQ determines the speed adjustment; the arena adds 2d10 each round.
  const speeds = {CR:-8,VS:-6,SL:-4,MD:0,MF:2,FA:4,VF:6,BF:8};
  const order = automatic ? [automatic.winner,1-automatic.winner].map(side=>({side,total:null,automatic:side===automatic.winner,noRoll:true})) : fight.fighters.map((fighter,side) => ({side,total:d10()+d10()+(fighter.creature.initiativeBonus??speeds[fighter.creature.speed_ms_aq?.split('/')[1]]??0)+modifier(fighter,fight.round), tie:random()}))
    .sort((a,b) => automatic ? 0 : b.total-a.total || a.tie-b.tie);
  entry.initiative = order;
  if (!fight.finished) for (const {side} of order) {
    const fighter = fight.fighters[side], target = fight.fighters[1-side];
    if (!standing(fighter) || !standing(target)) break;
    if (unable(fighter,fight.round)) { fighter.pending=[]; entry.events.push({side,kind:'stun'}); continue; }
    const attacks = fighter.pending.length ? [...fighter.pending] : chooseAttacks(fighter.creature,d100());
    fighter.pending=[];
    const used = new Set();
    for (const index of attacks) {
      if (used.has(index) || !standing(target)) continue;
      used.add(index);
      const attack = fighter.creature.attacks[index];
      const code = attack.attackTable||attackTypes[attack.type][1], table = tables[code];
      if (!table) throw new Error(`Missing attack table ${code}`);
      const roll = openEndedD100(d100);
      const penalty = modifier(fighter,fight.round);
      const total = roll.total + attack.ob - target.creature.db + penalty;
      const result = attackLookup(table,total,roll.first,target.creature.armor_type,attack.size);
      const previousDamage=target.hits;
      const targetState=target.dead||target.deathRound!==undefined?'dying':active(target,fight.round).some(e=>e.kind==='downOrOut')?'down':active(target,fight.round).some(e=>['stun','stunNoParry'].includes(e.kind))?'stunned':'active';
      const wasMortal=target.dead||target.deathRound!==undefined;
      target.hits += result.hits;
      const critical = result.critical ? resolveCritical(target,fighter,attack,result.critical,tables,d100,fight.round) : null;
      if(!wasMortal&&(target.dead||target.deathRound!==undefined))target.mortalSource=side;
      entry.events.push({side,kind:'attack',attack:attackName(attack),ob:attack.ob,db:target.creature.db,modifier:penalty,roll,total,code,...result,critical,damage:target.hits-previousDamage,experienceHits:result.hits+(critical?.experienceHits||0),targetState,melee:!['Weapon • Missile','Weapon • Missile Artillery','Weapon • Thrown'].includes(attack.category),defeated:!standing(target),mortal:!wasMortal&&(!!target.dead||target.deathRound!==undefined)});
      if (result.critical && attack.type !== 'Ti') {
        const next = fighter.creature.attacks[index+1];
        if (next?.follow === 'same') attacks.push(index+1);
        if (next?.follow === 'next') fighter.pending.push(index+1);
      }
    }
  }
  // Stun rounds accumulate and expire one at a time; other timed effects expire together.
  for (const fighter of fight.fighters) {
    fighter.effects=expireCriticalEffects(fighter.effects,fight.round,'starts');
  }
  fight.log.unshift(entry);
  finish(fight);
  return fight;
}
