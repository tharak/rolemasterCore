// Core Rules §24.1, pp. 75–79; tables T-5.4, T-5.5 and T-5.6.
export const raceHealing={
 'Common Man':[12,2,1],'Mixed Man':[11,2,.9],'High Man':[10,2,.75],
 'Wood Elf':[3,3,1.5],'Grey Elf':[2,4,2],'High Elf':[1,5,3],'Half-elf':[6,3,1.5],
 Dwarf:[21,1,.5],Halfling:[18,1,.5],'Common Orc':[1,2,.5],'Greater Orc':[1,2,.5],'Half-orc':[6,2,.75]};
export const recoveryTables={
 Burn:[[-26,4,20,48],[15,3,15,36],[65,2,10,24],[Infinity,1,5,12]],
 Bone:[[-26,7,28,70],[15,5,20,50],[35,3,12,30],[65,2,8,20],[Infinity,1,4,10]],
 'Skin/Tissue':[[-26,5,25,40],[15,3,15,24],[35,2,10,16],[Infinity,1,5,8]],
 Head:[[-26,13,78,130],[15,10,60,100],[35,7,42,70],[65,5,30,50],[90,3,18,30],[105,2,12,20],[Infinity,1,6,10]],
 Organ:[[-26,13,65,130],[15,9,45,90],[35,6,30,60],[65,4,20,40],[90,3,15,30],[105,2,10,20],[Infinity,1,5,10]],
 'Muscle/Tendon':[[-26,11,44,88],[15,7,28,56],[35,4,16,32],[65,3,12,24],[90,2,8,16],[Infinity,1,4,8]]};
