import { PARTNERS, today, money, projectBalance, partnerBalance, totals, currentSubscriptions, shiftMonths } from '../lib/finance.js';
import { esc, icon } from '../lib/html.js';
const field=(label,name,type='text',extra='')=>'<label class="form-field">'+label+'<input name="'+name+'" type="'+type+'" '+extra+' required></label>';
const amountField=(label='Amount',value='',extra='')=>field(label+' (AFN)','amount','number','min="0.01" max="999999999999.99" step="0.01" value="'+value+'" '+extra);
const dateField=(label='Date')=>field(label,'date','date','value="'+today()+'" max="'+today()+'"');
const select=(label,name,options)=>'<label class="form-field">'+label+'<select name="'+name+'" required>'+options+'</select></label>';
const option=(value,label,selected)=>'<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';
export function formContent(action,data,selectedId,selectedPartner) {
 const project=data.projects.find(p=>p.id===selectedId);
 let title='',description='',body='',submit='Save record';
 if(action==='create_project') {
  title='Add a new project';description='Start with the contract details. Record a deposit only if it has been received.';submit='Create project';
  body=field('Project name','name','text','maxlength="200" placeholder="e.g. Client website"')+field('Contract ID','contract_id','text','maxlength="100" placeholder="e.g. RTS-2026-001"')+field('Client / company','client','text','maxlength="200"')+select('Project type','type',option('online','Online',true)+option('offline','Offline'))+select('Responsible partner','responsible',PARTNERS.map(p=>option(p,p)).join(''))+field('Start date','start_date','date','value="'+today()+'"')+amountField('Full contract amount')+
  '<div class="full-width deposit-section"><label class="check-label"><input type="checkbox" name="record_deposit"> I have received the initial 50% deposit</label><p>The remaining balance is always calculated from actual receipts.</p><div id="deposit-fields" hidden>'+field('Deposit received (AFN)','deposit','number','min="0.01" step="0.01" disabled')+field('Deposit received on','deposit_date','date','value="'+today()+'" max="'+today()+'" disabled')+'</div></div>';
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
