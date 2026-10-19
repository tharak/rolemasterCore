// Only explicit foe recoil distances move a token. Undated recoil, attacker
// recoil, and other narrative movement remain available for GM interpretation.
export function criticalRecoils(text) {
  const input=String(text||'');
  return [...input.matchAll(/\b(?:foe|he|enemy|opponent)\s+recoils?\s+(\d+(?:\.\d+)?)\s*(?:feet|foot|ft\.?)(?!\w)/gi)]
    .filter(match=>! /\b(?:if|unless|otherwise|without|may|might|never|not)\b/i.test(input.slice(0,match.index).split(/[.!?;]/).at(-1)))
    .map(match=>({kind:'recoil',feet:Number(match[1])})).filter(effect=>effect.feet>0);
}

const hexDistance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function roundHex(q,r) {
  const s=-q-r;let rq=Math.round(q),rr=Math.round(r),rs=Math.round(s);
  const dq=Math.abs(rq-q),dr=Math.abs(rr-r),ds=Math.abs(rs-s);
  if(dq>dr&&dq>ds)rq=-rr-rs;else if(dr>ds)rr=-rq-rs;
  return {q:rq,r:rr};
}
export function recoilMovement(target,origin,feet,{scale=5,columns=13,rows=10,terrain={},occupied=[]}={}) {
  const result={position:{q:target?.q,r:target?.r},path:[],requestedFeet:feet,movedFeet:0,reason:''};
  const within=hex=>Number.isInteger(hex?.q)&&Number.isInteger(hex?.r)&&hex.q>=0&&hex.q<columns&&hex.r>=0&&hex.r<rows;
  if(!within(target)||!within(origin)){result.reason='Place the foe and attack origin on the map first.';return result;}
  if(!Number.isFinite(feet)||feet<=0||!Number.isFinite(scale)||scale<=0){result.reason='Recoil needs a positive distance and map scale.';return result;}
  const distance=hexDistance(target,origin);
  if(!distance){result.reason='Foe is at the attack origin; choose a recoil direction with the GM.';return result;}
  const steps=Math.floor(feet/scale);
  for(let step=1;step<=steps;step++) {
    const next=roundHex(target.q+(target.q-origin.q)*step/distance,target.r+(target.r-origin.r)*step/distance);
    if(!within(next)){result.reason='Recoil stops at the map edge.';break;}
    if(terrain[next.q+','+next.r]==='blocked'){result.reason='Blocked terrain stops recoil.';break;}
    if(occupied.some(hex=>hex.q===next.q&&hex.r===next.r)){result.reason='An occupied hex stops recoil.';break;}
    result.path.push(next);result.position=next;result.movedFeet+=scale;
  }
  if(!result.reason&&feet%scale!==0)result.reason='The remaining '+(feet-result.movedFeet)+' ft is smaller than one map hex; GM review required.';
  return result;
}
