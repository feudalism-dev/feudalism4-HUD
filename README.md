# Feudalism 4 - RPG System for Second Life

The code repository for Feudalism 4 - A grid-portable RPG system using Firebase, Google Apps Script, and Media on a Prim (MOAP).

## 🎯 Key Features

- **Experience-Free**: Works anywhere on the grid without requiring SL Experience permissions
- **Single HUD**: Eliminates the need for multiple sub-HUDs
- **Server-Side Logic**: All game rules and data stored in Firebase/GAS
- **Modern UI**: Rich web-based interface via MOAP
- **Dynamic Content**: Admins can update species, classes, and vocations without script updates

## 📁 Project Structure

```
Feudalism RPG 4/
├── README.md                           # This file
├── Concepts & Documents/
│   ├── Feudalism 4 Concepts.md         # Original design notes
│   └── Feudalism 4 Technical Design.md # Technical specifications
├── LSL Scripts/
│   └── Feudalism 4 - Setup HUD.lsl     # Main HUD script
├── GAS Backend/
│   ├── Code.gs                         # Main API entry point
│   ├── Auth.gs                         # Authentication & sessions
│   ├── Characters.gs                   # Character CRUD
│   ├── Templates.gs                    # Species/Classes/Vocations
│   └── Dice.gs                         # Dice rolling mechanics
└── MOAP Interface/
    ├── index.html                      # Main interface
    ├── hud.html                        # HUD interface (same as index)
    ├── loading.html                    # Loading screen
    ├── error.html                      # Error screen
    ├── css/
    │   └── styles.css                  # UI styles
    └── js/
        ├── api.js                      # Server communication
        ├── ui.js                       # UI components
        └── app.js                      # Main application
```

## 🚀 Setup Instructions

### Step 1: Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (e.g., "feudalism-4")
3. Enable Firestore Database
4. Set up Firebase Hosting (for MOAP interface)

### Step 2: Deploy Google Apps Script

1. Go to [Google Apps Script](https://script.google.com/)
2. Create a new project
3. Copy all `.gs` files from the `GAS Backend/` folder into the project
4. Deploy as Web App:
   - Click **Deploy** → **New deployment**
   - Select type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL

### Step 3: Deploy MOAP Interface

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting` (select your project)
4. Copy `MOAP Interface/` contents to the `public/` folder
5. Deploy: `firebase deploy --only hosting`
6. Note your hosting URL (e.g., `https://feudalism-4.web.app`)

### Step 4: Configure the LSL Script

1. Open `LSL Scripts/Feudalism 4 - Setup HUD.lsl`
2. Update the configuration at the top:

```lsl
string GAS_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
string MOAP_BASE_URL = "https://your-project.web.app";
```

### Step 5: Configure the MOAP Interface

1. Open `MOAP Interface/js/api.js`
2. Update the GAS URL:

```javascript
GAS_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
```

### Step 6: Create the HUD in Second Life

1. Create a new prim (box or flat panel)
2. Size it appropriately for a HUD (e.g., 0.5 x 0.4 x 0.01)
3. Add the LSL script to the prim
4. Attach as HUD (e.g., Center 2)
5. The MOAP face should display the interface automatically

## 🎮 Game Mechanics

### Exploding d20 Pool System

- Roll d20s equal to your stat value (1-9)
- Any natural 20 "explodes" - roll again and add
- Add your Vocation Bonus if applicable
- Compare to Difficulty Class (DC)

### Vocation System

Each career class grants a unique Vocation bonus:
- Calculated as: Primary Stat + Secondary Stat
- Applies only to specific skill checks
- Non-stacking (old vocation replaced when changing careers)

### Career Progression

- Players occupy **Career Templates** (not levels)
- Spend XP to increase stats within class caps
- Meet prerequisites to unlock advanced careers
- Career shifts require XP and stat minimums

## 👑 Admin Roles

| Role | Capabilities |
|------|-------------|
| **System Admin** | Create/edit templates, promote admins, full access |
| **Sim Admin** | Award XP, manage currency, moderate region |
| **Player** | Manage own character within class limits |

## 🔧 Development Notes

### Adding New Species

1. Open Admin tab in HUD (requires sys_admin role)
2. Navigate to Species section
3. Create new species with base stats and caps

Or manually add to the `species` sheet in Google Sheets created by GAS.

### Modifying Classes

Classes define:
- `stat_minimums`: Required stats to enter
- `stat_maximums`: Caps while in this class
- `prerequisites`: Required classes/species/gender
- `exit_careers`: Classes unlocked after this one
- `vocation_id`: Which vocation bonus applies

### Security Considerations

- Session tokens expire after 24 hours
- All validation happens server-side
- Admin actions are role-checked
- No sensitive data stored in LSL

## 📝 License

This project is designed for use in Second Life Feudalism RPG communities.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📞 Support

For issues or questions, contact the Feudalism RPG development team.
