import { rawToDisplay, snapCrop } from './geometry.js';

/**
 * Aspect-ratio geometry in display coordinates. Only the raw top/left edges of a
 * JPEG crop must sit on a block boundary; the far edges may fall on any pixel.
 * So a ratio is exact when the crop is anchored on that aligned corner, which
 * is what snapToAspect does.
 */
const RATIO = /^(\d+):(\d+)$/;

export function parseAspect(value, info) {
  if (!value || value === 'free') return null;
  if (value === 'original') return info.displayWidth / info.displayHeight;
  const match = RATIO.exec(value);
  if (!match || !Number(match[1]) || !Number(match[2])) throw new Error('Unsupported aspect ratio.');
  return Number(match[1]) / Number(match[2]);
}

/** A turn swaps width and height, so a locked 3:2 becomes 2:3. */
export function swapAspect(value) {
  const match = RATIO.exec(value);
  return match ? `${match[2]}:${match[1]}` : value;
}

/**
 * Resize `rect` to `ratio` (width / height) while holding an edge or the centre.
 * keep: 'low' holds the left/top edge, 'high' the right/bottom edge, 'center' the middle.
 * drive: 'width' or 'height' keeps that side, 'cover' grows to contain `rect`,
 * 'fit' shrinks to the largest ratio rectangle inside it.
 */
export function constrainAspect(rect, ratio, { x: keepX = 'center', y: keepY = 'center', drive = 'cover' }, info) {
  if (!(ratio > 0) || !Number.isFinite(ratio)) throw new Error('A positive aspect ratio is required.');
  let width, height;
  if (drive === 'width') { width = rect.width; height = width / ratio; }
  else if (drive === 'height') { height = rect.height; width = height * ratio; }
  else if (drive === 'fit') { width = Math.min(rect.width, rect.height * ratio); height = width / ratio; }
  else { width = Math.max(rect.width, rect.height * ratio); height = width / ratio; }
  const centerX = rect.x + rect.width / 2, centerY = rect.y + rect.height / 2;
  const room = (keep, start, size, limit, center) => keep === 'low' ? limit - start
    : keep === 'high' ? start + size : 2 * Math.min(center, limit - center);
  const roomX = room(keepX, rect.x, rect.width, info.displayWidth, centerX);
  const roomY = room(keepY, rect.y, rect.height, info.displayHeight, centerY);
  const scale = Math.min(1, roomX / width, roomY / height);
  width = Math.min(Math.max(1, Math.round(width * scale)), Math.max(1, Math.floor(roomX)));
  height = Math.min(Math.max(1, Math.round(height * scale)), Math.max(1, Math.floor(roomY)));
  const place = (keep, start, size, extent, center, limit) => {
    if (keep === 'low') return start;
    if (keep === 'high') return start + size - extent;
    return Math.min(Math.max(0, Math.round(center - extent / 2)), limit - extent);
  };
  return {
    x: place(keepX, rect.x, rect.width, width, centerX, info.displayWidth), y: place(keepY, rect.y, rect.height, height, centerY, info.displayHeight),
    width, height,
  };
}

/** The displayed corner that holds the raw origin, whose edges must align to blocks. */
export function alignedAnchor(info) {
  const origin = rawToDisplay({ x: 0, y: 0, width: 0, height: 0 }, info);
  return { x: origin.x === 0 ? 'low' : 'high', y: origin.y === 0 ? 'low' : 'high' };
}

/**
 * Snap a candidate to the block grid the way export will, then shrink it to the
 * exact ratio while holding the aligned corner, so Save never adjusts it again.
 * The result is never smaller than the candidate in its limiting dimension.
 */
export function snapToAspect(candidate, ratio, info) {
  const snapped = snapCrop(candidate, info).display;
  return constrainAspect(snapped, ratio, { ...alignedAnchor(info), drive: 'fit' }, info);
}

/** The largest rectangle of `ratio` inside `rect`, centred, then aligned. */
export function fitAspect(rect, ratio, info) {
  return snapToAspect(constrainAspect(rect, ratio, { drive: 'fit' }, info), ratio, info);
}

/** Which edges stay put, and which side drives the size, for a resize handle. */
export function handleAnchor(handle) {
  return {
    x: handle.includes('w') ? 'high' : handle.includes('e') ? 'low' : 'center',
    y: handle.includes('n') ? 'high' : handle.includes('s') ? 'low' : 'center',
    drive: handle.length === 2 ? 'cover' : /[we]/.test(handle) ? 'width' : 'height',
  };
}

/** For a drawn crop: keep the corner where the drag started. */
export function drawAnchor(rect, start) {
  return {
    x: Math.abs(rect.x - start.x) <= Math.abs(rect.x + rect.width - start.x) ? 'low' : 'high',
    y: Math.abs(rect.y - start.y) <= Math.abs(rect.y + rect.height - start.y) ? 'low' : 'high',
    drive: 'cover',
  };
}
