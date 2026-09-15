import { cp, mkdir, rm } from 'node:fs/promises';
import { writePublicConfig } from './public-config.mjs';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('src', 'dist/src', { recursive: true });

if (process.argv.includes('--configure')) await writePublicConfig();

console.log('Build output prepared in dist/.');