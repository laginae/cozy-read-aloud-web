import outline from '../vendor/mobile/pdf-outline.js';
import {mapPdfItems} from './pdf-selection.js';

// Infer on original PDF coordinates; never re-extract or modify document text.
export function inferPdfChapters(doc) {
  const raw=doc.pages.map(p=>({...p,layout:outline.outlineLayout(p.layout,p.items,p.content.styles,p.sourceViewport)}));
  const model=outline.buildPdfOutline(raw), starts=new Map();
  if (!model.entries.length) return [];
  for (const entry of model.entries) {
    const p=doc.pages[entry.page-1], indexed=model.pages[entry.page-1];
    const i=indexed.layout.lines.findIndex(l=>l.offset===entry.offset && l.xMin===entry.x && l.y===entry.y);
    if(i>=0) starts.set(p.layout.lines[i],entry);
  }
  const result=[], blocks=[];
  for(const block of doc.blocks){
    const cuts=[0,...block.lines.flatMap((l,i)=>i && starts.has(l)?[i]:[]),block.lines.length];
    for(let j=1;j<cuts.length;j++){
      const lines=block.lines.slice(cuts[j-1],cuts[j]), entry=starts.get(lines[0]),p=block.pageData;
      if(entry){
        const vp=p.sourceViewport,[x,y]=vp.convertToViewportPoint(entry.x,entry.y);
        result.push({...entry,block:blocks.length,el:block.el,point:[x/vp.width,y/vp.height]});
      }
      blocks.push(cuts.length===2?block:{...block,lines,rects:block.rects.slice(cuts[j-1],cuts[j]),
        raw:lines.map(l=>l.text).join('\n').replace(/([A-Za-z])-\n(?=[a-z])/g,'$1')});
    }
  }
  if(blocks.length!==doc.blocks.length){
    doc.blocks=blocks;
    for(const p of doc.pages) mapPdfItems(doc,p);
  }
  return result;
}

export function outlineTarget(entry) {
  if(!entry.point || !entry.el?.isConnected) return entry.el;
  const anchor=entry.el.querySelector('[data-reading-heading]') || entry.el.appendChild(entry.el.ownerDocument.createElement('span'));
  anchor.dataset.readingHeading='';
  anchor.setAttribute('aria-hidden','true');
  Object.assign(anchor.style,{position:'absolute',width:'1px',height:'1px',pointerEvents:'none',
    left:Math.max(0,Math.min(100,entry.point[0]*100))+'%',top:Math.max(0,Math.min(100,entry.point[1]*100))+'%'});
  return anchor;
}
