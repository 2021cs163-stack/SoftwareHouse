export const PARTNERS = ['Fazlullah Sardarkhil', 'Khoshal Amin', 'Akmal Stanikzai', 'Noman Wahdat'];
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kabul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const cents = value => Math.round(Number(value || 0) * 100);
export const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AFN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
export const dateLabel = value => value ? new Date(value.slice(0,10) + 'T12:00:00Z').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' }) : '—';
export function shiftMonths(value, amount) {
  const [y,m,d] = value.slice(0,10).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + amount, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth()+1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d,last));
  return first.toISOString().slice(0,10);
}
export function subscriptionStatus(period, now = today()) {
  if (now >= period.expires_on) return 'expired';
  if (now >= shiftMonths(period.expires_on, -1)) return 'expiring';
  return 'active';
}
export const sum = (rows, field = 'amount') => rows.reduce((total,row) => total + cents(row[field]),0) / 100;
export function projectBalance(project, receipts) {
  const received = sum(receipts.filter(row => row.project_id === project.id));
  return { received, remaining: (cents(project.amount)-cents(received))/100 };
}
export function totals(data) {
  const received = sum(data.receipts), expenses = sum(data.expenses), payouts = sum(data.payouts);
  const invested = sum(data.investments || []);
  const netCents = cents(received)-cents(expenses);
  return { received, expenses, payouts, invested, net:netCents/100, cash:(netCents+cents(invested)-cents(payouts))/100,
    remaining:data.projects.reduce((n,p) => n+cents(projectBalance(p,data.receipts).remaining),0)/100,
    share:Math.floor(Math.max(netCents,0)/4)/100 };
}
export function partnerBalance(name,data) {
  const paid = sum(data.payouts.filter(p=>p.partner===name));
  return { paid, invested:sum((data.investments || []).filter(i=>i.partner===name)), share:totals(data).share, available:(cents(totals(data).share)-cents(paid))/100 };
}
export function currentSubscriptions(data) {
  return data.projects.filter(p=>p.type==='online' && p.status==='done').map(project => {
    const periods = data.subscriptions.filter(s=>s.project_id===project.id).sort((a,b)=>b.expires_on.localeCompare(a.expires_on));
    return periods[0] ? { ...periods[0], project, state:subscriptionStatus(periods[0]) } : null;
  }).filter(Boolean);
}
export function notifications(data) {
  const alerts = [];
  for (const period of currentSubscriptions(data)) {
    if (period.state==='active') continue;
    alerts.push({ id:'subscription:'+period.id+':'+period.state, tone:period.state==='expired'?'red':'yellow', title:period.state==='expired'?'Subscription expired':'Subscription expires soon',
      text:period.project.contract_id+' · '+period.project.name+' · '+dateLabel(period.expires_on), route:'subscriptions', date:period.expires_on });
  }
  for (const p of data.projects) {
    const balance=projectBalance(p,data.receipts);
    if (p.status==='done' && balance.remaining>0) alerts.push({id:'balance:'+p.id+':'+cents(balance.remaining),tone:'yellow',title:'Final payment outstanding',text:p.contract_id+' · '+money(balance.remaining)+' remaining',route:'remaining',date:p.completed_on});
  }
  return alerts;
}
export function emptyData() { return {investments:[], projects:[], receipts:[], expenses:[], payouts:[], subscriptions:[], events:[], reads:[]}; }
