# Hero typography · 30.10.2026

Default B: existing Golos at 780 instead of 900; second line uses real Noto Serif Display Italic 500. A keeps both rows in Golos 780. C uses Roboto Flex with its actual slnt axis at −8 on the second row. No browser-generated italic. Font binaries and OFL licenses are local; Roboto Flex is requested only for C.

The comparison at `/qa/hero-typography.html` uses generated copies of the real homepage, one fixed salmon photograph, and identical geometry. Controls replay the entrance, slow it to 0.25×, or pause at 650 ms. The production homepage has no review controls. Direct production candidates: `/?hero-type=a`, `/?hero-type=b`, `/?hero-type=c`.

Assembly waits for fonts. Individual glyph masks reveal the first row with 36 ms staggering, then the second row with a softer diagonal drift and 32 ms staggering. Both overlap; the complete sequence lasts 1382 ms. Finished WAAPI effects are cancelled and the final typography is static. A slow/failed font load fails open. Keyboard input, reduced motion, history restoration and leaving the first screen cancel the entrance. The h1 retains its one accessible name; visual glyphs are hidden from assistive technology.

The optional text-only scroll drift is bounded to −12 / +10 px across the hero. It reverses from the current position, pauses offscreen/hidden and stops scheduling frames when settled. No global scroll changes.

Validated in the browser at 1440 × 900, 390 × 844 and 320 × 720. No horizontal overflow. At 1440 × 900, title remains x92.625 / y358.375 / 515.78125 × 162.4375 px and product remains x633.1875 / y184 / 699.1875 × 575 px: identical to the pre-change geometry. The live photo selector, its decode/entrance controller, reflection and header were preserved. Font metadata confirms Noto's italic flag and Flex's designed slnt axis. Reduced-motion and lifecycle coverage also runs in controller tests; mobile checks are browser emulation, not physical-device tests.

Reference: https://lunecroissanterie.com/ — inspected its live hero, product/negative-space balance and restrained two-row treatment. The two-face composition and letter assembly here are original to this implementation.

Artifacts: `hero-type-desktop.jpg`, `hero-type-mobile.jpg`, `hero-type-assembly-650ms.jpg`.

Final validation: 65 tests pass; production build and `git diff --check` pass. Twelve scope files, including hero.js, header CSS/JS, About, coffee, app.js and styles.css, retain their pre-change SHA-256 hashes. Built typography files match their sources.
