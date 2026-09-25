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
