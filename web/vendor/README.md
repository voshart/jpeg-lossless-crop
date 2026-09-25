# Locally built engine

Run `bash scripts/build-wasm.sh` from the repository root. It compiles the pinned
libjpeg-turbo source archive and writes `jpegtran.js`, `jpegtran.wasm`, the
upstream licence notices, and `build-info.json` here.

The generated engine, licence notices, and build manifest are committed for
Git-connected static hosting. Rebuild and verify them before replacing them.
The existing tests do not verify JPEG export end to end.

Do not replace these files with the demonstration repository's opaque binaries.
When distributing a build, include its upstream notices and build information.
