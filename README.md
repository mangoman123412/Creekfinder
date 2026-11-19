# CreekFinder 🏞️

A personal creek-finding GPS and outdoor exploration app for **iOS and Android** (React Native / Expo). Save the exact GPS spot of a creek, add photos and notes, find your way back with maps and guidance — online or off — track your hikes, discover real nearby water, and optionally share with a community.

**Status: complete codebase, verified by type-check, unit tests, native config generation and JS bundling for both platforms. It has *not yet been run on a physical phone/emulator* and is *not published*.** See "What's verified" below, then follow `docs/`.

| Doc | What |
|---|---|
| [docs/INSTALL_ON_PHONE.md](docs/INSTALL_ON_PHONE.md) | **Install on a phone with no app store** (web app / Home Screen) |
| [docs/SETUP.md](docs/SETUP.md) | Every account/API key you need and exactly how to get it |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack choices, offline sync design, database, screens |
| [docs/TESTING.md](docs/TESTING.md) | Automated checks + the manual device test plan |
| [docs/STORE_RELEASE.md](docs/STORE_RELEASE.md) | Builds, App Store / Google Play checklists, privacy labels, review notes |
| [supabase/schema.sql](supabase/schema.sql) | Complete backend schema with security policies |

## Features
Save This Creek (high-accuracy GPS, name, type, photos, notes, folders, private/public) · MapLibre maps (standard, satellite, terrain/trails) · distance + live "Find it" guidance + driving directions · Explore (OpenStreetMap + community, search by city/state/ZIP, filters, source badges) · GPS trail recording incl. background/offline, history, "where I've explored", retrace to start, GPX export · community (share, rate, comment, report, block) · offline map downloads + offline-first data with auto-sync · safety (NWS weather & flood alerts, USGS gauges, emergency location sharing, disclaimers) · free/premium with RevenueCat · account deletion · legal pages.

## Commands
```bash
npm install --legacy-peer-deps
npm run typecheck && npm test
npx expo start --dev-client      # needs a dev build (maps are native code)
```

## What's verified vs. not
✅ `tsc --strict` clean · ✅ 9 unit tests (geo math, tile estimates, GPX…) · ✅ `expo prebuild` for iOS+Android (all plugins/permissions) · ✅ Metro bundles both platforms.
⬜ Not yet exercised on a device: live GPS, background tracking, map rendering, offline packs, camera/photos, Supabase round-trips (RLS, sync, storage), purchases. These need your keys and a phone — follow docs/TESTING.md.

## Known gaps / honest notes
* **Not implemented:** property-boundary warnings (no reliable free national dataset; the app says so rather than guessing — Regrid or similar is a paid integration); sync conflict resolution is last-write-wins; water-level/flood data is US-only (USGS/NWS); no Android tablet/iPad-specific layouts.
* Map tile terms (MapTiler) must be checked for commercial + offline use — docs/SETUP.md §3.
* Moderation is manual via the Supabase dashboard (`reports` table).
