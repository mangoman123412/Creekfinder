# CreekFinder 4.0 — Map colours, Access Finder, custom pins

## Map colours (Settings → Map colours)
Per-feature colour, HEX, thickness, transparency, solid/dashed, marker size and visibility for 30+ features
(trails, water, land, other). Changes preview instantly and apply to the vector base map (standard/terrain)
and to an OpenStreetMap overlay drawn above any style, including satellite (with optional visibility outline).
Colour schemes can be saved, applied and shared (`CF1:` codes). Reset per feature or all.

## Access Finder
Open from a creek page, the map's selected-pin card, or a dropped pin. From OpenStreetMap data it lists
trailheads, public parking, access points, bridges crossing the waterway, paths toward it, the nearest road
and walking routes with distance/time. Ways tagged private/no/customers/permit are excluded.

## Honest limits
- Data is OpenStreetMap only and may be incomplete or wrong; routes are unverified.
- There is no land-ownership or parcel data. "Public" means "not tagged closed". Always follow posted signs and local law.
- Public-land boundaries are partial (ways only). Contours/hillshade only appear where the chosen vector style has them.
- Custom pins are stored on-device only. Requires Overpass availability (cached 14 days).
- Native (iOS/Android) code paths are untested; the web/PWA build is what was exercised.
