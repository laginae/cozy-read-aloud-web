'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
module.exports = function buildResources(root, output) {
  const languages = {};
  for (const name of ['eng','chi_sim']) languages[name] = fs.readFileSync(path.join(root,'node_modules/@tesseract.js-data',name,'4.0.0_best_int',`${name}.traineddata.gz`)).toString('base64');
  const core = fs.readFileSync(path.join(root,'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js'),'utf8');
  const engine = fs.readFileSync(path.join(root,'node_modules/tesseract.js/dist/worker.min.js'),'utf8').replace(/\/\/# sourceMappingURL=.*$/gm,'');
  const guard = `;(() => { const models=${JSON.stringify(languages)};
    self.fetch=async input=>{const key=Object.keys(models).find(key=>String(input)==='https://cozy.invalid/ocr/'+key+'.traineddata.gz');
      if(!key) throw Error('OCR_NETWORK_DISABLED');return new Response(Uint8Array.from(atob(models[key]),c=>c.charCodeAt(0)));};
    self.importScripts=()=>{throw Error('OCR_NETWORK_DISABLED');};
    self.XMLHttpRequest=self.WebSocket=class {constructor(){throw Error('OCR_NETWORK_DISABLED');}};
  })();\n`;
  const bytes = JSON.stringify({ format: 1, engine: 'tesseract.js@7.0.0', worker: core+'\n'+guard+engine });
  fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,bytes);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const notices = path.join(path.dirname(output),'licenses'); fs.mkdirSync(notices,{recursive:true});
  for (const [name,file] of [['tesseract.js','LICENSE.md'],['tesseract.js-core','LICENSE']]) {
    const source=path.join(root,'node_modules',name,file);
    if (!fs.existsSync(source)) throw Error('Missing OCR license: '+name);
    fs.copyFileSync(source,path.join(notices,name.replace(/[\/@]/g,'-')+'.txt'));
  }
  fs.copyFileSync(path.join(root,'ocr-licenses/tessdata-LICENSE.txt'),path.join(notices,'tessdata-LICENSE.txt'));
  fs.copyFileSync(path.join(root,'ocr-licenses/NOTICE.md'),path.join(notices,'NOTICE.md'));
  fs.copyFileSync(path.join(root,'node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt'),path.join(notices,'worker-NOTICES.txt'));
  fs.writeFileSync(path.join(path.dirname(output),'manifest.json'),JSON.stringify({format:1,engine:'tesseract.js@7.0.0',languages:['eng','chi_sim'],sha256,bytes:Buffer.byteLength(bytes)},null,2));
  return { sha256, bytes: Buffer.byteLength(bytes) };
};
