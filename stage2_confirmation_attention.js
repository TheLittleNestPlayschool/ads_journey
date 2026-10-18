/*   Stage 2: shared parent confirmation count and card indicators */
(()=>{'use strict';
const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT',token=localStorage.getItem('ads_journey_token');if(!token)return;
const column=document.querySelector('.journey-column[data-stage="scheduled"]');if(!column)return;
const controls=column.querySelector('.column-header-actions')||column.querySelector('header');
const button=document.createElement('button');button.className='stage2-confirmation-count';button.type='button';button.title='Parent confirmations pending';button.hidden=true;controls.prepend(button);
let pending=new Set(),failure=false,busy=false;
function selection(){try{const ids=JSON.parse(localStorage.getItem('ads_journey_franchise_filter')||'null');return Array.isArray(ids)?new Set(ids.map(Number)):null;}catch(_){return null;}}
function paint(){document.querySelectorAll('.journey-card.stage2-confirmation-pending').forEach(card=>{card.classList.remove('stage2-confirmation-pending');card.removeAttribute('data-confirmation-label');});pending.forEach(id=>{const card=column.querySelector('.journey-card[data-journey-id="'+id+'"]');if(card){card.classList.add('stage2-confirmation-pending');card.dataset.confirmationLabel='★ Confirm parent';}});button.hidden=false;button.textContent=failure?'★ !':'★ '+pending.size;}
async function refresh(){if(busy||document.hidden)return;busy=true;try{const r=await fetch(API+'/ad_parent_confirmation_pending',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!r.ok)throw Error('Unavailable');const data=await r.json();if(!Array.isArray(data.items))throw Error('Invalid');const selected=selection();pending=new Set(data.items.filter(row=>!selected||selected.has(Number(row.franchise_id))).map(row=>Number(row.ad_journey_id)).filter(id=>Number.isSafeInteger(id)&&id>0));failure=false;}catch(_){failure=true;pending.clear();}finally{busy=false;paint();}}
button.addEventListener('click',()=>{const id=[...pending][0];if(id)column.querySelector('.journey-card[data-journey-id="'+id+'"]')?.click();});
window.addEventListener('journey-card-added',()=>queueMicrotask(paint));window.addEventListener('journey-sync-refresh',refresh);window.addEventListener('ads-journey-franchise-filter-changed',refresh);window.addEventListener('parent-confirmation-recorded',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh();setInterval(refresh,20000);
})();