// Core Rules §24.2 and T-5.3. Prices are in gold pieces.
export const spellPrices={Rune:[3,10,20,30,40,60,80,100,125,150],Potion:[5,15,30,45,60,90,120,150,200,225],Daily:[15,50,100,150,200,300,400,500,600,750],Wand:[10,30],Rod:[40,80,120,150,200],Staff:[100,150,200,250,300,400,500,600,700,800]};
export const capacities={Rune:1,Potion:1,Wand:10,Rod:30,Staff:100};
const bases={Rune:1,Potion:10,Daily:20,Wand:10,Rod:30,Staff:100,Bonus:0,'Adder +1':50,'Adder +2':100,'Adder +3':200,'Adder +4':400,'Multiplier ×2':200,'Multiplier ×3':400};
export const magicKinds=Object.keys(bases);
export function magicPrice({kind,level=1,normal=0,uses=1,bonus=0,weight=100,channeling=false,form='Other'}){
 if(!(kind in bases)||!Number.isFinite(normal)||normal<0)throw new Error('Choose an item and a nonnegative normal price.');
 const spell=spellPrices[kind]?.[level-1]||0;if(spellPrices[kind]&&!spell)throw new Error('That spell level exceeds this item’s limit.');
 if(!Number.isInteger(uses)||uses<1)throw new Error('Daily uses must be a positive integer.');
 const bonusFactor=({0:1,5:10,10:50,15:250,20:1000,25:5000})[bonus];
 if(!bonusFactor||!Number.isFinite(weight)||weight<40||weight>100)throw new Error('T-5.3 covers +0/+5/+10/+15/+20/+25 and 40–100% weight.');
 const weightFactor=weight===100?1:weight>=80?10:weight>=60?50:100;
 const size=kind==='Daily'?(form==='Ring'?2:form==='Wearable'?1.5:1):1;
 const implanted=spell*(kind==='Daily'?1+(uses-1)/2:1);
 // Daily ring example doubles magical costs, then adds the normal ring price.
 // Channeling wand example doubles both its magical and mundane costs.
 const price=(normal+(bases[kind]+implanted)*size)*(channeling&&spell?2:1)*bonusFactor*weightFactor;
 return {priceGp:price,normalSaleCeilingGp:price/2,baseGp:bases[kind],implantedGp:implanted,bonusFactor,weightFactor,sizeFactor:size,channelingFactor:channeling&&spell?2:1};
}
export function createMagicItem(v){magicPrice(v);if(!spellPrices[v.kind])throw new Error('Use the bonus-spell panel for adders/multipliers; bonus equipment has no consumable spells.');return {...v,remaining:v.kind==='Daily'?v.uses:capacities[v.kind],used:0,day:null};}
export function useMagicItem(item,{day,attuned=false,keyed=false,gmException=false}={}){
 if(!day)throw new Error('Enter the in-game day.');
 if(item.kind!=='Potion'&&!attuned&&!keyed&&!gmException)throw new Error('Successful Attunement / Read Runes, a keyed starting item, or a GM exception is required.');
 const next={...item};if(next.kind==='Daily'&&next.day!==day){next.remaining=next.uses;next.day=day;}
 if(next.remaining<=0)throw new Error('No uses remain.');next.remaining--;next.used++;return next;
}
export function rechargeMagicItem(item){if(!['Wand','Rod','Staff'].includes(item.kind)||item.remaining!==0)throw new Error('Only an exhausted wand, rod or staff can use this recharge action.');return {...item,remaining:capacities[item.kind]};}
export function useBonusItem(state,{owner,item,kind,count,basePp=0,held=false,restedWith=false,known=false}){
 if(!owner.trim()||!item.trim()||!held||!restedWith)throw new Error('Name the character and item; it must be held/worn and present during the preceding rest.');
 if(!['Adder','Multiplier'].includes(kind)||!Number.isInteger(count)||count<1)throw new Error('Enter a positive item bonus.');
 const prior=state[owner];if(prior&&(prior.item!==item||prior.kind!==kind||prior.count!==count))throw new Error('Only one bonus spell item is usable between rests.');
 if(kind==='Adder'&&!known)throw new Error('An adder only casts a spell the character can normally cast.');
 const used=(prior?.used||0)+(kind==='Adder'?1:0);if(kind==='Adder'&&used>count)throw new Error('Adder spells exhausted until the next rest.');
 return {...state,[owner]:{item,kind,count,used,remaining:kind==='Adder'?count-used:null,powerPoints:kind==='Multiplier'?basePp*count:null}};
}
