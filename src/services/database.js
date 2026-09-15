import { supabaseConfig } from '../config.js';
import { accessToken } from './auth.js';
async function rpc(name, body={}) {
 const token=await accessToken();
 const response=await fetch(supabaseConfig.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{'Content-Type':'application/json',apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+token},body:JSON.stringify(body)
 });
 const data=await response.json();
 if(response.ok && name==='rayan_snapshot' && !Array.isArray(data.investments)) throw new Error('Run migration 202609150002_project_details_investments.sql in Supabase, then refresh.');
 if(!response.ok) {
  if(data.code==='PGRST202' || data.code==='42P01') throw new Error('Database setup is needed. Run the supplied Supabase migration, then refresh.');
  if(response.status===401) throw new Error('Your session has expired. Please sign out and sign in again.');
  throw new Error(data.message || 'The database could not save your changes.');
 }
 return data;
}
export const fetchWorkspace = () => rpc('rayan_snapshot');
export const saveAction = (action,payload,requestId) => rpc('rayan_action',{action_name:action,payload,request_id:requestId});
export const markNotificationsRead = ids => rpc('rayan_mark_read',{notification_ids:ids});
