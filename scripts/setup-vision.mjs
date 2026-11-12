#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
if(process.platform!=='darwin')throw Error('Local visual navigation uses Apple Vision on macOS');
const root=dirname(dirname(fileURLToPath(import.meta.url))),state=join(root,'.state');
const source=join(root,'scripts/visual-ocr.swift'),binary=join(state,'visual-ocr');
await mkdir(state,{recursive:true,mode:0o700});
execFileSync('xcrun',['swiftc','-O',source,'-o',binary],{stdio:'inherit'});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await writeFile(join(state,'visual-ocr.json'),JSON.stringify({source_sha256:hash(await readFile(source)),binary_sha256:hash(await readFile(binary))})+'\n',{mode:0o600});
console.log('Local Apple Vision text recognition is ready. Screenshots stay on the Mac.');
