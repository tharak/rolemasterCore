// Core Rules reference data and character creation catalogs.
export const statNames = ['Agility', 'Constitution', 'Memory', 'Reasoning', 'Self Discipline', 'Empathy', 'Intuition', 'Presence', 'Quickness', 'Strength'];

export const realmByProfession = {Fighter:'Choose at table',Thief:'Choose at table',Rogue:'Choose at table',Cleric:'Channeling',Magician:'Essence',Mentalist:'Mentalism',Ranger:'Channeling',Dabbler:'Essence',Bard:'Mentalism'};

export const primeStats = {Fighter:['Strength','Constitution'], Thief:['Agility','Quickness'], Rogue:['Agility','Strength'], Cleric:['Intuition','Memory'], Magician:['Empathy','Reasoning'], Mentalist:['Presence','Self Discipline'], Ranger:['Intuition','Constitution'], Dabbler:['Empathy','Agility'], Bard:['Presence','Memory']};

// The ends of each range in the Core Rules role trait table T-1.7.
export const personalityRanges = [
  ['Serious','Joyous'],['Kind','Cruel'],['Restrained','Indulgent'],['Cooperative','Obstinate'],
  ['Protective','Overbearing'],['Open-minded','Reactionary'],['Friendly','Antagonistic'],['Cautious','Reckless'],
  ['Confident','Nervous'],['Outgoing','Introvert'],['Peaceful','Belligerent'],['Humble','Arrogant'],
  ['Laid back','Ambitious'],['Courteous','Rude'],['Forgiving','Vengeful'],['Generous','Greedy'],
  ['Honest','Dishonest'],['Honorable','Dishonorable'],['Loyal','Disloyal'],['Lawful','Chaotic'],
  ['Principled','Immoral'],['Devout','Impious'],['Idealistic','Cynical'],['Trusting','Paranoid'],
  ['Curious','Incurious'],['Attentive','Absentminded'],['Chaste','Licentious'],['Quiet','Loud'],
  ['Brave','Cowardly'],['Calm','Excitable'],['Even-tempered','Hot-headed'],['Stoic','Complaining'],
  ['Sociable','Antisocial'],['Optimistic','Pessimistic'],['Creative','Uncreative'],['Tolerant','Intolerant'],
  ['Messy','Perfectionist'],['Understanding','Jealous'],['Dependent','Independent']
];

export const motivationRanges = [
  'Destroy…','Hate and work against…','Hate…','Dislike…','Seek revenge against…',
  'Preserve…','Protect…','Serve…','Promote…','Rebuild or restart…',
  'Fanatic about…','Compulsive about…','Fear of…','Acquire something for someone…','Acquire personal power, knowledge, or wealth…',
  'Acquire and maintain personal honor','Seek adventure, thrills, and excitement','Pursue self-interest','Heroism','Make the world a better place'
];

export const alignmentRanges = [
  ['Good','Evil'],['Law and government','Anarchy'],['Government','Opposing government'],
  ['Laws and principles','Opportunism'],['Religion','Atheism'],['Religion','Opposing religion'],
  ['Free enterprise','Cartels and monopolies'],['Free enterprise','Socialism'],['Asceticism','Hedonism'],
  ['Altruism','Egoism'],['Spiritual','Materialist'],['Metaphorical','Literal']
];

