# Testing

## Automated (run here, all passing at handoff)
```bash
npm run typecheck   # tsc strict, whole app
npm test            # unit tests: distance/bearing, tile estimates, elevation, GPX, formatting
npx expo export --platform ios --platform android   # full JS bundle for both platforms
npx expo prebuild --no-install                       # validates every native plugin/permission config
```

## Manual device test plan (REQUIRED before submission — not yet run)
Use a real iPhone and a real Android phone, one older/low-end device if possible. Build a dev client first (docs/SETUP.md §6).

**GPS & save**
- [ ] Home → SAVE THIS CREEK → permission prompt shows your explanation text → coordinates lock, accuracy shown → name + photo + notes → saved.
- [ ] Saved coordinates match the real spot (compare with another maps app). Edit, rename, move folder, delete.
- [ ] 25 places on the free plan → 26th opens the paywall.

**Maps**
- [ ] Standard / Satellite / Terrain switch (Premium gating correct). Zoom to street level. Pins tappable, clusters expand.
- [ ] Long-press drops a pin → "Save a creek here". Find it shows distance + arrow; arrow follows your compass heading.

**Offline (airplane mode)**
- [ ] With Wi-Fi: Offline maps → download 3 km area. Turn on airplane mode, force-quit, reopen → map renders in that area, saved places list/coordinates open, Find it works.
- [ ] Offline: save a new place with 2 photos + notes. Turn network on → within seconds it appears in Supabase (Table Editor + Storage) and on a second device.
- [ ] Offline: record a 10-minute walk with screen locked (grant "Always"). Distance/time plausible; trail drawn. Stop & save → syncs later.
- [ ] Deny "Always": tracking still works while app is open and warns about it.

**Accounts / privacy**
- [ ] Sign up (email confirm), sign in, sign out wipes local data, sign in again restores places + photos.
- [ ] Private place never appears on the community map from a second account. Make public → appears; make private → disappears.
- [ ] Rate, comment, report, block. Blocked user's places disappear.
- [ ] Delete account → Supabase rows, storage files and auth user are gone.

**Safety data**: a US location shows forecast + gauges; during an active alert the red banner appears; non-US shows "not available".
**Purchases**: sandbox purchase unlocks Premium on that device; restore works; `profiles.is_premium` flips via webhook; cancel/expire reverts.
**Performance**: Map with 500+ pins stays smooth on the older device; battery drain over a 1 h track is acceptable.
