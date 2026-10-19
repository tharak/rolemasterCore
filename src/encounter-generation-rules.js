// Core Rules T-5.1, p. 68. Randomness is injected; no UI or persistence dependencies.
import {openEndedD100} from './rules.js';
export const densities=['Dense','Moderate','Light','Sparse','Waste'];
export const terrains={Road:30,Open:20,Sand:10,Snow:0,Forest:-10,Rough:-15,'Forest and Rough':-30,Swamp:-35,Mountainous:-40};
export const travelModes={Sneaking:50,'Careful walk':20,'Normal walk':0,'Jog/walk':-10,'Slow ride':-20,'Fast ride':-40,'Flying / boat / ship':0};
export const encounterCodes={s:'Sighting by another group',e:'Basic encounter',h:'Hostile group',a:'Attacking group',t:'Trap, ambush or surprise attack','-':'No encounter'};
export const encounterRows=[
 [0,['-/-','-/-','-/-','-/-','-/-']],
 [30,['s/-','-/-','-/-','-/-','-/-']],
 [50,['e/-','s/-','-/s','-/s','-/-']],
 [60,['e/-','s/-','s/s','-/s','-/-']],
 [70,['e/-','e/-','s/s','-/s','-/s']],
 [80,['e/-','e/s','s/s','-/s','-/s']],
 [90,['e/-','e/s','e/s','-/s','-/h']],
 [100,['h/s','e/s','e/s','-/h','-/h']],
 [120,['h/h','e/s','e/h','s/h','-/h']],
 [140,['a/h','h/h','h/h','e/h','s/a']],
 [160,['a/a','a/h','h/h','e/h','e/a']],
 [180,['a/a','a/a','a/h','h/a','h/a']],
 [200,['t/a','a/a','a/a','a/a','a/t']],
 [Infinity,['t/t','t/t','t/t','t/t','t/t']]];
export function groupSizeModifier(full,half=0){
  if(!Number.isInteger(full)||!Number.isInteger(half)||full<0||half<0||full+half<1)throw new Error('Enter at least one group member.');
  // Half-count members are counted once; round fractional totals up into the printed bins.
  const weighted=full+half/2,count=Math.ceil(weighted);
  const modifier=count<=1?50:count<=2?20:count<=4?0:count<=7?-10:count<=10?-20:count<=20?-50:count<=50?-75:-100;
  return {weighted,count,modifier};
}
export function encounterLookup(result,density,tieRoll=1){
  const column=densities.indexOf(density);if(column<0)throw new Error('Unknown population density.');
  if(!Number.isFinite(result)||!Number.isInteger(tieRoll)||tieRoll<1||tieRoll>100)throw new Error('Invalid encounter roll.');
  const cell=encounterRows.find(([upper])=>result<=upper)[1][column], [social,wild]=cell.split('/');
  const both=social!=='-'&&wild!=='-';
  const type=both?(tieRoll<=50?'wild':'social'):social!=='-'?'social':wild!=='-'?'wild':'none';
  const code=type==='social'?social:type==='wild'?wild:'-';
  return {cell,type,code,label:encounterCodes[code],tieRoll:both?tieRoll:null};
}
export function generateEncounter(options={},d100=()=>Math.floor(Math.random()*100)+1){
  const {density='Moderate',terrain='Open',travel='Normal walk',full=1,half=0,hostile=false,patrolled=false,hueCry=false,night=false,nightAdapted=false,searching=false,campHours=0,activityExtra=0,avoidanceExtra=0}=options;
  if(!Object.hasOwn(terrains,terrain)||!Object.hasOwn(travelModes,travel))throw new Error('Choose a terrain and travel mode.');
  if(!Number.isFinite(activityExtra)||!Number.isFinite(avoidanceExtra))throw new Error('Modifiers must be finite numbers.');
  const group=groupSizeModifier(full,half);
  const activityModifiers={terrain:terrains[terrain],hostile:hostile?25:0,patrolled:patrolled?50:0,hueCry:hueCry?100:0,nightAdapted:nightAdapted?(night?30:-30):0,night:night&&!campHours?-50:0,other:activityExtra};
  const avoidanceModifiers={group:group.modifier,travel:campHours?0:travelModes[travel],searching:searching?30:0,camp:campHours>=16?-40:campHours>=12?-20:0,other:avoidanceExtra};
  const activity=openEndedD100(d100),avoidance=openEndedD100(d100);
  const sum=map=>Object.values(map).reduce((a,b)=>a+b,0);
  const activityTotal=activity.total+sum(activityModifiers),avoidanceTotal=avoidance.total+sum(avoidanceModifiers),result=activityTotal-avoidanceTotal;
  let encounter=encounterLookup(result,density);
  if(encounter.tieRoll!==null)encounter=encounterLookup(result,density,d100());
  return {...encounter,result,activity,avoidance,activityTotal,avoidanceTotal,activityModifiers,avoidanceModifiers,group,frequency:hueCry?'Every hour during hue and cry':campHours?'Once per sleep period':'Every 4 hours while moving'};
}
