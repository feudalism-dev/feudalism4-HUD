# Feudalism 4 - Complete Setup Guide

This guide walks you through deploying Feudalism 4 to your own Firebase and Google Apps Script accounts.

---

## Part 1: Google Apps Script (Backend API)

### Step 1: Create a Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com/)
2. Click **"New Project"**
3. Name it **"Feudalism 4 Backend"**

### Step 2: Add the Script Files

You need to add 5 files. For each:
1. Click **File** → **New** → **Script**
2. Name it (without .gs extension)
3. Copy the contents from the corresponding file in `GAS Backend/`

| File to Create | Copy From |
|----------------|-----------|
| `Code` | `GAS Backend/Code.gs` |
| `Auth` | `GAS Backend/Auth.gs` |
| `Characters` | `GAS Backend/Characters.gs` |
| `Templates` | `GAS Backend/Templates.gs` |
| `Dice` | `GAS Backend/Dice.gs` |

**Tip:** Delete the default `Code.gs` content first, then paste.

### Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure:
   - **Description:** "Feudalism 4 API v1.0"
   - **Execute as:** "Me"
   - **Who has access:** "Anyone"
5. Click **Deploy**
6. **IMPORTANT:** Copy the Web App URL - you'll need this!

The URL looks like:
```
https://script.google.com/macros/s/AKfycbx.../exec
```

### Step 4: Test Your API

Open the URL in your browser. You should see:
```json
{
  "success": true,
  "message": "Feudalism 4 API is running",
  "version": "4.0.0",
  ...
}
```

---

## Part 2: Firebase (MOAP Interface Hosting)

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** (or "Add project")
3. Name it **"feudalism4"** (or similar)
4. Disable Google Analytics (optional, not needed)
5. Click **Create project**

### Step 2: Install Firebase CLI

Open PowerShell/Terminal and run:

```powershell
npm install -g firebase-tools
```

If you don't have Node.js, download it from [nodejs.org](https://nodejs.org/)

### Step 3: Login to Firebase

```powershell
firebase login
```

This opens a browser window to authenticate with your Google account.

### Step 4: Initialize Firebase in Project

Navigate to the project folder and initialize:

```powershell
cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"
firebase init hosting
```

When prompted:
- **Use an existing project?** → Yes, select your project
- **Public directory?** → Type: `MOAP Interface`
- **Single-page app?** → Yes
- **GitHub deploys?** → No
- **Overwrite index.html?** → No (keep existing)

### Step 5: Update Configuration

Edit `.firebaserc` and replace `YOUR-FIREBASE-PROJECT-ID` with your actual project ID:

```json
{
  "projects": {
    "default": "feudalism4-12345"
  }
}
```

### Step 6: Update the API URL in MOAP Interface

Before deploying, update the GAS URL in `MOAP Interface/js/api.js`:

```javascript
const API = {
    GAS_URL: 'https://script.google.com/macros/s/YOUR_ACTUAL_DEPLOYMENT_ID/exec',
    // ...
}
```

### Step 7: Deploy to Firebase

```powershell
firebase deploy --only hosting
```

You'll get a URL like:
```
https://feudalism4-12345.web.app
```

---

## Part 3: Update LSL Script

Open `LSL Scripts/Feudalism 4 - Setup HUD.lsl` and update the configuration:

```lsl
// Replace with your actual URLs:
string GAS_URL = "https://script.google.com/macros/s/YOUR_GAS_DEPLOYMENT_ID/exec";
string MOAP_BASE_URL = "https://your-project.web.app";
```

---

## Part 4: Create the HUD in Second Life

1. Create a new prim (flat box works best)
2. Size: `<0.5, 0.4, 0.01>` (or similar)
3. Add the script from `LSL Scripts/Feudalism 4 - Setup HUD.lsl`
4. Set the media texture on face 0 (front)
5. Attach as HUD (Center 2 recommended)

---

## Quick Reference: Your URLs

After setup, you'll have:

| Component | URL |
|-----------|-----|
| **GAS API** | `https://script.google.com/macros/s/.../exec` |
| **Firebase Hosting** | `https://your-project.web.app` |

---

## Troubleshooting

### "Access denied" from GAS
- Make sure you deployed with "Anyone" access
- Check the deployment is active (Deploy → Manage deployments)

### MOAP shows blank
- Verify the Firebase URL is correct in LSL script
- Check browser console for errors at your Firebase URL

### "Failed to connect" in HUD
- Verify GAS URL is correct
- Test GAS URL directly in browser
- Check SL allows HTTP requests from the region

### Changes not appearing
- GAS: Create a new deployment version
- Firebase: Run `firebase deploy` again
- LSL: Reset the script after changing URLs

---

## Making the First Admin

After deployment, the first user to login becomes a regular "player". To make yourself a System Admin:

1. Open Google Sheets (GAS creates one called "Feudalism 4 Database")
2. Go to the `users` sheet
3. Find your row (by UUID)
4. Change `role` column from `player` to `sys_admin`
5. Detach and re-attach HUD to see admin features

---

## Optional: Firestore Database

For production, you may want to use Firestore instead of Sheets:

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Update GAS code to use Firestore REST API

The current implementation uses Google Sheets for simplicity - it works great for small-to-medium player bases and is easier to manually inspect/edit data.

