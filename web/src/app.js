import { parseJpeg, MAX_FILE_BYTES } from './jpeg.js';
import { snapCrop, rawToDisplay, retainedEdgeRects } from './geometry.js';
import { createCropInteraction } from './crop-interaction.js';
import { createPreview } from './preview.js';
import { rotationPlan } from './rotation.js';
import { createSizeEstimate } from './size-estimate.js';

const $ = id => document.getElementById(id);
const fields = ['x', 'y', 'width', 'height'];
// Phones in either orientation use the overlay drawer (see style.css).
const compactLayout = matchMedia('(max-width: 820px), (max-height: 540px) and (pointer: coarse)');
let source = null, info = null, crop = null, previewUrl = null;
let busy = false, pendingCancel = null, loadSequence = 0;
const downloads = new Set();

function error(message = '') { $('error').textContent = message; $('error').hidden = !message; }
function status(message) { $('status').textContent = message; }
function setBusy(value) {
  busy = value;
  if (value) { sizeEstimate.cancel(); preview.cancelFocus(); }
  $('open').disabled = value;
  $('open-empty').disabled = value;
  for (const id of ['rotate-left', 'rotate-right']) $(id).disabled = value || !source;
  $('crop-controls').disabled = value || !source;
  $('export-controls').disabled = !source;
  $('keep-metadata').disabled = value;
  for (const id of ['save', 'save-toolbar']) $(id).disabled = value || !source;
  $('zoom').disabled = value || !source;
  for (const id of ['cancel', 'cancel-toolbar']) $(id).hidden = !value || !pendingCancel;
  $('stage').setAttribute('aria-busy', String(value));
  cropUI.setEnabled(Boolean(source) && !value);
  if (!value) sizeEstimate.schedule();
}
function updateSelection(rect) {
  crop = snapCrop(rect, info);
  const r = crop.display;
  for (const key of fields) { $(key).value = String(r[key]); $(key).removeAttribute('aria-invalid'); }
  for (const id of ['selection', 'adjustment']) Object.assign($(id).style, {
    left: `${r.x/info.displayWidth*100}%`, top: `${r.y/info.displayHeight*100}%`,
    width: `${r.width/info.displayWidth*100}%`, height: `${r.height/info.displayHeight*100}%`,
  });
  const retained = retainedEdgeRects(crop.raw, info);
  for (const [index, id] of ['retained-edge-a', 'retained-edge-b'].entries()) {
    const element = $(id), rawRect = retained[index];
    element.hidden = !rawRect;
    if (!rawRect) continue;
    const edge = rawToDisplay(rawRect, info);
    Object.assign(element.style, {
      left: `${edge.x/info.displayWidth*100}%`, top: `${edge.y/info.displayHeight*100}%`,
      width: `${edge.width/info.displayWidth*100}%`, height: `${edge.height/info.displayHeight*100}%`,
    });
  }
  $('retained-note').hidden = retained.length === 0;
  sizeEstimate.schedule();
}
const cropUI = createCropInteraction({
  stage: $('stage'), state: () => ({ info, crop }),
  apply: updateSelection, status, clearError: error,
  onDrawn: () => preview.scheduleFocus(() => crop?.display),
});
const preview = createPreview({
  viewport: $('drop-area'), space: $('stage-space'), stage: $('stage'),
  control: $('zoom'), getInfo: () => info,
  onGesture: () => cropUI.cancelDrag(), onFocus: () => cropUI.clearHover(),
});
const fitPreview = () => preview.render();
const sizeEstimate = createSizeEstimate({
  readout: $('size-readout'),
  getState: () => ({ source, crop: crop && { ...crop.display }, keepMetadata: $('keep-metadata').checked, busy }),
});
async function openFile(file) {
  if (busy || !file) return;
  const sequence = ++loadSequence;
  sizeEstimate.reset(); error(); setBusy(true); status('Reading JPEG…');
  let url;
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('This starter accepts JPEGs up to 50 MiB.');
    const parsed = parseJpeg(new Uint8Array(await file.arrayBuffer()));
    url = URL.createObjectURL(file);
    const testImage = new Image();
    testImage.src = url;
    await testImage.decode();
    if (sequence !== loadSequence) { URL.revokeObjectURL(url); return; }
    // Browser preview must agree with EXIF geometry; do not guess silently.
    if (testImage.naturalWidth !== parsed.displayWidth || testImage.naturalHeight !== parsed.displayHeight) {
      throw new Error('This browser interpreted the JPEG orientation or dimensions differently. Export is disabled for this file.');
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = url; source = file; info = parsed;
    $('image').src = url;
    $('stage').hidden = false; $('empty').hidden = true;
    $('drop-area').classList.add('has-image');
    $('file-name').textContent = file.name;
    $('file-info').hidden = false;
    $('dimensions').textContent = `${info.displayWidth} × ${info.displayHeight}`;
    $('blocks').textContent = `${info.mcuWidth} × ${info.mcuHeight}`;
    $('x').max = String(info.displayWidth-1); $('y').max = String(info.displayHeight-1);
    $('width').max = String(info.displayWidth); $('height').max = String(info.displayHeight);
    preview.reset(); updateSelection({ x: 0, y: 0, width: info.displayWidth, height: info.displayHeight });
    cropUI.setMode('draw');
    const freeCorner = rawToDisplay({ x: info.width, y: info.height, width: 0, height: 0 }, info);
    const cornerName = `${freeCorner.y === 0 ? 'upper' : 'lower'} ${freeCorner.x === 0 ? 'left' : 'right'}`;
    status(matchMedia('(hover: hover)').matches
      ? `Hover for block placement. Drag toward ${cornerName} for pixel refinement.`
      : `Drag on the image to select a crop. Drag toward ${cornerName} for pixel refinement.`);
    return true;
  } catch (e) {
    if (url && url !== previewUrl) URL.revokeObjectURL(url);
    error(e.message); status(source ? 'Previous JPEG is still selected.' : 'No JPEG loaded.');
    return false;
  } finally { if (sequence === loadSequence) setBusy(false); }
}
$('open').addEventListener('click', () => $('file').click());
$('open-empty').addEventListener('click', () => { if (!busy) $('file').click(); });
// The mobile preview opens unobstructed; the controls remain one tap away.
function setPanelCollapsed(collapsed, focus = false) {
  const panel = $('side-panel'), toggle = $('panel-toggle'), slot = $('panel-toggle-slot');
  slot.hidden = !collapsed;
  (collapsed ? slot : $('panel-header')).append(toggle);
  panel.hidden = collapsed;
  $('panel-scrim').hidden = collapsed || !compactLayout.matches;
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', collapsed ? 'Show controls' : 'Hide controls');
  toggle.title = collapsed ? 'Show controls' : 'Hide controls';
  if (focus) toggle.focus({ preventScroll: true });
  requestAnimationFrame(fitPreview);
}
if (compactLayout.matches) setPanelCollapsed(true);
// Rotating a tablet or resizing a window across the breakpoint: phones start
// with the drawer closed, the desktop layout with the sidebar open.
compactLayout.addEventListener('change', event => setPanelCollapsed(event.matches));
$('panel-toggle').addEventListener('click', () => setPanelCollapsed(!$('side-panel').hidden, true));
$('panel-scrim').addEventListener('click', () => setPanelCollapsed(true, true));
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && compactLayout.matches && !$('side-panel').hidden) {
    setPanelCollapsed(true, true);
  }
});
$('file').addEventListener('change', () => { const file = $('file').files[0]; $('file').value = ''; openFile(file); });
for (const type of ['dragenter', 'dragover']) {
  $('drop-area').addEventListener(type, event => { event.preventDefault(); if (!busy) $('drop-area').classList.add('dragging'); });
}
$('drop-area').addEventListener('dragleave', event => { if (!$('drop-area').contains(event.relatedTarget)) $('drop-area').classList.remove('dragging'); });
$('drop-area').addEventListener('drop', event => {
  event.preventDefault(); $('drop-area').classList.remove('dragging');
  if (event.dataTransfer.files.length !== 1) { error('Choose one local JPEG at a time.'); return; }
  openFile(event.dataTransfer.files[0]);
});
// A drop outside the workspace must not navigate away from the tool.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
function readCoordinates() {
  const rect = {};
  for (const key of fields) {
    const input = $(key);
    if (!input.checkValidity() || !Number.isFinite(input.valueAsNumber)) {
      input.setAttribute('aria-invalid', 'true');
      throw new Error('Enter valid whole-pixel coordinates and positive dimensions.');
    }
    rect[key] = input.valueAsNumber;
  }
  return rect;
}
for (const key of fields) $(key).addEventListener('change', () => {
  if (!info || busy) return;
  try { error(); updateSelection(readCoordinates()); cropUI.setMode('adjust'); status('Selection updated. JPEG block-start edges are aligned.'); }
  catch (e) { error(e.message); }
});
$('reset').addEventListener('click', () => {
  error(); updateSelection({ x: 0, y: 0, width: info.displayWidth, height: info.displayHeight });
  cropUI.setMode('draw'); preview.reset();
  status('Whole image selected. Drag to draw a new crop.');
});
$('keep-metadata').addEventListener('change', () => {
  $('metadata-note').textContent = $('keep-metadata').checked
    ? 'May include GPS, comments, and an uncropped thumbnail. Do not use this mode to hide sensitive content.'
    : 'Removes EXIF, GPS, comments, and thumbnails. Keeps the ICC colour profile and display orientation.';
  sizeEstimate.schedule();
});

