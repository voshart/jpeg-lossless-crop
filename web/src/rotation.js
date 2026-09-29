import { rawToDisplay } from './geometry.js';

/** Map a turn of the displayed photo to a physical JPEG coefficient turn. */
export function rotationPlan(info, direction) {
  if (!['left', 'right'].includes(direction)) throw new Error('Choose a left or right turn.');
  const mirrored = [2, 4, 5, 7].includes(info.orientation);
  const degrees = direction === 'right' ? (mirrored ? 270 : 90) : (mirrored ? 90 : 270);
  const cutPixels = degrees === 90
    ? info.height % info.mcuHeight
    : info.width % info.mcuWidth;
  if (cutPixels === (degrees === 90 ? info.height : info.width)) {
    throw new Error('This photo is too small to turn without losing the whole image.');
  }
  if (cutPixels === 0) return { degrees, cutPixels, trim: false, edge: null };
  // jpegtran trims the raw bottom for 90° or the raw right for 270°.
  const rawStrip = degrees === 90
    ? { x: 0, y: info.height - cutPixels, width: info.width, height: cutPixels }
    : { x: info.width - cutPixels, y: 0, width: cutPixels, height: info.height };
  const shown = rawToDisplay(rawStrip, info);
  const displayWidth = info.orientation >= 5 ? info.height : info.width;
  const edge = shown.width === displayWidth
    ? (shown.y === 0 ? 'top' : 'bottom')
    : (shown.x === 0 ? 'left' : 'right');
  return { degrees, cutPixels, trim: true, edge };
}

/**
 * Carry a display-space crop through a turn so the selection survives it.
 * The strip a trimmed turn removes is cut from the crop first. Returns null if
 * nothing of the crop remains. The result still needs snapCrop (block alignment).
 */
export function rotateDisplayRect(rect, info, direction, plan) {
  if (!['left', 'right'].includes(direction)) throw new Error('Choose a left or right turn.');
  let left = rect.x, top = rect.y, right = rect.x + rect.width, bottom = rect.y + rect.height;
  let width = info.displayWidth, height = info.displayHeight;
  if (plan.trim) {
    const cut = plan.cutPixels;
    if (plan.edge === 'left') { left -= cut; right -= cut; width -= cut; }
    else if (plan.edge === 'right') width -= cut;
    else if (plan.edge === 'top') { top -= cut; bottom -= cut; height -= cut; }
    else height -= cut;
  }
  left = Math.max(0, left); top = Math.max(0, top);
  right = Math.min(width, right); bottom = Math.min(height, bottom);
  if (right <= left || bottom <= top) return null;
  return direction === 'right'
    ? { x: height - bottom, y: left, width: bottom - top, height: right - left }
    : { x: top, y: width - right, width: bottom - top, height: right - left };
}
