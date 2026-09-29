/** Debounced, cancellable measurement using the same JPEG transform as Save. */
export function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  const unit = bytes < 1_000_000 ? 'KB' : 'MB';
  const divisor = unit === 'KB' ? 1000 : 1_000_000;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / divisor)} ${unit}`;
}

export function sizeComparison(original, output) {
  const difference = Math.abs(original - output);
  if (!difference) return `${formatSize(output)} output · same size`;
  const percent = difference / original * 100;
  const amount = percent < 1 ? '<1%' : `${Math.round(percent)}%`;
  return `${formatSize(output)} output · ${formatSize(difference)} ${output < original ? 'smaller' : 'larger'} (${amount})`;
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
  }
  function fail(message) {
    readout.textContent = 'Size estimate unavailable';
    readout.title = message;
  }
  function schedule() {
    cancel();
    const state = getState();
    if (!state.source || !state.crop || state.busy) return;
    const { source, crop, keepMetadata } = state;
    const token = sequence;
    readout.hidden = false;
    if (readout.textContent !== 'Estimating size…') readout.textContent = 'Estimating size…';
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
          if (Number.isSafeInteger(size) && size > 0) readout.textContent = sizeComparison(source.size, size);
          else fail(message || 'The JPEG engine could not measure this crop.');
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
