# Mobile layout, touch zoom and crop auto-zoom

## Changes

- Portrait phones (≤ 820px wide): the toolbar header row has a fixed height.
  Once an image is loaded, the output-size readout replaces the brand beside
  Save (up to two lines) instead of adding a third toolbar row. The preview no
  longer shrinks when the first size estimate arrives. The "Zoom" text label is
  hidden; the selects keep their accessible names. Undo/Redo, ratio and zoom are
  36px tall.
- Portrait phones: the controls panel starts collapsed and opens as a bar
  docked below the image (at most 45% of the viewport height, scrollable), so
  the crop stays visible and usable with the controls open. No scrim is shown.
  The toggle icon is rotated so its rail sits at the bottom, matching the bar.
- Landscape phones (≤ 540px tall with a coarse pointer): the panel starts
  collapsed and opens as a left overlay drawer, instead of a fixed sidebar
  taking about a third of the width; a bottom bar would leave too little image
  height. The toolbar is one compact row, and the icon keeps its left rail.
- Crossing the phone breakpoint after load (rotation, window resize, DevTools
  device mode) collapses the panel on entering the phone layout and reopens
  the sidebar on leaving it.
- Touch gestures (preview.js): two fingers pinch-zoom and pan around their
  midpoint. One finger pans when it starts in the margin around the image, or
  when it remains after a pinch. One finger on the image still draws, moves or
  resizes the crop. A second finger cancels a crop drag started by the first
  and restores the previous crop without a status message. The loaded
  workspace uses `touch-action: none`, so the page itself does not pinch-zoom.
- Touching the image no longer moves focus to the stage or a handle. Mouse and
  keyboard focus behaviour is unchanged.
- Auto-zoom: 0.7 seconds after a new crop is drawn (not after moving or
  resizing), if the crop fills less than 45% of the view in its larger
  dimension, the preview eases (320 ms; instant with reduced motion) to a zoom
  where it fills about 65%, centred where scrolling allows. It only zooms in, is
  capped at 400%, and skips steps smaller than 1.2×. Any pointer press, wheel
  input, zoom change, Select whole image, new file or busy state cancels a
  pending auto-zoom. Select whole image now also returns the preview to Fit.
- Crop cancellation (Escape, pinch) only reapplies the previous crop if the
  drag had changed it, avoiding a redundant size re-estimate.

Zoom and pan change only the preview size and scroll position. Crop
coordinates, JPEG bytes, the worker, parsing, geometry and export are unchanged.
No dependency, engine rebuild or hosting change is involved.

## Validation

`node --test tests/*.test.js`: 30 tests passed, including new tests for pinch
scale limits and the auto-zoom target, threshold, margin and 400% cap.

The served app (scripts/serve.py, real CSP and worker) was driven in headless
Chrome over the DevTools protocol with a 3840 × 2160 progressive JPEG:

- 390 × 844 and 320 × 640 touch-emulated portrait: no horizontal overflow;
  toolbar height constant (101px) before and after the size estimate; size
  readout shown beside Save; auto-zoom from Fit to about 30% after a drawn
  crop; two-finger pinch and pan; a first-finger draw interrupted by a second
  finger restored the previous crop exactly.
- 390 × 844 with the panel open: bottom bar 380px tall below the image, no
  page overflow, and drawing a crop still works above it.
- 844 × 390 and 667 × 375 touch-emulated landscape: panel starts collapsed,
  opens as a drawer, single toolbar row with no clipped labels.
- Loading at 1366px, then switching to 430 × 932 and back: panel collapsed,
  then reopened.
- 1366 × 800 mouse: unchanged desktop layout; auto-zoom after drawing; no
  auto-zoom after a handle resize; a wheel event during the delay cancels it;
  Select whole image returns to Fit.

Touch was emulated with synthetic CDP touch events. This has not been tested
on a physical phone or in Safari/Firefox, and dark theme only (the host's
colour scheme) was captured; no colours were changed.
