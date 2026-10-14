/*   Stage 1B Re-engagement queue*/
(()=>{
const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT';
const button=document.getElementById('reengagementButton'),badge=document.getElementById('reengagementDueBadge'),modal=document.getElementById('reengagementModal');
if(!button||!modal)return;
const body=document.getElementById('reengagementRecords'),daily=document.getElementById('reDaily');
let records=[],tab='due',request=0;
const e=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const selected=()=>typeof selectedFranchiseIds!=='undefined'?[...selectedFranchiseIds]:[];
const date=stamp=>stamp?new Date(Number(stamp)).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const classify=r=>r.current_status==='follow_up_sent'?'awaiting':Number(r.next_action_at)<=Date.now()?'due':'scheduled';
const keyDate=offset=>{const d=new Date(Date.now()+28800000);d.setUTCDate(d.getUTCDate()-offset);return d.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric'});};
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
document.querySelectorAll('[data-re-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.reTab===tab));
const rows=records.filter(r=>classify(r)===tab).sort((a,b)=>Number(a.next_action_at)-Number(b.next_action_at));
if(!rows.length){body.innerHTML='<div class="reengagement-empty">No '+(tab==='due'?'follow-ups due':tab==='scheduled'?'scheduled follow-ups':'parents awaiting replies')+'.</div>';return;}
body.innerHTML=rows.map(r=>{
const franchise=typeof franchises!=='undefined'?franchises.find(f=>Number(f.id)===Number(r.franchise_id)):null;
const location=franchise?(franchise.location||franchise.name||franchise.branch_name):'Franchise #'+r.franchise_id;
return '<div class="reengagement-item"><div><strong>Journey #'+e(r.id)+'</strong><p>'+e(location)+' · '+(tab==='awaiting'?'Reply deadline: ':'Follow-up: ')+e(date(r.next_action_at))+'</p></div><button type="button" data-re-id="'+e(r.id)+'">View Journey</button></div>';
}).join('');
}
button.addEventListener('click',async()=>{if(typeof openDashboardModal==='function')openDashboardModal('reengagementModal');else{modal.hidden=false;document.getElementById('dashboardModalBackdrop').hidden=false;}await refresh();});
document.querySelectorAll('[data-re-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.reTab;renderList();}));
body.addEventListener('click',event=>{const btn=event.target.closest('[data-re-id]');if(!btn)return;const record=records.find(r=>String(r.id)===btn.dataset.reId);if(!record)return;showRecord(record);});
async function showRecord(record){
const id=Number(record.id),token=localStorage.getItem('ads_journey_token');
body.innerHTML='<div class="reengagement-empty">Loading journey...</div>';
try{
const response=await fetch(API+'/ad_journey_detail?journey_id='+id,{headers:{Authorization:'Bearer '+token}});
if(!response.ok)throw Error('Unable to load journey');
const data=await response.json(),inquiry=data.inquiry||{},events=Array.isArray(data.ad_journey_events)?data.ad_journey_events:[];
const name=e(inquiry.facebook_name||'Journey #'+id);
const timeline=events.slice().sort((a,b)=>Number(b.event_at||b.created_at)-Number(a.event_at||a.created_at)).map(ev=>'<div class="re-detail-event"><strong>'+e(ev.event_type)+'</strong><small>'+e(date(ev.event_at||ev.created_at))+'</small><p>'+e(ev.note||'')+'</p></div>').join('');
body.innerHTML='<div class="re-detail"><div class="re-detail-head"><h3>'+name+'</h3><button type="button" data-re-back>← Queue</button></div><div class="re-detail-cols"><section><h4>Next Step</h4><p>'+e(classify(record)==='due'?'Follow-up due':classify(record)==='awaiting'?'Awaiting parent reply':'Follow-up scheduled')+'</p><p>'+e(date(record.next_action_at))+'</p>'+(classify(record)==='due'?'<button type="button" data-re-confirm>Confirm Follow-up Sent</button>':'')+'<p class="re-detail-note">If the parent responds, return the journey to Stage 1A using the dedicated reactivation action once connected.</p><p id="reActionStatus" role="status"></p></section><section><h4>Journey History</h4><div class="re-detail-history">'+(timeline||'No history yet')+'</div></section></div></div>';
body.querySelector('[data-re-back]').addEventListener('click',renderList);
body.querySelector('[data-re-confirm]')?.addEventListener('click',async()=>{
if(!window.confirm('Confirm you actually sent the follow-up message to this parent?'))return;
const b=body.querySelector('[data-re-confirm]');b.disabled=true;
try{
const res=await fetch(API+'/ad_journey_stage1b_followup_sent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({journey_id:id,note:'Stage 1B re-engagement follow-up message sent to parent'})});
if(!res.ok)throw Error('Unable to confirm follow-up ('+res.status+')');
document.getElementById('reActionStatus').textContent='Follow-up confirmed.';await refresh();if(typeof loadBoard==='function')loadBoard();
}catch(error){b.disabled=false;document.getElementById('reActionStatus').textContent=error.message;}
});
}catch(error){body.innerHTML='<div class="reengagement-empty">'+e(error.message)+'</div><button type="button" id="reBackFallback">Back</button>';body.querySelector('#reBackFallback').addEventListener('click',renderList);}
}
document.addEventListener('click',event=>{if(event.target.closest('#franchiseCheckboxList')||event.target.closest('#selectAllFranchises')||event.target.closest('#clearAllFranchises'))setTimeout(refresh,450);});
window.addEventListener('journey-sync-refresh',refresh);
refresh();
})();