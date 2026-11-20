import test from 'node:test';
import assert from 'node:assert/strict';
import { previewRows as formatRows } from '../src/reading-preview.js';
import { formatPreviewSample } from '../src/speech-queue.js';
const previewRows=(s,lang)=>formatRows(s,lang,formatPreviewSample);
import { safePreferences } from '../src/preferences.js';
import { passageSeek } from '../src/passage-seek.js';
test('a passage slider commits once and discards a drag across a document change',()=>{
  const input=new EventTarget(), jumps=[];let queue=[1,2,3];const fire=type=>input.dispatchEvent(new Event(type));
  const sync=passageSeek(input,()=>queue,n=>jumps.push(n));sync(0,3);
  fire('pointerdown');input.value='2';fire('input');sync(0,3);assert.equal(input.value,'2');
  fire('pointerup');fire('change');assert.deepEqual(jumps,[2]);
  fire('pointerdown');fire('input');queue=[1];sync(0,1);fire('input');fire('change');assert.deepEqual(jumps,[2]);
});
test('fixed examples use real queue options in both languages; verbose is independent',()=>{
  for(const lang of ['en','zh-CN']){
    const s={academic:true,mathLanguage:'auto',mathMode:'smart'};
    const simple={...s,academicFunctionStyle:'compact',academicIntervalStyle:'range',academicTableRepeatHeaders:false};
    const a=previewRows(s,lang),b=previewRows(simple,lang);
    assert.equal(a.length,3);
    for(let i=0;i<3;i++){assert.equal(a[i][0],b[i][0]);assert.notEqual(a[i][1],b[i][1]);}
    assert.equal(previewRows({...s,mathMode:'all'},lang)[0][1],previewRows({...simple,mathMode:'all'},lang)[0][1]);
    assert.deepEqual(safePreferences({academicFunctionStyle:'compact',academicIntervalStyle:'invalid',key:'not stored'}),{academicFunctionStyle:'compact'});
  }
});