// Category stats and rank progressions from Core Rules T-2.5.
export const skillCategoryRules = {
  'Armor • Heavy':['St/Ag/St'], 'Armor • Light':['Ag/St/Ag'], 'Armor • Medium':['St/Ag/St'],
  'Artistic • Active':['Pr/Em/Ag'], 'Artistic • Passive':['Em/In/Pr'],
  'Athletic • Brawn':['St/Co/Ag'], 'Athletic • Endurance':['Co/Ag/St'], 'Athletic • Gymnastics':['Ag/Qu/Ag'],
  'Awareness • Perceptions':['In/SD/In','limited'], 'Awareness • Searching':['In/Re/SD'], 'Awareness • Senses':['In/SD/In'],
  'Body Development':['Co/SD/Co','special'], 'Combat Maneuvers':['Ag/Qu/SD','combined'],
  Communications:['Re/Me/Em'], Crafts:['Ag/Me/SD','combined'], 'Directed Spells':['Ag/SD/Ag'], Influence:['Pr/Em/In'],
  'Lore • General':['Me/Re/Me'], 'Lore • Magical':['Me/Re/Me'], 'Lore • Obscure':['Me/Re/Me'], 'Lore • Technical':['Me/Re/Me'],
  'Martial Arts • Striking':['St/Ag/St'], 'Outdoor • Animal':['Em/Ag/Em'], 'Outdoor • Environmental':['SD/In/Me'],
  'Power Awareness':['Em/In/Pr'], 'Power Point Development':['realm','special'],
  'Science/Analytic • Basic':['Re/Me/Re'], 'Science/Analytic • Specialized':['Re/Me/Re','combined'],
  'Self Control':['SD/Pr/SD'],
  'Spells • Own Realm Closed Lists':['realm','limited'], 'Spells • Own Realm Open Lists':['realm','limited'], 'Spells • Own Realm Own Base Lists':['realm','limited'],
  'Subterfuge • Attack':['Ag/SD/In'], 'Subterfuge • Mechanics':['In/Ag/Re'], 'Subterfuge • Stealth':['Ag/SD/In'],
  'Technical/Trade • General':['Re/Me/SD'], 'Technical/Trade • Professional':['Re/Me/In','combined'], 'Technical/Trade • Vocational':['Me/In/Re','combined'],
  Urban:['In/Pr/Re'], 'Weapon • 1-H Concussion':['St/Ag/St'], 'Weapon • 1-H Edged':['St/Ag/St'],
  'Weapon • 2-Handed':['St/Ag/St'], 'Weapon • Missile':['Ag/St/Ag'], 'Weapon • Missile Artillery':['In/Ag/Re'],
  'Weapon • Pole Arms':['St/Ag/St'], 'Weapon • Thrown':['Ag/St/Ag']
};

export const weaponCategories = Object.keys(skillCategoryRules).filter(category => category.startsWith('Weapon •'));

export const meleeWeaponCategories = ['Weapon • 1-H Concussion','Weapon • 1-H Edged','Weapon • 2-Handed','Weapon • Pole Arms'];

export const specialSkillClasses = {
  Dwarf: {everyman:['Caving','Leather-crafts','Metal-crafts','Mining','Stone-crafts'], restricted:['Swimming']},
  'Wood Elf': {everyman:['Music','Trickery']},
  Halfling: {everyman:['Horticulture']},
  Fighter: {everyman:['Leadership','Frenzy','Boxing','Tackling','Situational Awareness (Combat)']},
  Thief: {everyman:['Duping','Operating Equipment'], occupational:['Lock Lore']},
  Rogue: {everyman:['Duping','Lock Lore']},
  Magician: {everyman:['Time Sense','Meditation']},
  Cleric: {everyman:['Time Sense','Meditation'], occupational:['Religion','Divination']},
  Mentalist: {everyman:['Lie Perception','Time Sense','Seduction']},
  Dabbler: {everyman:['Sense Ambush','Time Sense','Detect Traps','Locate Hidden'], occupational:['Lock Lore']},
  Bard: {everyman:['Time Sense']}
};

