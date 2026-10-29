import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const lock=JSON.parse(await readFile(path.join(root,'shared-source-lock.json'),'utf8'));
for(const file of lock.files){
 const data=await readFile(path.join(root,file.path));
 assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,'Shared source drift: '+file.path);
 if(process.argv.includes('--upstream')){
  const original=await readFile(path.resolve(root,'..',file.repository,file.source));
  assert.deepEqual(data,original,'Upstream differs: '+file.path);
 }
}
const installed=JSON.parse(await readFile(path.join(root,'node_modules/@laginae/note-reader-core/package.json'),'utf8'));
assert.equal(installed.version,lock.coreVersion);
console.log('Shared source integrity verified: '+lock.files.length+' files.');
