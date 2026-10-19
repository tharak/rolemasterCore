export const initiativePhrase = /\byou gain the initiative\b/i;
export const hasCriticalInitiative = (raw,description='') => {const text=String(description)+'. '+String(raw||'');const match=initiativePhrase.exec(text);if(!match)return false;const prefix=text.slice(0,match.index).split(/[.!?;]/).at(-1);return !/\b(?:if|unless|without|otherwise)\b/i.test(prefix);};
// A single winner in a duel is unambiguous. Conflicting grants or more actors
// require GM adjudication, not an invented tie-break or a hidden initiative roll.
export function automaticInitiative(contenders,round) {
  const winners=contenders.map((value,index)=>value.automaticInitiativeRound===round?index:-1).filter(index=>index>=0);
  if(!winners.length)return null;
  if(contenders.length!==2||winners.length!==1)return {review:'Automatic initiative requires GM review: conflicting grants or more than two combatants.'};
  return {winner:winners[0]};
}
