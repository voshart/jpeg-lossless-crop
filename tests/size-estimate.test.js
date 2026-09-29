import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSize, sizeComparison } from '../web/src/size-estimate.js';

test('file sizes and differences describe actual output bytes', () => {
  assert.equal(formatSize(999), '999 B');
  assert.equal(formatSize(1500), '1.5 KB');
  assert.equal(formatSize(2_500_000), '2.5 MB');
  assert.equal(sizeComparison(2000, 1000), '1 KB output · 1 KB smaller (50%)');
  assert.equal(sizeComparison(1000, 1100), '1.1 KB output · 100 B larger (10%)');
  assert.equal(sizeComparison(1000, 1000), '1 KB output · same size');
});