export const packageChoiceRules = {
  Adventurer:[['weapon-category','category',weaponCategories,1,1],['weapon-skill','skill','@weapon-category',1,1]],
  'Amateur Mage':[['open-lists','skill','Spells • Own Realm Open Lists',3,3],['magical-lore','skill','Lore • Magical',2,1],['technical-lore','skill','Lore • Technical',1,1]],
  'Animal Friend':[['environmental','skill','Outdoor • Environmental',2,2],['animal','skill','Outdoor • Animal',4,3]],
  Burglar:[['mechanics','skill','Subterfuge • Mechanics',2,2],['gymnastics','skill','Athletic • Gymnastics',1,1],['weapon-category','category',weaponCategories,1,1],['weapon-skill','skill','@weapon-category',1,1]],
  'City Guard':[['weapon-category','category',weaponCategories,2,1],['weapon-skill','skill','@weapon-category',2,1]],
  Herbalist:[['environmental','skill','Outdoor • Environmental',1,1]],
  Hunter:[['missile','skill','Weapon • Missile',1,1],['environmental','skill','Outdoor • Environmental',2,2]],
  Knight:[['melee-category','category',meleeWeaponCategories,2,1],['melee-skill','skill','@melee-category',2,1],['maneuver','skill','Combat Maneuvers',1,1]],
  Loremaster:[['general','skill','Lore • General',6,3],['technical','skill','Lore • Technical',1,1],['obscure','skill','Lore • Obscure',1,1],['magical','skill','Lore • Magical',3,2]],
  Merchant:[['language','skill','Communications',3,3],['vocation','skill','Technical/Trade • Vocational',1,1]],
  Performer:[['active','skill','Artistic • Active',3,1],['gymnastics','skill','Athletic • Gymnastics',1,1],['language','skill','Communications',5,5],['influence','skill','Influence',2,2]],
  Scout:[['environmental','skill','Outdoor • Environmental',3,3],['animal','skill','Outdoor • Animal',2,2],['weapon-category','category',weaponCategories,1,1],['weapon-skill','skill','@weapon-category',1,1]],
  Soldier:[['weapon-category','category',weaponCategories,2,1],['weapon-skill','skill','@weapon-category',2,1],['light-armor','skill','Armor • Light',2,1]],
  Traveller:[['environmental','skill','Outdoor • Environmental',1,1]]
};

// Appendix A-4 skill names. A trailing * marks a skill developed separately for each instance.
export const a4Skills = {
  'Armor • Heavy':'Plate',
  'Armor • Light':'Soft Leather|Rigid Leather',
  'Armor • Medium':'Chain',
  'Artistic • Active':'Acting|Dancing|Mimery|Mimicry|Play Instrument*|Poetic Improvisation|Singing|Tale Telling|Ventriloquism',
  'Artistic • Passive':'Music|Painting|Poetry|Sculpting',
  'Athletic • Brawn':'Athletic Games (Brawn)*|Jumping|Weight-lifting',
  'Athletic • Endurance':'Athletic Games (Endurance)*|Distance Running|Rowing|Scaling|Sprinting|Swimming',
  'Athletic • Gymnastics':'Acrobatics|Athletic Games (Gymnastics)*|Climbing|Contortions|Diving|Flying/Gliding|Juggling|Tumbling',
  'Awareness • Perceptions':'Alertness|Sense Ambush',
  'Awareness • Searching':'Detect Traps|Lie Perception|Locate Hidden|Observation|Poison Perception|Reading Tracks|Surveillance|Tracking',
  'Awareness • Senses':'Direction Sense|Sense Awareness*|Situational Awareness*|Time Sense',
  'Body Development':'Body Development',
  'Combat Maneuvers':'Mounted Combat|Quickdraw|Swashbuckling|Two-weapon Combat',
  Communications:'Language (spoken)*|Language (written)*|Lip Reading|Signaling',
  Crafts:'Cooking|Leather-crafts|Metal-crafts|Rope Mastery|Stone-crafts|Wood-crafts|Other craft*',
  'Directed Spells':'Directed attack*',
  Influence:'Bribery|Diplomacy|Duping|Interrogation|Leadership|Public Speaking|Seduction|Trading',
  'Lore • General':'Fauna Lore|Flora Lore|Heraldry|History*|Philosophy|Race Lore*|Region Lore*|Religion',
  'Lore • Magical':'Artifact Lore|Spell Lore|Undead Lore',
  'Lore • Obscure':'Demon/Devil Lore|Dragon Lore|Faerie Lore|Xeno-Lores*',
  'Lore • Technical':'Herb Lore|Lock Lore|Metal Lore|Poison Lore|Stone Lore|Trading Lore',
  'Martial Arts • Striking':'Boxing|Tackling',
  'Outdoor • Animal':'Animal Handling*|Animal Training*|Driving*|Riding*',
  'Outdoor • Environmental':'Caving|Foraging|Hunting|Star-gazing|Survival*|Weather Watching',
  'Power Awareness':'Attunement|Read Runes',
  'Power Point Development':'Power Point Development',
  'Science/Analytic • Basic':'Basic Math|Research',
  'Science/Analytic • Specialized':'Advanced Math|Alchemy|Anthropology|Other specialized science*',
  'Self Control':'Frenzy|Meditation|Mnemonics|Stun Removal',
  'Spells • Own Realm Closed Lists':'Spell list*',
  'Spells • Own Realm Open Lists':'Spell list*',
  'Spells • Own Realm Own Base Lists':'Spell list*',
  'Subterfuge • Attack':'Ambush|Silent Attack',
  'Subterfuge • Mechanics':'Camouflage|Disarming Traps|Disguise|Picking Locks|Setting Traps|Using/Removing Poison',
  'Subterfuge • Stealth':'Hiding|Picking Pockets|Stalking|Trickery',
  'Technical/Trade • General':'Begging|First Aid|Gambling|Mapping|Operating Equipment|Orienteering|Sailing|Tactical Games|Using Prepared Herbs',
  'Technical/Trade • Professional':'Diagnostics*|Engineering|Mechanition|Mining|Second Aid',
  'Technical/Trade • Vocational':'Administration|Appraisal|Boat Pilot|Evaluate Armor|Evaluate Metal|Evaluate Stone|Evaluate Weapon|Navigation|Tactics*',
  Urban:'Contacting|Mingling|Scrounging|Streetwise',
  'Weapon • 1-H Concussion':'Weapon*', 'Weapon • 1-H Edged':'Weapon*', 'Weapon • 2-Handed':'Weapon*',
  'Weapon • Missile':'Weapon*', 'Weapon • Missile Artillery':'Weapon*', 'Weapon • Pole Arms':'Weapon*', 'Weapon • Thrown':'Weapon*'
};

