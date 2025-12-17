// ============================================================================
// Feudalism 4 - Character Management Module
// ============================================================================
// Handles character CRUD operations and validation
// ============================================================================

// Default starting values
const STARTING_XP = 100;
const STARTING_CURRENCY = 50;

// =========================== CHARACTER CRUD =================================

/**
 * Get character for a user
 */
function getCharacter(uuid) {
  const sheet = getSheet('characters');
  const row = findRowByValue(sheet, 'owner_uuid', uuid);
  
  if (row === -1) {
    return errorResponse('No character found', 'character.get');
  }
  
  const character = getRowAsObject(sheet, row);
  
  // Get species and class info for the character
  const speciesInfo = getSpeciesById(character.species_id);
  const classInfo = getClassById(character.class_id);
  const vocationInfo = classInfo ? getVocationById(classInfo.vocation_id) : null;
  
  return successResponse('character.get', {
    character: character,
    species: speciesInfo,
    class: classInfo,
    vocation: vocationInfo
  });
}

/**
 * Create a new character
 */
function createCharacter(uuid, data) {
  // Check if user already has a character
  const sheet = getSheet('characters');
  const existingRow = findRowByValue(sheet, 'owner_uuid', uuid);
  
  if (existingRow !== -1) {
    return errorResponse('Character already exists. Use update instead.', 'character.create');
  }
  
  // Validate required fields
  if (!data.name || !data.species_id) {
    return errorResponse('Missing required fields: name, species_id', 'character.create');
  }
  
  // Validate species exists
  const species = getSpeciesById(data.species_id);
  if (!species) {
    return errorResponse('Invalid species_id', 'character.create');
  }
  
  // Get default class (usually "commoner" or first available)
  const defaultClassId = data.class_id || getDefaultClassForSpecies(data.species_id);
  const classInfo = getClassById(defaultClassId);
  
  if (!classInfo) {
    return errorResponse('Invalid class_id', 'character.create');
  }
  
  // Initialize stats from species base stats
  const stats = JSON.parse(JSON.stringify(species.base_stats || getDefaultStats()));
  
  const now = new Date().toISOString();
  
  const character = {
    owner_uuid: uuid,
    name: data.name,
    title: data.title || '',
    gender: data.gender || 'unspecified',
    species_id: data.species_id,
    class_id: defaultClassId,
    xp_total: STARTING_XP,
    xp_available: STARTING_XP,
    currency: STARTING_CURRENCY,
    stats: stats,
    inventory: [],
    created_at: now,
    updated_at: now
  };
  
  saveRowFromObject(sheet, character);
  
  return successResponse('character.create', {
    character: character,
    message: 'Character created successfully'
  });
}

/**
 * Update an existing character
 */
function updateCharacter(uuid, data) {
  const sheet = getSheet('characters');
  const row = findRowByValue(sheet, 'owner_uuid', uuid);
  
  if (row === -1) {
    return errorResponse('No character found', 'character.update');
  }
  
  const character = getRowAsObject(sheet, row);
  
  // Validate stat changes if provided
  if (data.stats) {
    const validation = validateStatChanges(character, data.stats);
    if (!validation.valid) {
      return errorResponse(validation.error, 'character.update');
    }
    
    // Calculate XP cost
    const xpCost = calculateStatXPCost(character.stats, data.stats);
    if (xpCost > character.xp_available) {
      return errorResponse('Insufficient XP. Need ' + xpCost + ', have ' + character.xp_available, 'character.update');
    }
    
    character.stats = data.stats;
    character.xp_available -= xpCost;
  }
  
  // Update allowed fields
  if (data.name !== undefined) character.name = data.name;
  if (data.title !== undefined) character.title = data.title;
  if (data.gender !== undefined) character.gender = data.gender;
  
  // Class change requires validation
  if (data.class_id && data.class_id !== character.class_id) {
    const classChange = validateClassChange(character, data.class_id);
    if (!classChange.valid) {
      return errorResponse(classChange.error, 'character.update');
    }
    character.class_id = data.class_id;
  }
  
  character.updated_at = new Date().toISOString();
  
  saveRowFromObject(sheet, character, row);
  
  return successResponse('character.update', {
    character: character,
    message: 'Character updated successfully'
  });
}

/**
 * Delete a character
 */
function deleteCharacter(uuid) {
  const sheet = getSheet('characters');
  const row = findRowByValue(sheet, 'owner_uuid', uuid);
  
  if (row === -1) {
    return errorResponse('No character found', 'character.delete');
  }
  
  sheet.deleteRow(row);
  
  return successResponse('character.delete', {
    message: 'Character deleted successfully'
  });
}

// =========================== VALIDATION =====================================

/**
 * Validate stat changes against class/species caps
 */
