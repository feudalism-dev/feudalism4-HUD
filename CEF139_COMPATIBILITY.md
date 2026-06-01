# Second Life MOAP — CEF-139 compatibility standard

## Official target

**Second Life MOAP uses CEF-139 (Chromium ~139).** All Feudalism 4 HUD pages, scripts, and CSS must run correctly in that engine and must **not** depend on features introduced in Chromium/CEF **140+**.

When adding UI or JavaScript, assume the in-world viewer — not your desktop Chrome — is the reference environment.

## What this means in practice

| Area | Standard |
|------|----------|
| **Engine** | CEF-139 / Chromium 139 only; no APIs gated to 140+ |
| **Scripts** | Classic `<script src="...">` tags; no ES modules (`type="module"`), no bundler-only syntax |
| **Firebase** | `firebase-*-compat.js` (v9 compat) loaded from gstatic; global `var db`, `var auth` |
| **Globals** | Cross-file shared state uses `var` on `window` where scripts must see each other |
| **Async** | `async`/`await` and Promises are OK (supported well before 139) |
| **Syntax** | Optional chaining (`?.`), nullish coalescing (`??`), template literals — OK on 139 |
| **DOM / history** | `history.replaceState` is allowed but **avoid** stuffing large payloads into the MOAP URL (breaks focus/input in CEF MOAP) |
| **CSS** | Flexbox, Grid, custom properties — OK; avoid features that require Chromium 140+ (check [Can I use](https://caniuse.com) with “139” in mind) |
| **Testing** | Verify in-world on the Setup HUD; desktop Chrome alone is not sufficient |

## Do not use (without explicit approval + SL test)

- Dynamic `import()` / native ES modules in HUD pages
- JavaScript or CSS features documented as **Chrome 140+** only
- `navigator.share`, File System Access API, and other APIs commonly missing or disabled in embedded CEF
- Assuming keyboard/focus behavior matches a normal browser tab (MOAP has known focus quirks — use `installMoapInputFix`, avoid re-rendering inputs on every keystroke, keep URLs short)
- Using `window.confirm` / `window.alert` — use `UI.showConfirmDialog()` and in-page modals instead

## MOAP-specific issues (not “browser too old”)

Problems like **text fields not accepting keystrokes** are usually **MOAP integration** (URL sync, `setMOAPUrl` reloads, `renderAll` resetting inputs, event bubbling), not missing CEF-139 support for `<input>`. Fix those patterns; do not “upgrade” past CEF-139 to solve them.

## Quick self-check before merge/deploy

1. No new `type="module"` scripts in `hud.html` or related pages  
2. No new CDN libraries that require Chromium > 139  
3. Form fields are not rebuilt on every `input` event  
4. `HUD_BUILD_LABEL` bumped when shipping HUD changes  
5. Test typing and save flow **in Second Life**

## Runtime marker

`hud.html` sets `window.MOAP_CEF_TARGET = 139` for debugging. Optional: log `navigator.userAgent` in-world to confirm the viewer build.

## Related docs

- `.cursor/rules/moap-cef139-standard.mdc` — agent rule for MOAP work  
- `.cursor/rules/moap-deploy-after-changes.mdc` — GitHub Pages deploy after HUD changes  
- `DEPLOYMENT_QUICK_REFERENCE.md` — deploy commands  
