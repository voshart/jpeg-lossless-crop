# Crop interaction update

## Controls

- **Draw new:** hover shows the nearest block-aligned intersection and its X/Y
  coordinates before pressing. Dragging uses that same start point and snaps the
  other corner continuously. Release switches to Adjust. A click without a drag
  keeps the previous crop. Dragging outside a crop in Adjust also draws a new one.
- **Adjust:** drag inside to move without changing dimensions; use the eight edge
  and corner handles to resize. The opposite edges remain fixed.
- Focus the workspace and use arrow keys to move one JPEG block at a time. Focus
  a handle and use arrow keys to resize that edge/corner by one available grid
  step. Shift uses ten steps. Escape, pointer cancellation, or lost capture
  restores the crop from before the drag.
- The coordinate inputs still expand outwards to block boundaries. The pointer
  interface deliberately chooses nearest boundaries instead. Neither changes
  jpegtran or permits a lossy fallback.

Snapping uses the original JPEG's sampling and EXIF transform. Mirrored/rotated
images with partial edge blocks may have a display grid that does not start at
zero. The crosshair and exported selection use the same transformed boundaries.
These boundaries describe this app's block-aligned crop model, not every crop
rectangle that the underlying jpegtran command could represent.

When a crop includes a partial source-edge block, moving along that axis is
locked to preserve its dimensions and the existing outward-aligned model. Resize
that edge onto a full block first. The other axis can still move. Moving a crop
must never silently grow or shrink it.

## Scope

Only HTML, CSS, JavaScript interaction code, tests, and this note changed. No
worker, parser, coefficient-crop implementation, metadata logic, generated WASM,
compiler script, hosting settings, or dependency changes. No engine rebuild is
needed for this update. Keep using the locally built files under web/vendor/.

The owner reported a successful local Emscripten build and working JPEG export
on 2026-09-25. That is user-reported validation, not an independent engine audit.

## Validation

`node --test tests/*.test.js`: 15 tests passed (the existing eight plus seven new
interaction tests). Coverage includes nearest boundaries, partial source edges,
all EXIF orientations, asymmetric sampling grids, draw directions, fixed opposite
edges during resizing, size-preserving movement, and output-snap idempotence.

Chromium in-memory checks with actual JPEG fixtures passed: pre-click preview,
drawing, moving, resizing, keyboard nudging, Escape rollback, no-op clicks,
EXIF orientations 1-8, 390px dark layout without horizontal overflow, and real
Chromium touch-event dragging/cancellation. No page errors were recorded.

This environment blocks local HTTP browser navigation. Those UI checks therefore
used the actual module bodies together in an in-memory test document, not real
HTTP module delivery. Production response CSP, HTTP module loading, and actual
WASM export were not rerun. Check those paths in WSL after pulling the update.

## Keeping the compiled engine

Generated files in web/vendor/ are currently ignored by Git. Back up that whole
directory (including the notices and build-info.json) before removing build tools.
Do not delete it or use git clean -fdx as part of compiler cleanup. The project
.build/ directory and the separately installed jpeg-crop-emsdk directory are not
runtime dependencies. A future engine update will require a build toolchain again.
