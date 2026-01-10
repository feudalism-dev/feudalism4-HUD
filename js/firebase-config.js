// ============================================================================
// Feudalism 4 - Firebase Configuration
// ============================================================================
// Initialize Firebase for direct Firestore access
// ============================================================================

// Firebase configuration for feudalism4-rpg project
const firebaseConfig = {
    apiKey: "AIzaSyDan09oRR3M9EYaXHqVC8BDyGgybPvayTQ",
    authDomain: "feudalism4-rpg.firebaseapp.com",
    projectId: "feudalism4-rpg",
    storageBucket: "feudalism4-rpg.firebasestorage.app",
    messagingSenderId: "417226860670",
    appId: "1:417226860670:web:4235990fc3bf9eaa1f502f"
};

// Initialize Firebase with error handling for SL browser
// IMPORTANT: These must be global variables (var) so api-firestore.js can access them
var db, auth;

if (window.simpleDebug) {
    window.simpleDebug('firebase-config.js executing...', 'info');
}

try {
    if (window.simpleDebug) {
        window.simpleDebug('Checking if firebase is defined...', 'debug');
    }
    
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
    }
    
    if (window.simpleDebug) {
        window.simpleDebug('Firebase SDK found, initializing...', 'info');
    }
    
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    
    if (window.simpleDebug) {
        window.simpleDebug('Firebase initialized for project: ' + firebaseConfig.projectId, 'info');
    }
    console.log('Firebase initialized for project:', firebaseConfig.projectId);
    
    // Test if Firestore methods are available
    if (typeof db.collection !== 'function') {
        throw new Error('Firestore collection method not available');
    }
    
    if (window.simpleDebug) {
        window.simpleDebug('Firestore methods verified', 'info');
    }
    console.log('Firestore methods verified');
} catch (error) {
    if (window.simpleDebug) {
        window.simpleDebug('Firebase initialization ERROR: ' + error.message, 'error');
    }
    console.error('Firebase initialization error:', error);
    console.error('This may be a Second Life browser compatibility issue');
    
    // Show error in UI
    if (document.body) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #ff6b6b; color: white; padding: 20px; z-index: 10000; text-align: center;';
        errorDiv.innerHTML = `
            <h2>⚠️ Firebase Initialization Failed</h2>
            <p>Error: ${error.message}</p>
            <p>This may be a browser compatibility issue. Please check the console.</p>
        `;
        document.body.appendChild(errorDiv);
    }
    
    // Create dummy objects to prevent further errors
    db = { collection: function() { 
        console.error('Firestore not initialized - collection() called');
        return { get: function() { return Promise.resolve({ empty: true, forEach: function() {} }); } };
    }};
    auth = { signInAnonymously: function() { return Promise.reject(new Error('Auth not initialized')); } };
}

