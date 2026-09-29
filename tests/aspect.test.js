import test from 'node:test';
import assert from 'node:assert/strict';
import { snapCrop } from '../web/src/geometry.js';
import { parseAspect, swapAspect, constrainAspect, fitAspect, snapToAspect, alignedAnchor, handleAnchor, drawAnchor } from '../web/src/aspect.js';

const image = { width: 1000, height: 800, displayWidth: 1000, displayHeight: 800, mcuWidth: 16, mcuHeight: 16, orientation: 1 };
const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.width <= image.displayWidth && r.y + r.height <= image.displayHeight;
const close = (r, ratio) => Math.abs(r.width - r.height * ratio) <= .5 + ratio * .5 + 1e-9;

test('aspect values parse, and turning a photo swaps a locked ratio', () => {
  assert.equal(parseAspect('free', image), null);
  assert.equal(parseAspect('16:9', image), 16 / 9);
  assert.equal(parseAspect('original', image), 1.25);
  assert.throws(() => parseAspect('0:3', image));
  assert.throws(() => parseAspect('wide', image));
  assert.equal(swapAspect('3:2'), '2:3');
  assert.equal(swapAspect('original'), 'original');
  assert.equal(swapAspect('free'), 'free');
});
test('fit picks the largest centred ratio rectangle inside the current crop', () => {
  const whole = { x: 0, y: 0, width: 1000, height: 800 };
  const square = constrainAspect(whole, 1, { drive: 'fit' }, image);
  assert.deepEqual(square, { x: 100, y: 0, width: 800, height: 800 });
  const wide = fitAspect(whole, 16 / 9, image);
  assert.ok(wide.width <= 1000 && close(wide, 16 / 9) && inside(wide));
  const tall = fitAspect({ x: 200, y: 100, width: 300, height: 400 }, 9 / 16, image);
  assert.ok(close(tall, 9 / 16) && inside(tall));
});
test('a chosen ratio is exact after block alignment in every EXIF orientation', () => {
  // A partial final block and a crop whose centred position is off the block grid.
  for (let orientation = 1; orientation <= 8; orientation++) {
    const info = { width: 1001, height: 757, mcuWidth: 16, mcuHeight: 16, orientation,
      displayWidth: orientation >= 5 ? 757 : 1001, displayHeight: orientation >= 5 ? 1001 : 757 };
    const inImage = r => r.x >= 0 && r.y >= 0 && r.x + r.width <= info.displayWidth && r.y + r.height <= info.displayHeight;
    for (const ratio of [1, 4 / 3, 3 / 2, 16 / 9, 3 / 4, 9 / 16]) {
      for (const rect of [{ x: 0, y: 0, width: info.displayWidth, height: info.displayHeight },
        { x: 37, y: 21, width: 415, height: 403 }, { x: 101, y: 205, width: 260, height: 300 }]) {
        if (rect.x + rect.width > info.displayWidth || rect.y + rect.height > info.displayHeight) continue;
        const out = fitAspect(rect, ratio, info);
        assert.ok(inImage(out), `o${orientation} ${ratio} ${JSON.stringify(out)}`);
        assert.ok(close(out, ratio), `o${orientation} ${ratio} ${JSON.stringify(out)}`);
        assert.deepEqual(snapCrop(out, info).display, out, 'Save must not adjust an aligned ratio crop');
        const raw = snapCrop(out, info).raw;
        assert.equal(raw.x % 16, 0); assert.equal(raw.y % 16, 0);
      }
    }
  }
});
test('the aligned corner follows the raw origin', () => {
  assert.deepEqual(alignedAnchor({ ...image, orientation: 1 }), { x: 'low', y: 'low' });
  assert.deepEqual(alignedAnchor({ ...image, orientation: 2 }), { x: 'high', y: 'low' });
  assert.deepEqual(alignedAnchor({ ...image, orientation: 3 }), { x: 'high', y: 'high' });
});
test('constraining while dragging keeps the ratio, holds the anchor and stays in the image', () => {
  for (const ratio of [1, 4 / 3, 3 / 4, 16 / 9, 9 / 16, 2 / 3]) {
    for (const handle of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
      const anchor = handleAnchor(handle);
      for (const rect of [{ x: 96, y: 80, width: 400, height: 300 }, { x: 0, y: 0, width: 1000, height: 800 },
        { x: 900, y: 700, width: 100, height: 100 }, { x: 32, y: 48, width: 17, height: 250 }]) {
        const out = constrainAspect(rect, ratio, anchor, image);
        assert.ok(inside(out), `${handle} ${ratio} ${JSON.stringify(out)}`);
        assert.ok(out.width >= 1 && out.height >= 1);
        // Growth can be clipped by the image edge, which changes the ratio by rounding only.
        assert.ok(close(out, ratio), `${handle} ${ratio} ${JSON.stringify(out)}`);
        if (anchor.x === 'low') assert.equal(out.x, rect.x);
        if (anchor.x === 'high') assert.equal(out.x + out.width, rect.x + rect.width);
        if (anchor.y === 'low') assert.equal(out.y, rect.y);
        if (anchor.y === 'high') assert.equal(out.y + out.height, rect.y + rect.height);
      }
    }
  }
});
test('snapping a dragged candidate keeps its ratio and never shrinks it below the drag', () => {
  const candidate = constrainAspect({ x: 100, y: 83, width: 400, height: 300 }, 16 / 9, handleAnchor('nw'), image);
  const out = snapToAspect(candidate, 16 / 9, image);
  assert.ok(close(out, 16 / 9));
  assert.deepEqual(snapCrop(out, image).display, out);
  assert.ok(out.width >= candidate.width - 1);
});
test('drawn crops keep the corner where the drag began', () => {
  const rect = { x: 160, y: 96, width: 200, height: 120 };
  assert.deepEqual(drawAnchor(rect, { x: 160, y: 96 }), { x: 'low', y: 'low', drive: 'cover' });
  assert.deepEqual(drawAnchor(rect, { x: 360, y: 216 }), { x: 'high', y: 'high', drive: 'cover' });
  assert.throws(() => constrainAspect(rect, 0, {}, image));
});