function validateStatChanges(character, newStats) {
  const species = getSpeciesById(character.species_id);
  const classInfo = getClassById(character.class_id);
  
  if (!species || !classInfo) {
    return { valid: false, error: 'Invalid species or class configuration' };
  }
  
  const statNames = getStatNames();
  
  for (const stat of statNames) {
    const newValue = newStats[stat];
    const currentValue = character.stats[stat] || 1;
    
    // Check minimum (can't go below current or species base)
    const speciesBase = species.base_stats ? species.base_stats[stat] : 1;
    if (newValue < speciesBase) {
      return { valid: false, error: stat + ' cannot be lower than species base (' + speciesBase + ')' };
    }
    
    // Check species cap
    const speciesCap = species.stat_caps ? species.stat_caps[stat] : 9;
    if (newValue > speciesCap) {
      return { valid: false, error: stat + ' cannot exceed species cap (' + speciesCap + ')' };
    }
    
    // Check class cap
    const classCap = classInfo.stat_maximums ? classInfo.stat_maximums[stat] : 9;
    if (newValue > classCap) {
      return { valid: false, error: stat + ' cannot exceed class cap (' + classCap + ') in current career' };
    }
    
    // Stats can only increase, not decrease (except via special admin action)
    if (newValue < currentValue) {
      return { valid: false, error: stat + ' cannot be decreased' };
    }
  }
  
  return { valid: true };
}

/**
 * Calculate XP cost for stat changes
 */
function calculateStatXPCost(oldStats, newStats) {
  const statNames = getStatNames();
  let totalCost = 0;
  
  for (const stat of statNames) {
    const oldValue = oldStats[stat] || 1;
    const newValue = newStats[stat] || oldValue;
    
    // Cost is sum of values between old and new
    // e.g., going from 3 to 5 costs (4 + 5) = 9 XP
    for (let i = oldValue + 1; i <= newValue; i++) {
      totalCost += i * 10; // 10 XP per point level
    }
  }
  
  return totalCost;
}

/**
 * Validate class change
 */
function validateClassChange(character, newClassId) {
  const newClass = getClassById(newClassId);
  
  if (!newClass) {
    return { valid: false, error: 'Invalid class' };
  }
  
  if (!newClass.enabled) {
    return { valid: false, error: 'This class is not currently available' };
  }
  
  // Check prerequisites
  const prereqs = newClass.prerequisites || {};
  
  // Required classes
  if (prereqs.required_classes && prereqs.required_classes.length > 0) {
    // For now, check if current class is in the required list
    // In a full implementation, you'd track class history
    if (!prereqs.required_classes.includes(character.class_id)) {
      return { valid: false, error: 'Required previous career: ' + prereqs.required_classes.join(' or ') };
    }
  }
  
  // Required species
  if (prereqs.required_species && prereqs.required_species.length > 0) {
    if (!prereqs.required_species.includes(character.species_id)) {
      return { valid: false, error: 'This class is not available to your species' };
    }
  }
  
  // Required gender
  if (prereqs.required_gender && prereqs.required_gender.length > 0) {
    if (!prereqs.required_gender.includes(character.gender)) {
      return { valid: false, error: 'This class is not available to your gender' };
    }
  }
  
  // Check stat minimums
  if (newClass.stat_minimums) {
    for (const [stat, minValue] of Object.entries(newClass.stat_minimums)) {
      if ((character.stats[stat] || 0) < minValue) {
        return { valid: false, error: 'Insufficient ' + stat + '. Need ' + minValue + ', have ' + (character.stats[stat] || 0) };
      }
    }
  }
  
  // Check XP cost
  const xpCost = newClass.xp_cost || 0;
  if (character.xp_available < xpCost) {
    return { valid: false, error: 'Insufficient XP for class change. Need ' + xpCost };
  }
  
  return { valid: true };
}

// =========================== ADMIN FUNCTIONS ================================

/**
 * Award XP to a character (admin only)
 */
function awardXP(data) {
  const targetUUID = data.target_uuid;
  const amount = parseInt(data.amount) || 0;
  const reason = data.reason || 'Admin award';
  
  if (!targetUUID) {
    return errorResponse('Missing target_uuid', 'admin.xp.award');
  }
  
  if (amount === 0) {
    return errorResponse('Amount must be non-zero', 'admin.xp.award');
  }
  
  const sheet = getSheet('characters');
  const row = findRowByValue(sheet, 'owner_uuid', targetUUID);
  
  if (row === -1) {
    return errorResponse('Character not found', 'admin.xp.award');
  }
  
  const character = getRowAsObject(sheet, row);
  
  character.xp_total += amount;
  character.xp_available += amount;
  
  // Prevent negative XP
  if (character.xp_available < 0) {
    character.xp_available = 0;
  }
  
  character.updated_at = new Date().toISOString();
  saveRowFromObject(sheet, character, row);
  
  return successResponse('admin.xp.award', {
    target_uuid: targetUUID,
    amount: amount,
    reason: reason,
    new_total: character.xp_total,
    new_available: character.xp_available
  });
}

// =========================== HELPERS ========================================

/**
 * Get list of all stat names
 */
function getStatNames() {
  return [
    'fighting', 'agility', 'awareness', 'strength', 'endurance',
    'will', 'intellect', 'charisma', 'perception', 'stealth',
    'crafting', 'survival', 'medicine', 'arcana', 'faith',
    'persuasion', 'intimidation', 'athletics', 'acrobatics', 'luck'
  ];
}

/**
 * Get default stats object
 */
function getDefaultStats() {
  const stats = {};
  getStatNames().forEach(stat => {
    stats[stat] = 1;
  });
  return stats;
}

/**
 * Get default class for a species
 */
function getDefaultClassForSpecies(speciesId) {
  const species = getSpeciesById(speciesId);
  if (species && species.allowed_classes && species.allowed_classes.length > 0) {
    return species.allowed_classes[0];
  }
  return 'commoner';
}

