import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';
import ocr from '../src/portable-ocr.cjs';
test('OCR resource integrity is mandatory and image size is bounded',async()=>{
  const bytes=new TextEncoder().encode(JSON.stringify({format:1,engine:'tesseract.js@7.0.0',worker:'public test'}));
  const hash=createHash('sha256').update(bytes).digest('hex');assert.equal((await ocr.verifyPack(bytes,hash,webcrypto)).format,1);
  await assert.rejects(ocr.verifyPack(bytes,'wrong',webcrypto),/OCR_RESOURCES/);
  const size=ocr.sizeFor(6000,4000,1500000);assert.ok(size.width*size.height<=1500000);assert.throws(()=>ocr.imageDimensions(new Uint8Array(24)),/OCR_IMAGE/);
});
test('OCR core is identical on web and mobile',async()=>{
  const lock=JSON.parse(await readFile(new URL('../ocr-source-lock.json',import.meta.url)));
  for(const [file,hash] of Object.entries(lock.files))assert.equal(createHash('sha256').update(await readFile(new URL('../src/'+file,import.meta.url))).digest('hex'),hash);
});
