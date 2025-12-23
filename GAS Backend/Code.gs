// ============================================================================
// Feudalism 4 - Google Apps Script Backend
// ============================================================================
// Main entry point for all HTTP requests from LSL and MOAP
// ============================================================================

// =========================== CONFIGURATION ==================================
// IMPORTANT: Create a Google Sheet and paste its ID here!
// The ID is the long string in the URL: docs.google.com/spreadsheets/d/THIS_PART/edit
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// Firebase configuration (optional - for future Firestore migration)
const FIREBASE_URL = 'https://YOUR-PROJECT-ID.firebaseio.com';
const FIREBASE_SECRET = 'YOUR-DATABASE-SECRET';
const FIRESTORE_PROJECT_ID = 'YOUR-PROJECT-ID';

// =========================== HTTP HANDLERS ==================================

/**
 * Handle GET requests (for testing/health check)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Feudalism 4 API is running',
    version: '4.0.0',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests (main API endpoint)
 */
function doPost(e) {
  try {
    // Parse incoming JSON
    const request = JSON.parse(e.postData.contents);
    
    // Extract common fields
    const action = request.action || '';
    const uuid = request.uuid || '';
    const token = request.token || '';
    const data = request.data || {};
    
    // Route to appropriate handler
    let response;
    
    switch (action) {
      // Authentication
      case 'auth.login':
        response = handleLogin(request);
        break;
      case 'auth.logout':
        response = handleLogout(uuid, token);
        break;
      case 'auth.heartbeat':
        response = handleHeartbeat(uuid, token);
        break;
        
      // Character operations
      case 'character.get':
        response = requireAuth(uuid, token, () => getCharacter(uuid));
        break;
      case 'character.create':
        response = requireAuth(uuid, token, () => createCharacter(uuid, data));
        break;
      case 'character.update':
        response = requireAuth(uuid, token, () => updateCharacter(uuid, data));
        break;
      case 'character.delete':
        response = requireAuth(uuid, token, () => deleteCharacter(uuid));
        break;
        
      // Template operations (public - no auth required for reading)
      case 'templates.species':
        response = getSpeciesTemplates();
        break;
      case 'templates.classes':
        response = getClassTemplates();
        break;
      case 'templates.vocations':
        response = getVocationTemplates();
        break;
        
      // Game mechanics
      case 'roll.test':
        response = requireAuth(uuid, token, () => performSkillTest(uuid, data));
        break;
        
      // Admin operations
      case 'admin.users.list':
        response = requireAdmin(uuid, token, 'sim_admin', () => listUsers());
        break;
      case 'admin.users.promote':
        response = requireAdmin(uuid, token, 'sys_admin', () => promoteUser(data));
        break;
      case 'admin.users.ban':
        response = requireAdmin(uuid, token, 'sim_admin', () => banUser(data));
        break;
      case 'admin.templates.create':
        response = requireAdmin(uuid, token, 'sys_admin', () => createTemplate(data));
        break;
      case 'admin.templates.update':
        response = requireAdmin(uuid, token, 'sys_admin', () => updateTemplate(data));
        break;
      case 'admin.templates.delete':
        response = requireAdmin(uuid, token, 'sys_admin', () => deleteTemplate(data));
        break;
      case 'admin.xp.award':
        response = requireAdmin(uuid, token, 'sim_admin', () => awardXP(data));
        break;
        
      default:
        response = errorResponse('Unknown action: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error processing request: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify(
      errorResponse('Server error: ' + error.message)
    )).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================== RESPONSE HELPERS ===============================

function successResponse(action, data) {
  return {
    success: true,
    action: action,
    data: data,
    error: null,
    timestamp: new Date().toISOString()
  };
}

function errorResponse(message, action) {
  return {
    success: false,
    action: action || 'unknown',
    data: null,
    error: message,
    timestamp: new Date().toISOString()
  };
}

// =========================== AUTH MIDDLEWARE ================================

/**
 * Require valid authentication before executing callback
 */
function requireAuth(uuid, token, callback) {
  if (!validateSession(uuid, token)) {
    return errorResponse('Invalid or expired session. Please re-authenticate.');
  }
  return callback();
}

/**
 * Require admin role before executing callback
 */
function requireAdmin(uuid, token, requiredRole, callback) {
  if (!validateSession(uuid, token)) {
    return errorResponse('Invalid or expired session. Please re-authenticate.');
  }
  
  const user = getUser(uuid);
  if (!user) {
    return errorResponse('User not found.');
  }
  
  const roleHierarchy = { 'player': 1, 'sim_admin': 2, 'sys_admin': 3 };
  if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
    return errorResponse('Insufficient permissions. Required: ' + requiredRole);
  }
  
  return callback();
}

// =========================== DATABASE HELPERS ===============================

/**
 * Get data from spreadsheet-based storage
 * Uses the SPREADSHEET_ID constant defined at the top of this file
 */
function getSpreadsheet() {
  // Use the configured spreadsheet ID
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  
  // Fallback: try to get active spreadsheet (works when running from spreadsheet)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    return ss;
  }
  
  // If no spreadsheet configured, throw helpful error
  throw new Error('No spreadsheet configured! Please set SPREADSHEET_ID in Code.gs');
}

/**
 * Get or create a sheet by name
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Initialize headers based on sheet type
    initializeSheet(sheet, sheetName);
  }
  return sheet;
}

/**
 * Initialize sheet with appropriate headers
 */
function initializeSheet(sheet, sheetName) {
  const headers = {
    'users': ['uuid', 'username', 'display_name', 'role', 'created_at', 'last_login', 'banned'],
    'characters': ['owner_uuid', 'name', 'title', 'gender', 'species_id', 'class_id', 
                   'xp_total', 'xp_available', 'currency', 'stats', 'inventory', 
                   'created_at', 'updated_at'],
    'sessions': ['token', 'uuid', 'object_key', 'created_at', 'expires_at', 'last_activity'],
    'species': ['id', 'name', 'description', 'base_stats', 'stat_caps', 'abilities', 
                'allowed_classes', 'health_factor', 'stamina_factor', 'mana_factor', 'mana_chance', 'enabled'],
    'classes': ['id', 'name', 'description', 'vocation_id', 'stat_minimums', 'stat_maximums',
                'prerequisites', 'exit_careers', 'xp_cost', 'enabled'],
    'vocations': ['id', 'name', 'description', 'primary_stat', 'secondary_stat', 'applies_to']
  };
  
  if (headers[sheetName]) {
    sheet.getRange(1, 1, 1, headers[sheetName].length).setValues([headers[sheetName]]);
    sheet.setFrozenRows(1);
  }
}

/**
 * Find row by column value
 */
function findRowByValue(sheet, column, value) {
  const data = sheet.getDataRange().getValues();
  const colIndex = data[0].indexOf(column);
  if (colIndex === -1) return -1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] === value) {
      return i + 1; // 1-indexed row number
    }
  }
  return -1;
}

/**
 * Get row data as object
 */
function getRowAsObject(sheet, rowNum) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const obj = {};
  headers.forEach((header, i) => {
    let value = rowData[i];
    // Parse JSON strings
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        value = JSON.parse(value);
      } catch (e) {}
    }
    obj[header] = value;
  });
  return obj;
}

/**
 * Save object as row
 */
function saveRowFromObject(sheet, obj, rowNum) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = headers.map(header => {
    let value = obj[header];
    // Stringify objects/arrays
    if (typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
    }
    return value || '';
  });
  
  if (rowNum) {
    sheet.getRange(rowNum, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

