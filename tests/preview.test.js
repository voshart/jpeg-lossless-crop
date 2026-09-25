import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewScale } from '../web/src/preview.js';

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