export const statAbbreviations = {Ag:0,Co:1,Me:2,Re:3,SD:4,Em:5,In:6,Pr:7,Qu:8,St:9};

// Profession bonuses for categories and groups of categories from T-1.4.
export const professionSkillBonuses = {
  Fighter:{Armor:10,'Body Development':10,'Combat Maneuvers':10,Weapon:20},
  Thief:{'Athletic • Gymnastics':5,Awareness:10,'Body Development':5,'Self Control':5,Subterfuge:15,Weapon:10},
  Rogue:{Armor:5,'Athletic • Gymnastics':5,Awareness:5,'Body Development':5,'Combat Maneuvers':5,Subterfuge:10,Weapon:15},
  Cleric:{Awareness:5,Influence:5,'Lore • Magical':5,Outdoor:5,'Power Awareness':15,'Power Point Development':5,Spells:5,Weapon:5},
  Magician:{'Directed Spells':10,'Lore • Magical':10,'Power Awareness':20,'Power Point Development':5,Spells:5},
  Mentalist:{Awareness:5,'Body Development':5,Influence:10,'Lore • Magical':5,'Power Awareness':10,'Power Point Development':5,'Self Control':5,Spells:5},
  Ranger:{Athletic:5,Awareness:10,'Body Development':5,Outdoor:20,'Subterfuge • Stealth':5,Weapon:5},
  Dabbler:{Awareness:10,'Body Development':5,Influence:5,'Lore • Magical':5,'Power Awareness':10,Subterfuge:5,Urban:5,Weapon:5},
  Bard:{'Artistic • Active':5,Awareness:5,'Body Development':5,Communications:5,Influence:5,Lore:10,'Power Awareness':5,'Self Control':5,Weapon:5}
};

export const raceAllowances = {'Common Man':[12,8,6], 'High Man':[10,12,4], 'Wood Elf':[10,12,4], Dwarf:[12,8,5], Halfling:[12,6,5]};

export const adolescenceRaces = ['Common Man','High Man','Wood Elf','Dwarf','Halfling'];

// Fixed adolescence ranks from T-1.6, in the race order above.
export const adolescenceCategoryRanks = {
  'Armor • Light':[1,1,0,1,0], 'Armor • Medium':[0,2,0,3,0],
  'Athletic • Brawn':[1,1,1,1,1], 'Athletic • Endurance':[1,1,1,1,1], 'Athletic • Gymnastics':[1,1,1,1,1],
  'Awareness • Searching':[1,1,1,1,1], Communications:[1,3,2,1,1], 'Lore • General':[3,3,3,3,2],
  'Outdoor • Animal':[1,1,1,0,0], 'Outdoor • Environmental':[2,1,5,2,1], 'Power Awareness':[0,1,1,0,0],
  'Science/Analytic • Basic':[0,1,1,1,0], 'Subterfuge • Stealth':[1,0,4,0,5],
  'Technical/Trade • General':[1,1,1,1,1],
  'Weapon • 1-H Concussion':[0,0,0,4,0], 'Weapon • 1-H Edged':[1,2,1,0,0],
  'Weapon • 2-Handed':[0,1,0,0,0], 'Weapon • Missile':[1,1,3,0,2],
  'Weapon • Pole Arms':[1,1,0,0,0], 'Weapon • Thrown':[1,0,0,1,2]
};

