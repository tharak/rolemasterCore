// Core Rules §24.4: guidelines, not mandatory behavior for every community.
export const economicCultures={
 'Common Men':'Widespread barter; limited lord-to-retainer exchange; some village coinage.',
 'High Men':'Predominant lord/vassal exchange, substantial coin markets and considerable barter.',
 Elves:'Ranges from lord/vassal exchange to barter; coin markets are very rare.',
 Dwarves:'Limited king/vassal exchange; widespread coin markets; barter is rare.',
 Halflings:'Limited lord/vassal exchange; extensive coin markets; some barter.'
};
export function barterValue(offered,wanted){
 const value=items=>items.reduce((sum,item)=>{if(!Number.isFinite(item.priceTin)||item.priceTin<0||!Number.isInteger(item.quantity)||item.quantity<1)throw new Error('Use nonnegative prices and positive whole quantities.');return sum+item.priceTin*item.quantity;},0);
 const offeredTin=value(offered),wantedTin=value(wanted);return {offeredTin,wantedTin,differenceTin:offeredTin-wantedTin,note:'A-7 prices compare relative value; both parties decide whether to accept. Coins may not be accepted locally.'};
}
