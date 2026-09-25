# Workspace save and simple zoom

## Changes

- Save crop is available in the workspace toolbar with the sidebar open or
  closed. It calls the same save function as the sidebar button, including
  coordinate validation, the current metadata setting, and the existing worker.
- Both save buttons are disabled without an image and while processing.
  Cancel is also available in the toolbar while a crop is running.
- One native Zoom selector offers Fit, 100%, 200%, and 400%. At 100%, one image
  pixel occupies one CSS pixel (not necessarily one physical display pixel).
  Fit respects both workspace dimensions and does not enlarge small images.
- Oversized previews use native scrolling. Zoom changes start at the top-left;
  Fit returns the whole image to view. Loading a new image resets to Fit.
  There is no custom wheel/pinch gesture, drag-to-pan mode, or zoom dependency.
- Zoom only resizes the existing image element and overlays. Crop coordinates,
  original JPEG bytes, output dimensions and metadata choices are unchanged.
  Existing pointer conversion uses the stage's current bounding rectangle, so
  drawing and adjustment continue to work after zooming and scrolling.
- The preview's surrounding padding keeps edge handles inside the scrollable
  area. The toolbar remains outside that area, including on narrow screens.

No worker, parser, coefficient geometry, snap-interaction implementation,
compiler script, generated engine, dependencies, or hosting settings changed.
No Emscripten rebuild is needed. Keep the compiled files in web/vendor/.

## Validation

`node --test tests/*.test.js`: 21 tests passed (the previous 17 plus four tests
for Fit sizing, fixed zoom, temporary zero-sized viewports, and toolbar wiring).
Existing runtime files and tests were checked against their source Git blob
hashes before editing/testing.

In-memory Chromium UI checks passed for:

- Disabled controls before loading, open/closed sidebar, and toolbar visibility.
- Fit and all fixed zoom sizes, both scroll axes, reachable image edges, and no
  page-width overflow at 320, 390, 820, 821 and 1366 pixels.
- Unchanged crop coordinates through zoom; zoomed/scrolled drawing, moving,
  resizing and keyboard nudging; portrait previews; EXIF orientations 1-8.
- New-image Fit reset and fixed zoom retained through sidebar reflow.
- Toolbar save passing original input bytes, the selected crop and metadata
  choice; shared busy state; cancellation; invalid hidden coordinate fields;
  worker-error recovery; and a download callback, using a mock worker.

Local HTTP browser navigation is blocked in the test environment. Browser tests
used the actual module bodies in an in-memory document. The worker was mocked
for save-path tests: this is not a real JPEG export test. Production HTTP/CSP,
module delivery, and WASM coefficient export were not rerun. The existing
source-built engine is unchanged.
