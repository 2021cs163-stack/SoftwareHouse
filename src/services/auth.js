import { supabaseConfig } from '../config.js';
export const isConfigured = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
let session = null;
let refreshPromise = null;
async function tokenRequest(grant, body) {
 const response = await fetch(supabaseConfig.url.replace(/\/$/,'')+'/auth/v1/token?grant_type='+grant, {
  method:'POST', headers:{'Content-Type':'application/json',apikey:supabaseConfig.publishableKey}, body:JSON.stringify(body)
 });
 const data = await response.json();
 if (!response.ok) throw new Error(grant==='password' ? 'Unable to sign in. Check your email and password.' : 'Your session has expired. Please sign in again.');
 return { ...data, expires_at:Date.now()+data.expires_in*1000 };
}
export async function signIn(email,password) {
 if (!isConfigured) throw new Error('Your workspace connection has not been configured yet.');
 session=await tokenRequest('password',{email,password}); return session.user;
}
export async function accessToken() {
 if (!session) throw new Error('Please sign in again.');
 if (session.expires_at < Date.now()+60000) {
  if (!refreshPromise) refreshPromise=tokenRequest('refresh_token',{refresh_token:session.refresh_token}).then(next=>{session=next;return next;}).finally(()=>{refreshPromise=null;});
  await refreshPromise;
 }
 return session.access_token;
}
export async function signOut() {
 const token=session?.access_token; session=null;
 if(token) await fetch(supabaseConfig.url.replace(/\/$/,'')+'/auth/v1/logout',{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+token}});
}
