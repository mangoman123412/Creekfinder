# CreekFinder 2.0 — design system & Destination Guide

## Design system (`src/theme.ts`, `src/components/ui.tsx`)
* **Light + dark** palettes (forest green, charcoal, water blue, earth/amber accents). Profile → Appearance: Auto / Light / Dark. Switching remounts the app tree so every screen and the map style update.
* **Inter** typeface (400/600/700/800), tasteful layered shadows, 18–34 px radii, no hard borders.
* Components: `Pressy` (spring press), `Button`, `IconButton`, `Chip`, `Pill`, `Card`, `Group/Row`, `Banner`, `Empty`, `Skeleton` (shimmer), `DestinationCard` (image-led), floating pill tab bar, `Gallery` + full-screen viewer.
* Animations: React Native Reanimated (staggered card entrances, springy presses, shimmer loading).

## Screens
* **Home** — immersive map hero (satellite when a MapTiler key exists) with greeting, current town, live weather (Open-Meteo), avatar, alerts bell (real NWS alerts), pins for saved + nearby + community; floating **FIND A CREEK** / **SAVE A LOCATION**; carousels: Your saved locations · Nearby hidden gems · Popular creeks · Recently discovered · Trending outdoor destinations · Suggested places. A carousel with no real data is hidden — nothing is invented.
* **Explore** — search (city/state/ZIP), category chips, photo cards, list/map toggle.
* **Map** — search, layers panel (map type, nearby water, community), pin → bottom card → guide.
* **My Places** — photo cards, folders, search. **Profile** — stats, appearance, settings.
* **Destination Guide** (`app/creek.tsx`) — opens for ANY creek (saved / community / OpenStreetMap).

## Destination Guide — where every fact comes from
| Section | Source | If unavailable |
|---|---|---|
| Photo gallery | Your photos · explorer uploads (Supabase) · Wikimedia Commons (credited, filtered to water photos near the spot) | Designed placeholder + "be the first to add one" |
| Name/county/state/nearest town | OpenStreetMap Nominatim | Unknown |
| Elevation | Open-Meteo (Copernicus DEM) | Unknown |
| Nearest road / parking | OpenStreetMap (public lots only) | Unknown |
| Waterway type, width, depth, fishing | OSM tags / explorer notes | Unknown |
| Flow, level, temperature, clarity (turbidity) | Nearest USGS gauge (≤30 km, labelled with distance + date) | Unknown |
| Swimming reported | Explorer reports / mapped swimming areas | Unknown |
| Trails, bridges, waterfalls, swim areas, rocks/cliffs, public camping | OpenStreetMap within ~4 km | "None mapped nearby" |
| Trees & vegetation, wildlife | iNaturalist research-grade observations ≤3 km | "None recorded nearby" |
| Natural scenery / nearby sights | Wikipedia geosearch | Section hidden |
| Weather, flood alerts | NWS (US) | Stated as unavailable |
Results are cached in local SQLite so a place you've viewed opens offline.

## Backend change
`supabase/schema.sql` (v2 block at the end) lets any signed-in user add photos to a **public** place. Re-run the file in the SQL Editor to apply.
