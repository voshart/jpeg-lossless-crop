# Compact workspace and optimizer-style panel

## Changes

- Removed the page-level promotional heading, introduction, outer page gutters,
  and promotional footer line. The empty image area contains only "Drop a JPEG
  here" and an Open JPEG button. That button uses the same native file input as
  the sidebar, and is disabled during file loading/processing.
- Matched the shared SVG optimizer settings-panel contract: 19rem desktop width,
  1rem padding, paper-2 surface, 3.25rem sticky header, normal-case 0.8rem section
  headings, 32px square controls, thin top rules, and a collapse toggle. No SVG
  editor logic, storage, or dependencies were imported.
- The workspace uses the available viewport instead of reserving room for a
  landing-page heading. The preview now fits its actual container height/width,
  including after panel collapse, viewport resizing, and expanding Controls help.
- On narrow screens the panel becomes a scrollable top section, capped at 46svh,
  as in the SVG optimizer. Collapsing it gives the image workspace the viewport.
- Status and errors remain in the workspace when the panel is hidden. Detailed
  instructions and coefficient/metadata cautions remain under disclosures.
- Existing snap preview, crop handles, keyboard controls, worker, metadata
  processing, JPEG parsing, and coefficient geometry are retained. No new
  dependency or engine rebuild is required.

## Verification

`node --test tests/*.test.js`: 17 tests passed, including two new layout-contract
checks for unique IDs, preserved controls, minimal drop copy, and retained safety
help. The original parsing/geometry/interaction files and tests were verified
against their Git blob hashes before testing.

Chromium checks passed for desktop empty/loaded layouts; light/dark themes;
320/390/820/821px widths; both native file pickers; panel collapse/expansion and
keyboard focus; no horizontal overflow; fitted landscape/portrait previews;
all eight EXIF orientations; snapping, drawing, moving, resizing and keyboard
nudging; unchanged crop coordinates after panel reflow; help expansion; and
visible invalid-input errors with the panel hidden. No page errors occurred.

Local HTTP navigation is blocked in the test environment. Browser checks used
the actual module bodies in an in-memory document, not HTTP module delivery.
Production response CSP and actual WASM export were not retested. The compiled
engine and worker are not changed by this update.
