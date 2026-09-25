import test from 'node:test';
import assert from 'node:assert/strict';
import { rawToDisplay, snapCrop } from '../web/src/geometry.js';
import { snapPoint, drawCrop, resizeCrop, moveCrop, handlePoint } from '../web/src/crop-interaction.js';

function info(orientation = 1, mcuWidth = 16, mcuHeight = 8) {
  return { width: 101, height: 79, mcuWidth, mcuHeight, orientation,
    displayWidth: orientation >= 5 ? 79 : 101, displayHeight: orientation >= 5 ? 101 : 79 };
}
function assertAligned(rect, image) {
  assert.ok(rect.width > 0 && rect.height > 0);
  assert.deepEqual(snapCrop(rect, image).display, rect, 'Export must not resnap a displayed selection');
}

test('hover finds the nearest boundary including short image-edge blocks', () => {
  assert.deepEqual(snapPoint({x:25,y:18}, info()), {x:32,y:16});
  assert.deepEqual(snapPoint({x:100,y:78}, info()), {x:101,y:79});
  assert.deepEqual(snapPoint({x:-20,y:900}, info()), {x:0,y:79});
  assert.deepEqual(snapPoint({x:8,y:4}, info()), {x:0,y:0});
  assert.throws(() => snapPoint({x:NaN,y:0}, info()));
});
test('hover uses the true transformed grid, not multiples from displayed zero', () => {
  const image = info(2);
  assert.deepEqual(snapPoint({x:6,y:18}, image), {x:5,y:16});
  for (let o=1;o<=8;o++) for (const sampling of [[8,8],[16,8],[8,16],[16,16]]) {
    const image=info(o,...sampling);
    const points=[];
    for (let x=0;x<101;x+=image.mcuWidth) for(let y=0;y<79;y+=image.mcuHeight) {
      const r=rawToDisplay({x,y,width:0,height:0},image); points.push({x:r.x,y:r.y});
    }
    for (const point of points) assert.deepEqual(snapPoint(point,image),point);
  }
});
test('draw starts at the previewed intersection and works in all drag directions', () => {
  for (let o=1;o<=8;o++) {
    const image=info(o), a=snapPoint({x:20,y:19},image), b=snapPoint({x:68,y:56},image);
    const rect=drawCrop(a,b,image); assertAligned(rect,image);
    assert.deepEqual(drawCrop(b,a,image),rect);
    assert.equal(rect.x,Math.min(a.x,b.x)); assert.equal(rect.y,Math.min(a.y,b.y));
    assert.equal(rect.x+rect.width,Math.max(a.x,b.x));
    assert.equal(rect.y+rect.height,Math.max(a.y,b.y));
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
test('partial edge block locks its move axis instead of changing crop size', () => {
  const image=info(),r={x:80,y:16,width:21,height:24};
  assert.deepEqual(moveCrop(r,{x:-16,y:16},image),{x:80,y:32,width:21,height:24});
  for (let o=1;o<=8;o++) {
    const image=info(o),r=rawToDisplay({x:80,y:64,width:21,height:15},image);
    assert.deepEqual(moveCrop(r,{x:-50,y:-50},image),r);
  }
});
test('edge and corner anchor positions are correct', () => {
  assert.deepEqual(handlePoint({x:16,y:8,width:32,height:24},'nw'),{x:16,y:8});
  assert.deepEqual(handlePoint({x:16,y:8,width:32,height:24},'e'),{x:48,y:20});
});
