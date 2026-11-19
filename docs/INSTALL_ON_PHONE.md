# Install CreekFinder on your phone (no App Store / Play Store)

CreekFinder also builds as a **web app (PWA)**. You host it once on a free HTTPS site, open the link on your phone, and "Add to Home Screen" — it then looks and launches like a normal app (own icon, full screen) on **iPhone and Android**.

## 1. Host it (free, ~2 minutes) — Netlify Drop
1. Unzip `creekfinder-web.zip` (or use the `dist/` folder).
2. Go to https://app.netlify.com/drop, sign up free, and **drag the unzipped folder** onto the page.
3. You get a link like `https://something.netlify.app`. (GPS only works over HTTPS — Netlify provides it.) You can rename the site in Site settings.
Alternatives: Cloudflare Pages, Vercel, GitHub Pages — upload the same folder. (Single-page-app fallback is already included for Netlify/Cloudflare via `_redirects`.)

## 2. Add to Home Screen
* **iPhone (must use Safari):** open the link → Share button → **Add to Home Screen** → Add. Open it from the new icon. When asked, **Allow** location.
* **Android (Chrome):** open the link → ⋮ menu → **Install app** / Add to Home screen.

## 3. What works / what doesn't (web app vs. store app)
| | Web app on phone |
|---|---|
| Save a creek with exact GPS, photos, notes, folders | ✅ |
| Map, pins, distance, "Find it" arrow, directions, share location | ✅ |
| Explore real nearby water (OpenStreetMap), weather, flood alerts, stream gauges | ✅ (needs signal) |
| Works with no signal once installed: open app, saved places, save new places, record trails | ✅ |
| Map tiles you have already viewed are cached for offline | ✅ (best-effort, ~3000 tiles) |
| Record a trail while the phone is locked / app in background | ❌ browsers can't. Keep the app open — it keeps the screen awake. |
| Downloadable offline map regions | ❌ native app only |
| Satellite/topo maps, accounts, sync, community | ✅ **after** you add the keys below, then rebuild |
| In-app subscriptions | ❌ not used — this build unlocks all features (`EXPO_PUBLIC_UNLOCK_ALL=1`) |

Tips for iPhone: Safari can erase a normal website's stored data after ~7 days of non-use, but an app **added to the Home Screen** is exempt. Always install it to the Home Screen before relying on it, and sign in + sync (once Supabase is connected) so your places are also backed up.

## 4. Turn on accounts / satellite maps (optional)
Follow docs/SETUP.md §2–3 to get a Supabase URL + anon key and a MapTiler key, put them in `.env`, then rebuild and re-upload:
```bash
npm install --legacy-peer-deps
EXPO_PUBLIC_UNLOCK_ALL=1 npx expo export --platform web --output-dir dist
```
(Upload `dist/` to Netlify again — same link keeps working; the installed app updates next time it's opened online.) With a backend, the server's free-tier limit of 25 places applies unless your profile has `is_premium = true` (set it in the Supabase table editor for yourself).
In Supabase → Authentication → URL Configuration, set the Site URL to your Netlify link.
