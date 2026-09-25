# Validation status

## Completed for the starter

- Passing Node test cases: JPEG sampling factors, baseline/progressive
  headers, all EXIF orientations, 32-bit TIFF offset bounds, minimal orientation
  metadata, invalid input handling, transform inverses, and crop snapping.
- Bash syntax check of `scripts/build-wasm.sh`.
- Python syntax check of `scripts/serve.py`.
- Chromium in-memory UI smoke checks with real generated JPEG fixtures:
  orientations 1–8 load, drag selection aligns to blocks, light/dark styles
  render, and the 390px mobile layout has no horizontal overflow.

The browser checks used an in-memory HTML/CSS/JS harness because this execution
environment blocked local HTTP navigation. They did not exercise the production
CSP, module loading over HTTP, the worker, downloads, or an actual JPEG crop.

## Not yet verified

Source-built WASM files and their build manifest are now included for hosting.
Their recorded hashes match the local files, but this session has not rebuilt
them or verified an actual JPEG export. The engine adapter remains unverified
end to end.

Before declaring this ready for production:

1. Build the engine in WSL. Confirm the manifest records the expected source hash.
2. Serve the real site and inspect the console/CSP and Network panels, including
   the worker. Try an external request from both contexts and confirm it is blocked.
3. Crop real baseline/progressive, grayscale, 4:4:4, 4:2:2, 4:2:0, and orientation
   1–8 JPEGs. Test partial edge blocks and mirrored orientations on non-square images.
4. Compare retained DCT coefficients with an independently built native jpegtran
   result. Whole-file hashes and decoded pixel comparisons alone are not a proof
   of coefficient preservation (headers and boundary upsampling may differ).
5. Check default output for removed GPS, comments, XMP, and thumbnails, and correct
   ICC/orientation handling. Check the explicit metadata-preservation option.
6. Verify cancel, timeouts, repeated crops, invalid files, worker-load failure,
   browser download behaviour, keyboard controls, and deployed subdirectory paths.

No spyware-free certification, dependency audit, fuzzing campaign, or exhaustive
binary analysis is claimed by these tests.
