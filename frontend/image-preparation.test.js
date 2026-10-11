import test from 'node:test';
import assert from 'node:assert/strict';
import {imageSize, visibleImageFrame} from './image-preparation.js';
test('image bounds preserve proportions without upscaling',()=>{
 assert.deepEqual(imageSize(4000,2000),{width:1920,height:960});
 assert.deepEqual(imageSize(1000,4000),{width:270,height:1080});
 assert.deepEqual(imageSize(80,60),{width:80,height:60});
});
test('phone safe frame matches centred cover crop of desktop picture',()=>{
 const frame=visibleImageFrame(1920,1080,390/844);
 assert.equal(frame.height,100);assert.equal(frame.top,0);
 assert.ok(Math.abs(frame.width-25.9923)<.001);
 assert.ok(Math.abs(frame.left*2+frame.width-100)<1e-10);
 assert.deepEqual(visibleImageFrame(1920,1080,16/9),{left:0,top:0,width:100,height:100});
});
