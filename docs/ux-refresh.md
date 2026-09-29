# One gesture set, ratio lock, undo, better turning and saving

## Changes

- Draw new / Adjust are gone. Drag outside the crop to draw, inside to move,
  on a handle to resize. While the crop is the whole image the handles are
  hidden (there is nothing to adjust). Touch behaviour is unchanged: one finger
  crops, two fingers pinch and pan.
- Ratio select (Free, Original, 1:1, 4:3, 3:4, 3:2, 2:3, 16:9, 9:16). Choosing
  one fits the largest such rectangle inside the current crop, centred, and the
  lock applies to drawing, resizing and keyboard resizing. jpegtran only needs
  the raw top/left edges on block boundaries; far edges may be any pixel. The
  lock therefore snaps a candidate to the grid first and then holds the aligned
  corner, which makes the ratio exact and lets Save leave the crop untouched.
  Trade-off: resizing from the aligned corner can move the opposite corner by up
  to a block. Coordinates edited by hand set the ratio back to Free.
- Undo / Redo (buttons, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y). Entries hold the
  source file and crop, so turns undo too. Covers draw, move, resize, arrow keys
  (a burst within 0.7 s is one step), coordinate fields, ratio and Select whole
  image. Up to 60 steps; opening another file clears the history.
- Turning: the selection is mapped through the turn (after cutting any trimmed
  strip) instead of being reset; a locked ratio swaps (3:2 becomes 2:3). The
  native confirm dialog is replaced by an inline prompt (Turn anyway / Keep as
  is, Escape cancels) that appears only when a partial edge must be trimmed.
- Size readout: "165 KB · 89% smaller". A whole-image crop shows only its size,
  since a comparison there just reflects metadata stripping. The previous value
  stays on screen, dimmed, while a new one is measured.
- One Save crop button in the toolbar (the panel's duplicate is removed), with
  Cancel beside it. After saving, a line under the preview shows the file name,
  pixel size, file size, whether metadata was removed or kept, and an Open
  another button. It clears when the crop changes.
- The file picker still accepts JPEG only; no other formats are offered.

Not changed: the worker, jpegtran arguments, parsing, snapCrop, export
dimension checks, CSP. No dependency or engine rebuild.

## Validation

`node --test tests/*.test.js`: 39 tests passed, including new tests for aspect
parsing, exact ratios after block alignment in all eight EXIF orientations, the
aligned corner, mapping a crop through trimmed and untrimmed turns, the shorter
size text, and the single Save button.

Driven in headless Chrome against scripts/serve.py with a 1001 × 757 4:2:0 JPEG
(partial 16 px blocks) and the real WASM worker: no handles on the whole image;
draw, ratio 1:1 (403 × 403), handle resize and redraw with the lock held; undo,
redo and Ctrl+Z / Ctrl+Shift+Z; a right turn that prompted first ("5-pixel strip
from the bottom edge"), carried the crop to 0,592 400 × 409, undid and redid;
Save produced the post-save line. Portrait 390 × 844 and 320 × 640 and landscape
844 × 390: no overflow or clipped toolbar controls; the prompt is readable above
the bottom bar.

Not verified: the downloaded file was not opened or compared; touch was emulated
with synthetic events, not a physical phone; Safari and Firefox were not tried.
