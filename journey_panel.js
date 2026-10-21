function initJourneyPanel(){
  const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT';
  const demo={facebookName:'',location:'',franchiseId:null,journeyId:null,stage:'Inquiry',status:'New',next:'Continue conversation'};
  let stage2State=null;let parentConfirmationState=null;
  /*   Keep the recorded confirmation message ID for status-only recovery */
  const confirmationRetryKey=id=>'ads_journey_confirmation_retry_'+id;
  function pendingConfirmationRef(id,scheduledAt){
    try{const ref=JSON.parse(sessionStorage.getItem(confirmationRetryKey(id))||'null');return ref&&Number(ref.journeyId)===Number(id)&&Number(ref.scheduledAt)===Number(scheduledAt)&&Number(ref.messageId)>0&&Date.now()-Number(ref.recordedAt)<7*86400000?ref:null;}catch(_){return null;}
  }
  function rememberConfirmationRef(id,scheduledAt,messageId){try{sessionStorage.setItem(confirmationRetryKey(id),JSON.stringify({journeyId:id,scheduledAt,messageId,recordedAt:Date.now()}));}catch(_){}}
  function clearConfirmationRef(id){try{sessionStorage.removeItem(confirmationRetryKey(id));}catch(_){}}
  async function readConfirmationStatus(id,scheduledAt){
    const response=await window.fetch(API+'/ad_parent_confirmation_status?ad_journey_id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+journeyToken},cache:'no-store'});
    if(!response.ok)throw Error('Unable to verify confirmation status (HTTP '+response.status+').');
    const data=await response.json();
    return Boolean(data.confirmed)&&Number(data.scheduled_at)===Number(scheduledAt);
  }
  async function saveConfirmationReference(id,scheduledAt,messageId){
    const response=await window.fetch(API+'/ad_parent_confirmation_sent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+journeyToken},body:JSON.stringify({ad_journey_id:id,message_id:messageId,scheduled_at:scheduledAt})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.success===false||data.error||data.code){
      const message=typeof data.message==='string'?data.message:(typeof data.error==='string'?data.error:(typeof data.error?.message==='string'?data.error.message:'Confirmation endpoint failed.'));
      throw Error('HTTP '+response.status+': '+message);
    }
  }
  const journeyToken=localStorage.getItem('ads_journey_token');
  /*   shared confirmation and success flow for changes made in the Journey workspace*/
  const JOURNEY_MUTATIONS={
    ad_journey_parent_message:['Continue Conversation','Move this inquiry to Continue Conversation?','Conversation updated'],
    ad_journey_enrolled_stage1:['Confirm Enrollment','Move this parent to Stage 5 — Enrollment?','Enrollment Successful'],
    ad_journey_enrolled_stage4:['Confirm Enrollment','Move this parent to Stage 5 — Enrollment?','Enrollment Successful'],
    ad_journey_schedule:['Confirm Schedule','Save this visit or free trial schedule?','Schedule Saved'],
    ad_journey_franchise_sent:['Confirm Franchise Handoff','Record that the details were sent to the franchise?','Franchise Handoff Saved'],
    ad_journey_result_stage:['Confirm Franchise Result','Save this result and update the parent journey?','Franchise Result Saved'],
    ad_journey_cancel:['Confirm Cancellation','Cancel this appointment?','Appointment Cancelled'],
    ad_journey_reschedule:['Confirm Reschedule','Save the new appointment schedule?','Schedule Updated'],
    ad_journey_follow_up_stage4:['Confirm Follow-up','Save this follow-up and update the journey?','Follow-up Saved'],
    ad_journey_parent_deciding:['Confirm Parent Status','Save the parent’s decision status and next follow-up?','Parent Status Saved'],
    ad_journey_not_interested:['Confirm Closure','Close this journey as No Longer Interested?','Journey Closed'],
    ad_journey_undo_enrollment:['Confirm Undo Enrollment','Undo the enrollment and return the parent to the previous stage?','Enrollment Reverted']
  };
  const changeDialog=document.createElement('div');
  changeDialog.className='journey-change-overlay';
  changeDialog.hidden=true;
  changeDialog.innerHTML='<div class="journey-change-dialog" role="dialog" aria-modal="true" aria-labelledby="journeyChangeTitle" aria-describedby="journeyChangeDescription"><span class="journey-change-kicker">THE LITTLE NEST · ADS JOURNEY</span><h3 id="journeyChangeTitle"></h3><p id="journeyChangeDescription"></p><div class="journey-change-buttons"><button type="button" class="journey-change-cancel">Cancel</button><button type="button" class="journey-change-confirm">Confirm</button></div></div>';
  document.body.appendChild(changeDialog);
  let dialogResolver=null;
  const showChangeDialog=(title,description,success=false)=>new Promise(resolve=>{
    if(dialogResolver){resolve(false);return;}
    dialogResolver=resolve;
    changeDialog.querySelector('#journeyChangeTitle').textContent=title;
    changeDialog.querySelector('#journeyChangeDescription').textContent=description;
    changeDialog.querySelector('.journey-change-cancel').hidden=success;
    const confirmButton=changeDialog.querySelector('.journey-change-confirm');
    confirmButton.textContent=success?'Close':'Confirm';
    changeDialog.classList.toggle('journey-change-success',success);
    changeDialog.hidden=false;confirmButton.focus();
  });
  window.journeyShowChangeSuccess=(title)=>showChangeDialog(title,'The change has been recorded successfully.',true);
  function finishChangeDialog(value){if(!dialogResolver)return;const done=dialogResolver;dialogResolver=null;changeDialog.hidden=true;done(value);}
  changeDialog.querySelector('.journey-change-cancel').addEventListener('click',()=>finishChangeDialog(false));
  changeDialog.querySelector('.journey-change-confirm').addEventListener('click',()=>finishChangeDialog(true));
  changeDialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(!changeDialog.classList.contains('journey-change-success'))finishChangeDialog(false);}});
  /*   Only workflow mutations are acknowledged; reads and ownership lease requests are untouched*/
  const fetch=async (url,options={})=>{
    const response=await window.fetch(url,options);
    const endpoint=String(url).split('?')[0].split('/').pop();
    const action=JOURNEY_MUTATIONS[endpoint];
    if(action&&String(options.method||'GET').toUpperCase()==='POST'&&response.ok){
      const result=await response.clone().json().catch(()=>null);
      if(result?.success!==false&&!result?.code&&!result?.error)await showChangeDialog(action[2],'The change has been recorded successfully.',true);
    }
    return response;
  };
  const host=document.createElement('div');
  host.innerHTML=`<div id="journeyBackdrop" class="journey-backdrop" hidden></div><aside id="journeyPanel" class="journey-panel" aria-hidden="true"><div class="journey-panel-head"><div><p class="section-kicker">Parent Journey</p><h2 id="journeyParentName">Parent</h2><p id="journeyLocation" class="journey-subtitle">Location</p><p id="journeyChildName" class="journey-subtitle" hidden></p></div><div class="journey-panel-head-actions"><button id="journeyQuickGuideButton" class="journey-quick-guide-button" type="button" aria-label="Quick guide" aria-expanded="false">?</button><button id="closeJourneyPanel" class="secondary-button" type="button">← Back</button><section id="journeyQuickGuide" class="journey-quick-guide" hidden><div class="journey-quick-guide-head"><div><p class="section-kicker">Quick Guide</p><h3 id="journeyQuickGuideTitle">Stage 1</h3></div><div class="journey-quick-guide-head-actions"><button id="journeyQuickGuideLanguage" class="journey-quick-guide-language" type="button">Tagalog</button><button id="closeJourneyQuickGuide" class="journey-quick-guide-close" type="button" aria-label="Close quick guide">×</button></div></div><div id="journeyQuickGuideBody"></div></section></div></div><div class="journey-panel-scroll journey-panel-main"><section class="journey-state-grid"><div class="journey-state"><span>Journey Stage</span><strong id="journeyStage">New Inquiry</strong></div><div class="journey-state"><span>Current Status</span><strong id="journeyStatus">New Inquiry</strong></div><div class="journey-state next"><span>Next Step</span><strong id="journeyNextAction">Continue Conversation</strong></div></section><section id="scheduleActionCard" class="journey-action-card"><div class="journey-action-head"><div><p class="section-kicker">Next Step</p><h3>Choose the next step</h3></div><button id="journeyFillSchedule" class="journey-fill-schedule" type="button" title="Enter parent details manually while viewing the conversation">Enter Parent Details</button></div><form id="scheduleForm" class="schedule-form"><div class="visit-type-control"><label><input type="radio" name="visitType" value="trial" checked><span>Free Trial</span></label><label><input type="radio" name="visitType" value="visit"><span>Visit</span></label><label><input type="radio" name="visitType" value="message"><span>Continue Conversation</span></label><label><input type="radio" name="visitType" value="enroll"><span>Enroll</span></label></div><div id="scheduleAppointmentFields"><div class="schedule-grid"><label><span>Parent name</span><input id="scheduleParent" type="text" placeholder="Parent's real name" required></label><label><span>Session interested in</span><select id="scheduleSession" required><option value="0">None</option></select></label><label><span>Date</span><input id="scheduleDate" type="date" required></label><div class="time-field"><span>Time</span><div class="time-selects"><select id="scheduleHour" aria-label="Hour"></select><span class="time-colon">:</span><select id="scheduleMinute" aria-label="Minute"></select><select id="schedulePeriod" aria-label="AM or PM"><option value="AM">AM</option><option value="PM">PM</option></select></div></div><label><span>Child name</span><input id="scheduleChild" type="text" placeholder="Child name" required></label><div class="age-field"><span class="age-label">Age</span><div class="age-inputs"><label><input id="scheduleAgeYears" type="number" min="0" max="12" placeholder="0"><small>Years</small></label><label><input id="scheduleAgeMonths" type="number" min="0" max="11" placeholder="0"><small>Months</small></label></div></div></div><label class="schedule-note"><span>Notes</span><textarea id="scheduleNotes" rows="2" placeholder="Anything the franchise should know"></textarea></label></div><div id="parentMessageFields" hidden><label class="schedule-note"><span>Message note</span><textarea id="parentMessageNote" rows="4" placeholder="Optional note about the message sent"></textarea></label><p class="message-help">The journey will move to Stage 1A as an active conversation.</p></div><div id="directEnrollFields" hidden><label class="schedule-note"><span>Enrollment note</span><textarea id="directEnrollNote" rows="4" placeholder="Anything we should record about this enrollment?"></textarea></label><div id="directEnrollError" class="waiting-block" hidden></div><p class="message-help">This will move the parent directly to Stage 5 Enrollment.</p></div><button id="saveScheduleButton" class="journey-primary" type="submit" form="scheduleForm">Save Schedule</button></form></section><section id="handoffCard" class="journey-action-card" hidden><div class="journey-action-head"><div><p id="handoffKicker" class="section-kicker">Franchise Handoff</p><h3 id="handoffTitle">Free Trial Scheduled</h3></div><span id="handoffStatus" class="journey-action-badge">Ready to send</span></div><div class="scheduled-summary"><strong id="scheduledWhen"></strong><span id="scheduledWhere"></span></div><button id="handoffDetailsToggle" class="journey-accordion-toggle" type="button" aria-expanded="false" hidden><span id="handoffDetailsLabel">Free Trial Details</span><span class="journey-accordion-chevron">⌄</span></button><div id="copyMessageBlock" class="copy-message" hidden><pre id="franchiseMessage"></pre></div><div id="parentConfirmationBlock" class="parent-confirmation-block" hidden><strong>★ Parent confirmation not recorded</strong><p id="parentConfirmationExplanation">Send the confirmed details to the parent before the franchise handoff.</p><button id="shareParentConfirmation" class="journey-primary" type="button">Share Confirmation</button><small id="parentConfirmationMessage"></small></div><div id="franchiseHandoffActions" class="handoff-actions"><button id="copyFranchiseMessage" class="secondary-button" type="button">Copy Message</button><button id="markFranchiseSent" class="journey-primary" type="button">Mark as Sent</button></div><div id="waitingBlock" class="waiting-block" hidden><span>Expected franchise update</span><strong id="expectedUpdateTime">—</strong><p>The journey stays Scheduled until the visit or trial has happened.</p></div><div id="franchiseResultBlock" class="waiting-block" hidden><span>Franchise result</span><strong>What happened with the visit / trial?</strong><label class="schedule-note"><span>Franchise note</span><textarea id="franchiseResultNote" rows="2" placeholder="What did the franchise report?"></textarea></label><div class="handoff-actions"><button class="journey-primary franchise-result-button" data-result="enrolled" type="button">Enroll</button><button class="secondary-button franchise-result-button" data-result="interested" type="button">Interested</button><button class="secondary-button franchise-result-button" data-result="no_show" type="button">No Show</button><button class="secondary-button franchise-result-button" data-result="cancelled" type="button">Cancelled</button><button class="secondary-button franchise-result-button" data-result="not_interested" type="button">Not Interested</button></div><div id="franchiseResultError" class="waiting-block" hidden></div></div><div id="stage2UpdateBlock" class="waiting-block"><span id="appointmentActionLabel">Update appointment</span><div class="handoff-actions"><button id="rescheduleAppointment" class="secondary-button" type="button">Reschedule</button><button id="cancelAppointment" class="secondary-button" type="button">Cancel Appointment</button></div><form id="rescheduleForm" class="schedule-form" hidden><div class="schedule-grid"><label><span>Session</span><select id="rescheduleSession" required><option value="0">None</option></select></label><label><span>Date</span><input id="rescheduleDate" type="date" required></label><div class="time-field"><span>Time</span><div class="time-selects"><select id="rescheduleHour" aria-label="Hour"></select><span class="time-colon">:</span><select id="rescheduleMinute" aria-label="Minute"></select><select id="reschedulePeriod" aria-label="AM or PM"><option value="AM">AM</option><option value="PM">PM</option></select></div></div></div><label class="schedule-note"><span>Note</span><textarea id="rescheduleNote" rows="2" placeholder="Reason or anything the franchise should know"></textarea></label><div class="handoff-actions"><button id="cancelReschedule" class="secondary-button" type="button">Cancel</button><button class="journey-primary" type="submit">Save New Schedule</button></div></form><form id="cancelAppointmentForm" class="schedule-form" hidden><label class="schedule-note"><span>Cancellation note</span><textarea id="cancelAppointmentNote" rows="2" placeholder="Why was the appointment cancelled?" required></textarea></label><div class="handoff-actions"><button id="backCancelAppointment" class="secondary-button" type="button">Back</button><button class="journey-primary" type="submit">Confirm Cancel</button></div></form><div id="notInterestedAction" class="handoff-actions" hidden><button id="stage4EnrolledButton" class="journey-primary" type="button">Enrolled</button><button id="stage4RescheduleButton" class="secondary-button" type="button">Reschedule</button><button id="followUpLaterButton" class="secondary-button" type="button">Update Parent Status</button><button id="notInterestedButton" class="secondary-button" type="button">No Longer Interested</button></div><form id="enrolledForm" class="schedule-form" hidden><label class="schedule-note"><span>Enrollment note</span><textarea id="enrolledNote" rows="2" placeholder="Anything we should record about this enrollment?"></textarea></label><div class="handoff-actions"><button id="backEnrolled" class="secondary-button" type="button">Back</button><button class="journey-primary" type="submit">Confirm Enrolled</button></div></form><form id="followUpLaterForm" class="schedule-form" hidden><label class="schedule-note"><span>Parent status</span><select id="followUpDecisionStatus" required><option value="parent_deciding">Parent Deciding</option><option value="awaiting_parent_reply">Awaiting Parent Reply</option><option value="visit_planned">Visit Planned</option></select></label><div class="follow-up-day-choices" role="group" aria-label="Quick follow-up date"><span>Next check-in</span><div class="follow-up-day-buttons"><button type="button" data-follow-up-days="1">1 day</button><button type="button" data-follow-up-days="2">2 days</button><button type="button" data-follow-up-days="3">3 days</button><button type="button" data-follow-up-days="5">5 days</button><button type="button" data-follow-up-days="7">7 days</button></div></div><div class="schedule-grid"><label><span>Follow-up date</span><input id="followUpDate" type="date" required></label><div class="time-field"><span>Time</span><div class="time-selects"><select id="followUpHour" aria-label="Hour"></select><span class="time-colon">:</span><select id="followUpMinute" aria-label="Minute"></select><select id="followUpPeriod" aria-label="AM or PM"><option value="AM">AM</option><option value="PM">PM</option></select></div></div></div><label class="schedule-note"><span>Note</span><textarea id="followUpNote" rows="2" placeholder="What should we remember for the follow-up?" required></textarea></label><div class="handoff-actions"><button id="backFollowUpLater" class="secondary-button" type="button">Back</button><button class="journey-primary" type="submit">Save Status</button></div></form><form id="notInterestedForm" class="schedule-form" hidden><label class="schedule-note"><span>Note</span><textarea id="notInterestedNote" rows="2" placeholder="Why is the parent no longer interested?" required></textarea></label><div class="handoff-actions"><button id="backNotInterested" class="secondary-button" type="button">Back</button><button class="journey-primary" type="submit">Confirm No Longer Interested</button></div></form></div></section><section id="enrollmentActionCard" class="journey-action-card" hidden><div class="journey-action-head"><div><p class="section-kicker">Enrollment</p><h3>Enrolled</h3></div><span class="journey-action-badge">Stage 5</span></div><div class="scheduled-summary"><strong id="enrollmentReportedWhen">—</strong><span id="enrollmentReportedWhere"></span></div><div class="copy-message"><pre id="enrollmentReportedNote">—</pre></div><div class="handoff-actions"><button id="undoEnrollmentButton" class="secondary-button" type="button">Undo Enrollment</button></div><div id="undoEnrollmentConfirm" class="schedule-form" hidden><label class="schedule-note"><span>Reason for undo</span><textarea id="undoEnrollmentNote" rows="2" placeholder="Why is this enrollment being undone?" required></textarea></label><div id="undoEnrollmentError" class="waiting-block" hidden></div><div class="handoff-actions"><button id="cancelUndoEnrollment" class="secondary-button" type="button">Cancel</button><button id="confirmUndoEnrollment" class="journey-primary" type="button">Confirm Undo</button></div></div></section></div><div id="journeyActionDock" class="journey-action-dock" aria-label="Journey actions">
  <div id="stage1DockActions" class="journey-dock-group" data-stage="inquiry"></div>
  <div id="stage2DockActions" class="journey-dock-group journey-dock-grid-4" data-stage="scheduled" hidden>
    <div id="stage2DockCopy" class="journey-dock-slot"></div><div id="stage2DockSend" class="journey-dock-slot"></div><div id="stage2DockReschedule" class="journey-dock-slot"></div><div id="stage2DockCancel" class="journey-dock-slot"></div>
  </div>
  <div id="stage3DockActions" class="journey-dock-group journey-dock-grid-6" data-stage="awaiting-outcome" hidden></div>
  <div id="stage4DockActions" class="journey-dock-group" data-stage="followup" hidden></div>
  <div id="stage5DockActions" class="journey-dock-group journey-dock-grid-4" data-stage="enrollment" hidden>
    <div class="journey-dock-slot"></div><div class="journey-dock-slot"></div><div class="journey-dock-slot"></div><div id="stage5DockUndo" class="journey-dock-slot"></div>
  </div>
</div><div class="journey-history-scroll"><section class="journey-timeline-section"><div class="journey-action-head"><div><p class="section-kicker">History</p><h3>Journey Timeline</h3></div></div><div id="journeyTimeline" class="journey-timeline"></div></section></div></aside>`;
  document.body.appendChild(host);
  /*   reserved third workspace column for human-reviewed response suggestions*/
  const assistance=document.createElement('aside');
  assistance.className='journey-assistance';
  assistance.setAttribute('aria-label','Reply assistance');
  assistance.innerHTML=`<div class="journey-assistance-head"><h3>Reply Assistance</h3></div>
  <div class="journey-assistance-body">
    <section class="journey-assistance-section journey-assistance-editor-section">
      <div class="journey-reply-heading"><div class="journey-reply-heading-main"><h4 id="journeyReplyModeLabel">Suggested reply</h4><button id="journeyReplyWriteOwn" class="journey-reply-own-toggle journey-reply-toggle" type="button" aria-pressed="false">Write my own</button></div><div class="journey-reply-emoji-wrap"><button id="journeyReplyEmojiToggle" class="journey-reply-emoji-toggle" type="button" aria-label="Insert emoji" aria-expanded="false" aria-controls="journeyReplyEmojiMenu" title="Add emoji">😊 <span aria-hidden="true">▾</span></button><div id="journeyReplyEmojiMenu" class="journey-reply-emoji-menu" role="group" aria-label="Choose an emoji" hidden><button type="button" data-emoji="😊" aria-label="Smiling face">😊</button><button type="button" data-emoji="❤️" aria-label="Red heart">❤️</button><button type="button" data-emoji="🥰" aria-label="Smiling face with hearts">🥰</button><button type="button" data-emoji="👍" aria-label="Thumbs up">👍</button><button type="button" data-emoji="🎉" aria-label="Celebration">🎉</button></div></div><button id="journeyReplyLanguage" class="journey-reply-toggle journey-reply-language-toggle" type="button" value="taglish">Taglish</button></div>
      <p id="journeyReplyMatchLabel" class="journey-reply-match-label"></p>
      <textarea id="journeyAssistanceReplyText" rows="8" maxlength="3000" placeholder="" aria-label="Editable reply to parent"></textarea>
      <div class="journey-time-override-row" role="group" aria-label="Outgoing message original time"><span class="journey-time-override-label" title="Leave blank to use current time">Use Other Date and Time</span><input id="journeyReplyOriginalDate" type="date" aria-label="Outgoing message date"><input id="journeyReplyOriginalTime" class="journey-original-time-text" type="text" placeholder="9:45 AM" autocomplete="off" aria-label="Original Messenger time such as 9:45 AM"><button id="journeyReplyTimeClear" type="button" class="journey-time-clear" title="Clear date/time to use now" aria-label="Clear outgoing date and time">×</button></div>
      <button id="journeyReplyCopyRecord" class="journey-primary journey-reply-copy-record" type="button" disabled>Copy &amp; Record Sent</button>
      <p id="journeyReplyAssistStatus" class="journey-reply-assist-status" role="status"></p>
    </section>
    <section class="journey-reply-hidden-alternatives" hidden><div id="journeyReplyAlternatives"></div></section>
    <section class="journey-assistance-section journey-reply-library"><div class="journey-reply-library-title"><h4>Search saved replies</h4><button id="journeyReplyQuickForm" class="journey-reply-quick-form" type="button" title="Existing text form for Messenger">Text Form</button><button id="journeyReplyOnlineForm" class="journey-reply-quick-form" type="button" title="Create a private parent information form link">Parent Form Link</button><span id="journeyReplySearchCount"></span></div><input id="journeyReplySearch" class="journey-reply-search" type="search" placeholder="Search tuition, schedule, location…" aria-label="Search saved replies"><div id="journeyReplyTopics" class="journey-reply-topics"><button type="button" data-topic="tuition">Tuition</button><button type="button" data-topic="schedule">Schedule</button><button type="button" data-topic="location">Location</button><button type="button" data-topic="trial">Free trial</button></div><div id="journeyReplySearchResults" class="journey-reply-options"></div></section>
  </div>`;
  document.getElementById('journeyPanel').appendChild(assistance);
  /*   conversation and journey history switcher*/
  const rightColumn=document.querySelector('#journeyPanel .journey-history-scroll');
  const historySection=rightColumn.querySelector('.journey-timeline-section');
  const rightTabs=document.createElement('div');
  rightTabs.className='journey-right-tabs';
  rightTabs.setAttribute('role','tablist');
  rightTabs.setAttribute('aria-label','Inquiry details view');
  rightTabs.innerHTML='<button type="button" class="journey-right-tab" data-view="conversation" role="tab" aria-selected="true">Conversation</button><button type="button" class="journey-right-tab" data-view="history" role="tab" aria-selected="false">History</button>';
  const conversationView=document.createElement('section');
  conversationView.className='journey-right-view journey-conversation-view';
  conversationView.setAttribute('role','tabpanel');
  conversationView.innerHTML='<div class="journey-conversation-empty">Messenger conversation will appear here once the message API is connected.<br>Journey actions remain available on the left.</div>';
  historySection.classList.add('journey-right-view');
  historySection.setAttribute('role','tabpanel');
  rightColumn.prepend(rightTabs,conversationView);
  function setJourneyRightView(view){
    const showHistory=view==='history';
    conversationView.hidden=showHistory;
    historySection.hidden=!showHistory;
    rightTabs.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.view===view)));
  }
  rightTabs.addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)setJourneyRightView(button.dataset.view);});
  setJourneyRightView('conversation');
  /*   read-only Messenger conversation from Xano*/
  let conversationRequest=0;
  let conversationTimer=null;
  let conversationInquiryId=0;
  let conversationFingerprint='';
  let conversationLoading=false;
  let conversationFocusMessageId=0;
  const CONVERSATION_REFRESH_MS=5000;
  const conversationList=document.createElement('div');
  conversationList.className='journey-conversation-list';
  conversationView.replaceChildren(conversationList);
  /*   manual incoming Messenger capture — shared with Meta-backed conversation records*/
  const manualForm=document.createElement('form');
  manualForm.id='journeyManualMessageForm';
  manualForm.className='journey-manual-message-form';
  manualForm.innerHTML='<label for="journeyManualMessageText">Parent message from Messenger</label><textarea id="journeyManualMessageText" rows="2" maxlength="3000" placeholder="Paste the parent’s message here…" aria-label="Paste incoming parent message" required></textarea><div class="journey-time-override-row" role="group" aria-label="Parent message original time"><span class="journey-time-override-label" title="Leave blank to use current time">Use Other Date and Time</span><input id="journeyManualOriginalDate" type="date" aria-label="Parent message date"><input id="journeyManualOriginalTime" class="journey-original-time-text" type="text" placeholder="9:45 AM" autocomplete="off" aria-label="Original Messenger time such as 9:45 AM"><button id="journeyManualTimeClear" type="button" class="journey-time-clear" title="Clear date/time to use now" aria-label="Clear parent message date and time">×</button></div><div class="journey-manual-message-footer"><span id="journeyManualMessageStatus" role="status"></span><button id="journeyManualMessageSave" class="journey-primary" type="submit">Save Parent Message</button></div>';
  conversationView.appendChild(manualForm);
  const manualText=document.getElementById('journeyManualMessageText'),manualStatus=document.getElementById('journeyManualMessageStatus'),manualSave=document.getElementById('journeyManualMessageSave');
  const manualOriginalDate=document.getElementById('journeyManualOriginalDate'),manualOriginalTime=document.getElementById('journeyManualOriginalTime');
  let manualSaving=false;
  /*   Manual and outgoing historical times are Manila-local; blank uses now */
  function originalMessageTimestamp(dateInput,timeInput){
    const date=dateInput.value,time=timeInput.value.trim();
    if(!date&&!time)return null;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!time)throw Error('Choose both original date and time, or clear both to use now.');
    const parsed=time.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
    if(!parsed)throw Error('Enter the time like 9:45 AM or 2:30 PM.');
    const hour12=Number(parsed[1]),minute=Number(parsed[2]);
    if(hour12<1||hour12>12)throw Error('Enter a valid hour from 1 to 12.');
    const hour=hour12%12+(parsed[3].toUpperCase()==='PM'?12:0);
    const [year,month,day]=date.split('-').map(Number);
    const at=Date.UTC(year,month-1,day,hour,minute)-8*60*60*1000;
    if(!Number.isFinite(at)||new Date(at+8*60*60*1000).toISOString().slice(0,16)!==date+'T'+time)throw Error('Enter a valid date and time.');
    if(at>Date.now()+60000)throw Error('Message date/time cannot be in the future.');
    return at;
  }
  function resetManualTimestamp(){manualOriginalDate.value='';manualOriginalTime.value='';}
  document.getElementById('journeyManualTimeClear').addEventListener('click',resetManualTimestamp);
  function resetManualComposer(){manualText.value='';manualStatus.textContent='';manualSaving=false;manualSave.disabled=false;manualSave.textContent='Save Parent Message';resetManualTimestamp();}
  manualForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const message=manualText.value.trim(),inquiryId=conversationInquiryId,journeyId=Number(demo.journeyId)||0;
    if(manualSaving||!message||!inquiryId||!journeyId)return;
    if(!lockOwned||lockPending||lockJourneyId!==journeyId){manualStatus.textContent='Take Control to record parent messages';return;}
    let messageTimestamp=null;
    try{messageTimestamp=originalMessageTimestamp(manualOriginalDate,manualOriginalTime);}catch(error){manualStatus.textContent=error.message;return;}
    manualSaving=true;manualSave.disabled=true;manualSave.textContent='Saving…';manualStatus.textContent='';
    try{
      const response=await fetch(API+'/ad_messenger_manual_receive',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+journeyToken},body:JSON.stringify({ad_inquiry_id:inquiryId,message_text:message,...(messageTimestamp===null?{}:{message_timestamp:messageTimestamp})})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.message?.id)throw new Error(result.message?.message||result.error||'Unable to save the parent message');
      if(conversationInquiryId===inquiryId&&Number(demo.journeyId)===journeyId){
        manualText.value='';resetManualTimestamp();manualStatus.textContent=messageTimestamp===null?'Parent message recorded':'Parent message recorded';if(!replyManualMode||!replyEditor.value.trim())applyResponseMatches(result.response_matches_v2||result.response_matches,result.response_matches);
        conversationFingerprint='';await loadMessengerConversation(inquiryId,false,result.message.id);
      }
    }catch(error){manualStatus.textContent=error.message||'Unable to save the parent message';}
    finally{manualSaving=false;manualSave.disabled=false;manualSave.textContent='Save Parent Message';}
  });
  /*   reply assistance: approved matches, editable draft, and one-action copy + record*/
  const replyEditor=document.getElementById('journeyAssistanceReplyText'),replyStatus=document.getElementById('journeyReplyAssistStatus'),replyCopyRecord=document.getElementById('journeyReplyCopyRecord'),replyMatchLabel=document.getElementById('journeyReplyMatchLabel'),replyLanguage=document.getElementById('journeyReplyLanguage'),replyAlternatives=document.getElementById('journeyReplyAlternatives'),replySearch=document.getElementById('journeyReplySearch'),replySearchResults=document.getElementById('journeyReplySearchResults'),replyModeLabel=document.getElementById('journeyReplyModeLabel'),replyWriteOwn=document.getElementById('journeyReplyWriteOwn'),replyEmojiToggle=document.getElementById('journeyReplyEmojiToggle'),replyEmojiMenu=document.getElementById('journeyReplyEmojiMenu'),replyQuickForm=document.getElementById('journeyReplyQuickForm'),replyOnlineForm=document.getElementById('journeyReplyOnlineForm');
  /*   Outgoing historical times await Xano's ad_reply_record_sent timestamp support */
  const outgoingTimestampEnabled=true;
  const replyOriginalDate=document.getElementById('journeyReplyOriginalDate'),replyOriginalTime=document.getElementById('journeyReplyOriginalTime');
  function resetReplyTimestamp(){replyOriginalDate.value='';replyOriginalTime.value='';}
  document.getElementById('journeyReplyTimeClear').addEventListener('click',resetReplyTimestamp);
  let replyQuestionId=0,replyTemplateId=0,replyMatches=[],replyQuestions=[],replyQuestionsLoaded=false,replyQuestionsLoading=false,replySending=false,replyPreviewRequest=0,replySession=0,replyManualMode=false,replySavedSuggestion=null,replyTaglishDraft='',replyEnglishDraft='',replyQuickFormActive=false,replyQuickFormDrafts={taglish:'',english:''};
  function replyPlainText(value){return String(value||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').trim();}
  /*   English uses only values that Xano resolved in the Taglish reply*/
  function replyEnglishFromTemplate(template,rendered){
    const source=String(template?.taglish_text||''),target=String(template?.english_text||''),filled=String(rendered||'');
    if(!source||!target||!filled)return '';
    const escape=x=>x.replace(/[|\\{}()[\]^$+*?.]/g,'\\$&'),keys=[];let pattern='^',cursor=0;
    for(const token of source.matchAll(/%[a-z][a-z0-9_]*%/gi)){pattern+=escape(source.slice(cursor,token.index))+'([\\s\\S]*?)';keys.push(token[0].toLowerCase());cursor=token.index+token[0].length;}
    pattern+=escape(source.slice(cursor))+'$';let groups;try{groups=filled.match(new RegExp(pattern));}catch(_error){return '';}
    if(!groups)return '';const values=new Map();
    for(let i=0;i<keys.length;i++){if(values.has(keys[i])&&values.get(keys[i])!==groups[i+1])return '';values.set(keys[i],groups[i+1]);}
    let invalid=false;const english=target.replace(/%[a-z][a-z0-9_]*%/gi,key=>{if(!values.has(key.toLowerCase())){invalid=true;return key;}return values.get(key.toLowerCase());});
    return invalid?'':replyPlainText(english);
  }
  function renderReplyLanguageButton(){const current=replyLanguage.value==='english'?'English':'Taglish',next=current==='English'?'Taglish':'English';replyLanguage.textContent=next;replyLanguage.title='Switch to '+next;replyLanguage.setAttribute('aria-label','Switch reply from '+current+' to '+next);}
  function updateReplyButton(){replyCopyRecord.disabled=replySending||(!replyQuestionId&&!replyTemplateId&&!replyManualMode)||!replyEditor.value.trim();}
  function showReplyMode(){
    replyModeLabel.textContent=replyQuickFormActive?'Parent details request':replyManualMode?'Your message':'Suggested reply';
    replyWriteOwn.textContent=replyManualMode?'Use suggested reply':'Write my own';
    replyWriteOwn.setAttribute('aria-pressed',String(replyManualMode));
    replyEditor.placeholder=replyManualMode?'Write your own message to the parent…':'';
  }
  function resetReplyAssistance(){
    replyEmojiRange=null;closeReplyEmojiMenu();
    replySession++;replyPreviewRequest++;replyQuestionId=0;replyTemplateId=0;replyQuickFormActive=false;replyQuickFormDrafts={taglish:'',english:''};replyMatches=[];replySending=false;replyManualMode=false;replySavedSuggestion=null;replyEditor.value='';replyLanguage.value='taglish';renderReplyLanguageButton();replyTaglishDraft='';replyEnglishDraft='';replyMatchLabel.textContent='';replyStatus.textContent='';resetReplyTimestamp();replyCopyRecord.textContent='Copy & Record Sent';replySearch.value='';showReplyMode();renderReplyOptions();renderReplySearch();updateReplyButton();
  }
  function createReplyChoice(question){
    const button=document.createElement('button');button.type='button';button.className='journey-reply-choice';button.textContent=question.question_label||('Reply #'+question.id);
    if(Number(question.id)===replyQuestionId)button.classList.add('selected');
    button.addEventListener('click',()=>selectReplyQuestion(question));return button;
  }
  function renderReplyOptions(){
    replyAlternatives.replaceChildren();
    const alternatives=replyMatches.filter(q=>Number(q.id)!==replyQuestionId).slice(0,6);
    if(!alternatives.length){const p=document.createElement('span');p.className='journey-assistance-muted';p.textContent=replyMatches.length?'No other matching replies':'Save a parent message to see matching replies';replyAlternatives.appendChild(p);return;}
    alternatives.forEach(q=>replyAlternatives.appendChild(createReplyChoice(q)));
  }
  function renderReplySearch(){
    const count=document.getElementById('journeyReplySearchCount'),topics=document.getElementById('journeyReplyTopics');
    replySearchResults.replaceChildren();const query=replySearch.value.trim().toLowerCase(),words=query.split(/\s+/).filter(Boolean);
    topics.hidden=Boolean(query);
    if(!replyQuestionsLoaded){count.textContent='';const item=document.createElement('span');item.className='journey-assistance-muted';item.textContent=replyQuestionsLoading?'Loading saved replies…':'Saved replies unavailable';replySearchResults.appendChild(item);return;}
    const results=words.length?replyQuestions.filter(q=>{const value=[q.question_label,q.search_keywords,q.admin_action_notes].join(' ').toLowerCase();return words.every(word=>value.includes(word));}):replyMatches.filter(q=>Number(q.id)!==replyQuestionId);
    count.textContent=words.length?results.length+' found':results.length?'Related replies':'';
    if(!results.length){if(words.length){const item=document.createElement('span');item.className='journey-assistance-muted';item.textContent='No saved replies found. Try another keyword.';replySearchResults.appendChild(item);}return;}
    results.slice(0,6).forEach(q=>replySearchResults.appendChild(createReplyChoice(q)));
  }
  async function loadReplyQuestions(){
    if(replyQuestionsLoaded||replyQuestionsLoading)return;
    replyQuestionsLoading=true;renderReplySearch();
    try{
      const res=await fetch(API+'/nf_questions',{headers:{Authorization:'Bearer '+journeyToken}});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error('Could not load reply library');
      const raw=Array.isArray(data)?data:(Array.isArray(data.questions)?data.questions:(Array.isArray(data.questions?.items)?data.questions.items:(Array.isArray(data.items)?data.items:[])));
      replyQuestions=raw.filter(q=>q&&q.is_active!==false);
      replyQuestionsLoaded=true;
    }catch(error){replyQuestionsLoaded=false;replyStatus.textContent=error.message||'Could not load reply library';}
    finally{replyQuestionsLoading=false;renderReplySearch();}
  }
  async function loadReplyPreview(question){
    replyEmojiRange=null;closeReplyEmojiMenu();
    const id=Number(question?.id)||0,journeyId=Number(demo.journeyId)||0,inquiryId=conversationInquiryId,request=++replyPreviewRequest;
    replyManualMode=false;replyQuickFormActive=false;replyQuickFormDrafts={taglish:'',english:''};replySavedSuggestion=null;replyTemplateId=0;showReplyMode();replyQuestionId=id;replyEditor.value='';replyMatchLabel.textContent=question?.question_label||('Reply #'+id);replyStatus.textContent='Preparing reply…';updateReplyButton();renderReplyOptions();renderReplySearch();
    if(!id||!demo.franchiseId){replyStatus.textContent='Branch information is required to prepare this reply';return;}
    try{
      const response=await fetch(API+'/nf_response_preview',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+journeyToken},body:JSON.stringify({question_id:id,franchise_id:Number(demo.franchiseId),language:replyLanguage.value})});
      const data=await response.json().catch(()=>({}));
      if(request!==replyPreviewRequest||journeyId!==Number(demo.journeyId)||inquiryId!==conversationInquiryId)return;
      if(!response.ok||!data.response_text)throw new Error(data.message||data.error||'Unable to prepare this reply');
      replyEditor.value=replyPlainText(data.response_text);replyStatus.textContent='Review and edit before copying';updateReplyButton();
    }catch(error){if(request===replyPreviewRequest){replyStatus.textContent=error.message||'Unable to prepare reply';updateReplyButton();}}
  }
  function selectReplyQuestion(question){if(!question?.id)return;loadReplyPreview(question);}
  function applyResponseMatches(data,legacyData){
    replyEmojiRange=null;closeReplyEmojiMenu();
    const newTemplate=Boolean(data?.selected_template?.id&&data?.preferred_intent?.id&&data?.response_text);
    replySession++;replyPreviewRequest++;replyManualMode=false;replyQuickFormActive=false;replyQuickFormDrafts={taglish:'',english:''};replySavedSuggestion=null;showReplyMode();
    replyMatches=Array.isArray(legacyData?.matches)?legacyData.matches:(newTemplate?[]:(Array.isArray(data?.matches)?data.matches:[]));
    const preferred=newTemplate?data.preferred_intent:data?.preferred_match;
    if(preferred?.id){
      replyTemplateId=newTemplate?Number(data.selected_template.id):0;replyQuestionId=newTemplate?0:Number(preferred.id);
      replyLanguage.value='taglish';renderReplyLanguageButton();
      replyMatchLabel.textContent=newTemplate?(data.selected_template.template_name||preferred.intent_name||('Template #'+replyTemplateId)):(preferred.question_label||('Reply #'+preferred.id));
      replyEditor.value=replyPlainText(data.response_text);replyTaglishDraft=replyEditor.value;replyEnglishDraft=newTemplate?replyEnglishFromTemplate(data.selected_template,data.response_text):'';
      replyStatus.textContent=(newTemplate?'New response library':'Saved reply library')+' · Review and edit before copying';
    }else{
      replyQuestionId=0;replyTemplateId=0;replyEditor.value='';
      replyMatchLabel.textContent='No automatic match · Search a saved reply below';replyStatus.textContent='';
    }
    renderReplyOptions();renderReplySearch();updateReplyButton();
  }
  replyWriteOwn.addEventListener('click',()=>{
    if(replySending)return;
    replyEmojiRange=null;closeReplyEmojiMenu();
    ++replyPreviewRequest;
    replyQuickFormActive=false;replyQuickFormDrafts={taglish:'',english:''};
    if(!replyManualMode){
      replySavedSuggestion=(replyQuestionId||replyTemplateId)?{id:replyQuestionId,templateId:replyTemplateId,text:replyEditor.value,label:replyMatchLabel.textContent,language:replyLanguage.value}:null;
      replyManualMode=true;replyQuestionId=0;replyTemplateId=0;replyEditor.value='';replyMatchLabel.textContent='Write a personal reply in your own words';replyStatus.textContent='';
    }else{
      replyManualMode=false;
      if(replySavedSuggestion){
        replyQuestionId=replySavedSuggestion.id;replyTemplateId=replySavedSuggestion.templateId||0;replyEditor.value=replySavedSuggestion.text;replyMatchLabel.textContent=replySavedSuggestion.label;replyLanguage.value=replySavedSuggestion.language;renderReplyLanguageButton();replyStatus.textContent='Review and edit before copying';
      }else{replyQuestionId=0;replyTemplateId=0;replyEditor.value='';replyMatchLabel.textContent='';replyStatus.textContent='';}
      replySavedSuggestion=null;
    }
    showReplyMode();renderReplyOptions();renderReplySearch();updateReplyButton();replyEditor.focus();
  });
  /*   insert selected emoji at the last caret position inside the editable reply*/
  let replyEmojiRange=null;
  function closeReplyEmojiMenu(){replyEmojiMenu.hidden=true;replyEmojiToggle.setAttribute('aria-expanded','false');}
  function rememberReplyEmojiRange(){replyEmojiRange={start:replyEditor.selectionStart,end:replyEditor.selectionEnd};}
  replyEditor.addEventListener('select',rememberReplyEmojiRange);
  replyEditor.addEventListener('click',rememberReplyEmojiRange);
  replyEditor.addEventListener('keyup',rememberReplyEmojiRange);
  replyEmojiToggle.addEventListener('click',()=>{
    const shouldOpen=replyEmojiMenu.hidden;
    replyEmojiMenu.hidden=!shouldOpen;
    replyEmojiToggle.setAttribute('aria-expanded',String(shouldOpen));
  });
  replyEmojiMenu.addEventListener('click',event=>{
    const choice=event.target.closest('button[data-emoji]');
    if(!choice)return;
    const emoji=choice.dataset.emoji,range=replyEmojiRange||{start:replyEditor.value.length,end:replyEditor.value.length};
    const start=Math.min(range.start,replyEditor.value.length),end=Math.min(range.end,replyEditor.value.length);
    if(replyEditor.value.length-(end-start)+emoji.length>replyEditor.maxLength){replyStatus.textContent='Reply is at its character limit';closeReplyEmojiMenu();return;}
    replyEditor.focus();
    replyEditor.setRangeText(emoji,start,end,'end');
    rememberReplyEmojiRange();
    replyEditor.dispatchEvent(new Event('input',{bubbles:true}));
    closeReplyEmojiMenu();
  });
  document.addEventListener('click',event=>{if(!replyEmojiMenu.hidden&&!event.target.closest('.journey-reply-emoji-wrap'))closeReplyEmojiMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!replyEmojiMenu.hidden){event.stopPropagation();closeReplyEmojiMenu();replyEmojiToggle.focus();}});
  /*   Easy parent reply: one answer per line, no copying of a blank form*/
  function parentDetailsRequest(language,kind){
    const appointment=kind==='trial'?'free trial':'visit';
    if(language==='english')return 'Hi! 😊 To help us arrange your '+appointment+', please send these details:\n\n1. Parent’s name\n2. Address and city\n3. Child’s name\n4. Child’s age (years or months)\n5. Preferred '+appointment+' date and time (if known)\n\nJust reply with your answers in the same order, one per line. There’s no need to copy this message. Thank you! ❤️';
    return 'Hi po! 😊 Para ma-arrange namin ang inyong '+appointment+', paki-send lang po ng details:\n\n1. Parent’s name\n2. Address at city\n3. Child’s name\n4. Age ni little one (years or months)\n5. Preferred '+appointment+' date at time (if known)\n\nReply lang po ng answers in the same order, one per line. No need i-copy itong message. Salamat po! ❤️';
  }
  replyQuickForm.addEventListener('click',()=>{
    if(replySending||!demo.journeyId)return;
    if(replyEditor.value.trim()&&!replyQuickFormActive&&!window.confirm('Replace the current unsent reply with the parent information request?'))return;
    const kind=document.querySelector('input[name="visitType"]:checked')?.value==='trial'?'trial':'visit';
    if(!replyManualMode&&(replyQuestionId||replyTemplateId)){replySavedSuggestion={id:replyQuestionId,templateId:replyTemplateId,text:replyEditor.value,label:replyMatchLabel.textContent,language:replyLanguage.value};}
    ++replyPreviewRequest;replyEmojiRange=null;closeReplyEmojiMenu();
    replyManualMode=true;replyQuestionId=0;replyTemplateId=0;replyQuickFormActive=true;
    replyQuickFormDrafts={taglish:parentDetailsRequest('taglish',kind),english:parentDetailsRequest('english',kind)};
    replyEditor.value=replyQuickFormDrafts[replyLanguage.value];
    replyMatchLabel.textContent='Parent can reply with answers on separate lines — no copying needed';
    replyStatus.textContent='Review this request, then use Copy & Record Sent';
    showReplyMode();renderReplyOptions();renderReplySearch();updateReplyButton();replyEditor.focus();
  });
  /*   Online form links are created only by the authenticated Xano API*/
  function parentFormLinkMessage(language,kind,url){
    const type=kind==='trial'?'free trial':'visit';
    if(language==='english')return 'Hi! 😊 As discussed, please complete this short form so we have your little one’s details for the upcoming '+type+':\n\n'+url+'\n\nThank you! ❤️';
    return 'Hi po! 😊 As discussed, kindly fill out po this short form para makuha namin ang details ni little one for the upcoming '+type+':\n\n'+url+'\n\nSalamat po! ❤️';
  }
  let parentFormLinkLoading=false;
  replyOnlineForm.addEventListener('click',async()=>{
    const journeyId=Number(demo.journeyId)||0,inquiryId=Number(conversationInquiryId)||0,kind=document.querySelector('input[name="visitType"]:checked')?.value==='trial'?'trial':'visit';
    if(parentFormLinkLoading||replySending||!journeyId||!inquiryId)return;
    if(!lockOwned||lockPending||lockJourneyId!==journeyId){replyStatus.textContent='Take Control before generating a parent link';return;}
    if(replyEditor.value.trim()&&!window.confirm('Replace the current unsent reply with the online parent form link?'))return;
    parentFormLinkLoading=true;replyOnlineForm.disabled=true;replyOnlineForm.textContent='Preparing link…';replyStatus.textContent='Requesting secure form link…';
    try{
      const response=await fetch(API+'/ad_parent_form_link',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+journeyToken},body:JSON.stringify({ad_inquiry_id:inquiryId,ad_journey_id:journeyId,schedule_type:kind})});
      const data=await response.json().catch(()=>({}));
      const ticket=String(data.token||'');
      if(!response.ok||data.success!==true||!/^[A-Za-z0-9_-]{24,160}$/.test(ticket))throw Error('Form link service is not ready in Xano. No link was created or sent.');
      if(journeyId!==Number(demo.journeyId)||inquiryId!==Number(conversationInquiryId))return;
      const url=new URL('https://forms.thelittle-nest.com/');url.searchParams.set('t',ticket);
      ++replyPreviewRequest;replyEmojiRange=null;closeReplyEmojiMenu();
      replyManualMode=true;replyQuestionId=0;replyTemplateId=0;replyQuickFormActive=true;replySavedSuggestion=null;
      replyQuickFormDrafts={taglish:parentFormLinkMessage('taglish',kind,url.href),english:parentFormLinkMessage('english',kind,url.href)};
      replyEditor.value=replyQuickFormDrafts[replyLanguage.value];replyMatchLabel.textContent='Personalized form link · Review before sending';replyStatus.textContent='Link ready. Use Copy & Record Sent, then send it through Messenger.';
      showReplyMode();renderReplyOptions();renderReplySearch();updateReplyButton();
    }catch(e){replyStatus.textContent=e.message||'Could not prepare the form link. No link was sent.';}
    finally{parentFormLinkLoading=false;replyOnlineForm.disabled=false;replyOnlineForm.textContent='Parent Form Link';}
  });
  replyEditor.addEventListener('input',()=>{if(replyQuickFormActive)replyQuickFormDrafts[replyLanguage.value]=replyEditor.value;if(replyTemplateId&&!replyManualMode){if(replyLanguage.value==='english')replyEnglishDraft=replyEditor.value;else replyTaglishDraft=replyEditor.value;}updateReplyButton();});
  replySearch.addEventListener('input',renderReplySearch);
  document.getElementById('journeyReplyTopics').addEventListener('click',event=>{const button=event.target.closest('button[data-topic]');if(!button)return;replySearch.value=button.dataset.topic;renderReplySearch();replySearch.focus();});
  replyLanguage.addEventListener('click',()=>{
    if(replySending)return;
    const before=replyLanguage.value,after=before==='english'?'taglish':'english';
    if(replyManualMode){if(replyQuickFormActive){replyQuickFormDrafts[before]=replyEditor.value;replyEditor.value=replyQuickFormDrafts[after];updateReplyButton();}replyLanguage.value=after;renderReplyLanguageButton();return;}
    if(replyTemplateId){
      if(before==='english')replyEnglishDraft=replyEditor.value;else replyTaglishDraft=replyEditor.value;
      const translation=after==='english'?replyEnglishDraft:replyTaglishDraft;
      if(!translation){replyStatus.textContent='This translation is not ready. Choose a saved reply or write your own.';return;}
      replyLanguage.value=after;renderReplyLanguageButton();replyEditor.value=translation;replyStatus.textContent='Review and edit before copying';updateReplyButton();return;
    }
    replyLanguage.value=after;renderReplyLanguageButton();
    if(replyQuestionId){const chosen=replyMatches.concat(replyQuestions).find(q=>Number(q.id)===replyQuestionId)||{id:replyQuestionId,question_label:replyMatchLabel.textContent};loadReplyPreview(chosen);}
  });
  replyCopyRecord.addEventListener('click',async()=>{
    const message=replyEditor.value.trim(),questionId=replyQuestionId,templateId=replyTemplateId,language=replyLanguage.value,journeyId=Number(demo.journeyId)||0,inquiryId=conversationInquiryId;
    const isConfirmation=replyQuickFormActive&&replyMatchLabel.textContent.startsWith('Appointment confirmation');
    if(replySending||!message||(!replyManualMode&&!questionId&&!templateId)||!journeyId||!inquiryId)return;
    if(!lockOwned||lockPending||lockJourneyId!==journeyId){replyStatus.textContent='Take Control before recording replies';return;}
    let messageTimestamp=null;
    try{messageTimestamp=originalMessageTimestamp(replyOriginalDate,replyOriginalTime);}catch(error){replyStatus.textContent=error.message;return;}
    if(messageTimestamp!==null&&!outgoingTimestampEnabled){replyStatus.textContent='Outgoing date/time needs one Xano endpoint change first (ad_reply_record_sent). Nothing has been recorded.';return;}
    const session=++replySession;replySending=true;replyCopyRecord.textContent='Copying…';replyStatus.textContent='';updateReplyButton();
    try{
      /*   clipboard write must happen during the user click, before network requests*/
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(message);
      else{replyEditor.focus();replyEditor.select();if(!document.execCommand('copy'))throw new Error('Clipboard access is unavailable');}
    }catch(error){if(session===replySession){replyStatus.textContent='Could not copy. Allow clipboard access and try again';replySending=false;replyCopyRecord.textContent='Copy & Record Sent';updateReplyButton();}return;}
    try{
      if(session!==replySession||journeyId!==Number(demo.journeyId)||inquiryId!==conversationInquiryId)return;
      replyCopyRecord.textContent='Recording…';
      const response=await fetch(API+'/ad_reply_record_sent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+journeyToken},body:JSON.stringify({ad_journey_id:journeyId,ad_inquiry_id:inquiryId,response_text:message,question_id:templateId?0:questionId,language,reply_source:replyQuickFormActive&&replyMatchLabel.textContent.startsWith('Appointment confirmation')?'parent_appointment_confirmation':templateId?'ad_response_template_'+templateId:(questionId?'reply_assistant_manual':'admin_composed'),...(messageTimestamp===null?{}:{message_timestamp:messageTimestamp})})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.message?.id){
        const details=typeof result.message==='string'?result.message:(typeof result.error==='string'?result.error:(typeof result.error?.message==='string'?result.error.message:(typeof result.code==='string'?result.code:'Server did not return a saved message')));
        console.warn('Reply recording failed:',response.status,result.code||'',details);
        throw new Error('Recording failed (HTTP '+response.status+'): '+details);
      }
      let confirmationSaveFailed=false,confirmationError='';
      if(isConfirmation&&stage2State){
        const scheduledAt=stage2State.scheduledFor;
        rememberConfirmationRef(journeyId,scheduledAt,result.message.id);
        try{
          await saveConfirmationReference(journeyId,scheduledAt,result.message.id);
          parentConfirmationState=true;clearConfirmationRef(journeyId);showParentConfirmationGate();window.dispatchEvent(new Event('parent-confirmation-recorded'));
        }catch(error){
          confirmationError=error.message||'Unknown confirmation error';
          console.warn('Parent confirmation status save failed:',confirmationError);
          try{
            if(await readConfirmationStatus(journeyId,scheduledAt)){
              parentConfirmationState=true;clearConfirmationRef(journeyId);showParentConfirmationGate();window.dispatchEvent(new Event('parent-confirmation-recorded'));confirmationError='';
            }else confirmationSaveFailed=true;
          }catch(_){confirmationSaveFailed=true;}
        }
      }
      if(session===replySession&&journeyId===Number(demo.journeyId)&&inquiryId===conversationInquiryId){
        replyEditor.value='';resetReplyTimestamp();replyQuestionId=0;replyTemplateId=0;replyQuickFormActive=false;replyQuickFormDrafts={taglish:'',english:''};replySavedSuggestion=null;replyMatchLabel.textContent=replyManualMode?'Write another message when needed':'Reply recorded · Select another approved reply when needed';replyStatus.textContent=confirmationSaveFailed?'Message recorded, but confirmation status could not be verified. Do NOT record the message again. Use Retry Saving Confirmation in the appointment panel. '+confirmationError:'Copied & recorded. Paste and send it in Facebook Messenger';showReplyMode();renderReplyOptions();renderReplySearch();updateReplyButton();
        conversationFingerprint='';await loadMessengerConversation(inquiryId,false,result.message.id);
      }
    }catch(error){if(session===replySession)replyStatus.textContent='Copied, but recording was not confirmed. Check Conversation before retrying. '+(error.message||'');}
    finally{if(session===replySession){replySending=false;replyCopyRecord.textContent='Copy & Record Sent';updateReplyButton();}}
  });
  function conversationNotice(message){
    const notice=document.createElement('p');notice.className='journey-conversation-notice';notice.textContent=message;conversationList.replaceChildren(notice);
  }
  function conversationDate(value){
    if(value===null||value===undefined||value==='')return '';
    const stamp=typeof value==='number'?value:Number(value);
    const date=new Date(Number.isFinite(stamp)?stamp:value);
    return Number.isNaN(date.getTime())?'':date.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila'});
  }
  function stopConversationRefresh(){
    if(conversationTimer!==null){clearInterval(conversationTimer);conversationTimer=null;}
    conversationInquiryId=0;conversationFingerprint='';conversationFocusMessageId=0;conversationRequest++;
  }
  function startConversationRefresh(inquiryId){
    stopConversationRefresh();conversationInquiryId=inquiryId;
    loadMessengerConversation(inquiryId,true);
    if(inquiryId)conversationTimer=setInterval(()=>{
      if(!document.hidden&&panel.classList.contains('open')&&conversationInquiryId===inquiryId&&!conversationLoading)loadMessengerConversation(inquiryId,false);
    },CONVERSATION_REFRESH_MS);
  }
  /*   Parent website submissions share the Conversation timeline but are not Messenger messages*/
  function showParentSubmissionReview(item){
    openCaptureReview('');
    if(captureOverlay.hidden)return;
    const fields={parent:item.parent_name,child:item.child_name,ageYears:item.age_years,ageMonths:item.age_months,date:item.preferred_date};
    Object.entries(fields).forEach(([key,value])=>captureField(key).value=value===null||value===undefined?'':String(value));
    const address=[item.address,item.city].filter(Boolean).join(', ');
    captureField('address').value=address;
    const notes=[];
    if(item.contact_number)notes.push('Contact number: '+item.contact_number);
    if(item.preferred_time)notes.push('Preferred visit/trial time: '+item.preferred_time);
    if(item.notes)notes.push(String(item.notes));
    captureField('notes').value=notes.join('\n');
    captureSource.hidden=true;captureSource.open=false;captureRaw.value='';
    const preferred=String(item.preferred_time||'').trim().match(/^(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)$/i);
    if(preferred){const hour=(Number(preferred[1])%12)+(preferred[3].toLowerCase()==='pm'?12:0);captureField('time').value=String(hour).padStart(2,'0')+':'+(preferred[2]||'00');}
    captureNotice.textContent='Submitted online by the parent. Review and confirm the appointment time before applying; no schedule has been saved.';
    captureField('parent').focus();
  }
  function renderParentSubmission(item){
    const line=document.createElement('div');line.className='journey-message-row incoming journey-submission-row';
    const bubble=document.createElement('div');bubble.className='journey-submission-bubble';
    const heading=document.createElement('strong');heading.textContent='★ Parent Information Received';
    const origin=document.createElement('small');origin.textContent='Website form submission · '+conversationDate(item.submitted_at||item.created_at);
    bubble.append(heading,origin);
    const details=[
      ['Parent',item.parent_name],['Child',item.child_name],
      ['Age',Number.isFinite(Number(item.age_years))&&item.age_years!==null?String(item.age_years)+' years'+(Number(item.age_months)>0?', '+item.age_months+' months':''):''],
      ['City',item.city],['Address',item.address],['Contact',item.contact_number],
      ['Requested date',item.preferred_date],['Requested time',item.preferred_time],['Notes',item.notes]
    ];
    const grid=document.createElement('dl');grid.className='journey-submission-details';
    details.forEach(([label,value])=>{if(value===null||value===undefined||String(value).trim()==='')return;const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=String(value);grid.append(dt,dd);});
    bubble.appendChild(grid);
    if(item.status==='awaiting_schedule'){
      const action=document.createElement('button');action.type='button';action.className='journey-primary journey-submission-review';action.textContent='Review & Fill Schedule';action.addEventListener('click',()=>showParentSubmissionReview(item));bubble.appendChild(action);
    }else{const done=document.createElement('p');done.className='journey-submission-handled';done.textContent='Schedule recorded · submission retained for history';bubble.appendChild(done);}
    line.appendChild(bubble);return line;
  }
  function showNewlySavedConversationMessage(){
    if(!conversationFocusMessageId)return;
    const id=String(conversationFocusMessageId);
    const match=Array.from(conversationList.querySelectorAll('[data-conversation-message-id]')).find(node=>node.dataset.conversationMessageId===id);
    if(!match)return;
    const viewport=conversationList.getBoundingClientRect(),row=match.getBoundingClientRect();
    conversationList.scrollTop+=row.top-viewport.top-(conversationList.clientHeight-row.height)/2;
    match.classList.add('journey-message-just-saved');
    conversationFocusMessageId=0;
  }
  async function loadMessengerConversation(inquiryId,initial=false,focusMessageId=0){
    if(focusMessageId)conversationFocusMessageId=Number(focusMessageId)||0;
    if(conversationLoading)return;
    const request=++conversationRequest;conversationLoading=true;
    if(initial){setJourneyRightView('conversation');conversationNotice('Loading conversation…');}
    if(!inquiryId){conversationNotice('This journey has no linked inquiry.');conversationLoading=false;return;}
    try{
      const [response,formsResponse]=await Promise.all([
        fetch(API+'/ad_messenger_conversation?ad_inquiry_id='+encodeURIComponent(inquiryId),{headers:{Authorization:'Bearer '+journeyToken}}),
        fetch(API+'/ad_parent_form_submissions?ad_inquiry_id='+encodeURIComponent(inquiryId),{headers:{Authorization:'Bearer '+journeyToken},cache:'no-store'}).catch(()=>null)
      ]);
      if(request!==conversationRequest)return;
      if(!response.ok)throw Error('Conversation request failed ('+response.status+').');
      const data=await response.json();
      const fdata=formsResponse?.ok?await formsResponse.json().catch(()=>({})):{};
      if(request!==conversationRequest)return;
      const messages=Array.isArray(data.messages)?data.messages:(Array.isArray(data.messages?.items)?data.messages.items:(Array.isArray(data.messages?.records)?data.messages.records:[]));
      const forms=Array.isArray(fdata.submissions)?fdata.submissions:[];
      const timeline=[
        ...messages.map(item=>({kind:'message',item,timestamp:Number(item.message_timestamp||item.created_at)||0})),
        ...forms.map(item=>({kind:'form',item,timestamp:Number(item.submitted_at||item.created_at)||0}))
      ].sort((a,b)=>a.timestamp-b.timestamp);
      const fingerprint=JSON.stringify(timeline.map(({kind,item,timestamp})=>kind==='form'?[kind,item.id,item.status,timestamp]:[kind,item.id,item.message_id,item.message_text,item.direction,timestamp]));
      if(fingerprint===conversationFingerprint){showNewlySavedConversationMessage();return;}
      conversationFingerprint=fingerprint;
      if(!timeline.length){conversationNotice('No conversation messages or parent forms recorded yet.');return;}
      const nearBottom=conversationList.scrollHeight-conversationList.scrollTop-conversationList.clientHeight<70,previousScroll=conversationList.scrollTop;
      const fragment=document.createDocumentFragment();
      timeline.forEach(({kind,item})=>{
        if(kind==='form'){fragment.appendChild(renderParentSubmission(item));return;}
        const outgoing=item.direction==='outbound'||item.direction==='outgoing';
        const line=document.createElement('div');line.className='journey-message-row '+(outgoing?'outgoing':'incoming');line.dataset.conversationMessageId=String(item.id);
        const bubble=document.createElement('div');bubble.className='journey-message-bubble';
        const body=document.createElement('div');body.className='journey-message-text';body.textContent=item.message_text||'Message without text';
        const meta=document.createElement('div');meta.className='journey-message-meta';
        const occurredAt=Number(item.message_timestamp)||Number(item.created_at)||0,recordedAt=Number(item.created_at)||0;
        const originalTime=conversationDate(occurredAt),recordedTime=conversationDate(recordedAt);
        meta.textContent=(outgoing?'Playschool':'Parent')+(originalTime?' · Sent '+originalTime:'');
        /*   Show the audit entry time separately when an older Messenger message was added later */
        if(originalTime&&recordedTime&&Math.abs(recordedAt-occurredAt)>120000){
          const recorded=document.createElement('span');recorded.className='journey-message-recorded';recorded.textContent='Recorded '+recordedTime;meta.appendChild(recorded);
        }
        bubble.append(body,meta);line.appendChild(bubble);fragment.appendChild(line);
      });
      conversationList.replaceChildren(fragment);
      conversationList.scrollTop=initial||nearBottom?conversationList.scrollHeight:previousScroll;
      showNewlySavedConversationMessage();
    }catch(error){if(request===conversationRequest&&initial)conversationNotice('Unable to load Messenger conversation. Please reopen this inquiry.');}
    finally{conversationLoading=false;}
  }
  const panel=document.getElementById('journeyPanel'),backdrop=document.getElementById('journeyBackdrop');
  /*   admin control lease — one editor per journey*/
  const lockControls=document.createElement('div');lockControls.className='journey-lock-controls';
  lockControls.innerHTML='<span id="journeyLockStatus" class="journey-lock-status" role="status">View only</span><button id="journeyTakeControl" class="secondary-button" type="button">Take Control</button><button id="journeyReleaseControl" class="secondary-button" type="button" hidden>Release Lock</button>';
  document.querySelector('#journeyPanel .journey-panel-head-actions').prepend(lockControls);
  const lockStatus=document.getElementById('journeyLockStatus');
  const takeControlButton=document.getElementById('journeyTakeControl');
  const releaseControlButton=document.getElementById('journeyReleaseControl');
  let lockJourneyId=0,lockOwned=false,lockPending=false,lockTimer=null,lockGeneration=0;
  const LOCK_RENEW_MS=20000;
  function lockMessage(message){lockStatus.textContent=message;}
  function updateLockControls(){
    takeControlButton.hidden=lockOwned;releaseControlButton.hidden=!lockOwned;
    takeControlButton.disabled=lockPending||!demo.journeyId;releaseControlButton.disabled=lockPending;
    panel.dataset.lockOwned=lockOwned?'true':'false';
  }
  async function lockApi(endpoint,journeyId){
    const response=await fetch(API+'/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+journeyToken},body:JSON.stringify({ad_journey_id:journeyId})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.success!==true)throw new Error(data.message||data.error||'Unable to change inquiry lock.');
    return data;
  }
  function stopLockRenewal(){if(lockTimer!==null){clearInterval(lockTimer);lockTimer=null;}}
  function loseLock(message){
    stopLockRenewal();lockOwned=false;lockPending=false;lockJourneyId=0;lockMessage(message||'View only');updateLockControls();
  }
  async function releaseHeldLock(){
    const journeyId=lockOwned?lockJourneyId:0;
    ++lockGeneration;stopLockRenewal();lockOwned=false;lockJourneyId=0;lockPending=false;lockMessage('View only');updateLockControls();
    if(!journeyId)return;
    try{await lockApi('ad_journey_lock_release',journeyId);}
    catch(error){if(panel.classList.contains('open'))lockMessage('Release could not be confirmed; the lease will expire automatically.');}
  }
  async function renewHeldLock(generation){
    if(!lockOwned||lockPending||!lockJourneyId||document.hidden)return;
    const id=lockJourneyId;
    try{
      await lockApi('ad_journey_lock_acquire',id);
      if(generation===lockGeneration&&lockOwned&&lockJourneyId===id)lockMessage('You have control');
    }catch(error){if(generation===lockGeneration)loseLock('Control lost — take control again to edit.');}
  }
  takeControlButton.addEventListener('click',async()=>{
    const id=Number(demo.journeyId)||0;
    if(!id||lockPending||lockOwned)return;
    lockPending=true;updateLockControls();lockMessage('Taking control…');
    const generation=++lockGeneration;
    try{
      await lockApi('ad_journey_lock_acquire',id);
      if(generation!==lockGeneration||!panel.classList.contains('open')||Number(demo.journeyId)!==id){
        try{await lockApi('ad_journey_lock_release',id);}catch(_error){}
        return;
      }
      lockJourneyId=id;lockOwned=true;lockMessage('You have control');
      stopLockRenewal();lockTimer=setInterval(()=>renewHeldLock(generation),LOCK_RENEW_MS);
    }catch(error){if(generation===lockGeneration)lockMessage(error.message||'Unable to take control.');}
    finally{if(generation===lockGeneration){lockPending=false;updateLockControls();}}
  });
  releaseControlButton.addEventListener('click',()=>{if(!lockPending)releaseHeldLock();});
  /*   returning to an open panel must revalidate ownership before edits*/
  async function revalidateVisibleLock(){
    if(document.hidden||!panel.classList.contains('open')||!demo.journeyId||lockPending)return;
    const id=Number(demo.journeyId),generation=++lockGeneration;
    stopLockRenewal();lockOwned=false;lockJourneyId=0;lockPending=true;
    lockMessage('Checking control…');updateLockControls();
    try{
      await lockApi('ad_journey_lock_acquire',id);
      if(generation!==lockGeneration||!panel.classList.contains('open')||Number(demo.journeyId)!==id)return;
      lockJourneyId=id;lockOwned=true;lockMessage('You have control');
      lockTimer=setInterval(()=>renewHeldLock(generation),LOCK_RENEW_MS);
    }catch(error){if(generation===lockGeneration)lockMessage('View only — '+(error.message||'Unable to confirm control.'));}
    finally{if(generation===lockGeneration){lockPending=false;updateLockControls();}}
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      if(!panel.classList.contains('open'))return;
      ++lockGeneration;stopLockRenewal();lockOwned=false;lockJourneyId=0;lockPending=false;
      lockMessage('Control will be checked when you return');updateLockControls();
    }else revalidateVisibleLock();
  });
  window.addEventListener('focus',()=>{if(!document.hidden)revalidateVisibleLock();});
  ['click','submit'].forEach(type=>panel.addEventListener(type,event=>{
    if(lockOwned)return;
    if(!event.target.closest('.journey-panel-main, .journey-action-dock'))return;
    if(type==='click'&&!event.target.closest('button,input,select,textarea,label'))return;
    event.preventDefault();event.stopImmediatePropagation();
    lockMessage('Take Control to edit this journey.');
  },true));

  /*   ask permission before submitting any parent-facing or stage-changing action*/
  const confirmedEvents=new WeakSet();
  const actionClicks={
    markFranchiseSent:'ad_journey_franchise_sent',confirmUndoEnrollment:'ad_journey_undo_enrollment'
  };
  const actionForms={
    scheduleForm:()=>document.querySelector('input[name="visitType"]:checked')?.value==='enroll'?'ad_journey_enrolled_stage1':document.querySelector('input[name="visitType"]:checked')?.value==='message'?'ad_journey_parent_message':'ad_journey_schedule',
    enrolledForm:()=> 'ad_journey_enrolled_stage4',
    rescheduleForm:()=> 'ad_journey_reschedule',
    cancelAppointmentForm:()=> 'ad_journey_cancel',
    followUpLaterForm:()=> 'ad_journey_parent_deciding',
    notInterestedForm:()=> 'ad_journey_not_interested',
    stage1NotInterestedForm:()=> 'ad_journey_not_interested',
    stage3RescheduleForm:()=> 'ad_journey_reschedule'
  };
  panel.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target||confirmedEvents.has(target))return;
    let action=actionClicks[target.id];
    if(target.classList.contains('franchise-result-button'))action=target.dataset.result==='enrolled'?'ad_journey_enrolled_stage4':'ad_journey_result_stage';
    if(target.classList.contains('stage3-result-button'))action=target.dataset.result==='enrolled'?'ad_journey_enrolled_stage4':'ad_journey_result_stage';
    if(!action||!JOURNEY_MUTATIONS[action]||target.disabled)return;
    event.preventDefault();event.stopImmediatePropagation();
    const [title,description]=JOURNEY_MUTATIONS[action];
    showChangeDialog(title,description).then(approved=>{
      if(!approved||!target.isConnected)return;
      confirmedEvents.add(target);target.click();confirmedEvents.delete(target);
    });
  },true);
  panel.addEventListener('submit',event=>{
    const form=event.target;
    if(confirmedEvents.has(form)||!actionForms[form.id])return;
    const action=actionForms[form.id]();
    if(!JOURNEY_MUTATIONS[action])return;
    event.preventDefault();event.stopImmediatePropagation();
    const submitter=event.submitter;
    const [title,description]=JOURNEY_MUTATIONS[action];
    showChangeDialog(title,description).then(approved=>{
      if(!approved||!form.isConnected)return;
      confirmedEvents.add(form);
      try{form.requestSubmit(submitter&&submitter.isConnected?submitter:undefined);}finally{confirmedEvents.delete(form);}
    });
  },true);
  const actionDock=document.getElementById('journeyActionDock');
  setupActionDock();
  function setupActionDock(){
    document.getElementById('stage1DockActions').appendChild(document.getElementById('saveScheduleButton'));
    document.getElementById('scheduleActionCard').appendChild(document.getElementById('stage1DockActions'));
    document.getElementById('stage2DockCopy').appendChild(document.getElementById('copyFranchiseMessage'));
    document.getElementById('stage2DockSend').appendChild(document.getElementById('markFranchiseSent'));
    document.getElementById('stage2DockReschedule').appendChild(document.getElementById('rescheduleAppointment'));
    document.getElementById('stage2DockCancel').appendChild(document.getElementById('cancelAppointment'));
    document.getElementById('stage4DockActions').appendChild(document.getElementById('notInterestedAction'));
    document.getElementById('stage5DockUndo').appendChild(document.getElementById('undoEnrollmentButton'));
  }
  function setActionDockStage(stage){
    const dockStage=stage==='inquiry-followup'?'inquiry':stage;
    actionDock.querySelectorAll('.journey-dock-group').forEach(group=>group.hidden=group.dataset.stage!==dockStage);
  }
  function setStage4DockDisabled(disabled){
    ['stage4EnrolledButton','stage4RescheduleButton','followUpLaterButton','notInterestedButton'].forEach(id=>{const button=document.getElementById(id);if(button)button.disabled=disabled;});
  }
  function friendlyStage(value){const key=String(value||'inquiry').toLowerCase().replace(/\s*\/\s*/g,'_').replace(/[ -]+/g,'_');const map={inquiry:'New Inquiry',inquiry_followup:'Continue Conversation',inquiry_follow_up:'Continue Conversation',scheduled:'Appointment Scheduled',awaiting_outcome:'Awaiting Franchise Update',follow_up_decision:'Parent Follow-up',follow_up:'Parent Follow-up',enrollment:'Enrolled'};return map[key]||String(value||'New Inquiry');}
  function friendlyStatus(value){const key=String(value||'new').toLowerCase().replace(/[ -]+/g,'_');const map={new:'New Inquiry',awaiting_parent_reply:'Awaiting Parent Reply',parent_deciding:'Parent Deciding',visit_planned:'Visit Planned',ready_to_send:'Ready to Send to Franchise',sent_to_franchise:'Details Sent to Franchise',awaiting_result:'Waiting for Franchise Result',follow_up_due:'Follow-up Due',no_show:'No Show',cancelled:'Appointment Cancelled',not_interested:'No Longer Interested',enrolled:'Enrolled'};return map[key]||String(value||'').replace(/_/g,' ').replace(/\b\w/g,char=>char.toUpperCase());}
  function friendlyNext(value,stage=''){const key=String(value||'none').toLowerCase().replace(/[ -]+/g,'_');const stageKey=String(stage||'').toLowerCase();if(key==='wait_parent_reply')return'Continue Conversation';if(key==='contact_franchise')return'Get Result From Franchise';if(key==='follow_up_parent')return'Follow Up With Parent';if(key==='none'&&stageKey.includes('enrollment'))return'No Action Needed';if(key==='none')return'No Action Needed';const map={send_details_to_franchise:'Send Details to Franchise',send_to_franchise:'Send Details to Franchise',wait_for_scheduled_visit_trial:'Wait for Visit / Free Trial'};return map[key]||String(value||'').replace(/_/g,' ').replace(/\b\w/g,char=>char.toUpperCase());}
  const quickGuides={
    en:{
      inquiry:{title:'Stage 1 — Inquiry',items:['<strong>Free Trial</strong> — use when the parent agrees to a free trial.','<strong>Visit</strong> — use when the parent agrees to visit the playschool.','<strong>Continue Conversation</strong> — use while you are still actively chatting and the conversation is ongoing.','<strong>Enroll</strong> — use when the parent enrolls without a visit or free trial. This includes walk-ins, online payment, parents who cannot come down first, or enrollments for a new location that is not open yet.','<strong>No Longer Interested</strong> — use when the parent clearly decides not to continue.'],note:'Choose what actually happened with the parent. They do not need to go through every stage.'},
      'inquiry-followup':{title:'Stage 1A — Continue Conversation',items:['<strong>Continue Conversation</strong> — keep using this while the parent conversation is still active and ongoing.','<strong>Free Trial</strong> or <strong>Visit</strong> — use once an appointment is actually agreed.','<strong>Enroll</strong> — use if the parent enrolls directly without a visit or free trial.','<strong>No Longer Interested</strong> — use when the parent clearly decides not to continue.'],note:'Stage 1A simply means the conversation is already underway. Move the Journey when the real situation changes.'},
      scheduled:{title:'Stage 2 — Scheduled',items:['<strong>Copy Message</strong> — copies the appointment details for the franchise.','<strong>Mark as Sent</strong> — use only after the details were actually sent to the franchise.','<strong>Reschedule</strong> — use when a new appointment date and time have been agreed.','<strong>Cancel Appointment</strong> — use when the current appointment is cancelled.'],note:'Once the franchise has been notified, the Journey waits for the visit or free trial to happen.'},
      'awaiting-outcome':{title:'Stage 3 — Awaiting Outcome',items:['<strong>Enroll</strong> — the parent enrolled.','<strong>Interested</strong> — still interested, but not enrolled yet.','<strong>No Show</strong> — the parent did not attend.','<strong>Cancelled</strong> — the appointment was cancelled.','<strong>Not Interested</strong> — the parent will not continue.','<strong>Reschedule</strong> — another appointment has already been agreed.'],note:'Record what the franchise actually reports. A note is required for the result.'},
      followup:{title:'Stage 4 — Follow-up / Decision',items:['<strong>Enrolled</strong> — the parent completed enrollment.','<strong>Reschedule</strong> — another visit or free trial has been confirmed.','<strong>Follow Up Later</strong> — the parent is still considering and needs more time; set the real next contact date.','<strong>No Longer Interested</strong> — the parent clearly decides not to continue.'],note:'This stage is for the next decision after the visit, trial, no-show, cancellation, or continued interest.'},
      enrollment:{title:'Stage 5 — Enrollment',items:['<strong>Enrolled</strong> — the Journey is complete when the enrollment is correct.','<strong>Undo Enrollment</strong> — use only when the enrollment was recorded by mistake. The reason and correction stay in the Timeline.'],note:'If the enrollment is correct, no further Journey action is needed.'}
    },
    tl:{
      inquiry:{title:'Stage 1 — Inquiry',items:['<strong>Free Trial</strong> — gamitin kapag pumayag ang parent sa free trial.','<strong>Visit</strong> — gamitin kapag pumayag ang parent na bumisita sa playschool.','<strong>Continue Conversation</strong> — gamitin habang active pa ang chat at tuloy ang conversation.','<strong>Enroll</strong> — gamitin kapag nag-enroll ang parent nang walang visit o free trial. Kasama rito ang walk-in, online payment, parent na walang oras bumisita muna, o enrollment sa bagong location na hindi pa open.','<strong>No Longer Interested</strong> — gamitin kapag malinaw na ayaw nang magpatuloy ng parent.'],note:'Piliin kung ano talaga ang nangyari sa parent. Hindi nila kailangang dumaan sa bawat stage.'},
      'inquiry-followup':{title:'Stage 1A — Continue Conversation',items:['<strong>Continue Conversation</strong> — gamitin habang active at tuloy pa ang parent conversation.','<strong>Free Trial</strong> o <strong>Visit</strong> — gamitin kapag may napagkasunduang appointment na.','<strong>Enroll</strong> — gamitin kung direktang nag-enroll nang walang visit o free trial.','<strong>No Longer Interested</strong> — gamitin kapag malinaw na hindi na magpapatuloy ang parent.'],note:'Ang Stage 1A ay ibig sabihin ongoing na ang conversation. Ilipat ang Journey kapag nagbago na ang totoong situation.'},
      scheduled:{title:'Stage 2 — Scheduled',items:['<strong>Copy Message</strong> — kino-copy ang appointment details para sa franchise.','<strong>Mark as Sent</strong> — gamitin lang pagkatapos talagang maipadala ang details sa franchise.','<strong>Reschedule</strong> — gamitin kapag may bagong napagkasunduang date at time.','<strong>Cancel Appointment</strong> — gamitin kapag cancelled ang current appointment.'],note:'Kapag na-notify na ang franchise, hinihintay na lang ng Journey ang visit o free trial.'},
      'awaiting-outcome':{title:'Stage 3 — Awaiting Outcome',items:['<strong>Enroll</strong> — nag-enroll ang parent.','<strong>Interested</strong> — interested pa pero hindi pa enrolled.','<strong>No Show</strong> — hindi dumating ang parent.','<strong>Cancelled</strong> — cancelled ang appointment.','<strong>Not Interested</strong> — hindi na magpapatuloy ang parent.','<strong>Reschedule</strong> — may bago nang napagkasunduang appointment.'],note:'I-record kung ano talaga ang ni-report ng franchise. Required ang note sa result.'},
      followup:{title:'Stage 4 — Follow-up / Decision',items:['<strong>Enrolled</strong> — completed na ang enrollment.','<strong>Reschedule</strong> — confirmed na ang panibagong visit o free trial.','<strong>Follow Up Later</strong> — nag-iisip pa ang parent at kailangan ng oras; ilagay ang totoong next contact date.','<strong>No Longer Interested</strong> — malinaw na ayaw nang magpatuloy ng parent.'],note:'Ito ang stage para sa next decision pagkatapos ng visit, trial, no-show, cancellation, o continued interest.'},
      enrollment:{title:'Stage 5 — Enrollment',items:['<strong>Enrolled</strong> — complete na ang Journey kapag tama ang enrollment.','<strong>Undo Enrollment</strong> — gamitin lang kung maling na-record ang enrollment. Mananatili sa Timeline ang reason at correction.'],note:'Kung tama ang enrollment, wala nang kailangang Journey action.'}
    }
  };
  function quickGuideStage(stage){const value=String(stage||'inquiry').toLowerCase();if(value==='inquiry_followup'||value==='inquiry_follow_up')return'inquiry-followup';if(value==='awaiting_outcome')return'awaiting-outcome';if(value==='follow_up'||value==='follow_up_decision')return'followup';return value;}
  function setQuickGuide(stage,collapse=true){const key=quickGuideStage(stage),lang=localStorage.getItem('ads_journey_help_language')==='tl'?'tl':'en',guide=quickGuides[lang][key]||quickGuides[lang].inquiry;document.getElementById('journeyQuickGuideTitle').textContent=guide.title;document.getElementById('journeyQuickGuideBody').innerHTML=`<ul>${guide.items.map(item=>`<li>${item}</li>`).join('')}</ul><p>${guide.note}</p>`;const languageButton=document.getElementById('journeyQuickGuideLanguage');if(languageButton){languageButton.textContent=lang==='tl'?'English':'Tagalog';languageButton.setAttribute('aria-label',lang==='tl'?'Switch quick guide to English':'Switch quick guide to Tagalog');}if(collapse){document.getElementById('journeyQuickGuide').hidden=true;document.getElementById('journeyQuickGuideButton').setAttribute('aria-expanded','false');}}
  function toggleQuickGuide(force){const guide=document.getElementById('journeyQuickGuide'),button=document.getElementById('journeyQuickGuideButton');const show=typeof force==='boolean'?force:guide.hidden;guide.hidden=!show;button.setAttribute('aria-expanded',show?'true':'false');}function switchQuickGuideLanguage(){const next=localStorage.getItem('ads_journey_help_language')==='tl'?'en':'tl';localStorage.setItem('ads_journey_help_language',next);setQuickGuide(panel.dataset.stage||'inquiry',false);}
  buildTimeSelectors();buildRescheduleTimeSelectors();buildFollowUpTimeSelectors();
  document.querySelectorAll('input[name="visitType"]').forEach(input=>input.addEventListener('change',()=>setScheduleMode(input.value)));

  /*   Fill Schedule: drag selected parent text into an editable preview; never save automatically*/
  const captureOverlay=document.createElement('div');
  captureOverlay.id='journeyCaptureOverlay';captureOverlay.className='journey-capture-overlay';captureOverlay.hidden=true;
  captureOverlay.innerHTML=[
    '<section class="journey-capture-dialog" role="dialog" aria-modal="false" aria-labelledby="journeyCaptureTitle">',
    '<div class="journey-capture-head"><div><small>PARENT INFORMATION</small><h3 id="journeyCaptureTitle">Review Schedule Details</h3></div><button id="journeyCaptureClose" class="journey-capture-close" type="button" aria-label="Close review">×</button></div>',
    '<p class="journey-capture-intro">Check and correct the details before filling the form. Nothing is saved yet.</p>',
    '<details id="journeyCaptureSource" hidden><summary>Source message — view or edit</summary><textarea id="journeyCaptureRaw" rows="4" placeholder="Paste the completed parent form or message here"></textarea><button type="button" id="journeyCaptureExtract" class="journey-capture-extract">Extract details again</button></details>',
    '<div id="journeyCaptureNotice" class="journey-capture-notice" role="status"></div>',
    '<div class="journey-capture-fields">',
    '<label>Parent name<input id="journeyCaptureParent" type="text" autocomplete="off" placeholder="Not provided"></label>',
    '<label>Child name<input id="journeyCaptureChild" type="text" autocomplete="off" placeholder="Not provided"></label>',
    '<label>Age — years<input id="journeyCaptureAgeYears" type="number" min="0" max="12" placeholder="—"></label>',
    '<label>Age — months<input id="journeyCaptureAgeMonths" type="number" min="0" max="11" placeholder="—"></label>',
    '<label class="journey-capture-wide">Address<input id="journeyCaptureAddress" type="text" placeholder="Not provided"></label>',
    '<label>Visit / trial date<input id="journeyCaptureDate" type="date"></label>',
    '<label>Visit / trial time<input id="journeyCaptureTime" type="time" step="300"></label>',
    '<label class="journey-capture-wide">Additional notes<textarea id="journeyCaptureNotes" rows="2" placeholder="Optional"></textarea></label>',
    '</div><p class="journey-capture-footnote">Missing details remain unfilled. Check the appointment date and time before saving.</p>',
    '<div class="journey-capture-actions"><button type="button" id="journeyCaptureCancel" class="journey-capture-cancel">Cancel</button><button type="button" id="journeyCaptureApplyVisit" class="journey-capture-apply">Fill Visit</button><button type="button" id="journeyCaptureApplyTrial" class="journey-capture-apply">Fill Free Trial</button></div>',
    '</section>'
  ].join('');
  document.body.appendChild(captureOverlay);
  const captureButton=document.getElementById('journeyFillSchedule'),captureRaw=document.getElementById('journeyCaptureRaw'),captureSource=document.getElementById('journeyCaptureSource'),captureNotice=document.getElementById('journeyCaptureNotice');
  const captureFields={parent:'journeyCaptureParent',child:'journeyCaptureChild',ageYears:'journeyCaptureAgeYears',ageMonths:'journeyCaptureAgeMonths',address:'journeyCaptureAddress',date:'journeyCaptureDate',time:'journeyCaptureTime',notes:'journeyCaptureNotes'};
  let captureJourneyId=0,captureLastFocus=null,captureDraggedText='';
  /*   Anchor review to the left Visit / Free Trial form, leaving Conversation usable*/
  const captureDialog=captureOverlay.querySelector('.journey-capture-dialog');
  function positionCaptureReview(){
    if(captureOverlay.hidden)return;
    const card=document.getElementById('scheduleActionCard');
    const rect=card.getBoundingClientRect(),margin=9;
    const width=Math.max(240,Math.min(rect.width,window.innerWidth-margin*2));
    const left=Math.max(margin,Math.min(rect.left,window.innerWidth-margin-width));
    const top=Math.max(margin,Math.min(rect.top,window.innerHeight-margin-180));
    const maxHeight=Math.max(180,Math.min(rect.bottom-top,window.innerHeight-top-margin));
    captureDialog.style.left=left+'px';
    captureDialog.style.top=top+'px';
    captureDialog.style.width=width+'px';
    captureDialog.style.maxHeight=maxHeight+'px';
  }
  window.addEventListener('resize',positionCaptureReview);
  document.querySelector('#journeyPanel .journey-panel-main')?.addEventListener('scroll',positionCaptureReview,{passive:true});
  function captureField(key){return document.getElementById(captureFields[key]);}
  function closeCaptureReview(){captureOverlay.hidden=true;captureButton.classList.remove('is-drag-over');captureDraggedText='';captureJourneyId=0;if(captureLastFocus?.isConnected)captureLastFocus.focus({preventScroll:true});}
  function cleanCapturedValue(value){return String(value||'').trim().replace(/^[\s:–—\-]+/,'').replace(/[\s.!;]+$/,'').slice(0,180);}
  function extractCaptureDetails(source){
    const text=String(source||'').replace(/\r/g,'').trim(),out={parent:'',child:'',ageYears:'',ageMonths:'',address:'',classPreference:'',date:'',time:'',notes:''},warnings=[];
    if(!text)return {out,warnings};
    function labeled(pattern){const expression=new RegExp('(?:^|\\n)\\s*(?:[-•*]\\s*)?(?:\\d+[.)]\\s*)?(?:'+pattern+')\\s*[:\\-–]\\s*([^\\n]+)','im');const m=text.match(expression);return m?cleanCapturedValue(m[1]):'';}
    function natural(pattern){const m=text.match(pattern);return m?cleanCapturedValue(m[1].split(/\s+(?:and|pero|but|then|at|when|who)\s+/i)[0].split(/[.!?](?:\s|$)/)[0]):'';}
    out.parent=labeled("parent(?:'s)?\\s*(?:full\\s*)?name|name\\s*of\\s*parent|mother(?:'s)?\\s*name|father(?:'s)?\\s*name|parent|name")||natural(/\b(?:my name is|i am|i'm|ako po si|ako si)\s+([a-zÀ-ÿ][a-zÀ-ÿ' .-]{1,65})/i);
    out.child=labeled("child(?:'?s)?\\s*(?:full\\s*)?name|name\\s*of\\s*child|student(?:'s)?\\s*name|kid(?:'s)?\\s*name|child")||natural(/\b(?:my (?:son|daughter|child|baby|little one)(?:'s name)? is|my (?:son|daughter|child) is named|anak ko(?: po)? (?:si|ay si)|his name is|her name is)\s+([a-zÀ-ÿ][a-zÀ-ÿ' .-]{1,65})/i);
    const ageText=labeled("child(?:'s)?\\s*age|age(?:\\s*of\\s*child)?")||text;
    const both=ageText.match(/\b(\d{1,2})\s*(?:years?|yrs?|yo|taon)\s*(?:and\s*)?(\d{1,2})\s*(?:months?|mos?|buwan)\b/i);
    const years=ageText.match(/\b(\d{1,2})\s*(?:years?|yrs?|yo|taon)(?:\s*old)?\b/i),months=ageText.match(/\b(\d{1,2})\s*(?:months?|mos?|buwan)(?:\s*old)?\b/i);
    if(both){out.ageYears=both[1];out.ageMonths=both[2];}
    else if(years){out.ageYears=years[1];out.ageMonths='0';}
    else if(months){const n=Number(months[1]);out.ageYears=String(Math.floor(n/12));out.ageMonths=String(n%12);}
    else if(ageText!==text&&/^\d{1,2}$/.test(ageText.trim())){out.ageYears=ageText.trim();out.ageMonths='0';}
    if(out.ageYears&&Number(out.ageYears)>12){out.ageYears='';out.ageMonths='';warnings.push('Child age needs checking');}
    out.address=labeled("address|home\\s*address|location\\s*of\\s*parent|residential\\s*address")||natural(/\b(?:we (?:live|are living) (?:in|at)|we(?:'re| are) from|taga(?:\\s+po)?(?:\\s+kami)?(?:\\s+sa)?)\s+([^\n.!?]{3,110})/i);
    const city=labeled("city|town|municipality");
    if(city&&!out.address.toLowerCase().includes(city.toLowerCase()))out.address=out.address?out.address+', '+city:city;
    out.classPreference=labeled("preferred\\s*(?:class\\s*)?(?:schedule|session|time)|class\\s*preference|preferred\\s*class|session\\s*interested\\s*in|class\\s*schedule|schedule")||natural(/\b((?:morning|afternoon|evening)\s*(?:classes?|sessions?|sana)?)\b/i);
    /*   short Messenger answers may have no labels; infer only a known 4–8 line layout*/
    const lines=text.split('\n').map(x=>x.trim().replace(/^(?:\d+\s*[.):]\s*|[•*]\s*)/,'').trim()).filter(Boolean);
    const hasLabels=lines.some(x=>/^(?:parent|name|child|kid|student|age|address|city|preferred|visit|trial|appointment|schedule|session|notes)\b[^:\n]{0,26}[:\-–]/i.test(x));
    const isAge=x=>/^\d{1,2}(?:\s*(?:years?|yrs?|months?|mos?|yo))?$/i.test(x||'');
    let positionalDate='';
    if(!hasLabels&&lines.length>=4&&lines.length<=8){
      let ageIndex=-1,citySeparate=false;
      if(lines.length>=5&&isAge(lines[4])&&/(\d|street|st\b|road|rd\b|barangay|brgy|subdivision|village)/i.test(lines[1])){ageIndex=4;citySeparate=true;}
      else if(isAge(lines[3]))ageIndex=3;
      if(ageIndex>=0){
        if(!out.parent)out.parent=cleanCapturedValue(lines[0]);
        if(!out.child)out.child=cleanCapturedValue(lines[ageIndex-1]);
        if(!out.address)out.address=cleanCapturedValue(lines[1]+(citySeparate?', '+lines[2]:''));
        const age=lines[ageIndex].match(/^(\d{1,2})\s*(months?|mos?|years?|yrs?|yo)?$/i);
        if(age){const n=Number(age[1]);if(/^(?:months?|mos?)$/i.test(age[2]||'')){out.ageYears=String(Math.floor(n/12));out.ageMonths=String(n%12);}else if(n<=12){out.ageYears=String(n);out.ageMonths='0';}else warnings.push('Check child age');}
        const extra=lines.slice(ageIndex+1);
        const dated=extra.find(x=>/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b|\b20\d{2}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]20\d{2}\b/i.test(x));
        if(dated)positionalDate=dated;
        if(!out.classPreference){const preference=extra.find(x=>/\b(?:morning|afternoon|evening)\b/i.test(x));if(preference)out.classPreference=cleanCapturedValue(preference);}
        warnings.push('Matched answers by line order — please verify');
      }
    }
    let dateText=labeled("(?:preferred\\s*)?(?:visit|trial|appointment)\\s*date|date\\s*(?:of\\s*)?(?:visit|trial)|preferred\\s*date"),timeText=labeled("(?:preferred\\s*)?(?:visit|trial|appointment)\\s*time|time\\s*(?:of\\s*)?(?:visit|trial)|preferred\\s*time");
    if(!dateText)dateText=positionalDate||text;
    if(!timeText)timeText=positionalDate||text;
    const iso=dateText.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    let stamp=null;
    if(iso){stamp=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]));if(stamp.getMonth()!==Number(iso[2])-1||stamp.getDate()!==Number(iso[3]))stamp=null;}
    if(!stamp){
      const mn=dateText.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i);
      if(mn){const monthsList=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const mi=monthsList.indexOf(mn[1].slice(0,3).toLowerCase());const now=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Manila'}));let y=mn[3]?Number(mn[3]):now.getFullYear();stamp=new Date(y,mi,Number(mn[2]));if(stamp.getMonth()!==mi||stamp.getDate()!==Number(mn[2]))stamp=null;else if(!mn[3]){if(stamp<new Date(now.getFullYear(),now.getMonth(),now.getDate()))stamp.setFullYear(y+1);warnings.push('Year inferred from '+mn[1]+' '+mn[2]+' — please confirm');}}
    }
    if(!stamp){
      const numeric=dateText.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
      if(numeric){const a=Number(numeric[1]),b=Number(numeric[2]);if(a>12&&b<=12){stamp=new Date(Number(numeric[3]),b-1,a);}else{warnings.push('Numeric date is ambiguous — choose date manually');}}
    }
    if(!stamp&&(positionalDate||/\b(?:visit|trial|appointment|date)\b/i.test(text))){
      const day=dateText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if(day){const names=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],today=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Manila'})),delta=(names.indexOf(day[1].toLowerCase())-today.getDay()+7)%7||7;stamp=new Date(today.getFullYear(),today.getMonth(),today.getDate()+delta);warnings.push('Date interpreted as next '+day[1]+' — please confirm');}
    }
    if(stamp&&Number.isFinite(stamp.getTime())){out.date=[stamp.getFullYear(),String(stamp.getMonth()+1).padStart(2,'0'),String(stamp.getDate()).padStart(2,'0')].join('-');}
    const tm=timeText.match(/\b(1[0-2]|0?[1-9])(?::(\d{2}))?\s*(am|pm)\b/i);
    if(tm){let h=Number(tm[1])%12;if(tm[3].toLowerCase()==='pm')h+=12;const minute=Number(tm[2]||0);if(minute<60){out.time=String(h).padStart(2,'0')+':'+String(minute).padStart(2,'0');if(minute%5!==0)warnings.push('Time is not on a 5-minute interval — adjust in review');}}
    out.notes=labeled("notes|other\\s*details|additional\\s*information|remarks");
    return {out,warnings};
  }
  function extractIntoCapture(){
    const parsed=extractCaptureDetails(captureRaw.value);
    Object.keys(captureFields).forEach(key=>{captureField(key).value=parsed.out[key]||'';});
    const found=Object.values(parsed.out).filter(Boolean).length;
    captureNotice.textContent=found?found+' details found. Review and correct before applying.':'No details recognized. You can fill the fields yourself.';
    if(parsed.warnings.length)captureNotice.textContent+=' '+parsed.warnings.join('. ');
  }
  function openCaptureReview(source){
    if(!demo.journeyId||!['inquiry','inquiry-followup'].includes(panel.dataset.stage))return;
    captureLastFocus=document.activeElement;
    captureJourneyId=Number(demo.journeyId);
    captureOverlay.hidden=false;
    positionCaptureReview();
    captureRaw.value=String(source||'').trim();
    captureSource.hidden=true;captureSource.open=false;
    Object.keys(captureFields).forEach(key=>{captureField(key).value='';});
    captureNotice.textContent='Enter the details shown in Conversation, then choose Visit or Free Trial.';
    captureField('parent').focus();
  }
  function mergeCapturedNotes(original,addition){
    const rows=String(original||'').split('\n').map(x=>x.trim()).filter(Boolean);
    String(addition||'').split('\n').map(x=>x.trim()).filter(Boolean).forEach(line=>{if(!rows.some(existing=>existing.toLowerCase()===line.toLowerCase()))rows.push(line);});
    return rows.join('\n');
  }
  function applyCapturedSchedule(kind){
    if(captureOverlay.hidden||Number(demo.journeyId)!==captureJourneyId)return;
    if(!lockOwned||lockPending||lockJourneyId!==captureJourneyId){captureNotice.textContent='You need control of this journey before applying details';return;}
    const values=Object.fromEntries(Object.keys(captureFields).map(k=>[k,captureField(k).value.trim()]));
    if(!Object.values(values).some(Boolean)){captureNotice.textContent='Add or extract at least one detail first';return;}
    if(values.ageYears!==''&&(!/^\d+$/.test(values.ageYears)||Number(values.ageYears)>12)){captureNotice.textContent='Check the age in years';return;}
    if(values.ageMonths!==''&&(!/^\d+$/.test(values.ageMonths)||Number(values.ageMonths)>11)){captureNotice.textContent='Check the age in months';return;}
    if(values.time&&Number(values.time.slice(3))%5!==0){captureNotice.textContent='Choose a time in 5-minute intervals';return;}
    const fieldMap={parent:'scheduleParent',child:'scheduleChild',ageYears:'scheduleAgeYears',ageMonths:'scheduleAgeMonths',date:'scheduleDate'};
    Object.entries(fieldMap).forEach(([key,id])=>{document.getElementById(id).value=values[key];});
    const hour=document.getElementById('scheduleHour'),minute=document.getElementById('scheduleMinute'),period=document.getElementById('schedulePeriod');
    if(!hour.querySelector('option[value=""]')){const blank=new Option('—','');hour.prepend(blank);}
    if(values.time){const h=Number(values.time.slice(0,2));hour.value=String(h%12||12);minute.value=values.time.slice(3);period.value=h>=12?'PM':'AM';}
    else{hour.value='';minute.value='00';period.value='AM';}
    /*   The admin decides the available session; do not change that selection*/
    let note=values.notes;
    if(values.address)note=mergeCapturedNotes(note,'Address: '+values.address);
    document.getElementById('scheduleNotes').value=mergeCapturedNotes(document.getElementById('scheduleNotes').value,note);
    const chosen=document.querySelector('input[name="visitType"][value="'+kind+'"]');chosen.checked=true;chosen.dispatchEvent(new Event('change',{bubbles:true}));
    closeCaptureReview();
    document.getElementById('scheduleForm').scrollIntoView({block:'nearest',behavior:'smooth'});
    document.getElementById('scheduleParent').focus({preventScroll:true});
  }
  captureButton.addEventListener('click',()=>openCaptureReview(''));
  captureButton.title='Enter parent details manually while reading the conversation';
  captureButton.addEventListener('dragenter',e=>{e.preventDefault();captureButton.classList.add('is-drag-over');});
  captureButton.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';captureButton.classList.add('is-drag-over');});
  captureButton.addEventListener('dragleave',e=>{if(!captureButton.contains(e.relatedTarget))captureButton.classList.remove('is-drag-over');});
  captureButton.addEventListener('drop',e=>{e.preventDefault();captureButton.classList.remove('is-drag-over');const text=e.dataTransfer.getData('text/plain')||captureDraggedText||String(window.getSelection()||'');captureDraggedText='';openCaptureReview(text);});
  conversationList.addEventListener('dragstart',e=>{const selection=window.getSelection(),origin=selection?.anchorNode?.parentElement||null;captureDraggedText=origin?.closest('.journey-message-row.incoming')&&selection?selection.toString().trim():'';if(captureDraggedText)e.dataTransfer.setData('text/plain',captureDraggedText);});
  captureOverlay.addEventListener('click',e=>{if(e.target===captureOverlay)closeCaptureReview();});
  document.getElementById('journeyCaptureCancel').addEventListener('click',closeCaptureReview);
  document.getElementById('journeyCaptureClose').addEventListener('click',closeCaptureReview);
  document.getElementById('journeyCaptureExtract').addEventListener('click',extractIntoCapture);
  document.getElementById('journeyCaptureApplyVisit').addEventListener('click',()=>applyCapturedSchedule('visit'));
  document.getElementById('journeyCaptureApplyTrial').addEventListener('click',()=>applyCapturedSchedule('trial'));
  captureOverlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeCaptureReview();}});

  function setScheduleMode(mode){
    const isMessage=mode==='message',isEnroll=mode==='enroll',isAppointment=!isMessage&&!isEnroll;
    const appointment=document.getElementById('scheduleAppointmentFields');
    const message=document.getElementById('parentMessageFields');
    const enroll=document.getElementById('directEnrollFields');
    appointment.hidden=!isAppointment;message.hidden=!isMessage;enroll.hidden=!isEnroll;
    appointment.querySelectorAll('input,select,textarea').forEach(control=>control.disabled=!isAppointment);
    message.querySelectorAll('input,select,textarea').forEach(control=>control.disabled=!isMessage);
    enroll.querySelectorAll('input,select,textarea').forEach(control=>control.disabled=!isEnroll);
    document.getElementById('directEnrollError').hidden=true;
    const saveButton=document.getElementById('saveScheduleButton');saveButton.textContent=isMessage?'Save to Stage 1A':isEnroll?'Confirm Enrolled':'Save Schedule';saveButton.dataset.action=isMessage?'saveParentMessageButton':isEnroll?'confirmEnrollmentButton':'saveScheduleButton';
  }
  async function open(row){closeCaptureReview();if(lockOwned&&lockJourneyId!==Number(row.dataset.journeyId))await releaseHeldLock();if(!lockOwned){lockMessage('Checking availability…');updateLockControls();}resetReplyAssistance();resetManualComposer();loadReplyQuestions();demo.facebookName=row.querySelector('.card-top strong')?.textContent.trim()||'Parent';demo.location=row.dataset.franchise||'';demo.franchiseId=Number(row.dataset.franchiseId)||null;demo.journeyId=Number(row.dataset.journeyId)||null;updateLockControls();demo.stage=row.closest('.journey-column')?.querySelector('h3')?.textContent.trim()||'Inquiry';panel.dataset.stage=row.closest('.journey-column')?.dataset.stage||'inquiry';setActionDockStage(panel.dataset.stage);setQuickGuide(panel.dataset.stage);demo.status=row.querySelector('.priority')?.textContent.trim()||'Active';demo.next=row.querySelector('.card-next span')?.textContent.trim()||'None';stage2State=null;document.getElementById('journeyParentName').textContent=demo.facebookName;document.getElementById('journeyLocation').textContent=`${demo.location} · Facebook: ${demo.facebookName}`;document.getElementById('journeyChildName').textContent='';document.getElementById('journeyChildName').hidden=true;document.getElementById('journeyStage').textContent=friendlyStage(panel.dataset.stage||demo.stage);document.getElementById('journeyStatus').textContent=friendlyStatus(demo.status);document.getElementById('journeyNextAction').textContent=friendlyNext(demo.next,panel.dataset.stage||demo.stage);document.getElementById('scheduledWhere').textContent=demo.location;document.getElementById('scheduleActionCard').hidden=!['inquiry','inquiry-followup'].includes(panel.dataset.stage);document.getElementById('handoffCard').hidden=true;document.getElementById('enrollmentActionCard').hidden=true;document.getElementById('undoEnrollmentConfirm').hidden=true;document.getElementById('undoEnrollmentConfirm').style.display='none';document.getElementById('undoEnrollmentError').hidden=true;document.getElementById('undoEnrollmentNote').value='';document.getElementById('undoEnrollmentButton').hidden=false;document.getElementById('undoEnrollmentButton').disabled=false;document.getElementById('waitingBlock').hidden=true;document.getElementById('franchiseResultBlock').hidden=true;document.getElementById('franchiseResultNote').value='';document.getElementById('franchiseResultError').hidden=true;document.getElementById('stage2UpdateBlock').hidden=true;document.getElementById('rescheduleForm').hidden=true;document.getElementById('rescheduleForm').style.display='none';document.getElementById('cancelAppointmentForm').hidden=true;document.getElementById('cancelAppointmentForm').style.display='none';document.getElementById('cancelAppointmentNote').value='';setStage4DockDisabled(true);document.getElementById('enrolledForm').hidden=true;document.getElementById('enrolledForm').style.display='none';document.getElementById('enrolledNote').value='';document.getElementById('followUpLaterForm').hidden=true;document.getElementById('followUpLaterForm').style.display='none';document.getElementById('followUpNote').value='';document.getElementById('notInterestedForm').hidden=true;document.getElementById('notInterestedForm').style.display='none';document.getElementById('notInterestedNote').value='';setFollowUpDefaults();document.getElementById('markFranchiseSent').hidden=false;document.getElementById('cancelAppointment').hidden=false;document.getElementById('rescheduleAppointment').hidden=false;document.getElementById('cancelReschedule').hidden=false;document.querySelector('#rescheduleForm button[type="submit"]').textContent='Save New Schedule';document.getElementById('handoffDetailsToggle').hidden=true;document.getElementById('handoffDetailsToggle').setAttribute('aria-expanded','false');document.getElementById('copyMessageBlock').hidden=true;document.getElementById('franchiseHandoffActions').hidden=false;document.getElementById('copyFranchiseMessage').hidden=false;document.getElementById('handoffStatus').hidden=false;document.getElementById('handoffKicker').textContent='Franchise Handoff';document.getElementById('appointmentActionLabel').textContent='Update appointment';document.getElementById('handoffStatus').textContent='Ready to send';document.getElementById('scheduleForm').reset();document.getElementById('parentMessageNote').value='';document.getElementById('directEnrollNote').value='';document.getElementById('directEnrollError').hidden=true;setScheduleDefaults();setScheduleMode('trial');buildInitialTimeline(row);panel.classList.add('open');startConversationRefresh(Number(row.dataset.inquiryId)||0);panel.setAttribute('aria-hidden','false');backdrop.hidden=false;if(!lockOwned&&!lockPending)takeControlButton.click();if(['inquiry','inquiry-followup'].includes(panel.dataset.stage)){if(!demo.franchiseId)demo.franchiseId=await resolveFranchiseId(demo.location);if(demo.franchiseId)loadSessions(demo.franchiseId);else document.getElementById('scheduleSession').innerHTML='<option value="0">None</option>';await loadInquiryDetail();}else if(demo.stage==='Scheduled'){await loadStage2Detail();}else if(demo.stage==='Follow-up / Decision'){await loadFollowUpDetail();}else if(demo.stage==='Enrollment'){await loadEnrollmentDetail();}usageEvent('journey_opened',{module:'journey_panel',action:'open',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0,stage:demo.stage,status:demo.status});}
  function close(){closeCaptureReview();if(lockOwned)releaseHeldLock();else {++lockGeneration;stopLockRenewal();}stopConversationRefresh();panel.classList.remove('open');panel.setAttribute('aria-hidden','true');backdrop.hidden=true;}
  function bindJourneyCard(row){if(!row||row.dataset.journeyBound==='true')return;row.dataset.journeyBound='true';row.style.cursor='pointer';row.addEventListener('click',()=>open(row));}
  document.querySelectorAll('.work-row').forEach(bindJourneyCard);
  window.addEventListener('journey-card-added',event=>bindJourneyCard(event.detail?.row));
  window.addEventListener('journey-sync-refresh',async()=>{if(!panel.classList.contains('open')||!demo.journeyId)return;const row=[...document.querySelectorAll('.journey-card')].find(card=>Number(card.dataset.journeyId)===Number(demo.journeyId));if(row)await open(row);else close();});
  document.getElementById('closeJourneyPanel').addEventListener('click',close);backdrop.addEventListener('click',close);document.getElementById('journeyQuickGuideButton').addEventListener('click',()=>toggleQuickGuide());document.getElementById('journeyQuickGuideLanguage').addEventListener('click',switchQuickGuideLanguage);document.getElementById('closeJourneyQuickGuide').addEventListener('click',()=>toggleQuickGuide(false));
  document.getElementById('handoffDetailsToggle').addEventListener('click',()=>{const toggle=document.getElementById('handoffDetailsToggle');const block=document.getElementById('copyMessageBlock');const expanded=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',expanded?'false':'true');block.hidden=expanded;});
  document.getElementById('undoEnrollmentButton').addEventListener('click',()=>{const confirmBox=document.getElementById('undoEnrollmentConfirm');document.getElementById('undoEnrollmentError').hidden=true;confirmBox.hidden=false;confirmBox.style.display='';document.getElementById('undoEnrollmentButton').disabled=true;confirmBox.scrollIntoView({behavior:'smooth',block:'nearest'});});
  document.getElementById('cancelUndoEnrollment').addEventListener('click',()=>{document.getElementById('undoEnrollmentConfirm').hidden=true;document.getElementById('undoEnrollmentConfirm').style.display='none';document.getElementById('undoEnrollmentError').hidden=true;document.getElementById('undoEnrollmentNote').value='';document.getElementById('undoEnrollmentButton').disabled=false;});
  document.getElementById('confirmUndoEnrollment').addEventListener('click',async()=>{if(!demo.journeyId)return;const button=document.getElementById('confirmUndoEnrollment');const errorBox=document.getElementById('undoEnrollmentError');const note=document.getElementById('undoEnrollmentNote').value.trim();if(!note){errorBox.textContent='Please enter the reason for undoing this enrollment.';errorBox.hidden=false;return;}button.disabled=true;button.textContent='Undoing...';errorBox.hidden=true;try{const response=await fetch(`${API}/ad_journey_undo_enrollment`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,note})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to undo enrollment.');const updatedJourney=data.updated_journey||data.ad_journey||data.journey||null;if(!updatedJourney||String(updatedJourney.current_stage||'').toLowerCase()==='enrollment'||updatedJourney.enrolled===true)throw new Error('Enrollment history was updated, but the journey did not return to its previous stage.');usageEvent('enrollment_reverted',{module:'journey_panel',action:'undo',target:'journey',journey_id:demo.journeyId,franchise_id:Number(updatedJourney.franchise_id)||demo.franchiseId||0});if(typeof loadBoard==='function')await loadBoard();close();}catch(error){errorBox.textContent=error.message;errorBox.hidden=false;}finally{button.disabled=false;button.textContent='Confirm Undo';}});
  document.getElementById('scheduleForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const type=document.querySelector('input[name="visitType"]:checked').value;
    const saveButton=document.getElementById('saveScheduleButton');
    if(type==='message'){
      if(!demo.journeyId)return;
      const note=document.getElementById('parentMessageNote').value.trim()||'Follow-up message sent to parent.';
      saveButton.disabled=true;saveButton.textContent='Saving...';
      try{
        const response=await fetch(`${API}/ad_journey_parent_message`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,note})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to record parent message.');
        panel.dataset.stage='inquiry-followup';setActionDockStage('inquiry-followup');setQuickGuide('inquiry-followup');
        document.getElementById('journeyStage').textContent='Active Conversation';
        document.getElementById('journeyStatus').textContent='Active Conversation';
        document.getElementById('journeyNextAction').textContent='Continue Conversation';
        document.getElementById('parentMessageNote').value='';
        addTimeline('Message sent to parent',note);
        usageEvent('parent_message_sent',{module:'journey_panel',action:'message',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0});
        if(typeof loadBoard==='function')await loadBoard();
        await loadInquiryDetail();
        setScheduleMode('message');
      }catch(error){alert(error.message);}
      finally{saveButton.disabled=false;saveButton.textContent='Save to Stage 1A';}
      return;
    }
    if(type==='enroll'){
      if(!demo.journeyId)return;
      const note=document.getElementById('directEnrollNote').value.trim()||'Enrollment reported directly from inquiry.';
      const errorBox=document.getElementById('directEnrollError');
      saveButton.disabled=true;saveButton.textContent='Saving...';errorBox.hidden=true;
      try{
        const response=await fetch(`${API}/ad_journey_enrolled_stage1`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,note})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to record enrollment.');
        usageEvent('enrollment_reported',{module:'journey_panel',action:'enrolled_from_inquiry',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0});
        if(typeof loadBoard==='function')await loadBoard();
        close();
      }catch(error){errorBox.textContent=error.message;errorBox.hidden=false;}
      finally{saveButton.disabled=false;saveButton.textContent='Confirm Enrolled';}
      return;
    }
    const parent=document.getElementById('scheduleParent').value.trim();
    const sessionSelect=document.getElementById('scheduleSession');
    const session=sessionSelect.options[sessionSelect.selectedIndex]?.text||'None';
    const date=document.getElementById('scheduleDate').value;
    const time=getSelectedTime();
    const child=document.getElementById('scheduleChild').value.trim();
    const ageYears=document.getElementById('scheduleAgeYears').value;
    const ageMonths=document.getElementById('scheduleAgeMonths').value;
    const notes=document.getElementById('scheduleNotes').value.trim();
    if(!parent||sessionSelect.value===''||!date||!time||!child||!demo.journeyId)return;
    const typeLabel=type==='trial'?'Free Trial':'Visit';
    const age=formatAge(ageYears,ageMonths);
    const scheduledFor=new Date(`${date}T${time}:00`).getTime();
    saveButton.disabled=true;saveButton.textContent='Saving...';
    try{
      const response=await fetch(`${API}/ad_journey_schedule`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,schedule_type:type,scheduled_for:scheduledFor,session_id:Number(sessionSelect.value),note:notes,parent_name:parent,child_name:child,age_years:ageYears===''?0:Number(ageYears),age_months:ageMonths===''?0:Number(ageMonths),session_name:session})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to save schedule.');
      /*   Prepare parent confirmation from the successfully saved schedule */
      const rows=['👩 Parent: '+parent,'👧 Child: '+child,'🎂 Age: '+age,'📅 Date: '+formatDate(date),'🕘 Time: '+formatTime(time)].join('\n');
      replyManualMode=true;replyQuestionId=0;replyTemplateId=0;replyQuickFormActive=true;replySavedSuggestion=null;
      replyQuickFormDrafts={
        taglish:'Hi po! ❤️ Thank you for sending your details.\n\nConfirmed na po ang '+(type==='trial'?'free trial':'visit')+' schedule ng little one ninyo! 🌷\n\n'+rows+'\n\nSee you po! 💕',
        english:'Hi! ❤️ Thank you for sending your details.\n\nYour little one’s '+(type==='trial'?'free trial':'visit')+' is confirmed! 🌷\n\n'+rows+'\n\nWe look forward to seeing you! 💕'
      };
      replyLanguage.value='taglish';renderReplyLanguageButton();replyEditor.value=replyQuickFormDrafts.taglish;
      replyMatchLabel.textContent='Appointment confirmation · Review before sending';
      replyStatus.textContent='Schedule saved. Copy & Record Sent, then send the confirmation through Messenger.';
      showReplyMode();renderReplyOptions();renderReplySearch();updateReplyButton();
      stage2State={scheduledFor,typeLabel,parent,child,age,franchiseSent:false,cancelled:false};parentConfirmationState=false;
      window.dispatchEvent(new CustomEvent('ad-parent-form-scheduled',{detail:{ad_journey_id:Number(demo.journeyId)}}));
      document.getElementById('journeyParentName').textContent=parent;panel.dataset.stage='scheduled';setActionDockStage('scheduled');setQuickGuide('scheduled');
      document.getElementById('journeyStage').textContent='Appointment Scheduled';
      document.getElementById('journeyStatus').textContent=type==='trial'?'Free Trial Scheduled':'Visit Scheduled';
      document.getElementById('journeyNextAction').textContent='Send Details to Franchise';
      document.getElementById('handoffTitle').textContent=`${typeLabel} Scheduled`;
      document.getElementById('handoffDetailsLabel').textContent=`${typeLabel} Details`;
      document.getElementById('handoffDetailsToggle').hidden=true;
      document.getElementById('handoffDetailsToggle').setAttribute('aria-expanded','true');
      document.getElementById('copyMessageBlock').hidden=false;
      document.getElementById('stage2DockSend').hidden=false;
      document.getElementById('stage2DockActions').style.gridTemplateColumns='repeat(4,minmax(0,1fr))';
      document.getElementById('scheduledWhen').textContent=`${formatDate(date)} · ${formatTime(time)}`;
      document.getElementById('franchiseMessage').textContent=buildFranchiseMessage({typeLabel,parent,facebook:demo.facebookName,child,age,session,scheduledFor,notes});
      document.getElementById('scheduleActionCard').hidden=true;
      document.getElementById('handoffCard').hidden=false;
      document.getElementById('stage2UpdateBlock').hidden=false;
      showParentConfirmationGate();
      addTimeline(`${typeLabel} scheduled`,`${formatDate(date)} · ${formatTime(time)} · ${session}`);
      usageEvent('schedule_saved',{module:'journey_panel',action:'save',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0,schedule_type:type,session_id:Number(sessionSelect.value),scheduled_for:scheduledFor});
      if(typeof loadBoard==='function')await loadBoard();
    }catch(error){alert(error.message);}
    finally{saveButton.disabled=false;saveButton.textContent='Save Schedule';}
  });
  document.getElementById('copyFranchiseMessage').addEventListener('click',async()=>{await navigator.clipboard.writeText(document.getElementById('franchiseMessage').textContent);document.getElementById('copyFranchiseMessage').textContent='Copied';setTimeout(()=>document.getElementById('copyFranchiseMessage').textContent='Copy Message',1200);});
  document.getElementById('markFranchiseSent').addEventListener('click',async()=>{if(parentConfirmationState!==true)return;const button=document.getElementById('markFranchiseSent');if(!demo.journeyId)return;button.disabled=true;button.textContent='Saving...';try{const response=await fetch(`${API}/ad_journey_franchise_sent`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,note:`Sent ${stage2State?.typeLabel||'appointment'} details to franchise`})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to mark details as sent.');document.getElementById('journeyStage').textContent='Appointment Scheduled';document.getElementById('journeyStatus').textContent='Details Sent to Franchise';document.getElementById('journeyNextAction').textContent='Wait for Visit / Free Trial';document.getElementById('handoffStatus').textContent='Sent';button.hidden=true;document.getElementById('stage2DockSend').hidden=true;document.getElementById('stage2DockActions').style.gridTemplateColumns='repeat(3,minmax(0,1fr))';const dueAt=Number(data.ad_journey_event?.due_at)||0;document.getElementById('expectedUpdateTime').textContent=formatDateTime(dueAt);document.getElementById('waitingBlock').hidden=false;addTimeline('Details sent to franchise',`Update expected ${formatDateTime(dueAt)}`);usageEvent('franchise_details_sent',{module:'journey_panel',action:'send',target:'journey',journey_id:demo.journeyId,franchise_id:Number(data.ad_journey?.franchise_id)||demo.franchiseId||0,scheduled_for:Number(data.ad_journey_event?.scheduled_for)||0,due_at:dueAt,status:'sent_to_franchise'});if(typeof loadBoard==='function')await loadBoard();}catch(error){alert(error.message);}finally{button.disabled=false;button.textContent='Mark as Sent';}});
  document.querySelectorAll('.franchise-result-button').forEach(button=>button.addEventListener('click',async()=>{if(!demo.journeyId)return;const note=document.getElementById('franchiseResultNote').value.trim();const errorBox=document.getElementById('franchiseResultError');if(!note){errorBox.textContent='Add the franchise result note first.';errorBox.hidden=false;return;}const resultType=button.dataset.result;const original=button.textContent;button.disabled=true;button.textContent='Saving...';errorBox.hidden=true;try{const endpoint=resultType==='enrolled'?'ad_journey_enrolled_stage4':'ad_journey_result_stage';const payload=resultType==='enrolled'?{journey_id:demo.journeyId,note}:{journey_id:demo.journeyId,result_type:resultType,note};const response=await fetch(`${API}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify(payload)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||data.detail||(resultType==='enrolled'?'Unable to record enrollment.':'Unable to save franchise result.'));if(resultType==='enrolled')usageEvent('enrollment_reported',{module:'journey_panel',action:'enrolled_from_franchise_result',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0});else usageEvent('franchise_result_saved',{module:'journey_panel',action:'result',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0,result_type:resultType});if(typeof loadBoard==='function')await loadBoard();close();}catch(error){errorBox.textContent=error.message;errorBox.hidden=false;}finally{button.disabled=false;button.textContent=original;}}));
  document.getElementById('rescheduleAppointment').addEventListener('click',()=>{if(!stage2State)return;document.getElementById('cancelAppointmentForm').hidden=true;document.getElementById('cancelAppointmentForm').style.display='none';const form=document.getElementById('rescheduleForm');form.hidden=false;form.style.display='';form.scrollIntoView({behavior:'smooth',block:'nearest'});});
  document.getElementById('cancelReschedule').addEventListener('click',()=>{const form=document.getElementById('rescheduleForm');form.hidden=true;form.style.display='none';if(demo.stage==='Follow-up / Decision')document.getElementById('notInterestedAction').hidden=false;setStage4DockDisabled(false);});
  document.getElementById('cancelAppointment').addEventListener('click',()=>{if(!stage2State)return;const rescheduleForm=document.getElementById('rescheduleForm');rescheduleForm.hidden=true;rescheduleForm.style.display='none';const form=document.getElementById('cancelAppointmentForm');form.hidden=false;form.style.display='';form.scrollIntoView({behavior:'smooth',block:'nearest'});});
  document.getElementById('backCancelAppointment').addEventListener('click',()=>{const form=document.getElementById('cancelAppointmentForm');form.hidden=true;form.style.display='none';});
  document.getElementById('cancelAppointmentForm').addEventListener('submit',async e=>{e.preventDefault();if(!demo.journeyId||!stage2State)return;const note=document.getElementById('cancelAppointmentNote').value.trim();if(!note)return;const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Cancelling...';try{const response=await fetch(`${API}/ad_journey_cancel`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,note})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to cancel appointment.');usageEvent('appointment_cancelled',{module:'journey_panel',action:'cancel',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0});document.getElementById('cancelAppointmentForm').hidden=true;document.getElementById('cancelAppointmentForm').style.display='none';if(typeof loadBoard==='function')await loadBoard();close();}catch(error){alert(error.message);}finally{button.disabled=false;button.textContent='Confirm Cancel';}});
  document.getElementById('stage4EnrolledButton').addEventListener('click',()=>{setStage4DockDisabled(true);document.getElementById('rescheduleForm').hidden=true;document.getElementById('rescheduleForm').style.display='none';document.getElementById('followUpLaterForm').hidden=true;document.getElementById('followUpLaterForm').style.display='none';document.getElementById('notInterestedForm').hidden=true;document.getElementById('notInterestedForm').style.display='none';const form=document.getElementById('enrolledForm');form.hidden=false;form.style.display='';form.scrollIntoView({behavior:'smooth',block:'nearest'});});
  document.getElementById('backEnrolled').addEventListener('click',()=>{const form=document.getElementById('enrolledForm');form.hidden=true;form.style.display='none';document.getElementById('notInterestedAction').hidden=false;setStage4DockDisabled(false);});
  document.getElementById('enrolledForm').addEventListener('submit',async e=>{e.preventDefault();if(!demo.journeyId)return;const note=document.getElementById('enrolledNote').value.trim()||'Enrollment reported from Stage 4';const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Saving...';try{const response=await fetch(`${API}/ad_journey_enrolled_stage4`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,note})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to record enrollment.');usageEvent('enrollment_reported',{module:'journey_panel',action:'enrolled',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0});if(typeof loadBoard==='function')await loadBoard();close();}catch(error){alert(error.message);}finally{button.disabled=false;button.textContent='Confirm Enrolled';}});
  document.getElementById('stage4RescheduleButton').addEventListener('click',()=>{if(!stage2State)return;setStage4DockDisabled(true);document.getElementById('followUpLaterForm').hidden=true;document.getElementById('followUpLaterForm').style.display='none';document.getElementById('notInterestedForm').hidden=true;document.getElementById('notInterestedForm').style.display='none';const form=document.getElementById('rescheduleForm');form.hidden=false;form.style.display='';form.scrollIntoView({behavior:'smooth',block:'nearest'});});
  document.querySelectorAll('[data-follow-up-days]').forEach(button=>button.addEventListener('click',()=>{const days=Number(button.dataset.followUpDays);const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+days);const dateInput=document.getElementById('followUpDate');dateInput.value=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');document.querySelectorAll('[data-follow-up-days]').forEach(choice=>choice.classList.toggle('is-selected',choice===button));}));
  document.getElementById('followUpDate').addEventListener('input',()=>document.querySelectorAll('[data-follow-up-days]').forEach(button=>button.classList.remove('is-selected')));
  document.getElementById('followUpLaterButton').addEventListener('click',()=>{const rescheduleForm=document.getElementById('rescheduleForm');rescheduleForm.hidden=true;rescheduleForm.style.display='none';setStage4DockDisabled(true);const form=document.getElementById('followUpLaterForm');form.hidden=false;form.style.display='';form.scrollIntoView({behavior:'smooth',block:'nearest'});});
  document.getElementById('backFollowUpLater').addEventListener('click',()=>{const form=document.getElementById('followUpLaterForm');form.hidden=true;form.style.display='none';document.getElementById('notInterestedAction').hidden=false;setStage4DockDisabled(false);const rescheduleForm=document.getElementById('rescheduleForm');rescheduleForm.hidden=true;rescheduleForm.style.display='none';});
  document.getElementById('followUpLaterForm').addEventListener('submit',async e=>{e.preventDefault();if(!demo.journeyId)return;const date=document.getElementById('followUpDate').value;const time=getFollowUpTime();const note=document.getElementById('followUpNote').value.trim();if(!date||!time||!note)return;const followUpAt=new Date(`${date}T${time}:00`).getTime();const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Saving...';try{const response=await fetch(`${API}/ad_journey_parent_deciding`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,decision_status:document.getElementById('followUpDecisionStatus').value,follow_up_at:followUpAt,note})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to schedule follow-up.');usageEvent('follow_up_scheduled',{module:'journey_panel',action:'schedule',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0,follow_up_at:followUpAt});if(typeof loadBoard==='function')await loadBoard();close();}catch(error){alert(error.message);}finally{button.disabled=false;button.textContent='Save Follow-up';}});
  document.getElementById('notInterestedButton').addEventListener('click',()=>{const rescheduleForm=document.getElementById('rescheduleForm');rescheduleForm.hidden=true;rescheduleForm.style.display='none';setStage4DockDisabled(true);const form=document.getElementById('notInterestedForm');form.hidden=false;form.style.display='';form.scrollIntoView({behavior:'smooth',block:'nearest'});});
  document.getElementById('backNotInterested').addEventListener('click',()=>{const form=document.getElementById('notInterestedForm');form.hidden=true;form.style.display='none';document.getElementById('notInterestedAction').hidden=false;setStage4DockDisabled(false);const rescheduleForm=document.getElementById('rescheduleForm');rescheduleForm.hidden=true;rescheduleForm.style.display='none';});
  document.getElementById('notInterestedForm').addEventListener('submit',async e=>{e.preventDefault();if(!demo.journeyId)return;const note=document.getElementById('notInterestedNote').value.trim();if(!note)return;const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Closing...';try{const response=await fetch(`${API}/ad_journey_not_interested`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,note})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to close journey.');usageEvent('parent_not_interested',{module:'journey_panel',action:'close',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0});if(typeof loadBoard==='function')await loadBoard();close();}catch(error){alert(error.message);}finally{button.disabled=false;button.textContent='Confirm No Longer Interested';}});
  document.getElementById('rescheduleForm').addEventListener('submit',async e=>{e.preventDefault();if(!demo.journeyId||!stage2State)return;const sessionSelect=document.getElementById('rescheduleSession');const date=document.getElementById('rescheduleDate').value;const time=getRescheduleTime();const note=document.getElementById('rescheduleNote').value.trim();if(sessionSelect.value===''||!date||!time)return;const scheduledFor=new Date(`${date}T${time}:00`).getTime();const sessionName=sessionSelect.options[sessionSelect.selectedIndex]?.text||'None';const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Saving...';try{const response=await fetch(`${API}/ad_journey_reschedule`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${journeyToken}`},body:JSON.stringify({journey_id:demo.journeyId,scheduled_for:scheduledFor,session_id:Number(sessionSelect.value),session_name:sessionName,note})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||data.detail||'Unable to reschedule appointment.');usageEvent('appointment_rescheduled',{module:'journey_panel',action:'reschedule',target:'journey',journey_id:demo.journeyId,franchise_id:demo.franchiseId||0,session_id:Number(sessionSelect.value),scheduled_for:scheduledFor});document.getElementById('rescheduleForm').hidden=true;document.getElementById('rescheduleForm').style.display='none';if(typeof loadBoard==='function')await loadBoard();if(demo.stage==='Scheduled'){await loadStage2Detail();}else{close();}}catch(error){alert(error.message);}finally{button.disabled=false;button.textContent=demo.stage==='Follow-up / Decision'?'Reschedule':'Save New Schedule';}});
  async function loadInquiryDetail(){
    if(!demo.journeyId)return null;
    try{
      const response=await fetch(`${API}/ad_journey_detail?journey_id=${encodeURIComponent(demo.journeyId)}`,{headers:{Authorization:`Bearer ${journeyToken}`}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||data.error||'Unable to load journey details.');
      const journey=data.journey||{},inquiry=data.inquiry||{};
      const stageKey=String(journey.current_stage||'inquiry').toLowerCase()==='inquiry_follow_up'?'inquiry-followup':'inquiry';
      panel.dataset.stage=stageKey;setActionDockStage(stageKey);
      demo.stage=stageKey==='inquiry-followup'?'Awaiting Reply':'Inquiry';
      demo.status=journey.current_status||'new';
      demo.next=journey.next_action_type||'none';
      if(inquiry.facebook_name){demo.facebookName=inquiry.facebook_name;document.getElementById('journeyParentName').textContent=inquiry.facebook_name;document.getElementById('journeyLocation').textContent=`${demo.location} · Facebook: ${inquiry.facebook_name}`;}
      document.getElementById('journeyStage').textContent=friendlyStage(journey.current_stage||'inquiry');
      document.getElementById('journeyStatus').textContent=friendlyStatus(journey.current_status||'new');
      document.getElementById('journeyNextAction').textContent=friendlyNext(journey.next_action_type||'none',journey.current_stage||'inquiry');
      document.getElementById('scheduleActionCard').hidden=false;
      const events=Array.isArray(data.ad_journey_events)?[...data.ad_journey_events]:[];
      events.sort((a,b)=>(Number(b.event_at)||Number(b.created_at)||0)-(Number(a.event_at)||Number(a.created_at)||0));
      renderRealTimeline(events);
      return data;
    }catch(error){return null;}
  }
  async function loadStage2Detail(render=true){if(!demo.journeyId)return null;try{const response=await fetch(`${API}/ad_journey_detail?journey_id=${encodeURIComponent(demo.journeyId)}`,{headers:{Authorization:`Bearer ${journeyToken}`}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||'Unable to load journey details.');rebuildStage2(data,render);setRescheduleDefaults();document.getElementById('rescheduleNote').value=stage2State?.note||'';if(demo.franchiseId)await loadSessions(demo.franchiseId,'rescheduleSession',stage2State?.sessionId||0);else document.getElementById('rescheduleSession').innerHTML='<option value="0">None</option>';return data;}catch(error){document.getElementById('handoffCard').hidden=true;return null;}}
  async function loadFollowUpDetail(){const data=await loadStage2Detail(false);if(!stage2State||!data)return;const journey=data.journey||{};const status=journey.current_status||'';const cancelled=status==='cancelled';const noShow=status==='no_show';document.getElementById('handoffCard').hidden=false;document.getElementById('journeyStage').textContent='Parent Follow-up';document.getElementById('journeyStatus').textContent=cancelled?'Appointment Cancelled':noShow?'No Show':status==='follow_up_due'?'Follow-up Due':friendlyStatus(status||'follow_up_due');document.getElementById('journeyNextAction').textContent=journey.next_action_type==='follow_up_parent'?'Follow Up With Parent':friendlyNext(journey.next_action_type,'followup');document.getElementById('handoffKicker').textContent=cancelled?'Cancelled Appointment':noShow?'No Show':'Parent Follow-up';document.getElementById('handoffTitle').textContent=cancelled?'Appointment Cancelled':noShow?'Parent Did Not Attend':'Follow Up With Parent';document.getElementById('scheduledWhen').textContent=Number(journey.next_action_at)?`Follow-up scheduled · ${formatDateTime(journey.next_action_at)}`:`Previous appointment · ${formatDateTime(stage2State.scheduledFor)}`;document.getElementById('handoffStatus').hidden=true;document.getElementById('handoffDetailsLabel').textContent=`${stage2State.typeLabel} Details`;document.getElementById('handoffDetailsToggle').hidden=false;document.getElementById('handoffDetailsToggle').setAttribute('aria-expanded','false');document.getElementById('copyMessageBlock').hidden=true;document.getElementById('copyFranchiseMessage').hidden=true;document.getElementById('franchiseHandoffActions').hidden=true;document.getElementById('waitingBlock').hidden=true;document.getElementById('stage2UpdateBlock').hidden=false;document.getElementById('appointmentActionLabel').textContent='What happens next?';document.getElementById('rescheduleAppointment').hidden=true;document.getElementById('cancelAppointment').hidden=true;document.getElementById('cancelAppointmentForm').hidden=true;document.getElementById('cancelAppointmentForm').style.display='none';document.getElementById('rescheduleForm').hidden=true;document.getElementById('rescheduleForm').style.display='none';document.getElementById('cancelReschedule').hidden=false;document.querySelector('#rescheduleForm button[type="submit"]').textContent='Reschedule';document.getElementById('notInterestedAction').hidden=false;setStage4DockDisabled(false);document.getElementById('stage4EnrolledButton').hidden=false;document.getElementById('stage4EnrolledButton').textContent=(Array.isArray(data.ad_journey_events)&&data.ad_journey_events.some(event=>event.event_type==='enrollment_reverted'))?'Re-Enroll':'Enrolled';document.getElementById('enrolledForm').hidden=true;document.getElementById('enrolledForm').style.display='none';document.getElementById('notInterestedForm').hidden=true;document.getElementById('notInterestedForm').style.display='none';const events=Array.isArray(data.ad_journey_events)?[...data.ad_journey_events]:[];events.sort((a,b)=>(Number(b.event_at)||Number(b.created_at)||0)-(Number(a.event_at)||Number(a.created_at)||0));renderRealTimeline(events);}
  async function loadEnrollmentDetail(){if(!demo.journeyId)return;try{const response=await fetch(`${API}/ad_journey_detail?journey_id=${encodeURIComponent(demo.journeyId)}`,{headers:{Authorization:`Bearer ${journeyToken}`}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||'Unable to load journey details.');const journey=data.journey||{};const inquiry=data.inquiry||{};const events=Array.isArray(data.ad_journey_events)?[...data.ad_journey_events]:[];events.sort((a,b)=>(Number(b.event_at)||Number(b.created_at)||0)-(Number(a.event_at)||Number(a.created_at)||0));const enrollmentEvent=events.find(event=>event.event_type==='enrollment_reported');const appointment=events.find(event=>event.event_type==='rescheduled'||event.event_type==='trial_scheduled'||event.event_type==='visit_scheduled');const baseSchedule=events.find(event=>event.event_type==='trial_scheduled'||event.event_type==='visit_scheduled');const details={...(baseSchedule?.event_data&&typeof baseSchedule.event_data==='object'?baseSchedule.event_data:{}),...(appointment?.event_data&&typeof appointment.event_data==='object'?appointment.event_data:{})};const child=details.child_name||'';const parent=inquiry.facebook_name||demo.facebookName||'Parent';demo.facebookName=parent;demo.franchiseId=Number(journey.franchise_id)||demo.franchiseId;document.getElementById('journeyParentName').textContent=parent;document.getElementById('journeyLocation').textContent=`${demo.location} · Facebook: ${inquiry.facebook_name||demo.facebookName}`;const childHeader=document.getElementById('journeyChildName');childHeader.textContent=child?`Child: ${child}`:'';childHeader.hidden=!child;document.getElementById('journeyStage').textContent='Enrolled';document.getElementById('journeyStatus').textContent=journey.current_status==='enrollment_reported'?'Enrollment Reported':String(journey.current_status||'Enrollment').replace(/_/g,' ').replace(/\b\w/g,char=>char.toUpperCase());document.getElementById('journeyNextAction').textContent=journey.next_action_type==='process_enrollment'?'Process Enrollment':friendlyNext(journey.next_action_type,'enrollment');document.getElementById('scheduleActionCard').hidden=true;document.getElementById('handoffCard').hidden=true;document.getElementById('enrollmentActionCard').hidden=false;document.getElementById('enrollmentReportedWhen').textContent=enrollmentEvent?`Reported · ${formatDateTime(Number(enrollmentEvent.event_at)||Number(enrollmentEvent.created_at)||0)}`:'Enrollment reported';document.getElementById('enrollmentReportedWhere').textContent=demo.location;document.getElementById('enrollmentReportedNote').textContent=enrollmentEvent?.note||'No enrollment note.';renderRealTimeline(events);}catch(error){document.getElementById('enrollmentActionCard').hidden=true;}}
  /*   Xano owns the durable parent-confirmation state */
  async function loadParentConfirmation(scheduledFor){
    parentConfirmationState=null;const journeyId=Number(demo.journeyId);
    try{
      const confirmed=await readConfirmationStatus(journeyId,scheduledFor);
      if(Number(demo.journeyId)!==journeyId)return;
      parentConfirmationState=confirmed;
      if(confirmed)clearConfirmationRef(journeyId);
    }catch(_){parentConfirmationState=null;}
    showParentConfirmationGate();
  }
  function showParentConfirmationGate(){
    if(panel.dataset.stage!=='scheduled'||!stage2State)return;
    const block=document.getElementById('parentConfirmationBlock'),sent=Boolean(stage2State.franchiseSent),cancelled=Boolean(stage2State.cancelled);
    const pending=parentConfirmationState!==true;
    block.hidden=cancelled||!pending;
    const retry=pendingConfirmationRef(Number(demo.journeyId),stage2State.scheduledFor),shareButton=document.getElementById('shareParentConfirmation');
    shareButton.textContent=retry?'Retry Saving Confirmation':'Share Confirmation';
    document.getElementById('parentConfirmationExplanation').textContent=retry?'The confirmation message has already been recorded. Retry only its status save; do not send or record another copy.':sent?'Franchise details were already sent, but parent confirmation is not recorded for this appointment. Check Messenger before sending to avoid a duplicate.':'Send the confirmed details to the parent before the franchise handoff.';
    document.getElementById('parentConfirmationMessage').textContent=parentConfirmationState===null?'Unable to verify confirmation status. Check Messenger before proceeding.':'';
    if(sent||cancelled){
      document.getElementById('franchiseHandoffActions').hidden=true;
      document.getElementById('markFranchiseSent').hidden=true;
      document.getElementById('stage2DockSend').hidden=true;
      document.getElementById('handoffDetailsToggle').hidden=true;
      document.getElementById('handoffKicker').textContent='Franchise Handoff';
      document.getElementById('handoffStatus').textContent=cancelled?'Cancelled':'Sent';
      document.getElementById('journeyNextAction').textContent=cancelled?'Reschedule or Update Parent Status':'Wait for Visit / Free Trial';
      return;
    }
    document.getElementById('franchiseHandoffActions').hidden=pending;
    document.getElementById('copyMessageBlock').hidden=pending;
    document.getElementById('stage2DockSend').hidden=pending;
    document.getElementById('handoffDetailsToggle').hidden=pending;
    document.getElementById('handoffKicker').textContent=pending?'Parent Confirmation':'Franchise Handoff';
    document.getElementById('handoffStatus').textContent=pending?'Parent confirmation needed':'Ready to send';
    document.getElementById('journeyNextAction').textContent=pending?'Share Confirmation with Parent':'Send Details to Franchise';
  }
  document.getElementById('shareParentConfirmation').addEventListener('click',async()=>{
    if(!stage2State)return;const x=stage2State,d=new Date(x.scheduledFor),journeyId=Number(demo.journeyId);
    const retry=pendingConfirmationRef(journeyId,x.scheduledFor);
    if(retry){
      const status=document.getElementById('parentConfirmationMessage'),button=document.getElementById('shareParentConfirmation');
      if(!lockOwned||lockPending||lockJourneyId!==journeyId){status.textContent='Take Control before retrying the status save.';return;}
      button.disabled=true;status.textContent='Checking the existing confirmation before retrying…';
      try{
        if(!await readConfirmationStatus(journeyId,x.scheduledFor))await saveConfirmationReference(journeyId,x.scheduledFor,retry.messageId);
        await loadParentConfirmation(x.scheduledFor);
        if(parentConfirmationState!==true)throw Error('Confirmation is still not verified.');
        status.textContent='';replyStatus.textContent='Previously recorded confirmation verified. No new message was created.';
        window.dispatchEvent(new Event('parent-confirmation-recorded'));
      }catch(error){status.textContent='Unable to save confirmation status. Do not record the message again. '+(error.message||'');}
      finally{button.disabled=false;}
      return;
    }
    const rows=['👩 Parent: '+x.parent,'👧 Child: '+x.child,'🎂 Age: '+x.age,'📅 Date: '+d.toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'}),'🕘 Time: '+d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})].join('\n');
    replyManualMode=true;replyQuestionId=0;replyTemplateId=0;replyQuickFormActive=true;replySavedSuggestion=null;
    replyQuickFormDrafts={taglish:'Hi po! ❤️ Thank you for sending your details.\n\nConfirmed na po ang '+x.typeLabel.toLowerCase()+' schedule ng little one ninyo! 🌷\n\n'+rows+'\n\nSee you po! 💕',english:'Hi! ❤️ Your little one’s '+x.typeLabel.toLowerCase()+' is confirmed! 🌷\n\n'+rows+'\n\nSee you soon! 💕'};
    replyLanguage.value='taglish';renderReplyLanguageButton();replyEditor.value=replyQuickFormDrafts.taglish;replyMatchLabel.textContent='Appointment confirmation · Review before sending';replyStatus.textContent='Copy & Record Sent, then send through Messenger.';showReplyMode();renderReplyOptions();renderReplySearch();updateReplyButton();replyEditor.focus();
  });
  function rebuildStage2(data,render=true){const journey=data.journey||{};const inquiry=data.inquiry||{};const events=Array.isArray(data.ad_journey_events)?[...data.ad_journey_events]:[];events.sort((a,b)=>(Number(b.event_at)||Number(b.created_at)||0)-(Number(a.event_at)||Number(a.created_at)||0));const appointment=events.find(event=>event.event_type==='rescheduled'||event.event_type==='trial_scheduled'||event.event_type==='visit_scheduled');const baseSchedule=events.find(event=>event.event_type==='trial_scheduled'||event.event_type==='visit_scheduled');if(!appointment||!baseSchedule){renderRealTimeline(events);return;}const appointmentTime=Number(appointment.event_at)||Number(appointment.created_at)||0;const notified=events.find(event=>event.event_type==='franchise_notified'&&(Number(event.event_at)||Number(event.created_at)||0)>=appointmentTime);const baseDetails=baseSchedule.event_data&&typeof baseSchedule.event_data==='object'?baseSchedule.event_data:{};const appointmentDetails=appointment.event_data&&typeof appointment.event_data==='object'?appointment.event_data:{};const details={...baseDetails,...appointmentDetails};const scheduleType=details.schedule_type||((baseSchedule.event_type==='visit_scheduled')?'visit':'trial');const typeLabel=scheduleType==='visit'?'Visit':'Free Trial';const scheduledFor=Number(appointment.scheduled_for)||Number(baseSchedule.scheduled_for)||Number(journey.next_action_at)||0;const parent=details.parent_name||inquiry.facebook_name||demo.facebookName||'—';const facebook=inquiry.facebook_name||demo.facebookName||'—';const child=details.child_name||'—';const age=formatAge(details.age_years??'',details.age_months??'');const session=details.session_name||'None';const notes=appointment.note||baseSchedule.note||'—';const cancelled=journey.current_status==='cancelled';demo.facebookName=facebook;demo.franchiseId=Number(journey.franchise_id)||demo.franchiseId;stage2State={scheduledFor,sessionId:Number(details.session_id)||0,sessionName:session,note:appointment.note||'',typeLabel,parent,facebook,child,age,notes,detailsMessage:buildFranchiseMessage({typeLabel,parent,facebook,child,age,session,scheduledFor,notes})};document.getElementById('handoffDetailsLabel').textContent=`${typeLabel} Details`;document.getElementById('franchiseMessage').textContent=stage2State.detailsMessage;const childHeader=document.getElementById('journeyChildName');childHeader.textContent=child&&child!=='—'?`Child: ${child}`:'';childHeader.hidden=!child||child==='—';if(!render)return;document.getElementById('journeyParentName').textContent=parent;document.getElementById('journeyLocation').textContent=`${demo.location} · Facebook: ${facebook}`;document.getElementById('journeyStage').textContent='Appointment Scheduled';const sent=!cancelled&&Boolean(notified);stage2State.franchiseSent=sent;stage2State.cancelled=cancelled;document.getElementById('journeyStatus').textContent=cancelled?'Appointment Cancelled':sent?'Details Sent to Franchise':'Ready to Send to Franchise';document.getElementById('journeyNextAction').textContent=cancelled?'Reschedule or Update Parent Status':sent?'Wait for Visit / Free Trial':'Send Details to Franchise';document.getElementById('scheduleActionCard').hidden=true;document.getElementById('handoffCard').hidden=false;document.getElementById('stage2UpdateBlock').hidden=false;document.getElementById('handoffTitle').textContent=`${typeLabel} Scheduled`;document.getElementById('handoffStatus').textContent=cancelled?'Cancelled':sent?'Sent':'Ready to send';document.getElementById('scheduledWhen').textContent=formatDateTime(scheduledFor);document.getElementById('scheduledWhere').textContent=demo.location;document.getElementById('franchiseMessage').textContent=buildFranchiseMessage({typeLabel,parent,facebook,child,age,session,scheduledFor,notes});document.getElementById('handoffDetailsToggle').hidden=true;document.getElementById('handoffDetailsToggle').setAttribute('aria-expanded','true');document.getElementById('copyMessageBlock').hidden=false;document.getElementById('markFranchiseSent').hidden=cancelled||sent;document.getElementById('stage2DockSend').hidden=cancelled||sent;document.getElementById('stage2DockActions').style.gridTemplateColumns=sent&&!cancelled?'repeat(3,minmax(0,1fr))':'repeat(4,minmax(0,1fr))';document.getElementById('cancelAppointment').hidden=cancelled;const dueAt=Number(notified?.due_at)||0;document.getElementById('waitingBlock').hidden=cancelled||!sent;document.getElementById('expectedUpdateTime').textContent=dueAt?formatDateTime(dueAt):'—';document.getElementById('franchiseResultBlock').hidden=true;renderRealTimeline(events);if(!cancelled){showParentConfirmationGate();loadParentConfirmation(scheduledFor);}else document.getElementById('parentConfirmationBlock').hidden=true;}
  function renderRealTimeline(events){const timeline=document.getElementById('journeyTimeline');timeline.innerHTML='';if(!events.length){timeline.innerHTML='<div class="timeline-item"><span class="timeline-dot"></span><div><strong>No journey history yet</strong></div></div>';return;}events.forEach(event=>{const item=document.createElement('div');item.className='timeline-item';const dot=document.createElement('span');dot.className='timeline-dot';const body=document.createElement('div');const title=document.createElement('strong');title.textContent=eventTitle(event);const detail=document.createElement('p');detail.textContent=eventDetail(event);const when=document.createElement('small');const admin=typeof window.adsJourneyEventActorName==='function'?window.adsJourneyEventActorName(event):(event._ad_user?.name||(Number(event.ad_user_id)>0?'Admin #'+event.ad_user_id:'System'));when.textContent=`${admin} · ${formatDateTime(Number(event.event_at)||Number(event.created_at)||0)}`;body.append(title,detail,when);item.append(dot,body);timeline.appendChild(item);});}
  function eventTitle(event){const map={inquiry_created:'Inquiry created',visit_scheduled:'Visit scheduled',trial_scheduled:'Free trial scheduled',franchise_notified:'Details sent to franchise',parent_confirmation_sent:'Parent Confirmation Sent',rescheduled:'Appointment rescheduled',cancelled:'Appointment cancelled',no_show:'No show',visit_completed:'Visit completed',trial_completed:'Free trial completed',follow_up_scheduled:'Follow-up scheduled',follow_up_completed:'Follow-up completed',parent_interested:'Parent interested',parent_not_interested:'Parent not interested',enrollment_reported:'Enrollment reported',enrollment_reverted:'Enrollment reverted',enrollment_processed:'Enrollment processed',journey_closed:'Journey closed',journey_dormant:'Journey dormant',journey_reactivated:'Journey reactivated',parent_message_sent:'Continuing Conversation'};return map[event.event_type]||String(event.event_type||'Journey activity').replace(/_/g,' ');}
  function eventDetail(event){const data=event.event_data&&typeof event.event_data==='object'?event.event_data:{};if(event.event_type==='parent_confirmation_sent'){const time=Number(event.scheduled_for)||0;return (time?'Appointment: '+formatDateTime(time)+(event.note?' · ':''):'')+(event.note||'');}if(event.event_type==='trial_scheduled'||event.event_type==='visit_scheduled'){const parts=[];if(event.scheduled_for)parts.push(formatDateTime(Number(event.scheduled_for)));if(data.session_name)parts.push(data.session_name);return parts.join(' · ')||event.note||'';}if(event.event_type==='rescheduled'){const parts=[];if(event.scheduled_for)parts.push(formatDateTime(Number(event.scheduled_for)));if(data.session_name)parts.push(data.session_name);if(event.note)parts.push(event.note);return parts.join(' · ');}if(event.event_type==='franchise_notified'&&event.due_at)return`Update expected ${formatDateTime(Number(event.due_at))}`;return event.note||'';}
  function buildFranchiseMessage({typeLabel,parent,facebook,child,age,session,scheduledFor,notes}){const date=new Date(Number(scheduledFor)||0);const dateText=scheduledFor?date.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):'—';const timeText=scheduledFor?date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'—';const rows=[['Parent',parent],['Facebook',facebook],['Child',child],['Age',age],['Session',session],['Date',dateText],['Time',timeText],['Notes',notes||'—']];const width=Math.max(...rows.map(row=>row[0].length));return typeLabel.toUpperCase()+' — '+demo.location.toUpperCase()+'\n'+rows.map(row=>row[0].padEnd(width)+': '+row[1]).join('\n');}
  async function resolveFranchiseId(location){try{const response=await fetch(`${API}/ad_franchises`,{headers:{Authorization:`Bearer ${journeyToken}`}});if(!response.ok)return null;const data=await response.json();const rows=Array.isArray(data)?data:(data.items||data.records||data.franchise||data.franchises||[]);const match=rows.find(row=>(row.location||row.name||row.franchise_name||row.branch_name||'').trim()===location);return match?.id||null;}catch(error){return null;}}
  async function loadSessions(franchiseId,selectId='scheduleSession',selectedValue=0){const select=document.getElementById(selectId);if(!select)return;select.innerHTML='<option value="0">None</option>';try{const response=await fetch(`${API}/ad_get_sessions?franchise_id=${encodeURIComponent(franchiseId)}`,{headers:{Authorization:`Bearer ${journeyToken}`}});if(!response.ok)throw new Error('SESSION_LOAD_FAILED');const data=await response.json();const sessions=Array.isArray(data.sessions)?data.sessions:[];select.innerHTML='<option value="0">None</option>';sessions.filter(item=>item.is_active!==false&&typeof item.name==='string'&&item.name.trim()).forEach(item=>{const option=document.createElement('option');option.value=String(item.id);option.textContent=item.name.trim();option.dataset.start=item.start_time_slot||'';option.dataset.end=item.end_time_slot||'';select.appendChild(option);});select.value=String(selectedValue||0);if(select.value!==String(selectedValue||0))select.value='0';}catch(error){select.innerHTML='<option value="0">None</option>';}}
  function usageEvent(type,details){if(typeof window.trackUsageEvent==='function')window.trackUsageEvent(type,details);}
  function buildInitialTimeline(row){const detail=row.querySelector('p')?.textContent.trim()||'Inquiry created.';document.getElementById('journeyTimeline').innerHTML=`<div class="timeline-item"><span class="timeline-dot"></span><div><strong>Inquiry created</strong><p>${detail}</p><small>Journey history will load from ad_journey_event.</small></div></div>`;}
  function buildTimeSelectors(){buildTimeSelectSet('scheduleHour','scheduleMinute');setScheduleDefaults();}
  function buildRescheduleTimeSelectors(){buildTimeSelectSet('rescheduleHour','rescheduleMinute');}
  function buildFollowUpTimeSelectors(){buildTimeSelectSet('followUpHour','followUpMinute');setFollowUpDefaults();}
  function buildTimeSelectSet(hourId,minuteId){const hour=document.getElementById(hourId),minute=document.getElementById(minuteId);if(!hour||!minute||hour.options.length)return;for(let i=1;i<=12;i++){const option=document.createElement('option');option.value=String(i);option.textContent=String(i);hour.appendChild(option);}for(let i=0;i<60;i+=5){const option=document.createElement('option');option.value=String(i).padStart(2,'0');option.textContent=String(i).padStart(2,'0');minute.appendChild(option);}}
  function setScheduleDefaults(){const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const localDate=new Date(tomorrow.getTime()-tomorrow.getTimezoneOffset()*60000).toISOString().slice(0,10);document.getElementById('scheduleDate').value=localDate;document.getElementById('scheduleHour').value='9';document.getElementById('scheduleMinute').value='00';document.getElementById('schedulePeriod').value='AM';document.getElementById('scheduleAgeYears').value='2';document.getElementById('scheduleAgeMonths').value='0';const session=document.getElementById('scheduleSession');if(session)session.value='0';}
  function setRescheduleDefaults(){const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const localDate=new Date(tomorrow.getTime()-tomorrow.getTimezoneOffset()*60000).toISOString().slice(0,10);document.getElementById('rescheduleDate').value=localDate;document.getElementById('rescheduleHour').value='9';document.getElementById('rescheduleMinute').value='00';document.getElementById('reschedulePeriod').value='AM';}
  function setFollowUpDefaults(){const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const localDate=new Date(tomorrow.getTime()-tomorrow.getTimezoneOffset()*60000).toISOString().slice(0,10);const date=document.getElementById('followUpDate');if(date)date.value=localDate;document.querySelectorAll('[data-follow-up-days]').forEach(button=>button.classList.toggle('is-selected',button.dataset.followUpDays==='1'));const hour=document.getElementById('followUpHour');if(hour)hour.value='9';const minute=document.getElementById('followUpMinute');if(minute)minute.value='00';const period=document.getElementById('followUpPeriod');if(period)period.value='AM';}
  function getSelectedTime(){return getTimeFromSelects('scheduleHour','scheduleMinute','schedulePeriod');}
  function getRescheduleTime(){return getTimeFromSelects('rescheduleHour','rescheduleMinute','reschedulePeriod');}
  function getFollowUpTime(){return getTimeFromSelects('followUpHour','followUpMinute','followUpPeriod');}
  function getTimeFromSelects(hourId,minuteId,periodId){const hour=Number(document.getElementById(hourId).value),minute=document.getElementById(minuteId).value,period=document.getElementById(periodId).value;if(!hour||minute===''||!period)return'';let h=hour%12;if(period==='PM')h+=12;return`${String(h).padStart(2,'0')}:${minute}`;}
  function addTimeline(title,detail){let admin='Admin';try{const user=JSON.parse(localStorage.getItem('ads_journey_user')||'{}');admin=user.name||user.email||'Admin';}catch(error){}const item=document.createElement('div');item.className='timeline-item';const dot=document.createElement('span');dot.className='timeline-dot';const body=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;const p=document.createElement('p');p.textContent=detail;const small=document.createElement('small');small.textContent=`${admin} · ${formatDateTime(Date.now())}`;body.append(strong,p,small);item.append(dot,body);document.getElementById('journeyTimeline').prepend(item);}
  function formatAge(years,months){const parts=[];if(years!==''&&Number(years)>0)parts.push(`${Number(years)} ${Number(years)===1?'year':'years'}`);if(months!==''&&Number(months)>0)parts.push(`${Number(months)} ${Number(months)===1?'month':'months'}`);return parts.length?parts.join(' '):'—';}
  function formatDate(value){return new Date(`${value}T00:00:00`).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'});}
  function formatTime(value){const [h,m]=value.split(':');const d=new Date();d.setHours(Number(h),Number(m),0,0);return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
  function formatDateTime(value){const timestamp=Number(value)||0;if(!timestamp)return'—';const date=new Date(timestamp);return`${date.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})} · ${date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initJourneyPanel);else initJourneyPanel();