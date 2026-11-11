#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {Runner,Controller} from '../src/driver.mjs';
import {root,assertDirectMode} from '../src/cli.mjs';
const config=JSON.parse(await readFile(root+'/.state/config.json','utf8'));
const runner=new Runner({port:config.port,token:(await readFile(root+'/.state/token','utf8')).trim()});
const c=new Controller(runner),report={time:new Date().toISOString(),scope:'Native 30-second snapshot expiry; harmless Calculator key, no automatic replay.'};
try {
 assertDirectMode();const s=await c.observe();if(s.app!=='com.apple.calculator')throw new Error('Calculator required');
 const key=s.elements.find(x=>x.identifier==='Seven'&&x.ref);if(!key)throw new Error('No test key');
 const text=s.elements.filter(x=>x.kind==='StaticText').map(x=>x.label);
 await new Promise(resolve=>setTimeout(resolve,31000));
 const result=await c.execute([{op:'tap',ref:key.ref,snapshot:s.snapshot,observe:false}]);
 const after=await c.observe();
 report.refused=!result.ok;report.outcome=result.outcome;report.display_unchanged=JSON.stringify(text)===JSON.stringify(after.elements.filter(x=>x.kind==='StaticText').map(x=>x.label));
 report.passed=report.refused&&result.outcome==='not_sent'&&report.display_unchanged;
 if(!report.passed)process.exitCode=1;
}catch(e){report.error=e.message;report.passed=false;process.exitCode=1;}
finally{runner.close();await writeFile(root+'/benchmarks/snapshot-expiry.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
