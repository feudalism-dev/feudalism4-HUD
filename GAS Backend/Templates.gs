// ============================================================================
// Feudalism 4 - Template Management Module
// ============================================================================
// Handles Species, Classes, and Vocations CRUD operations
// ============================================================================

// =========================== SPECIES ========================================

/**
 * Get all species templates
 */
function getSpeciesTemplates() {
  const sheet = getSheet('species');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    // No species defined, seed with defaults
    seedDefaultSpecies();
    return getSpeciesTemplates();
  }
  
  const headers = data[0];
  const species = [];
  
  for (let i = 1; i < data.length; i++) {
    const sp = {};
    headers.forEach((header, j) => {
      let value = data[i][j];
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try { value = JSON.parse(value); } catch (e) {}
      }
      sp[header] = value;
    });
    
    if (sp.enabled !== false) {
      species.push(sp);
    }
  }
  
  return successResponse('templates.species', { species: species });
}

/**
 * Get species by ID
 */
function getSpeciesById(speciesId) {
  const sheet = getSheet('species');
  const row = findRowByValue(sheet, 'id', speciesId);
  
  if (row === -1) {
    return null;
  }
  
  return getRowAsObject(sheet, row);
}

/**
 * Seed default species
 */
function seedDefaultSpecies() {
  const defaultSpecies = [
    {
      id: 'human',
      name: 'Human',
      description: 'Versatile and adaptable, humans are the most common species in the realm. Magic Chance: 10%',
      base_stats: createBaseStats(2),
      stat_caps: createStatCaps(9),
      abilities: [],
      allowed_classes: ['commoner', 'soldier', 'squire', 'merchant', 'scholar', 'priest'],
      health_factor: 25,
      stamina_factor: 25,
      mana_factor: 25,
      mana_chance: 10,
      enabled: true
    },
    {
      id: 'elf',
      name: 'Elf',
      description: 'Graceful and long-lived, elves excel in matters of magic and finesse. Magic Chance: 100%',
      base_stats: createBaseStats(2, { agility: 3, awareness: 3, intellect: 3, arcana: 3, strength: 1, endurance: 1, athletics: 1 }),
      stat_caps: createStatCaps(9, { agility: 10, awareness: 10, arcana: 10, strength: 7, endurance: 7 }),
      abilities: ['Low-Light Vision'],
      allowed_classes: ['commoner', 'scout', 'mage', 'scholar'],
      health_factor: 23,
      stamina_factor: 23,
      mana_factor: 40,
      mana_chance: 100,
      enabled: true
    },
    {
      id: 'dwarf',
      name: 'Dwarf',
      description: 'Stout and resilient, dwarves are master craftsmen and fierce warriors. Magic Chance: 40%',
      base_stats: createBaseStats(2, { strength: 3, endurance: 3, crafting: 3, agility: 1, arcana: 1, athletics: 1 }),
      stat_caps: createStatCaps(9, { strength: 10, endurance: 10, crafting: 10, agility: 7, arcana: 6 }),
      abilities: ['Darkvision', 'Stone Sense'],
      allowed_classes: ['commoner', 'soldier', 'smith', 'merchant'],
      health_factor: 35,
      stamina_factor: 35,
      mana_factor: 25,
      mana_chance: 40,
      enabled: true
    },
    {
      id: 'halfling',
      name: 'Halfling',
      description: 'Small but surprisingly capable, halflings are known for their luck and courage. Magic Chance: 5%',
      base_stats: createBaseStats(2, { agility: 3, luck: 4, stealth: 3, strength: 1, endurance: 1, athletics: 1, fighting: 1 }),
      stat_caps: createStatCaps(9, { luck: 12, stealth: 10, strength: 6 }),
      abilities: ['Lucky', 'Nimble'],
      allowed_classes: ['commoner', 'scout', 'merchant', 'thief'],
      health_factor: 20,
      stamina_factor: 30,
      mana_factor: 15,
      mana_chance: 5,
      enabled: true
    },
    {
      id: 'merfolk',
      name: 'Merfolk',
      description: 'Aquatic beings who dwell beneath the waves, rarely venturing onto land. Magic Chance: 10%',
      base_stats: createBaseStats(2, { athletics: 3, survival: 3, charisma: 3, endurance: 3, strength: 1, agility: 1, stealth: 1, crafting: 1, arcana: 1 }),
      stat_caps: createStatCaps(9, { athletics: 11 }),
      abilities: ['Aquatic', 'Water Breathing'],
      allowed_classes: ['commoner', 'scout', 'priest'],
      health_factor: 25,
      stamina_factor: 25,
      mana_factor: 25,
      mana_chance: 10,
      enabled: true
    },
    {
      id: 'demon',
      name: 'Demon',
      description: 'Powerful beings from the infernal planes, masters of dark magic. Magic Chance: 75%',
      base_stats: createBaseStats(2, { strength: 3, will: 3, arcana: 3, charisma: 1, perception: 1, stealth: 1 }),
      stat_caps: createStatCaps(10, { strength: 12, will: 12, arcana: 12 }),
      abilities: ['Darkvision', 'Fire Resistance'],
      allowed_classes: ['commoner', 'mage', 'priest'],
      health_factor: 40,
      stamina_factor: 40,
      mana_factor: 30,
      mana_chance: 75,
      enabled: true
    },
    {
      id: 'dragonborn',
      name: 'Dragonborn',
      description: 'Descendants of dragons, combining draconic might with humanoid form. Magic Chance: 50%',
      base_stats: createBaseStats(2, { strength: 3, endurance: 3, charisma: 3, agility: 1, stealth: 1, crafting: 1 }),
      stat_caps: createStatCaps(9, { strength: 11, endurance: 11, charisma: 11 }),
      abilities: ['Draconic Breath', 'Damage Resistance'],
      allowed_classes: ['commoner', 'soldier', 'squire', 'mage'],
      health_factor: 30,
      stamina_factor: 30,
      mana_factor: 25,
      mana_chance: 50,
      enabled: true
    },
    {
      id: 'drow',
      name: 'Drow',
      description: 'Dark elves who dwell in the Underdark, masters of magic and shadow. Magic Chance: 100%',
      base_stats: createBaseStats(2, { agility: 3, stealth: 3, arcana: 3, strength: 1, endurance: 1, athletics: 1 }),
      stat_caps: createStatCaps(9, { agility: 10, stealth: 11, arcana: 11 }),
      abilities: ['Darkvision', 'Sunlight Sensitivity'],
      allowed_classes: ['commoner', 'scout', 'mage', 'thief'],
      health_factor: 23,
      stamina_factor: 23,
      mana_factor: 30,
      mana_chance: 100,
      enabled: true
    },
    {
      id: 'fairy',
      name: 'Fairy',
      description: 'Tiny magical beings of nature, fragile but powerful in magic. Magic Chance: 100%',
      base_stats: createBaseStats(2, { agility: 3, arcana: 4, will: 3, strength: 1, endurance: 1, athletics: 1, fighting: 1 }),
      stat_caps: createStatCaps(8, { agility: 12, arcana: 12, strength: 5 }),
      abilities: ['Flight', 'Nature Affinity'],
      allowed_classes: ['commoner', 'mage', 'scholar'],
      health_factor: 10,
      stamina_factor: 10,
      mana_factor: 40,
      mana_chance: 100,
      enabled: true
    },
    {
      id: 'gnome',
      name: 'Gnome',
      description: 'Small, clever beings with a natural affinity for magic and invention. Magic Chance: 85%',
      base_stats: createBaseStats(2, { intellect: 3, crafting: 3, arcana: 3, strength: 1, endurance: 1, athletics: 1 }),
      stat_caps: createStatCaps(9, { intellect: 11, crafting: 11, arcana: 11 }),
      abilities: ['Gnome Cunning', 'Tinker'],
      allowed_classes: ['commoner', 'scholar', 'mage', 'smith'],
      health_factor: 15,
      stamina_factor: 15,
      mana_factor: 40,
      mana_chance: 85,
      enabled: true
    },
    {
      id: 'goblin',
      name: 'Goblin',
      description: 'Small, cunning creatures known for their resourcefulness. Magic Chance: 10%',
      base_stats: createBaseStats(2, { agility: 3, stealth: 3, strength: 1, endurance: 1, charisma: 1 }),
      stat_caps: createStatCaps(8, { agility: 10, stealth: 10, strength: 6 }),
      abilities: ['Nimble Escape'],
      allowed_classes: ['commoner', 'scout', 'thief'],
      health_factor: 20,
      stamina_factor: 20,
      mana_factor: 25,
      mana_chance: 10,
      enabled: true
    },
    {
      id: 'half_elf',
      name: 'Half-Elf',
      description: 'Children of humans and elves, combining the best of both worlds. Magic Chance: 50%',
      base_stats: createBaseStats(2, { charisma: 3, awareness: 3, strength: 1, endurance: 1 }),
      stat_caps: createStatCaps(9, { charisma: 11, awareness: 11 }),
      abilities: ['Fey Ancestry'],
      allowed_classes: ['commoner', 'soldier', 'scout', 'mage', 'scholar'],
      health_factor: 24,
      stamina_factor: 24,
      mana_factor: 30,
      mana_chance: 50,
      enabled: true
    },
    {
      id: 'half_orc',
      name: 'Half-Orc',
      description: 'Powerful warriors combining human adaptability with orcish strength. Magic Chance: 5%',
      base_stats: createBaseStats(2, { strength: 3, endurance: 3, fighting: 3, intellect: 1, charisma: 1, arcana: 1 }),
      stat_caps: createStatCaps(9, { strength: 11, endurance: 11, fighting: 11 }),
      abilities: ['Savage Attacks', 'Relentless Endurance'],
      allowed_classes: ['commoner', 'soldier', 'squire'],
      health_factor: 30,
      stamina_factor: 30,
      mana_factor: 20,
      mana_chance: 5,
      enabled: true
    },
    {
      id: 'imp',
      name: 'Imp',
      description: 'Small, mischievous creatures with minor magical abilities. Magic Chance: 25%',
      base_stats: createBaseStats(2, { agility: 3, stealth: 3, arcana: 2, strength: 1, endurance: 1 }),
      stat_caps: createStatCaps(8, { agility: 10, stealth: 10, arcana: 8 }),
      abilities: ['Shapechanger', 'Devil\'s Sight'],
      allowed_classes: ['commoner', 'thief', 'mage'],
      health_factor: 20,
      stamina_factor: 20,
      mana_factor: 20,
      mana_chance: 25,
      enabled: true
    },
    {
      id: 'minotaur',
      name: 'Minotaur',
      description: 'Powerful bull-headed warriors of great strength and endurance. Magic Chance: 5%',
      base_stats: createBaseStats(2, { strength: 3, endurance: 3, fighting: 3, agility: 1, stealth: 1, arcana: 1 }),
      stat_caps: createStatCaps(9, { strength: 12, endurance: 12, fighting: 11 }),
      abilities: ['Horns', 'Charge'],
      allowed_classes: ['commoner', 'soldier', 'squire'],
      health_factor: 35,
      stamina_factor: 35,
      mana_factor: 10,
      mana_chance: 5,
      enabled: true
    },
    {
      id: 'reptilian',
      name: 'Reptilian',
      description: 'Scaled humanoids with natural resilience and cunning. Magic Chance: 5%',
      base_stats: createBaseStats(2, { endurance: 3, stealth: 3, perception: 3, charisma: 1, arcana: 1 }),
      stat_caps: createStatCaps(9, { endurance: 11, stealth: 11, perception: 11 }),
      abilities: ['Natural Armor', 'Cold-Blooded'],
      allowed_classes: ['commoner', 'scout', 'soldier'],
      health_factor: 25,
      stamina_factor: 25,
      mana_factor: 20,
      mana_chance: 5,
      enabled: true
    },
    {
      id: 'satyr',
      name: 'Satyr',
      description: 'Merry forest-dwellers with a love for music and revelry. Magic Chance: 25%',
      base_stats: createBaseStats(2, { charisma: 3, agility: 3, entertaining: 3, strength: 1, intellect: 1 }),
      stat_caps: createStatCaps(9, { charisma: 11, agility: 11, entertaining: 11 }),
      abilities: ['Mirthful Leaps', 'Reveler'],
      allowed_classes: ['commoner', 'scout', 'merchant'],
      health_factor: 30,
      stamina_factor: 30,
      mana_factor: 25,
      mana_chance: 25,
      enabled: true
    },
    {
      id: 'tiefling',
      name: 'Tiefling',
      description: 'Descendants of fiends, marked by infernal heritage and magical talent. Magic Chance: 50%',
      base_stats: createBaseStats(2, { charisma: 3, intellect: 3, arcana: 3, endurance: 1, athletics: 1 }),
      stat_caps: createStatCaps(9, { charisma: 11, intellect: 11, arcana: 11 }),
      abilities: ['Darkvision', 'Hellish Resistance'],
      allowed_classes: ['commoner', 'mage', 'scholar', 'priest'],
      health_factor: 26,
      stamina_factor: 26,
      mana_factor: 25,
      mana_chance: 50,
      enabled: true
    },
    {
      id: 'vampire',
      name: 'Vampire',
      description: 'Undead beings of the night, cursed with immortality and dark powers. Magic Chance: 18%',
      base_stats: createBaseStats(2, { strength: 3, agility: 3, will: 3, charisma: 1, perception: 1, faith: 1 }),
      stat_caps: createStatCaps(10, { strength: 12, agility: 12, will: 12 }),
      abilities: ['Undead', 'Vampiric Bite', 'Sunlight Weakness'],
      allowed_classes: ['commoner', 'soldier', 'mage', 'thief'],
      health_factor: 30,
      stamina_factor: 30,
      mana_factor: 30,
      mana_chance: 18,
      enabled: true
    },
    {
      id: 'werewolf',
      name: 'Werewolf',
      description: 'Shape-shifters cursed to transform under the full moon, powerful in both forms. Magic Chance: 18%',
      base_stats: createBaseStats(2, { strength: 3, endurance: 3, fighting: 3, intellect: 1, charisma: 1, arcana: 1 }),
      stat_caps: createStatCaps(10, { strength: 12, endurance: 11, fighting: 11 }),
      abilities: ['Shapechanger', 'Keen Senses', 'Moon Cursed'],
      allowed_classes: ['commoner', 'soldier', 'scout'],
      health_factor: 30,
      stamina_factor: 30,
      mana_factor: 30,
      mana_chance: 18,
      enabled: true
    }
  ];
  
  const sheet = getSheet('species');
  defaultSpecies.forEach(sp => {
    saveRowFromObject(sheet, sp);
  });
}

