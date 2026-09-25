import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJpeg, withOrientation } from '../web/src/jpeg.js';

// Header fixtures test parsing, not JPEG decoding or coefficient preservation.
function fixture({width=101, height=79, sampling=0x22, grayscale=false, progressive=false}={}) {
  const components = grayscale ? [1,sampling,0] : [1,sampling,0,2,0x11,1,3,0x11,1];
  return new Uint8Array([0xff,0xd8,0xff,progressive ? 0xc2 : 0xc0,
    0,8+components.length,8,height>>8,height&255,width>>8,width&255,components.length/3,
    ...components,0xff,0xda,0,8,1,1,0,0,63,0,0xff,0xd9]);
}
test('parses baseline and progressive headers and sampling factors', () => {
  for (const progressive of [false,true]) {
    const info = parseJpeg(fixture({ progressive }));
    assert.equal(info.width,101); assert.equal(info.height,79);
    assert.equal(info.mcuWidth,16); assert.equal(info.mcuHeight,16);
  }
  assert.equal(parseJpeg(fixture({sampling:0x21})).mcuHeight,8);
  assert.equal(parseJpeg(fixture({sampling:0x11})).mcuWidth,8);
  assert.equal(parseJpeg(fixture({grayscale:true})).mcuWidth,8);
});
test('reads all eight EXIF orientations, including metadata after SOF', () => {
  for (let orientation=1; orientation<=8; orientation++) {
    const bytes = withOrientation(fixture(), orientation);
    const info = parseJpeg(bytes);
    assert.equal(info.orientation,orientation);
    assert.equal(info.displayWidth,orientation>=5 ? 79 : 101);
    if (orientation>1) {
      const rearranged = new Uint8Array([...bytes.slice(0,2),...bytes.slice(38,57),...bytes.slice(2,38),...bytes.slice(57)]);
      assert.equal(parseJpeg(rearranged).orientation,orientation);
    }
  }
});
test('supports big- and little-endian 32-bit EXIF IFD offsets', () => {
  const bytes = withOrientation(fixture(),6);
  const view = new DataView(bytes.buffer);
  bytes.set([0x49,0x49],12); view.setUint16(14,42,true); view.setUint32(16,8,true);
  view.setUint16(20,1,true); view.setUint16(22,0x112,true); view.setUint16(24,3,true);
  view.setUint32(26,1,true); view.setUint16(30,6,true);
  assert.equal(parseJpeg(bytes).orientation,6);
  view.setUint32(16,0x10008,true);
  assert.throws(() => parseJpeg(bytes),/outside/);
});
test('metadata-free output adds only minimal orientation metadata', () => {
  const input = fixture();
  const output = withOrientation(input,8);
  assert.equal(output.length,input.length+36);
  assert.deepEqual(output.slice(38), input.slice(2));
  assert.equal(parseJpeg(output).orientation,8);
});
test('rejects invalid, truncated, unsupported and oversized image headers', () => {
  assert.throws(() => parseJpeg(new Uint8Array([1,2,3,4])),/not a JPEG/);
  assert.throws(() => parseJpeg(fixture().slice(0,10)),/Truncated/);
  const unsupported=fixture(); unsupported[3]=0xc3;
  assert.throws(() => parseJpeg(unsupported),/DCT/);
  assert.throws(() => parseJpeg(fixture({width:65000,height:65000})),/megapixels/);
  const exif=withOrientation(fixture(),6); exif[31]=9;
  assert.throws(() => parseJpeg(exif),/orientation/);
});
