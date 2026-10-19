// Core Rules §23, pp. 71–74. Pure rules, independent of the character sheet and arena.
export const uniqueness = {normal:1, first:5, second:2, routine:0.5};
export const maneuverAwards = {Routine:0,Easy:5,Light:10,Medium:50,Hard:100,'Very Hard':150,'Extremely Hard':200,'Sheer Folly':300,Absurd:500};
export function killExperience(foeLevel, characterLevel) {
  const foe=Math.max(0,Math.trunc(foeLevel)), level=Math.max(1,Math.trunc(characterLevel));
  if(foe>=10)return Math.max(200,200+50*(foe-level));
  if(foe===0)return Math.max(0,55-5*level);
  const rows=[
    [200,150,130,110,100,90,80,70,60,50,40],
    [250,200,150,130,110,100,90,80,70,60,50],
    [300,250,200,150,130,110,100,90,80,70,60],
    [350,300,250,200,150,130,110,100,90,80,70],
    [400,350,300,250,200,150,130,110,100,90,80],
    [450,400,350,300,250,200,150,130,110,100,90],
    [500,450,400,350,300,250,200,150,130,110,100],
    [550,500,450,400,350,300,250,200,150,130,130],
    [600,550,500,450,400,350,300,250,200,150,150]];
  return rows[foe-1][Math.min(11,level)-1];
}
export function criticalExperience(level,severity) {
  const n='ABCDE'.indexOf(severity)+1;
  if(!n)return 0;
  return level===0?[3,5,8,10,13][n-1]:5*Math.max(0,level)*n;
}
export function activityExperience({kind,success=true,difficulty='Medium',danger=1,casterLevel=1,spellLevel=1,miles=0,mode='land',unfamiliar=true,conscious=true,multiplier=1,amount=0,defeated=false}) {
  let base=0;
  if(kind==='maneuver'&&success)base=(maneuverAwards[difficulty]??0)*danger;
  if(kind==='spell'&&success)base=Math.max(0,Math.min(200,100-10*(casterLevel-spellLevel)))*danger;
  if(kind==='travel'&&unfamiliar&&conscious)base=Math.max(0,miles)/(mode==='land'?1:10)*danger;
  if(['idea','miscellaneous'].includes(kind))base=amount;
  if(kind==='negative')base=-Math.abs(amount);
  return Math.trunc(base*multiplier*(['maneuver','spell'].includes(kind)&&defeated?5:1));
}
export function combatExperience(fight,side,{trueConflict=false,multiplier=1,sameRace=false,intelligent=false,size='normal',revived=false}={}) {
  const self=fight.fighters[side],foe=fight.fighters[1-side];
  const killMultiplier=(sameRace?2:1)*(intelligent?1.5:1)*(size==='large'?1.5:size==='super-large'?3:1);
  const budget=killExperience(foe.creature.level,self.creature.level)*killMultiplier;
  let delivered=0,received=0,criticals=0,taken=0,mortal=false,defeatedBySelf=false;
  for(const round of [...fight.log].reverse())for(const e of round.events){
    if(e.kind==='bleed'){if(e.side===side)received+=e.hits;else delivered+=e.hits;}
    if((e.kind==='dies'||e.defeated)&&e.sourceSide===side)defeatedBySelf=true;
    if(e.kind!=='attack')continue;
    const hits=e.experienceHits??e.hits;
    if(e.side===side){
      delivered+=hits;
      if(e.defeated)defeatedBySelf=true;
      if(e.critical){
        const state={dying:0,incapacitated:0.1,down:0.2,stunned:0.5,active:1}[e.targetState||'active'];
        criticals+=criticalExperience(foe.creature.level,e.critical.severity)*state*(e.melee?2:1)*(size==='large'?1.5:size==='super-large'?2:1);
      }
    }else{
      received+=hits;
      if(e.critical)taken+=100*('ABCDE'.indexOf(e.critical.severity)+1);
      if(e.mortal)mortal=true;
    }
  }
  const knockedOut=f=>!f.dead&&f.hits>=f.creature.hits;
  criticals=Math.min(budget,criticals);
  const parts={hitsDelivered:delivered*(knockedOut(foe)?2:1),hitsReceived:received*(knockedOut(self)?0.5:1),criticalsDelivered:criticals,criticalsReceived:taken,
    defeat:trueConflict&&defeatedBySelf?Math.max(0,budget-criticals):0,
    mortalWound:mortal?killExperience(self.creature.level,1)*(revived?2:1):0};
  return {parts,total:Math.trunc(Object.values(parts).reduce((a,b)=>a+b,0)*multiplier),multiplier,killBudget:budget};
}
export function appendExperience(character,{id,amount,reason,date=new Date().toLocaleDateString()}) {
  let history;try{history=JSON.parse(character.xpHistory||'[]');}catch{history=[];}
  if(!Array.isArray(history))history=[];
  if(history.some(entry=>entry.awardId===id))throw new Error('This award is already recorded.');
  const before=Number(character.xp)||0;
  if(!id||!Number.isSafeInteger(amount)||amount===0||before+amount<0||!Number.isSafeInteger(before+amount))throw new Error('Invalid experience award.');
  return {...character,xp:String(before+amount),xpHistory:JSON.stringify([...history,{awardId:id,before,amount,reason,date}])};
}
