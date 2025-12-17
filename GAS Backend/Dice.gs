// ============================================================================
// Feudalism 4 - Dice Rolling Module
// ============================================================================
// Implements the Exploding d20 Pool system with Vocation bonuses
// ============================================================================

// =========================== DICE ROLLING ===================================

/**
 * Roll a single d20 (1-20)
 */
function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Roll an exploding d20 (20s roll again and add)
 */
function rollExplodingD20() {
  let total = 0;
  let rolls = [];
  let roll = rollD20();
  
  total += roll;
  rolls.push(roll);
  
  // Explode on natural 20
  while (roll === 20) {
    roll = rollD20();
    total += roll;
    rolls.push(roll);
  }
  
  return {
    total: total,
    rolls: rolls,
    exploded: rolls.length > 1
  };
}

/**
 * Roll an exploding d20 pool (multiple dice)
 * @param {number} poolSize - Number of d20s to roll (typically 1-9)
 */
function rollExplodingD20Pool(poolSize) {
  poolSize = Math.max(1, Math.min(poolSize, 20)); // Clamp between 1 and 20
  
  let grandTotal = 0;
  let allRolls = [];
  let diceResults = [];
  let explosionCount = 0;
  
  for (let i = 0; i < poolSize; i++) {
    const dieResult = rollExplodingD20();
    grandTotal += dieResult.total;
    allRolls = allRolls.concat(dieResult.rolls);
    diceResults.push(dieResult);
    
    if (dieResult.exploded) {
      explosionCount += dieResult.rolls.length - 1;
    }
  }
  
  return {
    total: grandTotal,
    pool_size: poolSize,
    all_rolls: allRolls,
    dice_results: diceResults,
    explosions: explosionCount,
    average_per_die: grandTotal / poolSize
  };
}

// =========================== SKILL TESTS ====================================

/**
 * Perform a skill test
 * @param {string} uuid - Player UUID
 * @param {object} data - Test parameters { stat, difficulty, modifier }
 */
function performSkillTest(uuid, data) {
  const stat = data.stat;
  const difficulty = parseInt(data.difficulty) || 10;
  const modifier = parseInt(data.modifier) || 0;
  
  if (!stat) {
    return errorResponse('Missing stat parameter', 'roll.test');
  }
  
  // Get character
  const charResult = getCharacter(uuid);
  if (!charResult.success) {
    return errorResponse('Character not found', 'roll.test');
  }
  
  const character = charResult.data.character;
  const statValue = character.stats[stat] || 1;
  
  // Roll the dice pool
  const roll = rollExplodingD20Pool(statValue);
  
  // Calculate vocation bonus
  let vocationBonus = 0;
  let vocationName = null;
  
  const classInfo = getClassById(character.class_id);
  if (classInfo && classInfo.vocation_id) {
    const vocation = getVocationById(classInfo.vocation_id);
    if (vocation) {
      // Check if this stat benefits from the vocation
      const appliesTo = vocation.applies_to || [];
      if (appliesTo.includes(stat)) {
        const primaryValue = character.stats[vocation.primary_stat] || 0;
        const secondaryValue = character.stats[vocation.secondary_stat] || 0;
        vocationBonus = primaryValue + secondaryValue;
        vocationName = vocation.name;
      }
    }
  }
  
  // Calculate final result
  const finalResult = roll.total + vocationBonus + modifier;
  const success = finalResult >= difficulty;
  const margin = finalResult - difficulty;
  
  // Determine degree of success/failure
  let degree = 'normal';
  if (Math.abs(margin) >= 20) {
    degree = success ? 'critical_success' : 'critical_failure';
  } else if (Math.abs(margin) >= 10) {
    degree = success ? 'great_success' : 'great_failure';
  }
  
  // Check for "Peasant's Prayer" (unexpected success with low stat)
  const peasantsPrayer = success && statValue <= 2 && roll.explosions > 0;
  
  return successResponse('roll.test', {
    // Roll details
    stat: stat,
    stat_value: statValue,
    pool_size: roll.pool_size,
    roll_total: roll.total,
    all_rolls: roll.all_rolls,
    explosions: roll.explosions,
    
    // Vocation
    vocation_name: vocationName,
    vocation_bonus: vocationBonus,
    
    // Modifiers
    modifier: modifier,
    
    // Result
    final_result: finalResult,
    difficulty: difficulty,
    margin: margin,
    success: success,
    degree: degree,
    peasants_prayer: peasantsPrayer,
    
    // For display
    description: formatRollDescription(character.name, stat, roll, vocationBonus, modifier, finalResult, difficulty, success)
  });
}

/**
 * Perform an opposed test between two characters
 * @param {object} data - { attacker_uuid, defender_uuid, attacker_stat, defender_stat }
 */
