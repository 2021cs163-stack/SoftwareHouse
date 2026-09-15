import { loadEnvFile } from 'node:process';
import { writeFile } from 'node:fs/promises';
export function readPublicConfig() {
 try { loadEnvFile('.env'); } catch(error) { if(error.code!=='ENOENT') throw error; }
 const url=process.env.SUPABASE_URL?.trim()||'';
 const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY?.trim()||'';
 if(url) {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('SUPABASE_URL must be your HTTPS project URL.');
 }
 if(publishableKey) {
  let role='';
  try { role=JSON.parse(Buffer.from(publishableKey.split('.')[1]||'','base64url').toString()).role; } catch {}
  if(!publishableKey.startsWith('sb_publishable_') && role!=='anon') throw new Error('Only a public Supabase publishable or legacy anon key may be used.');
 }
 return {url:url.replace(/\/$/,''),publishableKey};
}
if(process.argv.includes('--write')) {
 const config=readPublicConfig();
 await writeFile('dist/src/config.js','// Generated public browser settings. Never use a secret or service-role key.\nexport const supabaseConfig = '+JSON.stringify(config)+';\n');
 console.log('Public browser configuration prepared. Credentials are not printed.');
}
