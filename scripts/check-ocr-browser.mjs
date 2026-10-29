import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
const testUrl=process.env.OCR_TEST_URL||'http://127.0.0.1:5198/';
const browser=await chromium.launch({...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{}),headless:true});
const results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),requests=[],errors=[];
  page.on('request',request=>requests.push(request.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(testUrl);
  await page.waitForSelector('#import');
  assert.ok(!requests.some(url=>url.includes('ocr-assets')||url.includes('ocr-dialog')));
  assert.equal(await page.locator('#ocr-enabled').isChecked(),false);
  await page.locator('#ocr-open').click();assert.equal(await page.locator('#settings-dialog').evaluate(el=>el.open),true);
  await page.locator('#ocr-enabled').check();await page.locator('#settings-dialog form button').click();
  const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=500;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,500);ctx.fillStyle='black';ctx.font='42px Arial';ctx.fillText('Public Library Reading Room',60,100);ctx.fillText('The library opens at nine in the morning.',60,190);ctx.fillText('Readers can choose books and newspapers.',60,280);return canvas.toDataURL('image/png').split(',')[1];});
  const pngBytes=Buffer.from(png,'base64');
  const pdf=await PDFDocument.create(),embedded=await pdf.embedPng(pngBytes),pdfPage=pdf.addPage([600,250]);pdfPage.drawImage(embedded,{x:0,y:0,width:600,height:250});
  const pdfBytes=Buffer.from(await pdf.save());
  for(const [name,mimeType,buffer,width] of [['public-library.png','image/png',pngBytes,1280],['public-scan.pdf','application/pdf',pdfBytes,390]]) {
    await page.setViewportSize({width,height:900});
    await page.locator('#ocr-input').setInputFiles({name,mimeType,buffer});
    await page.locator('.cozy-ocr-form').waitFor();const started=Date.now();
    await page.getByRole('button',{name:'识别本页',exact:true}).click();
    await page.waitForFunction(()=>{const el=document.querySelector('.cozy-ocr-preview');return /library/i.test(el?.value||'');},{},{timeout:150000});
    const value=await page.locator('.cozy-ocr-preview').inputValue();assert.match(value,/opens at nine/i);
    await page.waitForFunction(()=>!document.querySelector('.cozy-ocr-form button').disabled);
    assert.equal(page.workers().length,0,'OCR worker should be terminated after completion');
    const overflow=await page.evaluate(()=>{const el=document.querySelector('.cozy-ocr-modal');return el.scrollWidth>el.clientWidth+2;});assert.equal(overflow,false);
    await mkdir('output',{recursive:true});await page.screenshot({path:`output/ocr-${width}.png`,fullPage:true});
    results.push({name,width,ms:Date.now()-started,recognizedCharacters:value.length});
    await page.locator('.cozy-ocr-form').getByRole('button',{name:'关闭',exact:true}).click();
  }
  // Cancelling while resource initialization is pending must not leave a worker.
  await page.locator('#ocr-input').setInputFiles({name:'cancel.png',mimeType:'image/png',buffer:pngBytes});
  await page.getByRole('button',{name:'识别本页',exact:true}).click();await page.getByRole('button',{name:'取消识别',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.cozy-ocr-form button').disabled);
  assert.equal(page.workers().length,0);
  assert.ok(!requests.some(url=>!url.startsWith('blob:')&&new URL(url).origin!==new URL(testUrl).origin),'Unexpected off-origin request');
  assert.deepEqual(errors,[]);
  await writeFile('output/ocr-browser-acceptance.json',JSON.stringify({passed:true,physicalMobileTest:false,privateDocuments:false,results},null,2));
  console.log(JSON.stringify({passed:true,results}));
}finally{await browser.close();}
