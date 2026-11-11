# Kompack — Kampung dalam tinta

Custom Hallmark redesign requested by the owner. An Indonesian neighbourhood action game for residents of all ages and RT administrators. Preserve every route, mission rule, evidence check, consent and data handler. The green/orange default is explicitly retired.

## System

- Default is Ink: white, charcoal and legible neutral grey. Optional Hutan and Senja accents are a deliberate user choice in settings, stored locally. Real evidence photographs retain their colours.
- Use self-hosted Public Sans variable for a neutral, familiar map interface. The owner explicitly rejected the old Atkinson letterforms and oversized bold headings. Normal 600–700 weight headings, sentence case controls, compact 14–16px data and 44px touch targets. No tracked capitals, eyebrow labels, decorative metrics or marketing sections.
- Shared semantic tokens in src/tokens.css. Use existing Tailwind colour names ink, ink-2, ink-3, paper, card, line, plang, rompi, ok, warn, bad. Add neutral surface, accent-soft, accent-ink, inverse and focus tokens as needed. Never hard-code colours in new components.
- Outer surfaces 20px, controls 12px, inset objects 8px. Touch targets at least 44px, 16px running text, strong focus rings. Use real buttons and disclosure elements with labels.
- One prominent action per context. The map follows familiar Google Maps conventions requested by the owner: a real local mission/report search field, horizontal category filters, a calm neutral basemap, flat category-symbol markers with short labels, lower-right recenter/layers tools, a selected-item detail sheet on mobile and a search/results panel on desktop. Search never implies a place-geocoding service. Existing point rewards remain visible in mission details. Map markers use symbols, not colour alone.
- Preserve the responsive desktop rail and mobile navigation, with an ink selection capsule. Reduce visual noise and floating messages.
- Evidence comparison is the lead on review pages. A compact evidence summary groups location, time and photos, exposes warnings immediately, and discloses full original checks on demand. Never hide bad checks or imply test-mode evidence was verified.
- Character: a compact, expressive neighbourhood helper used during onboarding, empty states and earned celebrations. Motion answers input: a short nod, a pressed action, a successful stamp. Avoid endless ambient loops. Respect reduced motion globally and through MotionConfig.
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

Owner explicitly rejects bulky map cards, repeated floating banners, odd mascot fingers, excessive whitespace in desktop evidence, and primitive drawn demo photos with green in-image labels. Map should occupy most of the mobile screen, use actual geographic tile data, and offer real pedestrian routing with clear GPS/arrival states. A route is never a straight line passed off as a road path. Theme stays neutral black and white unless changed by the user. Demo images can be realistic generated examples but must be identified as simulated outside the image; captured evidence never loses its watermark or sample flag.
