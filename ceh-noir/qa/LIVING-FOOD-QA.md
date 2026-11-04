# Living Food Showcase · 04.11.2026

Replaces the independent food entrances documented in FOOD-QA.md. Scope: the food region and its presentation only.

## One scene

The document contains one food-stage sticky viewport inside one expanded root. Three semantic chapter layers share one deterministic clock; they are not three independent scroll animations. Desktop range is 410svh including the viewport; compact range is 370svh. The stage uses actual svh height to calculate progress, preserving the same composition across responsive mode changes. Native wheel/touch scrolling remains untouched.

Porridge enters from the right, syrniki from the lower left, pasta from the upper right. Product arrival resolves before the heading reveal; description is masked by semantic lines and flavor options cascade. Each chapter has a real reading plateau. Outgoing copy clears before the next heading, and at most two products cross during the handoff. The final pasta holds while the sticky viewport naturally releases. Layers are transparent over one #000 root, preventing black chapter backgrounds from obscuring the overlap. Type remains #FFF; no lines, cards, arrows, counters or new visible copy.

A pure sampled model in food-showcase-model.js makes reverse seeking exact. Scroll interpolation uses approximately 140 ms desktop / 75 ms compact catch-up. Rendering stops at rest, offscreen, while hidden and after disposal. No timed entrance replay or ambient loop.

## Interaction and accessibility

Flavor selection remains independent of the scroll transform. Decode-before-swap, stale request checks, interrupted crossfades, selected states and matching detail IDs are retained. Primary images warm one viewport before the scene; nearby flavors warm unless Save Data is enabled. All originals/derived assets remain unchanged.

Only the current chapter is semantic/interactive. Its first existing flavor is a keyboard entry point that resolves synchronously to the reading pose. Tab from a chapter's final action reaches the next chapter; Shift+Tab from its first option reaches the previous. The last chapter exits to normal page tab order. This is a local focus accommodation, not a global scroll handler. Focus transfers before an outgoing layer becomes inert. Keyboard changes seek immediately without scrub lag.

Reduced motion and viewports shorter than 640 px use readable document flow: all three chapters/controls available, no long sticky range or scene motion. Without JavaScript, the same document layout is the fallback. On compact screens, text is above a stable lower product slot, travel is reduced and controls keep 44 px targets.

## Validation

- Desktop 1440×900: all three reading poses, reverse porridge↔syrniki change, shared sticky top0, flavor selection and correct dialog, native keyboard next-chapter seeking, direct chapter hash restoration.
- Verified an intermediate handoff at progress about .338 with both primary images decoded and both transparent chapter layers visible. Product opacities were approximately .16 / .56; outgoing text was cleared. This caught and corrected a masking problem from inherited section backgrounds.
- 390×844 and 320×720: compact mode, text/photo separation, no horizontal overflow, current flavor/detail ID and 44 px flavor targets. Responsive resize kept pasta at progress about .8627 instead of changing categories.
- 1440×600: static fallback, all three chapters exposed, stage position relative. Reduced-motion switching also covered by controller tests. Phone checks are browser emulation, not physical-device testing.
- 83 tests pass: previous independent entrance tests were replaced by deterministic scene, overlap, reading plateau, reverse, compact amplitude, focus/tab, restoration, idle/hidden/disposal tests. Flavor races/failure rollback and responsive image provenance tests still pass.
- Build and git diff --check pass. Nineteen unrelated scope files retain their pre-change hashes, including app.js, global styles, Hero, header, About, coffee, CTA, data and dependency files. Built showcase files match source. No errors/warnings in the checked page.

Frames: living-food-porridge-desktop.jpg, living-food-syrniki-desktop.jpg, living-food-pasta-desktop.jpg, living-food-transition.jpg, living-food-syrniki-mobile.jpg, living-food-320.jpg.

Preview: http://localhost:4322/#porridge . Scroll down through the three compositions, or up to inspect the initial assembly.
