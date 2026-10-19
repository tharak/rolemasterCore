export function seededRandom(seed){
 let n=2166136261;for(const char of String(seed)){n^=char.charCodeAt(0);n=Math.imul(n,16777619);}
 return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
