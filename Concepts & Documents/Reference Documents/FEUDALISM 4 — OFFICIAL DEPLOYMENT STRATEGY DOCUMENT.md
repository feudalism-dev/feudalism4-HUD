FEUDALISM 4 — OFFICIAL DEPLOYMENT STRATEGY DOCUMENT
Authoritative Reference for Cursor
Do NOT deviate from this document under any circumstances

🟦 1. Deployment Targets (MANDATORY)
Feudalism 4 uses two deployment targets:
✔ 1. GitHub Pages
Used ONLY for hosting HUD MOAP files.
- All HUD HTML, JS, CSS, and assets must be deployed to GitHub Pages.
- GitHub Pages is the ONLY hosting location for HUD UI.
- The MOAP prim in Second Life loads HUD UI from GitHub Pages.
✔ 2. Firebase (Firestore)
Used ONLY for:
- Firestore database
- Firestore rules
- Firestore indexes
- Cloud Functions (if any)
Firebase Hosting is NOT used for HUD code.
Cursor must NEVER deploy HUD files to Firebase Hosting.

🟪 1.1 Repository Management Strategy (CRITICAL)
Feudalism 4 uses TWO GitHub repositories with different purposes:
✔ PRIVATE Repository (`origin` - `feudalism4.git`)
- Purpose: Version control and code management
- Contains: ALL project files including:
  - `LSL Scripts/Feudalism 4/` folder and ALL subfolders (Players HUD, In world scripts - Feud 4, Utilities)
  - `MOAP Interface/` folder (HTML, CSS, JS, images, etc.)
  - All documentation, configuration files, and other project assets
- LSL Scripts Management:
  - `LSL Scripts/Feudalism 4/` folder and all its contents are ONLY committed to the PRIVATE repository
  - LSL scripts are NEVER to be committed to the PUBLIC repository
  - This is the source of truth for all LSL code
✔ PUBLIC Repository (`pages` - `feudalism4-HUD.git`)
- Purpose: GitHub Pages hosting for MOAP interface
- Contains: ONLY the `MOAP Interface/` folder contents
- Deployed to: GitHub Pages for HUD UI hosting
- LSL Scripts: NEVER commit LSL scripts to this repository
- Deployment: `MOAP Interface/` files must be deployed to BOTH repositories
  - PRIVATE repo: For version control and code management
  - PUBLIC repo: For GitHub Pages hosting (required for MOAP to work)

🟥 2. Forbidden Actions (NEVER DO THESE)
Cursor must NEVER:
- deploy HUD code to Firebase Hosting
- rewrite the deployment pipeline
- introduce new hosting targets
- use Firebase Hosting for MOAP files
- use Firebase Emulators unless explicitly instructed
- modify firebase.json unless explicitly instructed
- deploy without specifying a target
- invent new deployment commands
- assume local files are authoritative
- assume Firestore Hosting is the correct target
If Cursor attempts any of these, STOP and correct it using this document.

🟩 3. Correct Deployment Commands (ALLOWED)
Cursor may ONLY use the following commands:
✔ Deploy HUD (GitHub Pages - PUBLIC Repository)
For deploying MOAP Interface files to PUBLIC repository (GitHub Pages):
cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"
git remote set-url origin <PRIVATE_REPO_URL>  # Ensure PRIVATE repo is origin
git remote set-url pages <PUBLIC_REPO_URL>    # Ensure PUBLIC repo is pages
git add MOAP Interface/
git commit -m "MOAP Interface update: [description]"
git push pages main  # Push to PUBLIC repo for GitHub Pages
Note: MOAP Interface files must be in both repos, but pushed separately.

✔ Deploy LSL Scripts (PRIVATE Repository ONLY)
For committing LSL scripts to PRIVATE repository:
cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"
git add "LSL Scripts/Feudalism 4/"
git commit -m "LSL scripts update: [description]"
git push origin main  # Push to PRIVATE repo ONLY
CRITICAL: LSL scripts must NEVER be pushed to PUBLIC repository (pages remote).


GitHub Pages auto‑deploys.
✔ Deploy Firestore Rules
firebase deploy --only firestore:rules


✔ Deploy Firestore Indexes
firebase deploy --only firestore:indexes


✔ Deploy Cloud Functions
firebase deploy --only functions


✔ Deploy Multiple Firebase Targets Explicitly
firebase deploy --only firestore:rules,firestore:indexes,functions


❌ NEVER USE:
firebase deploy
firebase deploy --only hosting
firebase deploy --only hosting:default
firebase deploy --only hosting:<anything>


These commands are forbidden because they overwrite HUD hosting.