// =========================== CLASSES ========================================

/**
 * Get all class templates
 */
function getClassTemplates() {
  const sheet = getSheet('classes');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    seedDefaultClasses();
    return getClassTemplates();
  }
  
  const headers = data[0];
  const classes = [];
  
  for (let i = 1; i < data.length; i++) {
    const cls = {};
    headers.forEach((header, j) => {
      let value = data[i][j];
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try { value = JSON.parse(value); } catch (e) {}
      }
      cls[header] = value;
    });
    
    if (cls.enabled !== false) {
      classes.push(cls);
    }
  }
  
  return successResponse('templates.classes', { classes: classes });
}

/**
 * Get class by ID
 */
function getClassById(classId) {
  const sheet = getSheet('classes');
  const row = findRowByValue(sheet, 'id', classId);
  
  if (row === -1) {
    return null;
  }
  
  return getRowAsObject(sheet, row);
}

/**
 * Seed default classes
 */
function seedDefaultClasses() {
  const defaultClasses = [
    {
      id: 'commoner',
      name: 'Commoner',
      description: 'A common citizen with no special training. The starting point for most adventurers.',
      vocation_id: 'common_sense',
      stat_minimums: {},
      stat_maximums: createStatCaps(5),
      prerequisites: { required_classes: [], required_species: [], required_gender: [] },
      exit_careers: ['soldier', 'scout', 'merchant', 'smith', 'scholar', 'thief'],
      xp_cost: 0,
      enabled: true
    },
    {
      id: 'soldier',
      name: 'Soldier',
      description: 'A trained fighter in service to a lord or nation.',
      vocation_id: 'martial_training',
      stat_minimums: { fighting: 2, strength: 2 },
      stat_maximums: createStatCaps(7, { fighting: 8, strength: 8, endurance: 8 }),
      prerequisites: { required_classes: ['commoner'], required_species: [], required_gender: [] },
      exit_careers: ['squire', 'sergeant', 'mercenary'],
      xp_cost: 100,
      enabled: true
    },
    {
      id: 'squire',
      name: 'Squire',
      description: 'An apprentice knight, learning the ways of chivalry and mounted combat.',
      vocation_id: 'squires_duty',
      stat_minimums: { fighting: 3, agility: 2, charisma: 2 },
      stat_maximums: createStatCaps(7, { fighting: 8, agility: 7, charisma: 7 }),
      prerequisites: { required_classes: ['soldier'], required_species: [], required_gender: [] },
      exit_careers: ['knight'],
      xp_cost: 200,
      enabled: true
    },
    {
      id: 'knight',
      name: 'Knight',
      description: 'A mounted warrior sworn to a lord, trained in the arts of war and chivalry.',
      vocation_id: 'knights_prowess',
      stat_minimums: { fighting: 5, agility: 3, strength: 4, charisma: 3 },
      stat_maximums: createStatCaps(9, { fighting: 10, intimidation: 9 }),
      prerequisites: { required_classes: ['squire'], required_species: [], required_gender: [] },
      exit_careers: ['champion', 'lord', 'knight_commander'],
      xp_cost: 500,
      enabled: true
    },
    {
      id: 'scout',
      name: 'Scout',
      description: 'A ranger skilled in tracking, survival, and stealth.',
      vocation_id: 'wilderness_wisdom',
      stat_minimums: { perception: 2, survival: 2 },
      stat_maximums: createStatCaps(7, { perception: 8, stealth: 8, survival: 8 }),
      prerequisites: { required_classes: ['commoner'], required_species: [], required_gender: [] },
      exit_careers: ['ranger', 'spy', 'hunter'],
      xp_cost: 100,
      enabled: true
    },
    {
      id: 'merchant',
      name: 'Merchant',
      description: 'A trader skilled in commerce, negotiation, and the value of goods.',
      vocation_id: 'traders_eye',
      stat_minimums: { charisma: 2, intellect: 2 },
      stat_maximums: createStatCaps(7, { charisma: 8, persuasion: 8, perception: 7 }),
      prerequisites: { required_classes: ['commoner'], required_species: [], required_gender: [] },
      exit_careers: ['guild_master', 'banker', 'smuggler'],
      xp_cost: 100,
      enabled: true
    },
    {
      id: 'smith',
      name: 'Smith',
      description: 'A craftsman skilled in metalworking and the creation of arms and armor.',
      vocation_id: 'forge_mastery',
      stat_minimums: { crafting: 2, strength: 2 },
      stat_maximums: createStatCaps(7, { crafting: 9, strength: 8 }),
      prerequisites: { required_classes: ['commoner'], required_species: [], required_gender: [] },
      exit_careers: ['master_smith', 'armorer', 'weaponsmith'],
      xp_cost: 100,
      enabled: true
    },
    {
      id: 'scholar',
      name: 'Scholar',
      description: 'A learned individual dedicated to the pursuit of knowledge.',
      vocation_id: 'scholarly_insight',
      stat_minimums: { intellect: 3 },
      stat_maximums: createStatCaps(7, { intellect: 9, arcana: 8, medicine: 8 }),
      prerequisites: { required_classes: ['commoner'], required_species: [], required_gender: [] },
      exit_careers: ['mage', 'alchemist', 'physician'],
      xp_cost: 100,
      enabled: true
    },
    {
      id: 'mage',
      name: 'Mage',
      description: 'A practitioner of the arcane arts, wielding magical power.',
      vocation_id: 'arcane_mastery',
      stat_minimums: { arcana: 4, intellect: 4, will: 3 },
      stat_maximums: createStatCaps(8, { arcana: 10, intellect: 10, will: 9 }),
      prerequisites: { required_classes: ['scholar'], required_species: [], required_gender: [] },
      exit_careers: ['archmage', 'battlemage', 'enchanter'],
      xp_cost: 300,
      enabled: true
    },
    {
      id: 'priest',
      name: 'Priest',
      description: 'A servant of the divine, channeling holy power through faith.',
      vocation_id: 'divine_favor',
      stat_minimums: { faith: 3, will: 2 },
      stat_maximums: createStatCaps(7, { faith: 9, will: 8, charisma: 8 }),
      prerequisites: { required_classes: ['commoner'], required_species: [], required_gender: [] },
      exit_careers: ['high_priest', 'inquisitor', 'paladin'],
      xp_cost: 100,
      enabled: true
    },
    {
      id: 'thief',
      name: 'Thief',
      description: 'A rogue skilled in stealth, lockpicking, and acquiring things that belong to others.',
      vocation_id: 'shadow_craft',
      stat_minimums: { stealth: 2, agility: 2 },
      stat_maximums: createStatCaps(7, { stealth: 9, agility: 8, perception: 8 }),
      prerequisites: { required_classes: ['commoner'], required_species: [], required_gender: [] },
      exit_careers: ['assassin', 'master_thief', 'spy'],
      xp_cost: 100,
      enabled: true
    }
  ];
  
  const sheet = getSheet('classes');
  defaultClasses.forEach(cls => {
    saveRowFromObject(sheet, cls);
  });
}

