'use strict';
const {createOcr,rasterPage,textFromResult}=require('./portable-ocr.cjs');
function mountOcrForm(parent,options) {
  const {source,loadResources,hash,loadPdf,layout,onRead,onClose,experimental=false}=options;
  const doc=parent.ownerDocument,t=(zh,en)=>options.chinese?zh:en;
  let controller,closed=false,busy=false;
  const node=(tag,text='',host=parent)=>{const el=doc.createElement(tag);el.textContent=text;host.append(el);return el;};
  parent.classList.add('cozy-ocr-form');
  node('h2',t('图片与扫描页朗读','Read images and scanned pages')+(experimental?t('（实验性）',' (experimental)'):''));
  node('p',source.name).className='cozy-ocr-filename';
  const fields=node('div');fields.className='cozy-ocr-fields';
  const label=node('label',t('页码','Page'),fields),page=node('input','',label);page.type='number';page.min='1';page.step='1';page.value='1';label.hidden=source.extension!=='pdf';
  const angleLabel=node('label',t('顺时针旋转','Clockwise rotation'),fields),angle=node('select','',angleLabel);
  for(const number of [0,90,180,270]){const option=node('option',`${number}°`,angle);option.value=String(number);}
  const actions=node('div');actions.className='cozy-ocr-actions';
  const button=(zh,en,fn,host=actions)=>{const b=node('button',t(zh,en),host);b.type='button';b.addEventListener('click',()=>{void fn();});return b;};
  const start=button('识别本页','Recognize page',recognize),cancel=button('取消识别','Cancel recognition',()=>controller?.abort());cancel.disabled=true;
  const clear=button('清除结果','Clear result',()=>{preview.value='';update();});
  const status=node('p');status.setAttribute('role','status');
  const preview=node('textarea');preview.maxLength=100000;preview.className='cozy-ocr-preview';preview.setAttribute('aria-label',t('可校对的识别文字','Editable recognized text'));preview.addEventListener('input',update);
  node('p',t('单页本机识别，不上传图片。请校对文字和公式；在线音色仍会发送朗读文字。','One-page local recognition; images are not uploaded. Review text and formulas. Online voices still transmit the text you read.')).className='cozy-ocr-note';
  const footer=node('div');footer.className='cozy-ocr-actions';
  const read=button('朗读结果','Read result',()=>deliver(false),footer),selected=button('朗读选中文字','Read selected text',()=>deliver(true),footer);
  button('关闭','Close',()=>{dispose();onClose();},footer);
  function update(){start.disabled=busy;cancel.disabled=!busy;page.disabled=angle.disabled=clear.disabled=busy;preview.readOnly=busy;read.disabled=selected.disabled=busy||!preview.value.trim();}
  async function recognize(){if(busy||closed)return;let engine,timer;
    try{if(!Number.isInteger(Number(page.value))||Number(page.value)<1)throw Error('OCR_RANGE');
      if(!source.size||source.size>(source.extension==='pdf'?30:12)*1024*1024)throw Error('OCR_SIZE');
      busy=true;preview.value='';update();controller=new AbortController();timer=setTimeout(()=>controller.abort(),180000);
      status.textContent=t('正在准备本机识别资源…','Preparing local OCR resources...');
      engine=await createOcr({loadResources,hash,signal:controller.signal,win:doc.defaultView,progress:f=>{if(!closed)status.textContent=t('正在识别','Recognizing')+` ${Math.round(f*100)}%`;}});
      if(closed||controller.signal.aborted)return;
      const bytes=await source.read();if(bytes.byteLength>(source.extension==='pdf'?30:12)*1024*1024)throw Error('OCR_SIZE');
      const result=await rasterPage({bytes,extension:source.extension,pageNumber:Number(page.value),rotation:Number(angle.value),pixels:experimental?1_500_000:3_000_000,loadPdf,signal:controller.signal,document:doc,consume:canvas=>engine.recognize(canvas)});
      if(closed||controller.signal.aborted)return;
      await source.verify?.();
      if(closed||controller.signal.aborted)return;
      preview.value=textFromResult(result,layout);status.textContent=preview.value?t('识别完成，请校对后朗读。','Complete. Review before reading.'):t('未识别出文字，可检查图片方向和清晰度。','No text found. Check image orientation and resolution.');
    }catch(error){if(!closed){preview.value='';status.textContent=controller?.signal.aborted?t('已取消。','Cancelled.'):
      error.message==='OCR_UNSUPPORTED'?t('当前环境不支持本机 OCR 所需的工作进程或安全校验。请升级应用/浏览器，或先在电脑端识别。','This environment lacks OCR worker or integrity-check support. Update the app/browser or recognize on desktop first.'):
      error.message==='OCR_RESOURCES'?t('OCR 资源包缺失、损坏或版本不匹配。请安装与此版本配套的资源包。','OCR resource pack is missing, damaged or incompatible. Install the matching resource pack.'):
      error.message==='OCR_SIZE'?t('PDF 最大 30 MB，图片最大 12 MB。','PDF limit: 30 MB. Image limit: 12 MB.'):
      error.message==='OCR_IMAGE'?t('图片无效或超过 1600 万像素。','Invalid image or over 16 megapixels.'):
      error.message==='OCR_RANGE'?t('请输入文件内的有效页码。','Enter a valid page number.'):
      t('识别失败或超时。请检查资源包、图片方向或尝试更小的文件。','Recognition failed or timed out. Check the resource pack, orientation, or try a smaller file.');}
    }finally{clearTimeout(timer);engine?.close();busy=false;if(!closed)update();}}
  async function deliver(selection){if(busy||closed)return;const text=selection?preview.value.slice(preview.selectionStart,preview.selectionEnd):preview.value;
    if(!text.trim()){status.textContent=t('请先选中文字。','Select text first.');return;}if(text.length>100000)return;
    dispose();onClose();await onRead(text);}
  const hidden=()=>{if(doc.hidden)controller?.abort();};doc.addEventListener('visibilitychange',hidden);
  function dispose(){if(closed)return;closed=true;controller?.abort();preview.value='';doc.removeEventListener('visibilitychange',hidden);parent.replaceChildren();}
  update();return {dispose,cancel:()=>controller?.abort()};
}
module.exports={mountOcrForm};
