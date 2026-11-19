# Releasing to the App Store and Google Play

> **Status: NOT submitted, NOT reviewed, NOT published.** Do not describe the app as "available" anywhere until each store has approved it and the release is live.

## 1. Before you build
- [ ] Complete docs/SETUP.md (Supabase, MapTiler paid plan, RevenueCat, bundle id, legal URLs).
- [ ] Complete the device test plan in docs/TESTING.md on iOS **and** Android.
- [ ] Lawyer-reviewed Privacy Policy + Terms hosted at public URLs.
- [ ] Trademark/name check for "CreekFinder" in app stores and USPTO/your country; pick another name if taken (change `name` in `app.config.ts`).

## 2. Production builds
```bash
eas build --profile production --platform ios       # .ipa (EAS manages certs/profiles)
eas build --profile production --platform android   # .aab
eas submit --profile production --platform ios
eas submit --profile production --platform android
```
Android: first upload must be done manually once in Play Console (create the app, upload the first .aab to Internal testing), then `eas submit` works with a service-account key.

## 3. App Store Connect (iOS)
- App name, subtitle, description, keywords, category **Navigation** or **Health & Fitness/Travel** (Navigation fits best), age rating (UGC → answer the questionnaire honestly), support URL, privacy policy URL.
- **App Privacy ("nutrition labels")** — declare: Precise Location (linked to user, for app functionality), Email, Photos, User Content (places/notes/comments), Purchase history, Identifiers (user id). Not used for tracking/advertising.
- **Review notes** (paste & adapt): *"CreekFinder saves GPS locations of creeks. Background location is used ONLY while the user has explicitly started a hike recording (a blue location indicator shows); it is needed so the trail keeps recording when the screen is locked. Demo account: email/password. User-generated content: users can report content and block users in-app; reports are reviewed by the developer. Account deletion: Profile → Delete account."*
- Provide a **demo account** that has a few saved places and a public place.
- Subscriptions: attach to the version, add the required auto-renewal text (present in the Premium screen), Terms/Privacy links (present).
- **Screenshots** (capture from real builds, not mock-ups): 6.9" (1320×2868) iPhone is required; iPad 13" if `supportsTablet` stays true. Suggested 6: Home with Save button · Save form with photos · Satellite map with pins · Explore with source badges · Track recording · Offline maps. Don't show private data or real people.
- Check the "Sign in with Apple" rule: only email/password is offered, so it is not required. If you add Google/Facebook login you must add Sign in with Apple.

## 4. Google Play Console (Android)
- Store listing: short + full description, 512×512 icon (`assets/icon.png` resized), 1024×500 feature graphic, **phone screenshots (min 2, 16:9–9:16, 1080px+)**, 7" and 10" tablet screenshots if you support tablets.
- **Data safety form**: Location (precise, collected, functionality), Personal info (email), Photos, App activity/user content; encrypted in transit; **users can request deletion** (give the in-app path and a web URL for deletion requests — Play requires a web link).
- **Permissions declaration**: *Background location* — fill the form + upload a short screen recording showing the user starting "Track hike" and the persistent notification. *Foreground service type: location*.
- Content rating questionnaire (UGC), target audience 13+ / general, ads: none.
- **New personal developer accounts must run a closed test with 12+ testers for 14 days before applying for production.** Plan for it.
- Declare the app is not a government/health app, no financial features.

## 5. After approval
Only then: announce, update store links, set the live version. Keep screenshots truthful and update them each major release.