function runJpegWorker(bytes, request, action) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./jpeg-worker.js', import.meta.url), { type: 'module' });
    let done = false;
    const finish = (failure, result) => {
      if (done) return;
      done = true; clearTimeout(timer); worker.terminate(); pendingCancel = null;
      failure ? reject(failure) : resolve(result);
    };
    const timer = setTimeout(() => finish(new Error(`${action} timed out after 60 seconds. Try a smaller image.`)), 60_000);
    pendingCancel = () => finish(new Error(`${action} cancelled.`));
    for (const id of ['cancel', 'cancel-toolbar']) $(id).hidden = false;
    worker.onmessage = ({ data }) => data.ok ? finish(null, data) : finish(new Error(data.error));
    worker.onerror = event => { event.preventDefault(); finish(new Error('The JPEG worker failed to load or run. Check the local WASM build.')); };
    worker.onmessageerror = () => finish(new Error('The JPEG worker returned an unreadable result.'));
    try { worker.postMessage({ bytes, ...request }, [bytes]); }
    catch (e) { finish(e); }
  });
}
for (const id of ['cancel', 'cancel-toolbar']) $(id).addEventListener('click', () => pendingCancel?.());
async function saveCrop() {
  if (busy || !source) return;
  error();
  try { updateSelection(readCoordinates()); } catch (e) { error(e.message); return; }
  setBusy(true); status('Cropping JPEG coefficients…');
  try {
    const result = await runJpegWorker(await source.arrayBuffer(),
      { operation: 'crop', crop: crop.display, keepMetadata: $('keep-metadata').checked }, 'Cropping');
    const blob = new Blob([result.bytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob); downloads.add(url);
    const anchor = document.createElement('a');
    const name = source.name.replace(/\.[^.]+$/, '').replace(/[\\/\x00-\x1f]/g, '_') || 'image';
    anchor.href = url; anchor.download = `${name}-crop.jpg`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => { URL.revokeObjectURL(url); downloads.delete(url); }, 60_000);
    status(`Saved ${result.crop.width} × ${result.crop.height} px without recompression.`);
  } catch (e) { error(e.message); status('No JPEG was exported.'); }
  finally { setBusy(false); }
}
async function rotateSource(direction) {
  if (busy || !source) return;
  let plan;
  try { plan = rotationPlan(info, direction); }
  catch (e) { error(e.message); return; }
  if (plan.trim) {
    if (!window.confirm(`Turning this photo ${direction} will remove a ${plan.cutPixels}-pixel strip from the ${plan.edge} edge shown here; do you want to continue?`)) return;
  }
  error(); setBusy(true); status('Turning JPEG…');
  try {
    const original = source;
    const result = await runJpegWorker(await original.arrayBuffer(),
      { operation: 'rotate', direction }, 'Turning');
    const rotated = new File([result.bytes], original.name, { type: 'image/jpeg' });
    setBusy(false);
    if (await openFile(rotated)) {
      status(plan.trim
        ? `Photo turned without recompression; a ${plan.cutPixels}-pixel strip was removed from the ${plan.edge} edge as it appeared before turning.`
        : 'Photo turned without recompression.');
    }
  } catch (e) {
    error(e.message); status('Previous JPEG is still selected.');
  } finally { setBusy(false); }
}
$('rotate-left').addEventListener('click', () => rotateSource('left'));
$('rotate-right').addEventListener('click', () => rotateSource('right'));
// Both buttons use the same validation, metadata settings and worker path.
for (const id of ['save', 'save-toolbar']) $(id).addEventListener('click', saveCrop);
new ResizeObserver(fitPreview).observe($('drop-area'));
window.addEventListener('resize', fitPreview);
window.addEventListener('pagehide', () => {
  sizeEstimate.cancel();
  pendingCancel?.();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  for (const url of downloads) URL.revokeObjectURL(url);
  downloads.clear();
});
