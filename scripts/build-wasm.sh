#!/usr/bin/env bash
# Compile upstream source; do not download a third-party jpegtran.wasm.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=3.2.0
SOURCE_SHA256=6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e
URL="https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/$VERSION/libjpeg-turbo-$VERSION.tar.gz"
WORK="$ROOT/.build"
SRC="$WORK/libjpeg-turbo-$VERSION"
BUILD="$WORK/wasm"
OUT="$ROOT/web/vendor"
for cmd in curl tar sha256sum cmake emcmake emcc python3; do
  command -v "$cmd" >/dev/null || { printf 'Missing %s. See README.md for WSL setup.\n' "$cmd" >&2; exit 1; }
done
mkdir -p "$WORK" "$OUT"
ARCHIVE="$WORK/libjpeg-turbo-$VERSION.tar.gz"
if [[ ! -f "$ARCHIVE" ]]; then
  curl --fail --location --proto '=https' --tlsv1.2 "$URL" -o "$ARCHIVE.part"
  mv "$ARCHIVE.part" "$ARCHIVE"
fi
printf '%s  %s\n' "$SOURCE_SHA256" "$ARCHIVE" | sha256sum --check --status || {
  printf 'Source checksum mismatch; refusing to compile. Remove the archive and investigate.\n' >&2; exit 1;
}
# Re-extract every build so an edited source directory is not trusted implicitly.
rm -rf "$SRC" "$BUILD"
tar -xzf "$ARCHIVE" -C "$WORK"
emcmake cmake -S "$SRC" -B "$BUILD" \
  -DCMAKE_BUILD_TYPE=Release -DWITH_SIMD=OFF -DWITH_TURBOJPEG=OFF \
  -DENABLE_SHARED=OFF -DENABLE_STATIC=ON -DWITH_TESTS=OFF -DWITH_TOOLS=OFF \
  -DWITH_JAVA=OFF -DWITH_FUZZ=OFF
cmake --build "$BUILD" --target jpeg-static --parallel "${JOBS:-2}"
# jpegtran's own CLI, linked against the just-built library. -g2 keeps the glue
# readable for inspection; this is not a downloaded/minified mystery binary.
emcc -O2 -g2 \
  -I"$BUILD" -I"$SRC/src" \
  "$SRC/src/jpegtran.c" "$SRC/src/cdjpeg.c" "$SRC/src/rdswitch.c" "$SRC/src/transupp.c" \
  "$BUILD/libjpeg.a" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createJpegtran \
  -sENVIRONMENT=worker -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=536870912 \
  -sSTACK_SIZE=1048576 -sFORCE_FILESYSTEM=1 -sDYNAMIC_EXECUTION=0 \
  '-sEXPORTED_FUNCTIONS=["_main"]' '-sEXPORTED_RUNTIME_METHODS=["FS","callMain"]' \
  -o "$BUILD/jpegtran.js"
# Install the JS/WASM pair only after compilation succeeded.
cp "$BUILD/jpegtran.js" "$BUILD/jpegtran.wasm" "$OUT/"
cp "$SRC/LICENSE.md" "$OUT/libjpeg-turbo-LICENSE.txt"
cp "$SRC/README.ijg" "$OUT/libjpeg-turbo-README.ijg.txt"
python3 - "$OUT" "$VERSION" "$SOURCE_SHA256" <<'PY'
import hashlib, json, pathlib, subprocess, sys
out = pathlib.Path(sys.argv[1])
manifest = {
    'upstream': 'libjpeg-turbo', 'version': sys.argv[2],
    'source_sha256': sys.argv[3],
    'compiler': subprocess.check_output(['emcc', '--version'], text=True).splitlines()[0],
    'files': {p: hashlib.sha256((out / p).read_bytes()).hexdigest()
              for p in ['jpegtran.js', 'jpegtran.wasm']},
}
(out / 'build-info.json').write_text(json.dumps(manifest, indent=2) + '\n')
PY
printf 'Built %s/jpegtran.js and jpegtran.wasm\nRun: python3 scripts/serve.py\n' "$OUT"
