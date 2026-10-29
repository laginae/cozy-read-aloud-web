import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './pdf-golden-fixtures.cjs';
import core from '@laginae/note-reader-core';
import {buildQueue,queueBlocks} from '../src/speech-queue.js';
import {selectedPdfBlocks,mapPdfItems} from '../src/pdf-selection.js';
const settings={academic:true,mathMode:'smart',mathLanguage:'english'};
const compact=items=>items.map(x=>x.text).join(' ').replace(/\s+/g,' ').trim();
for(const f of fixtures.cases)test('PDF golden full and source-selected queue: '+f.name,()=>{
 const layout=core.extractPdfTextLayout(f.items,{viewport:fixtures.viewport});
 const page={text:layout.text,layout,items:f.items};
 const doc={id:'public-pdf',kind:'pdf',blocks:[{raw:layout.text,lines:layout.lines,pageData:page,page:1}]};
 mapPdfItems(doc,page);
 assert.equal(compact(buildQueue(doc,settings)),f.golden);
 const snapshot={docId:doc.id,parts:doc.blocks[0].runs.map(r=>({block:0,itemIndex:r.itemIndex,start:0,end:r.item.str.length}))};
 assert.equal(compact(queueBlocks(doc,selectedPdfBlocks(doc,snapshot),settings)),f.golden);
 const duplicate=f.name==='repeated text scope';
 if(duplicate){snapshot.parts=snapshot.parts.slice(-1);const queue=queueBlocks(doc,selectedPdfBlocks(doc,snapshot,true),settings);assert.equal(compact(queue),'Same public sentence.');assert.deepEqual(queue.map(x=>x.targets),[[0]]);}
});
