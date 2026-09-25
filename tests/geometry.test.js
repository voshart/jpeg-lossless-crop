import test from 'node:test';
import assert from 'node:assert/strict';
import { displayToRaw, rawToDisplay, snapCrop, retainedEdgeRects } from '../web/src/geometry.js';
const base = {width:101,height:79,mcuWidth:16,mcuHeight:16};
test('all orientation transforms invert and map the whole image correctly', () => {
  for (let orientation=1; orientation<=8; orientation++) {
    const info={...base,orientation};
    for (let x=0;x<80;x+=7) for (let y=0;y<60;y+=9) {
      const r={x,y,width:17,height:13};
      assert.deepEqual(displayToRaw(rawToDisplay(r,info),info),r);
    }
    const whole=rawToDisplay({x:0,y:0,width:101,height:79},info);
    assert.deepEqual(whole,{x:0,y:0,width:orientation>=5?79:101,height:orientation>=5?101:79});
  }
});
test('aligns raw top/left, preserves exact lower-right pixels, and is idempotent', () => {
  for (let orientation=1;orientation<=8;orientation++) {
    const info={...base,orientation};
    for (const raw of [{x:17,y:18,width:31,height:27},{x:90,y:70,width:11,height:9}]) {
      const r=snapCrop(rawToDisplay(raw,info),info);
      assert.equal(r.raw.x%16,0); assert.equal(r.raw.y%16,0);
      assert.ok(r.raw.x<=raw.x && r.raw.y<=raw.y);
      assert.equal(r.raw.x+r.raw.width,raw.x+raw.width);
      assert.equal(r.raw.y+r.raw.height,raw.y+raw.height);
      assert.ok(r.raw.x+r.raw.width<=101 && r.raw.y+r.raw.height<=79);
      assert.deepEqual(snapCrop(r.display,info),r);
    }
  }
});
test('rejects non-finite, empty and fully out-of-bounds selections', () => {
  const info={...base,orientation:1};
  for (const r of [{x:NaN,y:0,width:1,height:1},{x:0,y:0,width:0,height:2},{x:102,y:0,width:4,height:4}]) {
    assert.throws(() => snapCrop(r,info));
  }
});

test('retained edge markers cover only source pixels beyond exact crop dimensions', () => {
  const info={...base,orientation:1};
  const raw={x:16,y:16,width:37,height:23};
  assert.deepEqual(retainedEdgeRects(raw,info),[
    {x:53,y:16,width:11,height:32},
    {x:16,y:39,width:37,height:9},
  ]);
  assert.deepEqual(retainedEdgeRects({x:80,y:64,width:21,height:15},info),[]);
  const mirrored={...base,orientation:2};
  const [right]=retainedEdgeRects(raw,mirrored).map(r=>rawToDisplay(r,mirrored));
  assert.deepEqual(right,{x:37,y:16,width:11,height:32});
});
