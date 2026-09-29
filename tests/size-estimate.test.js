import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSize, sizeSummary } from '../web/src/size-estimate.js';

test('file sizes and differences describe actual output bytes', () => {
  assert.equal(formatSize(999), '999 B');
  assert.equal(formatSize(1500), '1.5 KB');
  assert.equal(formatSize(2_500_000), '2.5 MB');
  assert.equal(sizeSummary(2000, 1000), '1 KB · 50% smaller');
  assert.equal(sizeSummary(1000, 1100), '1.1 KB · 10% larger');
  assert.equal(sizeSummary(100000, 99800), '99.8 KB · <1% smaller');
  assert.equal(sizeSummary(1000, 1000), '1 KB');
  assert.equal(sizeSummary(1_400_000, 1_700_000, true), '1.7 MB');
});
