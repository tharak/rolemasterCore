import {criticalDurationFields} from './critical-duration.js';
import {hasCriticalInitiative} from './critical-initiative.js';
import {criticalDeath} from './critical-death.js';
import {criticalRecoils} from './critical-recoil.js';
import {installRustComponents} from './rust-components.js';
// Shared synchronous rules; browser startup awaits the optional Rust engine.
let rustRankBonus = null;
let rustRankCost = null;
let rustBasicStatBonus = null;
let statBonusCalls = 0;
export function basicStatBonusEngineStatus() { return {backend:rustBasicStatBonus ? 'wasm' : 'javascript', calls:statBonusCalls}; }
// Non-number inputs retain the original strict === 100 and coercion behavior.
export function basicStatBonus(value) {
  if (rustBasicStatBonus && typeof value === 'number') {
    statBonusCalls++;
    return rustBasicStatBonus(value);
  }
  return basicStatBonusJavaScript(value);
}
export function basicStatBonusJavaScript(value) {
  if (value === 100) return 10;
  if (value >= 90) return 5 + Math.floor((value - 90) / 2);
  if (value >= 70) return 1 + Math.floor((value - 70) / 5);
  if (value >= 31) return 0;
  if (value >= 11) return -1 - Math.floor((30 - value) / 5);
  return -5 - Math.floor((10 - value) / 2);
}
let costCalls = 0;
export function rankCostEngineStatus() { return {backend:rustRankCost ? 'wasm' : 'javascript', calls:costCalls}; }
let initialization;
let engine = Object.freeze({backend:'javascript', reason:'not initialized', calls:0});
export function rankBonusEngineStatus() { return {...engine}; }
export function initializeRankBonusEngine({load = async () => { throw new Error('Supply a Wasm loader to enable acceleration'); }, timeoutMs = 8000} = {}) {
  if (initialization) return initialization;
  initialization = (async () => {
    let timer;
    try {
      const binding = await Promise.race([
        (async () => { const module = await load(); await module.default(); return module; })(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Wasm initialization timed out')), timeoutMs); }),
      ]);
      if (binding.rank_bonus_wasm(21, 'combined') !== 82) throw new Error('Wasm self-check failed');
      if (binding.rank_cost_wasm(new Float64Array([2, 4, 6]), 2.9) !== 6) throw new Error('Wasm rank cost self-check failed');
      if (binding.basic_stat_bonus_wasm(100) !== 10 || binding.basic_stat_bonus_wasm(99) !== 9) throw new Error('Wasm basic stat bonus self-check failed');
      installRustComponents(binding);
      rustRankBonus = binding.rank_bonus_wasm;
      rustRankCost = binding.rank_cost_wasm;
      rustBasicStatBonus = binding.basic_stat_bonus_wasm;
      engine = {backend:'wasm', reason:null, calls:0};
    } catch (error) {
      engine = {backend:'javascript', reason:String(error?.message || error), calls:0};
      console.warn('Rust rules unavailable; using JavaScript fallback.', error);
    } finally { clearTimeout(timer); }
    return rankBonusEngineStatus();
  })();
  return initialization;
}
export function rankBonus(ranks, progression) {
  if (!rustRankBonus) return rankBonusJavaScript(ranks, progression);
  engine.calls++;
  // Preserve Number coercion and strict string matching from the original API.
  return rustRankBonus(Number(ranks), typeof progression === 'string' ? progression : 'standard');
}
export function rankBonusJavaScript(ranks, progression) {
  const n = Math.max(0, Number(ranks) || 0);
  const rounded = value => Math.floor(value + 0.5);
  if (progression === 'category') return n ? rounded(2 * Math.min(n, 10) + Math.min(Math.max(n - 10, 0), 10) + .5 * Math.min(Math.max(n - 20, 0), 10)) : -15;
  if (progression === 'limited') return rounded(Math.min(n, 20) + .5 * Math.min(Math.max(n - 20, 0), 10));
  if (progression === 'special') return 6 * Math.min(n, 10) + 5 * Math.min(Math.max(n - 10, 0), 10) + 4 * Math.min(Math.max(n - 20, 0), 10) + 3 * Math.max(n - 30, 0);
  if (progression === 'combined') return n ? rounded(5 * Math.min(n, 10) + 3 * Math.min(Math.max(n - 10, 0), 10) + 1.5 * Math.min(Math.max(n - 20, 0), 10) + .5 * Math.max(n - 30, 0)) : -30;
  return n ? rounded(3 * Math.min(n, 10) + 2 * Math.min(Math.max(n - 10, 0), 10) + Math.min(Math.max(n - 20, 0), 10) + .5 * Math.max(n - 30, 0)) : -15;
}

export function rankCost(costs, ranks) {
  // Preserve legacy behavior for sparse/mixed arrays and unusual array-like inputs.
  // Only ordinary dense numeric arrays are the Rust boundary contract.
  if (rustRankCost && Array.isArray(costs) && Object.getPrototypeOf(costs) === Array.prototype) {
    let numeric = true;
    for (let i = 0; i < costs.length; i++) {
      const slot = Object.getOwnPropertyDescriptor(costs, i);
      if (!slot || !('value' in slot) || typeof slot.value !== 'number') { numeric = false; break; }
    }
    if (numeric) {
      const n = Number(ranks);
      const result = rustRankCost(new Float64Array(costs), n);
      costCalls++;
      return result;
    }
  }
  return rankCostJavaScript(costs, ranks);
}
export function rankCostJavaScript(costs, ranks) {
  return (costs || []).slice(0, Math.max(0, Number(ranks) || 0)).reduce((sum, value) => sum + value, 0);
}

export function openEndedD100(rollD100, unmodifiedExceptions = false) {
  const first = rollD100(), dice = [first];
  if (unmodifiedExceptions && (first === 66 || first === 100)) return {first, dice, total:first, unmodified:true};
  if (first <= 5) { let next; do { next = rollD100(); dice.push(-next); } while (next >= 96); }
  else if (first >= 96) { let next; do { next = rollD100(); dice.push(next); } while (next >= 96); }
  return {first, dice, total:dice.reduce((sum, value) => sum + value, 0), unmodified:false};
}

export function parseCriticalSymbols(raw, description = '') {
  const context = description + '. ' + String(raw || '');
  const effects = []; let rest = String(raw || '');
  const take = (pattern, handler) => { rest = rest.replace(pattern, (...match) => { handler(...match); return ' '; }); };
  take(/\ball allies get\s+\(?\+(\d+)\)?(?:\s+for\s+(\d+)\s+rounds?)?/gi,(_,amount,rounds)=>effects.push({kind:'allyBonus',amount:Number(amount),roundsLeft:Number(rounds)||1}));
  take(/\+(\d*)H\b/g, (_, amount) => effects.push({kind:'hits', amount:amount===''?1:Number(amount)}));
  take(/(\d*)∑∏/g, (_, rounds) => effects.push({kind:'stunNoParry', ...criticalDurationFields(rounds,'stunNoParry',context)}));
  take(/(\d*)\(\s*(\d*)π\s*(?:[-−–]\s*(\d+))?\s*\)/g, (_, outer, inner, penalty) => effects.push({kind:'mustParry', ...criticalDurationFields(outer || inner,'mustParry',context), amount:Number(penalty)||0}));
  take(/(\d*)π\s*\(\s*[-−–]\s*(\d+)\s*\)/g, (_, rounds, penalty) => effects.push({kind:'mustParry', ...criticalDurationFields(rounds,'mustParry',context), amount:Number(penalty)}));
  take(/(\d*)∑/g, (_, rounds) => effects.push({kind:'stun', ...criticalDurationFields(rounds,'stun',context)}));
  take(/(\d*)∏/g, (_, rounds) => effects.push({kind:'noParry', ...criticalDurationFields(rounds,'noParry',context)}));
  take(/(\d*)π/g, (_, rounds) => effects.push({kind:'mustParry', ...criticalDurationFields(rounds,'mustParry',context), amount:0}));
  take(/(\d*\s*)∫/g, (_, amount) => effects.push({kind:'bleed', amount:Number(amount) || 1, roundsLeft:null}));
  take(/(\d*)\(\s*[-−–]\s*(\d+)\s*\)/g, (_, rounds, amount) => effects.push({kind:'penalty', amount:Number(amount), ...criticalDurationFields(rounds,'penalty',context)}));
  take(/(\d*)\(\s*\+\s*(\d+)\s*\)/g, (_, rounds, amount) => effects.push({kind:'bonus', amount:Number(amount), ...criticalDurationFields(rounds,'bonus',context)}));
  const death=criticalDeath(description+' '+String(raw||''));
  if(death&&!death.conditional&&!death.inactive&&!death.manual)effects.push({kind:'dies',roundsLeft:death.rounds});
  if (hasCriticalInitiative(raw,description)) effects.push({kind:'initiative',nextRound:true});
  effects.push(...criticalRecoils(description+' '+String(raw||'')));
  return effects;
}

export function rollD10() { return Math.floor(Math.random() * 10) + 1; }
export function rollD100() { return Math.floor(Math.random() * 100) + 1; }
export function rollOpenEndedD10() {
  const rolls = [];
  let roll;
  do { roll = rollD10(); rolls.push(roll); } while (roll === 10);
  return {rolls, total:rolls.reduce((sum, value) => sum + (value === 10 ? 9 : value), 0)};
}
export function formatRolls(rolls) {
  return (rolls || []).map((value, index) => index === 0 ? String(value) : value < 0 ? ` − ${-value}` : ` + ${value}`).join('');
}