export const adolescenceSkillRanks = [
  ['Armor • Light','Soft Leather',[1,0,0,0,0]], ['Armor • Light','Rigid Leather',[1,1,0,1,0]],
  ['Armor • Medium','Chain',[0,2,0,3,0]], ['Athletic • Endurance','Swimming',[1,1,3,0,0]],
  ['Athletic • Gymnastics','Climbing',[0,0,2,1,2]], ['Awareness • Perceptions','Alertness',[2,2,6,4,8]],
  ['Body Development','Body Development',[2,3,1,3,2]],
  ['Lore • General','Own Region Lore',[3,3,3,3,3]], ['Lore • General','Own Race Lore',[3,3,3,3,3]],
  ['Outdoor • Animal','Riding (horse)',[1,1,1,0,0]],
  ['Subterfuge • Stealth','Stalking',[1,0,4,0,5]], ['Subterfuge • Stealth','Hiding',[1,0,4,0,5]]
];

// Starting spoken/written language ranks from the matching A-1 race entries (A-1.1–A-1.5).
export const raceStartingLanguages = {
  'Common Man':[['Common-speech',8,6]],
  'High Man':[['High-speech',8,6],['Common-speech',8,6],['Grey-elvish',6,6],['High-elvish',2,2]],
  'Wood Elf':[['Elvish',10,10],['Grey-elvish',8,6],['Common-speech',8,6],['High-elvish',4,4]],
  Dwarf:[['Dwarvish',8,6],['Common-speech',5,5],['Elvish',4,4]],
  Halfling:[['Small-speech',8,6],['Common-speech',8,6]]
};

// A-1 allowed adolescence development, with separate spoken and written rank caps.
export const raceAdolescenceLanguages = {
  'Common Man':[['High-speech',6,6],['Common-speech',10,10],['Small-speech',6,6]],
  'High Man':[['High-speech',10,10],['Common-speech',10,10],['Grey-elvish',8,8],['High-elvish',6,6],['Hill-speech',6,6],['Sea-speech',8,8],['Small-speech',6,6],['Plains-speech',6,6]],
  'Wood Elf':[['Grey-elvish',10,10],['Common-speech',10,10],['High-elvish',10,10],['High-speech',4,4],['Plains-speech',8,8],['Wood-speech',8,8]],
  Dwarf:[['Dwarvish',10,10],['Common-speech',10,10],['Hill-speech',2,2],['Plains-speech',6,6],['Wood-speech',6,6]],
  Halfling:[['Small-speech',10,10],['Common-speech',10,10],['High-speech',8,8],['Grey-elvish',8,8]]
};

export const backgroundChoices = [
  ['extraLanguages','Extra languages',1,'20 ranks in the extra languages listed for your race.'],
  ['extraStatRolls','Extra stat gain rolls',1,'One extra stat gain roll for each stat.'],
  ['skillBonus','Special +10 skill bonus',1,'Choose one skill.'],
  ['categoryBonus','Special +5 category bonus',1,'Choose one skill category.'],
  ['rolledItem','Roll for a special item',1,'Roll on T-1.5.'],
  ['chosenItem','Choose a special item',2,'Choose a result from T-1.5 with your GM.'],
  ['rolledMoney','Roll for extra money',1,'Roll on T-1.5.'],
  ['chosenMoney','Choose extra money',2,'Choose an amount from T-1.5 with your GM.']
];

export const backgroundExtraLanguages = {
  'Common Man':[['High-speech',8,8],['Small-speech',8,8],['Hill-speech',8,8]],
  'High Man':[['High-elvish',8,8],['Hill-speech',8,8],['Plains-speech',8,8],['North-speech',8,8],['Wood-speech',8,8]],
  'Wood Elf':[['High-speech',8,8],['South-speech',6,6],['Black-speech',6,6]],
  Dwarf:[['High-speech',5,5],['South-speech',4,4],['North-speech',5,5]],
  Halfling:[['Hill-speech',4,4],['Wood-speech',6,6],['Orcish',2,2],['Elvish',8,8]]
};

