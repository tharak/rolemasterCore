// Character calculations independent of the editable sheet.
import {xpThresholds, specialSkillClasses} from './app-data.js';
import {rollD10} from './rules.js';

export function statCost(value) { return value <= 90 ? value : 90 + (value - 90) ** 2; }
export function fixedPotential(value) {
  const bands = [[24,44],[34,39],[44,33],[54,28],[64,22],[74,17],[84,11],[91,6],[92,5],[94,4],[96,3],[98,2],[100,1]];
  return Math.min(101, value + bands.find(([high]) => value <= high)[1]);
}
export function rolledPotential(value, random = Math.random) {
  const bands = [[24,20,8],[34,30,7],[44,40,6],[54,50,5],[64,60,4],[74,70,3],[84,80,2],[91,90,1]];
  const band = bands.find(([high]) => value <= high);
  const [base, dice, sides] = band ? [band[1], band[2], 10] : [value - 1, 1, value === 100 ? 2 : 101 - value];
  const result = base + Array.from({length: dice}, () => Math.floor(random() * sides) + 1).reduce((sum, roll) => sum + roll, 0);
  return Math.max(value, result);
}
// Preserve the existing import API used by stat-sheet.js.
export {basicStatBonus} from './rules.js';
export function strideBonus(heightText) {
  const match = /^(\d+)'\s*(\d{1,2})(?:")?$/.exec(heightText.trim());
  if (!match) return null;
  const inches = Number(match[1]) * 12 + Number(match[2]);
  if (Number(match[2]) >= 12 || inches < 22 || inches > 99) return null;
  return [[94,20],[88,15],[82,10],[76,5],[70,0],[64,-5],[58,-10],[52,-15],[46,-20],[40,-25],[34,-30],[28,-35],[22,-40]].find(([minimum]) => inches >= minimum)[1];
}
export function xpForLevel(level) { return level <= 20 ? xpThresholds[Math.max(1, level)] : 500000 + (level - 20) * 50000; }
export function levelForXp(xp) {
  const total = Math.max(0, Math.trunc(Number(xp) || 0));
  if (total >= 500000) return 20 + Math.floor((total - 500000) / 50000);
  for (let level = 19; level >= 2; level--) if (total >= xpThresholds[level]) return level;
  return 1;
}
export function rollStatGain(before, potential, roll = rollD10) {
  const dice = [roll(), roll()];
  const [first, second] = dice;
  const difference = potential - before;
  const change = first === second && first <= 5 ? -first
    : first === second ? first + second
    : difference <= 0 ? 0 : difference <= 10 ? Math.min(first, second)
    : difference <= 20 ? Math.max(first, second) : first + second;
  return {dice, after:Math.max(1, Math.min(potential, before + change))};
}
export function trainingSpecialAwards(pack, special = {}) {
  const last = pack.specialItems.length - 1;
  if (last < 0 || !special || typeof special !== 'object') return [];
  if (special.mode === 'last') return [last];
  if (special.mode !== 'rolled') return [];
  const awards = (Array.isArray(special.rows) ? special.rows : []).flatMap((row, index) => row?.gained && index <= last ? [index] : []);
  if (!awards.length || special.grantLast) awards.push(last);
  return [...new Set(awards)];
}
export function categoryGroup(category) { return category.includes(' • ') ? category.split(' • ')[0] : ''; }

export function classifySkill({name, race, profession, override}) {
  if (override && override !== 'auto') return override;
  const matches = entry => entry === name || (entry === 'Divination' && name.startsWith('Divination ('));
  const classes = [specialSkillClasses[race], specialSkillClasses[profession]];
  if (classes.some(group => group?.occupational?.some(matches))) return 'occupational';
  if (classes.some(group => group?.restricted?.some(matches))) return 'restricted';
  if (classes.some(group => group?.everyman?.some(matches))) return 'everyman';
  if (race === 'Wood Elf' && (name.startsWith('Play Instrument') || name.startsWith('Wood-crafts'))) return 'everyman';
  if (race === 'Dwarf' && name.startsWith('Survival (underground')) return 'everyman';
  if (race === 'Halfling' && name.startsWith('Caving (Halfling-holes')) return 'everyman';
  if (profession === 'Fighter' && name.startsWith('Situational Awareness') && name.includes('Combat')) return 'everyman';
  return 'standard';
}

export function developedRanks(buy, kind) {
  return kind === 'occupational' ? buy * 3 : kind === 'everyman' ? buy * 2 : kind === 'restricted' ? Math.floor(buy / 2) : buy;
}

export function spellListCostsFor({category, start, profession, multiplier = 1, baseCosts}) {
  if (!category.startsWith('Spells • Own Realm')) return baseCosts;
  const pure = ['Cleric','Magician','Mentalist'].includes(profession);
  const semi = ['Ranger','Dabbler','Bard'].includes(profession);
  const kind = category.includes('Open Lists') ? 'open' : category.includes('Closed Lists') ? 'closed' : 'base';
  const tier = rank => {
    if (kind === 'base') return baseCosts;
    if (rank <= 5) return baseCosts;
    const band = rank <= 10 ? 0 : rank <= 15 ? 1 : rank <= 20 ? 2 : 3;
    if (pure) return kind === 'open' ? (band === 3 ? [6,6,6] : [4,4,4]) : (band === 3 ? [8,8] : [4,4,4]);
    if (semi) return kind === 'open' ? [[8,8],[12],[18],[25]][band] : [[12],[25],[40],[60]][band];
    const costs = kind === 'open' ? {Fighter:[50,75,100,125],Thief:[36,54,72,90],Rogue:[30,45,60,75]}
      : {Fighter:[80,120,160,200],Thief:[70,105,140,175],Rogue:[50,75,100,125]};
    return costs[profession] ? [costs[profession][band]] : null;
  };
  const first = tier(start + 1);
  if (!first) return null;
  const result = [];
  for (let index = 0; index < first.length; index++) {
    const current = tier(start + index + 1);
    if (!current || index >= current.length) break;
    result.push(current[index] * multiplier);
  }
  return result;
}
