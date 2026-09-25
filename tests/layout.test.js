import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../web/index.html');

test('compact layout preserves every control used by the application', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
  const scripts = read('../web/src/app.js') + read('../web/src/crop-interaction.js');
  const used = [...scripts.matchAll(/\$\('([a-z][a-z0-9-]*)'\)/g)].map(match => match[1]);
  for (const id of new Set([...used, 'x', 'y', 'width', 'height', 'selection', 'adjustment'])) {
    assert.ok(ids.includes(id), `Missing control: ${id}`);
  }
  assert.match(html, /aria-controls="side-panel"/);
  assert.match(html, /id="error" role="alert"/);
  assert.match(html, /id="status" role="status" aria-live="polite"/);
});

test('drop instructions replace the marketing heading without removing safety help', () => {
  assert.doesNotMatch(html, /class="intro"|Don’t recompress\.|No quality slider|Lossless or an error/);
  const empty = html.match(/<div id="empty"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(empty, 'The empty image drop area must exist');
  assert.match(empty, /Drop a JPEG here/);
  assert.match(empty, /id="open-empty"[^>]*>Open JPEG<\/button>/);
  assert.match(html, /Not a secure-redaction tool/);
  assert.match(html, /id="metadata-note"/);
});
