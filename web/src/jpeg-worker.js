import { parseJpeg, withOrientation, MAX_FILE_BYTES } from './jpeg.js';
import { snapCrop } from './geometry.js';
import { rotationPlan } from './rotation.js';

// One JPEG operation per worker. Termination releases the engine and virtual files.
self.onmessage = async ({ data }) => {
  let engine;
  const diagnostics = [];
  const log = value => { if (diagnostics.length < 20) diagnostics.push(String(value).slice(0, 400)); };
  try {
    if (!(data.bytes instanceof ArrayBuffer) || data.bytes.byteLength > MAX_FILE_BYTES) throw new Error('Invalid input buffer.');
    const input = new Uint8Array(data.bytes);
    const info = parseJpeg(input);
    const rotating = data.operation === 'rotate';
    if (!rotating && data.operation !== 'crop') throw new Error('Unknown JPEG operation.');
    const plan = rotating ? rotationPlan(info, data.direction) : null;
    const crop = rotating ? null : snapCrop(data.crop, info);
    let createJpegtran;
    try {
      ({ default: createJpegtran } = await import('../vendor/jpegtran.js'));
    } catch {
      throw new Error('JPEG engine unavailable. Build it with bash scripts/build-wasm.sh, then reload.');
    }
    engine = await createJpegtran({
      noInitialRun: true,
      locateFile: name => new URL(`../vendor/${name}`, import.meta.url).href,
      print: log, printErr: log,
    });
    if (!engine.FS || !engine.callMain) throw new Error('The engine must export FS and callMain.');
    engine.FS.writeFile('/input.jpg', input);
    const args = ['-strict', '-maxscans', '200'];
    if (rotating) {
      args.push('-copy', 'all', '-rotate', String(plan.degrees), plan.trim ? '-trim' : '-perfect');
    } else {
      const { x, y, width, height } = crop.raw;
      args.push('-copy', data.keepMetadata === true ? 'all' : 'icc',
        '-crop', `${width}x${height}+${x}+${y}`);
    }
    args.push('-outfile', '/output.jpg', '/input.jpg');
    const status = engine.callMain(args);
    // Warnings are errors in the starter. Never return a repaired/re-encoded fallback.
    if (status !== 0) throw new Error(diagnostics.join('\n') || `jpegtran exited with status ${status}.`);
    let output = engine.FS.readFile('/output.jpg');
    if (!rotating && data.keepMetadata !== true) output = withOrientation(output, info.orientation);
    const resultInfo = parseJpeg(output);
    const expectedWidth = rotating ? info.height - (plan.degrees === 90 ? plan.cutPixels : 0) : crop.raw.width;
    const expectedHeight = rotating ? info.width - (plan.degrees === 270 ? plan.cutPixels : 0) : crop.raw.height;
    if (resultInfo.width !== expectedWidth || resultInfo.height !== expectedHeight || resultInfo.orientation !== info.orientation) {
      throw new Error('The output dimensions or orientation do not match the request.');
    }
    // Copy only the output bytes; never expose the engine heap or original file.
    const result = output.slice().buffer;
    self.postMessage({ ok: true, bytes: result, crop: crop?.display }, [result]);
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    for (const name of ['/input.jpg', '/output.jpg']) {
      try { engine?.FS?.unlink(name); } catch { /* File may not have been created. */ }
    }
    self.close();
  }
};
