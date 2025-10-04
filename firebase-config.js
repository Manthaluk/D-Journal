// Firebase Configuration - Now uses REAL Firebase (Firestore & Auth)

// Note: To use this, you must include the Firebase SDK scripts
// in your HTML file before this script, like this:
/*
<script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
*/

const firebaseConfig = {
    // Add your Firebase config here when ready (using your current values)
  apiKey: "AIzaSyDLZ2jHul5XAwUS-2eYy6zBBNguc6JE2qU",
  authDomain: "journal-dailydd.firebaseapp.com",
  projectId: "journal-dailydd",
  storageBucket: "journal-dailydd.firebasestorage.app",
  messagingSenderId: "864590459511",
  appId: "1:864590459511:web:51d4af6598c732a2f80c72",
  measurementId: "G-SBLVV9ZENJ"
};

// Initialize Firebase App
const app = firebase.initializeApp(firebaseConfig);
const auth = app.auth();
const db = app.firestore();

// A real Firebase object exposing simplified functions for script.js
const realFirebase = {
    // --- Authentication Methods ---
    async signInWithEmailAndPassword(email, password) {
        return await auth.signInWithEmailAndPassword(email, password);
    },

    async createUserWithEmailAndPassword(email, password) {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        // Firebase Auth automatically logs in the user on sign up, so we return the result directly.
        return userCredential;
    },

    async sendPasswordResetEmail(email) {
        return await auth.sendPasswordResetEmail(email);
    },

    async signOut() {
        return await auth.signOut();
    },

    getCurrentUser() {
        return auth.currentUser;
    },

    // --- Firestore Methods (User Profile) ---
    async saveUserProfile(uid, data) {
        // Use Firestore to save to a 'users' collection
        return await db.collection('users').doc(uid).set(data, { merge: true });
    },

    async getUserProfile(uid) {
        const doc = await db.collection('users').doc(uid).get();
        return doc.exists ? doc.data() : null;
    },
    
    // --- Firestore Methods (Journal Entries) ---
    async saveEntry(uid, entry) {
        const entriesRef = db.collection('users').doc(uid).collection('entries');
        const entryWithTimestamp = {
            ...entry,
            userId: uid,
            createdAt: entry.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (entry.id) {
            // Update existing entry
            await entriesRef.doc(entry.id).update(entryWithTimestamp);
            return { id: entry.id, ...entryWithTimestamp };
        } else {
            // Create new entry
            const docRef = await entriesRef.add(entryWithTimestamp);
            return { id: docRef.id, ...entryWithTimestamp };
        }
    },

    async getEntries(uid) {
        const snapshot = await db.collection('users').doc(uid).collection('entries')
            .orderBy('updatedAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firebase Timestamp to JS Date String for compatibility with script.js
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: doc.data().updatedAt ? doc.data().updatedAt.toDate().toISOString() : new Date().toISOString()
        }));
    },

    async deleteEntry(uid, entryId) {
        return await db.collection('users').doc(uid).collection('entries').doc(entryId).delete();
    },

    // --- Firestore Methods (Mood Tracker) ---
    async saveMood(uid, mood) {
        const moodsRef = db.collection('users').doc(uid).collection('moods');
        const today = new Date().toDateString();
        
        // Query to find if a mood for today already exists
        const snapshot = await moodsRef
            .where('dateKey', '==', today)
            .limit(1)
            .get();

        const moodEntry = {
            mood: mood.mood,
            emoji: mood.emoji,
            note: mood.note,
            userId: uid,
            dateKey: today, // Key for easy querying
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!snapshot.empty) {
            // Update existing mood for today
            const docId = snapshot.docs[0].id;
            await moodsRef.doc(docId).update(moodEntry);
            return { id: docId, ...moodEntry };
        } else {
            // Create new mood
            const docRef = await moodsRef.add(moodEntry);
            return { id: docRef.id, ...moodEntry };
        }
    },

    async getMoods(uid) {
        const snapshot = await db.collection('users').doc(uid).collection('moods')
            .orderBy('timestamp', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firebase Timestamp to JS Date String for compatibility with script.js
            timestamp: doc.data().timestamp ? doc.data().timestamp.toDate().toISOString() : new Date().toISOString()
        }));
    }
};

// Export for use in other files
// Note: This assumes script.js is loaded AFTER this file, and BEFORE 
// the DOMContentLoaded event in script.js fires.
window.firebase = realFirebase;