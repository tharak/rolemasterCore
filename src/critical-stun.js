// Core Rules, printed p. 209: one cumulative pool, most severe round first.
import {rustEffectRounds} from './rust-components.js';
const severity={stun:1,stunNoParry:2,downOrOut:3};
export const isStunEffect=effect=>Object.hasOwn(severity,effect.kind);
export const accumulatedStunRounds=effects=>effects.filter(isStunEffect).reduce((sum,effect)=>sum+Math.max(0,Number(effect.roundsLeft)||0),0);
export function expireCriticalEffects(effects,completedRound,startField) {
  const remaining=rustEffectRounds(effects,completedRound,startField,severity);
  if(remaining){
    return effects.filter((effect,index)=>{
      if(effect.roundsLeft===null||(effect[startField]??completedRound)>completedRound)return true;
      effect.roundsLeft=remaining[index];
      return effect.roundsLeft>0;
    });
  }
  return expireCriticalEffectsJavaScript(effects,completedRound,startField);
}
export function expireCriticalEffectsJavaScript(effects,completedRound,startField) {
  const active=effects.filter(effect=>(effect[startField]??completedRound)<=completedRound&&effect.roundsLeft!==null&&effect.roundsLeft>0&&isStunEffect(effect));
  const spent=active.reduce((worst,effect)=>!worst||severity[effect.kind]>severity[worst.kind]?effect:worst,null);
  return effects.filter(effect=>{
    if(effect.roundsLeft===null||(effect[startField]??completedRound)>completedRound)return true;
    if(isStunEffect(effect)&&effect!==spent)return effect.roundsLeft>0;
    return --effect.roundsLeft>0;
  });
}
export function updateCriticalStunConsciousness(target,effects,constitutionBonus) {
  const total=accumulatedStunRounds(effects),threshold=10+2*constitutionBonus;
  target.statuses=Array.isArray(target.statuses)?target.statuses:[];
  if(total>0&&total>threshold||target.stunUnconscious&&total===threshold){
    if(target.statuses.includes('Unconscious')&&!target.stunUnconscious&&!target.hitUnconscious)target.otherUnconscious=true;
    target.stunUnconscious=true;
    if(!target.statuses.includes('Unconscious'))target.statuses.push('Unconscious');
  }else if(total<threshold&&target.stunUnconscious){
    if(!target.hitUnconscious&&!target.otherUnconscious&&!target.dead&&!target.statuses.includes('Dead'))target.statuses=target.statuses.filter(status=>status!=='Unconscious');
    delete target.stunUnconscious;
  }
  return {total,threshold};
}
