# CreekFinder 3.0 — customization system

## Architecture (one place for everything)
```
src/custom/schema.ts      THE schema: every customizable thing, its default, allowed values and sanitiser
src/custom/store.ts       one store: profiles[] (each a full Settings snapshot) + saved themes + map presets
src/custom/runtime.ts     pushes settings into the design tokens (colours, radius, spacing, fonts, motion…)
src/theme.ts              tokens are read live (Proxy/getters) → a re-render picks up any change, no restart
src/custom/themed.tsx     every screen re-renders on change (no remount: navigation + scroll are kept)
src/custom/sync.ts        cloud sync (last write wins) + backups; share.ts import/export; market.ts marketplace
```
**Add a new option:** add it to `Settings` + `DEFAULTS` (+ `sanitize` if it needs validation). Storage, profiles, cloud sync, backup, import/export and the marketplace pick it up automatically.
**Active profile = live settings.** Editing settings edits the active profile; switching profiles is instant.

## What each setting changes (all verified in the browser test run)
| Area | Live effect |
|---|---|
| Theme / colours / HEX / high contrast | Palette is rebuilt (13 seed colours → full palette with guaranteed text contrast); every screen + map markers + nav bar update immediately |
| Home widgets | 15 widget types; show/hide, reorder (drag & drop + arrow buttons), size S/M/L, background style (incl. custom colour), custom shortcuts; "Restore default layout" |
| Navigation | tabs shown/order/label/icon, 4 bar styles, icon style, label mode; Profile always kept, ≥3 tabs |
| Map presets | style (7), markers (size, 6 shapes, 5 colours), labels/roads/trails/waterways/contours/hillshade really hidden **inside the style JSON**, brightness, default zoom, auto-centre, what to show (saved/community/visited/parking/hiking routes/nearby water). Built-in presets are never edited — first edit forks a copy |
| Creek pages | 18 sections reorderable/hideable; compact / standard / detailed layouts; per-visit switch |
| Saved locations | nested coloured folders with icons, private collections (cannot be shared), favorites, tags, personal rating, sort (date/distance/name/rating/elevation), filters |
| Tracking | 4 layouts incl. distraction-free; 9 statistics, reorder/hide |
| Notifications | 8 types (safety vs updates), quiet hours (overnight, per-day, flood override), sounds, inbox, test buttons |
| Fonts & display | text size, 4 fonts, bold, button size, icon size, card style, corner roundness, density, animation intensity |
| Accessibility | high contrast, reduce motion (also follows system), larger touch targets, screen-reader hints |
| Profiles | Explorer / Fishing / Hiking / Minimal built in + your own, rename, icon, duplicate, export |
| Marketplace | official + community themes/layouts/profiles/map presets, preview-before-apply, ratings, publish |
| Cloud | settings sync across devices, automatic daily + manual backups, restore, export/import everything |

## Security of shared designs
Designs are **data only**: `CF1:` + base64 JSON with an integrity checksum. On import (and again for marketplace downloads) every field is validated and clamped against the schema; unknown keys are dropped, colours must be hex, lists may only contain known ids. Nothing is ever evaluated. Shared designs contain preferences only — never places, photos or location.

## Honest limits
* **Notifications while the app is fully closed** need a push server (not included). Alerts are checked on launch, on foreground, and every 10 min while open; they fill the inbox and show system pop-ups + sounds when allowed. Web: generated chime/siren sounds; phones: system default or silent. Likes/followers don't exist in CreekFinder, so there is nothing to notify about.
* **Native-only code paths I could not run here:** non-circle marker shapes on iOS/Android use RN `Marker` views (≤150 pins); web uses generated marker images (tested). Native notifications use expo-notifications (untested). Test on devices.
* **Map styles** other than Standard/Dark/Light need a MapTiler key. Hiking-route overlay uses Waymarked Trails tiles (check their usage terms for commercial use).
* **Home/creek/tracking previews** in the editor are faithful miniatures (themes, layout, navigation, spacing), not pixel-exact renders of the live app.
* Cloud sync needs `supabase/schema.sql` re-run (v3 block at the end).
