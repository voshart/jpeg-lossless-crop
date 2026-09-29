import { displayToRaw, rawToDisplay, snapCrop } from './geometry.js';
import { constrainAspect, snapToAspect, handleAnchor, drawAnchor } from './aspect.js';

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

/** A mirrored JPEG with partial edge blocks has an offset display grid. */
export function displayGrid(info, axis) {
  const origin = rawToDisplay({ x: 0, y: 0, width: 0, height: 0 }, info);
  const swapped = info.orientation >= 5;
  const step = axis === 'x'
    ? (swapped ? info.mcuHeight : info.mcuWidth)
    : (swapped ? info.mcuWidth : info.mcuHeight);
  return { step, offset: origin[axis] % step,
    limit: axis === 'x' ? info.displayWidth : info.displayHeight };
}

function nearestBoundary(value, grid, low = 0, high = grid.limit) {
  if (!Number.isFinite(value)) throw new Error('A finite pointer coordinate is required.');
  const { step, offset, limit } = grid;
  const first = Math.ceil((low - offset) / step);
  const last = Math.floor((high - offset) / step);
  const candidates = [0, limit].filter(n => n >= low && n <= high);
  if (first <= last) {
    const k = clamp(Math.floor((value - offset) / step), first, last);
    candidates.push(offset + k * step, offset + Math.min(k + 1, last) * step);
  }
  // Stable tie-break: use the smaller displayed coordinate.
  candidates.sort((a, b) => Math.abs(a - value) - Math.abs(b - value) || a - b);
  if (!candidates.length) throw new Error('No JPEG boundary in the requested interval.');
  return candidates[0];
}

export function snapPoint(point, info) {
  return { x: nearestBoundary(point.x, displayGrid(info, 'x')),
    y: nearestBoundary(point.y, displayGrid(info, 'y')) };
}

function pixelPoint(point, info) {
  if (![point.x, point.y].every(Number.isFinite)) throw new Error('A finite pointer coordinate is required.');
  return { x: clamp(Math.round(point.x), 0, info.displayWidth),
    y: clamp(Math.round(point.y), 0, info.displayHeight) };
}

function rawPoint(point, info) {
  return displayToRaw({ ...point, width: 0, height: 0 }, info);
}

function drawEndpoint(anchor, end, info) {
  const pixel = pixelPoint(end, info);
  const startRaw = rawPoint(anchor, info), endRaw = rawPoint(pixel, info);
  // Only a drag toward the raw lower-right can use both JPEG frame-size edges.
  const fine = endRaw.x > startRaw.x && endRaw.y > startRaw.y;
  return { point: fine ? pixel : snapPoint(end, info), fine };
}

// The raw top/left block origin can appear on either displayed side after EXIF orientation.
function alignedDisplayEdge(info, axis, side) {
  const origin = rawToDisplay({ x: 0, y: 0, width: 0, height: 0 }, info);
  return side === 'low' ? origin[axis] === 0 : origin[axis] === displayGrid(info, axis).limit;
}

function nearestEdge(value, info, axis, side, low, high) {
  if (alignedDisplayEdge(info, axis, side)) {
    return nearestBoundary(value, displayGrid(info, axis), low, high);
  }
  if (!Number.isFinite(value)) throw new Error('A finite pointer coordinate is required.');
  return clamp(Math.round(value), low, high);
}

export function drawCrop(start, end, info) {
  const a = snapPoint(start, info), b = drawEndpoint(a, end, info).point;
  if (a.x === b.x || a.y === b.y) return null;
  return snapCrop({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }, info).display;
}

export function handlePoint(rect, handle) {
  return { x: rect.x + rect.width * (handle.includes('w') ? 0 : handle.includes('e') ? 1 : 0.5),
    y: rect.y + rect.height * (handle.includes('n') ? 0 : handle.includes('s') ? 1 : 0.5) };
}

