Absolutely — here is a **single, unified, authoritative, Cursor‑ready specification** that merges:

- The **original Banner Ad System document**  
- The **updated rules about global management**  
- The **per‑universe ad limit**  
- The **role permissions**  
- The **HUD placement rules**  
- The **future kiosk integration placeholder**  

This is the **canonical Banner Ad System Specification** for Feudalism 4.  
You can paste this directly into Cursor as‑is.

---

# **FEUDALISM 4 — BANNER AD SYSTEM SPECIFICATION (FOR CURSOR)**  
### *Authoritative, Non‑Negotiable Rules & Requirements*  
### *Banner ads appear ONLY on the MOAP Setup HUD pages.*

---

# **1. Overview**

The Banner Ad System provides a **single rotating banner** at the top of every MOAP Setup HUD page.  
This system is used to promote:

- Universe announcements  
- Sim promotions  
- Events  
- Creator products  
- Feudalism 4 updates  
- Paid advertisements (future kiosk integration)  

Ads **never** appear on the Player HUD or during gameplay.

---

# **2. Placement (HUD Requirements)**

### **2.1 Single Banner Slot**
- Exactly **one** banner ad slot exists on all MOAP Setup HUD pages.
- The banner appears at the top of the page layout:

```
<BannerAd />
<PageTitle />
<PageContent />
```

### **2.2 Dimensions**
- Full width of the MOAP panel.
- Height: ~80–120px (fixed).

### **2.3 Behavior**
- Rotates every 15–30 seconds.
- Smooth fade transition.
- Clickable:
  - Teleport to SLURL  
  - Open external URL  
  - Open universe info  
  - Open sim info  
  - Open event info  

### **2.4 Restrictions**
- No sound.
- No pop‑ups.
- No animations beyond fade transitions.
- No ads on Player HUD or gameplay screens.

---

# **3. Banner Ads Are a Global System Feature**

Banner ads are managed in a **global Ads Management panel**, not inside the Universe Manager.

### **Where the Ads panel lives**
```
MOAP Setup HUD → Admin → Ads
```

### **Who can access the Ads panel**
- **Super User** → full access  
- **System Admin** → full access  
- **Universe Admin** → limited access (only ads for their universe)  
- **Admin / Player** → no access  

---

# **4. Per‑Universe Banner Ad Limit**

Each universe has a field:

```
bannerAdLimit: number
```

### **Default**
```
bannerAdLimit = 1
```

### **Meaning**
This number defines **how many active ads** a universe is allowed to have at the same time.

### **Who can change it**
- **Super User** → can change  
- **System Admin** → can change  
- **Universe Admin** → ❌ cannot change  
- **Admin / Player** → ❌ cannot change  

### **UA must operate within the limit**
If a UA tries to create or activate an ad beyond the limit, the HUD must block the action and show:

> “This universe has reached its banner ad limit. Contact a System Admin to increase the limit.”

---

# **5. Ad Ownership and Permissions**

### **Universe Admin**
Can:
- Create ads for their universe  
- Edit ads for their universe  
- Delete ads for their universe  
- Activate/deactivate ads for their universe  

Cannot:
- Change `bannerAdLimit`  
- Create global ads  
- Edit ads belonging to other universes  

### **System Admin**
Can:
- Create/edit/delete ads for any universe  
- Create global ads  
- Change `bannerAdLimit`  
- Feature ads (priority)  

### **Super User**
- Full access to all ads and limits.

### **Admin / Player**
- No ad permissions.

---

# **6. Firestore Schema**

### **universes/{id}**
Add:

```
bannerAdLimit: number   // default = 1
freeAdId: string | null // optional convenience field
```

### **ads/{adId}**
```
imageUrl: string
title: string
description: string
targetSlurl: string
targetUrl: string

universeId: string | null   // null = global ad
isFree: boolean             // true = universe’s free ad
priority: number            // higher = shown more often

startDate: timestamp
endDate: timestamp | null   // null for free ads

active: boolean

createdBy: string
createdAt: timestamp

purchasedAt: timestamp | null
expiresAt: timestamp | null
```

---

# **7. Ad Rotation Logic (HUD)**

When the MOAP Setup HUD loads:

1. Fetch all active ads.
2. Filter by:
   - `universeId == currentUniverseId`  
   - OR `universeId == null` (global ads)
3. Include the universe’s free ad (if exists).
4. Sort by:
   - `priority` (descending)
   - `createdAt` (ascending)
5. Display the first ad.
6. Rotate through the list every 15–30 seconds.

### **If no ads exist**
Show a default Feudalism 4 banner.

---

# **8. Ads Management UI (MOAP Setup HUD)**

A new section under Admin:

```
Admin → Ads
```

### **8.1 Universe Admin View**
- Sees only ads belonging to their universe.
- Can create/edit/delete/activate/deactivate ads for their universe.
- Sees the banner ad limit (read‑only).
- Sees:
  - Active ads count  
  - Remaining slots  

### **8.2 System Admin / Super User View**
- Sees all ads (global + universe).
- Can create global ads.
- Can edit/delete any ad.
- Can change `bannerAdLimit` for any universe.
- Can feature ads (priority).

---

# **9. Enforcement Logic**

When a UA attempts to create or activate an ad:

1. Count all ads for that universe where:
   ```
   active == true
   ```
2. Compare to:
   ```
   universe.bannerAdLimit
   ```
3. If active ads < limit → allow  
4. If active ads ≥ limit → block  

---

# **10. Future Expansion (Not Implemented Now)**

Later, an in‑world kiosk will:

- Sell “Ad Slot Tokens”
- Redeem tokens to increase `bannerAdLimit`
- Validate tokens via backend
- Consume tokens on use

### **Cursor must NOT implement kiosk logic yet.**

---

# **11. Non‑Negotiable Rules**

Cursor must follow these exactly:

### ✔ Ads are managed globally, not inside Universe Manager  
### ✔ UAs can create ads only for their universe  
### ✔ UAs cannot change the ad limit  
### ✔ SA/SU can change the ad limit  
### ✔ Default limit is 1  
### ✔ Limit applies to active ads only  
### ✔ Only one banner slot exists on the HUD  
### ✔ Ads appear ONLY on MOAP Setup HUD pages  
### ✔ No kiosk logic yet  
### ✔ No auto‑increase  
### ✔ No ads on Player HUD or gameplay screens  

---

# **END OF SPECIFICATION**

---

If you want, I can now:

- Merge this into your full Universe System document  
- Write the Ads Management UI mockup  
- Write the Cursor task list for implementing this  
- Write the future kiosk design (LSL + backend)  

Just tell me where you want to go next.
