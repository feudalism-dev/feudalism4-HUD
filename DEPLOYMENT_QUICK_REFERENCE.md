# Deployment Quick Reference for Cursor

## ⚡ Quick Deploy (Default - Use This Most of the Time)

```powershell
cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"
git add "MOAP Interface/"
git commit -m "Update: [description]"
git push origin UX-2
.\deploy-moap-to-public-quick.ps1
```

**When to use:** HTML, CSS, or JS changes (90% of deployments)
**What it does:** Deploys all MOAP files EXCEPT images folder
**Speed:** ~10 seconds

---

## 🐢 Full Deploy (Only When Images Changed)

```powershell
cd "D:\Documents\My LSL Scripts\Feudalism RPG 4"
git add "MOAP Interface/"
git commit -m "Update: [description]"
git push origin UX-2
.\deploy-moap-to-public.ps1
```

**When to use:** 
- Images in `MOAP Interface/images/` added or changed
- User explicitly requests full deploy
- First-time deployment

**What it does:** Deploys ALL MOAP files including images
**Speed:** ~60 seconds (due to 150+ image files)

---

## 📋 Deployment Checklist

1. ✅ Make changes to files in `MOAP Interface/` folder
2. ✅ Test locally if possible
3. ✅ Commit to PRIVATE repo first: `git add "MOAP Interface/" && git commit -m "..." && git push origin UX-2`
4. ✅ **Run quick deploy:** `.\deploy-moap-to-public-quick.ps1`
5. ✅ Wait 1-2 minutes for GitHub Pages to update
6. ✅ Test at https://feudalism-dev.github.io/feudalism4-HUD/hud.html

---

## 🚫 Never Do This

- ❌ Don't use `firebase deploy` or `firebase deploy --only hosting`
- ❌ Don't manually push to pages remote
- ❌ Don't deploy LSL scripts to PUBLIC repo
- ❌ Don't forget to commit to PRIVATE repo first

---

## 📁 Repository Structure

- **PRIVATE repo** (`origin` - feudalism4.git)
  - Contains: LSL Scripts + MOAP Interface + docs
  - Push LSL to: PRIVATE repo only
  - Push MOAP to: PRIVATE repo first, then use script for PUBLIC

- **PUBLIC repo** (`pages` - feudalism4-HUD.git)
  - Contains: ONLY MOAP Interface files (deployed via script)
  - Used for: GitHub Pages hosting
  - URL: https://feudalism-dev.github.io/feudalism4-HUD/

---

## 🔧 If Script Fails

Check remotes are configured:
```bash
git remote -v
```

Should show:
- `origin` → https://github.com/feudalism-dev/feudalism4.git (PRIVATE)
- `pages` → https://github.com/feudalism-dev/feudalism4-HUD.git (PUBLIC)

If missing, add them:
```bash
git remote add origin https://github.com/feudalism-dev/feudalism4.git
git remote add pages https://github.com/feudalism-dev/feudalism4-HUD.git
```

---

## 📖 Full Documentation

See: `Concepts & Documents/Reference Documents/FEUDALISM 4 — OFFICIAL DEPLOYMENT STRATEGY DOCUMENT.md`