export function resizeCrop(rect, handle, point, info) {
  let left = rect.x, right = rect.x + rect.width, top = rect.y, bottom = rect.y + rect.height;
  if (handle.includes('w')) left = nearestEdge(point.x, info, 'x', 'low', 0, right - 1);
  if (handle.includes('e')) right = nearestEdge(point.x, info, 'x', 'high', left + 1, info.displayWidth);
  if (handle.includes('n')) top = nearestEdge(point.y, info, 'y', 'low', 0, bottom - 1);
  if (handle.includes('s')) bottom = nearestEdge(point.y, info, 'y', 'high', top + 1, info.displayHeight);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Translate in whole raw blocks, keeping the crop dimensions fixed. */
export function moveCrop(rect, delta, info) {
  const raw = displayToRaw(rect, info);
  const moved = displayToRaw({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y }, info);
  for (const [axis, size, block, limit] of [
    ['x', 'width', info.mcuWidth, info.width], ['y', 'height', info.mcuHeight, info.height],
  ]) {
    raw[axis] = clamp(Math.round(moved[axis] / block) * block, 0,
      Math.floor((limit - raw[size]) / block) * block);
  }
  return rawToDisplay(raw, info);
}

function nextBoundary(value, direction, count, grid) {
  const { step, offset, limit } = grid;
  const k = direction > 0 ? Math.floor((value - offset) / step) + count
    : Math.ceil((value - offset) / step) - count;
  return clamp(offset + k * step, 0, limit);
}

/**
 * Native pointer/keyboard controls. No JPEG engine or encoding code lives here.
 * One gesture set, no modes: drag outside the crop to draw a new one, inside to
 * move it, on a handle to resize it. While the crop is the whole image there is
 * nothing to move or resize, so the handles stay hidden.
 */
export function createCropInteraction({ stage, state, apply, status, clearError, onChange = () => {}, onDrawn = () => {} }) {
  const $ = id => document.getElementById(id);
  const adjustment = $('adjustment'), preview = $('snap-preview'), readout = $('pointer-readout');
  const handles = [...adjustment.querySelectorAll('[data-handle]')];
  let enabled = false, drag = null;

  function wholeImage() {
    const { info, crop } = state();
    return !crop || (crop.display.width === info.displayWidth && crop.display.height === info.displayHeight);
  }
  function hidePreview() {
    preview.hidden = true;
    readout.textContent = enabled && matchMedia('(hover: hover)').matches
      ? 'Move over the image to preview the next boundary.' : '';
  }
  /** Show the handles only when there is a crop to adjust. */
  function sync() {
    adjustment.hidden = !enabled || wholeImage();
  }
  function setEnabled(value) {
    if (!value) finish(true);
    enabled = value;
    for (const handle of handles) handle.disabled = !value;
    stage.tabIndex = value ? 0 : -1;
    sync();
    hidePreview();
  }
  function position(event) {
    const { info } = state(), box = stage.getBoundingClientRect();
    return { x: clamp((event.clientX - box.left) / box.width * info.displayWidth, 0, info.displayWidth),
      y: clamp((event.clientY - box.top) / box.height * info.displayHeight, 0, info.displayHeight) };
  }
  function action(event) {
    const handle = event.target.closest('[data-handle]');
    if (handle) return handle.dataset.handle;
    return !adjustment.hidden && adjustment.contains(event.target) ? 'move' : 'draw';
  }
  /** Hold the chosen aspect ratio, if any, around the fixed corner or edge. */
  function constrained(rect, anchor) {
    const { info, ratio } = state();
    return rect && ratio ? snapToAspect(constrainAspect(rect, ratio, anchor, info), ratio, info) : rect;
  }
  function showPoint(point, label = 'Snap', axes = 'xy') {
    const { info } = state();
    preview.style.setProperty('--snap-x', `${point.x / info.displayWidth * 100}%`);
    preview.style.setProperty('--snap-y', `${point.y / info.displayHeight * 100}%`);
    preview.dataset.axes = axes;
    preview.hidden = false;
    const coordinates = [axes.includes('x') ? `X ${Math.round(point.x)}` : '',
      axes.includes('y') ? `Y ${Math.round(point.y)}` : ''].filter(Boolean).join(' · ');
    readout.textContent = `${label} · ${coordinates} px`;
  }
  function axesFor(handle) {
    return `${/[we]/.test(handle) ? 'x' : ''}${/[ns]/.test(handle) ? 'y' : ''}`;
  }
  function hover(event) {
    if (!enabled || event.pointerType === 'touch') { hidePreview(); return; }
    const { info, crop } = state(), kind = action(event);
    if (kind === 'draw') showPoint(snapPoint(position(event), info));
    else if (kind === 'move') {
      preview.hidden = true;
      readout.textContent = `Move crop · X ${crop.display.x} · Y ${crop.display.y} px`;
    } else showPoint(handlePoint(crop.display, kind), 'Resize', axesFor(kind));
  }
  function changeDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 3 && !drag.changed) return;
    const { info } = state(), point = position(event);
    let rect;
    if (drag.kind === 'draw') {
      rect = drawCrop(drag.anchor, point, info);
      if (rect) rect = constrained(rect, drawAnchor(rect, drag.anchor));
      const endpoint = drawEndpoint(drag.anchor, point, info);
      showPoint(endpoint.point, endpoint.fine ? 'Pixel' : 'Snap');
    } else if (drag.kind === 'move') {
      rect = moveCrop(drag.previous, { x: point.x - drag.start.x, y: point.y - drag.start.y }, info);
      preview.hidden = true;
      readout.textContent = `Move crop · X ${rect.x} · Y ${rect.y} px`;
    } else {
      // Use the handle's true edge, not where the user grabbed its larger hit area.
      const edge = handlePoint(drag.previous, drag.kind);
      rect = resizeCrop(drag.previous, drag.kind,
        { x: edge.x + point.x - drag.start.x, y: edge.y + point.y - drag.start.y }, info);
      rect = constrained(rect, handleAnchor(drag.kind));
      showPoint(handlePoint(rect, drag.kind), 'Resize', axesFor(drag.kind));
    }
    if (rect) { apply(rect); drag.changed = true; }
    else if (drag.changed) { apply(drag.previous); drag.changed = false; }
  }
  function finish(cancelled = false, quiet = false) {
    if (!drag) return;
    const last = drag;
    drag = null;
    delete stage.dataset.drag;
    if (cancelled && last.changed) apply(last.previous);
    if (stage.hasPointerCapture(last.id)) stage.releasePointerCapture(last.id);
    if (!cancelled && last.changed) {
      onChange(last.previous);
      status('Drag inside to move, or drag a handle to resize.');
      if (last.kind === 'draw') onDrawn();
    } else if (cancelled && !quiet) status('Adjustment cancelled. Previous crop restored.');
    hidePreview();
  }
  stage.addEventListener('pointerdown', event => {
    if (!enabled || drag || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault(); clearError();
    const { info, crop } = state(), point = position(event), kind = action(event);
    drag = { id: event.pointerId, kind, start: point, anchor: snapPoint(point, info),
      previous: { ...crop.display }, clientX: event.clientX, clientY: event.clientY, changed: false };
    stage.dataset.drag = kind;
    // Keyboard nudging needs focus; a touch would only draw a focus ring.
    if (event.pointerType !== 'touch') (event.target.closest('[data-handle]') || stage).focus({ preventScroll: true });
    stage.setPointerCapture(event.pointerId);
    if (kind === 'draw') showPoint(drag.anchor);
  });
  stage.addEventListener('pointermove', event => drag ? changeDrag(event) : hover(event));
  stage.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    changeDrag(event); finish(); hover(event);
  });
  stage.addEventListener('pointercancel', event => { if (drag?.id === event.pointerId) finish(true); });
  stage.addEventListener('lostpointercapture', event => { if (drag?.id === event.pointerId) finish(true); });
  stage.addEventListener('pointerleave', () => { if (!drag) hidePreview(); });
  stage.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { event.preventDefault(); finish(true); return; }
    const arrows = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['y', -1], ArrowDown: ['y', 1] };
    if (!enabled || drag || !arrows[event.key] || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); clearError();
    const [axis, direction] = arrows[event.key], count = event.shiftKey ? 10 : 1;
    const { info, crop } = state(), grid = displayGrid(info, axis);
    const previous = { ...crop.display };
    const handle = event.target.closest('[data-handle]')?.dataset.handle;
    if (handle) {
      if (!axesFor(handle).includes(axis)) return;
      const point = handlePoint(crop.display, handle);
      const side = axis === 'x' ? (handle.includes('w') ? 'low' : 'high')
        : (handle.includes('n') ? 'low' : 'high');
      point[axis] = alignedDisplayEdge(info, axis, side)
        ? nextBoundary(point[axis], direction, count, grid)
        : clamp(point[axis] + direction * count, 0, grid.limit);
      apply(constrained(resizeCrop(crop.display, handle, point, info), handleAnchor(handle)));
    } else {
      apply(moveCrop(crop.display, { x: axis === 'x' ? grid.step * direction * count : 0,
        y: axis === 'y' ? grid.step * direction * count : 0 }, info));
    }
    onChange(previous, { key: true });
    const r = state().crop.display;
    status(`Crop X ${r.x}, Y ${r.y}, ${r.width} × ${r.height} pixels.`);
  });
  setEnabled(false);
  // A second finger turns the gesture into zoom/pan; undo any first-finger drag.
  return { setEnabled, sync, cancelDrag: () => finish(true, true),
    clearHover: () => { if (!drag) hidePreview(); } };
}
