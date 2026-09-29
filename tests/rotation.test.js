import test from 'node:test';
import assert from 'node:assert/strict';
import { rawToDisplay } from '../web/src/geometry.js';
import { rotationPlan, rotateDisplayRect } from '../web/src/rotation.js';

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
  assert.deepEqual(rotationPlan(info,'right'),{degrees:90,cutPixels:7,trim:true,edge:'bottom'});
  assert.deepEqual(rotationPlan(info,'left'),{degrees:270,cutPixels:5,trim:true,edge:'right'});
  assert.deepEqual(rotationPlan({...info,orientation:2},'right'),{degrees:270,cutPixels:5,trim:true,edge:'left'});
  assert.throws(()=>rotationPlan(info,'up'));
  assert.throws(() => rotationPlan({ ...info, height: 7 }, 'right'), /too small/);
});

test('trim warnings name the edge visible before turning for every EXIF orientation', () => {
  const edges = [
    ['bottom', 'right'], ['bottom', 'left'], ['top', 'left'], ['top', 'right'],
    ['right', 'bottom'], ['left', 'bottom'], ['left', 'top'], ['right', 'top'],
  ];
  const info = { width: 101, height: 79, mcuWidth: 16, mcuHeight: 8 };
  for (let orientation = 1; orientation <= 8; orientation++) {
    for (const direction of ['left', 'right']) {
      const plan = rotationPlan({ ...info, orientation }, direction);
      const rawEdge = plan.degrees === 90 ? 0 : 1;
      assert.equal(plan.edge, edges[orientation - 1][rawEdge], `${orientation} ${direction}`);
    }
  }
});

test('a crop is carried through an untrimmed turn in every EXIF orientation', () => {
  const rect={x:16,y:8,width:24,height:32};
  for (let orientation=1;orientation<=8;orientation++) {
    const info={width:96,height:80,mcuWidth:16,mcuHeight:16,orientation};
    info.displayWidth=orientation>=5?80:96; info.displayHeight=orientation>=5?96:80;
    const displayed=rawToDisplay(rect,info);
    for (const direction of ['left','right']) {
      const plan=rotationPlan(info,direction);
      const after=rawToDisplay(rotateRect(rect,info.width,info.height,plan.degrees),{...info,width:info.height,height:info.width});
      assert.deepEqual(rotateDisplayRect(displayed,info,direction,plan),after);
    }
  }
});

test('a trimmed turn cuts the removed strip from the crop before rotating', () => {
  const info={width:101,height:79,mcuWidth:16,mcuHeight:8,orientation:1,displayWidth:101,displayHeight:79};
  const right=rotationPlan(info,'right');    // trims 7 px from the bottom
  assert.deepEqual(rotateDisplayRect({x:16,y:8,width:32,height:71},info,'right',right),{x:0,y:16,width:64,height:32});
  assert.deepEqual(rotateDisplayRect({x:0,y:0,width:101,height:79},info,'right',right),{x:0,y:0,width:72,height:101});
  const left=rotationPlan(info,'left');      // trims 5 px from the right
  assert.deepEqual(rotateDisplayRect({x:16,y:8,width:85,height:32},info,'left',left),{x:8,y:0,width:32,height:80});
  // A crop lying entirely inside the removed strip leaves nothing.
  assert.equal(rotateDisplayRect({x:0,y:73,width:101,height:6},info,'right',right),null);
  assert.throws(()=>rotateDisplayRect({x:0,y:0,width:1,height:1},info,'up',right));
  // A strip on the left or top shifts the crop's origin.
  const mirrored={...info,orientation:2};
  const mirroredPlan=rotationPlan(mirrored,'right');
  assert.equal(mirroredPlan.edge,'left');
  assert.deepEqual(rotateDisplayRect({x:5,y:0,width:20,height:16},mirrored,'right',mirroredPlan),{x:63,y:0,width:16,height:20});
});
