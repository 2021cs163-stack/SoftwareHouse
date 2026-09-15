import { PARTNERS, money, cents, dateLabel, today, totals, sum, projectBalance, partnerBalance, currentSubscriptions, notifications } from '../lib/finance.js';
import { esc, icon, badge, table, initials } from '../lib/html.js';
const row = cells => '<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
const moneyCell = amount => '<span class="money-value">'+money(amount)+'</span>';
const button = (label,action,extra='',style='primary small') => '<button class="'+style+'" data-action="'+action+'" '+extra+'>'+icon(action==='export'?'download':'plus')+label+'</button>';
const panel = (title,body,extra='') => '<section class="data-panel"><div class="panel-heading"><h2>'+title+'</h2>'+extra+'</div>'+body+'</section>';
function heading(kicker,title,description,action='') { return '<div class="page-heading"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'<span>.</span></h1><p>'+description+'</p></div>'+action+'</div>'; }
function metric(label,value,note,tone='',symbol='receipts') { return '<article class="metric '+tone+'"><div class="metric-top"><span>'+label+'</span>'+icon(symbol)+'</div><strong>'+value+'</strong><small>'+note+'</small></article>'; }
function toolbar(filters,options=[],placeholder='Search history…') {
 return '<div class="list-toolbar"><label class="table-search">'+icon('search')+'<input id="record-search" type="search" placeholder="'+placeholder+'" aria-label="Search records" value="'+esc(filters.search)+'"></label>'+(options.length?'<div class="filter-tabs" role="group" aria-label="Filter records">'+options.map(([value,label])=>'<button data-filter="'+value+'" class="'+(filters.status===value?'selected':'')+'">'+label+'</button>').join('')+'</div>':'')+button('Export CSV','export','','secondary small')+'</div>';
}
function matches(value,filters) { return JSON.stringify(value).toLowerCase().includes(filters.search.toLowerCase()); }
function projectRows(projects,data,showActions=true) {
 return projects.map(p=>{
  const balance=projectBalance(p,data.receipts);
  return '<tr class="project-row '+p.status+'"><td><strong>'+esc(p.name)+'</strong><small>'+esc(p.client)+'</small></td><td><span class="contract-code">'+esc(p.contract_id)+'</span></td><td>'+esc(p.type)+'</td><td><span class="person-mini">'+esc(initials(p.responsible))+'</span>'+esc(p.responsible)+'</td><td>'+dateLabel(p.start_date)+'</td><td>'+moneyCell(p.amount)+'</td><td>'+badge(p.status==='done'?'Done':'Ongoing',p.status==='done'?'green':'yellow')+'</td>'+(showActions?'<td>'+(p.status==='ongoing'?'<button class="done-button" data-action="complete_project" data-id="'+p.id+'">'+icon('check')+'Done</button>':'<span class="date-small">'+dateLabel(p.completed_on)+'</span>')+'</td>':'')+'</tr>';
 });
}
function eventsTable(events) {
 return table(['Activity','Amount','Recorded on','By'],events.map(e=>row(['<strong>'+esc(e.description)+'</strong>',e.amount?moneyCell(e.amount):'—',dateLabel(e.created_at),esc(e.actor||'Partner')])),'Your activity history will appear here.');
}
function cashChart(data) {
 const now=new Date(today()+'T12:00:00Z');
 const months=Array.from({length:6},(_,i)=>{const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5+i,1));const key=d.toISOString().slice(0,7);return {name:d.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}),income:sum(data.receipts.filter(r=>r.date.startsWith(key))),expense:sum(data.expenses.filter(r=>r.date.startsWith(key)))};});
 const max=Math.max(...months.flatMap(m=>[m.income,m.expense]),1);
 return '<div class="cash-chart" role="img" aria-label="Received money and expenses for the last six months">'+months.map(m=>'<div class="chart-month"><div class="chart-bars"><div class="bar income" style="height:'+Math.max(m.income/max*100,1)+'%" title="Received: '+money(m.income)+'"></div><div class="bar expense" style="height:'+Math.max(m.expense/max*100,1)+'%" title="Expenses: '+money(m.expense)+'"></div></div><span>'+m.name+'</span><small>'+money(m.income)+'</small></div>').join('')+'</div>';
}
export function managementPage(page,data,filters) {
 const t=totals(data), subs=currentSubscriptions(data), alerts=notifications(data);
 const projectById=id=>data.projects.find(p=>p.id===id);
 if(page==='dashboard') {
  return heading('THE BIG PICTURE','Business overview','Your projects, money, and partners. All in one place.',button('New project','create_project'))+
   '<div class="metrics-grid">'+metric('Available business cash',money(t.cash),'Received − expenses − partner payouts','featured','receipts')+metric('Total received',money(t.received),data.receipts.length+' recorded payments','','receipts')+metric('Total expenses',money(t.expenses),data.expenses.length+' expense records','','expenses')+metric('Outstanding payments',money(t.remaining),'Contract amounts still to collect','','remaining')+'</div>'+
   (t.cash<0?'<div class="warning-banner">Your ledger shows a cash deficit of '+money(-t.cash)+'. Review unrecorded receipts or funding before making partner payouts.</div>':'')+
   '<div class="overview-grid">'+panel('Cash flow',cashChart(data),'<div class="chart-legend"><span><i class="income-dot"></i>Received</span><span><i class="expense-dot"></i>Expenses</span><small>Last 6 months</small></div>')+
   '<section class="project-summary"><div class="panel-heading"><h2>Project pulse</h2>'+icon('projects')+'</div><div class="project-total"><strong>'+data.projects.length+'</strong><span>Total projects</span></div><div class="project-meter"><span style="width:'+(data.projects.length?data.projects.filter(p=>p.status==='done').length/data.projects.length*100:0)+'%"></span></div><div class="pulse-line">'+badge('Ongoing','yellow')+'<strong>'+data.projects.filter(p=>p.status==='ongoing').length+'</strong></div><div class="pulse-line">'+badge('Completed','green')+'<strong>'+data.projects.filter(p=>p.status==='done').length+'</strong></div><a href="#projects" class="text-link">View projects '+icon('arrow')+'</a></section></div>'+
   '<div class="overview-grid lower-grid">'+panel('Recent activity',eventsTable(data.events.slice(0,6)),'<span class="subtle">Latest 6 entries</span>')+
   panel('Needs attention',alerts.length?'<div class="attention-list">'+alerts.slice(0,4).map(a=>'<a href="#'+a.route+'"><span class="alert-dot '+a.tone+'"></span><div><strong>'+esc(a.title)+'</strong><small>'+esc(a.text)+'</small></div>'+icon('arrow')+'</a>').join('')+'</div>':'<div class="quiet-state">'+icon('check')+'<strong>All caught up</strong><p>Payment and subscription reminders will appear here.</p></div>','<a href="#notifications" class="text-link">'+alerts.length+' alerts</a>')+'</div>'+
   '<div class="bottom-stats"><span>Net received after expenses <b>'+money(t.net)+'</b></span><span>Partner payouts <b>'+money(t.payouts)+'</b></span><span>Each partner’s 25% share <b>'+money(t.share)+'</b></span></div>';
 }
 if(page==='projects') {
  const projects=data.projects.filter(p=>matches(p,filters)&&(filters.status==='all'||p.status===filters.status));
  return heading('DELIVER GREAT WORK','Projects','Manage contracts from the first deposit to the final delivery.',button('New project','create_project'))+
  '<div class="compact-stats"><span><b>'+data.projects.filter(p=>p.status==='ongoing').length+'</b> Ongoing</span><span><b>'+data.projects.filter(p=>p.status==='done').length+'</b> Completed</span><span><b>'+money(sum(data.projects))+'</b> Total contract value</span></div>'+
  panel('Project history',toolbar(filters,[['all','All projects'],['ongoing','Ongoing'],['done','Done']],'Search name, contract, or client…')+table(['Project / client','Contract ID','Type','Responsible','Start date','Contract amount','Status','Completion'],projectRows(projects,data),'No projects match. Add your first project to get started.'));
 }
 if(page==='expenses') return heading('KEEP COSTS IN VIEW','Expenses','Every expense, with a reason and a date.',button('Add expense','add_expense'))+
  '<div class="metrics-grid three">'+metric('Total expenses',money(t.expenses),'All recorded business costs','','expenses')+metric('This month',money(sum(data.expenses.filter(e=>e.date.startsWith(today().slice(0,7))))),'Expenses in the current month','','expenses')+metric('Expense records',data.expenses.length,'Complete transaction history','','remaining')+'</div>'+
  panel('Expense history',toolbar(filters)+table(['Reason','Amount','Date'],data.expenses.filter(e=>matches(e,filters)).map(e=>row(['<strong>'+esc(e.reason)+'</strong>',moneyCell(e.amount),dateLabel(e.date)])),'No expenses recorded yet.'));
 if(page==='receipts') {
  const receipts=data.receipts.map(r=>({...r,project:projectById(r.project_id)})).filter(r=>matches(r,filters));
  return heading('MONEY COMING IN','Received payments','Record actual payments against the right project contract.',button('Record payment','receive_payment'))+
  '<div class="metrics-grid three">'+metric('Total received',money(t.received),'Cash received from project clients','','receipts')+metric('Still to collect',money(t.remaining),'Across all project contracts','','remaining')+metric('Payment records',data.receipts.length,'Deposits and subsequent payments','','receipts')+'</div>'+
  panel('Payment history',toolbar(filters,[],'Search contract, client, or note…')+table(['Contract / project','Client','Amount received','Date','Note'],receipts.map(r=>row(['<span class="contract-code">'+esc(r.project?.contract_id)+'</span><small>'+esc(r.project?.name)+'</small>',esc(r.project?.client),moneyCell(r.amount),dateLabel(r.date),esc(r.note)||'—'])),'No received payments yet.'));
 }
 if(page==='remaining') {
  const balances=data.projects.map(p=>({...p,...projectBalance(p,data.receipts)})).filter(p=>p.remaining>0&&matches(p,filters));
  return heading('CLOSE THE LOOP','Remaining payments','The unpaid part of each contract, including the final 50%.',button('Record payment','receive_payment'))+
  '<div class="metrics-grid three">'+metric('Total outstanding',money(t.remaining),'Unpaid contract balances','','remaining')+metric('Due on completed work',money(data.projects.filter(p=>p.status==='done').reduce((n,p)=>n+projectBalance(p,data.receipts).remaining,0)),'Follow up with these clients','','notifications')+metric('Contracts with a balance',data.projects.filter(p=>projectBalance(p,data.receipts).remaining>0).length,'Fully paid projects leave this list','','projects')+'</div>'+
  panel('Outstanding contracts',toolbar(filters)+table(['Contract / client','Contract total','50% target deposit','Received','Remaining','Project status',''],balances.map(p=>row(['<strong>'+esc(p.contract_id)+'</strong><small>'+esc(p.client)+'</small>',moneyCell(p.amount),moneyCell(p.deposit),moneyCell(p.received),'<strong class="text-yellow">'+money(p.remaining)+'</strong>',badge(p.status==='done'?'Done':'Ongoing',p.status==='done'?'green':'yellow'),'<button class="table-button" data-action="receive_payment" data-id="'+p.id+'">Record payment '+icon('arrow')+'</button>'])),'No outstanding balances.'))+
  panel('Collection history',table(['Contract','Amount received','Date'],data.receipts.filter(r=>matches({...r,project:projectById(r.project_id)},filters)).map(r=>row([esc(projectById(r.project_id)?.contract_id),moneyCell(r.amount),dateLabel(r.date)]))));
 }
 if(page==='subscriptions') {
  const filtered=subs.filter(s=>matches(s,filters)&&(filters.status==='all'||s.state===filters.status));
  return heading('KEEP CLIENTS CONNECTED','Annual subscriptions','Online projects start their first year on the day they are completed.')+
  '<div class="subscription-counts"><div>'+badge('Active','green')+'<strong>'+subs.filter(s=>s.state==='active').length+'</strong></div><div>'+badge('Expiring within a month','yellow')+'<strong>'+subs.filter(s=>s.state==='expiring').length+'</strong></div><div>'+badge('Expired','red')+'<strong>'+subs.filter(s=>s.state==='expired').length+'</strong></div></div>'+
  panel('Current subscriptions',toolbar(filters,[['all','All'],['active','Active'],['expiring','Expiring'],['expired','Expired']])+table(['Contract / project','Client','Term starts','Expires on','Status',''],filtered.map(s=>row(['<strong>'+esc(s.project.contract_id)+'</strong><small>'+esc(s.project.name)+'</small>',esc(s.project.client),dateLabel(s.starts_on),dateLabel(s.expires_on),badge(s.state==='expiring'?'Expiring soon':s.state==='expired'?'Expired':'Active',s.state==='expired'?'red':s.state==='expiring'?'yellow':'green'),s.state==='active'?'<span class="subtle">Up to date</span>':'<button class="table-button" data-action="renew_subscription" data-id="'+s.project_id+'">Renew for 1 year '+icon('arrow')+'</button>'])),'No subscriptions match. Complete an online project to start its first year.'))+
  panel('Subscription history',table(['Contract','Term starts','Expires on','Recorded on'],data.subscriptions.filter(s=>matches({...s,project:projectById(s.project_id)},filters)).map(s=>row([esc(projectById(s.project_id)?.contract_id),dateLabel(s.starts_on),dateLabel(s.expires_on),dateLabel(s.created_at)]))));
 }
 if(page==='partners') return heading('GROW TOGETHER','Partner payments','Four equal partners. A clear record of every distribution.',button('Pay a partner','pay_partner'))+
  '<div class="partner-grid">'+PARTNERS.map((name,i)=>{const b=partnerBalance(name,data);return '<article class="partner-card"><div class="partner-top"><span class="partner-avatar tone-'+i+'">'+initials(name)+'</span><span class="share-tag">25% SHARE</span></div><h2>'+name+'</h2><div class="partner-available"><small>Available to receive</small><strong class="'+(b.available<0?'text-red':'')+'">'+money(b.available)+'</strong></div><div class="partner-breakdown"><span>Earned share <b>'+money(b.share)+'</b></span><span>Already paid <b>'+money(b.paid)+'</b></span></div><button class="partner-pay" data-action="pay_partner" data-partner="'+name+'" '+(b.available<=0||t.cash<=0?'disabled':'')+'>Pay partner '+icon('arrow')+'</button></article>';}).join('')+'</div>'+
  '<div class="info-banner">Each partner earns 25% of received money minus expenses. Their previous payouts are deducted. Unpaid client invoices are not available cash.</div>'+
  panel('Partner payout history',toolbar(filters)+table(['Partner','Amount paid','Date'],data.payouts.filter(p=>matches(p,filters)).map(p=>row(['<span class="person-mini">'+initials(p.partner)+'</span>'+esc(p.partner),moneyCell(p.amount),dateLabel(p.date)])),'No partner payments recorded yet.'));
 if(page==='notifications') {
  const filtered=alerts.filter(a=>matches(a,filters)&&(filters.status!=='unread'||!data.reads.includes(a.id)));
  return heading('STAY ONE STEP AHEAD','Notifications','Subscription reminders and unpaid completed projects.',button('Enable desktop alerts','enable-notifications','','secondary'))+
   '<div class="info-banner">Reminders update every minute while this app is open. Desktop alerts require browser permission; closed-browser push and email are not configured.</div>'+
   panel('Alerts',toolbar(filters,[['all','All alerts'],['unread','Unread']])+ (filtered.length?'<div class="notification-list">'+filtered.map(a=>'<article class="'+(data.reads.includes(a.id)?'read':'unread')+'"><div class="notification-icon '+a.tone+'">'+icon(a.route)+'</div><div><h3>'+esc(a.title)+'</h3><p>'+esc(a.text)+'</p><a href="#'+a.route+'">View '+(a.route==='subscriptions'?'subscription':'balance')+' →</a></div>'+(data.reads.includes(a.id)?'<span class="subtle">Read</span>':'<button class="table-button" data-action="read-alert" data-id="'+esc(a.id)+'">Mark read</button>')+'</article>').join('')+'</div>':'<div class="quiet-state">'+icon('check')+'<strong>No alerts to show</strong><p>You’re up to date.</p></div>'),button('Mark all read','read-all','','secondary small'))+
   panel('Workspace activity history',eventsTable(data.events.filter(e=>matches(e,filters))));
 }
 return '';
}