🟧 4. HUD Deployment Rules
Cursor must follow these rules:
- HUD UI lives in the `MOAP Interface/` folder.
- HUD UI is served by GitHub Pages from the PUBLIC repository ONLY.
- The MOAP prim loads the HUD from GitHub Pages ONLY.
- `MOAP Interface/` folder must be committed to BOTH repositories:
  - PRIVATE repo: For version control
  - PUBLIC repo: For GitHub Pages hosting
- No HUD files may be placed in Firebase Hosting.
- No HUD files may be deployed via Firebase CLI.
- No HUD files may be copied into the Firebase project.
- LSL scripts in `LSL Scripts/Feudalism 4/` are ONLY committed to PRIVATE repository.
- LSL scripts are NEVER committed to PUBLIC repository.
If Cursor attempts to "optimize" or "simplify" this, STOP and revert.

🟦 5. Firestore Deployment Rules
Cursor must:
- deploy Firestore rules ONLY using --only firestore:rules
- deploy indexes ONLY using --only firestore:indexes
- deploy functions ONLY using --only functions
- NEVER deploy hosting
- NEVER modify Firestore structure unless explicitly instructed
Firestore is the backend.
GitHub Pages is the frontend.
They must remain separate.

🟫 6. The Mirage Pattern (CRITICAL)
Before debugging ANY HUD issue, Cursor must follow this checklist:
✔ Step 1 — Verify GitHub Pages deployed correctly
Check the HUD version banner in the MOAP.
✔ Step 2 — Verify the MOAP URL is correct
Ensure the prim is loading the correct GitHub Pages URL.
✔ Step 3 — Verify the browser cache is not stale
Force refresh or append a cache‑buster.
✔ Step 4 — Verify Firestore rules and indexes are deployed
Check Firebase console.
✔ Step 5 — Verify the correct Firebase project is selected
Cursor must NEVER assume the project.
If any of these fail, the HUD may appear “broken” even though the code is correct.
Cursor must NOT debug logic until deployment is verified.

🟩 7. Required Behavior for Cursor
Cursor must:
- treat this document as the authoritative deployment reference
- follow it exactly
- refuse to invent new workflows
- refuse to deploy HUD code to Firebase
- refuse to modify hosting configuration
- refuse to rewrite the pipeline
- refuse to use Firebase Hosting for MOAP files
- refuse to “optimize” or “simplify” deployment
If Cursor is unsure, it must ask for clarification instead of guessing.

🟨 8. Deployment Configuration & Credentials (REFERENCE)

This section documents all deployment details, credentials locations, and step-by-step procedures. Use this when you need to perform deployments or verify configuration.

### 8.1 GitHub Pages Configuration

**Repository Information:**
- GitHub Organization/User: `feudalism-dev`
- Repository Name: `feudalism4-HUD`
- GitHub Pages URL: `https://feudalism-dev.github.io/feudalism4-HUD/hud.html`
- Base URL: `https://feudalism-dev.github.io/feudalism4-HUD`

**HUD Files Location:**
- Local directory: `MOAP Interface/`
- Files to deploy: All files in `MOAP Interface/` directory including:
  - HTML files (hud.html, gameplay-hud.html, index.html, etc.)
  - JavaScript files in `js/` subdirectory
  - CSS files in `css/` subdirectory
  - Image assets in `images/` subdirectory
  - All other assets in `MOAP Interface/` subdirectory
- Repository Strategy:
  - `MOAP Interface/` must be committed to BOTH repositories
  - PRIVATE repo (`feudalism4.git`): For version control
  - PUBLIC repo (`feudalism4-HUD.git`): For GitHub Pages hosting

**LSL Scripts Location:**
- Local directory: `LSL Scripts/Feudalism 4/`
- Subdirectories:
  - `LSL Scripts/Feudalism 4/Players HUD/` - HUD-related LSL scripts
  - `LSL Scripts/Feudalism 4/In world scripts - Feud 4/` - In-world object scripts
  - `LSL Scripts/Feudalism 4/Utilities/` - Utility scripts
- Repository Strategy:
  - LSL scripts are ONLY committed to PRIVATE repository (`feudalism4.git`)
  - LSL scripts are NEVER committed to PUBLIC repository (`feudalism4-HUD.git`)
  - This folder structure is the source of truth for all Feudalism 4 LSL code

**GitHub Authentication:**
- Credentials are stored in Git credential manager (Windows Credential Manager)
- To check authentication: `git config --get credential.helper`
- To authenticate: `git push` (will prompt for credentials if not stored)
- If authentication fails, use GitHub Personal Access Token:
  1. Go to GitHub → Settings → Developer settings → Personal access tokens
  2. Generate token with `repo` scope
  3. Use token as password when prompted

