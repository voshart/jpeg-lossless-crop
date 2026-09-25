# JPEG / Lossless crop

A browser tool for cropping and turning JPEGs without recompressing the
retained image data.
It uses plain HTML, CSS, JavaScript modules, and a source-built `jpegtran` WASM
engine. Images are opened from your device and processed in the browser; the
app has no upload endpoint, analytics, external fonts, or CDN dependencies.

> **Validation status:** The interface and unit tests are in place, but JPEG
> export has not been verified end to end. See [TESTING.md](TESTING.md) before
> relying on the output for important images.

## Use

Open a JPEG, then drag on the preview or enter X, Y, width, and height. The
placement crosshair snaps to the JPEG block grid. Drag toward the free-edge
corner to refine the far corner by pixels; on an unrotated image, that is the
lower-right corner. EXIF orientation can change which displayed corner is free.
The overlay and fields show the resulting crop area. Orange stripes mark source
pixels that may still be recoverable from the saved JPEG. Keep private information
out of this area. The Turn left and Turn right buttons rotate the source before
cropping and reset the selection. If
turning requires removing a thin edge strip, the app asks before doing so. Save
downloads a new JPEG.

The app accepts 8-bit baseline, extended sequential, and progressive DCT JPEGs,
including grayscale and EXIF orientations 1–8. The limit is 50 MiB and 100
megapixels. Invalid or unsupported files fail explicitly.

By default, export keeps the ICC colour profile and discards other extra
metadata. An option to retain original metadata may also retain GPS data or an
uncropped thumbnail. **Cropping is not secure redaction:** metadata and partial
edge blocks can retain sensitive information.

## How it works

A Web Worker runs `jpegtran -crop` or `jpegtran -rotate` on JPEG coefficients.
There is no Canvas encoder, quality setting, or lossy export fallback. Each operation gets a
fresh worker with cancellation and a 60-second timeout. A perfect turn preserves
all image blocks; an approved edge trim discards the affected strip without
recompressing the remaining blocks.

The engine is built from libjpeg-turbo 3.2.0 source by
[`scripts/build-wasm.sh`](scripts/build-wasm.sh). The script verifies the
upstream source archive against SHA-256:

```text
6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e
```

The committed [`web/vendor/`](web/vendor/) directory contains the generated
JavaScript and WASM, upstream licence notices, and `build-info.json` with
compiler and output hashes. The toolchain is not pinned, so this is source
provenance, not a claim of reproducible builds or a security certification.
The project does not use code or binaries from the unlicensed demonstration app.

## Development

Serve `web/` locally with:

```bash
python3 scripts/serve.py
```

The local server sends the same security headers as the Cloudflare Pages
[`web/_headers`](web/_headers) file. Run the dependency-free unit tests with
Node 22 or newer:

```bash
node --test tests/*.test.js
```

To rebuild the engine, install Emscripten, CMake, a C compiler, curl, and
Python 3, then run `bash scripts/build-wasm.sh`. Review the generated notices,
manifest, and [test limitations](TESTING.md) before publishing a new build.

For Cloudflare Pages Git integration, use `main` as the production branch, no
framework or build command, and `web` as the build output directory.

## Licensing

A project-wide licence has not been selected. The generated libjpeg-turbo and
Emscripten components retain their upstream terms and notices in `web/vendor/`.
