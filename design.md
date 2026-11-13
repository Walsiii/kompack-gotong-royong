# Kompack — Kampung dalam tinta

Custom Hallmark redesign requested by the owner. An Indonesian neighbourhood action game for residents of all ages and RT administrators. Preserve every route, mission rule, evidence check, consent and data handler. The green/orange default is explicitly retired.

## System

- Default is Ink: white, charcoal and legible neutral grey. Optional Kampung (green) and Laut (blue) accents are a deliberate user choice in settings, stored locally. Real evidence photographs retain their colours.
- Colour lives in content, not chrome: the basemap uses familiar Google-Maps-like colours (light land, white roads, yellow major roads, blue water, green parks), the GPS position is a blue dot with accuracy halo and heading beam, and each mission category has one hue (`--cat-*`: sampah amber, selokan blue, rusak brick, taman green, bantu pink) used on map pins and category tiles. UI chrome stays black/white.
- Use self-hosted Public Sans variable for a neutral, familiar map interface. The owner explicitly rejected the old Atkinson letterforms and oversized bold headings. Normal 600–700 weight headings, sentence case controls, compact 14–16px data and 44px touch targets. No tracked capitals, eyebrow labels, decorative metrics or marketing sections.
- Shared semantic tokens in src/tokens.css. Use existing Tailwind colour names ink, ink-2, ink-3, paper, card, line, plang, rompi, ok, warn, bad. Add neutral surface, accent-soft, accent-ink, inverse and focus tokens as needed. Never hard-code colours in new components.
- Outer surfaces 20px, controls 12px, inset objects 8px. Touch targets at least 44px, 16px running text, strong focus rings. Use real buttons and disclosure elements with labels.
- One prominent action per context. The map follows familiar Google Maps conventions requested by the owner: a real local mission/report search field, horizontal category filters, a calm neutral basemap, flat category-symbol markers with short labels, lower-right recenter/layers tools, a selected-item detail sheet on mobile and a search/results panel on desktop. Search never implies a place-geocoding service. Existing point rewards remain visible in mission details. Map markers use symbols, not colour alone.
- Preserve the responsive desktop rail and mobile navigation, with an ink selection capsule. Reduce visual noise and floating messages.
- Evidence comparison is the lead on review pages. A compact evidence summary groups location, time and photos, exposes warnings immediately, and discloses full original checks on demand. Never hide bad checks or imply test-mode evidence was verified.
- Characters ("Warga Kompack!", inspired by the flat, geometric, personality-driven style of Duolingo's cast but original and Indonesian): flat fills, no outlines, big heads, white eyes with large pupils, expressive mouths. Defined in `src/components/cast.ts`, animated in `src/components/KampungBuddy.tsx`.
  - **Kompi** — the main mascot: a black ant (ants = gotong royong) with a sun-yellow iket headband. Logo, app icon (yellow background), splash, onboarding, map greeting by day.
  - Supporting cast: **Resik** (teen in an orange street-cleaner vest with a sapu lidi: sampah, selokan), **Bu Asih** (hijab, rantang: bantuan), **Mbah Tunas** (caping, gembor: taman), **Pak RT** (batik, peci, clipboard: fasilitas, RT screens), **Mang Jaga** (sarung, peci, senter: only Pos Ronda and night greeting; ronda stays separate from daytime gotong royong).
  - Motion: breathing, blinking, eyes that follow the finger/cursor, accessory sway, talking mouth when a tip appears, wave/jump/celebrate reactions on tap. Respect reduced motion.
- Visual over text (owner: Indonesian users prefer visuals): numbers as icon tiles, steps as icons, categories as big icon tiles, tools as emoji chips, podium for top 3, characters in empty states. Explanations live in collapsed details or accessible labels, not paragraphs.
- Keep language natural Indonesian, short and inviting. Technical evidence facts remain accessible. No promises of automated fraud certainty.

## Scope and ownership

Main: tokens, shared styles and controls, shell, art, theme settings and integration.
Map: MapHome, Map3D and mapStyle.
Evidence: ReviewSub, ReviewReport, Inbox, Compare and a dedicated evidence-summary component.
Welcome: Onboarding, Celebration and the companion component.
No routes or files are removed. Existing data is preserved.

## Validation

Production TypeScript/Vite/PWA build, functional browser walkthroughs at mobile and desktop sizes, evidence disclosure and keyboard comparison, theme persistence, reduced-motion behaviour, horizontal overflow checks, and Hallmark static/render sweep. Existing seeded demo counts are product fixtures, never new claims.

## Latest feedback

Owner explicitly rejects 3D maps (2D only), tapping the map to move the user's avatar (position is always real GPS; test mode only moves it through explicit buttons), opening Google Maps (navigation is in-app), green default theme, the old house mascot, black-outline blob characters, text-heavy screens, bulky map cards, repeated floating banners, odd mascot fingers, excessive whitespace in desktop evidence, and primitive drawn demo photos with green in-image labels. Map should occupy most of the mobile screen, use actual geographic tile data, and offer real pedestrian routing with clear GPS/arrival states. A route is never a straight line passed off as a road path. Theme stays neutral black and white unless changed by the user. Demo images can be realistic generated examples but must be identified as simulated outside the image; captured evidence never loses its watermark or sample flag.

Engagement: weekly streak ("pekan beruntun", counted only from actions approved by the RT, so it cannot be self-farmed) and a weekly 100-point target, shown on the map points chip and the Aku page. A short character greeting on the map once per session points to the nearest open mission.
