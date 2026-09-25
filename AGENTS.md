# Project constraints

- Plain HTML, CSS, and native JavaScript modules. No UI framework, CSS framework,
  package dependency, or bundler unless the owner explicitly requests it.
- Preserve the monochrome paper/ink styling, system fonts, thin rules, and square
  controls. Avoid gradients, decorative shadows, cards, pills, and marketing UI.
- Use the SVG optimizer's compact settings-panel styling: 19rem desktop width,
  paper-2 background, normal-case system-font headings, 32px square controls,
  thin section rules, and a collapsible panel. Do not add hero/marketing copy
  above the workspace. Keep empty-state instructions inside the image drop area.
- No uploads, analytics, external fonts, CDNs, URL import, or image persistence.
- JPEG export must transform coefficients with source-built jpegtran. Never use
  canvas.toBlob(), canvas.toDataURL(), or another pixel encoder as a fallback.
- Cropping is not secure redaction. Metadata and partial edge blocks matter.
- Never import the unlicensed demonstration application's source or its binaries.
- Keep dependency provenance and test limitations explicit. Do not claim an
  engine build or end-to-end test passed unless it actually ran.
- Run `node --test tests/*.test.js` after changing parsing or crop geometry.
