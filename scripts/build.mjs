import path from 'node:path';
import { cp, mkdir, rm } from 'node:fs/promises';
import { writePublicConfig } from './public-config.mjs';

const projectRoot=process.cwd();
const outputRoot=path.resolve(projectRoot,'dist');
if(path.dirname(outputRoot)!==projectRoot || path.basename(outputRoot)!=='dist') throw new Error('Unsafe build output path.');
await rm(outputRoot, { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('src', 'dist/src', { recursive: true });

if (process.argv.includes('--configure')) await writePublicConfig();

console.log('Build output prepared in dist/.');