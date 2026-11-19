import { config } from './config';

const contact = () => config.supportEmail || '[your support email]';

export const PRIVACY = `PRIVACY POLICY — CreekFinder
Last updated: [DATE]

TEMPLATE NOTICE: This text describes how the app is actually built. Replace the bracketed items, host this policy at a public URL (required by Apple and Google), and have a lawyer review it before you publish.

1. Who we are
CreekFinder is operated by [YOUR LEGAL NAME / COMPANY], [ADDRESS]. Contact: ${contact()}.

2. Information we collect
• Account: your email address and a password (stored hashed by our authentication provider). A display name you choose.
• Location: with your permission, your device's precise location. We use it to (a) record the coordinates of places you save, (b) show you on the map, (c) record GPS trails while you have tracking turned on (including in the background if you allow "Always" location), (d) find nearby water, weather and stream-gauge information. Location for the map and nearby search is used on your device and sent to third-party data services (see §5) as a coordinate to fetch results.
• Content you create: places (name, coordinates, notes, descriptions), photos, GPS trails ("adventures"), ratings, comments, reports.
• Purchase status: whether you have an active Premium subscription (processed by Apple/Google and RevenueCat; we do not receive your payment card details).
• Technical data: basic diagnostic/network information needed to operate the service.

3. Private vs. public
Everything you save is PRIVATE by default. Private places, photos and GPS trails are visible only to you and are never shown on the community map. If you choose to make a place public, its exact coordinates, name, description, photos, your display name, and any ratings/comments become visible to other CreekFinder users. You can make it private again or delete it at any time.

4. How we use information
To provide the app (saving, syncing, offline use, mapping, community features), to keep the community safe (moderating reports), to enforce limits of the free plan, and to improve reliability. We do not sell your personal information and we do not use your location for advertising. We do not use third-party advertising or cross-app tracking.

5. Service providers
• Supabase — authentication, database and photo storage for your account data.
• MapTiler — map imagery/tiles and place search. Receives map tile requests and search text (with your IP address).
• OpenStreetMap / Overpass API — nearby water features (receives a coordinate and search radius).
• US National Weather Service and US Geological Survey — weather, flood alerts and stream gauges (receives a coordinate).
• RevenueCat, Apple App Store, Google Play — subscription processing.
Each processes data under its own privacy policy.

6. Storage, offline use and retention
Data you create is stored on your device first and synced to our servers when you are signed in and online. We keep your data until you delete it or delete your account.

7. Your choices and rights
• You can change location permission any time in your phone settings. Core features that need location will not work without it.
• Edit or delete any place, photo or adventure in the app.
• Delete your account in Profile → Delete account. This permanently deletes your account and all associated data from our servers.
• Depending on where you live (e.g. EU/UK GDPR, California CCPA/CPRA) you may have additional rights to access, correct, port or erase your data. Contact ${contact()}.

8. Children
CreekFinder is not directed to children under 13 (or under 16 in the EU) and we do not knowingly collect their data.

9. Security
Data is encrypted in transit; account data is protected by access controls on the server. No system is perfectly secure.

10. Changes
We will update this policy in the app and at our website when it changes.

11. Contact
${contact()}
`;

export const TERMS = `TERMS OF SERVICE — CreekFinder
Last updated: [DATE]

TEMPLATE NOTICE: Replace bracketed items and have a lawyer review before publishing.

1. Acceptance
By using CreekFinder you agree to these Terms. If you do not agree, do not use the app.

2. OUTDOOR SAFETY — PLEASE READ
Outdoor recreation, and especially being in or near water, is inherently dangerous and can cause injury or death. Creek conditions can change quickly and without warning. Maps, trails, GPS positions, weather, flood alerts, water-level readings and any other information in CreekFinder (including content from other users and from third parties such as OpenStreetMap, the National Weather Service and the USGS) may be inaccurate, incomplete, delayed or out of date. You alone are responsible for your safety and decisions. Do not enter fast, rising or flooded water. Do not rely on CreekFinder as your only navigation or emergency device.

3. Respect land and the law
CreekFinder does not show property boundaries and cannot tell you where you may legally go. You are responsible for knowing and following local laws, for staying on public land or land where you have permission, and for obeying signs. Do not trespass. Do not save or publicly share locations on private property without the owner's permission, or places where access is prohibited or dangerous.

4. Your account
You must provide accurate information and keep your login secure. You are responsible for activity under your account. You may delete your account at any time in Profile.

5. Your content
You keep ownership of the places, photos, notes and comments you create ("Content"). By making Content public you give CreekFinder a worldwide, non-exclusive, royalty-free licence to host, display and distribute it within the service. Private Content is not shown to others. You promise you have the right to post your Content and that it does not violate others' rights or the law.

6. Community rules
No illegal, harassing, hateful, sexually explicit, deceptive or spam content. No sharing of private-property locations without permission. No false or dangerous information. We may remove content and suspend accounts that break these rules. You can report content and block users in the app; we review reports and aim to act on violations promptly.

7. Free and Premium plans
The free plan has limits (for example, 25 saved places). Premium is an auto-renewing subscription billed through your Apple ID or Google Play account. It renews unless cancelled at least 24 hours before the end of the current period; manage or cancel in your store account settings. Refunds are handled by Apple/Google under their policies.

8. Third-party services
The app relies on third-party map, data and hosting providers. They may be unavailable or change; we are not responsible for them.

9. Disclaimer of warranties
The app is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, to the fullest extent permitted by law.

10. Limitation of liability
To the fullest extent permitted by law, CreekFinder and its operators are not liable for any indirect, incidental or consequential damages, or for any injury, loss or damage arising from your use of the app or reliance on its information. Nothing in these Terms limits liability that cannot be limited by law.

11. Changes and termination
We may update the app or these Terms. Continued use means you accept the changes. We may suspend or terminate access for violations.

12. Governing law
[YOUR JURISDICTION].

13. Contact
${contact()}
`;
