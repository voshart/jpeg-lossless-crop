# Locally built engine

Run `bash scripts/build-wasm.sh` from the repository root. It compiles the pinned
libjpeg-turbo source archive and writes `jpegtran.js`, `jpegtran.wasm`, the
upstream licence notices, and `build-info.json` here.

Generated files are deliberately not checked into this starter. The interface
and JPEG-header tests work before the build; JPEG export requires the build.

Do not replace these files with the demonstration repository's opaque binaries.
When distributing a build, include its upstream notices and build information.
