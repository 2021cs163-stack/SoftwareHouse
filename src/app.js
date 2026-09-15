import { loginPage } from './pages/login.js';
import { workspaceShell, PAGES } from './components/workspace.js';
import { managementPage } from './pages/management.js';
import { formContent, projectDetails } from './components/forms.js';
import { signIn, signOut } from './services/auth.js';
import { fetchWorkspace, saveAction, markNotificationsRead } from './services/database.js';
import { demoSnapshot, demoAction, demoRead, resetDemo } from './services/demo.js';
import { emptyData, notifications, projectBalance, partnerBalance, totals, money, cents, today } from './lib/finance.js';
import { esc, icon } from './lib/html.js';
const app=document.querySelector('#app');
let user=null,preview=false,data=emptyData(),loading=false,loadError='',epoch=0,refreshing=false;
let filters={search:'',status:'all'},lastPage='',toastTimer,desktopEnabled=false;
const desktopShown=new Set();
const currentPage=()=>Object.hasOwn(PAGES,location.hash.slice(1))?location.hash.slice(1):'dashboard';
const friendly=e=>e instanceof TypeError?'Connection failed. Check your internet connection and try again.':/duplicate key/i.test(e.message)?'That contract ID is already in use. Please use a unique ID.':e.message;
function toast(message) {
 const el=document.querySelector('#toast');if(!el)return;
 el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),6500);
}
function render() {
 if(!user&&!preview) {app.innerHTML=loginPage();document.title='Sign in | Rayan Tech Solution';return;}
 const page=currentPage();
 if(page!==lastPage) {filters={search:'',status:'all'};lastPage=page;}
 const content=loading?'<div class="load-state"><span class="loading-ring"></span><h1>Loading your workspace…</h1></div>':
 loadError?'<div class="load-state"><h1>Workspace unavailable</h1><p>'+esc(loadError)+'</p><p class="muted">For first-time setup, run the migration and configure your single administrator account in Supabase.</p><button class="secondary" data-action="refresh">'+icon('refresh')+'Try again</button></div>':managementPage(page,data,filters);
 app.innerHTML=workspaceShell(page,content,data,preview,user?.email);
 document.title=PAGES[page]+' | Rayan Tech Solution';
}
async function load(showLoading=false) {
 if(refreshing)return;
 refreshing=true;const ticket=epoch;
 if(showLoading){loading=true;render();}
 try{
  const next=preview?demoSnapshot():await fetchWorkspace();
  if(ticket!==epoch)return;
  data=next;loadError='';loading=false;render();showDesktopAlerts();
 } catch(e) {if(ticket!==epoch)return;loadError=friendly(e);loading=false;render();}
 finally {refreshing=false;}
}
function showDesktopAlerts() {
 if(!desktopEnabled||!('Notification' in window)||Notification.permission!=='granted')return;
 for(const n of notifications(data).filter(n=>!data.reads.includes(n.id))) {
  if(desktopShown.has(n.id))continue;
  try {const alert=new Notification(n.title,{body:n.text,tag:n.id});alert.onclick=()=>{window.focus();location.hash=n.route;alert.close();};desktopShown.add(n.id);}
  catch {desktopEnabled=false;toast('Desktop alerts are unavailable in this browser. In-app notifications remain active.');break;}
 }
}
function openForm(action,element) {
 if(loading||loadError)return;
 const dialog=document.querySelector('#record-dialog');
 dialog.innerHTML=formContent(action,data,element?.dataset.id,element?.dataset.partner);
 dialog.showModal();
}
function validateForm(payload,action) {
 if(['receive_payment','add_expense','pay_partner','add_investment'].includes(action)) {
  if(!Number.isFinite(Number(payload.amount))||cents(payload.amount)<=0||Number(payload.amount)>999999999999.99)throw new Error('Enter a valid positive amount.');
  if(!/^\d+(\.\d{1,2})?$/.test(payload.amount))throw new Error('Use no more than two decimal places.');
 }
 if(payload.date&&payload.date>today())throw new Error('Transactions cannot be dated in the future.');
 if(action==='create_project') {

  for(const key of ['paid_amount','remaining_amount']) {
   if(!/^\d+(\.\d{1,2})?$/.test(payload[key]||'')||!Number.isFinite(Number(payload[key]))||Number(payload[key])>999999999999.99) throw new Error('Enter valid non-negative paid and remaining amounts, with up to two decimal places.');
  }
  const total=(cents(payload.paid_amount)+cents(payload.remaining_amount))/100;
  if(total<=0||total>999999999999.99)throw new Error('Paid plus remaining must be greater than zero and within the amount limit.');
  if(cents(payload.paid_amount)>0&&(!payload.paid_date||payload.paid_date>today()))throw new Error('Choose the date that the payment was received.');
  for(const key of ['repo_url','deployment_url']) {
   if(!payload[key])continue;
   let url;try{url=new URL(payload[key]);}catch{throw new Error('Use a valid https:// or http:// project link.');}
   if(!['http:','https:'].includes(url.protocol))throw new Error('Project links must use https:// or http://.');
  }
 }
 if(action==='receive_payment') {
  const p=data.projects.find(p=>p.id===payload.project_id);
  if(!p)throw new Error('Select an unpaid project.');
  if(cents(payload.amount)>cents(projectBalance(p,data.receipts).remaining))throw new Error('Payment exceeds the outstanding balance.');
 }
 if(action==='pay_partner'&&(cents(payload.amount)>cents(partnerBalance(payload.partner,data).available)||cents(payload.amount)>cents(totals(data).cash)))throw new Error('Payment exceeds the available partner share or business cash.');
 return payload;
}
app.addEventListener('submit',async event=>{
 if(event.target.id==='login-form') {
  event.preventDefault();const form=event.target;const button=form.querySelector('[type=submit]');const error=form.querySelector('#form-error');
  button.disabled=true;button.textContent='Signing in…';
  try{user=await signIn(form.querySelector('#email').value.trim(),form.querySelector('#password').value);preview=false;epoch++;location.hash='dashboard';await load(true);}
  catch(e){error.textContent=friendly(e);button.disabled=false;button.innerHTML='Sign in <span aria-hidden="true">↗</span>';}
  return;
 }
 if(event.target.id!=='record-form')return;
 event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]'),error=form.querySelector('#record-error');
 if(button.disabled)return;
 let payload;
 try{payload=validateForm(Object.fromEntries([...new FormData(form)].map(([key,val])=>[key,typeof val==='string'?val.trim():val])),form.dataset.kind);}catch(e){error.textContent=friendly(e);return;}
 button.disabled=true;error.textContent='';const original=button.innerHTML;button.textContent='Saving…';
 try {
  if(preview)demoAction(form.dataset.kind,payload,form.dataset.requestId);
  else await saveAction(form.dataset.kind,payload,form.dataset.requestId);
  document.querySelector('#record-dialog').close();
  await load();
  toast(loadError?'Your record was saved, but the workspace could not refresh. Use Try again.':preview?'Saved in this preview only.':'Record saved successfully.');
 } catch(e){error.textContent=friendly(e);}
 finally{button.disabled=false;button.innerHTML=original;}
});
app.addEventListener('click',async event=>{
 const reveal=event.target.closest('#toggle-password');
 if(reveal){const input=document.querySelector('#password');const show=input.type==='password';input.type=show?'text':'password';reveal.textContent=show?'Hide':'Show';reveal.setAttribute('aria-label',show?'Hide password':'Show password');return;}
 if(event.target.closest('#preview')){preview=true;user=null;data=emptyData();resetDemo();epoch++;location.hash='dashboard';await load(true);return;}
 const filter=event.target.closest('[data-filter]');
 if(filter){filters.status=filter.dataset.filter;render();return;}
 const target=event.target.closest('[data-action]');if(!target)return;
 const action=target.dataset.action;
 if(action==='sign-out'){epoch++;const wasPreview=preview;user=null;preview=false;data=emptyData();loadError='';loading=false;desktopEnabled=false;desktopShown.clear();resetDemo();location.hash='login';render();if(!wasPreview)try{await signOut();}catch{}return;}
 if(action==='project-details'){const project=data.projects.find(p=>p.id===target.dataset.id);if(project){const dialog=document.querySelector('#record-dialog');dialog.innerHTML=projectDetails(project,data);dialog.showModal();}return;}
 if(action==='refresh'){await load();return;}
 if(action==='close-dialog'){if(document.querySelector('#record-form [type=submit]')?.disabled)return;document.querySelector('#record-dialog').close();return;}
 if(action==='enable-notifications') {
  if(!('Notification' in window)){toast('This browser does not support desktop notifications. In-app alerts are available.');return;}
  const permission=await Notification.requestPermission();
  desktopEnabled=permission==='granted';toast(desktopEnabled?'Desktop alerts enabled while this app is open.':'Desktop alerts were not enabled. You can still use in-app notifications.');showDesktopAlerts();return;
 }
 if(action==='read-all'||action==='read-alert') {
  const ids=action==='read-all'?notifications(data).map(n=>n.id):[target.dataset.id];
  target.disabled=true;
  try{if(preview)demoRead(ids);else await markNotificationsRead(ids);data.reads=[...new Set([...data.reads,...ids])];render();}
  catch(e){target.disabled=false;toast(friendly(e));}
  return;
 }
 if(action==='export') {
  const tables=[...document.querySelectorAll('#workspace-content table')];
  const safe=value=>{let v=value.trim();if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
  const csv=tables.map(t=>[...t.rows].map(r=>[...r.cells].map(c=>safe(c.innerText)).join(',')).join('\r\n')).join('\r\n\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rayan-'+currentPage()+'-'+today()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('History exported.');return;
 }
 if(['create_project','add_expense','receive_payment','pay_partner','complete_project','renew_subscription','add_investment'].includes(action))openForm(action,target);
});
app.addEventListener('input',event=>{
 if(event.target.id==='record-search'){const selection=event.target.selectionStart;filters.search=event.target.value;render();const input=document.querySelector('#record-search');input.focus();try{input.setSelectionRange(selection,selection);}catch{}}
 if(['paid_amount','remaining_amount'].includes(event.target.name)&&event.target.form?.dataset.kind==='create_project'){
  const form=event.target.form;
  document.querySelector('#contract-total').textContent='Contract total: '+money((cents(form.elements.paid_amount.value)+cents(form.elements.remaining_amount.value))/100);
  form.elements.paid_date.required=cents(form.elements.paid_amount.value)>0;
 }
});
app.addEventListener('change',event=>{
 const form=event.target.form;if(!form)return;
 if(event.target.name==='project_id'&&form.dataset.kind==='receive_payment'){
  const p=data.projects.find(p=>p.id===event.target.value);
  if(p){const remaining=projectBalance(p,data.receipts).remaining;document.querySelector('#balance-hint').textContent='Outstanding: '+money(remaining);form.elements.amount.value=remaining.toFixed(2);}
 }
 if(event.target.name==='partner'&&form.dataset.kind==='pay_partner')document.querySelector('#balance-hint').textContent='Available share: '+money(partnerBalance(event.target.value,data).available)+' · Business cash: '+money(totals(data).cash);
});
app.addEventListener('cancel',event=>{if(document.querySelector('#record-form [type=submit]')?.disabled)event.preventDefault();},true);
window.addEventListener('hashchange',()=>{if(!document.querySelector('#record-form [type=submit]')?.disabled)render();});
setInterval(()=>{if((user||preview)&&!document.querySelector('#record-dialog')?.open&&!loading)load();},60000);
render();
