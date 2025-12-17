// ============================================================================
// Feudalism 4 - Authentication Module
// ============================================================================
// Handles user authentication, session management, and token validation
// ============================================================================

// Session configuration
const SESSION_DURATION_HOURS = 24;
const TOKEN_LENGTH = 64;

// =========================== LOGIN / LOGOUT =================================

/**
 * Handle user login request
 */
function handleLogin(request) {
  const uuid = request.uuid;
  const username = request.username;
  const objectKey = request.object_key;
  
  if (!uuid || !username) {
    return errorResponse('Missing required fields: uuid, username', 'auth.login');
  }
  
  // Get or create user
  let user = getUser(uuid);
  
  if (!user) {
    // Create new user
    user = createUser(uuid, username);
  } else {
    // Update last login
    updateUserLogin(uuid);
    
    // Check if banned
    if (user.banned) {
      return errorResponse('Your account has been banned.', 'auth.login');
    }
  }
  
  // Generate session token
  const token = generateToken();
  const now = new Date();
  const expires = new Date(now.getTime() + (SESSION_DURATION_HOURS * 60 * 60 * 1000));
  
  // Store session
  createSession(token, uuid, objectKey, now, expires);
  
  // Check if user has a character
  const character = getCharacter(uuid);
  const hasCharacter = character && character.success;
  
  return {
    success: true,
    action: 'auth.login',
    token: token,
    role: user.role,
    has_character: hasCharacter,
    user: {
      uuid: user.uuid,
      username: user.username,
      display_name: user.display_name,
      role: user.role
    },
    moap_url: getMOAPUrl(),
    error: null,
    timestamp: now.toISOString()
  };
}

/**
 * Handle user logout request
 */
function handleLogout(uuid, token) {
  if (token) {
    invalidateSession(token);
  }
  
  return successResponse('auth.logout', { message: 'Logged out successfully' });
}

/**
 * Handle session heartbeat (keep-alive)
 */
function handleHeartbeat(uuid, token) {
  if (!validateSession(uuid, token)) {
    return errorResponse('Session expired', 'auth.heartbeat');
  }
  
  // Update last activity
  updateSessionActivity(token);
  
  return successResponse('auth.heartbeat', { message: 'Session active' });
}

// =========================== TOKEN MANAGEMENT ===============================

/**
 * Generate a cryptographically random token
 */
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Validate a session token
 */
function validateSession(uuid, token) {
  if (!token || !uuid) {
    return false;
  }
  
  const sheet = getSheet('sessions');
  const row = findRowByValue(sheet, 'token', token);
  
  if (row === -1) {
    return false;
  }
  
  const session = getRowAsObject(sheet, row);
  
  // Check UUID matches
  if (session.uuid !== uuid) {
    return false;
  }
  
  // Check expiration
  const expires = new Date(session.expires_at);
  if (new Date() > expires) {
    // Session expired, remove it
    sheet.deleteRow(row);
    return false;
  }
  
  return true;
}

/**
 * Create a new session
 */
function createSession(token, uuid, objectKey, created, expires) {
  // First, invalidate any existing sessions for this user
  invalidateUserSessions(uuid);
  
  const sheet = getSheet('sessions');
  const session = {
    token: token,
    uuid: uuid,
    object_key: objectKey,
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
    last_activity: created.toISOString()
  };
  
  saveRowFromObject(sheet, session);
}

/**
 * Invalidate a specific session
 */
function invalidateSession(token) {
  const sheet = getSheet('sessions');
  const row = findRowByValue(sheet, 'token', token);
  
  if (row !== -1) {
    sheet.deleteRow(row);
  }
}

/**
 * Invalidate all sessions for a user
 */
function invalidateUserSessions(uuid) {
  const sheet = getSheet('sessions');
  const data = sheet.getDataRange().getValues();
  const uuidCol = data[0].indexOf('uuid');
  
  // Find and delete all sessions for this user (iterate backwards to avoid row shift issues)
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][uuidCol] === uuid) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Update session last activity timestamp
 */
function updateSessionActivity(token) {
  const sheet = getSheet('sessions');
  const row = findRowByValue(sheet, 'token', token);
  
  if (row !== -1) {
    const session = getRowAsObject(sheet, row);
    session.last_activity = new Date().toISOString();
    saveRowFromObject(sheet, session, row);
  }
}

