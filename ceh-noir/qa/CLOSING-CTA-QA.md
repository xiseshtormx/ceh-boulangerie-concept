# Final CTA typography · 04.11.2026

Scope: existing closing section only. Its black background, white text, central composition, original responsive font sizes and outer spacing are retained. The whole heading remains a native menu/ anchor. No decorative UI or navigation interception was added.

Typography: Golos 600 for «Посмотреть», true Noto Serif Display Italic 500 for «всё меню.». The new 2,948-byte local font subset includes ё and all characters; original Hero font is unchanged. Slight negative tracking and a small static italic offset provide optical centering. On 1440×900 the original and new section heights both measure 470.59375 px; heading height remains 155.59375 px, font size 59.85 px, padding 150 / 165 px. At 390 px the heading remains 40 px; at 320 px it remains 36 px.

Reveal: separate ink/mask layers. First row reveals vertically with .24em travel over 760 ms. Second reveals left-to-right with −.12em / .08em travel over 820 ms after a 130 ms offset. Total 950 ms, once per document. Intersection ratio must reach .22. Font loading has an 800 ms fail-open bound. Finished effects are released. Keyboard, focus, reduced motion, hidden page, restored history and disposal settle the scene. No requestAnimationFrame loop or scroll listener.

Interaction: hover only for hover:hover and pointer:fine; first row translates −10 px, second +10 px using interruptible 460 ms transitions. Hover and reveal use different elements, so their transforms do not collide. Keyboard focus has a 1 px white outline and zero travel. Reduced motion disables transforms/complex masks. Touch relies on the native link; there is no touch hover handler. Press feedback is a subtle .985 scale and does not delay navigation.

Browser validation:
- Desktop 1440×900: both lines, complete Cyrillic italic, unchanged geometry, exact computed #000 / #FFF, native hover with matrices −10 / +10 and .46 s duration, return to base, visible focus with no translation.
- Control-click opened menu/ in a new tab; original page stayed put. Enter opened the real menu page. Normal click at 390 px opened the same menu page. Temporary test tab was closed.
- 390×844 and 320×720: full text, no overflow; the 320 px link bounds were x32.015625–272.96875, with 93.59375 px height. Browser emulation only, not a physical phone test. Touch hover prevention is covered by the media gate; reduced-motion cancellation is covered by controller tests.
- No warnings/errors in the checked page. Final build, 80 tests and git diff --check pass. All 20 unrelated scope files, including app.js, styles.css, Hero, header, About, food, coffee, catalog and dependency files retain pre-change hashes. Built CTA files/font match source.

Artifacts: closing-cta-desktop.jpg, closing-cta-mobile.jpg, closing-cta-320.jpg, closing-cta-focus.jpg. Preview: http://localhost:4322/#full-menu .
