import { PARTNERS, today, shiftMonths, emptyData, cents, totals, partnerBalance, projectBalance } from '../lib/finance.js';
let data=emptyData();
export function resetDemo() { data=emptyData(); }
export const demoSnapshot = () => structuredClone(data);
export function demoRead(ids) { data.reads=[...new Set([...data.reads,...ids])]; }
export function demoAction(action,payload,requestId) {
 if(data.events.some(e=>e.id===requestId)) return;
 const id=crypto.randomUUID(), now=today();
 const amount=Number(payload.amount||0), date=payload.date||now;
 const project=data.projects.find(p=>p.id===payload.project_id);
 const requireMoney=()=>{if(cents(amount)<=0 || !Number.isFinite(amount)) throw new Error('Enter an amount greater than zero.');};
 if(action==='create_project') {

  const paid=Number(payload.paid_amount),remaining=Number(payload.remaining_amount);
  if(!Number.isFinite(paid)||!Number.isFinite(remaining)||paid<0||remaining<0||cents(paid)+cents(remaining)<=0)throw new Error('Enter valid paid and remaining amounts.');
  if(data.projects.some(p=>p.contract_id.toLowerCase()===payload.contract_id.toLowerCase()))throw new Error('This contract ID already exists.');
  const total=(cents(paid)+cents(remaining))/100;
  data.projects.unshift({id,contract_id:payload.contract_id,name:payload.name,client:payload.client,client_contact:payload.client_contact||'',repo_url:payload.repo_url||'',deployment_url:payload.deployment_url||'',details:payload.details||'',type:payload.type,responsible:payload.responsible,start_date:payload.start_date,amount:total,status:'ongoing',completed_on:null,created_at:new Date().toISOString()});
  if(paid>0)data.receipts.unshift({id:crypto.randomUUID(),project_id:id,amount:paid,date:payload.paid_date,note:'Payment recorded when project was added'});
  } else if(action==='complete_project') {
  if(!project || project.status==='done') throw new Error('This project is already complete.');
  if(date<project.start_date) throw new Error('Completion cannot precede the start date.');
  project.status='done';project.completed_on=date;
  if(project.type==='online') data.subscriptions.unshift({id,project_id:project.id,starts_on:date,expires_on:shiftMonths(date,12),created_at:new Date().toISOString()});
 } else if(action==='receive_payment') {
  requireMoney();
  if(!project || cents(amount)>cents(projectBalance(project,data.receipts).remaining)) throw new Error('Payment exceeds the outstanding balance.');
  data.receipts.unshift({id,project_id:project.id,amount,date,note:payload.note||''});
 } else if(action==='add_expense') {
  requireMoney();data.expenses.unshift({id,reason:payload.reason,amount,date});

 } else if(action==='add_investment') {
  requireMoney();
  if(!PARTNERS.includes(payload.partner))throw new Error('Select a partner.');
  data.investments.unshift({id,partner:payload.partner,amount,date,note:payload.note||'',created_at:new Date().toISOString()});
 } else if(action==='pay_partner') {
  requireMoney();
  if(!PARTNERS.includes(payload.partner)) throw new Error('Select a partner.');
  if(cents(amount)>cents(Math.max(0,partnerBalance(payload.partner,data).available)) || cents(amount)>cents(totals(data).cash)) throw new Error('Payment exceeds the partner balance or available cash.');
  data.payouts.unshift({id,partner:payload.partner,amount,date});
 } else if(action==='renew_subscription') {
  if(!project || project.status!=='done' || project.type!=='online') throw new Error('Only completed online projects have subscriptions.');
  const last=data.subscriptions.filter(s=>s.project_id===project.id).sort((a,b)=>b.expires_on.localeCompare(a.expires_on))[0];
  if(last && now<shiftMonths(last.expires_on,-1)) throw new Error('Renewals open one month before expiry.');
  const start=last?.expires_on>now?last.expires_on:now;
  data.subscriptions.unshift({id,project_id:project.id,starts_on:start,expires_on:shiftMonths(start,12),created_at:new Date().toISOString()});
 }
 data.events.unshift({id:requestId,action,description:({add_investment:'Partner investment',create_project:'Project added',complete_project:'Project completed',receive_payment:'Payment received',add_expense:'Expense recorded',pay_partner:'Partner paid',renew_subscription:'Subscription renewed'}[action] || action)+' · '+(payload.reason || payload.contract_id || project?.contract_id || payload.partner || ''),amount:action==='create_project'?(cents(payload.paid_amount)+cents(payload.remaining_amount))/100:amount||null,created_at:new Date().toISOString(),actor:'Preview user'});
}
