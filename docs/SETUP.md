# Setup — what to connect, and how

CreekFinder runs **without any of these** in a limited local mode (saving, GPS, notes, photos, standard map). Connect them to unlock accounts, sync, community, satellite/topo maps, offline downloads and subscriptions.

> You need a Mac only if you want to build iOS locally. With **EAS Build** (Expo's cloud builds) you can build and submit the iPhone app from any computer.

## 0. Accounts you need
| Service | Why | Cost |
|---|---|---|
| Apple Developer Program | App Store publishing | $99 / year |
| Google Play Console | Play Store publishing | $25 one-time |
| Expo (expo.dev) | EAS cloud builds + submission | Free tier is enough to start |
| Supabase | Auth, database, photo storage | Free tier to start |
| MapTiler Cloud | Satellite / topo / streets maps, place search | **Paid plan needed for a commercial app** (see §3) |
| RevenueCat | Subscriptions on both stores | Free until revenue threshold |

## 1. Install & run
```bash
npm install --legacy-peer-deps
cp .env.example .env        # fill in values below
npm run assets              # (optional) regenerate icons
npx expo start --dev-client # after building a dev client (§6)
```
Maps use native code (MapLibre), so the app does **not** run in Expo Go. Build a development client (§6).

## 2. Supabase (backend)
1. https://supabase.com → New project. Pick a region near your users. Save the DB password.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run. (Creates tables, row-level security, free-tier limit, public-places search function, photo bucket, account deletion.)
3. **Project Settings → API**: copy *Project URL* and *anon public key* into `.env` as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. (The anon key is designed to be public; the security is the row-level-security policies. **Never** put the `service_role` key in the app.)
4. **Authentication → Providers → Email**: enable. Keep "Confirm email" ON. Under **URL Configuration** set a Site URL (your website).
5. **Authentication → SMTP**: configure a real email sender before launch (Supabase's built-in sender is heavily rate limited).
6. **Verify security**: Table Editor → each table should show "RLS enabled". In SQL editor run `select * from places` as the anon role — you must get 0 rows.
7. Moderation: reports land in the `reports` table. To hide content set `places.hidden = true` / `comments.hidden = true`; to mark a place verified set `places.verified = true` (only the service role can).
8. **Premium sync (important):** deploy `supabase/functions/revenuecat-webhook` (instructions in the file) so paying users' `profiles.is_premium` is set — otherwise the server enforces the 25-place free limit on them.

## 3. MapTiler (maps)
1. https://cloud.maptiler.com → sign up → **Account → API keys** → create a key → `EXPO_PUBLIC_MAPTILER_KEY`.
2. Styles used (`src/lib/mapStyles.ts`): `streets-v2`, `hybrid` (satellite + labels), `outdoor-v2` (topo, contours, trails). Confirm the ids exist in your account's *Maps* list; change them there if MapTiler renames them.
3. **Licensing — read before launch.** MapTiler's free plan is for non-commercial use. A published app with subscriptions needs a paid plan, and you must confirm the plan's terms **allow caching / offline tile packs** (used by Offline Maps). If they don't suit you, swap the provider by editing only `src/lib/mapStyles.ts` and `src/lib/explore.ts#geocode` — alternatives: Stadia Maps, Mapbox, or self-hosted Protomaps/OpenFreeMap.
4. The key ships inside the app, so set the plan's usage alerts, and rotate the key if abused.
5. Without a key the app falls back to the free keyless OpenFreeMap "Standard" style; satellite/terrain/offline-for-those are disabled with a clear message.

## 4. RevenueCat (subscriptions)
1. In **App Store Connect** → your app → Subscriptions: create a group "CreekFinder Premium" with e.g. `premium_monthly` and `premium_yearly`. In **Play Console** → Monetize → Subscriptions: create the same.
2. https://app.revenuecat.com → new project → add an iOS app and an Android app (bundle id / package name must match `app.config.ts`). Follow RevenueCat's prompts to link App Store Connect (App Store Connect API key / shared secret) and Play (service account JSON).
3. Create an **Entitlement** named exactly `premium`, attach both products. Create an **Offering** `default` containing Monthly and Annual packages.
4. **API keys**: copy each platform's *public SDK key* into `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
5. Add the webhook from §2.8. Test purchases with an Apple **Sandbox** tester and a Play **license tester**.

## 5. Identifiers & legal URLs
* Edit `BUNDLE_ID` at the top of `app.config.ts` (e.g. `com.yourcompany.creekfinder`). Immutable after publishing.
* Host a Privacy Policy and Terms page on a public URL (a free GitHub Pages / Notion / your domain page works). Start from the text in `src/legal.ts`, fill the `[brackets]`, **have a lawyer review it**. Put the URLs in `.env`.
* Set `EXPO_PUBLIC_SUPPORT_EMAIL`.

## 6. Build with EAS
```bash
npm i -g eas-cli && eas login
eas init                                  # links the project, writes the projectId
eas build --profile development --platform android   # installable dev client (APK)
eas build --profile development --platform ios       # needs Apple dev account / registered device or simulator build
```
Set the `.env` values as **EAS environment variables/secrets** (`eas env:create`) so cloud builds see them.
