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
  return { degrees, cutPixels, trim: cutPixels !== 0 };
}
