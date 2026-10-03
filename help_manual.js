(function(){
const sections=[
{id:'about',number:'01',title:'About Ads Journey',summary:'What Ads Journey is for and what the admin is responsible for.',keywords:'purpose admin responsibility system',intro:'Ads Journey is the working system for managing parent inquiries from first contact through enrollment. This section will define the purpose of the app, the admin’s role, and what should always be kept accurate.'},
{id:'journey-at-a-glance',number:'02',title:'The Journey at a Glance',summary:'How an inquiry moves from first contact to enrollment.',keywords:'stages flow inquiry enrollment overview',intro:'This section will explain the complete journey in simple terms, showing how a parent moves through each stage and why the stages exist.'},
{id:'main-dashboard',number:'03',title:'Main Dashboard',summary:'Counters, working queue, journey cards, and board sorting.',keywords:'dashboard counters board cards sorting working queue',intro:'This section will explain what you see on the main screen, what the counters mean, how the stage columns work, and how records are ordered inside each stage.'},
{id:'stage-1',number:'04',title:'Stage 1 — Inquiry',summary:'New inquiries and the first decisions an admin makes.',keywords:'stage 1 inquiry free trial visit continue conversation enroll no longer interested',intro:'This section will define what belongs in Stage 1 and how to decide whether to schedule a visit or trial, continue the conversation, enroll directly, or close the journey.'},
{id:'stage-1a',number:'05',title:'Stage 1A — Continue Conversation',summary:'Active parent conversations that have not reached a scheduled outcome yet.',keywords:'stage 1a continue conversation active conversation message reply',intro:'This section will explain when a conversation is active enough to belong in Stage 1A, how to keep it moving, and when it should progress to another stage.'},
{id:'stage-2',number:'06',title:'Stage 2 — Scheduled',summary:'Visits, free trials, franchise handoff, rescheduling, and cancellations.',keywords:'stage 2 scheduled visit free trial franchise reschedule cancel',intro:'This section will explain what happens after a visit or free trial is scheduled, including sending details to the franchise and managing changes to the appointment.'},
{id:'stage-3',number:'07',title:'Stage 3 — Awaiting Outcome',summary:'Getting the result after a scheduled visit or free trial.',keywords:'stage 3 awaiting outcome franchise result trial visit',intro:'This section will explain when a journey moves into Awaiting Outcome and how to record what the franchise reports after the appointment.'},
{id:'stage-4',number:'08',title:'Stage 4 — Follow-up / Decision',summary:'Parent follow-up after the appointment or another decision point.',keywords:'stage 4 follow-up decision interested no show cancelled follow up later',intro:'This section will explain the different outcomes that lead to follow-up, when to schedule another contact, and when a journey should move forward or close.'},
{id:'stage-5',number:'09',title:'Stage 5 — Enrollment',summary:'Recording enrollment and correcting an enrollment when necessary.',keywords:'stage 5 enrollment enrolled undo enrollment',intro:'This section will explain what qualifies as an enrollment, what the final stage means, and when Undo Enrollment should be used.'},
{id:'reading-a-journey',number:'10',title:'Opening and Reading a Journey',summary:'Parent information, stage, status, next step, notes, and timeline.',keywords:'open journey timeline notes status next step parent information',intro:'This section will explain how to read the journey window so you can quickly understand what has happened, what is happening now, and what should happen next.'},
{id:'search',number:'11',title:'Search',summary:'Finding active, closed, enrolled, dormant, and older journeys.',keywords:'search find closed dormant enrolled reactivate old records',intro:'This section will explain how to find journeys that are not currently visible on the working board and what to do when an older conversation becomes active again.'},
{id:'franchise-filter',number:'12',title:'Franchise Filter',summary:'Choosing which locations you are currently viewing.',keywords:'franchise filter locations branches select all',intro:'This section will explain how the franchise filter changes the records shown on the dashboard and how to work with one or many locations.'},
{id:'maintenance',number:'13',title:'Maintenance',summary:'Batch Import, Admin Activity, Location Performance, and Marketing Performance.',keywords:'maintenance batch import admin activity location performance marketing performance',intro:'This section will explain the tools kept under Maintenance and when each one should be used.'},
{id:'common-situations',number:'14',title:'How to Handle Common Situations',summary:'Practical examples for situations admins encounter every day.',keywords:'slow reply direct enrollment changed mind missed trial cancellation duplicate returning parent',intro:'This section will cover common real-world situations such as slow replies, direct enrollment, missed trials, cancellations, duplicate inquiries, and old conversations returning.'},
{id:'rules-good-practices',number:'15',title:'Journey Rules and Good Practices',summary:'The operating rules that keep the Journey accurate and useful.',keywords:'rules best practices notes accuracy duplicate close slow reply',intro:'This section will define the habits that keep the system trustworthy, including keeping the stage aligned with reality and recording useful notes.'},
{id:'status-reference',number:'16',title:'Status and Action Reference',summary:'Plain-language meanings for statuses and next actions.',keywords:'status action reference new inquiry ready to send awaiting outcome follow-up due no longer interested',intro:'This section will provide a quick reference for the status and action labels used throughout Ads Journey.'},
{id:'troubleshooting',number:'17',title:'Troubleshooting / What If Something Is Wrong?',summary:'How to correct common mistakes without losing the journey history.',keywords:'troubleshooting wrong stage wrong appointment duplicate missing record accidental enrollment',intro:'This section will explain how to correct common problems such as a wrong stage, wrong appointment, accidental enrollment, duplicate journey, or missing record.'}
];
let currentId='about';
function q(id){return document.getElementById(id);}
function renderToc(filter=''){
  const toc=q('helpManualToc');if(!toc)return;
  const term=filter.trim().toLowerCase();
  const visible=sections.filter(s=>!term||[`${s.title} ${s.summary} ${s.keywords} ${s.intro}`.toLowerCase()].some(v=>v.includes(term)));
  if(!visible.length){toc.innerHTML='<div class="help-manual-empty">No manual sections match that search.</div>';return;}
  toc.innerHTML='';
  visible.forEach(section=>{const button=document.createElement('button');button.type='button';button.className='help-manual-link'+(section.id===currentId?' active':'');button.dataset.manualId=section.id;button.innerHTML=`<span>Section ${section.number}</span>${section.title}`;button.addEventListener('click',()=>selectSection(section.id));toc.appendChild(button);});
}
function renderPage(section){
  const page=q('helpManualPage');if(!page)return;
  page.innerHTML=`<div class="help-manual-page"><p class="section-kicker">Section ${section.number}</p><h2>${section.title}</h2><p class="manual-summary">${section.summary}</p><h3>What this section will cover</h3><p>${section.intro}</p><div class="help-manual-note">We are building the manual section by section. This page is now wired into the manual structure and will hold the finalized instructions for this topic.</div></div>`;
}
function selectSection(id){
  const section=sections.find(s=>s.id===id)||sections[0];currentId=section.id;renderPage(section);renderToc(q('helpManualSearch')?.value||'');q('helpManualPage')?.scrollTo({top:0,behavior:'smooth'});
}
function init(){
  const search=q('helpManualSearch');if(!search)return;
  if(search.dataset.ready==='1')return;
  search.dataset.ready='1';search.addEventListener('input',()=>renderToc(search.value));renderToc();renderPage(sections[0]);
}
window.openHelpManualTopic=function(id){const button=q('helpButton');if(button)button.click();setTimeout(()=>{init();selectSection(id);},0);};
window.getHelpManualTopic=function(id){return sections.find(s=>s.id===id)||null;};
window.addEventListener('click',event=>{if(event.target.closest('#helpButton'))setTimeout(init,0);});
init();
})();