function performOpposedTest(data) {
  const attackerUUID = data.attacker_uuid;
  const defenderUUID = data.defender_uuid;
  const attackerStat = data.attacker_stat;
  const defenderStat = data.defender_stat || attackerStat;
  
  // Get both characters
  const attackerResult = getCharacter(attackerUUID);
  const defenderResult = getCharacter(defenderUUID);
  
  if (!attackerResult.success) {
    return errorResponse('Attacker character not found', 'roll.opposed');
  }
  if (!defenderResult.success) {
    return errorResponse('Defender character not found', 'roll.opposed');
  }
  
  const attacker = attackerResult.data.character;
  const defender = defenderResult.data.character;
  
  // Roll for attacker
  const attackerStatValue = attacker.stats[attackerStat] || 1;
  const attackerRoll = rollExplodingD20Pool(attackerStatValue);
  const attackerVocation = calculateVocationBonus(attacker, attackerStat);
  const attackerTotal = attackerRoll.total + attackerVocation.bonus;
  
  // Roll for defender
  const defenderStatValue = defender.stats[defenderStat] || 1;
  const defenderRoll = rollExplodingD20Pool(defenderStatValue);
  const defenderVocation = calculateVocationBonus(defender, defenderStat);
  const defenderTotal = defenderRoll.total + defenderVocation.bonus;
  
  // Determine winner
  const margin = attackerTotal - defenderTotal;
  let winner = 'tie';
  if (margin > 0) winner = 'attacker';
  else if (margin < 0) winner = 'defender';
  
  return successResponse('roll.opposed', {
    attacker: {
      name: attacker.name,
      stat: attackerStat,
      stat_value: attackerStatValue,
      roll_total: attackerRoll.total,
      rolls: attackerRoll.all_rolls,
      explosions: attackerRoll.explosions,
      vocation: attackerVocation.name,
      vocation_bonus: attackerVocation.bonus,
      final_total: attackerTotal
    },
    defender: {
      name: defender.name,
      stat: defenderStat,
      stat_value: defenderStatValue,
      roll_total: defenderRoll.total,
      rolls: defenderRoll.all_rolls,
      explosions: defenderRoll.explosions,
      vocation: defenderVocation.name,
      vocation_bonus: defenderVocation.bonus,
      final_total: defenderTotal
    },
    winner: winner,
    margin: Math.abs(margin)
  });
}

// =========================== HELPERS ========================================

/**
 * Calculate vocation bonus for a character and stat
 */
function calculateVocationBonus(character, stat) {
  const classInfo = getClassById(character.class_id);
  if (!classInfo || !classInfo.vocation_id) {
    return { bonus: 0, name: null };
  }
  
  const vocation = getVocationById(classInfo.vocation_id);
  if (!vocation) {
    return { bonus: 0, name: null };
  }
  
  const appliesTo = vocation.applies_to || [];
  if (!appliesTo.includes(stat)) {
    return { bonus: 0, name: vocation.name };
  }
  
  const primaryValue = character.stats[vocation.primary_stat] || 0;
  const secondaryValue = character.stats[vocation.secondary_stat] || 0;
  
  return {
    bonus: primaryValue + secondaryValue,
    name: vocation.name,
    primary_stat: vocation.primary_stat,
    secondary_stat: vocation.secondary_stat
  };
}

/**
 * Format a human-readable roll description
 */
function formatRollDescription(name, stat, roll, vocationBonus, modifier, finalResult, difficulty, success) {
  let desc = name + ' tests ' + stat.charAt(0).toUpperCase() + stat.slice(1);
  desc += ' (' + roll.pool_size + 'd20)';
  desc += ': [' + roll.all_rolls.join(', ') + ']';
  desc += ' = ' + roll.total;
  
  if (vocationBonus > 0) {
    desc += ' + ' + vocationBonus + ' (Vocation)';
  }
  
  if (modifier !== 0) {
    desc += (modifier > 0 ? ' + ' : ' ') + modifier + ' (Modifier)';
  }
  
  desc += ' = ' + finalResult + ' vs DC ' + difficulty;
  desc += ' → ' + (success ? 'SUCCESS' : 'FAILURE');
  
  if (roll.explosions > 0) {
    desc += ' (' + roll.explosions + ' explosion' + (roll.explosions > 1 ? 's' : '') + '!)';
  }
  
  return desc;
}

// =========================== PROBABILITY ANALYSIS ===========================

/**
 * Calculate probability statistics for a pool size
 * Useful for admins balancing the game
 */
function analyzePoolProbabilities(poolSize) {
  poolSize = Math.max(1, Math.min(poolSize, 9));
  
  // Run Monte Carlo simulation
  const simulations = 10000;
  let results = [];
  let explosionCounts = [];
  
  for (let i = 0; i < simulations; i++) {
    const roll = rollExplodingD20Pool(poolSize);
    results.push(roll.total);
    explosionCounts.push(roll.explosions);
  }
  
  // Calculate statistics
  results.sort((a, b) => a - b);
  
  const sum = results.reduce((a, b) => a + b, 0);
  const mean = sum / simulations;
  
  const median = results[Math.floor(simulations / 2)];
  const min = results[0];
  const max = results[simulations - 1];
  
  const percentile25 = results[Math.floor(simulations * 0.25)];
  const percentile75 = results[Math.floor(simulations * 0.75)];
  const percentile95 = results[Math.floor(simulations * 0.95)];
  
  const totalExplosions = explosionCounts.reduce((a, b) => a + b, 0);
  const explosionRate = totalExplosions / simulations;
  
  return {
    pool_size: poolSize,
    simulations: simulations,
    statistics: {
      mean: Math.round(mean * 100) / 100,
      median: median,
      min: min,
      max: max,
      percentile_25: percentile25,
      percentile_75: percentile75,
      percentile_95: percentile95,
      explosion_rate: Math.round(explosionRate * 100) / 100
    }
  };
}

