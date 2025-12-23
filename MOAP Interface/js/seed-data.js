/**
 * Feudalism 4 - Seed Data
 * Extracted from Feudalism 3 LSL scripts with F4 enhancements
 * 
 * Contains:
 * - 20 F3 Stats (in order)
 * - 21 Species with stat ranges and resource pools
 * - 122 Classes with stat caps, prerequisites, and advancement paths
 * - 6 Gender options
 */

const F4_SEED_DATA = {
    
    // ========================= STATS =========================
    statNames: [
        'agility', 'animal_handling', 'athletics', 'awareness', 'crafting',
        'deception', 'endurance', 'entertaining', 'fighting', 'healing',
        'influence', 'intelligence', 'knowledge', 'marksmanship', 'persuasion',
        'stealth', 'survival', 'thievery', 'will', 'wisdom'
    ],
    
    defaultStatValue: 2,
    
    // ========================= GENDERS =========================
    genders: [
        { id: 'male', name: 'Male', icon: '♂', description: 'Masculine identity' },
        { id: 'female', name: 'Female', icon: '♀', description: 'Feminine identity' },
        { id: 'transgender', name: 'Transgender', icon: '⚧', description: 'Gender differs from birth assignment' },
        { id: 'hermaphrodite', name: 'Hermaphrodite', icon: '⚥', description: 'Both masculine and feminine characteristics' },
        { id: 'nonbinary', name: 'Non-Binary', icon: '⚪', description: 'Identity outside the gender binary' },
        { id: 'other', name: 'Other', icon: '✧', description: 'Custom or unspecified identity' }
    ],
    
    // ========================= SPECIES =========================
    // 21 species with stat ranges and resource pools
    species: [
        { 
            id: 'human', name: 'Human', 
            description: 'Versatile and adaptable. The most common race in the realm.',
            icon: '👤', image: 'species/human.png',
            stat_minimums: {}, // No minimums - humans are versatile
            stat_maximums: {}, // No caps beyond default 9
            base_stats: {},    // All at default 2
            health: 100, stamina: 100, mana: 50
        },
        { 
            id: 'elf', name: 'Elf', 
            description: 'Graceful and long-lived. Masters of magic and archery.',
            icon: '🧝', image: 'species/elf.png',
            stat_minimums: { agility: 3, awareness: 3 },
            stat_maximums: { endurance: 7, athletics: 7 },
            base_stats: { agility: 3, awareness: 3, marksmanship: 3 },
            health: 80, stamina: 90, mana: 120
        },
        { 
            id: 'dwarf', name: 'Dwarf', 
            description: 'Stout and resilient craftsmen. Masters of stone and steel.',
            icon: '⛏️', image: 'species/dwarf.png',
            stat_minimums: { endurance: 3, crafting: 3 },
            stat_maximums: { agility: 6, stealth: 6 },
            base_stats: { endurance: 4, crafting: 3, athletics: 3 },
            health: 130, stamina: 120, mana: 30
        },
        { 
            id: 'halfling', name: 'Halfling', 
            description: 'Small but lucky. Known for their stealth and charm.',
            icon: '🍀', image: 'species/halfling.png',
            stat_minimums: { stealth: 3, thievery: 2 },
            stat_maximums: { fighting: 6, athletics: 6 },
            base_stats: { stealth: 3, thievery: 3, persuasion: 3 },
            health: 70, stamina: 110, mana: 60
        },
        { 
            id: 'gnome', name: 'Gnome', 
            description: 'Clever and inventive. Masters of illusion and tinkering.',
            icon: '🔧', image: 'species/gnome.png',
            stat_minimums: { intelligence: 3, crafting: 2 },
            stat_maximums: { fighting: 5, endurance: 6 },
            base_stats: { intelligence: 4, crafting: 3, deception: 3 },
            health: 60, stamina: 80, mana: 100
        },
        { 
            id: 'dragonborn', name: 'Dragonborn', 
            description: 'Proud dragon-blooded warriors with breath weapons.',
            icon: '🐉', image: 'species/dragonborn.png',
            stat_minimums: { endurance: 3, will: 3 },
            stat_maximums: { stealth: 5, thievery: 5 },
            base_stats: { endurance: 3, will: 3, fighting: 3 },
            health: 120, stamina: 100, mana: 80
        },
        { 
            id: 'half-elf', name: 'Half-Elf', 
            description: 'Blending human adaptability with elven grace.',
            icon: '🌙', image: 'species/half-elf.png',
            stat_minimums: { awareness: 2 },
            stat_maximums: {},
            base_stats: { awareness: 3, persuasion: 3 },
            health: 90, stamina: 95, mana: 80
        },
        { 
            id: 'half-orc', name: 'Half-Orc', 
            description: 'Strong and fierce. Warriors with orcish blood.',
            icon: '💪', image: 'species/half-orc.png',
            stat_minimums: { athletics: 3, endurance: 3 },
            stat_maximums: { intelligence: 6, persuasion: 5 },
            base_stats: { athletics: 4, endurance: 3, fighting: 3 },
            health: 140, stamina: 130, mana: 20
        },
        { 
            id: 'tiefling', name: 'Tiefling', 
            description: 'Touched by infernal heritage. Mistrusted but powerful.',
            icon: '😈', image: 'species/tiefling.png',
            stat_minimums: { will: 3 },
            stat_maximums: { healing: 6 },
            base_stats: { will: 3, deception: 3, intelligence: 3 },
            health: 90, stamina: 90, mana: 110
        },
        { 
            id: 'drow', name: 'Drow', 
            description: 'Dark elves from the underdark. Masters of shadow.',
            icon: '🌑', image: 'species/drow.png',
            stat_minimums: { stealth: 3, awareness: 3 },
            stat_maximums: { healing: 5 },
            base_stats: { stealth: 4, awareness: 3, deception: 3 },
            health: 75, stamina: 85, mana: 100
        },
        { 
            id: 'demon', name: 'Demon', 
            description: 'Creatures of the abyss. Powerful but feared.',
            icon: '👹', image: 'species/demon.png',
            stat_minimums: { will: 4, endurance: 3 },
            stat_maximums: { healing: 4, wisdom: 5 },
            base_stats: { will: 4, endurance: 3, fighting: 4 },
            health: 150, stamina: 120, mana: 100
        },
        { 
            id: 'imp', name: 'Imp', 
            description: 'Small mischievous devils. Cunning tricksters.',
            icon: '👿', image: 'species/imp.png',
            stat_minimums: { agility: 3, deception: 3 },
            stat_maximums: { athletics: 5, fighting: 5 },
            base_stats: { agility: 4, deception: 4, thievery: 3 },
            health: 50, stamina: 100, mana: 90
        },
        { 
            id: 'werewolf', name: 'Werewolf', 
            description: 'Cursed shapeshifters. Fierce when transformed.',
            icon: '🐺', image: 'species/werewolf.png',
            stat_minimums: { endurance: 3, survival: 3 },
            stat_maximums: { intelligence: 6, crafting: 5 },
            base_stats: { endurance: 3, survival: 4, awareness: 3 },
            health: 130, stamina: 140, mana: 30
        },
        { 
            id: 'vampire', name: 'Vampire', 
            description: 'Undead immortals. Powerful but vulnerable to sunlight.',
            icon: '🧛', image: 'species/vampire.png',
            stat_minimums: { influence: 3, will: 3 },
            stat_maximums: { healing: 3 },
            base_stats: { influence: 4, will: 3, deception: 3 },
            health: 100, stamina: 80, mana: 120
        },
        { 
            id: 'merfolk', name: 'Merfolk', 
            description: 'Aquatic beings of the deep. Masters of the sea.',
            icon: '🧜', image: 'species/merfolk.png',
            stat_minimums: { athletics: 3 },
            stat_maximums: { crafting: 5 },
            base_stats: { athletics: 4, survival: 3, awareness: 3 },
            health: 90, stamina: 120, mana: 80
        },
        { 
            id: 'fairy', name: 'Fairy', 
            description: 'Tiny magical beings with wings. Masters of enchantment.',
            icon: '🧚', image: 'species/fairy.png',
            stat_minimums: { agility: 4 },
            stat_maximums: { athletics: 4, fighting: 4, endurance: 4 },
            base_stats: { agility: 4, entertaining: 3, will: 3 },
            health: 40, stamina: 70, mana: 150
        },
        { 
            id: 'satyr', name: 'Satyr', 
            description: 'Half-goat forest dwellers. Lovers of music and revelry.',
            icon: '🎭', image: 'species/satyr.png',
            stat_minimums: { entertaining: 3, agility: 2 },
            stat_maximums: {},
            base_stats: { entertaining: 4, agility: 3, persuasion: 3 },
            health: 95, stamina: 110, mana: 70
        },
        { 
            id: 'minotaur', name: 'Minotaur', 
            description: 'Bull-headed warriors. Powerful and relentless.',
            icon: '🐂', image: 'species/minotaur.png',
            stat_minimums: { athletics: 4, endurance: 3 },
            stat_maximums: { intelligence: 5, stealth: 4, thievery: 4 },
            base_stats: { athletics: 5, endurance: 4, fighting: 3 },
            health: 160, stamina: 140, mana: 20
        },
        { 
            id: 'reptilian', name: 'Reptilian', 
            description: 'Cold-blooded lizard folk. Ancient and patient.',
            icon: '🦎', image: 'species/reptilian.png',
            stat_minimums: { endurance: 3, awareness: 2 },
            stat_maximums: { influence: 5, persuasion: 5 },
            base_stats: { endurance: 3, awareness: 3, survival: 3 },
            health: 110, stamina: 100, mana: 60
        },
        { 
            id: 'goblin', name: 'Goblin', 
            description: 'Small green-skinned creatures. Cunning survivors.',
            icon: '👺', image: 'species/goblin.png',
            stat_minimums: { stealth: 2, thievery: 2 },
            stat_maximums: { influence: 5, persuasion: 4 },
            base_stats: { stealth: 3, thievery: 3, survival: 3 },
            health: 65, stamina: 95, mana: 50
        }
    ],
    
    // ========================= CLASSES =========================
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
        "3|3|4|4|6|5|4|2|2|2|7|6|5|2|7|2|2|2|2|4",  // burgher
        "7|3|4|7|5|8|3|5|3|2|3|5|5|3|5|8|3|8|3|3",  // burglar
        "5|6|5|6|6|5|6|5|5|4|8|6|6|5|8|3|5|3|6|6",  // castellan
        "6|8|6|6|4|2|6|2|6|3|4|2|2|4|4|2|4|2|3|2",  // cavalry
        "2|2|2|6|4|6|2|2|2|2|6|7|7|2|8|2|2|2|6|6",  // censor
        "5|3|4|6|5|9|4|6|2|3|7|5|5|2|8|4|3|4|4|3",  // charlatan
        "4|3|4|5|4|3|5|4|3|7|7|5|6|2|8|2|4|2|7|8",  // cleric
        "4|6|4|4|4|2|5|2|3|2|2|2|2|3|2|3|3|2|2|2",  // coachman
        "5|3|4|6|5|9|4|6|2|3|7|5|5|2|8|4|3|4|4|3",  // conartist
        "5|2|4|5|3|6|3|6|2|2|7|5|5|2|8|2|2|2|4|3",  // courtesan
        "4|3|4|5|4|5|4|5|2|2|8|5|6|2|8|3|3|2|4|4",  // courtier
        "4|4|7|5|8|3|7|4|4|2|4|5|5|3|5|4|4|3|4|4",  // craftsman
        "2|3|2|3|2|5|3|3|2|2|4|3|4|2|4|3|3|2|8|6",  // cultist
        "5|2|3|5|2|6|2|3|2|2|2|2|2|2|3|7|2|8|2|2",  // cutpurse
        "3|8|4|6|5|3|5|3|3|7|3|5|6|3|3|4|8|2|8|8",  // druid
        "9|3|7|6|4|4|6|3|9|3|3|4|4|3|4|3|3|3|5|3",  // duelist
        "3|4|3|5|6|4|3|4|2|4|4|8|7|2|4|2|3|2|7|6",  // enchanter
        "3|3|5|4|8|3|4|2|3|2|3|8|7|4|3|2|2|2|4|4",  // engineer
        "5|4|5|5|4|6|5|9|2|2|6|4|4|2|7|4|4|3|3|3",  // entertainer
        "4|4|4|5|3|4|4|4|3|2|6|5|6|2|7|3|3|2|4|5",  // envoy
        "4|2|7|4|4|3|6|2|7|2|4|2|2|2|4|2|2|2|4|2",  // executioner
        "4|7|6|4|5|2|7|2|3|3|2|2|2|3|2|2|6|2|2|3",  // farmer
        "4|3|4|6|4|7|3|4|2|2|5|5|5|2|6|4|3|4|3|3",  // fence
        "4|3|5|5|4|3|5|3|6|4|2|6|6|4|2|3|4|2|6|5",  // footwizard
        "4|6|5|5|3|2|5|2|2|4|2|3|4|3|2|4|8|2|2|4",  // forager
        "3|2|3|5|7|7|3|3|2|2|4|5|5|2|4|3|2|4|3|3",  // forger
        "5|3|6|5|3|3|6|2|6|3|4|2|2|4|4|3|3|2|4|3",  // guard
        "3|4|4|5|4|3|4|3|2|8|4|6|6|2|5|2|5|2|5|7",  // healer
        "7|5|7|5|4|4|6|2|7|3|4|3|3|5|4|3|4|2|4|3",  // hedgeknight
        "3|4|3|5|4|4|4|3|3|5|3|6|6|2|4|3|4|2|6|5",  // hedgemage
        "3|3|4|5|3|3|4|4|2|2|6|4|6|2|6|2|3|2|3|4",  // herald
        "3|5|4|6|5|3|4|3|2|7|3|5|6|2|4|3|7|2|4|6",  // herbalist
        "4|8|5|4|3|2|6|2|3|4|2|2|2|3|2|2|5|2|2|2",  // herder
        "7|5|6|6|2|6|6|3|6|3|4|2|2|6|5|5|5|5|3|3",  // highwayman
        "6|6|7|7|4|3|6|2|5|3|2|2|3|7|2|6|7|3|3|3",  // hunter
        "3|3|4|6|3|6|5|3|5|2|5|5|5|2|6|3|3|3|6|4",  // interrogator
        "4|4|5|8|3|6|4|3|3|3|5|6|6|3|6|4|4|3|4|5",  // investigator
        "4|3|5|5|3|4|5|2|5|2|4|2|2|3|4|3|3|3|3|2",  // jailer
        "6|6|7|5|4|3|6|3|8|3|5|3|4|4|5|2|4|2|5|4",  // knight
        "2|2|2|5|3|5|2|3|2|2|6|7|8|2|8|2|2|2|5|6",  // lawyer
        "3|4|3|6|5|4|3|4|2|5|4|8|8|2|4|3|3|2|7|7",  // mage
        "5|5|6|6|4|4|6|3|7|3|7|4|5|5|6|3|4|2|5|4",  // marshal
        "7|4|7|5|3|5|6|2|7|3|3|2|2|6|4|3|4|3|3|2",  // mercenary
        "3|3|4|5|5|5|4|3|2|2|6|5|5|2|7|2|3|2|3|4",  // merchant
        "6|4|5|5|3|3|5|2|3|2|3|2|2|3|3|3|4|2|2|2",  // messenger
        "4|3|8|4|6|2|8|2|5|2|2|3|3|3|2|2|4|2|3|2",  // miner
        "5|3|5|5|4|3|5|3|5|5|4|5|6|2|4|3|5|2|7|7",  // monk
        "2|3|2|5|4|5|3|3|2|3|3|7|7|2|3|3|3|2|8|6",  // necromancer
        "3|4|3|5|3|5|3|5|3|2|8|5|6|2|8|2|2|2|5|5",  // noble
        "3|3|3|5|4|3|4|3|2|6|5|5|6|2|5|2|3|2|7|7",  // nun
        "6|5|6|6|3|6|6|3|6|3|4|2|2|6|5|6|6|5|3|3",  // outlaw
        "6|5|6|5|4|3|7|3|8|5|5|4|5|4|5|2|4|2|7|6",  // paladin
        "4|5|5|4|4|2|6|2|4|3|2|2|2|3|2|2|5|2|2|3",  // peasant
        "4|4|5|5|4|5|5|3|2|2|5|4|4|2|6|3|4|3|2|3",  // pedlar
        "3|4|4|6|5|3|4|3|2|8|5|7|7|2|5|2|4|2|5|6",  // physician
        "7|4|8|5|4|5|7|5|6|3|4|2|2|5|4|4|6|5|3|3",  // pirate
        "8|4|8|5|3|4|8|4|8|3|3|2|2|4|4|3|4|2|4|3",  // pitfighter
        "4|4|4|5|4|3|5|4|3|7|7|5|7|2|7|2|4|2|7|8",  // priest
        "7|5|7|5|3|5|7|3|7|3|4|2|2|6|4|4|5|4|4|3",  // raider
        "7|6|7|8|4|3|6|2|5|4|2|3|4|7|2|7|8|3|4|4",  // ranger
        "7|3|5|6|4|7|4|4|5|2|4|4|4|4|5|7|4|7|3|3",  // rogue
        "6|5|7|6|4|3|7|2|8|3|5|3|4|5|5|2|3|2|6|4",  // royalguard
        "3|4|3|5|3|5|3|5|3|2|9|5|6|2|9|2|2|2|5|5",  // royal
        "3|5|3|6|5|3|3|4|2|6|5|8|8|2|5|2|5|2|6|8",  // sage
        "6|5|8|5|5|3|7|4|4|2|3|2|2|4|3|3|6|4|2|2",  // sailor
        "3|4|3|6|5|4|3|4|2|5|4|7|8|2|5|2|4|2|5|7",  // scholar
        "7|5|6|8|3|4|5|2|4|2|2|3|3|5|3|7|7|3|3|3",  // scout
        "3|4|3|7|4|4|3|4|2|4|4|6|7|2|4|3|4|2|8|8",  // seer
        "5|3|6|6|3|3|6|2|6|3|4|2|2|4|4|3|3|2|5|4",  // sentinel
        "3|4|4|4|5|4|4|3|2|3|3|3|3|2|4|3|3|2|2|3",  // servant
        "3|3|3|6|4|6|3|4|2|3|4|7|7|2|4|5|3|3|8|6",  // shadowmage
        "3|7|4|6|4|3|5|4|3|6|4|5|6|3|4|4|7|2|7|8",  // shaman
        "5|4|5|6|3|4|5|2|5|2|6|3|4|4|6|3|3|2|4|4",  // sheriff
        "4|4|5|4|4|3|6|2|4|2|2|2|2|2|2|3|4|2|2|2",  // slave
        "4|3|8|4|9|2|8|2|5|2|3|4|4|2|3|2|3|2|4|3",  // smith
        "6|4|5|6|4|7|5|3|4|2|4|4|4|4|5|6|4|5|3|3",  // smuggler
        "6|4|6|5|3|3|6|2|6|3|3|2|2|5|3|3|4|2|4|3",  // soldier
        "3|4|3|6|4|5|3|4|2|4|4|7|7|2|5|3|3|2|8|6",  // sorcerer
        "6|4|6|5|3|2|6|2|6|3|2|2|2|4|2|2|4|2|3|2",  // spearman
        "3|3|3|5|5|5|3|4|2|4|5|6|6|2|6|2|3|2|5|5",  // spellmonger
        "6|4|5|7|4|8|4|4|4|2|5|5|5|4|6|7|4|5|4|4",  // spy
        "5|5|5|4|4|2|5|2|5|3|4|3|3|4|4|2|3|2|3|3",  // squire
        "4|4|4|5|5|4|4|3|2|2|6|5|6|2|6|2|3|2|3|4",  // steward
        "3|3|3|4|4|4|3|3|2|4|3|5|6|2|4|2|3|2|4|5",  // student
        "9|4|7|6|4|4|6|3|9|3|3|4|4|4|4|3|3|2|5|3",  // swordmaster
        "7|4|7|5|3|4|6|2|8|3|3|2|2|5|4|3|4|2|4|3",  // swornsword
        "4|3|5|4|4|4|5|4|2|2|3|2|2|2|4|3|3|2|2|2",  // tavernhelp
        "3|4|3|6|5|4|3|4|2|5|4|7|8|2|4|3|3|2|8|7",  // thaumaturge
        "6|3|4|6|4|7|3|4|3|2|3|4|4|3|4|8|3|8|3|3",  // thief
        "6|6|7|6|4|3|7|3|6|4|3|2|2|6|3|5|8|3|4|4",  // tribesman
        "4|5|5|4|5|3|5|3|3|3|3|3|3|3|3|3|4|2|2|3",  // villager
        "5|5|6|6|4|3|6|2|6|3|5|3|4|5|5|3|5|2|5|4",  // warden
        "3|3|3|5|4|6|3|4|2|3|4|6|6|2|4|4|3|3|9|6",  // warlock
        "4|3|5|6|4|4|5|3|6|4|3|7|7|5|3|3|4|2|7|5",  // warmage
        "7|4|7|5|3|4|6|2|7|3|3|2|2|5|4|3|4|2|4|3",  // warrior
        "5|3|5|6|3|3|5|2|5|2|4|2|2|4|4|4|3|2|4|3",  // watchman
        "4|3|3|7|3|8|3|4|2|2|6|5|5|2|7|5|3|3|4|4",  // whisperer
        "4|2|4|5|3|6|4|6|2|2|5|3|3|2|7|3|3|2|3|3",  // whore
        "7|6|8|6|4|4|8|3|6|4|2|2|2|6|3|6|9|4|5|4",  // wildling
        "4|6|4|9|5|7|5|5|3|5|3|5|6|3|6|6|5|4|9|8",  // witch
        "7|5|7|6|3|7|7|3|7|3|8|6|6|6|5|6|4|3|6|7",  // witchhunter
        "2|6|2|6|8|6|2|5|2|4|5|9|9|6|5|5|3|4|6|6",  // wizard
        "5|7|7|2|7|2|9|2|4|3|2|2|2|8|2|4|9|2|2|2",  // woodsman
        "4|4|4|4|4|2|5|2|6|2|7|3|4|5|2|6|6|2|3|2",  // yeoman
        "4|2|5|4|2|6|5|8|3|2|6|2|2|2|9|4|3|2|7|4"   // zealot
    ],
    
    // Class prerequisites and advancement
    // prerequisite: null = beginner class, string = required class ID
    // free_advances: array of class IDs you can switch to FREE if maxed
    // xp_cost: XP cost to switch to this class (if not free advance)
    classAdvancement: {
        // ========== BEGINNER CLASSES (no prerequisite) ==========
        peasant: { prerequisite: null, free_advances: ['farmer', 'villager', 'servant'], xp_cost: 0 },
        villager: { prerequisite: null, free_advances: ['craftsman', 'merchant', 'guard'], xp_cost: 0 },
        beggar: { prerequisite: null, free_advances: ['thief', 'entertainer', 'cutpurse'], xp_cost: 0 },
        slave: { prerequisite: null, free_advances: ['servant', 'gladiator', 'peasant'], xp_cost: 0 },
        student: { prerequisite: null, free_advances: ['scholar', 'apprentice', 'acolyte'], xp_cost: 0 },
        apprentice: { prerequisite: null, free_advances: ['craftsman', 'artisan', 'smith'], xp_cost: 0 },
        servant: { prerequisite: null, free_advances: ['steward', 'courtesan', 'spy'], xp_cost: 0 },
        tribesman: { prerequisite: null, free_advances: ['hunter', 'barbarian', 'shaman'], xp_cost: 0 },
        wildling: { prerequisite: null, free_advances: ['barbarian', 'hunter', 'forager'], xp_cost: 0 },
        
        // ========== TIER 1 CLASSES ==========
        // Combat Path
        soldier: { prerequisite: 'peasant', free_advances: ['mercenary', 'guard', 'spearman'], xp_cost: 500 },
        guard: { prerequisite: 'villager', free_advances: ['soldier', 'sentinel', 'watchman'], xp_cost: 500 },
        warrior: { prerequisite: 'soldier', free_advances: ['mercenary', 'knight', 'barbarian'], xp_cost: 1000 },
        mercenary: { prerequisite: 'soldier', free_advances: ['warrior', 'bountyhunter', 'swornsword'], xp_cost: 1000 },
        spearman: { prerequisite: 'soldier', free_advances: ['soldier', 'cavalry'], xp_cost: 750 },
        
        // Knighthood Path
        squire: { prerequisite: 'servant', free_advances: ['knight', 'cavalry'], xp_cost: 1000 },
        knight: { prerequisite: 'squire', free_advances: ['paladin', 'castellan', 'marshal'], xp_cost: 2000 },
        paladin: { prerequisite: 'knight', free_advances: ['marshal', 'royalguard'], xp_cost: 3000 },
        cavalry: { prerequisite: 'squire', free_advances: ['knight', 'marshal'], xp_cost: 1500 },
        hedgeknight: { prerequisite: 'warrior', free_advances: ['knight', 'mercenary'], xp_cost: 1500 },
        
        // Criminal Path
        thief: { prerequisite: 'beggar', free_advances: ['burglar', 'cutpurse', 'fence'], xp_cost: 500 },
        cutpurse: { prerequisite: 'beggar', free_advances: ['thief', 'pickpocket'], xp_cost: 400 },
        burglar: { prerequisite: 'thief', free_advances: ['assassin', 'fence'], xp_cost: 1000 },
        bandit: { prerequisite: 'outlaw', free_advances: ['highwayman', 'raider'], xp_cost: 750 },
        outlaw: { prerequisite: 'thief', free_advances: ['bandit', 'highwayman'], xp_cost: 600 },
        highwayman: { prerequisite: 'bandit', free_advances: ['raider', 'bountyhunter'], xp_cost: 1000 },
        fence: { prerequisite: 'thief', free_advances: ['smuggler', 'merchant'], xp_cost: 750 },
        smuggler: { prerequisite: 'fence', free_advances: ['merchant', 'pirate'], xp_cost: 1000 },
        assassin: { prerequisite: 'rogue', free_advances: ['spy', 'bountyhunter'], xp_cost: 2500 },
        rogue: { prerequisite: 'thief', free_advances: ['assassin', 'spy'], xp_cost: 1500 },
        pirate: { prerequisite: 'sailor', free_advances: ['raider', 'smuggler'], xp_cost: 1500 },
        
        // Stealth/Spy Path
        spy: { prerequisite: 'servant', free_advances: ['assassin', 'whisperer'], xp_cost: 1500 },
        whisperer: { prerequisite: 'spy', free_advances: ['courtier', 'spy'], xp_cost: 1000 },
        
        // Craft Path
        craftsman: { prerequisite: 'apprentice', free_advances: ['artisan', 'smith', 'engineer'], xp_cost: 500 },
        artisan: { prerequisite: 'craftsman', free_advances: ['artist', 'engineer'], xp_cost: 1000 },
        artist: { prerequisite: 'artisan', free_advances: ['entertainer'], xp_cost: 1000 },
        smith: { prerequisite: 'craftsman', free_advances: ['artisan', 'engineer'], xp_cost: 1000 },
        engineer: { prerequisite: 'craftsman', free_advances: ['artillerist', 'architect'], xp_cost: 1500 },
        
        // Magic Path
        hedgemage: { prerequisite: 'student', free_advances: ['mage', 'witch'], xp_cost: 1000 },
        mage: { prerequisite: 'hedgemage', free_advances: ['wizard', 'sorcerer', 'enchanter'], xp_cost: 2000 },
        wizard: { prerequisite: 'mage', free_advances: ['warmage', 'necromancer', 'thaumaturge'], xp_cost: 3000 },
        sorcerer: { prerequisite: 'mage', free_advances: ['wizard', 'warlock'], xp_cost: 2000 },
        warlock: { prerequisite: 'sorcerer', free_advances: ['necromancer', 'shadowmage'], xp_cost: 2500 },
        necromancer: { prerequisite: 'warlock', free_advances: ['shadowmage'], xp_cost: 3000 },
        enchanter: { prerequisite: 'mage', free_advances: ['spellmonger', 'wizard'], xp_cost: 1500 },
        spellmonger: { prerequisite: 'enchanter', free_advances: ['merchant'], xp_cost: 1000 },
        warmage: { prerequisite: 'wizard', free_advances: ['footwizard', 'marshal'], xp_cost: 2500 },
        footwizard: { prerequisite: 'warmage', free_advances: ['soldier'], xp_cost: 2000 },
        witch: { prerequisite: 'hedgemage', free_advances: ['druid', 'shaman'], xp_cost: 1500 },
        shadowmage: { prerequisite: 'warlock', free_advances: ['necromancer', 'assassin'], xp_cost: 2500 },
        thaumaturge: { prerequisite: 'wizard', free_advances: ['seer', 'sage'], xp_cost: 2500 },
        
        // Divine Path
        acolyte: { prerequisite: 'student', free_advances: ['cleric', 'monk'], xp_cost: 500 },
        cleric: { prerequisite: 'acolyte', free_advances: ['priest', 'healer'], xp_cost: 1000 },
        priest: { prerequisite: 'cleric', free_advances: ['zealot', 'paladin'], xp_cost: 1500 },
        monk: { prerequisite: 'acolyte', free_advances: ['priest', 'healer'], xp_cost: 1000 },
        nun: { prerequisite: 'acolyte', free_advances: ['healer', 'priest'], xp_cost: 1000 },
        zealot: { prerequisite: 'priest', free_advances: ['witchhunter', 'paladin'], xp_cost: 2000 },
        
        // Nature/Survival Path
        farmer: { prerequisite: 'peasant', free_advances: ['herder', 'forager', 'woodsman'], xp_cost: 400 },
        herder: { prerequisite: 'farmer', free_advances: ['hunter', 'tribesman'], xp_cost: 500 },
        hunter: { prerequisite: 'tribesman', free_advances: ['ranger', 'scout', 'bountyhunter'], xp_cost: 750 },
        forager: { prerequisite: 'farmer', free_advances: ['herbalist', 'hunter'], xp_cost: 500 },
        woodsman: { prerequisite: 'farmer', free_advances: ['hunter', 'ranger'], xp_cost: 600 },
        ranger: { prerequisite: 'hunter', free_advances: ['scout', 'warden'], xp_cost: 1500 },
        scout: { prerequisite: 'hunter', free_advances: ['ranger', 'spy'], xp_cost: 1000 },
        druid: { prerequisite: 'shaman', free_advances: ['sage', 'witch'], xp_cost: 2000 },
        shaman: { prerequisite: 'tribesman', free_advances: ['druid', 'witch'], xp_cost: 1500 },
        barbarian: { prerequisite: 'tribesman', free_advances: ['raider', 'warrior'], xp_cost: 1000 },
        
        // Healing Path
        herbalist: { prerequisite: 'forager', free_advances: ['healer', 'apothecary'], xp_cost: 750 },
        healer: { prerequisite: 'herbalist', free_advances: ['physician', 'cleric'], xp_cost: 1000 },
        physician: { prerequisite: 'healer', free_advances: ['alchemist', 'sage'], xp_cost: 1500 },
        apothecary: { prerequisite: 'herbalist', free_advances: ['alchemist', 'physician'], xp_cost: 1000 },
        alchemist: { prerequisite: 'apothecary', free_advances: ['enchanter', 'physician'], xp_cost: 1500 },
        
        // Social/Political Path
        entertainer: { prerequisite: 'beggar', free_advances: ['bard', 'charlatan'], xp_cost: 500 },
        bard: { prerequisite: 'entertainer', free_advances: ['courtier', 'spy'], xp_cost: 1000 },
        charlatan: { prerequisite: 'entertainer', free_advances: ['conartist', 'forger'], xp_cost: 750 },
        conartist: { prerequisite: 'charlatan', free_advances: ['spy', 'fence'], xp_cost: 1000 },
        forger: { prerequisite: 'charlatan', free_advances: ['fence', 'smuggler'], xp_cost: 1000 },
        courtesan: { prerequisite: 'servant', free_advances: ['courtier', 'spy'], xp_cost: 1000 },
        courtier: { prerequisite: 'bard', free_advances: ['noble', 'advisor'], xp_cost: 1500 },
        noble: { prerequisite: 'courtier', free_advances: ['royal', 'castellan'], xp_cost: 3000 },
        royal: { prerequisite: 'noble', free_advances: ['marshal'], xp_cost: 5000 },
        advisor: { prerequisite: 'courtier', free_advances: ['steward', 'sage'], xp_cost: 1500 },
        
        // Commerce Path
        merchant: { prerequisite: 'villager', free_advances: ['burgher', 'pedlar'], xp_cost: 750 },
        burgher: { prerequisite: 'merchant', free_advances: ['noble', 'steward'], xp_cost: 1500 },
        pedlar: { prerequisite: 'merchant', free_advances: ['smuggler', 'fence'], xp_cost: 500 },
        
        // Law/Authority Path
        watchman: { prerequisite: 'guard', free_advances: ['investigator', 'sentinel'], xp_cost: 750 },
        sentinel: { prerequisite: 'guard', free_advances: ['warden', 'royalguard'], xp_cost: 1000 },
        investigator: { prerequisite: 'watchman', free_advances: ['spy', 'lawyer'], xp_cost: 1000 },
        bailiff: { prerequisite: 'watchman', free_advances: ['sheriff', 'jailer'], xp_cost: 750 },
        sheriff: { prerequisite: 'bailiff', free_advances: ['marshal', 'interrogator'], xp_cost: 1500 },
        jailer: { prerequisite: 'bailiff', free_advances: ['interrogator', 'executioner'], xp_cost: 750 },
        interrogator: { prerequisite: 'jailer', free_advances: ['spy', 'sheriff'], xp_cost: 1000 },
        executioner: { prerequisite: 'jailer', free_advances: ['assassin'], xp_cost: 1000 },
        lawyer: { prerequisite: 'scholar', free_advances: ['advisor', 'censor'], xp_cost: 1500 },
        censor: { prerequisite: 'lawyer', free_advances: ['advisor', 'inquisitor'], xp_cost: 1500 },
        
        // Scholar Path
        scholar: { prerequisite: 'student', free_advances: ['sage', 'academic', 'lawyer'], xp_cost: 750 },
        academic: { prerequisite: 'scholar', free_advances: ['sage', 'physician'], xp_cost: 1000 },
        sage: { prerequisite: 'academic', free_advances: ['seer', 'wizard'], xp_cost: 2000 },
        seer: { prerequisite: 'sage', free_advances: ['thaumaturge', 'shaman'], xp_cost: 2000 },
        
        // Service/Transport Path
        steward: { prerequisite: 'servant', free_advances: ['castellan', 'advisor'], xp_cost: 1000 },
        castellan: { prerequisite: 'steward', free_advances: ['noble', 'marshal'], xp_cost: 2000 },
        herald: { prerequisite: 'messenger', free_advances: ['envoy', 'courtier'], xp_cost: 750 },
        messenger: { prerequisite: 'servant', free_advances: ['herald', 'spy'], xp_cost: 400 },
        envoy: { prerequisite: 'herald', free_advances: ['advisor', 'spy'], xp_cost: 1000 },
        coachman: { prerequisite: 'servant', free_advances: ['messenger', 'smuggler'], xp_cost: 500 },
        boatman: { prerequisite: 'villager', free_advances: ['sailor', 'smuggler'], xp_cost: 500 },
        sailor: { prerequisite: 'boatman', free_advances: ['pirate', 'navigator'], xp_cost: 750 },
        
        // Seedy Path
        whore: { prerequisite: 'beggar', free_advances: ['courtesan', 'spy'], xp_cost: 300 },
        tavernhelp: { prerequisite: 'servant', free_advances: ['entertainer', 'spy'], xp_cost: 300 },
        
        // Combat Specialists
        archer: { prerequisite: 'hunter', free_advances: ['ranger', 'scout'], xp_cost: 1000 },
        duelist: { prerequisite: 'warrior', free_advances: ['swordmaster', 'knight'], xp_cost: 1500 },
        swordmaster: { prerequisite: 'duelist', free_advances: ['royalguard', 'marshal'], xp_cost: 2500 },
        swornsword: { prerequisite: 'mercenary', free_advances: ['knight', 'assassin'], xp_cost: 1500 },
        pitfighter: { prerequisite: 'warrior', free_advances: ['mercenary', 'barbarian'], xp_cost: 1000 },
        raider: { prerequisite: 'barbarian', free_advances: ['pirate', 'bandit'], xp_cost: 1000 },
        bountyhunter: { prerequisite: 'hunter', free_advances: ['assassin', 'mercenary'], xp_cost: 1500 },
        
        // Mining/Labor
        miner: { prerequisite: 'peasant', free_advances: ['smith', 'craftsman'], xp_cost: 500 },
        
        // Elite Classes
        marshal: { prerequisite: 'knight', free_advances: ['royal'], xp_cost: 4000 },
        royalguard: { prerequisite: 'knight', free_advances: ['marshal', 'paladin'], xp_cost: 3000 },
        warden: { prerequisite: 'ranger', free_advances: ['marshal', 'paladin'], xp_cost: 2000 },
        witchhunter: { prerequisite: 'zealot', free_advances: ['inquisitor', 'spy'], xp_cost: 2500 },
        artillerist: { prerequisite: 'engineer', free_advances: ['warmage'], xp_cost: 2000 },
        adventurer: { prerequisite: 'villager', free_advances: ['mercenary', 'bard', 'rogue'], xp_cost: 750 },
        
        // Occult Path
        cultist: { prerequisite: 'zealot', free_advances: ['warlock', 'necromancer'], xp_cost: 1500 }
    },
    
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
    
    parseStatCaps(capsString) {
        const caps = {};
        const values = capsString.split('|').map(v => parseInt(v.trim()) || 5);
        this.statNames.forEach((stat, index) => {
            caps[stat] = values[index] || 5;
        });
        return caps;
    },
    
    /**
     * Get minimum stat requirements for a class
     */
    getClassStatMinimums(className) {
        // Define minimum stat requirements by class
        const minimums = {
            // ========== BEGINNER CLASSES ==========
            peasant: {},
            villager: {},
            beggar: {},
            slave: {},
            student: {},
            apprentice: {},
            servant: {},
            tribesman: {},
            wildling: {},
            
            // ========== COMBAT CLASSES ==========
            soldier: { fighting: 3, endurance: 2 },
            guard: { fighting: 2, awareness: 2 },
            warrior: { fighting: 4, endurance: 3 },
            mercenary: { fighting: 4, athletics: 2 },
            spearman: { fighting: 3, athletics: 2 },
            squire: { fighting: 3, agility: 2 },
            knight: { fighting: 5, endurance: 3, influence: 2 },
            paladin: { fighting: 6, will: 4, healing: 2 },
            cavalry: { fighting: 4, agility: 3, animal_handling: 2 },
            hedgeknight: { fighting: 5, endurance: 3 },
            barbarian: { fighting: 4, endurance: 4, survival: 2 },
            gladiator: { fighting: 5, athletics: 3, entertaining: 2 },
            pitfighter: { fighting: 4, athletics: 3 },
            raider: { fighting: 4, survival: 2 },
            bountyhunter: { fighting: 3, awareness: 3, marksmanship: 2 },
            swornsword: { fighting: 4, will: 2 },
            swordmaster: { fighting: 6, agility: 4 },
            footwizard: { fighting: 3, intelligence: 4, knowledge: 3 },
            warmage: { fighting: 3, intelligence: 5, knowledge: 4 },
            royalguard: { fighting: 6, awareness: 4, influence: 2 },
            marshal: { fighting: 5, influence: 4, knowledge: 3 },
            sentinel: { fighting: 3, awareness: 4 },
            watchman: { fighting: 2, awareness: 3 },
            
            // ========== STEALTH/CRIMINAL CLASSES ==========
            thief: { stealth: 3, thievery: 2 },
            cutpurse: { stealth: 2, thievery: 3, agility: 2 },
            burglar: { stealth: 4, thievery: 3, agility: 3 },
            bandit: { fighting: 3, stealth: 2, survival: 2 },
            outlaw: { fighting: 3, stealth: 3 },
            highwayman: { fighting: 3, marksmanship: 3, agility: 2 },
            fence: { thievery: 3, persuasion: 2 },
            smuggler: { stealth: 3, deception: 2 },
            assassin: { stealth: 5, fighting: 4, thievery: 3 },
            rogue: { stealth: 4, thievery: 3, deception: 2 },
            pirate: { fighting: 3, athletics: 3, survival: 2 },
            spy: { stealth: 3, awareness: 3, deception: 3 },
            whisperer: { stealth: 4, deception: 4, influence: 2 },
            
            // ========== CRAFTING CLASSES ==========
            craftsman: { crafting: 3 },
            artisan: { crafting: 4, intelligence: 2 },
            artist: { crafting: 3, entertaining: 2 },
            smith: { crafting: 4, endurance: 2 },
            engineer: { crafting: 4, intelligence: 4, knowledge: 3 },
            architect: { crafting: 3, intelligence: 3, knowledge: 3 },
            artillerist: { crafting: 4, intelligence: 3, knowledge: 3 },
            miner: { endurance: 3, athletics: 2 },
            
            // ========== MAGIC CLASSES ==========
            hedgemage: { intelligence: 3, will: 2 },
            mage: { intelligence: 4, will: 3, knowledge: 2 },
            wizard: { intelligence: 5, will: 4, knowledge: 4 },
            sorcerer: { intelligence: 4, will: 4 },
            warlock: { intelligence: 4, will: 5, knowledge: 3 },
            necromancer: { intelligence: 5, will: 6, knowledge: 4 },
            enchanter: { intelligence: 4, crafting: 2, knowledge: 3 },
            spellmonger: { intelligence: 3, persuasion: 3 },
            witch: { intelligence: 3, will: 3, knowledge: 2 },
            shadowmage: { intelligence: 5, will: 5, knowledge: 3 },
            thaumaturge: { intelligence: 5, will: 5, knowledge: 4 },
            seer: { intelligence: 4, awareness: 4, will: 3 },
            
            // ========== DIVINE CLASSES ==========
            acolyte: { will: 2 },
            cleric: { will: 3, healing: 2 },
            priest: { will: 4, healing: 3, influence: 2 },
            monk: { will: 3, endurance: 2 },
            nun: { will: 3, healing: 2 },
            zealot: { will: 5, fighting: 3 },
            healer: { will: 3, healing: 4, intelligence: 2 },
            
            // ========== NATURE/SURVIVAL CLASSES ==========
            farmer: { survival: 2, animal_handling: 2 },
            herder: { animal_handling: 3, survival: 2 },
            hunter: { marksmanship: 3, survival: 3, awareness: 2 },
            forager: { survival: 3, awareness: 2 },
            woodsman: { survival: 3, athletics: 2, endurance: 2 },
            ranger: { marksmanship: 4, survival: 4, awareness: 3 },
            scout: { awareness: 4, survival: 3, agility: 2 },
            druid: { will: 4, knowledge: 3, survival: 3 },
            shaman: { will: 3, knowledge: 2, survival: 2 },
            
            // ========== SCHOLAR/LEARNING CLASSES ==========
            scholar: { intelligence: 3, knowledge: 3 },
            sage: { intelligence: 4, knowledge: 5, wisdom: 3 },
            physician: { intelligence: 4, healing: 4, knowledge: 3 },
            investigator: { intelligence: 3, awareness: 3, knowledge: 2 },
            interrogator: { intelligence: 3, deception: 3, influence: 2 },
            
            // ========== SOCIAL/COMMERCE CLASSES ==========
            merchant: { persuasion: 3, awareness: 2 },
            pedlar: { persuasion: 2, athletics: 2 },
            courtesan: { entertaining: 3, persuasion: 2, influence: 2 },
            entertainer: { entertaining: 4, agility: 2 },
            bard: { entertaining: 4, knowledge: 2, persuasion: 2 },
            courtier: { influence: 4, persuasion: 3, awareness: 2 },
            noble: { influence: 4, persuasion: 3 },
            royal: { influence: 5, persuasion: 4, awareness: 3 },
            steward: { influence: 3, knowledge: 2, awareness: 2 },
            
            // ========== SERVICE CLASSES ==========
            tavernhelp: {},
            whore: { entertaining: 2 },
            
            // ========== LAW/ADMINISTRATION CLASSES ==========
            lawyer: { knowledge: 3, persuasion: 3, influence: 2 },
            sheriff: { fighting: 3, influence: 3, awareness: 2 },
            jailer: { fighting: 2, awareness: 2 },
            castellan: { influence: 4, knowledge: 3, awareness: 3 },
            
            // ========== SPECIALIZED CLASSES ==========
            messenger: { athletics: 2, awareness: 2 },
            sailor: { athletics: 3, survival: 2, awareness: 2 },
            yeoman: { survival: 2, animal_handling: 2 },
            witchhunter: { fighting: 4, awareness: 4, will: 3 }
        };
        
        return minimums[className] || {};
    },
    
    getFullClassData() {
        const classes = [];
        this.classNames.forEach((name, index) => {
            const descData = this.classDescriptions[name] || { desc: 'No description', icon: '❓', vocation: 'unknown' };
            const advData = this.classAdvancement[name] || { prerequisite: null, free_advances: [], xp_cost: 0 };
            const statCaps = this.parseStatCaps(this.classStatCaps[index]);
            const statMinimums = this.getClassStatMinimums(name);
            
            classes.push({
                id: name,
                name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
                description: descData.desc,
                icon: descData.icon,
                vocation: descData.vocation,
                image: `classes/Class_Overview_${name}.png`,
                stat_minimums: statMinimums,
                stat_maximums: statCaps,
                prerequisite: advData.prerequisite,
                free_advances: advData.free_advances || [],
                xp_cost: advData.xp_cost || 0,
                is_beginner: advData.prerequisite === null
            });
        });
        return classes;
    },
    
    getFullSpeciesData() {
        return this.species.map(sp => ({
            ...sp,
            image: `species/${sp.id}.png`,
            base_stats: sp.base_stats || {},
            stat_minimums: sp.stat_minimums || {},
            stat_maximums: sp.stat_maximums || {}
        }));
    },
    
    getGenderData() {
        return this.genders.map(g => ({
            ...g,
            image: `genders/${g.id}.png`
        }));
    },
    
    /**
     * Get default stats object with all stats at default value (2)
     */
    getDefaultStats() {
        const stats = {};
        this.statNames.forEach(stat => {
            stats[stat] = this.defaultStatValue;
        });
        return stats;
    }
};

// Make available globally
window.F4_SEED_DATA = F4_SEED_DATA;
