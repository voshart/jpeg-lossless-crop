/** Header-only JPEG parsing. No pixel decoding or image encoding. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PIXELS = 100_000_000;

function exifOrientation(bytes, start, end) {
  const signature = [69, 120, 105, 102, 0, 0];
  if (end - start < 6 || !signature.every((v, i) => bytes[start + i] === v)) return null;
  const tiff = start + 6;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  function check(offset, size) {
    if (!Number.isSafeInteger(offset) || offset < tiff || offset + size > end) {
      throw new Error('Malformed EXIF metadata: an offset is outside its JPEG segment.');
    }
  }
  check(tiff, 8);
  const byteOrder = view.getUint16(tiff);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) throw new Error('Invalid EXIF byte order.');
  const little = byteOrder === 0x4949;
  const u16 = p => { check(p, 2); return view.getUint16(p, little); };
  const u32 = p => { check(p, 4); return view.getUint32(p, little); };
  if (u16(tiff + 2) !== 42) throw new Error('Invalid EXIF TIFF header.');
  const offset = u32(tiff + 4);
  if (!offset) return null;
  const directory = tiff + offset;
  const count = u16(directory);
  check(directory + 2, count * 12 + 4);
  let orientation = null;
  for (let n = 0; n < count; n++) {
    const entry = directory + 2 + n * 12;
    if (u16(entry) !== 0x0112) continue;
    if (u16(entry + 2) !== 3 || u32(entry + 4) !== 1) throw new Error('Unsupported EXIF orientation field.');
    const value = u16(entry + 8);
    if (value < 1 || value > 8) throw new Error('Invalid EXIF orientation.');
    if (orientation !== null && value !== orientation) throw new Error('Conflicting EXIF orientation fields.');
    orientation = value;
  }
  return orientation;
}

export function parseJpeg(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected JPEG bytes.');
  if (bytes.length > MAX_FILE_BYTES) throw new Error('This starter accepts JPEGs up to 50 MiB.');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('This is not a JPEG file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 2, frame = null, orientation = null;
  while (p < bytes.length) {
    if (bytes[p++] !== 0xff) throw new Error('Malformed JPEG marker.');
    while (p < bytes.length && bytes[p] === 0xff) p++;
    if (p >= bytes.length) throw new Error('Truncated JPEG marker.');
    const marker = bytes[p++];
    if (marker === 0xda) {
      if (!frame || p + 2 > bytes.length) throw new Error('JPEG has no complete image header.');
      const length = view.getUint16(p);
      if (length < 6 || p + length > bytes.length) throw new Error('Truncated JPEG scan header.');
      const o = orientation ?? 1;
      return { ...frame, orientation: o,
        displayWidth: o >= 5 ? frame.height : frame.width,
        displayHeight: o >= 5 ? frame.width : frame.height };
    }
    if (marker === 0xd9) break;
    if (marker === 0x01) continue;
    if (marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw new Error('Unexpected JPEG marker.');
    if (p + 2 > bytes.length) throw new Error('Truncated JPEG segment.');
    const length = view.getUint16(p), start = p + 2, end = p + length;
    if (length < 2 || end > bytes.length) throw new Error('Truncated JPEG segment.');
    if (marker === 0xe1) {
      const value = exifOrientation(bytes, start, end);
      if (value !== null) {
        if (orientation !== null && orientation !== value) throw new Error('Conflicting EXIF orientations.');
        orientation = value;
      }
    }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      if (frame) throw new Error('Multiple JPEG frames are not supported.');
      if (![0xc0, 0xc1, 0xc2].includes(marker)) throw new Error('Only baseline and progressive DCT JPEGs are supported.');
      if (length < 8 || bytes[start] !== 8) throw new Error('Only 8-bit JPEGs are supported.');
      const height = view.getUint16(start + 1), width = view.getUint16(start + 3);
      const components = bytes[start + 5];
      if (![1, 3, 4].includes(components) || length !== 8 + components * 3) throw new Error('Invalid JPEG component header.');
      if (!width || !height || width * height > MAX_PIXELS) throw new Error('Invalid dimensions or image larger than 100 megapixels.');
      let maxH = 1, maxV = 1;
      const ids = new Set();
      for (let n = 0; n < components; n++) {
        const index = start + 6 + n * 3;
        const id = bytes[index], h = bytes[index + 1] >> 4, v = bytes[index + 1] & 15;
        if (ids.has(id) || h < 1 || h > 4 || v < 1 || v > 4) throw new Error('Invalid JPEG sampling factors.');
        ids.add(id); maxH = Math.max(maxH, h); maxV = Math.max(maxV, v);
      }
      frame = { width, height, mcuWidth: components === 1 ? 8 : 8 * maxH,
        mcuHeight: components === 1 ? 8 : 8 * maxV };
    }
    p = end;
  }
  throw new Error('JPEG scan header was not found.');
}

/** Add only display orientation, not the source EXIF (which may contain GPS or thumbnails). */
export function withOrientation(bytes, orientation) {
  if (!(bytes instanceof Uint8Array) || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('The JPEG engine returned invalid output.');
  if (!Number.isInteger(orientation) || orientation < 1 || orientation > 8) throw new Error('Invalid orientation.');
  if (orientation === 1) return bytes;
  const exif = new Uint8Array([
    0xff,0xe1,0,34, 69,120,105,102,0,0, 0x4d,0x4d,0,42,0,0,0,8,
    0,1, 1,0x12,0,3,0,0,0,1, 0,orientation,0,0, 0,0,0,0,
  ]);
  const result = new Uint8Array(bytes.length + exif.length);
  result.set(bytes.subarray(0, 2)); result.set(exif, 2); result.set(bytes.subarray(2), 2 + exif.length);
  return result;
}
