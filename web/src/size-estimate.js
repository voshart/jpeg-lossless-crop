/** Debounced, cancellable measurement using the same JPEG transform as Save. */
export function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  const unit = bytes < 1_000_000 ? 'KB' : 'MB';
  const divisor = unit === 'KB' ? 1000 : 1_000_000;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / divisor)} ${unit}`;
}

/** Short readout: "165 KB · 89% smaller". A whole-image save shows only its size. */
export function sizeSummary(original, output, whole = false) {
  const size = formatSize(output);
  if (whole || output === original) return size;
  const percent = Math.abs(original - output) / original * 100;
  const amount = percent < 1 ? '<1%' : `${Math.round(percent)}%`;
  return `${size} · ${amount} ${output < original ? 'smaller' : 'larger'}`;
}

export function createSizeEstimate({ readout, getState }) {
  let sequence = 0, delay = null, worker = null, timeout = null;
  function cancel() {
    sequence++;
    clearTimeout(delay);
    clearTimeout(timeout);
    delay = null; timeout = null;
    worker?.terminate(); worker = null;
  }
  function reset() {
    cancel();
    readout.hidden = true;
    readout.textContent = '';
    readout.removeAttribute('title');
    delete readout.dataset.stale;
  }
  function fail(message) {
    readout.textContent = 'Size unavailable';
    readout.title = message;
    delete readout.dataset.stale;
  }
  function schedule() {
    cancel();
    const state = getState();
    if (!state.source || !state.crop || state.busy) return;
    const { source, crop, keepMetadata, whole } = state;
    const token = sequence;
    readout.hidden = false;
    // Keep the last size on screen, dimmed, so the readout does not flicker while measuring.
    if (readout.textContent && readout.textContent !== 'Size unavailable') readout.dataset.stale = 'true';
    else readout.textContent = 'Measuring…';
    readout.removeAttribute('title');
    delay = setTimeout(async () => {
      delay = null;
      let bytes;
      try { bytes = await source.arrayBuffer(); }
      catch (error) { if (token === sequence) fail(error.message); return; }
      if (token !== sequence) return;
      try {
        worker = new Worker(new URL('./jpeg-worker.js', import.meta.url), { type: 'module' });
        const currentWorker = worker;
        let settled = false;
        const finish = (size, message) => {
          if (settled || token !== sequence) return;
          settled = true;
          clearTimeout(timeout); timeout = null;
          currentWorker.terminate(); worker = null;
          if (Number.isSafeInteger(size) && size > 0) {
            readout.textContent = sizeSummary(source.size, size, whole);
            delete readout.dataset.stale;
          } else fail(message || 'The JPEG engine could not measure this crop.');
        };
        timeout = setTimeout(() => finish(null, 'The size estimate timed out.'), 60_000);
        currentWorker.onmessage = ({ data }) => finish(data.ok ? data.size : null, data.error);
        currentWorker.onerror = event => { event.preventDefault(); finish(null, 'The JPEG engine failed to load.'); };
        currentWorker.onmessageerror = () => finish(null, 'The JPEG engine returned an unreadable result.');
        currentWorker.postMessage({ bytes, operation: 'measure', crop, keepMetadata }, [bytes]);
      } catch (error) {
        if (token === sequence) {
          clearTimeout(timeout); timeout = null;
          worker?.terminate(); worker = null; fail(error.message);
        }
      }
    }, 1000);
  }
  return { cancel, reset, schedule };
}
