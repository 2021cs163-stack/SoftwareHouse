import { PARTNERS, today, money, dateLabel, projectBalance, partnerBalance, totals, currentSubscriptions, shiftMonths } from '../lib/finance.js';
import { esc, icon, externalLink } from '../lib/html.js';
const field=(label,name,type='text',extra='')=>'<label class="form-field">'+label+'<input name="'+name+'" type="'+type+'" '+extra+' required></label>';
const amountField=(label='Amount',value='',extra='')=>field(label+' (AFN)','amount','number','min="0.01" max="999999999999.99" step="0.01" value="'+value+'" '+extra);
const dateField=(label='Date')=>field(label,'date','date','value="'+today()+'" max="'+today()+'"');
const select=(label,name,options)=>'<label class="form-field">'+label+'<select name="'+name+'" aria-label="'+esc(label)+'" required>'+options+'</select></label>';
const option=(value,label,selected)=>'<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';
export function formContent(action,data,selectedId,selectedPartner) {
 const project=data.projects.find(p=>p.id===selectedId);
 let title='',description='',body='',submit='Save record';
 if(action==='create_project') {

  title='Add a new project';description='Enter the client details and the exact amounts paid and remaining. The contract total is their sum.';submit='Create project';
  body=field('Project name','name','text','maxlength="200" placeholder="e.g. Client website"')+
   field('Contract ID','contract_id','text','maxlength="100" placeholder="e.g. RTS-2026-001"')+
   field('Client / company','client','text','maxlength="200"')+
   '<label class="form-field">Client contact<input name="client_contact" maxlength="200" placeholder="Phone number or email"></label>'+
   select('Project type','type',option('online','Online',true)+option('offline','Offline'))+
   select('Responsible partner','responsible',PARTNERS.map(p=>option(p,p)).join(''))+
   field('Start date','start_date','date','value="'+today()+'"')+
   '<label class="form-field">Repository link<input name="repo_url" type="url" maxlength="2000" placeholder="https://github.com/..."></label>'+
   '<label class="form-field full-width">Deployment link<input name="deployment_url" type="url" maxlength="2000" placeholder="https://your-project.com"></label>'+
   '<label class="form-field full-width">Project details<textarea name="details" aria-label="Project details" maxlength="4000" rows="3" placeholder="Scope, requirements, or useful notes"></textarea></label>'+
   field('Paid money (AFN)','paid_amount','number','min="0" max="999999999999.99" step="0.01" value="0"')+
   field('Remaining money (AFN)','remaining_amount','number','min="0" max="999999999999.99" step="0.01" value="0"')+
   '<div id="contract-total" class="form-hint full-width" role="status">Contract total: '+money(0)+'</div>'+
   '<label class="form-field">Payment received on<input name="paid_date" type="date" value="'+today()+'" max="'+today()+'"><small>Required only when paid money is above zero.</small></label>';

 } else if(action==='edit_project') {
  title='Edit project';description='Update the details for this project.';submit='Save changes';
  const input=(label,name,type='text',extra='')=>field(label,name,type,'value="'+esc(project[name]||'')+'" '+extra);
  const optional=(label,name,type='text',max=200)=>'<label class="form-field">'+label+'<input name="'+name+'" type="'+type+'" maxlength="'+max+'" value="'+esc(project[name]||'')+'"></label>';
  const balance=projectBalance(project,data.receipts);
  body='<input type="hidden" name="project_id" value="'+esc(project.id)+'">'+
   input('Project name','name','text','maxlength="200"')+
   input('Contract ID','contract_id','text','maxlength="100"')+
   input('Client / company','client','text','maxlength="200"')+
   optional('Client contact','client_contact')+
   (project.status==='done'?'<input type="hidden" name="type" value="'+esc(project.type)+'"><div class="form-hint">Project type: '+esc(project.type)+' · Completed</div>':
    select('Project type','type',option('online','Online',project.type==='online')+option('offline','Offline',project.type==='offline')))+
   select('Responsible partner','responsible',PARTNERS.map(p=>option(p,p,p===project.responsible)).join(''))+
   input('Start date','start_date','date',project.completed_on?'max="'+project.completed_on+'"':'')+
   optional('Repository link','repo_url','url',2000)+optional('Deployment link','deployment_url','url',2000)+
   '<label class="form-field full-width">Project details<textarea name="details" aria-label="Project details" maxlength="4000" rows="4">'+esc(project.details||'')+'</textarea></label>'+
   '<div class="form-hint full-width">Paid: '+money(balance.received)+' · Remaining: '+money(balance.remaining)+'<br>Record new client payments from Received payments.</div>';
 } else if(action==='add_investment') {
  title='Record partner investment';description='Add capital contributed by a partner. This increases business cash and is kept separate from client income and profit.';submit='Save investment';
  body='<div class="full-width">'+select('Partner','partner',PARTNERS.map(p=>option(p,p,p===selectedPartner)).join(''))+'</div>'+
   amountField('Investment amount')+dateField()+
   '<label class="form-field full-width">Note (optional)<input name="note" maxlength="500" placeholder="Initial capital, equipment funding, or reference"></label>';
  } else if(action==='add_expense') {
  title='Record an expense';description='Keep a clear record of what the business spent.';submit='Save expense';
  body='<label class="form-field full-width">Reason<textarea name="reason" required maxlength="500" placeholder="What was this expense for?" rows="3"></textarea></label>'+amountField()+dateField();
 } else if(action==='receive_payment') {
  title='Record received payment';description='This adds money received and reduces the selected project’s remaining balance.';submit='Record payment';
  const projects=data.projects.filter(p=>projectBalance(p,data.receipts).remaining>0);
  const p=project||projects[0];
  body='<div class="full-width">'+select('Project contract','project_id',projects.length?projects.map(p=>option(p.id,p.contract_id+' · '+p.client,p.id===selectedId)).join(''):option('','No unpaid project contracts'))+'</div>'+
  '<div id="balance-hint" class="form-hint full-width">'+(p?'Outstanding: '+money(projectBalance(p,data.receipts).remaining):'Add a project before recording a payment.')+'</div>'+amountField('Amount',p?projectBalance(p,data.receipts).remaining:'')+dateField()+ '<label class="form-field full-width">Note (optional)<input name="note" maxlength="500" placeholder="Deposit, final payment, or reference"></label>';
 } else if(action==='pay_partner') {
  title='Pay a partner';description='A payout reduces business cash and this partner’s available share.';submit='Record payout';
  const name=selectedPartner||PARTNERS[0];
  body='<div class="full-width">'+select('Partner','partner',PARTNERS.map(p=>option(p,p,p===name)).join(''))+'</div><div id="balance-hint" class="form-hint full-width">Available share: '+money(partnerBalance(name,data).available)+' · Business cash: '+money(totals(data).cash)+'</div>'+amountField()+dateField();
 } else if(action==='complete_project') {
  title='Mark project as done';description=project?.type==='online'?'This will move the project to Done and start its annual subscription from the completion date.':'This will move the project to Done. Offline projects do not get an annual subscription.';submit='Mark as done';
  body='<input type="hidden" name="project_id" value="'+esc(selectedId)+'"><div class="form-hint full-width"><strong>'+esc(project?.contract_id)+' · '+esc(project?.name)+'</strong><br>Remaining payment: '+money(projectBalance(project,data.receipts).remaining)+'</div>'+dateField('Completion date');
 } else if(action==='renew_subscription') {
  title='Renew annual subscription';description='This records another year of service. It does not record a fee or change contract payments.';submit='Confirm renewal';
  const period=currentSubscriptions(data).find(s=>s.project_id===selectedId);
  const start=period.expires_on>today()?period.expires_on:today();
  body='<input type="hidden" name="project_id" value="'+esc(selectedId)+'"><div class="renew-summary full-width"><strong>'+esc(project.contract_id)+' · '+esc(project.name)+'</strong><p>New term: '+start+' → '+shiftMonths(start,12)+'</p></div>';
 }
 return '<div class="dialog-heading"><div><span class="section-index">RAYAN WORKSPACE</span><h2>'+title+'</h2></div><button class="icon-button" type="button" data-action="close-dialog" aria-label="Close">'+icon('close')+'</button></div><p class="dialog-description">'+description+'</p><form id="record-form" data-kind="'+action+'" data-request-id="'+crypto.randomUUID()+'"><div class="form-grid">'+body+'</div><p id="record-error" class="error" role="alert"></p><div class="dialog-footer"><button class="secondary" type="button" data-action="close-dialog">Cancel</button><button class="primary" type="submit">'+submit+' '+icon('check')+'</button></div></form>';
}

export function projectDetails(project,data) {
 const balance=projectBalance(project,data.receipts);
 const item=(label,value)=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>';
 return '<div class="dialog-heading"><div><span class="section-index">'+esc(project.contract_id)+'</span><h2>'+esc(project.name)+'</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close">'+icon('close')+'</button></div>'+
 '<dl class="project-details">'+item('Client',esc(project.client))+item('Contact',esc(project.client_contact)||'—')+
 item('Repository',externalLink(project.repo_url,'Open repository'))+item('Deployment',externalLink(project.deployment_url,'Open deployment'))+
 item('Responsible',esc(project.responsible))+item('Project type',esc(project.type))+
 item('Start date',dateLabel(project.start_date))+item('Status',project.status==='done'?'Done':'Ongoing')+
 item('Contract total',money(project.amount))+item('Paid money',money(balance.received))+item('Remaining money',money(balance.remaining))+
 '</dl><div class="project-notes"><h3>Project details</h3><p>'+esc(project.details||'No additional details.')+'</p></div>'+
 '<div class="dialog-footer"><button class="secondary" data-action="close-dialog">Close</button><button class="primary" data-action="edit_project" data-id="'+esc(project.id)+'">Edit project</button></div>';
}
