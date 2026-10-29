import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
if(!process.argv.includes('--refresh'))throw Error('Use --refresh after reviewing upstream changes.');
const root=path.resolve(import.meta.dirname,'..'),files=[];
async function visit(dir){for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){
 const relative=dir+'/'+entry.name;
 if(entry.isDirectory())await visit(relative);
 else{
  if(relative==='vendor/mobile/package.json')continue;
  const core=relative.startsWith('vendor/core/'),repository=core?'note-reader-core':'note-reader-mobile';
  const short=relative.replace(/^vendor\/(?:core|mobile)\//,'');
  const source=core||short==='LICENSE'?short:'src/'+short;
  const data=await readFile(path.join(root,relative)),upstream=await readFile(path.resolve(root,'..',repository,source));
  assert.deepEqual(data,upstream,'Review and synchronize before locking '+relative);
  const baseRevision=execFileSync('git',['-C',path.resolve(root,'..',repository),'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const committed=execFileSync('git',['-C',path.resolve(root,'..',repository),'show',baseRevision+':'+source]);
  files.push({path:relative,repository,source,baseRevision,unreleasedChange:!committed.equals(data),sha256:createHash('sha256').update(data).digest('hex')});
 }
}}
await visit('vendor/core');await visit('vendor/mobile');
const fixture='test/pdf-golden-fixtures.cjs',data=await readFile(path.join(root,fixture));
assert.deepEqual(data,await readFile(path.resolve(root,'../note-reader-core',fixture)));
const coreRoot=path.resolve(root,'../note-reader-core');
const revision=execFileSync('git',['-C',coreRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
files.push({path:fixture,repository:'note-reader-core',source:fixture,baseRevision:revision,
 unreleasedChange:!execFileSync('git',['-C',coreRoot,'show',revision+':'+fixture]).equals(data),sha256:createHash('sha256').update(data).digest('hex')});
const coreVersion=JSON.parse(await readFile(path.join(root,'vendor/core/package.json'),'utf8')).version;
await writeFile(path.join(root,'shared-source-lock.json'),JSON.stringify({schema:1,coreVersion,files},null,2)+'\n');
console.log('Locked '+files.length+' reviewed shared sources.');
