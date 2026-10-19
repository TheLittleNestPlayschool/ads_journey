/*   Stage 2: parent confirmation attention, including older franchise handoffs*/
(()=>{'use strict';
const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT',token=localStorage.getItem('ads_journey_token');if(!token)return;
const column=document.querySelector('.journey-column[data-stage="scheduled"]');if(!column)return;
const controls=column.querySelector('.column-header-actions')||column.querySelector('header');
const button=document.createElement('button');button.className='stage2-confirmation-count';button.type='button';button.title='Parent confirmations pending';button.hidden=true;controls.prepend(button);
let pending=new Set(),failure=false,busy=false,rerun=false,refreshTimer=null;const checked=new Map();
const headers={Authorization:'Bearer '+token};
function selection(){try{const ids=JSON.parse(localStorage.getItem('ads_journey_franchise_filter')||'null');return Array.isArray(ids)?new Set(ids.map(Number)):null;}catch(_){return null;}}
function paint(){
document.querySelectorAll('.journey-card.stage2-confirmation-pending').forEach(card=>{card.classList.remove('stage2-confirmation-pending');card.removeAttribute('data-confirmation-label');const badge=card.querySelector('.priority');if(badge&&badge.dataset.originalLabel!==undefined){badge.textContent=badge.dataset.originalLabel;delete badge.dataset.originalLabel;}const next=card.querySelector('.card-next span');if(next&&next.dataset.originalLabel!==undefined){next.textContent=next.dataset.originalLabel;delete next.dataset.originalLabel;}});
pending.forEach(id=>{const card=column.querySelector('.journey-card[data-journey-id="'+id+'"]');if(card){card.classList.add('stage2-confirmation-pending');card.dataset.confirmationLabel='★ Confirm parent';const badge=card.querySelector('.priority');if(badge){if(badge.dataset.originalLabel===undefined)badge.dataset.originalLabel=badge.textContent;badge.textContent='Confirm Parent';}const next=card.querySelector('.card-next span');if(next){if(next.dataset.originalLabel===undefined)next.dataset.originalLabel=next.textContent;next.textContent='Confirm Parent';}}});
button.hidden=false;button.textContent=failure?'★ !':'★ '+pending.size;
}
async function verifyAlreadyNotified(id){
const old=checked.get(id);if(old&&Date.now()-old.checkedAt<30000)return old;
try{
const d=await fetch(API+'/ad_journey_detail?journey_id='+id,{headers,cache:'no-store'});if(!d.ok)throw Error('Detail unavailable');
const data=await d.json(),events=Array.isArray(data.ad_journey_events)?[...data.ad_journey_events]:[];
events.sort((a,b)=>(Number(b.event_at)||Number(b.created_at)||0)-(Number(a.event_at)||Number(a.created_at)||0));
const latest=events.find(ev=>['rescheduled','trial_scheduled','visit_scheduled'].includes(ev.event_type));
const first=events.find(ev=>['trial_scheduled','visit_scheduled'].includes(ev.event_type));
const scheduledFor=Number(latest?.scheduled_for)||Number(first?.scheduled_for)||0;
if(!scheduledFor)throw Error('Appointment schedule unavailable');
const res=await fetch(API+'/ad_parent_confirmation_status?ad_journey_id='+id,{headers,cache:'no-store'});if(!res.ok)throw Error('Confirmation status unavailable');
const state=await res.json();if(typeof state.confirmed!=='boolean')throw Error('Invalid confirmation status');
const result={id,confirmed:Boolean(state.confirmed)&&Number(state.scheduled_at)===scheduledFor,checkedAt:Date.now(),unknown:false};
checked.set(id,result);return result;
}catch(_){return old?{...old,unknown:true}:{id,confirmed:false,unknown:true};}
}
async function refresh(){
if(busy){rerun=true;return;}busy=true;
try{
let next=new Set(pending),unavailable=false;
try{
const r=await fetch(API+'/ad_parent_confirmation_pending',{headers,cache:'no-store'});if(!r.ok)throw Error('Unavailable');
const data=await r.json();if(!Array.isArray(data.items))throw Error('Invalid');
const selected=selection();next=new Set(data.items.filter(row=>!selected||selected.has(Number(row.franchise_id))).map(row=>Number(row.ad_journey_id)).filter(id=>Number.isSafeInteger(id)&&id>0));
}catch(_){unavailable=true;}
/*   Older journeys can be sent to the franchise without a recorded parent confirmation.
     Verify those against the appointment-specific Xano confirmation status. */
const cards=[...column.querySelectorAll('.journey-card[data-status="sent_to_franchise"]')];
for(let offset=0;offset<cards.length;offset+=4){
const batch=cards.slice(offset,offset+4);
const results=await Promise.all(batch.map(card=>verifyAlreadyNotified(Number(card.dataset.journeyId))));
results.forEach(result=>{if(result.unknown){unavailable=true;return;}if(result.confirmed)next.delete(result.id);else next.add(result.id);});
}
pending=next;failure=unavailable;
}finally{busy=false;paint();if(rerun){rerun=false;queueRefresh();}}
}
function queueRefresh(){if(refreshTimer!==null)clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{refreshTimer=null;refresh();},200);}
button.addEventListener('click',()=>{const id=[...pending][0];if(id)column.querySelector('.journey-card[data-journey-id="'+id+'"]')?.click();});
window.addEventListener('journey-card-added',()=>{queueMicrotask(paint);queueRefresh();});
window.addEventListener('journey-sync-refresh',queueRefresh);
window.addEventListener('ads-journey-franchise-filter-changed',queueRefresh);
window.addEventListener('parent-confirmation-recorded',()=>{checked.clear();queueRefresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueRefresh();});
refresh();setInterval(queueRefresh,20000);
})();