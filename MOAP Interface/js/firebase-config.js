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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth (for anonymous auth)
const auth = firebase.auth();

console.log('Firebase initialized for project:', firebaseConfig.projectId);