**GitHub Pages Deployment Steps (PUBLIC Repository):**
1. Navigate to project root: `cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"`
2. Check git status: `git status`
3. Stage MOAP Interface changes: `git add MOAP Interface/`
4. Commit: `git commit -m "MOAP Interface update: [description of changes]"`
5. Push to PUBLIC repo: `git push pages main` (push to `pages` remote for GitHub Pages)
6. GitHub Pages auto-deploys from the PUBLIC repository default branch
7. Verify deployment: Visit `https://feudalism-dev.github.io/feudalism4-HUD/hud.html`
Note: MOAP Interface files must also be committed to PRIVATE repo separately (see below).

**LSL Scripts Deployment Steps (PRIVATE Repository ONLY):**
1. Navigate to project root: `cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"`
2. Check git status: `git status`
3. Stage LSL script changes: `git add "LSL Scripts/Feudalism 4/"`
4. Commit: `git commit -m "LSL scripts update: [description of changes]"`
5. Push to PRIVATE repo: `git push origin main` (push to `origin` remote)
6. CRITICAL: Do NOT push LSL scripts to PUBLIC repository (`pages` remote)

**GitHub Repository Setup (if not configured):**
- Check if remotes exist: `git remote -v`
- PRIVATE repository (origin): `git remote add origin https://github.com/feudalism-dev/feudalism4.git`
- PUBLIC repository (pages): `git remote add pages https://github.com/feudalism-dev/feudalism4-HUD.git`
- Verify remotes: `git remote -v`
- Expected output should show:
  - `origin` → `feudalism4.git` (PRIVATE repo)
  - `pages` → `feudalism4-HUD.git` (PUBLIC repo for GitHub Pages)

### 8.2 Firebase Configuration

**Firebase Project Information:**
- Project ID: `feudalism4-rpg`
- Project Display Name: `Feudalism 4`
- Project Number: `417226860670`
- Configuration file: `.firebaserc` (contains project ID)

**Firebase Authentication:**
- Credentials: Stored via `firebase login` command
- To check authentication: `firebase projects:list`
- To authenticate: `firebase login` (opens browser for Google account authentication)
- To verify current project: Check `.firebaserc` file or run `firebase use`

**Firebase Configuration Files:**
- `.firebaserc`: Contains project ID mapping
  ```json
  {
    "projects": {
      "default": "feudalism4-rpg"
    }
  }
  ```
- `firebase.json`: Contains deployment configuration
  - Firestore rules: `firestore.rules` (root directory)
  - Firestore indexes: `Firebase/firestore.indexes.json`
  - Functions source: `functions/` directory
  - ⚠️ Hosting section exists but MUST NOT be used

**Firestore Rules Location:**
- Primary file: `firestore.rules` (root directory) - THIS IS THE ACTIVE FILE
- Backup/alternate: `Firebase/firestore.rules` (exists but not used by firebase.json)
- Deploy from: `firestore.rules` (as specified in firebase.json)

**Firestore Indexes Location:**
- File: `Firebase/firestore.indexes.json`
- Deploy from: `Firebase/firestore.indexes.json` (as specified in firebase.json)

**Firebase Deployment Steps:**

**Deploy Firestore Rules:**
1. Navigate to project root: `cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"`
2. Verify project: `firebase use` (should show `feudalism4-rpg`)
3. Check rules file exists: Verify `firestore.rules` exists in root
4. Deploy: `firebase deploy --only firestore:rules`
5. Verify: Check Firebase Console → Firestore Database → Rules tab

**Deploy Firestore Indexes:**
1. Navigate to project root: `cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"`
2. Verify project: `firebase use` (should show `feudalism4-rpg`)
3. Check indexes file exists: Verify `Firebase/firestore.indexes.json` exists
4. Deploy: `firebase deploy --only firestore:indexes`
5. Verify: Check Firebase Console → Firestore Database → Indexes tab

**Deploy Cloud Functions:**
1. Navigate to project root: `cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"`
2. Navigate to functions: `cd functions`
3. Install dependencies (if needed): `npm install`
4. Return to root: `cd ..`
5. Verify project: `firebase use` (should show `feudalism4-rpg`)
6. Deploy: `firebase deploy --only functions`
7. Verify: Check Firebase Console → Functions tab

**Deploy Multiple Firebase Targets:**
- Deploy rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes`
- Deploy rules, indexes, and functions: `firebase deploy --only firestore:rules,firestore:indexes,functions`

### 8.3 MOAP Configuration in LSL

**LSL Script Location:**
- File: `LSL Scripts/Feudalism 4/Players HUD/[script name].lsl` (check actual structure)
- Or may be: `LSL Scripts/Feudalism 4 - Combined HUD Controller.lsl` (if still in root)
- GitHub Pages URL configuration location varies by script
- Look for `MOAP_BASE_URL` variable declaration
- URL assignment (production and dev mode)

**Current MOAP URL Configuration:**
- Production URL: `https://feudalism-dev.github.io/feudalism4-HUD`
- Full HUD URL: `https://feudalism-dev.github.io/feudalism4-HUD/hud.html`
- The LSL script loads this URL into the MOAP prim

