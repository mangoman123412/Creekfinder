# Architecture & design

## Stack — and why
| Need | Choice | Why |
|---|---|---|
| App | **React Native + Expo (SDK 58), TypeScript, expo-router** | One codebase for iOS + Android, file-based navigation, EAS cloud builds/submission, huge ecosystem. Runs well on older phones (Hermes, new architecture). |
| Maps | **MapLibre Native** (`@maplibre/maplibre-react-native`) + MapTiler tiles | Native GPU rendering (smooth, light on old phones), **built-in offline tile packs**, no per-map-load fee like Google/Mapbox SDKs, swap tile providers freely. Google Maps for RN has no real offline-region support. |
| Local data | **expo-sqlite** | Offline-first: every save/track/photo goes to SQLite first. Works in the background-location task too. |
| Backend | **Supabase** (Postgres + Auth + Storage + RLS) | Real relational DB, row-level security enforces privacy *on the server*, signed photo URLs, generous free tier, SQL you can read. |
| GPS | expo-location + expo-task-manager | Foreground precision fix for saving; background task (foreground service on Android) writing straight to SQLite for trails. |
| Subscriptions | **RevenueCat** | One API over StoreKit + Play Billing; receipts validated server-side; webhook sets the server-side premium flag. |
| Water data | OpenStreetMap (Overpass), NWS, USGS | Real, free, authoritative-where-available data. No invented creeks. |

## Offline-first data flow
```
UI ──write──▶ SQLite (dirty=1) ──┐                        ┌── pull (updated_at > cursor) ──▶ SQLite
 ▲   notifyDb()                  ▼   (online + signed in)  │
 └── useDbQuery re-renders   sync.ts: push folders→places→photos(upload file)→adventures ──▶ Supabase
```
* IDs are client-generated UUIDs, so records created offline never conflict.
* Soft deletes (`deleted`/`deleted_at`) propagate across devices.
* Conflicts: last write wins per row; a row with unsynced local edits is never overwritten by a pull.
* Sync triggers: sign-in, connectivity regained, app foregrounded, 2.5 s after any local change.
* Signed-out/guest data is adopted by the account on first sign-in.

## Database (Postgres — `supabase/schema.sql`)
`profiles` (display name, `is_premium` server-only) · `folders` · `places` (lat/lng, notes, `visibility private|public`, `verified`, `hidden`, `source_place_id`) · `photos` (storage path) · `adventures` (GPS track as JSON `[lat,lng,alt,ms]`) · `ratings` · `comments` · `reports` · `user_blocks`.
Privacy is enforced by **RLS policies**: private rows readable only by the owner; public rows readable by signed-in users unless hidden/blocked. Photos live in a **private** bucket; others get access only through a policy tied to a public place. Triggers stop users from setting `verified`/`hidden`/`is_premium` and enforce the 25-place free limit server-side.
Local SQLite mirrors these (plus `dirty`, `sync_error`, `track_points`, `kv`).

## Screens
Tabs: **Home** (big SAVE THIS CREEK, recents, nearby water) · **Explore** (search city/state/ZIP, filters, list/map, source badges) · **Map** (layers, saved + community pins, long-press to drop a pin) · **My Places** (folders, search) · **Profile** (account, sync, units, history, privacy, delete account).
Stack: Save/Edit · Place detail (distance, Find it, directions, share, safety) · Navigate (GPS guidance, retrace) · Track · Adventures (list + "where I've explored") · Adventure detail (GPX export) · Offline maps · Premium · Safety · Auth · Public place (rate/comment/report/block) · Legal.

## Trust & safety design
* Explore labels every result: **Verified** (moderator), **Community · unverified**, or **OpenStreetMap**. Nothing is bundled or invented.
* Private places never leave the device/your account. Making public requires an explicit confirmation.
* Reporting, blocking, comment deletion (App Store UGC requirements).
* Safety disclaimers on Home, place pages, Safety screen, Terms. No property data is claimed; the app says so.
