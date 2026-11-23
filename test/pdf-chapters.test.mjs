import test from 'node:test';
import assert from 'node:assert/strict';
import core from '@laginae/note-reader-core';
import {inferPdfChapters} from '../src/pdf-chapters.js';

test('inferred headings start their own playable block without changing original PDF text',()=>{
  const items=[],viewport={width:400,height:800,rotation:0,viewBox:[0,0,400,800],convertToViewportPoint:(x,y)=>[x,800-y]};
  const add=(str,x,y,width,fontName='body')=>items.push({str,fontName,width,height:10,transform:[10,0,0,10,x,y]});
  let y=720;
  for(const [str,x,w,font] of [['Public example text, with a full line of ordinary words.',40,240],
    ['I. DESIGN',120,80],['A. Overview',40,100,'italic'],['A normal line of example text for reading a heading.',40,240],
    ['B. Examples',40,100,'italic'],['More ordinary public example text to describe a layout.',40,240],['II. CHECKS',120,80],
    ['The closing text is a separate public sample paragraph.',40,240]]){add(str,x,y,w,font);y-=18;}
  const layout=core.extractPdfTextLayout(items,{viewport}), original=layout.text, el={};
  const p={pageNumber:1,text:original,layout,items,content:{styles:{}},sourceViewport:viewport,viewport:null,box:el};
  const doc={pages:[p],blocks:[{pageData:p,page:1,el,raw:original,lines:layout.lines,rects:layout.lines.map(l=>[l.xMin,l.y,l.xMax,l.y+10])}]};
  const chapters=inferPdfChapters(doc);
  assert.deepEqual(chapters.map(e=>[e.title,e.level]),[['I. DESIGN',1],['A. Overview',2],['B. Examples',2],['II. CHECKS',1]]);
  for(const e of chapters){assert.equal(doc.blocks[e.block].lines[0].text,e.title);assert.ok(e.point.every(f=>f>=0&&f<=1));}
  assert.equal(layout.text,original);assert.equal(p.itemBlocks.size,items.length);
});
