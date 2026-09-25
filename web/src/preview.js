/** Preview sizing only. No JPEG bytes or crop coordinates are changed here. */
export function previewScale(mode, info, availableWidth, availableHeight) {
  if (mode !== 'fit') {
    const scale = Number(mode);
    if (![1, 2, 4].includes(scale)) throw new Error('Unsupported preview zoom.');
    return scale;
  }
  return Math.min(1, Math.max(1, availableWidth) / info.displayWidth,
    Math.max(1, availableHeight) / info.displayHeight);
}

export function createPreview({ viewport, space, stage, control, getInfo }) {
  let mode = 'fit';
  viewport.dataset.zoom = mode;
  function render() {
    const info = getInfo();
    if (!info) return;
    const style = getComputedStyle(space);
    const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = previewScale(mode, info, width, height);
    stage.style.width = `${info.displayWidth * scale}px`;
    stage.style.height = `${info.displayHeight * scale}px`;
  }
  function reset() {
    mode = control.value = 'fit';
    viewport.dataset.zoom = mode;
    render();
    viewport.scrollLeft = viewport.scrollTop = 0;
  }
  control.addEventListener('change', () => {
    if (control.disabled || stage.dataset.drag) { control.value = mode; return; }
    mode = control.value;
    viewport.dataset.zoom = mode;
    render();
    // Keep navigation simple: each chosen view starts at the top-left.
    viewport.scrollLeft = viewport.scrollTop = 0;
  });
  return { render, reset };
}
