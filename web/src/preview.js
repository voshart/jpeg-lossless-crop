/** Preview sizing only. No JPEG bytes or crop coordinates are changed here. */
export function previewScale(mode, info, availableWidth, availableHeight) {
  if (mode !== 'fit') {
    const scale = Number(mode);
    if (!Number.isFinite(scale) || scale <= 0 || scale > 4) throw new Error('Unsupported preview zoom.');
    return scale;
  }
  return Math.min(1, Math.max(1, availableWidth) / info.displayWidth,
    Math.max(1, availableHeight) / info.displayHeight);
}

export function wheelScale(current, fit, deltaY) {
  return Math.min(4, Math.max(fit, current * Math.exp(-deltaY * .002)));
}

export function pinchScale(start, fit, startDistance, distance) {
  return Math.min(4, Math.max(fit, start * distance / Math.max(1, startDistance)));
}

/**
 * Zoom that makes a newly drawn crop fill part of the view, leaving context
 * around it for handles. Returns null when the crop is already prominent.
 */
export function focusScale(rect, current, availableWidth, availableHeight) {
  const width = Math.max(1, availableWidth), height = Math.max(1, availableHeight);
  const occupied = Math.max(rect.width * current / width, rect.height * current / height);
  if (occupied >= .45) return null;
  const target = Math.min(4, .65 * Math.min(width / rect.width, height / rect.height));
  return target >= current * 1.2 ? target : null;
}

export function createPreview({ viewport, space, stage, control, getInfo, onGesture = () => {}, onFocus = () => {} }) {
  let mode = 'fit', focusTimer = null, focusFrame = null, gesture = null;
  const touches = new Map();
  const custom = document.createElement('option');
  viewport.dataset.zoom = mode;
  function availableSize() {
    const style = getComputedStyle(space);
    return [viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)];
  }
  function scales() {
    const info = getInfo(), [width, height] = availableSize();
    return { fit: previewScale('fit', info, width, height),
      current: previewScale(mode, info, width, height), width, height };
  }
  function render() {
    const info = getInfo();
    if (!info) return;
    const [width, height] = availableSize();
    const scale = previewScale(mode, info, width, height);
    stage.style.width = `${info.displayWidth * scale}px`;
    stage.style.height = `${info.displayHeight * scale}px`;
  }
  function setMode(next) {
    mode = String(next);
    custom.remove();
    if (mode !== 'fit' && !['1', '2', '4'].includes(mode)) {
      custom.value = mode;
      custom.textContent = `${Math.round(Number(mode) * 100)}%`;
      control.add(custom);
    }
    control.value = mode;
    viewport.dataset.zoom = mode;
    render();
  }
  function imagePoint(clientX, clientY) {
    const box = stage.getBoundingClientRect();
    return { x: (clientX - box.left) / box.width, y: (clientY - box.top) / box.height };
  }
  /** Keep a fractional image point under a client position while zooming. */
  function zoomAt(scale, point, clientX, clientY, fit) {
    setMode(scale <= fit * 1.001 ? 'fit' : Number(scale.toFixed(5)));
    const after = stage.getBoundingClientRect();
    viewport.scrollLeft += after.left + point.x * after.width - clientX;
    viewport.scrollTop += after.top + point.y * after.height - clientY;
  }
  function cancelFocus() {
    clearTimeout(focusTimer); cancelAnimationFrame(focusFrame);
    focusTimer = focusFrame = null;
  }
  function focusCrop(rect) {
    const info = getInfo();
    if (!info || control.disabled || stage.dataset.drag || gesture) return;
    const { fit, current, width, height } = scales();
    const target = focusScale(rect, current, width, height);
    if (!target) return;
    const center = { x: (rect.x + rect.width / 2) / info.displayWidth,
      y: (rect.y + rect.height / 2) / info.displayHeight };
    const box = stage.getBoundingClientRect(), view = viewport.getBoundingClientRect();
    const from = { x: box.left + center.x * box.width, y: box.top + center.y * box.height };
    const to = { x: view.left + viewport.clientWidth / 2, y: view.top + viewport.clientHeight / 2 };
    onFocus();
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320;
    const started = performance.now();
    const step = now => {
      const t = duration ? Math.min(1, (now - started) / duration) : 1;
      const eased = 1 - (1 - t) ** 3;
      zoomAt(current * (target / current) ** eased, center,
        from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased, fit);
      focusFrame = t < 1 ? requestAnimationFrame(step) : null;
    };
    focusFrame = requestAnimationFrame(step);
  }
  /** After a pause, zoom toward a small new crop. Any preview input cancels it. */
  function scheduleFocus(getRect, delay = 700) {
    cancelFocus();
    focusTimer = setTimeout(() => {
      focusTimer = null;
      const rect = getRect();
      if (rect) focusCrop(rect);
    }, delay);
  }
  function reset() {
    cancelFocus();
    setMode('fit');
    viewport.scrollLeft = viewport.scrollTop = 0;
  }
  control.addEventListener('change', () => {
    cancelFocus();
    if (control.disabled || stage.dataset.drag) { control.value = mode; return; }
    setMode(control.value);
    viewport.scrollLeft = viewport.scrollTop = 0;
  });
  viewport.addEventListener('wheel', event => {
    cancelFocus();
    if (control.disabled || stage.dataset.drag || !stage.contains(event.target)) return;
    event.preventDefault();
    const { fit, current } = scales();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
    const next = wheelScale(current, fit, delta);
    if (Math.abs(next - current) < .0001) return;
    zoomAt(next, imagePoint(event.clientX, event.clientY), event.clientX, event.clientY, fit);
  }, { passive: false });

  // Touch: two fingers pinch and pan; one finger pans from the margin or
  // after a pinch. One finger on the image is left to the crop interaction.
  function startGesture() {
    const points = [...touches.values()];
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    gesture = { point: imagePoint(x, y), distance, scale: scales().current };
  }
  viewport.addEventListener('pointerdown', event => {
    cancelFocus();
    if (event.pointerType !== 'touch' || control.disabled || !getInfo()) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) onGesture();
    if (touches.size >= 2 || !stage.contains(event.target)) {
      if (touches.size >= 2) viewport.setPointerCapture?.(event.pointerId);
      startGesture();
    }
  }, true);
  viewport.addEventListener('pointermove', event => {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    const points = [...touches.values()].slice(0, 2);
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const { fit, current } = scales();
    const scale = points.length > 1 && gesture.distance
      ? pinchScale(gesture.scale, fit, gesture.distance, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y))
      : current;
    zoomAt(scale, gesture.point, x, y, fit);
  });
  function releaseTouch(event) {
    if (!touches.delete(event.pointerId)) return;
    // The remaining finger continues panning instead of starting a crop.
    if (gesture && touches.size) startGesture();
    else if (!touches.size) gesture = null;
  }
  for (const type of ['pointerup', 'pointercancel']) viewport.addEventListener(type, releaseTouch);
  return { render, reset, scheduleFocus, cancelFocus };
}