// =========================== USER MANAGEMENT ================================

/**
 * Get user by UUID
 */
function getUser(uuid) {
  const sheet = getSheet('users');
  const row = findRowByValue(sheet, 'uuid', uuid);
  
  if (row === -1) {
    return null;
  }
  
  return getRowAsObject(sheet, row);
}

/**
 * Create a new user
 */
function createUser(uuid, username) {
  const sheet = getSheet('users');
  const now = new Date().toISOString();
  
  const user = {
    uuid: uuid,
    username: username,
    display_name: username,
    role: 'player',
    created_at: now,
    last_login: now,
    banned: false
  };
  
  saveRowFromObject(sheet, user);
  return user;
}

/**
 * Update user's last login time
 */
function updateUserLogin(uuid) {
  const sheet = getSheet('users');
  const row = findRowByValue(sheet, 'uuid', uuid);
  
  if (row !== -1) {
    const user = getRowAsObject(sheet, row);
    user.last_login = new Date().toISOString();
    saveRowFromObject(sheet, user, row);
  }
}

/**
 * List all users (admin function)
 */
function listUsers() {
  const sheet = getSheet('users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const user = {};
    headers.forEach((header, j) => {
      user[header] = data[i][j];
    });
    users.push(user);
  }
  
  return successResponse('admin.users.list', { users: users, count: users.length });
}

/**
 * Promote or demote a user
 */
function promoteUser(data) {
  const targetUUID = data.target_uuid;
  const newRole = data.role;
  
  if (!targetUUID || !newRole) {
    return errorResponse('Missing target_uuid or role', 'admin.users.promote');
  }
  
  const validRoles = ['player', 'sim_admin', 'sys_admin'];
  if (!validRoles.includes(newRole)) {
    return errorResponse('Invalid role. Must be: ' + validRoles.join(', '), 'admin.users.promote');
  }
  
  const sheet = getSheet('users');
  const row = findRowByValue(sheet, 'uuid', targetUUID);
  
  if (row === -1) {
    return errorResponse('User not found', 'admin.users.promote');
  }
  
  const user = getRowAsObject(sheet, row);
  const oldRole = user.role;
  user.role = newRole;
  saveRowFromObject(sheet, user, row);
  
  return successResponse('admin.users.promote', {
    target_uuid: targetUUID,
    old_role: oldRole,
    new_role: newRole
  });
}

/**
 * Ban or unban a user
 */
function banUser(data) {
  const targetUUID = data.target_uuid;
  const banned = data.banned !== false; // Default to true
  
  if (!targetUUID) {
    return errorResponse('Missing target_uuid', 'admin.users.ban');
  }
  
  const sheet = getSheet('users');
  const row = findRowByValue(sheet, 'uuid', targetUUID);
  
  if (row === -1) {
    return errorResponse('User not found', 'admin.users.ban');
  }
  
  const user = getRowAsObject(sheet, row);
  user.banned = banned;
  saveRowFromObject(sheet, user, row);
  
  // Invalidate their sessions if banning
  if (banned) {
    invalidateUserSessions(targetUUID);
  }
  
  return successResponse('admin.users.ban', {
    target_uuid: targetUUID,
    banned: banned
  });
}

// =========================== UTILITY ========================================

/**
 * Get the MOAP interface URL
 */
function getMOAPUrl() {
  // Return Firebase Hosting URL or your web app URL
  return 'https://YOUR-PROJECT.web.app';
}

/**
 * Clean up expired sessions (run periodically via trigger)
 */
function cleanupExpiredSessions() {
  const sheet = getSheet('sessions');
  const data = sheet.getDataRange().getValues();
  const expiresCol = data[0].indexOf('expires_at');
  const now = new Date();
  
  // Delete expired sessions (iterate backwards)
  for (let i = data.length - 1; i >= 1; i--) {
    const expires = new Date(data[i][expiresCol]);
    if (now > expires) {
      sheet.deleteRow(i + 1);
    }
  }
  
  Logger.log('Cleaned up expired sessions at ' + now.toISOString());
}