export const backgroundMoney = [[2,1],[5,2],[15,5],[25,10],[35,15],[45,20],[55,30],[65,35],[70,40],[75,50],[80,60],[85,70],[90,80],[94,100],[97,125],[99,150],[100,200]];

export const backgroundItems = [
  [5,'01–05',['+1 spell adder','One special bread, poison, or herb']],
  [10,'06–10',['+1 spell adder','Two +5 non-magic items']],
  [20,'11–20',['+1 spell adder','One +10 non-magic item']],
  [30,'21–30',['+1 spell adder','Two +5 magic items']],
  [65,'31–65',['+1 spell adder','One +10 magic item']],
  [66,'66',['+3 spell adder','Loyal domesticated animal','One +20 non-magic item']],
  [75,'67–75',['Daily III spell item','+2 spell adder','Three +5 non-magic items','Three doses of a level 1–5 potion']],
  [80,'76–80',['Daily III spell item','+2 spell adder','One +15 non-magic item','Three doses of a level 1–5 potion']],
  [85,'81–85',['Daily IV spell item','+2 spell adder','Three +5 magic items','Five doses of a level 1–5 potion']],
  [90,'86–90',['Daily IV spell item','+2 spell adder','One +15 magic item','Five doses of a level 1–5 potion']],
  [95,'91–95',['+3 spell adder','Two +10 magic items','Two Daily III spell items']],
  [97,'96–97',['+3 spell adder','One +20 magic item','Daily IV spell item']],
  [98,'98',['+3 spell adder','Daily VI spell item','Three +10 magic items']],
  [99,'99',['+3 spell adder','Daily VII spell item','Two +20 magic items']],
  [100,'100',['+3 spell adder','Daily VIII spell item','Loyal unusual creature']]
];

export const raceBackgroundNotes = {
  'Common Man':'Extra languages: High-speech, Small-speech, Hill-speech. Money: silver and bronze pieces.',
  'High Man':'Extra languages: High-elvish, Hill-speech, Plains-speech, North-speech, Wood-speech. Money: gold pieces.',
  'Wood Elf':'Extra languages: High-speech, South-speech, Black-speech. Money: gems.',
  Dwarf:'Extra languages: High-speech, South-speech, North-speech. Spell items may contain only Channeling spells.',
  Halfling:'Extra languages: Hill-speech, Wood-speech, Orcish, Elvish. Spell adders and items that cast spells are unavailable.'
};

// Appendix A-1 race descriptions give averages and typical traits, not dice tables.
export const racePhysicalProfiles = {
  'Common Man':{source:'A-1.1', heights:[70,64], weights:[160,125], age:[16,60], builds:['Medium','Lean','Broad'], skin:['Fair','Tan','Olive'], hair:['Black','Dark brown','Brown','Blond','Red','Grey'], eyes:['Brown','Hazel','Blue','Green','Grey'], demeanor:['Practical','Hard-working','Quiet','Loyal','Shy']},
  'High Man':{source:'A-1.2', heights:[77,70], weights:[225,150], age:[16,200], builds:['Tall and strong'], skin:['Fair'], hair:['Black','Dark brown'], eyes:['Grey','Hazel','Blue','Green'], demeanor:['Noble','Confident','Impatient','Proud','Haughty']},
  'Wood Elf':{source:'A-1.3', heights:[72,69], weights:[150,125], age:[16,500], builds:['Slight and slender'], skin:['Ruddy'], hair:['Sandy'], eyes:['Blue','Green'], demeanor:['Fun-loving','Guarded','Mirthful'], immortal:true},
  Dwarf:{source:'A-1.4', heights:[57,53], weights:[150,135], age:[16,300], builds:['Short and stocky','Strong-limbed'], skin:['Fair','Ruddy'], hair:['Black','Red','Dark brown'], eyes:[], demeanor:['Sober','Quiet','Possessive','Suspicious','Pugnacious','Introspective']},
  Halfling:{source:'A-1.5', heights:[41,39], weights:[54,51], age:[30,100], builds:['Small and pudgy','Small and stout'], skin:['Brown'], hair:['Brown'], eyes:[], demeanor:['Cheery','Conservative','Unassuming','Peaceful']}
};

