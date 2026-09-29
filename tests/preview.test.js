import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewScale, wheelScale, pinchScale, focusScale } from '../web/src/preview.js';

const landscape = Object.freeze({ displayWidth: 1600, displayHeight: 1200 });
test('Fit uses both available dimensions and never enlarges a small image', () => {
  assert.equal(previewScale('fit', landscape, 800, 900), 0.5);
  assert.equal(previewScale('fit', landscape, 1600, 300), 0.25);
  assert.equal(previewScale('fit', landscape, 3000, 2400), 1);
  const portrait = { displayWidth: 1200, displayHeight: 1600 };
  assert.equal(previewScale('fit', portrait, 800, 800), 0.5);
});
test('fixed zoom is independent of viewport and does not modify image metadata', () => {
  for (const mode of ['1', '2', '4']) {
    assert.equal(previewScale(mode, landscape, 10, 10), Number(mode));
    assert.equal(previewScale(mode, landscape, 4000, 3000), Number(mode));
  }
  assert.deepEqual(landscape, { displayWidth: 1600, displayHeight: 1200 });
  assert.throws(() => previewScale('invalid', landscape, 800, 600));
});
test('Fit remains finite and positive while a panel is temporarily zero-sized', () => {
  const scale = previewScale('fit', landscape, 0, -50);
  assert.ok(Number.isFinite(scale) && scale > 0 && scale <= 1);
});
test('wheel zoom moves smoothly between Fit and 400%', () => {
  assert.ok(wheelScale(.5, .25, -100) > .5);
  assert.ok(wheelScale(.5, .25, 100) < .5);
  assert.equal(wheelScale(.25, .25, 100), .25);
  assert.equal(wheelScale(4, .25, -100), 4);
});
test('pinch zoom follows finger spread between Fit and 400%', () => {
  assert.equal(pinchScale(.5, .25, 100, 200), 1);
  assert.equal(pinchScale(.5, .25, 100, 10), .25);
  assert.equal(pinchScale(2, .25, 100, 400), 4);
  assert.ok(Number.isFinite(pinchScale(.5, .25, 0, 50)));
});
test('auto-zoom enlarges a small new crop to part of the view, never away from it', () => {
  // 400 x 300 crop at 0.1 occupies 40 x 30 of an 800 x 600 view: zoom in.
  const target = focusScale({ x: 0, y: 0, width: 400, height: 300 }, .1, 800, 600);
  assert.ok(Math.abs(target - 1.3) < 1e-9);
  assert.ok(Math.max(400 * target / 800, 300 * target / 600) < 1, 'crop keeps a margin');
  // Already prominent: leave the zoom alone.
  assert.equal(focusScale({ x: 0, y: 0, width: 400, height: 300 }, 1, 800, 600), null);
  assert.equal(focusScale({ x: 0, y: 0, width: 400, height: 300 }, .95, 800, 600), null);
  // Tiny crops stop at the 400% preview limit, and a small final step is skipped.
  assert.equal(focusScale({ x: 0, y: 0, width: 8, height: 8 }, .1, 800, 600), 4);
  assert.equal(focusScale({ x: 0, y: 0, width: 8, height: 8 }, 3.5, 800, 600), null);
  assert.ok(Number.isFinite(focusScale({ x: 0, y: 0, width: 400, height: 300 }, .1, 0, -5) ?? 0));
});
test('save and cancel are available outside the sidebar and share handlers', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const outsidePanel = html.slice(html.indexOf('</aside>') + '</aside>'.length);
  assert.match(outsidePanel, /id="save-toolbar"[^>]*disabled>Save crop<\/button>/);
  assert.match(outsidePanel, /id="cancel-toolbar"/);
  assert.match(outsidePanel, /id="zoom"[^>]*disabled/);
  const app = readFileSync(new URL('../web/src/app.js', import.meta.url), 'utf8');
  assert.match(app, /\['save', 'save-toolbar'\][^\n]*addEventListener\('click', saveCrop\)/);
  assert.match(app, /\['cancel', 'cancel-toolbar'\][^\n]*pendingCancel/);
});
