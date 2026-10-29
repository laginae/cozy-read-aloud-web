'use strict';

const MAX_RESOURCE_BYTES = 32 * 1024 * 1024;
function check(signal) { if (signal.aborted) throw new Error('OCR_CANCELLED'); }
function sizeFor(width,height,pixels) {
  if (!(width > 0 && height > 0) || !Number.isFinite(width*height)) throw Error('OCR_IMAGE');
  const scale=Math.min(1,2000/Math.max(width,height),Math.sqrt(pixels/(width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
function imageDimensions(bytes) {
  const a=new Uint8Array(bytes), v=new DataView(a.buffer,a.byteOffset,a.byteLength);
  const ascii=(start,length)=>String.fromCharCode(...a.subarray(start,start+length));
  let width,height;
  if(a.length>=24 && a[0]===137 && ascii(1,3)==='PNG' && ascii(12,4)==='IHDR') {width=v.getUint32(16);height=v.getUint32(20);}
  else if(a[0]===255 && a[1]===216) {
    let p=2;
    while(p+4<=a.length){if(a[p++]!==255)break;while(a[p]===255)p++;const m=a[p++];if(m===218||m===217)break;if(m===1||m>=208&&m<=215)continue;if(p+2>a.length)break;
      const n=v.getUint16(p);if(n<2||p+n>a.length)break;if([192,193,194].includes(m)&&n>=8){height=v.getUint16(p+3);width=v.getUint16(p+5);break;}p+=n;}
  } else if(a.length>=30 && ascii(0,4)==='RIFF' && ascii(8,4)==='WEBP') {
    const type=ascii(12,4);
    if(type==='VP8X'){width=1+a[24]+a[25]*256+a[26]*65536;height=1+a[27]+a[28]*256+a[29]*65536;}
    if(type==='VP8 ' && a[23]===157&&a[24]===1&&a[25]===42){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}
    if(type==='VP8L'&&a[20]===47){const bits=v.getUint32(21,true);width=1+(bits&16383);height=1+((bits>>>14)&16383);}
  }
  if(!width||!height||width*height>16_000_000)throw Error('OCR_IMAGE');
  return {width,height};
}
async function verifyPack(bytes,sha256,cryptoApi=globalThis.crypto) {
  if(bytes.byteLength>MAX_RESOURCE_BYTES || !cryptoApi?.subtle)throw Error('OCR_RESOURCES');
  const hash=Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==sha256)throw Error('OCR_RESOURCES');
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(data.format!==1 || data.engine!=='tesseract.js@7.0.0' || typeof data.worker!=='string')throw Error('OCR_RESOURCES');
  return data;
}
async function createOcr({loadResources,hash,signal,progress=()=>{},win=globalThis}) {
  check(signal);
  if(typeof win.Worker!=='function' || !win.crypto?.subtle || !win.URL?.createObjectURL)throw Error('OCR_UNSUPPORTED');
  const bytes=await loadResources(signal); check(signal);
  const resources=await verifyPack(bytes,hash,win.crypto); check(signal);
  const url=win.URL.createObjectURL(new win.Blob([resources.worker],{type:'text/javascript'}));
  let worker;
  try{worker=new win.Worker(url);}finally{win.URL.revokeObjectURL(url);}
  let pending,sequence=0,closed=false;
  const close=(reason='OCR_CANCELLED')=>{if(closed)return;closed=true;worker.terminate();signal.removeEventListener('abort',abort);if(pending){clearTimeout(pending.timer);pending.reject(Error(reason));pending=null;}};
  const abort=()=>close();signal.addEventListener('abort',abort,{once:true});
  worker.onerror=()=>close('OCR_FAILED');
  worker.onmessage=({data})=>{if(data.status==='progress'){progress(Math.max(0,Math.min(1,Number(data.data?.progress)||0)));return;}
    if(!pending||data.jobId!==pending.id)return;const job=pending;pending=null;clearTimeout(job.timer);
    if(data.status==='resolve')job.resolve(data.data);else job.reject(Error('OCR_FAILED'));};
  const call=(action,payload)=>new Promise((resolve,reject)=>{if(closed||signal.aborted)return reject(Error('OCR_CANCELLED'));if(pending)return reject(Error('OCR_BUSY'));
    const id=String(++sequence),timer=setTimeout(()=>close('OCR_TIMEOUT'),120000);pending={id,timer,resolve,reject};
    try{worker.postMessage({workerId:'cozy-ocr',jobId:id,action,payload});}catch(_){close('OCR_FAILED');}});
  try {
    await call('load',{options:{lstmOnly:true}});
    await call('loadLanguage',{langs:'eng+chi_sim',options:{langPath:'https://cozy.invalid/ocr',cacheMethod:'none',gzip:true,lstmOnly:true}});
    await call('initialize',{langs:'eng+chi_sim',oem:1,config:{}});
    await call('setParameters',{params:{tessedit_pageseg_mode:'3',user_defined_dpi:'200'}});
    return {close,async recognize(canvas){check(signal);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('OCR_IMAGE');
      const result=await call('recognize',{image:new Uint8Array(await blob.arrayBuffer()),options:{},output:{text:true,blocks:true}});
      if(typeof result?.text!=='string'||result.text.length>100000)throw Error('OCR_TEXT');
      return result;}};
  }catch(error){close();throw error;}
}
async function rasterPage({bytes,extension,pageNumber,rotation,pixels,loadPdf,signal,document,consume}) {
  check(signal); const win=document.defaultView,canvas=document.createElement('canvas');
  let task,render,image;
  const abort=()=>{render?.cancel();void Promise.resolve(task?.destroy()).catch(()=>{});}; signal.addEventListener('abort',abort,{once:true});
  try {
    if(extension==='pdf') {
      const lib=await loadPdf();check(signal);task=lib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
      const doc=await task.promise;check(signal);
      if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>doc.numPages)throw Error('OCR_RANGE');
      const page=await doc.getPage(pageNumber);check(signal);
      const angle=((page.rotate||0)+rotation)%360,base=page.getViewport({scale:200/72,rotation:angle}),size=sizeFor(base.width,base.height,pixels);
      const viewport=page.getViewport({scale:200/72*Math.min(size.width/base.width,size.height/base.height),rotation:angle});
      canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
      render=page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'});await render.promise;check(signal);
    } else {
      imageDimensions(bytes);
      const blob=new win.Blob([bytes]);
      if(win.createImageBitmap) image=await win.createImageBitmap(blob);
      else {const url=win.URL.createObjectURL(blob);try{image=new win.Image();image.src=url;await image.decode();}finally{win.URL.revokeObjectURL(url);}}
      check(signal);const size=sizeFor(image.width,image.height,pixels),swap=rotation===90||rotation===270;
      canvas.width=swap?size.height:size.width;canvas.height=swap?size.width:size.height;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(image,-size.width/2,-size.height/2,size.width,size.height);
    }
    return await consume(canvas);
  }finally{signal.removeEventListener('abort',abort);canvas.width=canvas.height=1;image?.close?.();await task?.destroy();}
}
function textFromResult(result,layout) {
  const lines=[];
  for(const block of result.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]) {
    if(lines.length>=5000)throw Error('OCR_TEXT');
    const b=line.bbox;
    if(typeof line.text!=='string'||![b?.x0,b?.y0,b?.x1,b?.y1].every(Number.isFinite))continue;
    const h=b.y1-b.y0;if(h>0)lines.push({str:line.text.trim(),height:h,width:b.x1-b.x0,transform:[h,0,0,h,b.x0,-b.y1]});
  }
  return (lines.length&&layout ? layout(lines).text : result.text).normalize('NFKC').replace(/([A-Za-z])-\s*\n\s*([a-z])/g,'$1$2').trim();
}
module.exports={MAX_RESOURCE_BYTES,sizeFor,imageDimensions,verifyPack,createOcr,rasterPage,textFromResult};
