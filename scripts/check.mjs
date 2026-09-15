import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
async function walk(dir) { for (const e of await readdir(dir,{withFileTypes:true})) {const p=`${dir}/${e.name}`;if(e.isDirectory()) await walk(p);else if(p.endsWith('.js')) execFileSync(process.execPath,['--check',p]);} }
await walk('dist/src');
for (const p of ['dist/index.html','dist/styles/main.css','dist/assets/favicon.svg']) await readFile(p);
console.log('All JavaScript syntax and required assets verified.');