// =========================== VOCATIONS ======================================

/**
 * Get all vocation templates
 */
function getVocationTemplates() {
  const sheet = getSheet('vocations');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    seedDefaultVocations();
    return getVocationTemplates();
  }
  
  const headers = data[0];
  const vocations = [];
  
  for (let i = 1; i < data.length; i++) {
    const voc = {};
    headers.forEach((header, j) => {
      let value = data[i][j];
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try { value = JSON.parse(value); } catch (e) {}
      }
      voc[header] = value;
    });
    vocations.push(voc);
  }
  
  return successResponse('templates.vocations', { vocations: vocations });
}

/**
 * Get vocation by ID
 */
function getVocationById(vocationId) {
  const sheet = getSheet('vocations');
  const row = findRowByValue(sheet, 'id', vocationId);
  
  if (row === -1) {
    return null;
  }
  
  return getRowAsObject(sheet, row);
}

/**
 * Seed default vocations
 */
function seedDefaultVocations() {
  const defaultVocations = [
    { id: 'common_sense', name: 'Common Sense', description: 'Basic survival instincts.', primary_stat: 'awareness', secondary_stat: 'luck', applies_to: ['survival', 'perception'] },
    { id: 'martial_training', name: 'Martial Training', description: 'Basic combat training.', primary_stat: 'fighting', secondary_stat: 'strength', applies_to: ['fighting', 'athletics'] },
    { id: 'squires_duty', name: "Squire's Duty", description: 'Service and learning.', primary_stat: 'fighting', secondary_stat: 'charisma', applies_to: ['fighting', 'persuasion'] },
    { id: 'knights_prowess', name: "Knight's Prowess", description: 'Martial excellence.', primary_stat: 'fighting', secondary_stat: 'awareness', applies_to: ['fighting', 'intimidation'] },
    { id: 'wilderness_wisdom', name: 'Wilderness Wisdom', description: 'Survival expertise.', primary_stat: 'survival', secondary_stat: 'perception', applies_to: ['survival', 'stealth', 'perception'] },
    { id: 'traders_eye', name: "Trader's Eye", description: 'Commercial acumen.', primary_stat: 'charisma', secondary_stat: 'perception', applies_to: ['persuasion', 'perception'] },
    { id: 'forge_mastery', name: 'Forge Mastery', description: 'Crafting expertise.', primary_stat: 'crafting', secondary_stat: 'strength', applies_to: ['crafting'] },
    { id: 'scholarly_insight', name: 'Scholarly Insight', description: 'Academic knowledge.', primary_stat: 'intellect', secondary_stat: 'perception', applies_to: ['intellect', 'arcana', 'medicine'] },
    { id: 'arcane_mastery', name: 'Arcane Mastery', description: 'Magical prowess.', primary_stat: 'arcana', secondary_stat: 'will', applies_to: ['arcana'] },
    { id: 'divine_favor', name: 'Divine Favor', description: 'Holy connection.', primary_stat: 'faith', secondary_stat: 'will', applies_to: ['faith', 'medicine'] },
    { id: 'shadow_craft', name: 'Shadow Craft', description: 'Thieving skills.', primary_stat: 'stealth', secondary_stat: 'agility', applies_to: ['stealth', 'acrobatics'] }
  ];
  
  const sheet = getSheet('vocations');
  defaultVocations.forEach(voc => {
    saveRowFromObject(sheet, voc);
  });
}

