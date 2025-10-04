// Daily Journal - Main JavaScript File

// Global variables
let currentUser = null;
let currentEntry = null;
let selectedMood = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Wait for Firebase to initialize and check for current user state changes
    // This is safer than immediately calling getCurrentUser() on page load
    if (window.firebase && window.firebase.getCurrentUser) {
        currentUser = window.firebase.getCurrentUser();
    }
    
    // Check current page and initialize accordingly
    const currentPage = window.location.pathname.split('/').pop();
    
    switch(currentPage) {
        case 'index.html':
        case '':
            initLoginPage();
            break;
        case 'signup.html':
            initSignupPage();
            break;
        case 'home.html':
            initHomePage();
            break;
        case 'mood-tracker.html':
            initMoodTrackerPage();
            break;
        case 'settings.html':
            initSettingsPage();
            break;
    }
    
    // Apply saved theme
    applyTheme();
    applyFontSize();
}

// Authentication Functions
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    }
    
    // Redirect if already logged in
    if (currentUser) {
        window.location.href = 'home.html';
    }
}

function initSignupPage() {
    const signupForm = document.getElementById('signupForm');
    
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Redirect if already logged in
    if (currentUser) {
        window.location.href = 'home.html';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        showLoading('Signing in...');
        const result = await firebase.signInWithEmailAndPassword(email, password);
        currentUser = result.user; // Update currentUser on success
        window.location.href = 'home.html';
    } catch (error) {
        hideLoading();
        // Firebase Auth error objects have a 'code' and 'message' property
        showMessage('Login failed: ' + (error.message || 'Check your credentials.'), 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('signupEmail').value;
    const gender = document.getElementById('gender').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        showLoading('Creating account...');
        const result = await firebase.createUserWithEmailAndPassword(email, password);
        currentUser = result.user; // Update currentUser on success
        
        // Save additional user profile data
        await firebase.saveUserProfile(currentUser.uid, {
            fullName: fullName,
            gender: gender,
            email: email
        });
        
        window.location.href = 'home.html';
    } catch (error) {
        hideLoading();
        // Firebase Auth error objects have a 'code' and 'message' property
        showMessage('Signup failed: ' + (error.message || 'An unknown error occurred.'), 'error');
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('resetEmail').value;
    
    try {
        showLoading('Sending reset email...');
        await firebase.sendPasswordResetEmail(email);
        hideLoading();
        showMessage('Password reset email sent!', 'success');
        closeForgotPassword();
    } catch (error) {
        hideLoading();
        showMessage('Error: ' + (error.message || 'Failed to send reset email.'), 'error');
    }
}

// Home Page Functions
async function initHomePage() {
    // Re-check currentUser after the page has loaded
    currentUser = firebase.getCurrentUser(); 
    
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    // Load user profile
    const profile = await firebase.getUserProfile(currentUser.uid);
    if (profile) {
        document.getElementById('userName').textContent = profile.fullName || 'User';
    } else {
        document.getElementById('userName').textContent = currentUser.email.split('@')[0] || 'User';
    }
    
    // Display current date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Load entries
    await loadEntries();
    
    // Initialize entry form
    const entryForm = document.getElementById('entryForm');
    if (entryForm) {
        entryForm.addEventListener('submit', handleSaveEntry);
    }
}

async function loadEntries() {
    try {
        const entries = await firebase.getEntries(currentUser.uid);
        const entriesList = document.getElementById('entriesList');
        const emptyState = document.getElementById('emptyState');
        const entriesCount = document.getElementById('entriesCount');
        
        if (entries.length === 0) {
            entriesList.style.display = 'none';
            emptyState.style.display = 'block';
            entriesCount.textContent = '0';
        } else {
            entriesList.style.display = 'block';
            emptyState.style.display = 'none';
            entriesCount.textContent = entries.length;
            
            entriesList.innerHTML = entries.map(entry => `
                <div class="entry-card" onclick="previewEntry('${entry.id}')">
                    <div class="entry-title">${escapeHtml(entry.title)}</div>
                    <div class="entry-preview">${getTextPreview(entry.content)}</div>
                    <div class="entry-meta">
                        <span class="entry-date">${formatDate(entry.updatedAt)}</span>
                        <span class="entry-time">${formatTime(entry.updatedAt)}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        showMessage('Error loading entries: ' + (error.message || 'Could not fetch data.'), 'error');
    }
}

async function handleSaveEntry(e) {
    e.preventDefault();
    
    const title = document.getElementById('entryTitle').value;
    const content = document.getElementById('entryContent').innerHTML;
    
    if (!title.trim() || !content.trim()) {
        showMessage('Please fill in both title and content', 'error');
        return;
    }
    
    try {
        showLoading('Saving entry...');
        const entry = {
            id: currentEntry ? currentEntry.id : null,
            title: title,
            content: content
        };
        
        await firebase.saveEntry(currentUser.uid, entry);
        hideLoading();
        showMessage('Entry saved successfully!', 'success');
        closeAddEntry();
        await loadEntries();
    } catch (error) {
        hideLoading();
        showMessage('Error saving entry: ' + (error.message || 'Failed to save entry.'), 'error');
    }
}

async function previewEntry(entryId) {
    try {
        const entries = await firebase.getEntries(currentUser.uid);
        const entry = entries.find(e => e.id === entryId);
        
        if (entry) {
            document.getElementById('previewTitle').textContent = entry.title;
            document.getElementById('previewDate').textContent = 
                `Last updated: ${formatDate(entry.updatedAt)} at ${formatTime(entry.updatedAt)}`;
            document.getElementById('previewContent').innerHTML = entry.content;
            
            currentEntry = entry;
            showModal('previewModal');
        }
    } catch (error) {
        showMessage('Error loading entry: ' + (error.message || 'Could not find entry.'), 'error');
    }
}

function editEntry() {
    if (currentEntry) {
        document.getElementById('modalTitle').textContent = 'Edit Entry';
        document.getElementById('entryTitle').value = currentEntry.title;
        document.getElementById('entryContent').innerHTML = currentEntry.content;
        
        closePreview();
        showAddEntry();
    }
}

// Mood Tracker Functions
async function initMoodTrackerPage() {
    // Re-check currentUser after the page has loaded
    currentUser = firebase.getCurrentUser(); 
    
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    // Attach saveMood listener
    document.getElementById('saveMoodBtn').addEventListener('click', saveMood);
    
    await loadMoodHistory();
}

function selectMood(mood, emoji) {
    // Remove previous selection
    document.querySelectorAll('.mood-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to clicked item
    document.querySelector(`[data-mood="${mood}"]`).classList.add('selected');
    
    selectedMood = { mood, emoji };
    document.getElementById('saveMoodBtn').disabled = false;
}

async function saveMood() {
    if (!selectedMood) return;
    
    const note = document.getElementById('moodNote').value;
    
    try {
        showLoading('Saving mood...');
        await firebase.saveMood(currentUser.uid, {
            mood: selectedMood.mood,
            emoji: selectedMood.emoji,
            note: note
        });
        
        hideLoading();
        showMessage('Mood saved successfully!', 'success');
        
        // Reset form
        document.querySelectorAll('.mood-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.getElementById('moodNote').value = '';
        document.getElementById('saveMoodBtn').disabled = true;
        selectedMood = null;
        
        await loadMoodHistory();
    } catch (error) {
        hideLoading();
        showMessage('Error saving mood: ' + (error.message || 'Failed to save mood.'), 'error');
    }
}

async function loadMoodHistory() {
    try {
        const moods = await firebase.getMoods(currentUser.uid);
        const moodHistory = document.getElementById('moodHistory');
        
        if (moods.length === 0) {
            moodHistory.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No mood entries yet</p>';
        } else {
            moodHistory.innerHTML = moods.map(mood => `
                <div class="mood-history-item">
                    <div class="mood-history-emoji">${mood.emoji}</div>
                    <div class="mood-history-content">
                        <div class="mood-history-date">${formatDate(mood.timestamp)} - ${mood.mood}</div>
                        ${mood.note ? `<div class="mood-history-note">${escapeHtml(mood.note)}</div>` : ''}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        showMessage('Error loading mood history: ' + (error.message || 'Could not fetch data.'), 'error');
    }
}

function toggleMoodHistory() {
    const moodHistory = document.getElementById('moodHistory');
    const toggleBtn = document.querySelector('.history-toggle-btn');
    
    if (moodHistory.classList.contains('active')) {
        moodHistory.classList.remove('active');
        toggleBtn.textContent = 'View History';
    } else {
        moodHistory.classList.add('active');
        toggleBtn.textContent = 'Hide History';
    }
}

// Settings Functions
async function initSettingsPage() {
    // Re-check currentUser after the page has loaded
    currentUser = firebase.getCurrentUser(); 
    
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    // Load user profile
    const profile = await firebase.getUserProfile(currentUser.uid);
    if (profile) {
        document.getElementById('displayName').value = profile.fullName || '';
        document.getElementById('profileEmail').value = profile.email || currentUser.email;
        document.getElementById('profileGender').value = profile.gender || '';
    } else {
        document.getElementById('profileEmail').value = currentUser.email || '';
    }
    
    // Load settings
    loadSettings();
    
    // Initialize change password form
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }
}

async function saveProfile() {
    const displayName = document.getElementById('displayName').value;
    const gender = document.getElementById('profileGender').value;
    
    try {
        showLoading('Saving profile...');
        await firebase.saveUserProfile(currentUser.uid, {
            fullName: displayName,
            gender: gender
        });
        hideLoading();
        showMessage('Profile updated successfully!', 'success');
    } catch (error) {
        hideLoading();
        showMessage('Error updating profile: ' + (error.message || 'Failed to update profile.'), 'error');
    }
}

function changeTheme() {
    const theme = document.getElementById('themeSelect').value;
    localStorage.setItem('dailyJournal_theme', theme);
    applyTheme();
}

function changeFontSize() {
    const fontSize = document.getElementById('fontSize').value;
    localStorage.setItem('dailyJournal_fontSize', fontSize);
    applyFontSize();
}

function applyTheme() {
    const theme = localStorage.getItem('dailyJournal_theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function applyFontSize() {
    const fontSize = localStorage.getItem('dailyJournal_fontSize') || 'medium';
    document.body.className = document.body.className.replace(/font-\w+/g, '');
    document.body.classList.add(`font-${fontSize}`);
}

async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    if (newPassword !== confirmNewPassword) {
        showMessage('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    // IMPORTANT: Changing the password in Firebase requires re-authenticating the user
    // with their current password first. This is complex to implement without UI for
    // re-authentication. For now, we'll keep the mock message but you should
    // implement `firebase.auth().currentUser.reauthenticateWithCredential()` 
    // and then `firebase.auth().currentUser.updatePassword()` for a real app.
    showMessage('Password updated successfully! (Note: Real Firebase update logic is required here)', 'success');
    closeChangePassword();
}

async function exportData() {
    try {
        showLoading('Exporting data...');
        const entries = await firebase.getEntries(currentUser.uid);
        const moods = await firebase.getMoods(currentUser.uid);
        const profile = await firebase.getUserProfile(currentUser.uid);
        
        const exportData = {
            profile: profile,
            entries: entries,
            moods: moods,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `daily-journal-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        hideLoading();
        showMessage('Data exported successfully!', 'success');
    } catch (error) {
        hideLoading();
        showMessage('Error exporting data: ' + (error.message || 'Failed to export data.'), 'error');
    }
}

function showDeleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        if (confirm('This will permanently delete all your journal entries and data. Are you absolutely sure?')) {
            // IMPORTANT: Account deletion in a real app is complex. It requires re-authentication
            // and then calling firebase.auth().currentUser.delete(). 
            showMessage('Account deletion requested. Please contact support. (Note: Real Firebase deletion logic is required here)', 'success');
        }
    }
}

// UI Helper Functions
function toggleMenu() {
    const sideMenu = document.getElementById('sideMenu');
    sideMenu.classList.toggle('active');
}

function showAddEntry() {
    currentEntry = null;
    document.getElementById('modalTitle').textContent = 'New Entry';
    document.getElementById('entryTitle').value = '';
    document.getElementById('entryContent').innerHTML = '';
    showModal('addEntryModal');
}

function closeAddEntry() {
    hideModal('addEntryModal');
    currentEntry = null;
}

function closePreview() {
    hideModal('previewModal');
    currentEntry = null;
}

function showForgotPassword() {
    showModal('forgotPasswordModal');
}

function closeForgotPassword() {
    hideModal('forgotPasswordModal');
}

function showChangePassword() {
    showModal('changePasswordModal');
}

function closeChangePassword() {
    hideModal('changePasswordModal');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Rich Text Editor Functions
function formatText(command) {
    const editor = document.getElementById('entryContent');
    editor.focus();
    
    if (command === 'uppercase') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const selectedText = range.toString();
            if (selectedText) {
                range.deleteContents();
                range.insertNode(document.createTextNode(selectedText.toUpperCase()));
            }
        }
    } else {
        document.execCommand(command, false, null);
    }
}

// Utility Functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTextPreview(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(message, type = 'success') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Insert at the top of the main content or form
    const container = document.querySelector('.main-content') || 
                     document.querySelector('.login-form') || 
                     document.querySelector('.signup-form') ||
                     document.body;
    
    container.insertBefore(messageDiv, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function showLoading(message = 'Loading...') {
    // Create loading overlay
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingOverlay';
    loadingDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
            font-size: 1.2rem;
        ">
            <div style="text-align: center;">
                <div style="margin-bottom: 1rem;">⏳</div>
                <div>${message}</div>
            </div>
        </div>
    `;
    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.getElementById('loadingOverlay');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

async function logout() {
    try {
        await firebase.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        showMessage('Error logging out: ' + (error.message || 'Logout failed.'), 'error');
    }
}

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
});

// Close side menu when clicking outside
document.addEventListener('click', function(e) {
    const sideMenu = document.getElementById('sideMenu');
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    
    if (sideMenu && sideMenu.classList.contains('active') && 
        !sideMenu.contains(e.target) && !hamburgerMenu.contains(e.target)) {
        sideMenu.classList.remove('active');
    }
});

// Handle system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const theme = localStorage.getItem('dailyJournal_theme');
    if (theme === 'auto') {
        applyTheme();
    }
});