import test from 'node:test';
import assert from 'node:assert/strict';
import { rawToDisplay, snapCrop } from '../web/src/geometry.js';
import { drawCrop, resizeCrop, moveCrop, handlePoint } from '../web/src/crop-interaction.js';

function info(orientation = 1, mcuWidth = 16, mcuHeight = 8) {
  return { width: 101, height: 79, mcuWidth, mcuHeight, orientation,
    displayWidth: orientation >= 5 ? 79 : 101, displayHeight: orientation >= 5 ? 101 : 79 };
}
function assertAligned(rect, image) {
  assert.ok(rect.width > 0 && rect.height > 0);
  assert.deepEqual(snapCrop(rect, image).display, rect, 'Export must not resnap a displayed selection');
}

test('draw keeps pixel-exact free edges in all drag directions', () => {
  for (let o=1;o<=8;o++) {
    const image=info(o), a={x:20,y:19}, b={x:68,y:56};
    const rect=drawCrop(a,b,image); assertAligned(rect,image);
    assert.deepEqual(drawCrop(b,a,image),rect);
    const raw=snapCrop(rect,image).raw;
    const requested=snapCrop({x:20,y:19,width:48,height:37},image).raw;
    assert.deepEqual(raw,requested);
    assert.equal(drawCrop(a,a,image),null);
  }
});
test('every resize handle stays aligned, clamps, and keeps opposite edges fixed', () => {
  for (let o=1;o<=8;o++) {
    const image=info(o), r=rawToDisplay({x:16,y:16,width:48,height:32},image);
    for (const handle of ['n','ne','e','se','s','sw','w','nw']) {
      for (let x=-10;x<=120;x+=7) for (let y=-10;y<=120;y+=11) {
        const out=resizeCrop(r,handle,{x,y},image); assertAligned(out,image);
        if(!handle.includes('w')) assert.equal(out.x,r.x);
        if(!handle.includes('e')) assert.equal(out.x+out.width,r.x+r.width);
        if(!handle.includes('n')) assert.equal(out.y,r.y);
        if(!handle.includes('s')) assert.equal(out.y+out.height,r.y+r.height);
      }
    }
  }
});
test('move preserves size and stays in bounds for every EXIF orientation', () => {
  for (let o=1;o<=8;o++) {
    const image=info(o), r=rawToDisplay({x:16,y:16,width:32,height:24},image);
    for (let x=-200;x<=200;x+=13) for(let y=-200;y<=200;y+=17) {
      const out=moveCrop(r,{x,y},image); assertAligned(out,image);
      assert.equal(out.width,r.width); assert.equal(out.height,r.height);
      assert.ok(out.x>=0&&out.y>=0&&out.x+out.width<=image.displayWidth&&out.y+out.height<=image.displayHeight);
    }
  }
});
test('a partial final block can move in whole MCU steps without changing size', () => {
  const image=info(),r={x:80,y:16,width:21,height:24};
  assert.deepEqual(moveCrop(r,{x:-16,y:16},image),{x:64,y:32,width:21,height:24});
  for (let o=1;o<=8;o++) {
    const image=info(o),r=rawToDisplay({x:32,y:16,width:21,height:15},image);
    const out=moveCrop(r,{x:50,y:50},image);
    assertAligned(out,image);
    assert.equal(out.width,r.width); assert.equal(out.height,r.height);
  }
});
test('resize uses single pixels on free edges and blocks on constrained edges', () => {
  const normal=info(), r={x:16,y:16,width:48,height:32};
  assert.deepEqual(resizeCrop(r,'se',{x:53,y:39},normal),{x:16,y:16,width:37,height:23});
  assert.deepEqual(resizeCrop(r,'nw',{x:23,y:21},normal),{x:16,y:24,width:48,height:24});
  const mirrored=info(2), m=rawToDisplay(r,mirrored);
  assert.equal(resizeCrop(m,'w',{x:43,y:32},mirrored).x,43);
  const east=resizeCrop(m,'e',{x:70,y:32},mirrored);
  assert.equal(east.x+east.width,69);
  for (let o=1;o<=8;o++) {
    const image=info(o);
    const origin=rawToDisplay({x:0,y:0,width:0,height:0},image);
    const handle=(origin.y===0?'s':'n')+(origin.x===0?'e':'w');
    const base=rawToDisplay({x:16,y:16,width:48,height:32},image);
    const exact=rawToDisplay({x:16,y:16,width:37,height:23},image);
    assert.deepEqual(resizeCrop(base,handle,handlePoint(exact,handle),image),exact);
  }
});
test('edge and corner anchor positions are correct', () => {
  assert.deepEqual(handlePoint({x:16,y:8,width:32,height:24},'nw'),{x:16,y:8});
  assert.deepEqual(handlePoint({x:16,y:8,width:32,height:24},'e'),{x:48,y:20});
});
