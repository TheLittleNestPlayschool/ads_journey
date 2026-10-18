/*   Ads Journey: shared form-submission attention queue (no automatic journey opening)*/
(()=>{'use strict';
const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT',auth=localStorage.getItem('ads_journey_token');
if(!auth)return;
const topbar=document.querySelector('.topbar-actions');if(!topbar)return;
const btn=document.createElement('button');btn.id='parentFormAttentionButton';btn.className='secondary-button form-attention-button';btn.type='button';btn.hidden=true;btn.innerHTML='<span class="form-attention-icon" aria-hidden="true">★</span><span>Needs Attention</span><strong id="parentFormAttentionCount">0</strong>';
topbar.insertBefore(btn,topbar.firstChild);
const overlay=document.createElement('div');overlay.id='parentFormAttentionOverlay';overlay.className='form-attention-overlay';overlay.hidden=true;
overlay.innerHTML='<section class="form-attention-dialog" role="dialog" aria-modal="true" aria-labelledby="parentFormAttentionTitle"><header><div><small>ADS JOURNEY · SHARED ADMIN QUEUE</small><h2 id="parentFormAttentionTitle">Needs Attention</h2><p>Parent forms submitted and awaiting a saved Visit or Free Trial schedule.</p></div><button id="parentFormAttentionClose" type="button" aria-label="Close">×</button></header><div id="parentFormAttentionList" class="form-attention-list"></div><footer>A notification stays until Save Schedule is confirmed in Xano. Opening a parent does not clear it.</footer></section>';
document.body.appendChild(overlay);
const list=overlay.querySelector('#parentFormAttentionList'),counter=btn.querySelector('#parentFormAttentionCount');
let pending=[],loading=false,lastError=false,active=true;
const integer=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:0;};
const timestamp=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:0;};
/*   Queue follows the currently selected franchises on the dashboard */
function selectedFranchises(){try{const ids=JSON.parse(localStorage.getItem('ads_journey_franchise_filter')||'null');return Array.isArray(ids)?new Set(ids.map(integer).filter(Boolean)):null;}catch(_){return null;}}
function prettyDate(t){const n=timestamp(t);if(!n)return 'Date unavailable';return new Date(n).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
function clearStars(){document.querySelectorAll('.journey-card.parent-form-needs-attention').forEach(card=>{card.classList.remove('parent-form-needs-attention');card.removeAttribute('data-parent-form-alert');});}
function renderStars(){
clearStars();
for(const item of pending){
const card=document.querySelector('.journey-card[data-journey-id="'+item.ad_journey_id+'"]');if(!card)continue;
card.classList.add('parent-form-needs-attention');card.dataset.parentFormAlert='★ Parent form received';card.title='Parent information waiting. Save Schedule to clear this notification.';
}
}
function openFromQueue(item){
overlay.hidden=true;
const card=document.querySelector('.journey-card[data-journey-id="'+item.ad_journey_id+'"]');
if(card){card.click();return;}
/*   Existing dashboard flow can select a filtered-out franchise and open its journey */
window.dispatchEvent(new CustomEvent('open-attention-journey',{detail:{journeyId:item.ad_journey_id,franchiseId:integer(item.franchise_id),inquiryId:integer(item.ad_inquiry_id)}}));
}
function renderQueue(){
list.replaceChildren();
if(lastError){const message=document.createElement('p');message.className='form-attention-empty';message.textContent='Unable to refresh the queue. Previously received alerts may be out of date.';list.appendChild(message);return;}
if(!pending.length){const message=document.createElement('p');message.className='form-attention-empty';message.textContent='No parent forms waiting for scheduling.';list.appendChild(message);return;}
pending.forEach(item=>{
const row=document.createElement('button');row.type='button';row.className='form-attention-row';
const left=document.createElement('span');left.className='form-attention-row-info';
const title=document.createElement('strong');title.textContent=item.facebook_name||item.parent_name||('Journey #'+item.ad_journey_id);
const place=document.createElement('small');place.textContent=[item.branch_name,item.schedule_type==='trial'?'Free Trial':'Visit'].filter(Boolean).join(' · ');
const when=document.createElement('small');when.textContent='Received '+prettyDate(item.submitted_at||item.created_at);
left.append(title,place,when);
const action=document.createElement('span');action.className='form-attention-row-action';action.textContent='Open inquiry →';
row.append(left,action);row.addEventListener('click',()=>openFromQueue(item));list.appendChild(row);
});
}
function normalize(data){
const raw=Array.isArray(data.items)?data.items:(Array.isArray(data.pending)?data.pending:[]);
const byJourney=new Map();
const selected=selectedFranchises();
for(const v of raw){
if(selected&&!selected.has(integer(v?.franchise_id)))continue;
const id=integer(v?.ad_journey_id);if(!id||v.status&&v.status!=='awaiting_schedule')continue;
const val={...v,ad_journey_id:id};
if(!byJourney.has(id)||timestamp(val.submitted_at||val.created_at)>timestamp(byJourney.get(id).submitted_at||byJourney.get(id).created_at))byJourney.set(id,val);
}
return [...byJourney.values()].sort((a,b)=>timestamp(a.submitted_at||a.created_at)-timestamp(b.submitted_at||b.created_at));
}
async function refresh(){
if(loading||document.hidden||!active)return;loading=true;
try{
const r=await fetch(API+'/ad_parent_form_pending',{headers:{Authorization:'Bearer '+auth},cache:'no-store'});
if(!r.ok)throw Error('Pending queue unavailable');
const data=await r.json();
if(!data||!Array.isArray(data.items)&&!Array.isArray(data.pending))throw Error('Invalid pending response');
pending=normalize(data);lastError=false;btn.hidden=false;counter.textContent=String(pending.length);
renderStars();if(!overlay.hidden)renderQueue();
}catch(_){lastError=true;btn.hidden=false;counter.textContent='!';if(!overlay.hidden)renderQueue();}
finally{loading=false;}
}
btn.addEventListener('click',()=>{overlay.hidden=false;renderQueue();});
overlay.querySelector('#parentFormAttentionClose').addEventListener('click',()=>overlay.hidden=true);
overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)overlay.hidden=true;});
window.addEventListener('journey-card-added',()=>{if(pending.length)queueMicrotask(renderStars);});
window.addEventListener('journey-sync-refresh',()=>refresh());
window.addEventListener('ads-journey-franchise-filter-changed',()=>refresh());
window.addEventListener('ad-parent-form-scheduled',()=>refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('pagehide',()=>active=false,{once:true});
refresh();
setInterval(refresh,20000);
})();
