# Food scenes QA · 04.11.2026

Approved direction: three product scenes, alternating photo right / left / right; normalized visible plate scale; one restrained entrance and a small scroll drift; short flavor crossfades.

## Implementation

- Scoped `food-scenes.css`, `food-scenes.js` and `food-media.js`. Integration replaces only the old food-switch handler in app.js and the food markup/style include in compose-pages.mjs. Original styles.css, presentation data, catalog, header, Hero, About and coffee controllers are unchanged.
- Syrniki canvas is presented at 1.27× on desktop and 1.22× on mobile. Photography retains its original canvas and alpha. Pasta now sits right; copy stays left. Photo pose, arrival, parallax and crossfade live on separate wrappers.
- Heading reveal follows the dish by 90 ms; description and controls follow. Longest entrance is 800 ms. Observer requires at least 18% section visibility so a fringe intersection cannot consume the entrance early.
- Scroll drift is bounded to ±12 px desktop / ±5 px mobile, reverses from the current pose and stops RAF when settled, offscreen or hidden. Keyboard/reduced motion settle effects. History restoration settles without replay.
- Two image layers crossfade over 220–240 ms. Decode completes before replacement. The latest request owns photo, alt text, selected state and detail ID. A failed image restores the current selection; interrupted fades finish to one visible/accessible image. Detail dialogs retain their existing actions.

## Responsive photography

Ten original PNGs (38,798,414 bytes / 37.00 MiB) remain unchanged. Twenty responsive WebPs use the same aspect and alpha: 800 px variants total 1,075,094 bytes / 1.03 MiB; desktop variants total 2,655,358 bytes / 2.53 MiB. The desktop set is 93.2% lighter than its originals. Only needed images are requested; neighboring flavor is warmed near view unless Save Data is enabled. Sources, dimensions and original SHA-256 are in assets/dishes/food-web/manifest.json.

Reproduce with scripts/prepare-food-web.mjs using installed sharp, or point SHARP_MODULE_PATH at the external sharp module. No project package/dependency changes were made.

## Verification

- Desktop 1440×900: all three compositions, porridge flavor and matching detail dialog, rapid syrniki selections, keyboard Enter for Carbonara, one final accessible photo, settled RAF telemetry.
- Mobile 390×844 and 320×720: vertical layout, visible photo scale, flavors, correct 800 px source selection, no horizontal overflow. All ten variant controls have 44 px height and stay within viewport. Browser emulation only; no physical phone test.
- 75 tests pass, including 9 lifecycle/race/motion tests and responsive asset validation. Tests cover failed/stale decode, interrupted fades, reduced motion/keyboard, offscreen/hidden/disposal, truthful srcset dimensions and source provenance.
- Build and git diff --check pass. Built food files match source. Thirteen unrelated scope files retain pre-change hashes. No console warning/error in the checked local page.

Screenshots: food-syrniki-desktop.jpg, food-pasta-desktop.jpg, food-syrniki-mobile.jpg, food-porridge-desktop.jpg. Local preview: http://localhost:4322/#porridge . No publication or push performed.
