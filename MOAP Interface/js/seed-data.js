/**
 * Feudalism 4 - Seed Data
 * Extracted from Feudalism 3 LSL scripts
 * 
 * Contains:
 * - 20 F3 Stats (in order)
 * - 21 Species (from F3)
 * - 122 Classes with stat caps (from F3 StatsMax.lsl)
 */

const F4_SEED_DATA = {
    
    // ========================= STATS =========================
    // F3 stat names in their original order (for parsing class caps)
    statNames: [
        'agility', 'animal_handling', 'athletics', 'awareness', 'crafting',
        'deception', 'endurance', 'entertaining', 'fighting', 'healing',
        'influence', 'intelligence', 'knowledge', 'marksmanship', 'persuasion',
        'stealth', 'survival', 'thievery', 'will', 'wisdom'
    ],
    
    // Default stat value for all characters
    defaultStatValue: 2,
    
    // ========================= SPECIES =========================
    // 21 species from F3 (removed duplicate merfolk)
    species: [
        { id: 'human', name: 'Human', description: 'Versatile and adaptable. The most common race in the realm.', icon: '👤' },
        { id: 'elf', name: 'Elf', description: 'Graceful and long-lived. Masters of magic and archery.', icon: '🧝' },
        { id: 'dwarf', name: 'Dwarf', description: 'Stout and resilient craftsmen. Masters of stone and steel.', icon: '⛏️' },
        { id: 'halfling', name: 'Halfling', description: 'Small but lucky. Known for their stealth and charm.', icon: '🍀' },
        { id: 'gnome', name: 'Gnome', description: 'Clever and inventive. Masters of illusion and tinkering.', icon: '🔧' },
        { id: 'dragonborn', name: 'Dragonborn', description: 'Proud dragon-blooded warriors with breath weapons.', icon: '🐉' },
        { id: 'half-elf', name: 'Half-Elf', description: 'Blending human adaptability with elven grace.', icon: '🌙' },
        { id: 'half-orc', name: 'Half-Orc', description: 'Strong and fierce. Warriors with orcish blood.', icon: '💪' },
        { id: 'tiefling', name: 'Tiefling', description: 'Touched by infernal heritage. Mistrusted but powerful.', icon: '😈' },
        { id: 'drow', name: 'Drow', description: 'Dark elves from the underdark. Masters of shadow.', icon: '🌑' },
        { id: 'demon', name: 'Demon', description: 'Creatures of the abyss. Powerful but feared.', icon: '👹' },
        { id: 'imp', name: 'Imp', description: 'Small mischievous devils. Cunning tricksters.', icon: '👿' },
        { id: 'werewolf', name: 'Werewolf', description: 'Cursed shapeshifters. Fierce when transformed.', icon: '🐺' },
        { id: 'vampire', name: 'Vampire', description: 'Undead immortals. Powerful but vulnerable to sunlight.', icon: '🧛' },
        { id: 'merfolk', name: 'Merfolk', description: 'Aquatic beings of the deep. Masters of the sea.', icon: '🧜' },
        { id: 'fairy', name: 'Fairy', description: 'Tiny magical beings with wings. Masters of enchantment.', icon: '🧚' },
        { id: 'satyr', name: 'Satyr', description: 'Half-goat forest dwellers. Lovers of music and revelry.', icon: '🎭' },
        { id: 'minotaur', name: 'Minotaur', description: 'Bull-headed warriors. Powerful and relentless.', icon: '🐂' },
        { id: 'reptilian', name: 'Reptilian', description: 'Cold-blooded lizard folk. Ancient and patient.', icon: '🦎' },
        { id: 'goblin', name: 'Goblin', description: 'Small green-skinned creatures. Cunning survivors.', icon: '👺' }
    ],
    
    // ========================= CLASSES =========================
    // 122 classes from F3 with their names
    classNames: [
        'academic', 'adventurer', 'advisor', 'alchemist', 'apothecary', 
        'apprentice', 'archer', 'artillerist', 'artisan', 'artist', 
        'assassin', 'bailiff', 'bandit', 'barbarian', 'bard', 
        'beggar', 'boatman', 'bountyhunter', 'burgher', 'burglar', 
        'castellan', 'cavalry', 'censor', 'charlatan', 'cleric', 
        'coachman', 'conartist', 'courtesan', 'courtier', 'craftsman', 
        'cultist', 'cutpurse', 'druid', 'duelist', 'enchanter', 
        'engineer', 'entertainer', 'envoy', 'executioner', 'farmer', 
        'fence', 'footwizard', 'forager', 'forger', 'guard', 
        'healer', 'hedgeknight', 'hedgemage', 'herald', 'herbalist', 
        'herder', 'highwayman', 'hunter', 'interrogator', 'investigator', 
        'jailer', 'knight', 'lawyer', 'mage', 'marshal', 
        'mercenary', 'merchant', 'messenger', 'miner', 'monk', 
        'necromancer', 'noble', 'nun', 'outlaw', 'paladin', 
        'peasant', 'pedlar', 'physician', 'pirate', 'pitfighter', 
        'priest', 'raider', 'ranger', 'rogue', 'royalguard', 
        'royal', 'sage', 'sailor', 'scholar', 'scout', 
        'seer', 'sentinel', 'servant', 'shadowmage', 'shaman', 
        'sheriff', 'slave', 'smith', 'smuggler', 'soldier', 
        'sorcerer', 'spearman', 'spellmonger', 'spy', 'squire', 
        'steward', 'student', 'swordmaster', 'swornsword', 'tavernhelp', 
        'thaumaturge', 'thief', 'tribesman', 'villager', 'warden', 
        'warlock', 'warmage', 'warrior', 'watchman', 'whisperer', 
        'whore', 'wildling', 'witch', 'witchhunter', 'wizard', 
        'woodsman', 'yeoman', 'zealot'
    ],
    
    // Stat caps for each class (pipe-delimited strings from StatsMax.lsl)
    // Order matches classNames array
    classStatCaps: [
        "4|5|3|7|5|5|3|4|2|7|6|7|7|2|6|3|6|3|6|7",  // academic
        "6|4|5|4|3|6|5|3|4|3|3|3|3|5|4|4|4|3|3|3",  // adventurer
        "4|5|3|7|5|5|3|4|2|7|6|7|7|2|6|3|6|3|6|7",  // advisor
        "2|2|2|5|8|3|3|4|2|4|2|8|6|2|2|2|2|2|6|5",  // alchemist
        "4|3|5|5|2|3|3|3|3|2|6|6|2|3|2|2|2|2|2|5",  // apothecary
        "3|3|2|3|6|4|2|2|2|6|2|5|5|2|2|2|2|2|4|5",  // apprentice
        "7|4|6|5|4|2|4|2|5|3|2|2|2|8|4|2|5|2|2|2",  // archer
        "4|3|6|4|4|2|4|2|6|3|2|4|3|6|2|2|3|2|3|4",  // artillerist
        "4|3|8|5|9|5|8|4|3|2|3|4|4|3|6|4|4|3|5|4",  // artisan
        "4|3|8|5|9|5|8|4|3|2|3|4|4|3|6|4|4|3|5|4",  // artist
        "8|7|8|6|6|8|9|5|9|5|2|5|6|8|2|9|3|4|5|4",  // assassin
        "3|3|3|5|2|2|5|2|4|2|5|2|2|3|8|2|2|2|2|2",  // bailiff
        "6|5|6|5|2|6|5|2|6|3|4|2|2|6|6|6|6|6|3|3",  // bandit
        "8|6|9|6|3|5|8|3|7|3|3|3|3|6|5|5|9|5|9|5",  // barbarian
        "6|3|5|7|5|8|4|9|6|3|7|7|7|4|9|5|5|5|5|5",  // bard
        "3|2|3|5|2|8|6|5|2|2|2|2|2|2|4|5|5|5|2|2",  // beggar
        "6|6|9|5|5|2|7|4|3|2|2|2|2|4|2|2|6|4|2|2",  // boatman
        "7|5|7|8|3|7|7|3|6|3|3|3|3|6|5|4|4|3|3|3",  // bountyhunter
        "2|2|2|4|4|2|2|2|2|2|6|2|2|2|5|2|3|2|2|3",  // burgher
        "9|2|6|9|5|8|6|2|2|5|2|2|5|2|6|9|4|9|4|4",  // burglar
        "4|6|4|7|5|4|5|4|2|3|8|4|4|4|7|2|4|2|4|4",  // castellan
        "6|7|6|5|3|4|6|3|5|3|3|3|3|5|5|4|4|3|3|3",  // cavalry
        "9|7|9|6|6|7|7|3|8|5|8|8|8|8|8|6|6|3|6|7",  // censor
        "3|3|3|3|3|9|3|3|3|3|8|5|5|3|9|5|3|7|3|3",  // charlatan
        "6|3|6|5|3|2|6|2|7|7|6|6|6|6|4|4|5|2|9|9",  // cleric
        "3|9|6|4|2|6|2|3|2|2|2|2|2|5|4|3|3|2|2|2",  // coachman
        "5|2|3|6|6|9|4|7|3|2|5|6|6|4|9|6|4|6|6|6",  // conartist
        "7|3|7|7|3|7|5|7|3|3|4|5|4|3|9|5|5|4|5|4",  // courtesan
        "6|3|6|6|3|6|4|6|3|3|4|4|4|3|8|4|4|4|4|4",  // courtier
        "4|3|8|5|9|5|8|4|3|2|3|4|4|3|6|4|4|3|5|4",  // craftsman
        "6|3|6|5|3|2|6|2|7|7|6|6|6|6|4|4|5|2|9|9",  // cultist
        "6|2|5|7|2|7|4|2|5|2|2|2|2|6|2|7|5|7|5|2",  // cutpurse
        "6|3|6|5|3|2|6|2|7|7|6|6|6|6|4|4|5|2|9|9",  // druid
        "9|4|7|7|4|7|7|5|7|3|5|5|5|7|7|6|6|7|5|4",  // duelist
        "2|6|2|6|9|6|2|5|2|4|5|9|9|6|6|5|5|4|7|6",  // enchanter
        "2|2|4|5|9|2|7|2|3|2|2|7|9|3|2|2|4|2|6|7",  // engineer
        "5|4|5|6|2|5|5|9|4|2|3|5|4|3|9|5|4|5|5|4",  // entertainer
        "6|2|4|5|2|4|7|4|3|2|5|2|2|3|6|2|5|2|2|2",  // envoy
        "6|2|9|2|2|2|7|2|6|2|2|2|2|2|5|2|2|2|4|2",  // executioner
        "4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4",  // farmer (fixed the 4.4 typo)
        "2|2|2|8|3|9|2|6|3|2|5|5|5|3|8|4|2|6|2|2",  // fence
        "2|6|6|6|8|6|6|4|4|4|4|9|9|6|5|7|9|6|7|6",  // footwizard
        "5|4|5|7|2|7|2|2|4|2|4|4|4|2|2|7|7|2|4|4",  // forager
        "2|2|2|8|9|9|2|6|3|2|5|5|5|3|8|4|2|6|2|2",  // forger
        "7|5|7|6|3|7|7|3|6|3|3|3|3|6|5|4|4|3|3|3",  // guard
        "4|4|4|8|6|5|6|3|3|8|5|5|6|3|7|5|6|3|7|8",  // healer
        "8|7|8|6|2|4|9|3|9|3|5|5|4|7|6|3|5|5|6|5",  // hedgeknight
        "2|6|2|6|6|6|2|5|2|4|5|6|6|6|6|5|5|4|6|6",  // hedgemage
        "2|2|2|4|2|6|2|9|2|2|5|2|2|2|4|2|2|2|2|2",  // herald
        "2|4|2|2|7|2|2|2|2|6|2|5|7|2|2|2|6|2|4|5",  // herbalist
        "5|9|7|5|3|2|7|2|2|3|2|2|2|5|2|2|6|2|4|3",  // herder
        "6|5|6|5|2|6|5|4|6|3|4|2|2|6|6|6|6|6|3|3",  // highwayman
        "6|9|6|7|4|4|5|3|3|3|3|4|3|9|5|6|8|3|5|4",  // hunter
        "4|2|6|8|2|8|6|2|4|5|6|4|3|3|8|2|2|4|6|5",  // interrogator
        "4|4|4|9|2|4|4|6|4|2|2|5|3|4|5|6|5|5|4|3",  // investigator
        "5|2|7|2|2|5|7|2|6|2|4|2|2|2|2|6|5|4|2|2",  // jailer
        "8|7|8|6|2|4|9|3|9|3|8|5|4|7|6|3|5|2|6|5",  // knight
        "2|2|2|6|2|9|2|9|2|2|9|9|9|2|9|2|2|2|5|7",  // lawyer
        "2|6|2|6|8|6|2|5|2|4|5|9|9|6|6|5|5|4|7|6",  // mage
        "7|5|7|6|3|7|7|3|6|3|3|3|3|6|5|4|4|3|3|3",  // marshal
        "8|6|8|6|3|7|7|3|7|3|3|3|3|7|5|4|4|3|3|3",  // mercenary
        "5|5|5|9|7|9|5|6|3|2|6|6|5|3|9|4|4|5|7|5",  // merchant
        "6|2|4|5|2|4|7|4|3|2|5|2|2|3|6|2|5|2|2|2",  // messenger
        "4|2|9|7|2|9|2|2|2|2|2|2|2|2|2|2|6|2|6|3",  // miner
        "5|6|4|9|6|6|6|6|6|7|5|7|7|5|9|3|3|3|9|9",  // monk
        "2|6|2|6|8|6|2|5|2|4|5|9|9|6|6|5|5|4|7|6",  // necromancer
        "5|4|5|5|2|5|5|5|5|3|6|4|5|5|7|2|2|3|5|4",  // noble
        "5|6|4|9|6|6|6|6|6|7|5|7|7|5|9|3|3|3|9|9",  // nun
        "7|5|7|6|3|7|7|3|6|3|3|3|3|6|5|6|6|8|3|3",  // outlaw
        "8|7|8|6|2|2|9|3|9|5|8|6|4|7|6|3|5|2|9|9",  // paladin
        "5|7|5|5|5|6|7|7|2|2|3|3|2|2|3|3|3|3|3|3",  // peasant
        "4|4|4|5|5|6|7|7|2|2|3|3|2|2|7|3|3|3|3|3",  // pedlar
        "2|2|2|9|6|2|2|2|2|9|7|9|9|2|7|2|2|2|6|9",  // physician
        "7|3|7|6|3|8|6|4|6|3|4|5|6|7|7|7|7|7|5|5",  // pirate
        "7|5|7|6|3|7|7|3|6|3|3|3|3|6|5|4|4|3|3|3",  // pitfighter
        "5|3|5|7|6|6|6|2|4|7|6|8|7|5|7|5|5|3|9|9",  // priest
        "7|6|8|7|6|8|8|4|7|4|3|5|4|7|7|6|9|6|6|5",  // raider
        "7|9|8|6|3|4|7|3|7|3|3|5|4|9|6|6|9|4|6|3",  // ranger
        "7|5|8|6|3|7|6|5|6|3|4|6|4|7|7|8|6|8|5|4",  // rogue
        "9|8|9|7|2|4|9|3|9|3|9|5|4|8|6|3|5|2|6|5",  // royalguard
        "6|4|6|6|2|5|5|5|7|3|9|4|5|7|7|2|2|3|5|5",  // royal
        "4|5|3|9|7|5|3|4|2|9|7|9|9|2|7|3|6|3|7|9",  // sage
        "7|6|9|5|5|2|7|4|3|2|2|2|2|5|2|2|8|5|2|2",  // sailor
        "2|2|2|4|2|2|2|2|2|4|2|9|9|2|2|2|2|2|2|6",  // scholar
        "6|6|6|9|2|5|6|2|5|2|2|4|4|7|2|6|8|3|3|3",  // scout
        "2|3|2|9|5|8|2|8|2|4|4|6|5|2|7|2|2|4|6|5",  // seer
        "6|6|7|6|5|6|8|3|7|3|2|3|3|7|6|5|9|4|5|3",  // sentinel
        "7|4|5|7|5|7|4|7|2|2|2|4|6|3|9|4|3|3|5|4",  // servant
        "2|6|2|6|8|9|2|5|2|4|5|9|9|6|6|9|5|4|7|6",  // shadowmage
        "4|6|4|9|5|7|5|5|3|5|3|5|6|3|6|6|5|4|9|8",  // shaman
        "4|3|4|5|2|2|5|2|5|2|7|2|2|3|8|2|2|2|2|2",  // sheriff
        "7|4|5|7|5|7|4|7|2|2|2|4|6|3|9|4|3|3|5|4",  // slave
        "4|3|8|5|9|5|8|4|3|2|3|4|4|3|6|4|4|3|5|4",  // smith
        "5|3|5|6|3|8|6|4|6|3|4|5|6|7|7|7|7|7|5|5",  // smuggler
        "7|5|7|6|3|7|7|3|6|3|3|3|3|6|5|4|4|3|3|3",  // soldier
        "2|6|2|6|8|6|2|5|2|4|5|9|9|6|6|5|5|4|7|8",  // sorcerer
        "7|5|7|6|3|7|7|3|6|3|3|3|3|6|5|4|4|3|7|3",  // spearman
        "2|6|2|6|8|6|2|5|2|4|5|9|9|6|6|5|5|4|7|6",  // spellmonger
        "8|4|6|9|4|9|4|5|3|3|2|5|5|3|7|9|8|5|5|5",  // spy
        "5|7|5|5|3|5|5|3|5|2|2|3|2|5|5|4|5|3|3|3",  // squire
        "4|6|4|7|5|4|5|4|2|3|8|4|4|4|7|2|4|2|4|4",  // steward
        "2|2|2|4|2|2|2|2|2|4|2|6|6|2|2|2|2|2|2|4",  // student
        "9|4|7|7|4|7|7|5|7|3|5|5|5|7|7|6|6|7|5|4",  // swordmaster
        "7|5|7|6|3|7|7|3|6|3|3|3|3|6|5|4|4|3|3|3",  // swornsword
        "5|3|5|6|4|7|5|6|3|2|3|4|4|5|8|3|5|4|4|4",  // tavernhelp
        "2|6|2|8|8|6|2|5|2|4|5|9|9|6|5|5|3|4|9|9",  // thaumaturge
        "9|3|7|8|3|9|6|5|5|3|3|6|4|8|7|9|6|9|5|4",  // thief
        "6|5|8|5|6|7|9|3|7|3|2|3|3|8|6|5|9|5|5|3",  // tribesman
        "5|7|5|5|5|6|7|7|2|2|3|3|2|2|3|3|3|3|3|3",  // villager
        "4|4|4|4|4|2|5|2|4|2|7|3|4|4|2|6|6|2|3|2",  // warden
        "4|6|4|9|5|7|5|5|3|5|3|5|6|3|6|6|5|4|9|8",  // warlock
        "9|6|9|9|6|6|8|3|9|6|8|9|9|8|5|6|4|3|8|8",  // warmage
        "7|5|7|6|3|7|7|3|6|3|3|3|3|6|5|4|4|3|3|3",  // warrior
        "7|5|7|6|3|7|7|3|7|3|3|3|3|6|5|4|4|3|3|3",  // watchman
        "8|4|6|9|4|9|4|5|3|3|2|5|5|3|7|9|8|5|5|5",  // whisperer
        "7|3|7|6|3|8|5|7|3|3|2|4|3|3|9|5|5|5|5|4",  // whore
        "6|5|8|5|6|7|9|3|7|3|2|3|3|8|6|5|9|5|5|3",  // wildling
        "4|6|4|9|5|7|5|5|3|5|3|5|6|3|6|6|5|4|9|8",  // witch
        "7|5|7|6|3|7|7|3|7|3|8|6|6|6|5|6|4|3|6|7",  // witchhunter
        "2|6|2|6|8|6|2|5|2|4|5|9|9|6|5|5|3|4|6|6",  // wizard
        "5|7|7|2|7|2|9|2|4|3|2|2|2|8|2|4|9|2|2|2",  // woodsman
        "4|4|4|4|4|2|5|2|6|2|7|3|4|5|2|6|6|2|3|2",  // yeoman
        "4|2|5|4|2|6|5|8|3|2|6|2|2|2|9|4|3|2|7|4"   // zealot
    ],
    
    // Class descriptions and metadata
    classDescriptions: {
        academic: { desc: 'A scholar dedicated to learning and research.', icon: '📚', vocation: 'scholarship' },
        adventurer: { desc: 'A wanderer seeking fortune and glory.', icon: '🗡️', vocation: 'exploration' },
        advisor: { desc: 'A trusted counselor to nobles and rulers.', icon: '📜', vocation: 'diplomacy' },
        alchemist: { desc: 'A practitioner of arcane chemistry.', icon: '⚗️', vocation: 'crafting' },
        apothecary: { desc: 'A healer who prepares medicines and remedies.', icon: '💊', vocation: 'healing' },
        apprentice: { desc: 'A student learning a trade or craft.', icon: '📖', vocation: 'learning' },
        archer: { desc: 'A skilled marksman with bow and arrow.', icon: '🏹', vocation: 'combat' },
        artillerist: { desc: 'An expert in siege weapons and cannons.', icon: '💣', vocation: 'warfare' },
        artisan: { desc: 'A skilled craftsperson of fine goods.', icon: '🛠️', vocation: 'crafting' },
        artist: { desc: 'A creator of paintings, sculptures, and art.', icon: '🎨', vocation: 'creativity' },
        assassin: { desc: 'A deadly killer for hire.', icon: '🗡️', vocation: 'stealth' },
        bailiff: { desc: 'An officer who enforces court orders.', icon: '⚖️', vocation: 'law' },
        bandit: { desc: 'An outlaw who robs travelers.', icon: '💰', vocation: 'crime' },
        barbarian: { desc: 'A fierce warrior from uncivilized lands.', icon: '⚔️', vocation: 'combat' },
        bard: { desc: 'A traveling performer and storyteller.', icon: '🎵', vocation: 'entertainment' },
        beggar: { desc: 'A penniless soul surviving on charity.', icon: '🙏', vocation: 'survival' },
        boatman: { desc: 'A skilled navigator of rivers and lakes.', icon: '🚣', vocation: 'transportation' },
        bountyhunter: { desc: 'A tracker who hunts fugitives for reward.', icon: '🎯', vocation: 'hunting' },
        burgher: { desc: 'A respectable middle-class citizen.', icon: '🏠', vocation: 'commerce' },
        burglar: { desc: 'A thief who breaks into buildings.', icon: '🔓', vocation: 'crime' },
        castellan: { desc: 'The keeper and commander of a castle.', icon: '🏰', vocation: 'command' },
        cavalry: { desc: 'A mounted soldier skilled in horseback combat.', icon: '🐴', vocation: 'combat' },
        censor: { desc: 'An official who examines and controls content.', icon: '📋', vocation: 'authority' },
        charlatan: { desc: 'A fraudster who deceives for profit.', icon: '🎭', vocation: 'deception' },
        cleric: { desc: 'A religious official devoted to divine service.', icon: '✝️', vocation: 'faith' },
        coachman: { desc: 'A driver of horse-drawn carriages.', icon: '🐎', vocation: 'transportation' },
        conartist: { desc: 'A swindler who gains trust to steal.', icon: '🎩', vocation: 'deception' },
        courtesan: { desc: 'A sophisticated companion of the nobility.', icon: '💋', vocation: 'social' },
        courtier: { desc: 'An attendant at a royal court.', icon: '👑', vocation: 'politics' },
        craftsman: { desc: 'A skilled worker in a particular trade.', icon: '🔨', vocation: 'crafting' },
        cultist: { desc: 'A follower of forbidden religious practices.', icon: '🕯️', vocation: 'occult' },
        cutpurse: { desc: 'A pickpocket and petty thief.', icon: '✂️', vocation: 'crime' },
        druid: { desc: 'A keeper of nature and ancient wisdom.', icon: '🌳', vocation: 'nature' },
        duelist: { desc: 'A fighter who specializes in one-on-one combat.', icon: '⚔️', vocation: 'combat' },
        enchanter: { desc: 'A mage who imbues objects with magic.', icon: '✨', vocation: 'magic' },
        engineer: { desc: 'A designer and builder of machines.', icon: '⚙️', vocation: 'invention' },
        entertainer: { desc: 'A performer who amuses audiences.', icon: '🎪', vocation: 'entertainment' },
        envoy: { desc: 'A diplomatic messenger between powers.', icon: '📨', vocation: 'diplomacy' },
        executioner: { desc: 'One who carries out death sentences.', icon: '⚰️', vocation: 'death' },
        farmer: { desc: 'A cultivator of land and crops.', icon: '🌾', vocation: 'agriculture' },
        fence: { desc: 'A dealer in stolen goods.', icon: '🏪', vocation: 'crime' },
        footwizard: { desc: 'A battle mage who fights alongside infantry.', icon: '🧙', vocation: 'war_magic' },
        forager: { desc: 'One who gathers wild food and resources.', icon: '🍄', vocation: 'survival' },
        forger: { desc: 'A counterfeiter of documents or currency.', icon: '📄', vocation: 'crime' },
        guard: { desc: 'A protector of people or property.', icon: '🛡️', vocation: 'protection' },
        healer: { desc: 'A practitioner of medicine and care.', icon: '💚', vocation: 'healing' },
        hedgeknight: { desc: 'A wandering knight without a lord.', icon: '🗡️', vocation: 'combat' },
        hedgemage: { desc: 'A self-taught practitioner of magic.', icon: '🌿', vocation: 'magic' },
        herald: { desc: 'An official messenger and announcer.', icon: '📯', vocation: 'announcement' },
        herbalist: { desc: 'An expert in plants and natural remedies.', icon: '🌿', vocation: 'healing' },
        herder: { desc: 'A keeper of livestock and animals.', icon: '🐑', vocation: 'animal_care' },
        highwayman: { desc: 'A mounted robber of travelers.', icon: '🎭', vocation: 'crime' },
        hunter: { desc: 'A tracker and killer of wild game.', icon: '🦌', vocation: 'hunting' },
        interrogator: { desc: 'An expert at extracting information.', icon: '❓', vocation: 'investigation' },
        investigator: { desc: 'A solver of mysteries and crimes.', icon: '🔍', vocation: 'investigation' },
        jailer: { desc: 'A keeper of prisoners and dungeons.', icon: '🔐', vocation: 'custody' },
        knight: { desc: 'An armored warrior of noble birth.', icon: '⚔️', vocation: 'combat' },
        lawyer: { desc: 'A practitioner of law and advocacy.', icon: '⚖️', vocation: 'law' },
        mage: { desc: 'A wielder of arcane magical powers.', icon: '🧙', vocation: 'magic' },
        marshal: { desc: 'A high-ranking military officer.', icon: '⭐', vocation: 'command' },
        mercenary: { desc: 'A soldier for hire.', icon: '💰', vocation: 'combat' },
        merchant: { desc: 'A trader of goods and commodities.', icon: '💵', vocation: 'commerce' },
        messenger: { desc: 'A carrier of letters and news.', icon: '📬', vocation: 'transportation' },
        miner: { desc: 'A digger of ore and precious metals.', icon: '⛏️', vocation: 'mining' },
        monk: { desc: 'A religious ascetic devoted to contemplation.', icon: '🙏', vocation: 'faith' },
        necromancer: { desc: 'A mage who commands the dead.', icon: '💀', vocation: 'dark_magic' },
        noble: { desc: 'A person of high birth and privilege.', icon: '👑', vocation: 'nobility' },
        nun: { desc: 'A woman devoted to religious life.', icon: '🙏', vocation: 'faith' },
        outlaw: { desc: 'A criminal outside the protection of law.', icon: '🏴', vocation: 'crime' },
        paladin: { desc: 'A holy warrior devoted to justice.', icon: '⚔️', vocation: 'holy_combat' },
        peasant: { desc: 'A common agricultural laborer.', icon: '🧑‍🌾', vocation: 'labor' },
        pedlar: { desc: 'A traveling seller of small goods.', icon: '🛒', vocation: 'commerce' },
        physician: { desc: 'A learned doctor of medicine.', icon: '⚕️', vocation: 'medicine' },
        pirate: { desc: 'A sea-faring raider and plunderer.', icon: '🏴‍☠️', vocation: 'piracy' },
        pitfighter: { desc: 'A combatant in arena battles.', icon: '🏟️', vocation: 'combat' },
        priest: { desc: 'A religious leader and spiritual guide.', icon: '⛪', vocation: 'faith' },
        raider: { desc: 'A warrior who attacks and plunders.', icon: '⚔️', vocation: 'combat' },
        ranger: { desc: 'A wilderness expert and scout.', icon: '🏹', vocation: 'exploration' },
        rogue: { desc: 'A cunning trickster and thief.', icon: '🗡️', vocation: 'stealth' },
        royalguard: { desc: 'An elite protector of royalty.', icon: '🛡️', vocation: 'protection' },
        royal: { desc: 'A member of the ruling family.', icon: '👑', vocation: 'nobility' },
        sage: { desc: 'A wise person of great knowledge.', icon: '📖', vocation: 'scholarship' },
        sailor: { desc: 'A crew member of seafaring vessels.', icon: '⛵', vocation: 'sailing' },
        scholar: { desc: 'A dedicated student and researcher.', icon: '📚', vocation: 'scholarship' },
        scout: { desc: 'A reconnaissance specialist.', icon: '👁️', vocation: 'exploration' },
        seer: { desc: 'One who perceives the future.', icon: '🔮', vocation: 'divination' },
        sentinel: { desc: 'A vigilant guard and watcher.', icon: '🗼', vocation: 'protection' },
        servant: { desc: 'One who serves a master.', icon: '🧹', vocation: 'service' },
        shadowmage: { desc: 'A mage who wields shadow magic.', icon: '🌑', vocation: 'dark_magic' },
        shaman: { desc: 'A spiritual leader with nature magic.', icon: '🪶', vocation: 'spirit_magic' },
        sheriff: { desc: 'A law enforcement officer.', icon: '⭐', vocation: 'law' },
        slave: { desc: 'One bound in servitude.', icon: '⛓️', vocation: 'bondage' },
        smith: { desc: 'A worker of metal and forge.', icon: '🔨', vocation: 'crafting' },
        smuggler: { desc: 'A trader in illegal goods.', icon: '📦', vocation: 'crime' },
        soldier: { desc: 'A trained military combatant.', icon: '⚔️', vocation: 'combat' },
        sorcerer: { desc: 'A mage with innate magical ability.', icon: '✨', vocation: 'magic' },
        spearman: { desc: 'A soldier armed with a spear.', icon: '🔱', vocation: 'combat' },
        spellmonger: { desc: 'A dealer in magical services.', icon: '📜', vocation: 'magic' },
        spy: { desc: 'A gatherer of secret information.', icon: '🕵️', vocation: 'espionage' },
        squire: { desc: 'A knight in training.', icon: '🛡️', vocation: 'training' },
        steward: { desc: 'A manager of a noble household.', icon: '🏠', vocation: 'administration' },
        student: { desc: 'One who studies under a teacher.', icon: '📖', vocation: 'learning' },
        swordmaster: { desc: 'An expert in sword combat.', icon: '⚔️', vocation: 'combat' },
        swornsword: { desc: 'A sellsword bound by oath.', icon: '⚔️', vocation: 'combat' },
        tavernhelp: { desc: 'A worker at a tavern or inn.', icon: '🍺', vocation: 'service' },
        thaumaturge: { desc: 'A worker of miracles and wonders.', icon: '✨', vocation: 'miracle_work' },
        thief: { desc: 'A stealer of property.', icon: '💰', vocation: 'crime' },
        tribesman: { desc: 'A member of a tribal society.', icon: '🏹', vocation: 'survival' },
        villager: { desc: 'A resident of a village.', icon: '🏘️', vocation: 'community' },
        warden: { desc: 'A guardian and protector.', icon: '🛡️', vocation: 'protection' },
        warlock: { desc: 'A mage who made a dark pact.', icon: '😈', vocation: 'dark_magic' },
        warmage: { desc: 'A mage specialized in battle magic.', icon: '🔥', vocation: 'war_magic' },
        warrior: { desc: 'A fighter trained for battle.', icon: '⚔️', vocation: 'combat' },
        watchman: { desc: 'A guard who patrols and watches.', icon: '👁️', vocation: 'protection' },
        whisperer: { desc: 'A spreader of secrets and rumors.', icon: '🤫', vocation: 'espionage' },
        whore: { desc: 'A seller of companionship.', icon: '💋', vocation: 'service' },
        wildling: { desc: 'A person from beyond civilization.', icon: '🌲', vocation: 'survival' },
        witch: { desc: 'A practitioner of folk magic.', icon: '🧹', vocation: 'magic' },
        witchhunter: { desc: 'A hunter of dark magic users.', icon: '🔥', vocation: 'hunting' },
        wizard: { desc: 'A learned master of arcane arts.', icon: '🧙', vocation: 'magic' },
        woodsman: { desc: 'A forest dweller and lumberjack.', icon: '🪓', vocation: 'forestry' },
        yeoman: { desc: 'A free farmer of modest means.', icon: '🏡', vocation: 'agriculture' },
        zealot: { desc: 'A fanatical religious devotee.', icon: '🔥', vocation: 'faith' }
    },
    
    // ========================= HELPER FUNCTIONS =========================
    
    /**
     * Parse stat caps string into object
     */
    parseStatCaps(capsString) {
        const caps = {};
        const values = capsString.split('|').map(v => parseInt(v.trim()) || 5);
        this.statNames.forEach((stat, index) => {
            caps[stat] = values[index] || 5;
        });
        return caps;
    },
    
    /**
     * Get default stats object (all at 2)
     */
    getDefaultStats() {
        const stats = {};
        this.statNames.forEach(stat => {
            stats[stat] = this.defaultStatValue;
        });
        return stats;
    },
    
    /**
     * Build complete class object
     */
    buildClass(index) {
        const name = this.classNames[index];
        const capsString = this.classStatCaps[index];
        const meta = this.classDescriptions[name] || { desc: '', icon: '❓', vocation: 'general' };
        
        return {
            id: name,
            name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
            description: meta.desc,
            icon: meta.icon,
            image: `images/classes/Class_Overview_${name}.png`,
            vocation_id: meta.vocation,
            stat_maximums: this.parseStatCaps(capsString),
            stat_minimums: {}, // No minimums in F3
            prerequisites: {},
            exit_careers: [],
            xp_cost: 0,
            enabled: true
        };
    },
    
    /**
     * Build complete species object
     */
    buildSpecies(speciesData) {
        return {
            id: speciesData.id,
            name: speciesData.name,
            description: speciesData.description,
            icon: speciesData.icon,
            image: `images/species/${speciesData.id}.png`,
            base_stats: this.getDefaultStats(), // All species start with 2s
            stat_caps: this.getDefaultStatCaps(), // Species don't limit caps in F3
            abilities: [],
            allowed_classes: this.classNames, // All classes available
            enabled: true
        };
    },
    
    /**
     * Get default stat caps (all at 9)
     */
    getDefaultStatCaps() {
        const caps = {};
        this.statNames.forEach(stat => {
            caps[stat] = 9;
        });
        return caps;
    },
    
    /**
     * Get all classes as array
     */
    getAllClasses() {
        return this.classNames.map((_, index) => this.buildClass(index));
    },
    
    /**
     * Get all species as array
     */
    getAllSpecies() {
        return this.species.map(s => this.buildSpecies(s));
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.F4_SEED_DATA = F4_SEED_DATA;
}
if (typeof module !== 'undefined') {
    module.exports = F4_SEED_DATA;
}

