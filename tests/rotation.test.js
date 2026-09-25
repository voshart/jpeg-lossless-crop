import test from 'node:test';
import assert from 'node:assert/strict';
import { rawToDisplay } from '../web/src/geometry.js';
import { rotationPlan } from '../web/src/rotation.js';

function rotateRect(rect, width, height, degrees) {
  if (degrees === 90) return { x: height - rect.y - rect.height, y: rect.x,
    width: rect.height, height: rect.width };
  return { x: rect.y, y: width - rect.x - rect.width,
    width: rect.height, height: rect.width };
}

test('left and right turns follow displayed direction for every EXIF orientation', () => {
  const rect={x:16,y:8,width:24,height:32};
  for (let orientation=1;orientation<=8;orientation++) {
    const info={width:96,height:80,mcuWidth:16,mcuHeight:16,orientation};
    const displayed=rawToDisplay(rect,info);
    const displayedWidth=orientation>=5?80:96;
    const displayedHeight=orientation>=5?96:80;
    for (const direction of ['left','right']) {
      const plan=rotationPlan(info,direction);
      assert.equal(plan.trim,false);
      const newRaw=rotateRect(rect,info.width,info.height,plan.degrees);
      const after=rawToDisplay(newRaw,{...info,width:info.height,height:info.width});
      assert.deepEqual(after,rotateRect(displayed,displayedWidth,displayedHeight,
        direction==='right'?90:270));
    }
  }
});

test('partial source edges are identified before a turn', () => {
  const info={width:101,height:79,mcuWidth:16,mcuHeight:8,orientation:1};
  assert.deepEqual(rotationPlan(info,'right'),{degrees:90,cutPixels:7,trim:true});
  assert.deepEqual(rotationPlan(info,'left'),{degrees:270,cutPixels:5,trim:true});
  assert.deepEqual(rotationPlan({...info,orientation:2},'right'),{degrees:270,cutPixels:5,trim:true});
  assert.throws(()=>rotationPlan(info,'up'));
  assert.throws(() => rotationPlan({ ...info, height: 7 }, 'right'), /too small/);
});