export const armorTypes = {
  5:[0,0,0,0], 6:[0,-20,5,0], 7:[-10,-40,15,10], 8:[-15,-50,15,15],
  9:[-5,-50,0,0], 10:[-10,-70,10,5], 11:[-15,-90,20,15], 12:[-15,-110,30,15],
  13:[-10,-70,0,5], 14:[-15,-90,10,10], 15:[-25,-120,20,20], 16:[-25,-130,20,20],
  17:[-15,-90,0,10], 18:[-20,-110,10,20], 19:[-35,-150,30,30], 20:[-45,-165,40,40]
};

export const armorSkillTypes = {'Soft Leather':[5,6,7,8], 'Rigid Leather':[9,10,11,12], Chain:[13,14,15,16], Plate:[17,18,19,20]};

// Weapon choices from the outfitting lists in the matching A-1 race entries.
export const raceWeaponChoices = {
  'Common Man':{'Weapon • 1-H Edged':['Dagger','Handaxe','Throwing dagger'],'Weapon • Missile':['Sling'],'Weapon • Pole Arms':['Fishing spear'],'Weapon • Thrown':['Dagger','Handaxe','Throwing dagger','Fishing spear']},
  'High Man':{'Weapon • 1-H Edged':['Battle axe','Broadsword','Dagger','Short sword','Bastard sword','Falchion','Foil','Kynac','Long kynac','Main gauche','Rapier'],'Weapon • 2-Handed':['Flail','Quarterstaff','Two-handed sword','War mattock'],'Weapon • Missile':['Composite bow','Long bow'],'Weapon • Pole Arms':['Halbard','Lance','Spear','Boar spear']},
  'Wood Elf':{'Weapon • 1-H Edged':['Dagger','Handaxe','Broadsword','Short sword','Whip','Main gauche','Shang','Rapier','Gé','Kynac'],'Weapon • Missile':['Long bow','Short bow']},
  Dwarf:{'Weapon • 1-H Concussion':['Club','War hammer','Mace'],'Weapon • Thrown':['Dagger','Handaxe','Spear']},
  Halfling:{'Weapon • Missile':['Short bow','Sling'],'Weapon • Thrown':['Dagger','Handaxe','Pilum']}
};

export const openSpellLists = {
  Essence:['Delving Ways','Detecting Ways','Elemental Shields','Essence Hand','Essence’s Perceptions','Lesser Illusions','Physical Enhancement','Rune Mastery','Spell Wall','Unbarring Ways'],
  Channeling:['Barrier Law','Concussion’s Ways','Detection Mastery','Light’s Way','Lofty Movements','Nature’s Law','Purifications','Sound’s Way','Spell Defense','Weather Ways'],
  Mentalism:['Anticipations','Attack Avoidance','Brilliance','Cloaking','Damage Resistance','Delving','Detections','Illusions','Self Healing','Spell Resistance']
};

export const raceStats = {
  'Common Man':[0,0,0,0,2,0,0,0,0,2],
  'High Man':[-2,4,0,0,0,0,0,4,-2,4],
  'Wood Elf':[4,0,2,0,-5,2,0,2,2,0],
  Dwarf:[-2,6,0,0,2,-4,0,-4,-2,2],
  Halfling:[6,6,0,0,-4,-2,0,-6,4,-8]
};

export const raceResistances = {
  'Common Man':[0,0,0,0,0,0],
  'High Man':[-5,-5,-5,0,0,0],
  'Wood Elf':[-5,-5,-5,10,100,0],
  Dwarf:[40,0,40,20,15,0],
  Halfling:[50,0,40,30,15,0]
};

export const resistanceTypes = [
  ['channeling','Channeling',6,1], ['essence','Essence',5,0],
  ['mentalism','Mentalism',7,2], ['poison','Poison',1,3],
  ['disease','Disease',1,4], ['fear','Fear',4,5]
];

export const xpThresholds = [0,10000,20000,30000,40000,50000,70000,90000,110000,130000,150000,180000,210000,240000,270000,300000,340000,380000,420000,460000,500000];

export const coinUnits = [['gp',10000],['sp',1000],['bp',100],['cp',10],['tp',1]];
