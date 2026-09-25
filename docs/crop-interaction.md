# Crop interaction

## JPEG boundary model

The crop origin in raw JPEG coordinates stays on the source iMCU grid. The raw
right and bottom boundaries can end on any pixel because the JPEG frame size can
stop inside the final encoded block. The remaining data in those edge blocks is
still present. This is a valid standalone JPEG, not an SVG or masked preview.

EXIF orientation can move the constrained raw top/left boundaries to any pair
of displayed sides. Coordinate inputs and pointer controls convert through raw
coordinates so the selected overlay matches the output dimensions.

## Controls

- The placement crosshair snaps to the nearest JPEG grid intersection. A draw
  toward the raw lower-right refines its far corner by pixels; other draw
  directions keep both endpoints on the grid. EXIF orientation can move that
  fine-drag corner to another displayed corner.
- Resize handles keep their opposite edges fixed. A handle on a free side moves
  by pixels; a handle on a constrained side snaps to the nearest iMCU boundary.
- Moving a crop translates its raw origin in whole iMCU steps without changing
  its dimensions. A crop with a partial final block can still move.
- Arrow keys move the selected crop by one iMCU step. A focused handle moves its
  edge by one block or one pixel according to that edge. Shift uses ten steps.
  Escape, pointer cancellation, or lost capture restores the previous crop.

A small orange overlay shows source pixels that remain represented by partial
final iMCUs outside the visible crop. It appears only where the chosen free edge
cuts through an iMCU; source-edge padding is not highlighted. The overlay is
visual guidance, not part of the downloaded JPEG.

The worker still passes original JPEG bytes to source-built `jpegtran -crop` and
checks the output dimensions. No pixel encoder or fallback is used.

## Validation

The geometry and interaction tests cover all eight EXIF orientations, exact free
edges, alignment of constrained edges, drag direction, resize and move bounds,
and output-snap idempotence. A direct run of the committed WASM engine cropped
libjpeg-turbo's 227 × 149 `testorig.jpg` to 53 × 37 pixels at raw offset 16,16.
The engine returned status 0 and the output header reported those exact
requested dimensions. Browser export and independent coefficient comparison
remain to be verified; see `TESTING.md`.
