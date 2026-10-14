/*   Stage 1B Re-engagement queue*/
(()=>{
const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT';
const button=document.getElementById('reengagementButton'),badge=document.getElementById('reengagementDueBadge'),modal=document.getElementById('reengagementModal');
if(!button||!modal)return;
const body=document.getElementById('reengagementRecords'),daily=document.getElementById('reDaily'),queue=document.getElementById('reengagementQueueView'),detail=document.getElementById('reengagementDetailView');
let records=[],request=0;
const e=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const selected=()=>typeof selectedFranchiseIds!=='undefined'?[...selectedFranchiseIds]:[];
const date=stamp=>stamp?new Date(Number(stamp)).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const classify=r=>r.current_status==='follow_up_sent'?'awaiting':Number(r.next_action_at)<=Date.now()?'due':'scheduled';
const keyDate=offset=>{const d=new Date(Date.now()+28800000);d.setUTCDate(d.getUTCDate()-offset);return d.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric'});};
function positionQueue(){if(modal.classList.contains('re-detail-mode'))return;const col=document.querySelector('.journey-column[data-stage="awaiting_outcome"]')||document.querySelector('.journey-column[data-stage="awaiting-outcome"]')||[...document.querySelectorAll('.journey-column')][3];if(!col)return;const rect=col.getBoundingClientRect();modal.style.setProperty('--re-left',Math.max(6,rect.left)+'px');modal.style.setProperty('--re-top',Math.max(6,rect.top)+'px');modal.style.setProperty('--re-width',rect.width+'px');modal.style.setProperty('--re-height',Math.min(rect.height,innerHeight-rect.top-6)+'px');}
window.addEventListener('resize',positionQueue);
async function refresh(){
const id=++request,ids=selected();
if(!ids.length){records=[];draw({due_count:0,scheduled_count:0,awaiting_reply_count:0,daily_moved_counts:{}});return;}
try{
const params=new URLSearchParams();ids.forEach(x=>params.append('franchise_ids[]',String(x)));
const response=await fetch(API+'/ad_journey_stage1b?'+params,{cache:'no-store',headers:{Authorization:'Bearer '+localStorage.getItem('ads_journey_token')}});
if(!response.ok)throw Error('Unable to load Stage 1B ('+response.status+')');
const data=await response.json();if(id!==request)return;
records=Array.isArray(data.stage1b_records)?data.stage1b_records:[];draw(data);
}catch(err){if(id!==request)return;badge.hidden=true;if(!modal.hidden)body.innerHTML='<div class="reengagement-empty">'+e(err.message)+'</div>';}
}
function draw(data){
const due=Number(data.due_count)||0;
badge.textContent=String(due);badge.hidden=due===0;
document.getElementById('reDue').textContent=due;
document.getElementById('reScheduled').textContent=Number(data.scheduled_count)||0;
document.getElementById('reAwaiting').textContent=Number(data.awaiting_reply_count)||0;
const counts=data.daily_moved_counts||{};
daily.innerHTML=Array.from({length:6},(_,i)=>'<div><small>'+keyDate(5-i)+'</small><strong>'+e(counts[String(i)]??0)+'</strong></div>').join('');
renderList();
}
function renderList(){
const priority={due:0,scheduled:1,awaiting:2};
const rows=records.slice().sort((a,b)=>priority[classify(a)]-priority[classify(b)]||Number(a.next_action_at)-Number(b.next_action_at));
const total=document.getElementById('reQueueTotal');if(total)total.textContent=rows.length+' '+(rows.length===1?'record':'records');
if(!rows.length){body.innerHTML='<div class="reengagement-empty">No Re-engagement records for the selected franchises.</div>';return;}
body.innerHTML=rows.map(r=>{
const franchise=typeof franchises!=='undefined'?franchises.find(f=>Number(f.id)===Number(r.franchise_id)):null;
const location=franchise?(franchise.location||franchise.name||franchise.branch_name):'Franchise #'+r.franchise_id;
const status=classify(r),label=status==='due'?'Due now':status==='scheduled'?'Scheduled':'Awaiting Reply';
const nextLabel=status==='awaiting'?'Reply deadline':'Follow Up With Parent';
return '<div class="reengagement-item journey-card reengagement-card '+(status==='due'?'urgent':'')+'" data-re-id="'+e(r.id)+'" role="button" tabindex="0"><div class="card-top"><strong>'+e(r.parent_name||r.facebook_name||r.inquiry_name||'Journey #'+r.id)+'</strong><span class="priority '+(status==='due'?'overdue':status==='scheduled'?'upcoming':'waiting-parent')+'">'+label+'</span></div><p>'+e(location)+' · Re-engagement</p><div class="card-next"><span>'+nextLabel+'</span><time>'+e(date(r.next_action_at))+'</time></div></div>';
}).join('');
}
button.addEventListener('click',async()=>{modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;positionQueue();if(typeof openDashboardModal==='function')openDashboardModal('reengagementModal');else{modal.hidden=false;document.getElementById('dashboardModalBackdrop').hidden=false;}await refresh();});
body.addEventListener('click',event=>{const btn=event.target.closest('[data-re-id]');if(!btn)return;const record=records.find(r=>String(r.id)===btn.dataset.reId);if(!record)return;showRecord(record);});
body.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.reengagement-card')){event.preventDefault();event.target.click();}});
async function showRecord(record){
const id=Number(record.id),token=localStorage.getItem('ads_journey_token'),auth={Authorization:'Bearer '+token};
queue.hidden=true;detail.hidden=false;modal.classList.add('re-detail-mode');
detail.innerHTML='<div class="reengagement-empty">Loading Parent Journey…</div>';
try{
const response=await fetch(API+'/ad_journey_detail?journey_id='+id,{headers:auth});
const data=await response.json().catch(()=>({}));
if(!response.ok)throw Error(data.message||'Unable to load journey');
const inquiry=data.inquiry||{},journey=data.journey||record;
const name=inquiry.facebook_name||inquiry.parent_name||'Journey #'+id,location=typeof franchises!=='undefined'?(franchises.find(f=>Number(f.id)===Number(record.franchise_id))||{}):{};
const branch=location.location||location.name||location.branch_name||'Franchise #'+record.franchise_id;
const events=Array.isArray(data.ad_journey_events)?data.ad_journey_events:[];
const history=events.slice().sort((a,b)=>Number(b.event_at||b.created_at)-Number(a.event_at||a.created_at)).map(ev=>'<div class="re-timeline-entry"><strong>'+e(ev.event_type?.replaceAll('_',' ')||'Journey update')+'</strong><p>'+e(ev.note||'')+'</p><small>'+e(date(ev.event_at||ev.created_at))+'</small></div>').join('');
detail.innerHTML='<div class="re-journey-header"><div><small>PARENT JOURNEY</small><h2>'+e(name)+'</h2><p>'+e(branch)+' · Facebook: '+e(name)+'</p></div><button class="secondary-button" type="button" data-re-back>← Back</button></div><div class="re-journey-content"><section class="re-journey-actions"><div class="re-status-strip"><span><small>JOURNEY STAGE</small>Re-engagement</span><span><small>CURRENT STATUS</small>'+e(classify(record)==='due'?'Follow-up Due':classify(record)==='awaiting'?'Awaiting Parent Reply':'Scheduled')+'</span><span><small>NEXT STEP</small>'+e(classify(record)==='awaiting'?'Wait for Parent':'Message Parent')+'</span></div><div class="re-action-card"><small>NEXT STEP</small><h3>Send Message to Parent</h3><p>'+e(classify(record)==='scheduled'?'Follow-up scheduled for '+date(record.next_action_at):classify(record)==='awaiting'?'Follow-up already sent. Waiting for a reply.':'Follow-up due '+date(record.next_action_at))+'</p><p id="reSendStatus" class="re-send-status" role="status"></p></div></section><section class="re-journey-middle"><div class="re-view-tabs"><button class="selected" type="button" data-re-view="conversation">Conversation</button><button type="button" data-re-view="history">History</button></div><div class="re-view-body" id="reConversation"><div class="reengagement-empty">Loading conversation…</div></div><div class="re-view-body" id="reHistory" hidden>'+ (history||'<div class="reengagement-empty">No journey history.</div>')+'</div><form id="reSendForm" class="re-send-form"><label for="reMessageText">REPLY TO PARENT</label><textarea id="reMessageText" placeholder="Write your reply…" required></textarea><button type="submit">Send Message to Parent</button></form></section></div>';
const back=detail.querySelector('[data-re-back]'),send=detail.querySelector('#reSendForm');
back.addEventListener('click',()=>{modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;positionQueue();renderList();});
detail.querySelectorAll('[data-re-view]').forEach(tab=>tab.addEventListener('click',()=>{detail.querySelectorAll('[data-re-view]').forEach(t=>t.classList.toggle('selected',t===tab));detail.querySelector('#reConversation').hidden=tab.dataset.reView!=='conversation';detail.querySelector('#reHistory').hidden=tab.dataset.reView!=='history';}));
async function loadConversation(){
const target=detail.querySelector('#reConversation'),inquiryId=Number(journey.ad_inquiry_id||record.ad_inquiry_id);
if(!inquiryId){target.innerHTML='<div class="reengagement-empty">No inquiry linked.</div>';return;}
try{const res=await fetch(API+'/ad_messenger_conversation?ad_inquiry_id='+inquiryId,{headers:auth});if(!res.ok)throw Error('Conversation unavailable');
const json=await res.json(),raw=Array.isArray(json.messages)?json.messages:(json.messages?.items||json.messages?.records||[]);
target.innerHTML=raw.length?raw.slice().sort((a,b)=>Number(a.message_timestamp||a.created_at)-Number(b.message_timestamp||b.created_at)).map(m=>'<div class="re-message '+(m.direction==='outbound'||m.direction==='outgoing'?'outgoing':'incoming')+'"><div>'+e(m.message_text||'')+'<small>'+e(date(m.message_timestamp||m.created_at))+'</small></div></div>').join(''):'<div class="reengagement-empty">No Messenger messages recorded for this inquiry yet.</div>';target.scrollTop=target.scrollHeight;
}catch(error){target.innerHTML='<div class="reengagement-empty">'+e(error.message)+'</div>';}
}
await loadConversation();
send.addEventListener('submit',async ev=>{
ev.preventDefault();const text=detail.querySelector('#reMessageText').value.trim(),status=detail.querySelector('#reSendStatus'),submit=send.querySelector('[type=submit]');
if(!text)return;
if(!window.confirm('Send this message to the parent on Messenger?'))return;
submit.disabled=true;status.textContent='Sending message…';
try{
const res=await fetch(API+'/ad_messenger_send',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({journey_id:id,message_text:text})});
const result=await res.json().catch(()=>({}));if(!res.ok||result.success===false||result.error||result.code)throw Error(result.message||result.error||'Message could not be sent');
status.textContent='Message sent.';send.reset();
if(classify(record)==='due'){
const conf=await fetch(API+'/ad_journey_stage1b_followup_sent',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({journey_id:id,note:'Stage 1B follow-up message sent to parent'})});
if(!conf.ok)status.textContent='Message sent. Follow-up confirmation needs attention.';
}
await loadConversation();await refresh();if(typeof loadBoard==='function')loadBoard();
}catch(error){status.textContent=error.message||'Could not send message.';}finally{submit.disabled=false;}
});
}catch(error){detail.innerHTML='<div class="reengagement-empty">'+e(error.message)+'</div><button type="button" id="reBackFallback">← Back</button>';detail.querySelector('#reBackFallback').addEventListener('click',()=>{modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;positionQueue();renderList();});}
}
document.addEventListener('click',event=>{if(event.target.closest('#franchiseCheckboxList')||event.target.closest('#selectAllFranchises')||event.target.closest('#clearAllFranchises'))setTimeout(refresh,450);});
/*   Clear this queue when the normal Parent Journey workspace opens*/
function dismissForOtherJourney(){
if(modal.hidden)return;
modal.hidden=true;modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;
document.getElementById('dashboardModalBackdrop').hidden=true;
}
const normalJourneyPanel=document.getElementById('journeyPanel');
if(normalJourneyPanel){
const observer=new MutationObserver(()=>{if(normalJourneyPanel.classList.contains('open'))dismissForOtherJourney();});
observer.observe(normalJourneyPanel,{attributes:true,attributeFilter:['class']});
}
document.addEventListener('click',event=>{
if(event.target.closest('.journey-card[data-journey-id]')&&!event.target.closest('#reengagementModal'))dismissForOtherJourney();
},true);
window.addEventListener('journey-sync-refresh',refresh);
refresh();
})();