// =========================== ADMIN TEMPLATE CRUD ============================

/**
 * Create a new template (admin only)
 */
function createTemplate(data) {
  const type = data.type; // 'species', 'classes', or 'vocations'
  const template = data.template;
  
  if (!type || !template || !template.id) {
    return errorResponse('Missing type, template, or template.id', 'admin.templates.create');
  }
  
  const validTypes = ['species', 'classes', 'vocations'];
  if (!validTypes.includes(type)) {
    return errorResponse('Invalid template type. Must be: ' + validTypes.join(', '), 'admin.templates.create');
  }
  
  const sheet = getSheet(type);
  
  // Check if ID already exists
  const existingRow = findRowByValue(sheet, 'id', template.id);
  if (existingRow !== -1) {
    return errorResponse('Template with ID "' + template.id + '" already exists', 'admin.templates.create');
  }
  
  saveRowFromObject(sheet, template);
  
  return successResponse('admin.templates.create', {
    type: type,
    template: template,
    message: 'Template created successfully'
  });
}

/**
 * Update an existing template (admin only)
 */
function updateTemplate(data) {
  const type = data.type;
  const template = data.template;
  
  if (!type || !template || !template.id) {
    return errorResponse('Missing type, template, or template.id', 'admin.templates.update');
  }
  
  const sheet = getSheet(type);
  const row = findRowByValue(sheet, 'id', template.id);
  
  if (row === -1) {
    return errorResponse('Template not found', 'admin.templates.update');
  }
  
  saveRowFromObject(sheet, template, row);
  
  return successResponse('admin.templates.update', {
    type: type,
    template: template,
    message: 'Template updated successfully'
  });
}

/**
 * Delete a template (admin only)
 */
function deleteTemplate(data) {
  const type = data.type;
  const templateId = data.template_id;
  
  if (!type || !templateId) {
    return errorResponse('Missing type or template_id', 'admin.templates.delete');
  }
  
  const sheet = getSheet(type);
  const row = findRowByValue(sheet, 'id', templateId);
  
  if (row === -1) {
    return errorResponse('Template not found', 'admin.templates.delete');
  }
  
  sheet.deleteRow(row);
  
  return successResponse('admin.templates.delete', {
    type: type,
    template_id: templateId,
    message: 'Template deleted successfully'
  });
}

// =========================== HELPERS ========================================

/**
 * Create base stats object with default value and overrides
 */
function createBaseStats(defaultValue, overrides) {
  const stats = {};
  getStatNames().forEach(stat => {
    stats[stat] = (overrides && overrides[stat] !== undefined) ? overrides[stat] : defaultValue;
  });
  return stats;
}

/**
 * Create stat caps object with default value and overrides
 */
function createStatCaps(defaultValue, overrides) {
  const caps = {};
  getStatNames().forEach(stat => {
    caps[stat] = (overrides && overrides[stat] !== undefined) ? overrides[stat] : defaultValue;
  });
  return caps;
}

