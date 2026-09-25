# JPEG / Lossless crop

A small browser tool for cropping JPEGs without recompressing their image data.
Plain HTML, CSS, and JavaScript modules. No framework, bundler, runtime npm
dependencies, CDN, image upload, analytics, or external fonts.

**Starter status:** the interface, header parser, crop geometry, and worker
adapter are implemented. The JPEG engine is deliberately not bundled. Build it
from the pinned upstream source before exporting. The WASM build and actual
JPEG export have not yet been verified end to end; see `TESTING.md`.

## Run the interface in WSL

```bash
git clone https://github.com/voshart/jpeg-lossless-crop.git
cd jpeg-lossless-crop
# For the initial draft PR:
git switch starter/vanilla-crop
code .
python3 scripts/serve.py
```

Open `http://127.0.0.1:8000` in your Windows browser. The server binds only to
loopback and serves `web/`, not the repository or build directories. Node is
not needed to use the interface. Stop the server with Ctrl+C.

You can open a JPEG, preview it, and adjust a selection before building the
engine. Saving before the build produces an explicit error, not a recompressed
image. There is no installation command for the front end.

## Build the JPEG engine

On Ubuntu/Debian WSL, install the compiler and build tools using your distro's
packages (or use an existing official Emscripten SDK installation):

```bash
sudo apt update
sudo apt install emscripten cmake build-essential curl python3
bash scripts/build-wasm.sh
python3 scripts/serve.py
```

The build script downloads **libjpeg-turbo 3.2.0 source**, checks the archive's
SHA-256, builds its static library, and compiles the upstream `jpegtran` CLI to
an ES module plus WASM. It does not use the demonstration application's code or
precompiled binaries. It writes the following files into `web/vendor/`:

- `jpegtran.js` and `jpegtran.wasm`
- upstream licence notices
- `build-info.json` containing compiler information and output hashes

The pinned source archive hash is:

```text
6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e
```

Source and archive digest: the asset metadata for the
[official 3.2.0 release](https://github.com/libjpeg-turbo/libjpeg-turbo/releases/tag/3.2.0).
The toolchain is **not** pinned yet. This provides source provenance, not a
claim of bit-for-bit reproducible builds or a security certification. Record
and test your compiler version before publishing a production build.

## Behaviour

Open one local JPEG. Drag on the image to draw a crop, or enter X, Y, width,
and height. The fields describe the displayed orientation. The selection
expands outward to JPEG block boundaries and is clipped to the source edges;
the overlay and fields show the resulting area, not an unsnapped approximation.

The worker invokes `jpegtran -crop` on the original bytes. There is no Canvas
encoder, quality setting, or lossy fallback. A fresh worker processes each crop,
with cancellation and a 60-second timeout, then releases the engine and memory.

The initial parser accepts 8-bit baseline/extended-sequential/progressive DCT
JPEGs, including grayscale and EXIF orientations 1–8. Files are limited to
50 MiB and 100 megapixels. Malformed or unsupported inputs fail explicitly.
The browser must agree with the parsed display dimensions for a file to load.

By default, `-copy icc` keeps the colour profile while discarding other extra
markers. A minimal new EXIF orientation field is added when necessary. Keeping
original metadata is an explicit option and can retain GPS or an uncropped
thumbnail. Cropping is **not secure redaction**: retained edge blocks and
metadata deserve special care for sensitive images.

## Files

```text
web/index.html           Semantic interface
web/style.css            Monochrome tokens, square controls, responsive layout
web/src/app.js           File input, preview, selection, downloads
web/src/jpeg.js          Bounded JPEG/EXIF header parsing
web/src/geometry.js      Orientation transforms and block-aligned selection
web/src/jpeg-worker.js   Source-built jpegtran adapter; no fallback
scripts/build-wasm.sh    Pinned-source engine build
scripts/serve.py         Local static server with security headers
```

Run the dependency-free unit tests with Node 22 or newer:

```bash
node --test tests/*.test.js
```

## Styling and deployment

The interface uses system sans-serif and monospace fonts, paper/ink colour
tokens, thin dividers, square buttons, and automatic light/dark themes. Edit
`web/style.css` directly. Project constraints are recorded in `AGENTS.md`.

No hosting, GitHub Pages, or Actions workflow has been enabled. Deploy only
`web/` after building and testing the engine. Include the generated notices and
manifest. Configure the production host to send the same security headers as
`scripts/serve.py`, including on worker scripts: a document's meta CSP alone is
not a substitute for a worker's response CSP. `connect-src 'self'` is a useful
restriction, not an absolute guarantee of no network activity.

## Licensing

A project-wide licence has not been selected for this starter. The generated
libjpeg-turbo/Emscripten components retain their upstream terms and notices;
review those before redistribution. No licence from the unlicensed demo is
being assumed or inherited.
