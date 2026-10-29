import form from './portable-ocr-form.cjs';
import core from '@laginae/note-reader-core';
import {loadPdfRuntime} from './pdf-runtime.js';
async function loadResources(signal) {
  const url=new URL('./ocr-assets/resources.json',location.href);
  const response=await fetch(url,{signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
  if(!response.ok||Number(response.headers.get('content-length'))>32*1024*1024)throw Error('OCR_RESOURCES');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32*1024*1024)throw Error('OCR_RESOURCES');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export function openOcrDialog(file,onRead,onDispose=()=>{}) {
  const dialog=document.createElement('dialog');dialog.className='cozy-ocr-modal';document.body.append(dialog);
  const host=document.createElement('div');dialog.append(host);
  const instance=form.mountOcrForm(host,{source:{name:file.name,extension:file.name.split('.').pop().toLowerCase(),size:file.size,read:()=>file.arrayBuffer()},
    hash:__COZY_OCR_HASH__,loadResources,loadPdf:loadPdfRuntime,layout:items=>core.extractPdfTextLayout(items),chinese:document.documentElement.lang!=='en',
    onRead,onClose:()=>dialog.close()});
  dialog.addEventListener('close',()=>{instance.dispose();dialog.remove();onDispose();},{once:true});dialog.showModal();return ()=>dialog.close();
}
