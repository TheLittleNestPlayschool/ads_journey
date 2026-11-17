/*   Stage 1B Re-engagement queue*/
(()=>{
const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT';
const button=document.getElementById('reengagementButton'),badge=document.getElementById('reengagementDueBadge'),modal=document.getElementById('reengagementModal');
if(!button||!modal)return;
/*   Explicit inline visibility prevents a hidden queue from painting on reload*/
modal.hidden=true;modal.style.display='none';
const visibilityObserver=new MutationObserver(()=>{modal.style.display=modal.hidden?'none':'flex';});
visibilityObserver.observe(modal,{attributes:true,attributeFilter:['hidden']});
const body=document.getElementById('reengagementRecords'),daily=document.getElementById('reDaily'),queue=document.getElementById('reengagementQueueView'),detail=document.getElementById('reengagementDetailView');
let records=[],lockMap=new Map(),request=0,lockId=0,lockOwned=false,lockTimer=null,lockSeq=0;
const justSent=new Set();
/*   Stage 1B reply alerts are separate from the Stage 1A board column. */
const stage1BReplies=()=>[...(window.adsReplyAttentionByJourney?.values()||[])].filter(item=>{const live=typeof boardJourneys!=='undefined'?boardJourneys.find(row=>Number(row.id)===Number(item.ad_journey_id)):null;return String(live?.current_stage||item.current_stage)==='inquiry_follow_up_pending'&&Number(item.unanswered_count)>0;});
const hasParentReply=r=>Number(window.adsReplyAttentionByJourney?.get(Number(r.id))?.unanswered_count)>0;
function renderStage1BReplyAlert(){
let indicator=button.querySelector('.re-ai-attention-badge');
if(!indicator){indicator=document.createElement('span');indicator.className='re-ai-attention-badge';indicator.style.cssText='padding:3px 8px;margin-left:6px;background:#07ab50;color:#fff;border-radius:12px;font-size:10px;font-weight:800';button.appendChild(indicator);}
const count=stage1BReplies().length;indicator.hidden=!count;indicator.textContent=count+' NEED REPLY';indicator.title='Open the oldest Stage 1B parent awaiting a reply';
}
window.addEventListener('ads-reply-attention-changed',()=>{renderStage1BReplyAlert();if(!modal.hidden&&queue&&!queue.hidden)renderList();});
window.addEventListener('ads-reply-attention-routing-refresh',renderStage1BReplyAlert);
renderStage1BReplyAlert();
const sendConfirm=document.createElement('div');sendConfirm.className='journey-change-overlay';sendConfirm.hidden=true;
sendConfirm.innerHTML='<div class="journey-change-dialog" role="dialog" aria-modal="true" aria-labelledby="reFollowupConfirmTitle" aria-describedby="reFollowupConfirmDescription"><span class="journey-change-kicker">THE LITTLE NEST · ADS JOURNEY</span><h3 id="reFollowupConfirmTitle">Confirm Follow-up Sent</h3><p id="reFollowupConfirmDescription"></p><div class="journey-change-buttons"><button type="button" class="journey-change-cancel">Cancel</button><button type="button" class="journey-change-confirm">Confirm Sent</button></div></div>';
document.body.appendChild(sendConfirm);
let sendConfirmResolver=null,sendConfirmReturnFocus=null;
function finishSendConfirmation(approved){if(!sendConfirmResolver)return;const resolve=sendConfirmResolver;sendConfirmResolver=null;sendConfirm.hidden=true;sendConfirmReturnFocus?.focus?.();sendConfirmReturnFocus=null;resolve(approved);}
function confirmFollowupSent(parentName){
if(sendConfirmResolver)return Promise.resolve(false);
sendConfirmReturnFocus=document.activeElement;
sendConfirm.querySelector('#reFollowupConfirmDescription').textContent='Confirm that the follow-up message was actually sent to '+parentName+'? This will remove the parent from the action queue while the system waits for a reply.';
sendConfirm.hidden=false;sendConfirm.querySelector('.journey-change-confirm').focus();
return new Promise(resolve=>{sendConfirmResolver=resolve;});
}
sendConfirm.querySelector('.journey-change-cancel').addEventListener('click',()=>finishSendConfirmation(false));
sendConfirm.querySelector('.journey-change-confirm').addEventListener('click',()=>finishSendConfirmation(true));
sendConfirm.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finishSendConfirmation(false);}});
const queueNotice=document.createElement('p');queueNotice.className='re-queue-notice';queueNotice.setAttribute('role','status');queueNotice.hidden=true;queue.querySelector('.reengagement-queue-head')?.after(queueNotice);
function showQueueNotice(message){queueNotice.textContent=message;queueNotice.hidden=!message;}
const LOCK_RENEW_MS=60000;
const nameCache=new Map(),nameAttempted=new Set(),nameQueued=new Set(),nameQueue=[];let nameObserver=null,nameLoading=0;
function recordName(r){
const inquiry=r._ad_inquiry||r.inquiry||{};
const board=typeof boardJourneys!=='undefined'?boardJourneys.find(j=>Number(j.id)===Number(r.id)):null;
const linked=board?._ad_inquiry||{};
return String(r.resolved_name||r.parent_name||r.facebook_name||r.inquiry_name||inquiry.parent_name||inquiry.facebook_name||linked.parent_name||linked.facebook_name||nameCache.get(Number(r.id))||'').trim();
}
/*   Resolve missing names only as queue cards come into view; cache results for repeat visits*/
function resolveQueuedNames(){
while(nameLoading<3&&nameQueue.length){
const id=nameQueue.shift();nameQueued.delete(id);if(nameAttempted.has(id))continue;
nameAttempted.add(id);nameLoading++;
(async()=>{try{
const response=await fetch(API+'/ad_journey_detail?journey_id='+id,{cache:'no-store',headers:{Authorization:'Bearer '+localStorage.getItem('ads_journey_token')}});
if(!response.ok)return;
const data=await response.json().catch(()=>({})),inquiry=data.inquiry||{};
const name=String(inquiry.parent_name||inquiry.facebook_name||'').trim();
if(!name)return;
nameCache.set(id,name);
const record=records.find(r=>Number(r.id)===id);if(record)record.resolved_name=name;
const card=[...body.querySelectorAll('.reengagement-card')].find(x=>Number(x.dataset.reId)===id);
const label=card?.querySelector('.card-top > strong');if(label)label.textContent=name;
}catch(_error){}finally{nameLoading--;resolveQueuedNames();}})();
}
}
function hydrateQueueNames(){
if(nameObserver){nameObserver.disconnect();nameObserver=null;}
const unresolved=[...body.querySelectorAll('.reengagement-card')].filter(card=>{
const record=records.find(r=>Number(r.id)===Number(card.dataset.reId));
return record&&!recordName(record)&&!nameAttempted.has(Number(record.id));
});
if(!unresolved.length)return;
if(typeof IntersectionObserver==='undefined'){unresolved.slice(0,8).forEach(card=>{const id=Number(card.dataset.reId);if(!nameQueued.has(id)){nameQueued.add(id);nameQueue.push(id);}});resolveQueuedNames();return;}
nameObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)return;nameObserver?.unobserve(entry.target);const id=Number(entry.target.dataset.reId);if(!nameAttempted.has(id)&&!nameQueued.has(id)){nameQueued.add(id);nameQueue.push(id);}});resolveQueuedNames();},{root:null,rootMargin:'160px 0px'});
unresolved.forEach(card=>nameObserver.observe(card));
}
async function lockCall(endpoint,id){const res=await fetch(API+'/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('ads_journey_token'),'Content-Type':'application/json'},body:JSON.stringify({ad_journey_id:id})});const data=await res.json().catch(()=>({}));if(!res.ok||data.success!==true)throw Error(data.message||data.error||'Record lock unavailable');return data;}
function stopRenewal(){if(lockTimer!==null){clearInterval(lockTimer);lockTimer=null;}}
async function releaseLock(){const id=lockOwned?lockId:0;++lockSeq;stopRenewal();lockId=0;lockOwned=false;if(id)try{await lockCall('ad_journey_lock_release',id);}catch(_error){}}
function lockUI(message){const status=detail.querySelector('#reLockStatus'),send=detail.querySelector('#reSendForm button[type=submit]'),dock=detail.querySelector('[data-re-send-shortcut]'),reactivate=detail.querySelector('[data-re-reactivate]'),enroll=detail.querySelector('[data-re-enroll]');if(status)status.textContent=message;if(send)send.disabled=!lockOwned;if(dock)dock.disabled=!lockOwned;if(reactivate)reactivate.disabled=!lockOwned;if(enroll)enroll.disabled=!lockOwned;}
async function takeLock(id){const seq=++lockSeq;stopRenewal();lockOwned=false;lockId=0;lockUI('Checking record control…');try{await lockCall('ad_journey_lock_acquire',id);if(seq!==lockSeq||modal.hidden||!modal.classList.contains('re-detail-mode')){try{await lockCall('ad_journey_lock_release',id)}catch(_error){}return;}lockId=id;lockOwned=true;lockUI('You have control');lockTimer=setInterval(async()=>{if(document.hidden||!lockOwned)return;try{await lockCall('ad_journey_lock_acquire',id)}catch(error){if(lockId===id){lockOwned=false;stopRenewal();lockUI('Control lost — view only');}}},LOCK_RENEW_MS);}catch(error){if(seq===lockSeq)lockUI('View only — '+error.message);}}

const reEnrollStyle=document.createElement('style');reEnrollStyle.textContent='.re-stage1b-enroll-form{padding:12px 14px;background:#fffaf2;border-top:1px solid #e5d9c3;display:grid;gap:8px}.re-stage1b-enroll-form[hidden]{display:none!important}.re-stage1b-enroll-form label{font-size:9px;font-weight:800;color:#657786}.re-stage1b-enroll-form textarea{width:100%;box-sizing:border-box;border:1px solid #bacbd2;border-radius:7px;padding:9px;font:inherit;font-size:12px;resize:vertical}.re-stage1b-enroll-actions{display:flex;gap:8px;justify-content:flex-end}.re-stage1b-enroll-actions button{border:1px solid #abc4d1;background:#deebf2;color:#263747;border-radius:6px;font-size:10px;font-weight:800;padding:9px 12px;cursor:pointer}.re-stage1b-enroll-actions button[type=submit]{background:#dceee2;border-color:#9abca5}.re-stage1b-enroll-form p{margin:0;font-size:11px;color:#8c412c}.re-action-dock [data-re-enroll]{background:#dceee2;border-color:#a2c5ad;color:#26523e}';document.head.appendChild(reEnrollStyle);
const e=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const selected=()=>typeof selectedFranchiseIds!=='undefined'?[...selectedFranchiseIds]:[];
const viewerId=()=>{try{return Number(JSON.parse(localStorage.getItem('ads_journey_user')||'{}').id)||0;}catch(_){return 0;}};
const lockLabel=r=>{const lock=lockMap.get(Number(r.id));if(!lock)return '';const holder=Number(lock.locked_by_ad_user_id)||0,expires=Number(lock.lock_expires_at)||0;if(!holder||expires<=Date.now()||holder===viewerId())return '';const admin=lock._locked_by_ad_user||{};return 'In use · '+(admin.name||admin.full_name||(admin.first_name?[admin.first_name,admin.last_name].filter(Boolean).join(' '):'')||('Admin #'+holder));};
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
records=Array.isArray(data.stage1b_records)?data.stage1b_records:[];
for(const sentId of justSent){const current=records.find(item=>Number(item.id)===sentId);if(!current||classify(current)==='awaiting')justSent.delete(sentId);}
try{const lockRes=await fetch(API+'/ad_journey_lock_status?'+params,{cache:'no-store',headers:{Authorization:'Bearer '+localStorage.getItem('ads_journey_token')}});if(!lockRes.ok)throw Error('Lock status unavailable');const lockData=await lockRes.json();if(id!==request)return;lockMap=new Map((Array.isArray(lockData.journey_locks)?lockData.journey_locks:[]).map(item=>[Number(item.id),item]));}catch(_error){if(id!==request)return;lockMap=new Map();}
draw(data);
}catch(err){if(id!==request)return;badge.hidden=false;if(!modal.hidden)body.innerHTML='<div class="reengagement-empty">'+e(err.message)+'</div>';}
}
function draw(data){
const due=Number(data.due_count)||0;
badge.textContent=String(due);badge.hidden=false;
document.getElementById('reDue').textContent=due;
document.getElementById('reScheduled').textContent=Number(data.scheduled_count)||0;
document.getElementById('reAwaiting').textContent=Number(data.awaiting_reply_count)||0;
const counts=data.daily_moved_counts||{};
daily.innerHTML=Array.from({length:6},(_,i)=>'<div><small>'+keyDate(5-i)+'</small><strong>'+e(counts[String(i)]??0)+'</strong></div>').join('');
renderList();
}
function renderList(){
const priority={due:0,scheduled:1,awaiting:2};
const locationOf=r=>{const f=typeof franchises!=='undefined'?franchises.find(f=>Number(f.id)===Number(r.franchise_id)):null;return String(f?(f.location||f.name||f.branch_name):'Franchise #'+r.franchise_id).trim();};
const rows=records.filter(r=>(classify(r)!=='awaiting'&&!justSent.has(Number(r.id)))||hasParentReply(r)).sort((a,b)=>locationOf(a).localeCompare(locationOf(b),undefined,{sensitivity:'base',numeric:true})||priority[classify(a)]-priority[classify(b)]||(Number(a.next_action_at)||0)-(Number(b.next_action_at)||0));
const total=document.getElementById('reQueueTotal');if(total)total.textContent=rows.length+' '+(rows.length===1?'record':'records');
if(!rows.length){body.innerHTML='<div class="reengagement-empty">No follow-ups requiring action. Sent follow-ups remain tracked while awaiting a parent reply.</div>';return;}
let lastLocation='';
body.innerHTML=rows.map(r=>{
const franchise=typeof franchises!=='undefined'?franchises.find(f=>Number(f.id)===Number(r.franchise_id)):null;
const location=locationOf(r);
const divider=location.toLocaleLowerCase()===lastLocation.toLocaleLowerCase()?'':'<div class="location-divider">'+e(location)+'</div>';
lastLocation=location;
const lockedLabel=lockLabel(r);
const status=classify(r),needsReply=hasParentReply(r),label=needsReply?'Parent Reply Needed':status==='due'?'Due now':status==='scheduled'?'Scheduled':'Awaiting Reply';
const nextLabel=needsReply?'Reply to Parent':status==='awaiting'?'Reply deadline':'Follow Up With Parent';
return divider+'<div class="reengagement-item journey-card reengagement-card '+(status==='due'?'urgent':'')+'" data-re-id="'+e(r.id)+'" role="button" tabindex="0"><div class="card-top"><strong>'+e(recordName(r)||'Journey #'+r.id)+'</strong>'+(lockedLabel?'<span class="re-card-lock">🔒 '+e(lockedLabel)+'</span>':'')+'<span class="priority '+(status==='due'?'overdue':status==='scheduled'?'upcoming':'waiting-parent')+'">'+label+'</span></div><p>'+e(location)+' · Re-engagement</p><div class="card-next"><span>'+nextLabel+'</span><time>'+e(date(r.next_action_at))+'</time></div></div>';
}).join('');hydrateQueueNames();
}
button.addEventListener('click',async event=>{if(event.target.closest('.re-ai-attention-badge')){const first=stage1BReplies().sort((a,b)=>Number(a.last_parent_at)-Number(b.last_parent_at))[0];if(first)window.dispatchEvent(new CustomEvent('open-attention-journey',{detail:{journeyId:first.ad_journey_id,franchiseId:first.franchise_id}}));return;}await releaseLock();showQueueNotice('');modal.style.display='flex';modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;positionQueue();if(typeof openDashboardModal==='function')openDashboardModal('reengagementModal');else{modal.hidden=false;document.getElementById('dashboardModalBackdrop').hidden=false;}await refresh();});
/*   Allow global Journey Search to open an active Stage 1B record directly*/
window.openStage1BJourney=async (journeyId,options={})=>{
const id=Number(journeyId)||0;if(!id)return false;
await refresh();
const record=records.find(r=>Number(r.id)===id);
if(!record)return false;
await releaseLock();
modal.style.display='flex';modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;positionQueue();
if(typeof openDashboardModal==='function')openDashboardModal('reengagementModal');else{modal.hidden=false;document.getElementById('dashboardModalBackdrop').hidden=false;}
await showRecord(record);
if(options.fromAttention){const note=detail.querySelector('#reSendStatus');if(note)note.textContent='A parent is waiting for a reply. Review the Luna–Terra suggestion in Conversation; you can reply without reactivating the journey.';}
return true;
};
body.addEventListener('click',event=>{const btn=event.target.closest('[data-re-id]');if(!btn)return;const record=records.find(r=>String(r.id)===btn.dataset.reId);if(!record)return;showRecord(record);});
body.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.reengagement-card')){event.preventDefault();event.target.click();}});
function historyMarkup(events){return events.slice().sort((a,b)=>Number(b.event_at||b.created_at)-Number(a.event_at||a.created_at)).map(ev=>'<div class="re-timeline-entry"><strong>'+e(ev.event_type?.replaceAll('_',' ')||'Journey update')+'</strong><p>'+e(ev.note||'')+'</p><small>'+e(typeof window.adsJourneyEventActorName==='function'?window.adsJourneyEventActorName(ev):(ev._ad_user?.name||(Number(ev.ad_user_id)>0?'Admin #'+ev.ad_user_id:'System')))+' · '+e(date(ev.event_at||ev.created_at))+'</small></div>').join('');}
async function refreshHistoryAfterSend(id,auth,oldEventCount){
const res=await fetch(API+'/ad_journey_detail?journey_id='+id,{headers:auth,cache:'no-store'});
if(!res.ok)throw Error('Unable to reload history');
const data=await res.json().catch(()=>({})),events=Array.isArray(data.ad_journey_events)?data.ad_journey_events:null;
if(!events)throw Error('Journey events missing from history response');
if(Number(detail.dataset.journeyId)!==id)return false;
const target=detail.querySelector('#reHistory');
if(target)target.innerHTML=historyMarkup(events)||'<div class="reengagement-empty">No journey history.</div>';
const journey=data.journey||{};
if(journey.current_status==='follow_up_sent'){
const strips=detail.querySelectorAll('.re-status-strip span');
if(strips[1])strips[1].innerHTML='<small>CURRENT STATUS</small>Awaiting Parent Reply';
if(strips[2])strips[2].innerHTML='<small>NEXT STEP</small>Wait for Parent';
const title=detail.querySelector('.re-action-card h3'),description=detail.querySelector('.re-action-card > p');
if(title)title.textContent='Waiting for Parent Reply';
if(description)description.textContent='Follow-up sent. Parent reply deadline '+date(journey.next_action_at);
const dock=detail.querySelector('[data-re-send-shortcut]');
if(dock){dock.disabled=true;dock.hidden=true;}
}
return events.length>oldEventCount;
}
/*   Shared reply attention stays visible while Stage 1B manages follow-ups. */
let updateOpenStage1BAi=null;
window.addEventListener('ads-reply-attention-changed',()=>{if(!modal.hidden&&!detail.hidden)updateOpenStage1BAi?.();});
const reAiStyle=document.createElement('style');
reAiStyle.textContent='.re-ai-draft{max-width:92%;margin:12px 10px 16px auto;padding:14px 15px;background:#ecf5ef;border:2px solid #82b59c;border-radius:13px;color:#254d3d;box-sizing:border-box;font-size:12px;line-height:1.6}.re-ai-draft strong{display:block;font-size:11px;padding-bottom:8px;margin-bottom:9px;border-bottom:1px solid #c7dcd0}.re-ai-draft p{margin:0 0 9px;white-space:pre-wrap}.re-ai-draft textarea{box-sizing:border-box;width:100%;min-height:110px;padding:9px;border:1px solid #91b6a1;border-radius:7px;font:inherit;resize:vertical}.re-ai-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:9px}.re-ai-actions button{background:#fff;border:1px solid #a7c8b5;border-radius:7px;padding:7px 12px;font-weight:700;color:#275443;cursor:pointer}.re-ai-actions button[data-re-ai-action=post],.re-ai-actions button[data-re-ai-action=confirm]{background:#168354;border-color:#168354;color:white}.re-ai-actions button[data-re-ai-action=delete]{border-color:#d9a1a1;color:#a34545}.re-ai-actions button:disabled{opacity:.5;cursor:default}.re-ai-notice{font-size:11px;color:#476757;margin-top:6px}';
document.head.appendChild(reAiStyle);
async function showRecord(record){
await releaseLock();
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
const history=historyMarkup(events);
detail.innerHTML='<div class="re-journey-header"><div><small>PARENT JOURNEY</small><h2>'+e(name)+'</h2><p>'+e(branch)+' · Facebook: '+e(name)+'</p></div><div class="re-header-controls"><span id="reLockStatus" class="re-header-lock" role="status">Checking control…</span><button class="secondary-button" type="button" data-re-back>← Back</button></div></div><div class="re-journey-content"><section class="re-journey-actions"><div class="re-status-strip"><span><small>JOURNEY STAGE</small>Re-engagement</span><span><small>CURRENT STATUS</small>'+e(classify(record)==='due'?'Follow-up Due':classify(record)==='awaiting'?'Awaiting Parent Reply':'Scheduled')+'</span><span><small>NEXT STEP</small>'+e(classify(record)==='awaiting'?'Wait for Parent':'Message Parent')+'</span></div><div class="re-action-card"><small>NEXT STEP</small><h3>Follow-up with Parent</h3><p>'+e(classify(record)==='scheduled'?'Follow-up scheduled for '+date(record.next_action_at):classify(record)==='awaiting'?'Follow-up already sent. Waiting for a reply.':'Follow-up due '+date(record.next_action_at))+'</p><label class="re-followup-label" for="reFollowupNote">MESSAGE SENT / FOLLOW-UP NOTES</label><textarea id="reFollowupNote" class="re-followup-note" placeholder="Enter the follow-up message sent to the parent…" required></textarea><p id="reSendStatus" class="re-send-status" role="status"></p></div><form id="reEnrollForm" class="re-stage1b-enroll-form" hidden><label for="reEnrollNote">ENROLLMENT NOTE</label><textarea id="reEnrollNote" rows="2" placeholder="Optional enrollment details"></textarea><div class="re-stage1b-enroll-actions"><button type="button" data-re-enroll-cancel>Back</button><button type="submit">Confirm Enrolled</button></div><p id="reEnrollStatus" role="status"></p></form><div class="re-action-dock"><button type="button" data-re-reactivate disabled>Reactivate</button><button type="button" data-re-send-shortcut>Sent To Parent</button><button type="button" data-re-enroll disabled>Enroll</button></div></section><section class="re-journey-middle"><div class="re-view-tabs"><button class="selected" type="button" data-re-view="conversation">Conversation</button><button type="button" data-re-view="history">History</button></div><div class="re-view-body" id="reConversation"><div class="reengagement-empty">Loading conversation…</div></div><div class="re-view-body" id="reHistory" hidden>'+ (history||'<div class="reengagement-empty">No journey history.</div>')+'</div><form id="reSendForm" class="re-send-form"><label for="reMessageText">REPLY TO PARENT</label><textarea id="reMessageText" placeholder="Write your reply…" required></textarea><button type="submit">Send Message to Parent</button></form></section><aside class="re-journey-assistance"><div class="re-assist-head"><small>THE LITTLE NEST</small><h3>Reply Assistance</h3><p>Prepared responses · Admin reviewed</p></div><div class="re-assist-body"><h4>Suggested reply</h4><div class="re-assist-placeholder">Luna–Terra suggestions appear in the Conversation panel as unsent drafts.<p>An admin reviews and sends every reply.</p></div><h4>Conversation context</h4><p>Known parent details and relevant questions will appear here after conversation analysis is connected.</p><h4>School information</h4><p>Verified branch details and response guidance will be shown here when applicable.</p></div></aside></div>';
const back=detail.querySelector('[data-re-back]'),send=detail.querySelector('#reSendForm');
if(classify(record)==='awaiting')detail.querySelector('[data-re-send-shortcut]').hidden=true;
detail.dataset.journeyId=String(id);
const aiConversation=detail.querySelector('#reConversation');
let aiState={turnId:0,text:'',editing:false,posting:false,busy:false,notice:''};
const hiddenAiTurns=new Set();
const currentAiAttention=()=>window.adsReplyAttentionByJourney?.get(id)||null;
function aiIsCurrent(item){return item&&Number(item.unanswered_count)>0&&!item.ai_discarded&&Number(item.ai_turn_id)>0&&Number(item.ai_trigger_message_id)===Number(item.last_parent_message_id)&&item.ai_processing_status==='completed'&&String(item.suggested_reply||'').trim()&&!hiddenAiTurns.has(Number(item.ai_turn_id));}
function showAiDraft(){
if(!aiConversation.isConnected||Number(detail.dataset.journeyId)!==id)return;
aiConversation.querySelector('.re-ai-draft')?.remove();
const item=currentAiAttention();if(!item||Number(item.unanswered_count)<1)return;
const active=aiIsCurrent(item),turnId=Number(item.ai_turn_id)||0;
if(active&&aiState.turnId!==turnId)aiState={turnId,text:String(item.suggested_reply).trim(),editing:false,posting:false,busy:false,notice:''};
const bubble=document.createElement('div');bubble.className='re-ai-draft';
const title=document.createElement('strong');title.textContent=active?'✦ Luna–Terra Suggested Reply · NOT SENT':item.ai_discarded?'AI suggestion deleted · Parent still needs a reply':'Luna–Terra · Preparing updated suggestion…';bubble.appendChild(title);
if(active){
if(aiState.editing){const edit=document.createElement('textarea');edit.className='re-ai-editor';edit.value=aiState.text;bubble.appendChild(edit);}
else{const text=document.createElement('p');text.textContent=aiState.text;bubble.appendChild(text);}
const actions=document.createElement('div');actions.className='re-ai-actions';
const labels=aiState.posting?[['confirm','Confirm Sent'],['cancel','Cancel']]:[['edit',aiState.editing?'Done Editing':'Edit'],['delete','Delete'],['post','Post']];
labels.forEach(([key,label])=>{const control=document.createElement('button');control.type='button';control.dataset.reAiAction=key;control.textContent=label;control.disabled=aiState.busy||!lockOwned||lockId!==id;actions.appendChild(control);});
bubble.appendChild(actions);
}
if(aiState.notice){const notice=document.createElement('div');notice.className='re-ai-notice';notice.textContent=aiState.notice;bubble.appendChild(notice);}
aiConversation.appendChild(bubble);
}
let observedParentMessageId=Number(currentAiAttention()?.last_parent_message_id)||0;
updateOpenStage1BAi=()=>{const nextId=Number(currentAiAttention()?.last_parent_message_id)||0;if(nextId&&nextId!==observedParentMessageId){observedParentMessageId=nextId;void loadConversation();}else showAiDraft();};
aiConversation.addEventListener('input',event=>{if(event.target.matches('.re-ai-editor'))aiState.text=event.target.value;});
aiConversation.addEventListener('click',async event=>{
const control=event.target.closest('button[data-re-ai-action]');if(!control)return;
const action=control.dataset.reAiAction,item=currentAiAttention(),turnId=Number(item?.ai_turn_id)||0;
if(!aiIsCurrent(item)||aiState.turnId!==turnId||aiState.busy)return;
if(!lockOwned||lockId!==id){aiState.notice='Take Control before changing this suggestion.';showAiDraft();return;}
if(action==='edit'){aiState.editing=!aiState.editing;aiState.notice='';showAiDraft();return;}
if(action==='cancel'){aiState.posting=false;aiState.notice='';showAiDraft();return;}
if(action==='post'){
if(!aiState.text.trim()){aiState.notice='Write a reply before posting.';showAiDraft();return;}
try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable.');await navigator.clipboard.writeText(aiState.text.trim());aiState.posting=true;aiState.editing=false;aiState.notice='Copied. Send through Messenger, then click Confirm Sent.';}
catch(error){aiState.notice=error.message||'Unable to copy.';}
showAiDraft();return;
}
if(action==='delete'&&!window.confirm('Delete this AI suggestion? The parent will still need a reply.'))return;
aiState.busy=true;showAiDraft();
try{
if(action==='delete'){
const res=await fetch('https://x58r-xped-p4y6.n7e.xano.io/api:KLjFk2LI/ai_reply_discard',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({ad_journey_id:id,ai_turn_id:turnId})});
const data=await res.json().catch(()=>({}));
if(!res.ok||data.ai_discarded!==true)throw Error(data.message||data.error||'Could not delete suggestion.');
hiddenAiTurns.add(turnId);aiState={turnId:0,text:'',editing:false,posting:false,busy:false,notice:''};window.dispatchEvent(new Event('ads-reply-attention-refresh-request'));showAiDraft();return;
}
if(action==='confirm'){
const verification=await fetch(API+'/ai_reply_attention',{cache:'no-store',headers:auth});
if(!verification.ok)throw Error('Could not verify the latest parent message.');
const list=await verification.json(),latest=(Array.isArray(list.replies)?list.replies:[]).find(x=>Number(x.ad_journey_id)===id);
if(!aiIsCurrent(latest)||Number(latest.ai_turn_id)!==turnId||Number(latest.last_parent_message_id)!==Number(item.last_parent_message_id))throw Error('The parent conversation changed. Review the updated suggestion.');
const response=await fetch(API+'/ad_reply_record_sent',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({ad_journey_id:id,ad_inquiry_id:Number(journey.ad_inquiry_id||record.ad_inquiry_id),response_text:aiState.text.trim(),question_id:0,language:'english',reply_source:'admin_composed'})});
const data=await response.json().catch(()=>({}));
if(!response.ok||!data.message?.id)throw Error(typeof data.message==='string'?data.message:(data.error||'Unable to record confirmed reply.'));
hiddenAiTurns.add(turnId);aiState={turnId:0,text:'',editing:false,posting:false,busy:false,notice:''};window.dispatchEvent(new Event('ads-reply-attention-refresh-request'));await loadConversation();return;
}
}catch(error){aiState.busy=false;aiState.notice=String(error.message||'Unable to complete action');showAiDraft();}
});
await takeLock(id);
detail.querySelector('[data-re-enroll]').addEventListener('click',()=>{if(!lockOwned||lockId!==id)return;const form=detail.querySelector('#reEnrollForm');form.hidden=false;detail.querySelector('#reEnrollStatus').textContent='';form.querySelector('textarea')?.focus();});
detail.querySelector('[data-re-enroll-cancel]').addEventListener('click',()=>{const form=detail.querySelector('#reEnrollForm');form.hidden=true;form.reset();detail.querySelector('#reEnrollStatus').textContent='';});
detail.querySelector('#reEnrollForm').addEventListener('submit',async ev=>{
ev.preventDefault();const form=ev.currentTarget,status=detail.querySelector('#reEnrollStatus'),submit=form.querySelector('[type=submit]'),enroll=detail.querySelector('[data-re-enroll]'),reactivate=detail.querySelector('[data-re-reactivate]'),sent=detail.querySelector('[data-re-send-shortcut]');
if(!lockOwned||lockId!==id){status.textContent='Take control before confirming enrollment.';return;}
if(!window.confirm('Confirm '+name+' has enrolled and move this journey to Stage 5?'))return;
const note=form.querySelector('textarea').value.trim()||'Enrollment reported from Stage 1B re-engagement.';
submit.disabled=true;enroll.disabled=true;if(reactivate)reactivate.disabled=true;if(sent)sent.disabled=true;status.textContent='Recording enrollment…';let reactivated=false;
try{
const res=await fetch(API+'/ad_journey_reactivate_closed',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({journey_id:id,note:'Parent enrolled while in Stage 1B; returning to active conversation for enrollment.'})});
const first=await res.json().catch(()=>({}));
if(!res.ok||first.error||first.code||String(first.ad_journey?.current_stage)!=='inquiry_follow_up')throw Error(first.message||first.error||'Could not prepare this journey for enrollment.');
reactivated=true;
const enrolledRes=await fetch(API+'/ad_journey_enrolled_stage1',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({journey_id:id,note})});
const enrolledData=await enrolledRes.json().catch(()=>({}));
if(!enrolledRes.ok||enrolledData.error||enrolledData.code||enrolledData.success===false)throw Error(enrolledData.message||enrolledData.error||'Enrollment could not be recorded.');
status.textContent='Enrollment recorded in Stage 5.';
await releaseLock();
if(typeof closeDashboardModals==='function')closeDashboardModals();else{modal.hidden=true;document.getElementById('dashboardModalBackdrop').hidden=true;}
modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;
if(typeof loadBoard==='function')await loadBoard();await refresh();
}catch(error){status.textContent=(reactivated?'Journey moved to Stage 1A, but enrollment was not recorded. Open Stage 1A and use Enroll. ':'')+(error.message||'Unable to enroll.');if(reactivated){await releaseLock();if(typeof loadBoard==='function')await loadBoard();await refresh();}else{submit.disabled=!lockOwned;enroll.disabled=!lockOwned;if(reactivate)reactivate.disabled=!lockOwned;if(sent)sent.disabled=!lockOwned;}}
});
detail.querySelector('[data-re-reactivate]').addEventListener('click',async()=>{
const btn=detail.querySelector('[data-re-reactivate]'),sent=detail.querySelector('[data-re-send-shortcut]'),status=detail.querySelector('#reSendStatus');
if(!lockOwned||lockId!==id){status.textContent='Take Control before reactivating this journey.';return;}
if(!window.confirm('Reactivate '+name+' and move this journey to Stage 1A — Continue Conversation?'))return;
btn.disabled=true;if(sent)sent.disabled=true;btn.textContent='Reactivating…';status.textContent='Moving journey to Stage 1A…';
try{
const res=await fetch(API+'/ad_journey_reactivate_closed',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({journey_id:id,note:'Reactivated from Stage 1B to Stage 1A — Continue Conversation.'})});
const result=await res.json().catch(()=>({}));
if(!res.ok||result.error||result.code||!result.ad_journey)throw Error(result.message||result.error||'Unable to reactivate the journey.');
if(String(result.ad_journey.current_stage)!=='inquiry_follow_up')throw Error('Xano did not return Stage 1A. Check the reactivation endpoint before trying again.');
await releaseLock();
if(typeof closeDashboardModals==='function')closeDashboardModals();else{modal.hidden=true;document.getElementById('dashboardModalBackdrop').hidden=true;}
modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;
if(typeof loadBoard==='function')await loadBoard();
await refresh();
const card=document.querySelector('.journey-column[data-stage="inquiry-followup"] .journey-card[data-journey-id="'+CSS.escape(String(id))+'"]');
if(card){card.click();return;}
alert('Journey reactivated to Stage 1A, but its card is not visible on the board yet. Please refresh Ads Journey.');
}catch(error){status.textContent=error.message||'Unable to reactivate this journey.';btn.disabled=!lockOwned;btn.textContent='Reactivate';if(sent)sent.disabled=!lockOwned;}
});
detail.querySelector('[data-re-send-shortcut]').addEventListener('click',async()=>{
const note=detail.querySelector('#reFollowupNote').value.trim(),status=detail.querySelector('#reSendStatus'),btn=detail.querySelector('[data-re-send-shortcut]');
if(!note){status.textContent='Enter the message or follow-up notes first.';detail.querySelector('#reFollowupNote').focus();return;}
if(!lockOwned||lockId!==id){status.textContent='Record is locked — you cannot confirm this follow-up.';return;}
if(!await confirmFollowupSent(name))return;
btn.disabled=true;status.textContent='Recording confirmed follow-up…';
try{
const res=await fetch(API+'/ad_journey_stage1b_followup_sent',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({journey_id:id,note})});
const result=await res.json().catch(()=>({}));if(!res.ok||result.success===false||result.error||result.code)throw Error(result.message||result.error||'Unable to record the follow-up.');
status.textContent='Follow-up recorded as sent.';detail.querySelector('#reFollowupNote').value='';
justSent.add(id);records=records.map(row=>Number(row.id)===id?{...row,current_status:'follow_up_sent'}:row);
let historyWarning='';
try{const logged=await refreshHistoryAfterSend(id,auth,events.length);if(!logged)historyWarning='Follow-up saved, but the new History event could not be confirmed. Check Xano event logging.';}
catch(_error){historyWarning='Follow-up saved. History could not be reloaded; you can check it through Journey Search.';}
await releaseLock();modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;positionQueue();renderList();showQueueNotice(historyWarning);
await refresh();if(typeof loadBoard==='function')loadBoard();
}catch(error){status.textContent=error.message;}finally{btn.disabled=!lockOwned;}
});
back.addEventListener('click',async()=>{await releaseLock();modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;positionQueue();refresh();});
detail.querySelectorAll('[data-re-view]').forEach(tab=>tab.addEventListener('click',()=>{detail.querySelectorAll('[data-re-view]').forEach(t=>t.classList.toggle('selected',t===tab));detail.querySelector('#reConversation').hidden=tab.dataset.reView!=='conversation';detail.querySelector('#reHistory').hidden=tab.dataset.reView!=='history';}));
async function loadConversation(){
const target=detail.querySelector('#reConversation'),inquiryId=Number(journey.ad_inquiry_id||record.ad_inquiry_id);
if(!inquiryId){target.innerHTML='<div class="reengagement-empty">No inquiry linked.</div>';return;}
try{const res=await fetch(API+'/ad_messenger_conversation?ad_inquiry_id='+inquiryId,{headers:auth});if(!res.ok)throw Error('Conversation unavailable');
const json=await res.json(),raw=Array.isArray(json.messages)?json.messages:(json.messages?.items||json.messages?.records||[]);
target.innerHTML=raw.length?raw.slice().sort((a,b)=>Number(a.message_timestamp||a.created_at)-Number(b.message_timestamp||b.created_at)).map(m=>'<div class="re-message '+(m.direction==='outbound'||m.direction==='outgoing'?'outgoing':'incoming')+'"><div>'+e(m.message_text||'')+'<small>'+e(date(m.message_timestamp||m.created_at))+'</small></div></div>').join(''):'<div class="reengagement-empty">No Messenger messages recorded for this inquiry yet.</div>';showAiDraft();target.scrollTop=target.scrollHeight;
}catch(error){target.innerHTML='<div class="reengagement-empty">'+e(error.message)+'</div>';}
}
await loadConversation();
send.addEventListener('submit',async ev=>{
ev.preventDefault();const text=detail.querySelector('#reMessageText').value.trim(),status=detail.querySelector('#reSendStatus'),submit=send.querySelector('[type=submit]');
if(!text)return;
if(!lockOwned||lockId!==id){status.textContent='Record is locked — you cannot send.';return;}
if(!window.confirm('Send this message to the parent on Messenger?'))return;
submit.disabled=true;status.textContent='Sending message…';
try{
const res=await fetch(API+'/ad_messenger_send',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({journey_id:id,message_text:text})});
const result=await res.json().catch(()=>({}));if(!res.ok||result.success===false||result.error||result.code)throw Error(result.message||result.error||'Message could not be sent');
status.textContent='Message sent.';send.reset();
await loadConversation();await refresh();if(typeof loadBoard==='function')loadBoard();
}catch(error){status.textContent=error.message||'Could not send message.';}finally{submit.disabled=false;}
});
}catch(error){detail.innerHTML='<div class="reengagement-empty">'+e(error.message)+'</div><button type="button" id="reBackFallback">← Back</button>';detail.querySelector('#reBackFallback').addEventListener('click',async()=>{await releaseLock();modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;positionQueue();renderList();});}
}
document.addEventListener('click',event=>{if(event.target.closest('#franchiseCheckboxList')||event.target.closest('#selectAllFranchises')||event.target.closest('#clearAllFranchises'))setTimeout(refresh,450);});
/*   Clear this queue when the normal Parent Journey workspace opens*/
function dismissForOtherJourney(){
if(modal.hidden)return;
releaseLock();
modal.hidden=true;modal.style.display='none';modal.classList.remove('re-detail-mode');queue.hidden=false;detail.hidden=true;
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
document.querySelector('#reengagementModal .modal-close')?.addEventListener('click',()=>releaseLock());
document.addEventListener('visibilitychange',()=>{if(document.hidden){++lockSeq;stopRenewal();lockOwned=false;lockId=0;if(!detail.hidden)lockUI('Control must be checked when you return');}else if(!modal.hidden&&!detail.hidden){const id=Number(detail.dataset.journeyId);if(id)takeLock(id);}});
window.addEventListener('journey-sync-refresh',refresh);
badge.hidden=false;
/*   The dashboard restores its franchise selection asynchronously. Load the count once it is ready, without opening the queue. */
let countSelectionKey='';
function refreshCountForSelection(){
  const ids=selected().map(Number).sort((a,b)=>a-b),key=ids.join(',');
  if(!key||key===countSelectionKey)return;
  countSelectionKey=key;refresh();
}
refreshCountForSelection();
const countReadyPoll=setInterval(refreshCountForSelection,1000);
window.addEventListener('pageshow',refreshCountForSelection);
})();