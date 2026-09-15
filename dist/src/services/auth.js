import { supabaseConfig } from '../config.js';
export const isConfigured = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
let session = null;
export async function signIn(email, password) {
  if (!isConfigured) throw new Error('Sign-in is not connected yet. Please contact your workspace administrator.');
  const response = await fetch(`${supabaseConfig.url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseConfig.publishableKey }, body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(response.status === 400 ? 'Your email or password is incorrect. Please try again.' : 'Unable to sign in right now. Please try again.');
  session = data;
  return data.user;
}
export async function signOut() {
  const token = session?.access_token;
  session = null;
  if (token) await fetch(`${supabaseConfig.url.replace(/\/$/, '')}/auth/v1/logout`, { method: 'POST', headers: { apikey: supabaseConfig.publishableKey, Authorization: `Bearer ${token}` } });
}
