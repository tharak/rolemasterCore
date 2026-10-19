// T-5.8 gives total spell ranks, not named lists. These are explicit guild presets.
const schools={
 Fighter:{realm:'Channeling',groups:[5]},Thief:{realm:'Essence',groups:[9]},Rogue:{realm:'Essence',groups:[9]},
 Cleric:{realm:'Channeling',groups:[7,5,6],first:['9.5.2','9.7.4']},
 Ranger:{realm:'Channeling',groups:[8,5],first:['9.8.1','9.8.5','9.5.2']},
 Magician:{realm:'Essence',groups:[11,9,10],first:['9.11.4','9.11.2','9.11.3']},
 Dabbler:{realm:'Essence',groups:[12,9],first:['9.12.2','9.12.1']},
 Mentalist:{realm:'Mentalism',groups:[15,13,14],first:['9.15.1','9.13.4']},
 Bard:{realm:'Mentalism',groups:[16,13],first:['9.16.1','9.13.4']}
};
export function masterSpells(profession,level,totalRanks){
 const school=schools[profession];if(!school)throw new Error('Unknown spell profession.');
 const ids=[...new Set([...(school.first||[]),...school.groups.flatMap(g=>Array.from({length:[7,8,11,12,15,16].includes(g)?6:10},(_,i)=>`9.${g}.${i+1}`))])];
 const lists=ids.map(id=>({id:'A-'+id,ranks:0}));let remaining=totalRanks;
 // Pure casters know several lists at first level. Prioritize useful lists, then
 // spread remaining ranks without exceeding the character's level per list.
 while(remaining>0){let changed=false;for(const list of lists){if(list.ranks<level){list.ranks++;remaining--;changed=true;if(!remaining)break;}}if(!changed)throw new Error('Spell rank allocation exceeds the preset capacity.');}
 return {realm:school.realm,spellRanks:totalRanks,spellLists:lists.filter(l=>l.ranks),spellPreset:true};
}
// The autonomous guild implements these spells; all other known names remain visible.
export const automatedSpells=[
 {list:'A-9.5.2',level:8,name:'Healing V',kind:'heal',dice:5},
 {list:'A-9.5.2',level:4,name:'Healing III',kind:'heal',dice:3},
 {list:'A-9.5.2',level:1,name:'Healing I',kind:'heal',dice:1},
 {list:'A-9.7.4',level:2,name:'Bless I',kind:'ward',bonus:5},
 {list:'A-9.8.1',level:4,name:'Bless I',kind:'ward',bonus:5,self:true},
 {list:'A-9.13.4',level:1,name:'Blur',kind:'ward',bonus:10,self:true},
 {list:'A-9.11.4',level:2,name:'Shock Bolt I',kind:'bolt',cap:90,obModifier:-40,maxCritical:'C',critical:'A-10.10.2'},
 {list:'A-9.15.1',level:3,name:'Minor Pain',kind:'pain'},
 {list:'A-9.15.1',level:1,name:'Jolts I',kind:'stun'},
 {list:'A-9.12.2',level:1,name:'Sleep III',kind:'sleep',maxTargetLevel:3},
 {list:'A-9.16.1',level:3,name:'Stun Song',kind:'song'},
 {list:'A-9.16.1',level:1,name:'Calm Song',kind:'song'}
];
export const spellKey=spell=>`${spell.list}:${spell.level}`;
export const knownAutomatedSpells=actor=>automatedSpells.filter(s=>(!Array.isArray(actor.selectedSpells)||actor.selectedSpells.includes(spellKey(s)))&&s.level<=actor.level&&actor.spellLists?.some(l=>l.id===s.list&&l.ranks>=s.level));