export function healingFactor(race){if(!raceHealing[race])throw new Error('Select a race from T-5.5.');return {departure:raceHealing[race][0],type:raceHealing[race][1],recovery:raceHealing[race][2]};}
export function woundSeverity({penalty=0,bleeding=0,fracture=false,shattered=false,organDisabled=false,useless=false}){const p=Math.abs(penalty);return shattered||organDisabled||useless||p>50||bleeding>10?'Severe':fracture||p>20||bleeding>5?'Medium':'Light';}
export function recoveryDays(type,severity,roll,constitutionBonus,race){
 const row=recoveryTables[type]?.find(([max])=>roll+3*constitutionBonus<=max),column=['Light','Medium','Severe'].indexOf(severity)+1;
 if(!row||!column)throw new Error('Choose a wound type and severity.');return row[column]*healingFactor(race).recovery;
}
export function recoveryPlan(wounds,elapsed=0){
 const times=wounds.map(w=>Math.max(0,w.days)),days=times.length?(Math.max(...times)+times.reduce((a,b)=>a+b,0))/2:0;
 const penalty=wounds.reduce((sum,w)=>sum+Math.abs(w.penalty||0),0),daily=days?Math.floor(penalty/days):0,remainder=penalty-daily*days;
 return {days,penalty,daily,firstDay:daily+remainder,remaining:elapsed>=days?0:Math.max(0,penalty-daily*Math.max(0,elapsed)-(elapsed>=1?remainder:0))};
}
export function hitRecovery(mode,hours,coBonus,interrupted=false,sleepMinimum=3){
 if(!Number.isFinite(hours)||hours<0||!Number.isFinite(coBonus))throw new Error('Enter valid time and Constitution bonus.');
 if(mode==='active')return Math.floor(hours/3);
 if(mode==='rest'||mode==='sleep'&&interrupted)return Math.floor(hours)*Math.max(1,coBonus/2);
 if(mode==='sleep'){if(![1,3].includes(sleepMinimum))throw new Error('Choose the printed sleep minimum of 1 or 3.');return Math.floor(hours/3)*Math.max(sleepMinimum,coBonus*2);}
 throw new Error('Choose active, rest or sleep.');
}
export function nerveDamage(penalty,chanceRoll,permanentRoll,coBonus,{explicit=false,useless=false}={}){
 const amount=useless?100:Math.abs(penalty),modified=permanentRoll+3*coBonus;
 return {nerve:explicit||useless||chanceRoll<=amount,modified,permanent:amount===0||modified>amount?0:amount-modified>50?amount:amount/2};
}
export function permanentInjury(roll,constitution){const total=roll+constitution;return {total,result:total>100?'No permanent damage':total<100?'GM assigns permanent damage appropriate to the wound':'Exactly 100: the text leaves this boundary unspecified; GM decides'};}
export function firstAid({severity,type,bleeding=0,applied=false,success=false,equipment=false}){
 if(applied)throw new Error('First aid cannot further reduce the same wound.');
 if(!success||!equipment)return {effective:false,bleeding,note:'Successful First Aid and suitable equipment are required.'};
 if(severity!=='Light'&&['Organ','Nerve'].includes(type))return {effective:false,bleeding,note:'First aid cannot treat medium or severe organ/nerve damage.'};
 return {effective:true,bleeding:severity==='Light'?0:bleeding>10?Math.max(0,bleeding-5):bleeding,note:severity==='Light'?'Light injury treated; begin recovery. Strain removes the benefit.':bleeding>10?'Bleeding reduced by 5/round. Strain removes the benefit.':'GM determines stabilization; no numeric reduction is specified.'};
}
export function soulRecovery({days,mode='rest',soothing=false,holy=false},d10=()=>Math.floor(Math.random()*10)+1){
 const count=Math.max(0,Math.floor(days)),base=(mode==='rest'?count:mode==='stationary'?Math.floor(count/7):0)*(soothing?2:1),dice=holy&&mode!=='travel'?Array.from({length:count},d10):[];
 return {points:base+dice.reduce((a,b)=>a+b,0),dice};
}
export const mentalStats=['Memory','Reasoning','Empathy','Intuition','Self Discipline','Presence'];
export const physicalStats=['Constitution','Agility','Strength','Quickness'];
export function mentalLossDice(round,raceType){return (round<=6?['0','1d2-1','1d5-1','1d5-1','1d10']:round<=18?['1d2-1','1d5-1','1d5-1','1d10','2d10-1']:['1d5-1','1d5+1','1d10','2d10-1','2d10-1'])[raceType-1];}
function rollExpression(expression,die){if(expression==='0')return 0;const [,n,s,mod]=/^(\d+)d(\d+)([+-]\d+)?$/.exec(expression);return Array.from({length:Number(n)},()=>die(Number(s))).reduce((a,b)=>a+b,0)+Number(mod||0);}
export function advanceDeath(state,rounds,{race='Common Man',preserved=false,lifekeeping=false,causeHealed=false,soulDestroyed=false}={},die=s=>Math.floor(Math.random()*s)+1){
 if(state.restored)throw new Error('This death record ended with Lifegiving.');
 if(!Number.isInteger(rounds)||rounds<1||rounds>3600)throw new Error('Advance 1–3600 rounds at a time.');
 const next=structuredClone(state),factor=healingFactor(race);next.round=next.round||0;next.soulClock=next.soulClock||0;next.zeroAt=next.zeroAt||{};
 for(const name of [...mentalStats,...physicalStats]){const stat=next.stats?.[name];if(!stat||!Number.isFinite(stat.temp)||!Number.isFinite(stat.pot)||stat.temp<0||stat.pot<stat.temp)throw new Error('Provide temporary/potential values for all ten stats.');}
 for(let i=0;i<rounds;i++){
  next.round++;if(!lifekeeping&&!causeHealed)next.soulClock++;
  if(next.soulClock>=factor.departure||soulDestroyed)next.soulDeparted=true;
  if(preserved||causeHealed)continue;
  for(const name of mentalStats){const stat=next.stats[name];
   if(stat.temp>0){stat.temp=Math.max(0,stat.temp-rollExpression(mentalLossDice(next.round,factor.type),die));if(stat.temp===0)next.zeroAt[name]=next.round;}
   else {next.zeroAt[name]??=0;if((next.round-next.zeroAt[name])>0&&(next.round-next.zeroAt[name])%360===0)stat.pot=Math.max(0,stat.pot-(die(10)-1));}
  }
  if(next.round>60&&(next.round-60)%360===0)for(const name of physicalStats){const stat=next.stats[name],loss=die(10)-1;stat.pot=Math.max(0,stat.pot-Math.max(0,loss-stat.temp));stat.temp=Math.max(0,stat.temp-loss);}
 }
 next.soulDestroyed=!!next.soulDestroyed||soulDestroyed;next.coma=!!next.soulDeparted||[...mentalStats,...physicalStats].some(name=>next.stats[name].temp===0);return next;
}
export function restoreSoul(state,bodyHealed){if(!bodyHealed||state.soulDestroyed)throw new Error('Lifegiving requires a repaired body and a soul that has not been destroyed.');return {...state,restored:true,soulDeparted:false,coma:Object.values(state.stats).some(s=>s.temp===0)};}