**To Update MOAP URL in LSL:**
1. Locate the appropriate LSL script in `LSL Scripts/Feudalism 4/Players HUD/` folder
2. Find: `MOAP_BASE_URL` variable in the script
3. Update: Change the URL string to match GitHub Pages URL
4. Save and commit to PRIVATE repository: `git add "LSL Scripts/Feudalism 4/" && git commit -m "Update MOAP URL" && git push origin main`
5. Recompile script in Second Life HUD

### 8.4 Firebase Project Console Access

**Firebase Console URL:**
- Direct link: `https://console.firebase.google.com/project/feudalism4-rpg`
- General console: `https://console.firebase.google.com/`

**Key Console Sections:**
- Firestore Database: `https://console.firebase.google.com/project/feudalism4-rpg/firestore`
- Firestore Rules: `https://console.firebase.google.com/project/feudalism4-rpg/firestore/rules`
- Firestore Indexes: `https://console.firebase.google.com/project/feudalism4-rpg/firestore/indexes`
- Functions: `https://console.firebase.google.com/project/feudalism4-rpg/functions`
- Authentication: `https://console.firebase.google.com/project/feudalism4-rpg/authentication`

**Firebase Config in HUD Code:**
- File: `MOAP Interface/js/firebase-config.js`
- Contains Firebase project configuration (API keys, project ID, etc.)
- Project ID: `feudalism4-rpg`
- This config is used by the HUD JavaScript to connect to Firestore

### 8.5 Verification Checklist

**Before Deploying HUD Changes (MOAP Interface):**
- [ ] Verify changes are in `MOAP Interface/` directory
- [ ] Test locally if possible (open HTML files in browser)
- [ ] Check git status to see what will be committed
- [ ] Ensure both GitHub remotes are configured correctly (`origin` and `pages`)
- [ ] Deploy to PRIVATE repo first: `git add MOAP Interface/ && git commit -m "..." && git push origin main`
- [ ] Then deploy to PUBLIC repo: `git push pages main`

**After Deploying HUD Changes:**
- [ ] Wait 1-2 minutes for GitHub Pages to build
- [ ] Visit `https://feudalism-dev.github.io/feudalism4-HUD/hud.html` in browser
- [ ] Check browser console for errors
- [ ] Verify HUD version banner shows in MOAP (if implemented)
- [ ] Test in Second Life MOAP prim

**Before Deploying Firestore Changes:**
- [ ] Verify correct project: `firebase use` shows `feudalism4-rpg`
- [ ] Check rules file: `firestore.rules` exists and is correct
- [ ] Check indexes file: `Firebase/firestore.indexes.json` exists and is correct
- [ ] Review changes carefully (rules affect security)

**After Deploying Firestore Changes:**
- [ ] Check Firebase Console → Firestore → Rules (verify rules deployed)
- [ ] Check Firebase Console → Firestore → Indexes (verify indexes building)
- [ ] Test HUD functionality that uses Firestore
- [ ] Check for any Firestore errors in browser console

### 8.6 Troubleshooting Deployment Issues

**GitHub Pages Not Updating:**
- Check if branch is correct (usually `main` or `master`)
- Verify GitHub Pages is enabled in repository settings
- Check GitHub Actions/Pages build logs
- Try adding cache-buster to URL: `?v=timestamp`

**Firebase Authentication Issues:**
- Run: `firebase logout` then `firebase login`
- Verify Google account has access to `feudalism4-rpg` project
- Check: `firebase projects:list` shows the project

**Firebase Project Wrong:**
- Check: `.firebaserc` file contains correct project ID
- Switch project: `firebase use feudalism4-rpg`
- Verify: `firebase use` shows correct project

**Firestore Rules Not Deploying:**
- Verify: `firebase.json` points to correct rules file (`firestore.rules`)
- Check: Rules file syntax is valid (no syntax errors)
- Verify: Project has Firestore enabled in Firebase Console

**MOAP Not Loading:**
- Verify GitHub Pages URL is accessible in browser
- Check LSL script has correct URL
- Verify MOAP prim face is set to Media texture
- Check Second Life allows external media (region settings)

🟦 9. Summary (for Cursor)
HUD UI (`MOAP Interface/`) → Deploy to BOTH repositories:
  - PRIVATE repo (`origin`): For version control
  - PUBLIC repo (`pages`): For GitHub Pages hosting
LSL Scripts (`LSL Scripts/Feudalism 4/`) → PRIVATE repository ONLY
  - NEVER commit LSL scripts to PUBLIC repository
Backend → Firestore
NEVER deploy HUD to Firebase Hosting
NEVER modify deployment pipeline
ALWAYS follow this document
